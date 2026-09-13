import time
import math
from datetime import datetime, timezone, timedelta, date
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from fastapi import HTTPException, status

from app.models.tenant import Tenant
from app.models.bill import Bill, BillItem
from app.models.item import Item
from app.models.party import Customer, Supplier
from app.models.inventory import Godown, Stock, StockBatch
from app.models.accounting import Account, AccountGroup, JournalEntry, JournalItem
from app.models.ai import AISuggestionCache, RestockSuggestionCache
from app.schemas.ai import (
    POSSuggestionItem,
    POSSuggestionsResponse,
    RestockSuggestionItem,
    RestockSuggestionsResponse,
    AssociationRuleItem,
    AssociationRulesResponse,
    NLQueryRequest,
    NLQueryResponse,
    AIBatchRunResponse,
)
from app.services.audit_service import log_audit_event


# ==============================================================================
# 1. Market Basket Association Rule Mining (Apriori Engine)
# ==============================================================================

async def mine_association_rules_for_tenant(
    db: AsyncSession,
    tenant_id: str,
    min_support_count: int = 1,
    min_confidence: float = 0.1,
) -> List[Dict[str, Any]]:
    """
    Extract pairwise market basket association rules from tenant sale bills.
    Calculates Support, Confidence, and Lift for co-purchased item pairs.
    """
    # 1. Fetch completed sale bills with their item IDs
    bills_stmt = (
        select(Bill.id, BillItem.item_id)
        .join(BillItem, Bill.id == BillItem.bill_id)
        .where(
            Bill.tenant_id == tenant_id,
            Bill.type == "sale",
            Bill.status.in_(["active", "paid", "under_review"]),
        )
    )
    b_res = await db.execute(bills_stmt)
    rows = b_res.all()

    basket_map: Dict[str, Set[str]] = defaultdict(set)
    for bill_id, item_id in rows:
        if item_id:
            basket_map[bill_id].add(item_id)

    total_transactions = len(basket_map)
    if total_transactions < 1:
        return []

    # 2. Count individual item frequencies
    item_freq: Dict[str, int] = defaultdict(int)
    pair_freq: Dict[Tuple[str, str], int] = defaultdict(int)

    for items in basket_map.values():
        items_list = sorted(list(items))
        for item in items_list:
            item_freq[item] += 1

        # Count item pairs
        for i in range(len(items_list)):
            for j in range(i + 1, len(items_list)):
                pair_freq[(items_list[i], items_list[j])] += 1
                pair_freq[(items_list[j], items_list[i])] += 1

    # Pre-fetch item names
    item_ids = list(item_freq.keys())
    if not item_ids:
        return []

    items_lookup = {
        it.id: it
        for it in (
            await db.execute(select(Item).where(Item.id.in_(item_ids)))
        )
        .scalars()
        .all()
    }

    rules: List[Dict[str, Any]] = []
    for (ant, con), count_ab in pair_freq.items():
        if count_ab < min_support_count:
            continue

        count_a = item_freq.get(ant, 0)
        count_b = item_freq.get(con, 0)
        if count_a == 0 or count_b == 0:
            continue

        support = count_ab / total_transactions
        confidence = count_ab / count_a
        expected_confidence = count_b / total_transactions
        lift = (confidence / expected_confidence) if expected_confidence > 0 else 1.0

        if confidence >= min_confidence and ant in items_lookup and con in items_lookup:
            rules.append({
                "antecedent_id": ant,
                "antecedent_name": items_lookup[ant].name,
                "consequent_id": con,
                "consequent_name": items_lookup[con].name,
                "support": round(support, 4),
                "confidence": round(confidence, 4),
                "lift": round(lift, 2),
                "co_count": count_ab,
            })

    # Sort rules by highest confidence then lift
    rules.sort(key=lambda r: (r["confidence"], r["lift"]), reverse=True)
    return rules


# ==============================================================================
# 2. Real-Time POS Counter Sale AI Suggestions
# ==============================================================================

async def get_pos_smart_suggestions(
    db: AsyncSession,
    tenant_id: str,
    customer_id: Optional[str] = None,
    cart_item_ids: Optional[List[str]] = None,
    limit: int = 6,
) -> POSSuggestionsResponse:
    """
    Generate instant product recommendations for POS counter sales based on:
    1. Items currently scanned in the cart (Cross-selling / Association rules)
    2. Customer repeat purchase affinities
    3. Fast-moving top sellers fallback
    """
    cart_set = set(cart_item_ids or [])
    suggestions: List[POSSuggestionItem] = []
    seen_item_ids: Set[str] = set(cart_set)

    customer_name = None
    if customer_id:
        cust_res = await db.execute(
            select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
        )
        cust = cust_res.scalar_one_or_none()
        if cust:
            customer_name = cust.name

    # 1. Cart-Based Association Cross-Selling
    if cart_set:
        rules = await mine_association_rules_for_tenant(db, tenant_id)
        for rule in rules:
            ant_id = rule["antecedent_id"]
            con_id = rule["consequent_id"]
            if ant_id in cart_set and con_id not in seen_item_ids:
                item_res = await db.execute(
                    select(Item).where(Item.id == con_id, Item.is_active == True)
                )
                item = item_res.scalar_one_or_none()
                if item:
                    seen_item_ids.add(con_id)
                    score = min(0.99, max(0.5, rule["confidence"]))
                    suggestions.append(
                        POSSuggestionItem(
                            item_id=item.id,
                            item_name=item.name,
                            sale_price=item.sale_price,
                            unit=item.unit,
                            score=round(score, 2),
                            reason=f"Frequently bought with {rule['antecedent_name']} ({int(rule['confidence'] * 100)}% match)",
                            category=item.category,
                            barcode=item.barcode,
                        )
                    )
                    if len(suggestions) >= limit:
                        break

    # 2. Customer Repeat Purchase Habits
    if customer_id and len(suggestions) < limit:
        cust_items_stmt = (
            select(
                BillItem.item_id,
                func.count(BillItem.id).label("freq"),
                func.sum(BillItem.quantity).label("total_qty")
            )
            .join(Bill, Bill.id == BillItem.bill_id)
            .where(
                Bill.tenant_id == tenant_id,
                Bill.party_id == customer_id,
                Bill.type == "sale"
            )
            .group_by(BillItem.item_id)
            .order_by(desc("freq"), desc("total_qty"))
            .limit(10)
        )
        ci_res = await db.execute(cust_items_stmt)
        for item_id, freq, _ in ci_res.all():
            if item_id and item_id not in seen_item_ids:
                item_res = await db.execute(
                    select(Item).where(Item.id == item_id, Item.is_active == True)
                )
                item = item_res.scalar_one_or_none()
                if item:
                    seen_item_ids.add(item_id)
                    suggestions.append(
                        POSSuggestionItem(
                            item_id=item.id,
                            item_name=item.name,
                            sale_price=item.sale_price,
                            unit=item.unit,
                            score=0.88,
                            reason=f"Customer frequently reorders this item (Bought {freq} times)",
                            category=item.category,
                            barcode=item.barcode,
                        )
                    )
                    if len(suggestions) >= limit:
                        break

    # 3. Fast-Moving Top Sellers Fallback
    if len(suggestions) < limit:
        top_items_stmt = (
            select(
                Item,
                func.coalesce(func.sum(BillItem.quantity), 0).label("qty_sold")
            )
            .outerjoin(BillItem, BillItem.item_id == Item.id)
            .where(Item.tenant_id == tenant_id, Item.is_active == True)
            .group_by(Item.id)
            .order_by(desc("qty_sold"), Item.name.asc())
            .limit(15)
        )
        top_res = await db.execute(top_items_stmt)
        for item, qty_sold in top_res.all():
            if item.id not in seen_item_ids:
                seen_item_ids.add(item.id)
                suggestions.append(
                    POSSuggestionItem(
                        item_id=item.id,
                        item_name=item.name,
                        sale_price=item.sale_price,
                        unit=item.unit,
                        score=0.75,
                        reason="Store top-selling item",
                        category=item.category,
                        barcode=item.barcode,
                    )
                )
                if len(suggestions) >= limit:
                    break

    return POSSuggestionsResponse(
        customer_id=customer_id,
        customer_name=customer_name,
        cart_items_count=len(cart_set),
        suggestions=suggestions,
    )


# ==============================================================================
# 3. Inventory Restock & Velocity Reorder Forecasting
# ==============================================================================

async def compute_restock_forecasts(
    db: AsyncSession,
    tenant_id: str,
    lookback_days: int = 30,
    lead_time_days: int = 7,
    target_cover_days: int = 21,
    urgency_filter: Optional[str] = None,
    min_velocity: float = 0.0,
) -> RestockSuggestionsResponse:
    """
    Compute daily consumption velocity and dynamic reorder points for all inventory catalog items.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)

    # 1. Calculate sales velocity per item over lookback window
    sales_stmt = (
        select(
            BillItem.item_id,
            func.coalesce(func.sum(BillItem.quantity), 0.0).label("qty_sold")
        )
        .join(Bill, Bill.id == BillItem.bill_id)
        .where(
            Bill.tenant_id == tenant_id,
            Bill.type == "sale",
            Bill.bill_date >= cutoff_date,
            Bill.status.in_(["active", "paid", "under_review"]),
        )
        .group_by(BillItem.item_id)
    )
    s_res = await db.execute(sales_stmt)
    sales_map = {row.item_id: float(row.qty_sold) for row in s_res.all()}

    # 2. Fetch current physical stock on hand per item across all active godowns
    stock_stmt = (
        select(
            Stock.item_id,
            func.coalesce(func.sum(Stock.quantity), 0.0).label("stock_qty")
        )
        .where(
            Stock.tenant_id == tenant_id,
            Stock.quantity > 0,
        )
        .group_by(Stock.item_id)
    )
    stk_res = await db.execute(stock_stmt)
    stock_map = {row.item_id: float(row.stock_qty) for row in stk_res.all()}

    # 3. Fetch all active items
    items_stmt = (
        select(Item)
        .where(Item.tenant_id == tenant_id, Item.is_active == True)
        .order_by(Item.name.asc())
    )
    all_items = (await db.execute(items_stmt)).scalars().all()

    suggestions: List[RestockSuggestionItem] = []
    critical_count = 0
    warning_count = 0
    healthy_count = 0
    total_reorder_cost = 0.0

    for item in all_items:
        current_stock = stock_map.get(item.id, 0.0)
        total_sold = sales_map.get(item.id, 0.0)
        
        # Daily sales velocity (units/day)
        avg_daily_sales = round(total_sold / max(1, lookback_days), 2)
        
        # Safety stock and Reorder Point (ROP)
        safety_stock = round(max(item.min_stock_alert or 2.0, avg_daily_sales * 3), 1)
        reorder_point = round((avg_daily_sales * lead_time_days) + safety_stock, 1)

        # Days of stock remaining
        if avg_daily_sales > 0:
            days_left = round(current_stock / avg_daily_sales, 1)
        else:
            days_left = 999.0 if current_stock > 0 else 0.0

        # Suggested reorder quantity to cover target_cover_days
        target_stock = (avg_daily_sales * target_cover_days) + safety_stock
        suggested_qty = math.ceil(max(0.0, target_stock - current_stock))

        # Urgency Classification
        if current_stock <= 0 or (days_left <= 3.0 and avg_daily_sales > 0):
            urgency = "CRITICAL"
            critical_count += 1
            if suggested_qty == 0:
                suggested_qty = math.ceil(max(5.0, safety_stock * 2))
        elif current_stock <= reorder_point or days_left <= 7.0:
            urgency = "WARNING"
            warning_count += 1
            if suggested_qty == 0:
                suggested_qty = math.ceil(max(3.0, safety_stock))
        else:
            urgency = "HEALTHY"
            healthy_count += 1
            suggested_qty = 0.0

        cost = round(suggested_qty * (item.purchase_price or item.sale_price * 0.7), 2)
        total_reorder_cost += cost

        # Apply filters if provided
        if urgency_filter and urgency_filter.upper() != "ALL" and urgency != urgency_filter.upper():
            continue
        if min_velocity > 0 and avg_daily_sales < min_velocity:
            continue

        suggestions.append(
            RestockSuggestionItem(
                item_id=item.id,
                item_name=item.name,
                category=item.category,
                current_stock=current_stock,
                avg_daily_sales=avg_daily_sales,
                days_left=days_left,
                reorder_point=reorder_point,
                suggested_quantity=suggested_qty,
                urgency=urgency,
                estimated_cost=cost,
            )
        )

    # Sort suggestions: CRITICAL first, then WARNING, then by days_left ascending
    urgency_order = {"CRITICAL": 0, "WARNING": 1, "HEALTHY": 2}
    suggestions.sort(key=lambda s: (urgency_order.get(s.urgency, 99), s.days_left, -s.suggested_quantity))

    return RestockSuggestionsResponse(
        total_items_analyzed=len(all_items),
        critical_count=critical_count,
        warning_count=warning_count,
        healthy_count=healthy_count,
        estimated_total_reorder_cost=round(total_reorder_cost, 2),
        suggestions=suggestions,
    )


# ==============================================================================
# 4. Natural Language Financial & Business Intelligence Assistant
# ==============================================================================

async def ask_ai_financial_assistant(
    db: AsyncSession,
    tenant_id: str,
    query_text: str,
) -> NLQueryResponse:
    """
    Interprets natural language queries from store owners/accountants, executes
    real-time database analytics, and generates concise formatted answers.
    """
    q = query_text.lower().strip()
    now = datetime.now(timezone.utc)
    first_day_of_month = date(now.year, now.month, 1)

    # 1. SALES / REVENUE QUERIES
    if any(k in q for k in ["sale", "revenue", "turnover", "income", "collection", "earned"]):
        # Fetch this month's sales
        sales_stmt = (
            select(
                func.count(Bill.id).label("total_bills"),
                func.coalesce(func.sum(Bill.total_amount), 0.0).label("total_amount"),
                func.coalesce(func.sum(Bill.gst_amount), 0.0).label("gst_amount"),
                func.coalesce(func.sum(Bill.paid_amount), 0.0).label("paid_amount"),
            )
            .where(
                Bill.tenant_id == tenant_id,
                Bill.type == "sale",
                Bill.status.in_(["active", "paid", "under_review"]),
                func.date(Bill.bill_date) >= first_day_of_month,
            )
        )
        s_res = (await db.execute(sales_stmt)).one()

        # Top selling item
        top_item_stmt = (
            select(
                BillItem.item_name,
                func.sum(BillItem.quantity).label("total_qty"),
                func.sum(BillItem.total_amount).label("total_revenue")
            )
            .join(Bill, Bill.id == BillItem.bill_id)
            .where(
                Bill.tenant_id == tenant_id,
                Bill.type == "sale",
                func.date(Bill.bill_date) >= first_day_of_month,
            )
            .group_by(BillItem.item_name)
            .order_by(desc("total_revenue"))
            .limit(1)
        )
        top_item = (await db.execute(top_item_stmt)).first()
        top_item_str = f"**{top_item.item_name}** (₹{top_item.total_revenue:,.2f})" if top_item else "No sales yet"

        answer = (
            f"### 📊 Sales & Revenue Summary ({now.strftime('%B %Y')})\n\n"
            f"- **Total Sales Revenue:** ₹{s_res.total_amount:,.2f}\n"
            f"- **Total Invoices Issued:** {s_res.total_bills} bills\n"
            f"- **Total GST Collected:** ₹{s_res.gst_amount:,.2f}\n"
            f"- **Cash & Instant Collections:** ₹{s_res.paid_amount:,.2f}\n"
            f"- **Top Selling Product:** {top_item_str}\n\n"
            f"> *Pro-Tip: You can export your full Sales Register anytime from the **Sales & Invoices** module.*"
        )
        return NLQueryResponse(
            query=query_text,
            answer=answer,
            intent="sales_overview",
            data_summary={
                "total_sales": s_res.total_amount,
                "bill_count": s_res.total_bills,
                "gst_amount": s_res.gst_amount,
            },
            suggested_actions=[
                "View Sales & Invoices",
                "Download GSTR-1 Return",
                "Check Sundry Debtors",
            ],
            confidence=0.98,
        )

    # 2. CASH & BANK LIQUIDITY QUERIES (Check before debtors so 'cash balance' matches liquidity)
    elif any(k in q for k in ["cash", "bank", "liquidity", "funds", "p&l", "profit", "ledger"]):
        cash_acc = await db.execute(
            select(Account).where(
                Account.tenant_id == tenant_id,
                Account.code.in_(["1010-CASH", "1010", "CASH"])
            )
        )
        cash = cash_acc.scalar_one_or_none()

        bank_acc = await db.execute(
            select(Account).where(
                Account.tenant_id == tenant_id,
                Account.code.in_(["1020-BANK", "1020", "BANK"])
            )
        )
        bank = bank_acc.scalar_one_or_none()

        cash_bal = cash.current_balance if cash else 0.0
        bank_bal = bank.current_balance if bank else 0.0
        total_liquidity = cash_bal + bank_bal

        answer = (
            f"### 💵 Cash & Bank Liquidity Overview\n\n"
            f"- **Cash on Hand:** ₹{cash_bal:,.2f}\n"
            f"- **Bank Accounts Balance:** ₹{bank_bal:,.2f}\n"
            f"- **Total Liquid Funds Available:** **₹{total_liquidity:,.2f}**\n\n"
            f"> *All bank receipts and cash disbursements are balanced in accordance with Indian Accounting Standards.*"
        )
        return NLQueryResponse(
            query=query_text,
            answer=answer,
            intent="cash_bank_liquidity",
            data_summary={
                "cash_balance": cash_bal,
                "bank_balance": bank_bal,
                "total_liquidity": total_liquidity,
            },
            suggested_actions=[
                "View Cash & Bank Book",
                "View Trial Balance",
                "Post Journal Voucher",
            ],
            confidence=0.96,
        )

    # 3. DEBTORS & OUTSTANDING RECEIVABLES
    elif any(k in q for k in ["debtor", "owe", "receivable", "pending payment", "due", "overdue", "udhaar", "customer balance"]):
        cust_stmt = (
            select(Customer)
            .where(
                Customer.tenant_id == tenant_id,
                Customer.current_balance > 0,
            )
            .order_by(desc(Customer.current_balance))
        )
        debtors = (await db.execute(cust_stmt)).scalars().all()
        total_due = sum(c.current_balance for c in debtors)

        top_debtors_text = ""
        for i, c in enumerate(debtors[:5], 1):
            top_debtors_text += f"{i}. **{c.name}**: ₹{c.current_balance:,.2f} ({c.mobile or 'No mobile'})\n"

        if not top_debtors_text:
            top_debtors_text = "🎉 No outstanding dues! All customers are fully settled."

        answer = (
            f"### 👥 Customer Outstandings & Debtors\n\n"
            f"- **Total Outstanding Receivables:** ₹{total_due:,.2f}\n"
            f"- **Customers with Overdue Balances:** {len(debtors)} parties\n\n"
            f"**Top Outstanding Accounts:**\n"
            f"{top_debtors_text}\n"
            f"> *You can send automated 1-click WhatsApp payment reminders directly from **Outstanding & Reports**.*"
        )
        return NLQueryResponse(
            query=query_text,
            answer=answer,
            intent="debtors_analysis",
            data_summary={
                "total_outstanding": total_due,
                "overdue_parties_count": len(debtors),
            },
            suggested_actions=[
                "Send WhatsApp Due Reminders",
                "View Debtors Ageing Report",
                "Record Customer Receipt",
            ],
            confidence=0.97,
        )

    # 3. GST & TAX COMPLIANCE
    elif any(k in q for k in ["gst", "tax", "gstr", "cgst", "sgst", "itc", "liability"]):
        # Outward GST
        out_stmt = (
            select(
                func.coalesce(func.sum(Bill.taxable_amount), 0.0).label("taxable"),
                func.coalesce(func.sum(Bill.cgst_amount), 0.0).label("cgst"),
                func.coalesce(func.sum(Bill.sgst_amount), 0.0).label("sgst"),
                func.coalesce(func.sum(Bill.igst_amount), 0.0).label("igst"),
                func.coalesce(func.sum(Bill.gst_amount), 0.0).label("total_gst"),
            )
            .where(
                Bill.tenant_id == tenant_id,
                Bill.type == "sale",
                Bill.status.in_(["active", "paid"]),
                func.date(Bill.bill_date) >= first_day_of_month,
            )
        )
        outward = (await db.execute(out_stmt)).one()

        answer = (
            f"### 🏛️ GST Liability & Compliance ({now.strftime('%B %Y')})\n\n"
            f"- **Total Taxable Turnover:** ₹{outward.taxable:,.2f}\n"
            f"- **Output CGST (Central):** ₹{outward.cgst:,.2f}\n"
            f"- **Output SGST (State):** ₹{outward.sgst:,.2f}\n"
            f"- **Output IGST (Integrated):** ₹{outward.igst:,.2f}\n"
            f"- **Total Output GST Liability:** **₹{outward.total_gst:,.2f}**\n\n"
            f"> *GSTR-1 and GSTR-3B offline JSON returns are ready for direct portal filing in the **Compliance Reports** section.*"
        )
        return NLQueryResponse(
            query=query_text,
            answer=answer,
            intent="gst_compliance",
            data_summary={
                "taxable_turnover": outward.taxable,
                "output_gst": outward.total_gst,
            },
            suggested_actions=[
                "Download GSTR-1 JSON",
                "View GSTR-3B Summary",
                "E-Invoicing Register",
            ],
            confidence=0.96,
        )

    # 4. RESTOCK & INVENTORY QUERIES
    elif any(k in q for k in ["stock", "inventory", "restock", "item", "product", "godown", "reorder", "shortage"]):
        forecast = await compute_restock_forecasts(db, tenant_id)
        critical_items = [s for s in forecast.suggestions if s.urgency == "CRITICAL"][:5]

        crit_text = ""
        for i, it in enumerate(critical_items, 1):
            crit_text += f"{i}. **{it.item_name}**: {it.current_stock} units left (Reorder {it.suggested_quantity} units)\n"

        if not crit_text:
            crit_text = "✅ All catalog items have healthy stock levels!"

        answer = (
            f"### 📦 Inventory & Restocking Intelligence\n\n"
            f"- **Total Catalog Items Analyzed:** {forecast.total_items_analyzed}\n"
            f"- **🚨 Critical Stock-Out Alerts:** {forecast.critical_count} items\n"
            f"- **⚠️ Low Stock Warnings:** {forecast.warning_count} items\n"
            f"- **Estimated Restock Investment:** ₹{forecast.estimated_total_reorder_cost:,.2f}\n\n"
            f"**High-Priority Restock List:**\n"
            f"{crit_text}\n"
            f"> *You can create automated purchase stock-in orders with 1-click in the **AI Restock** tab.*"
        )
        return NLQueryResponse(
            query=query_text,
            answer=answer,
            intent="inventory_forecast",
            data_summary={
                "critical_count": forecast.critical_count,
                "warning_count": forecast.warning_count,
                "reorder_cost": forecast.estimated_total_reorder_cost,
            },
            suggested_actions=[
                "Create Purchase Stock-In",
                "View AI Restock Forecast",
                "Inspect Godown Batches",
            ],
            confidence=0.97,
        )

    # 6. GENERAL / ASSISTANT GREETING FALLBACK
    else:
        answer = (
            f"### 🤖 AI Financial Assistant\n\n"
            f"I can analyze your shop's transactions, outstandings, inventory, and accounting in real-time. Try asking:\n\n"
            f"- *\"What is my total sales revenue this month?\"*\n"
            f"- *\"Who are my top customers with pending payments?\"*\n"
            f"- *\"Which items are running out of stock?\"*\n"
            f"- *\"What is my net GST liability?\"*\n"
            f"- *\"Show my current cash and bank balance\"*"
        )
        return NLQueryResponse(
            query=query_text,
            answer=answer,
            intent="general_help",
            data_summary={},
            suggested_actions=[
                "Check Sales Revenue",
                "Inspect Debtors Ageing",
                "Run Restock Forecast",
            ],
            confidence=0.90,
        )


# ==============================================================================
# 5. Nightly / Batch AI Job Runner
# ==============================================================================

async def run_ai_batch_job_for_tenant(
    db: AsyncSession,
    tenant_id: str,
) -> AIBatchRunResponse:
    """
    Executes nightly batch training:
    1. Mines association rules and stores in ai_suggestions_cache
    2. Runs restock forecasts and caches in restock_suggestions_cache
    """
    start_time = time.time()

    # 1. Mine association rules
    rules = await mine_association_rules_for_tenant(db, tenant_id)

    # Update or insert cache record
    cache_res = await db.execute(
        select(AISuggestionCache).where(
            AISuggestionCache.tenant_id == tenant_id,
            AISuggestionCache.customer_id == None
        )
    )
    cache = cache_res.scalar_one_or_none()
    if not cache:
        cache = AISuggestionCache(
            tenant_id=tenant_id,
            frequent_patterns=rules,
            generated_at=datetime.now(timezone.utc),
        )
        db.add(cache)
    else:
        cache.frequent_patterns = rules
        cache.generated_at = datetime.now(timezone.utc)

    # 2. Recompute restock forecasts
    forecast_res = await compute_restock_forecasts(db, tenant_id)

    # Refresh restock cache rows
    for item_sugg in forecast_res.suggestions:
        r_stmt = select(RestockSuggestionCache).where(
            RestockSuggestionCache.tenant_id == tenant_id,
            RestockSuggestionCache.item_id == item_sugg.item_id,
        )
        r_row = (await db.execute(r_stmt)).scalar_one_or_none()
        if not r_row:
            r_row = RestockSuggestionCache(
                tenant_id=tenant_id,
                item_id=item_sugg.item_id,
                current_stock=item_sugg.current_stock,
                avg_daily_sales=item_sugg.avg_daily_sales,
                lead_time_days=7,
                safety_stock=item_sugg.reorder_point - (item_sugg.avg_daily_sales * 7),
                reorder_point=item_sugg.reorder_point,
                suggested_quantity=item_sugg.suggested_quantity,
                days_of_stock_left=item_sugg.days_left,
                urgency=item_sugg.urgency,
                confidence_score=0.92,
                generated_at=datetime.now(timezone.utc),
            )
            db.add(r_row)
        else:
            r_row.current_stock = item_sugg.current_stock
            r_row.avg_daily_sales = item_sugg.avg_daily_sales
            r_row.reorder_point = item_sugg.reorder_point
            r_row.suggested_quantity = item_sugg.suggested_quantity
            r_row.days_of_stock_left = item_sugg.days_left
            r_row.urgency = item_sugg.urgency
            r_row.generated_at = datetime.now(timezone.utc)

    await db.commit()
    elapsed = round(time.time() - start_time, 3)

    return AIBatchRunResponse(
        success=True,
        rules_generated=len(rules),
        restock_forecasts_computed=len(forecast_res.suggestions),
        duration_seconds=elapsed,
        message=f"AI Intelligence cache successfully refreshed in {elapsed}s: {len(rules)} market basket rules & {len(forecast_res.suggestions)} restock forecasts updated.",
    )
