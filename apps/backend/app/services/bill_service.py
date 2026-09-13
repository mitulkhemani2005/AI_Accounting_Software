from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from datetime import datetime, timezone
from app.models.bill import Bill, BillItem
from app.models.item import Item
from app.models.inventory import Stock
from app.models.user import User
from app.models.party import Customer, Supplier
from app.schemas.bill import (
    BillCreateRequest,
    BillUpdateRequest,
    BillResponse,
    BillItemResponse,
    OfflineSyncBatchRequest,
    OfflineSyncBatchResponse,
)
from app.services.gst_service import calculate_line_item_gst, calculate_bill_totals
from app.services.audit_service import log_audit_event
from app.services.inventory_service import (
    record_stock_out_for_bill,
    restore_stock_for_voided_bill,
    get_or_create_default_godown,
)
from app.services.party_service import recalculate_party_balance
from app.services.accounting_service import (
    record_sale_journal_entry,
    void_journal_entry_for_reference,
)


async def generate_bill_number(db: AsyncSession, tenant_id: str, bill_type: str = "sale") -> str:
    """Generate sequential invoice number: INV-YYYY-0001"""
    year = datetime.now(timezone.utc).year
    prefix = "INV" if bill_type == "sale" else "BILL"
    
    # Count existing bills for prefix in this year for tenant
    prefix_pattern = f"{prefix}-{year}-%"
    result = await db.execute(
        select(func.count(Bill.id)).where(
            Bill.tenant_id == tenant_id,
            Bill.bill_number.like(prefix_pattern)
        )
    )
    count = result.scalar() or 0
    next_num = count + 1
    return f"{prefix}-{year}-{str(next_num).zfill(4)}"


def format_bill_response(bill: Bill) -> BillResponse:
    """Helper to convert Bill ORM to BillResponse"""
    items_dto = [
        BillItemResponse(
            id=item.id,
            item_id=item.item_id,
            item_name=item.item_name,
            hsn_code=item.hsn_code,
            quantity=item.quantity,
            unit=item.unit,
            rate=item.rate,
            purchase_price=getattr(item, "purchase_price", 0.0) or 0.0,
            discount_amount=item.discount_amount,
            gst_rate=item.gst_rate,
            is_tax_inclusive=getattr(item, "is_tax_inclusive", False),
            taxable_amount=item.taxable_amount,
            cgst_amount=item.cgst_amount,
            sgst_amount=item.sgst_amount,
            igst_amount=item.igst_amount,
            total_amount=item.total_amount
        )
        for item in bill.items
    ]

    return BillResponse(
        id=bill.id,
        tenant_id=bill.tenant_id,
        bill_number=bill.bill_number,
        type=bill.type,
        party_id=bill.party_id,
        party_name=bill.party_name,
        party_mobile=bill.party_mobile,
        party_gst=bill.party_gst,
        party_address=bill.party_address,
        terms_conditions=bill.terms_conditions,
        is_interstate=bill.is_interstate,
        created_by_user_id=bill.created_by_user_id,
        creator_name=bill.creator.name if bill.creator else None,
        creator_role=bill.creator.role.name if (bill.creator and bill.creator.role) else None,
        subtotal=bill.subtotal,
        discount_amount=bill.discount_amount,
        taxable_amount=bill.taxable_amount,
        gst_amount=bill.gst_amount,
        cgst_amount=bill.cgst_amount,
        sgst_amount=bill.sgst_amount,
        igst_amount=bill.igst_amount,
        round_off=bill.round_off,
        total_amount=bill.total_amount,
        payment_mode=bill.payment_mode,
        payment_status=bill.payment_status,
        paid_amount=bill.paid_amount,
        offline_sync_id=bill.offline_sync_id,
        status=bill.status,
        is_reviewed_by_admin=bill.is_reviewed_by_admin,
        notes=bill.notes,
        created_at=bill.created_at,
        items=items_dto
    )


async def create_bill(
    db: AsyncSession,
    tenant_id: str,
    current_user: User,
    payload: BillCreateRequest,
    client_ip: Optional[str] = None
) -> BillResponse:
    """Create a new bill (accessible to both Admin and Sub-users)"""
    # 1. Check idempotency for offline sync
    if payload.offline_sync_id:
        existing = await db.execute(
            select(Bill).where(
                Bill.tenant_id == tenant_id,
                Bill.offline_sync_id == payload.offline_sync_id
            )
        )
        existing_bill = existing.scalar_one_or_none()
        if existing_bill:
            return format_bill_response(existing_bill)

    # 2. Calculate line item GST breakdowns
    items_breakdown = [
        calculate_line_item_gst(item=item_input, is_interstate=payload.is_interstate)
        for item_input in payload.items
    ]

    # 2.5 Strict Server-Side Stock Validation for Sale Bills
    if payload.type == "sale":
        target_godown_id = payload.godown_id
        if not target_godown_id:
            def_godown = await get_or_create_default_godown(db, tenant_id)
            target_godown_id = def_godown.id

        item_demands: Dict[str, Dict[str, Any]] = {}
        for ib in items_breakdown:
            item_id = ib.get("item_id")
            if not item_id:
                continue

            qty = ib.get("quantity", 0.0)
            unit_str = ((ib.get("unit") or "")).strip().upper()
            effective_qty = qty
            if unit_str in ["CS", "CASE", "CASES", "BOX", "CTN"]:
                it_obj = (await db.execute(select(Item).where(Item.id == item_id))).scalar_one_or_none()
                if it_obj and it_obj.units_per_case and it_obj.units_per_case > 1:
                    effective_qty = qty * it_obj.units_per_case

            if item_id not in item_demands:
                item_demands[item_id] = {
                    "item_name": ib.get("item_name") or "Item",
                    "effective_qty": 0.0,
                    "unit": ib.get("unit") or "EA",
                }
            item_demands[item_id]["effective_qty"] += effective_qty

        for item_id, demand in item_demands.items():
            stock_rec = (await db.execute(
                select(Stock).where(
                    Stock.tenant_id == tenant_id,
                    Stock.godown_id == target_godown_id,
                    Stock.item_id == item_id
                )
            )).scalar_one_or_none()

            avail_qty = stock_rec.quantity if stock_rec else 0.0
            if avail_qty < demand["effective_qty"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Out of stock: '{demand['item_name']}' has only {avail_qty:.2f} units available in selected Godown, but {demand['effective_qty']:.2f} units were requested. Please restock before completing sale."
                )

    # 3. Calculate Bill grand totals
    totals = calculate_bill_totals(
        items_breakdown=items_breakdown,
        bill_discount=payload.discount_amount,
        is_interstate=payload.is_interstate
    )

    # 4. Generate bill number
    bill_number = await generate_bill_number(db, tenant_id, payload.type)

    # 5. Paid amount calculation
    paid_amount = payload.paid_amount
    if paid_amount is None:
        paid_amount = totals["total_amount"] if payload.payment_status == "paid" else 0.0

    # 6. Flag review status (Sub-user bills need admin review & confirmation by default)
    is_admin = current_user.role and current_user.role.name == "admin"
    is_reviewed = True if is_admin else False
    bill_status = "active" if is_admin else "under_review"

    # Auto-resolve party details (including address) from Customer or Supplier if party_id is provided
    resolved_party_name = payload.party_name
    resolved_party_mobile = payload.party_mobile
    resolved_party_gst = payload.party_gst
    resolved_party_address = payload.party_address

    if payload.party_id:
        if payload.type == "sale":
            cust_obj = (await db.execute(
                select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == payload.party_id)
            )).scalar_one_or_none()
            if cust_obj:
                if not resolved_party_name or resolved_party_name == "Cash Customer":
                    resolved_party_name = cust_obj.name
                if not resolved_party_mobile:
                    resolved_party_mobile = cust_obj.mobile
                if not resolved_party_gst:
                    resolved_party_gst = cust_obj.gst_number
                if not resolved_party_address:
                    resolved_party_address = cust_obj.address
        elif payload.type == "purchase":
            supp_obj = (await db.execute(
                select(Supplier).where(Supplier.tenant_id == tenant_id, Supplier.id == payload.party_id)
            )).scalar_one_or_none()
            if supp_obj:
                if not resolved_party_name:
                    resolved_party_name = supp_obj.name
                if not resolved_party_mobile:
                    resolved_party_mobile = supp_obj.mobile
                if not resolved_party_gst:
                    resolved_party_gst = supp_obj.gst_number
                if not resolved_party_address:
                    resolved_party_address = supp_obj.address

    # 7. Create Bill Record
    bill = Bill(
        tenant_id=tenant_id,
        bill_number=bill_number,
        type=payload.type,
        party_id=payload.party_id,
        party_name=resolved_party_name,
        party_mobile=resolved_party_mobile,
        party_gst=resolved_party_gst,
        party_address=resolved_party_address,
        terms_conditions=payload.terms_conditions,
        is_interstate=payload.is_interstate,
        created_by_user_id=current_user.id,
        subtotal=totals["subtotal"],
        discount_amount=totals["discount_amount"],
        taxable_amount=totals["taxable_amount"],
        gst_amount=totals["gst_amount"],
        cgst_amount=totals["cgst_amount"],
        sgst_amount=totals["sgst_amount"],
        igst_amount=totals["igst_amount"],
        round_off=totals["round_off"],
        total_amount=totals["total_amount"],
        payment_mode=payload.payment_mode,
        payment_status=payload.payment_status,
        paid_amount=paid_amount,
        offline_sync_id=payload.offline_sync_id,
        status=bill_status,
        is_reviewed_by_admin=is_reviewed,
        notes=payload.notes
    )
    db.add(bill)
    await db.flush()

    # 8. Create Bill Items
    for ib in items_breakdown:
        bill_item = BillItem(
            bill_id=bill.id,
            item_id=ib["item_id"],
            item_name=ib["item_name"],
            hsn_code=ib["hsn_code"],
            quantity=ib["quantity"],
            unit=ib["unit"],
            rate=ib["rate"],
            purchase_price=ib.get("purchase_price", 0.0) or 0.0,
            discount_amount=ib["discount_amount"],
            gst_rate=ib["gst_rate"],
            is_tax_inclusive=ib.get("is_tax_inclusive", False),
            taxable_amount=ib["taxable_amount"],
            cgst_amount=ib["cgst_amount"],
            sgst_amount=ib["sgst_amount"],
            igst_amount=ib["igst_amount"],
            total_amount=ib["total_amount"]
        )
        db.add(bill_item)

    # 9. If created directly by Admin, finalize financial postings immediately
    if is_admin:
        if payload.party_id:
            p_type = "customer" if bill.type == "sale" else "supplier"
            await recalculate_party_balance(db, tenant_id, payload.party_id, p_type)

        if bill.type == "sale":
            await record_stock_out_for_bill(
                db=db,
                tenant_id=tenant_id,
                user=current_user,
                bill_id=bill.id,
                bill_number=bill.bill_number,
                bill_items=items_breakdown,
                godown_id=payload.godown_id
            )

            is_cash_sale = payload.payment_mode == "cash" or not payload.party_id
            await record_sale_journal_entry(
                db=db,
                tenant_id=tenant_id,
                user_id=current_user.id,
                bill_id=bill.id,
                bill_number=bill.bill_number,
                is_cash=is_cash_sale,
                party_id=payload.party_id,
                party_name=bill.party_name or "Walk-in Cash Customer",
                taxable_amount=bill.taxable_amount,
                cgst_amount=bill.cgst_amount,
                sgst_amount=bill.sgst_amount,
                igst_amount=bill.igst_amount,
                discount_amount=bill.discount_amount,
                round_off=bill.round_off,
                total_amount=bill.total_amount,
                payment_mode=payload.payment_mode or "cash"
            )

    await db.commit()
    await db.refresh(bill)

    # 11. Audit Log
    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="Bill",
        entity_id=bill.id,
        details={
            "bill_number": bill.bill_number,
            "total_amount": bill.total_amount,
            "created_by": current_user.name,
            "status": bill.status,
            "is_reviewed": bill.is_reviewed_by_admin,
            "role": current_user.role.name if current_user.role else "sub_user"
        },
        ip_address=client_ip
    )

    return format_bill_response(bill)


async def confirm_staff_bill(
    db: AsyncSession,
    tenant_id: str,
    admin_user: User,
    bill_id: str,
    client_ip: Optional[str] = None
) -> BillResponse:
    """Admin confirms and finalizes a staff-submitted bill: deducts stock, posts journal voucher, updates customer balance, and sets active"""
    result = await db.execute(
        select(Bill).options(selectinload(Bill.items)).where(Bill.tenant_id == tenant_id, Bill.id == bill_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill.status == "void":
        raise HTTPException(status_code=400, detail="Cannot confirm a voided bill")

    if bill.is_reviewed_by_admin and bill.status == "active":
        return format_bill_response(bill)

    # 1. Validate line items & stock at confirmation time
    if bill.type == "sale":
        def_godown = await get_or_create_default_godown(db, tenant_id)
        godown_id = def_godown.id

        items_breakdown = []
        for itm in bill.items:
            if itm.item_id:
                u_per_case = 1.0
                it_obj = (await db.execute(select(Item).where(Item.id == itm.item_id))).scalar_one_or_none()
                if it_obj and it_obj.units_per_case and it_obj.units_per_case > 1:
                    u_per_case = it_obj.units_per_case

                effective_qty = itm.quantity
                unit_str = (itm.unit or "").strip().upper()
                if unit_str in ["CS", "CASE", "CASES", "BOX", "CTN"]:
                    effective_qty = itm.quantity * u_per_case

                stock_rec = (await db.execute(
                    select(Stock).where(Stock.tenant_id == tenant_id, Stock.godown_id == godown_id, Stock.item_id == itm.item_id)
                )).scalar_one_or_none()
                avail = stock_rec.quantity if stock_rec else 0.0
                if avail < effective_qty:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot confirm bill: '{itm.item_name}' only has {avail:.2f} units available in stock, but {effective_qty:.2f} units required."
                    )

            items_breakdown.append({
                "item_id": itm.item_id,
                "item_name": itm.item_name,
                "hsn_code": itm.hsn_code,
                "quantity": itm.quantity,
                "unit": itm.unit,
                "rate": itm.rate,
                "purchase_price": itm.purchase_price or 0.0,
                "discount_amount": itm.discount_amount,
                "gst_rate": itm.gst_rate,
                "is_tax_inclusive": itm.is_tax_inclusive,
                "taxable_amount": itm.taxable_amount,
                "cgst_amount": itm.cgst_amount,
                "sgst_amount": itm.sgst_amount,
                "igst_amount": itm.igst_amount,
                "total_amount": itm.total_amount
            })

        # Deduct stock
        await record_stock_out_for_bill(
            db=db,
            tenant_id=tenant_id,
            user=admin_user,
            bill_id=bill.id,
            bill_number=bill.bill_number,
            bill_items=items_breakdown,
            godown_id=godown_id
        )

        # Auto-Post Double-Entry Journal Voucher
        is_cash_sale = bill.payment_mode == "cash" or not bill.party_id
        await record_sale_journal_entry(
            db=db,
            tenant_id=tenant_id,
            user_id=admin_user.id,
            bill_id=bill.id,
            bill_number=bill.bill_number,
            is_cash=is_cash_sale,
            party_id=bill.party_id,
            party_name=bill.party_name or "Walk-in Cash Customer",
            taxable_amount=bill.taxable_amount,
            cgst_amount=bill.cgst_amount,
            sgst_amount=bill.sgst_amount,
            igst_amount=bill.igst_amount,
            discount_amount=bill.discount_amount,
            round_off=bill.round_off,
            total_amount=bill.total_amount,
            payment_mode=bill.payment_mode or "cash"
        )

    # 2. Update status to active and reviewed
    bill.is_reviewed_by_admin = True
    bill.status = "active"
    await db.flush()

    # 3. Update Party Balance
    if bill.party_id:
        p_type = "customer" if bill.type == "sale" else "supplier"
        await recalculate_party_balance(db, tenant_id, bill.party_id, p_type)

    await db.commit()
    await db.refresh(bill)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=admin_user.id,
        action="CONFIRM_STAFF_BILL",
        entity_type="Bill",
        entity_id=bill.id,
        details={"bill_number": bill.bill_number, "total_amount": bill.total_amount},
        ip_address=client_ip
    )

    return format_bill_response(bill)


async def list_bills(
    db: AsyncSession,
    tenant_id: str,
    current_user: User,
    bill_type: Optional[str] = None,
    payment_status: Optional[str] = None,
    review_status: Optional[str] = None,
    search: Optional[str] = None
) -> List[BillResponse]:
    """List bills with role-based scoping and review status filtering"""
    query = select(Bill).where(Bill.tenant_id == tenant_id)

    # If sub-user with only bill.view_own permission
    user_perms = [p.name for p in current_user.role.permissions] if (current_user.role and current_user.role.permissions) else []
    if "bill.view" not in user_perms and "bill.view_own" in user_perms:
        query = query.where(Bill.created_by_user_id == current_user.id)

    if bill_type:
        query = query.where(Bill.type == bill_type)
    if payment_status:
        query = query.where(Bill.payment_status == payment_status)
    if review_status:
        if review_status.lower() in ["reviewed", "confirmed"]:
            query = query.where(Bill.is_reviewed_by_admin == True, Bill.status == "active")
        elif review_status.lower() in ["pending", "pending_review", "under_review", "unreviewed"]:
            query = query.where((Bill.is_reviewed_by_admin == False) | (Bill.status == "under_review"))

    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            (Bill.bill_number.ilike(term)) | (Bill.party_name.ilike(term)) | (Bill.party_mobile.ilike(term))
        )

    query = query.order_by(desc(Bill.created_at))
    result = await db.execute(query)
    bills = list(result.scalars().all())
    return [format_bill_response(b) for b in bills]


async def get_staff_bills_review_queue(
    db: AsyncSession,
    tenant_id: str
) -> List[BillResponse]:
    """Admin Staff Bills Review: retrieves bills created by sub-users"""
    query = (
        select(Bill)
        .join(User, Bill.created_by_user_id == User.id)
        .where(
            Bill.tenant_id == tenant_id,
            Bill.is_reviewed_by_admin == False
        )
        .order_by(desc(Bill.created_at))
    )
    result = await db.execute(query)
    bills = list(result.scalars().all())
    return [format_bill_response(b) for b in bills]


async def update_bill_by_admin(
    db: AsyncSession,
    tenant_id: str,
    admin_user: User,
    bill_id: str,
    payload: BillUpdateRequest,
    client_ip: Optional[str] = None
) -> BillResponse:
    """Admin edits, corrects, or updates a bill at any time, including line items, prices, parties, and payments"""
    from sqlalchemy import delete
    result = await db.execute(
        select(Bill).where(Bill.tenant_id == tenant_id, Bill.id == bill_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    old_party_id = bill.party_id
    old_total = bill.total_amount
    old_paid = bill.paid_amount
    old_unpaid = (old_total - old_paid) if (bill.payment_mode == "credit" or bill.payment_status in ["unpaid", "partial"]) else 0.0

    # 1. Update basic fields if supplied
    if payload.party_name is not None:
        bill.party_name = payload.party_name
    if payload.party_mobile is not None:
        bill.party_mobile = payload.party_mobile
    if payload.party_gst is not None:
        bill.party_gst = payload.party_gst
    if payload.party_address is not None:
        bill.party_address = payload.party_address
    if payload.terms_conditions is not None:
        bill.terms_conditions = payload.terms_conditions
    if payload.party_id is not None:
        bill.party_id = payload.party_id if payload.party_id != "" else None
    if payload.is_interstate is not None:
        bill.is_interstate = payload.is_interstate
    if payload.payment_mode is not None:
        bill.payment_mode = payload.payment_mode
    if payload.payment_status is not None:
        bill.payment_status = payload.payment_status
    if payload.paid_amount is not None:
        bill.paid_amount = payload.paid_amount
    if payload.status is not None:
        bill.status = payload.status
    if payload.notes is not None:
        bill.notes = payload.notes
    if payload.discount_amount is not None:
        bill.discount_amount = payload.discount_amount

    # 2. If items are provided, recompute all line items and bill totals
    if payload.items is not None and len(payload.items) > 0:
        is_interstate = bill.is_interstate
        items_breakdown = []
        for itm in payload.items:
            calc = calculate_line_item(
                rate=itm.rate,
                quantity=itm.quantity,
                discount_amount=itm.discount_amount,
                gst_rate=itm.gst_rate,
                is_interstate=is_interstate,
                is_tax_inclusive=itm.is_tax_inclusive
            )
            items_breakdown.append({
                "item_id": itm.item_id,
                "item_name": itm.item_name,
                "hsn_code": itm.hsn_code,
                "quantity": itm.quantity,
                "unit": itm.unit,
                "rate": itm.rate,
                "purchase_price": itm.purchase_price or 0.0,
                "discount_amount": itm.discount_amount,
                "gst_rate": itm.gst_rate,
                "is_tax_inclusive": itm.is_tax_inclusive,
                "taxable_amount": calc["taxable_amount"],
                "cgst_amount": calc["cgst_amount"],
                "sgst_amount": calc["sgst_amount"],
                "igst_amount": calc["igst_amount"],
                "total_amount": calc["total_amount"],
            })

        discount_val = bill.discount_amount if bill.discount_amount is not None else 0.0
        totals = calculate_bill_totals(items=items_breakdown, overall_discount=discount_val)

        bill.subtotal = totals["subtotal"]
        bill.taxable_amount = totals["taxable_amount"]
        bill.gst_amount = totals["gst_amount"]
        bill.cgst_amount = totals["cgst_amount"]
        bill.sgst_amount = totals["sgst_amount"]
        bill.igst_amount = totals["igst_amount"]
        bill.round_off = totals["round_off"]
        bill.total_amount = totals["total_amount"]

        if bill.payment_mode == "cash" and bill.payment_status == "paid":
            bill.paid_amount = bill.total_amount
        elif bill.payment_mode == "credit" and bill.payment_status == "unpaid":
            bill.paid_amount = 0.0

        # Replace BillItem records
        await db.execute(delete(BillItem).where(BillItem.bill_id == bill.id))
        await db.flush()

        for ib in items_breakdown:
            bill_item = BillItem(
                bill_id=bill.id,
                item_id=ib["item_id"],
                item_name=ib["item_name"],
                hsn_code=ib["hsn_code"],
                quantity=ib["quantity"],
                unit=ib["unit"],
                rate=ib["rate"],
                purchase_price=ib.get("purchase_price", 0.0) or 0.0,
                discount_amount=ib["discount_amount"],
                gst_rate=ib["gst_rate"],
                is_tax_inclusive=ib.get("is_tax_inclusive", False),
                taxable_amount=ib["taxable_amount"],
                cgst_amount=ib["cgst_amount"],
                sgst_amount=ib["sgst_amount"],
                igst_amount=ib["igst_amount"],
                total_amount=ib["total_amount"]
            )
            db.add(bill_item)

    # 3. Recalculate party balances for affected parties
    p_type = "customer" if bill.type == "sale" else "supplier"
    if old_party_id:
        await recalculate_party_balance(db, tenant_id, old_party_id, p_type)
    if bill.party_id and bill.party_id != old_party_id:
        await recalculate_party_balance(db, tenant_id, bill.party_id, p_type)

    bill.is_reviewed_by_admin = True
    await db.commit()
    await db.refresh(bill)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=admin_user.id,
        action="UPDATE",
        entity_type="Bill",
        entity_id=bill.id,
        details={"bill_number": bill.bill_number, "total_amount": bill.total_amount},
        ip_address=client_ip
    )

    return format_bill_response(bill)


async def delete_bill_by_admin(
    db: AsyncSession,
    tenant_id: str,
    admin_user: User,
    bill_id: str,
    client_ip: Optional[str] = None
) -> bool:
    """Admin voids/cancels a bill and restores deducted inventory stock"""
    result = await db.execute(
        select(Bill).where(Bill.tenant_id == tenant_id, Bill.id == bill_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill.status == "void":
        return True

    bill.status = "void"

    # Restore party balance
    if bill.party_id:
        p_type = "customer" if bill.type == "sale" else "supplier"
        await recalculate_party_balance(db, tenant_id, bill.party_id, p_type)

    # Restore stock
    if bill.type == "sale":
        await restore_stock_for_voided_bill(
            db=db,
            tenant_id=tenant_id,
            user=admin_user,
            bill_id=bill.id,
            bill_number=bill.bill_number,
            bill_items=bill.items
        )

    # Void linked journal entry voucher
    await void_journal_entry_for_reference(
        db=db,
        tenant_id=tenant_id,
        user_id=admin_user.id,
        reference_type="bill",
        reference_id=bill.id
    )

    await db.commit()

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=admin_user.id,
        action="VOID",
        entity_type="Bill",
        entity_id=bill.id,
        details={"bill_number": bill.bill_number, "status": "void", "stock_restored": True},
        ip_address=client_ip
    )

    return True


async def sync_offline_bills(
    db: AsyncSession,
    tenant_id: str,
    current_user: User,
    payload: OfflineSyncBatchRequest,
    client_ip: Optional[str] = None
) -> OfflineSyncBatchResponse:
    """Process a batch of offline-created bills idempotently"""
    synced_bills = []
    errors = []

    for item in payload.bills:
        try:
            bill_dto = await create_bill(
                db=db,
                tenant_id=tenant_id,
                current_user=current_user,
                payload=item,
                client_ip=client_ip
            )
            synced_bills.append(bill_dto)
        except Exception as e:
            errors.append({"offline_sync_id": item.offline_sync_id, "error": str(e)})

    return OfflineSyncBatchResponse(
        synced_count=len(synced_bills),
        failed_count=len(errors),
        synced_bills=synced_bills,
        errors=errors
    )
