from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, date
import urllib.parse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload

from app.models.party import Customer, Supplier, Area
from app.models.bill import Bill
from app.models.tenant import Tenant
from app.schemas.report import (
    OverdueBillItem,
    DebtorAgeingItem,
    DebtorsAgeingResponse,
    CreditorAgeingItem,
    CreditorsAgeingResponse,
    PaymentReminderItem,
    PaymentRemindersResponse,
)


async def compute_debtors_ageing(
    db: AsyncSession,
    tenant_id: str,
    as_of_date: Optional[date] = None,
    min_amount: float = 0.0,
    area_id: Optional[str] = None,
    customer_id: Optional[str] = None,
) -> DebtorsAgeingResponse:
    """
    Calculate Sundry Debtors (Customer Receivables) Ageing Analysis across 4 standard buckets:
    0-30 Days, 31-60 Days, 61-90 Days, and Above 90 Days.
    """
    ref_date = as_of_date or datetime.now(timezone.utc).date()

    # 1. Fetch Customers
    cust_stmt = (
        select(Customer)
        .options(selectinload(Customer.area))
        .where(Customer.tenant_id == tenant_id)
    )
    if area_id:
        cust_stmt = cust_stmt.where(Customer.area_id == area_id)
    if customer_id:
        cust_stmt = cust_stmt.where(Customer.id == customer_id)

    res = await db.execute(cust_stmt)
    customers = res.scalars().all()

    # 2. Fetch all active confirmed sale bills for tenant up to as_of_date
    bills_stmt = (
        select(Bill)
        .where(
            Bill.tenant_id == tenant_id,
            Bill.type == "sale",
            Bill.status == "active",
            Bill.is_reviewed_by_admin == True,
            func.date(Bill.bill_date) <= ref_date,
        )
        .order_by(Bill.bill_date.asc())
    )
    b_res = await db.execute(bills_stmt)
    all_bills = b_res.scalars().all()

    # Group bills by party_id
    bills_by_customer: Dict[str, List[Bill]] = {}
    for b in all_bills:
        if b.party_id:
            bills_by_customer.setdefault(b.party_id, []).append(b)

    debtor_items: List[DebtorAgeingItem] = []
    bucket_0_30_tot = 0.0
    bucket_31_60_tot = 0.0
    bucket_61_90_tot = 0.0
    bucket_above_90_tot = 0.0
    total_outstanding_sum = 0.0

    for cust in customers:
        balance = float(cust.current_balance or 0.0)
        if balance <= min_amount:
            continue

        cust_bills = bills_by_customer.get(cust.id, [])
        overdue_items: List[OverdueBillItem] = []

        b0_30 = 0.0
        b31_60 = 0.0
        b61_90 = 0.0
        b_above90 = 0.0
        oldest_date: Optional[datetime] = None

        # Calculate unpaid bills
        for b in cust_bills:
            due = max(0.0, float(b.total_amount) - float(b.paid_amount))
            if due > 0.001:
                b_date = b.bill_date.date() if hasattr(b.bill_date, "date") else b.bill_date
                age = max(0, (ref_date - b_date).days)
                if oldest_date is None or b.bill_date < oldest_date:
                    oldest_date = b.bill_date

                overdue_items.append(
                    OverdueBillItem(
                        bill_id=b.id,
                        bill_number=b.bill_number,
                        bill_date=b.bill_date,
                        age_days=age,
                        total_amount=float(b.total_amount),
                        paid_amount=float(b.paid_amount),
                        due_amount=round(due, 2),
                        status=b.status,
                        payment_mode=b.payment_mode,
                    )
                )

                if age <= 30:
                    b0_30 += due
                elif age <= 60:
                    b31_60 += due
                elif age <= 90:
                    b61_90 += due
                else:
                    b_above90 += due

        # Reconcile with actual customer running balance
        sum_buckets = b0_30 + b31_60 + b61_90 + b_above90
        if balance > sum_buckets:
            # Extra balance (e.g. historical opening balance) goes to 90+ days bucket
            b_above90 += round(balance - sum_buckets, 2)
        elif sum_buckets > balance and sum_buckets > 0:
            # In case payments were applied directly to party balance, proportionally adjust
            scale = balance / sum_buckets
            b0_30 = round(b0_30 * scale, 2)
            b31_60 = round(b31_60 * scale, 2)
            b61_90 = round(b61_90 * scale, 2)
            b_above90 = round(balance - (b0_30 + b31_60 + b61_90), 2)

        area_title = cust.area.name if cust.area else None

        item = DebtorAgeingItem(
            customer_id=cust.id,
            customer_name=cust.name,
            mobile=cust.mobile,
            gst_number=cust.gst_number,
            area_name=area_title,
            current_balance=round(balance, 2),
            bucket_0_30=round(b0_30, 2),
            bucket_31_60=round(b31_60, 2),
            bucket_61_90=round(b61_90, 2),
            bucket_above_90=round(b_above90, 2),
            total_due=round(balance, 2),
            oldest_invoice_date=oldest_date,
            overdue_bills=overdue_items,
        )
        debtor_items.append(item)

        bucket_0_30_tot += b0_30
        bucket_31_60_tot += b31_60
        bucket_61_90_tot += b61_90
        bucket_above_90_tot += b_above90
        total_outstanding_sum += balance

    # Sort debtors by total_due descending
    debtor_items.sort(key=lambda x: x.total_due, reverse=True)

    return DebtorsAgeingResponse(
        as_of_date=ref_date.isoformat(),
        total_debtors=len(debtor_items),
        total_outstanding=round(total_outstanding_sum, 2),
        bucket_0_30_total=round(bucket_0_30_tot, 2),
        bucket_31_60_total=round(bucket_31_60_tot, 2),
        bucket_61_90_total=round(bucket_61_90_tot, 2),
        bucket_above_90_total=round(bucket_above_90_tot, 2),
        customers=debtor_items,
    )


async def compute_creditors_ageing(
    db: AsyncSession,
    tenant_id: str,
    as_of_date: Optional[date] = None,
    min_amount: float = 0.0,
    supplier_id: Optional[str] = None,
) -> CreditorsAgeingResponse:
    """
    Calculate Sundry Creditors (Supplier Payables) Ageing Analysis across 4 standard buckets:
    0-30 Days, 31-60 Days, 61-90 Days, and Above 90 Days.
    """
    ref_date = as_of_date or datetime.now(timezone.utc).date()

    # 1. Fetch Suppliers
    sup_stmt = (
        select(Supplier)
        .options(selectinload(Supplier.area))
        .where(Supplier.tenant_id == tenant_id)
    )
    if supplier_id:
        sup_stmt = sup_stmt.where(Supplier.id == supplier_id)

    res = await db.execute(sup_stmt)
    suppliers = res.scalars().all()

    # 2. Fetch all active purchase bills for tenant up to as_of_date
    bills_stmt = (
        select(Bill)
        .where(
            Bill.tenant_id == tenant_id,
            Bill.type == "purchase",
            Bill.status == "active",
            func.date(Bill.bill_date) <= ref_date,
        )
        .order_by(Bill.bill_date.asc())
    )
    b_res = await db.execute(bills_stmt)
    all_purchases = b_res.scalars().all()

    bills_by_supplier: Dict[str, List[Bill]] = {}
    for b in all_purchases:
        if b.party_id:
            bills_by_supplier.setdefault(b.party_id, []).append(b)

    creditor_items: List[CreditorAgeingItem] = []
    bucket_0_30_tot = 0.0
    bucket_31_60_tot = 0.0
    bucket_61_90_tot = 0.0
    bucket_above_90_tot = 0.0
    total_outstanding_sum = 0.0

    for sup in suppliers:
        balance = float(sup.current_balance or 0.0)
        if balance <= min_amount:
            continue

        sup_bills = bills_by_supplier.get(sup.id, [])
        overdue_items: List[OverdueBillItem] = []

        b0_30 = 0.0
        b31_60 = 0.0
        b61_90 = 0.0
        b_above90 = 0.0
        oldest_date: Optional[datetime] = None

        for b in sup_bills:
            due = max(0.0, float(b.total_amount) - float(b.paid_amount))
            if due > 0.001:
                b_date = b.bill_date.date() if hasattr(b.bill_date, "date") else b.bill_date
                age = max(0, (ref_date - b_date).days)
                if oldest_date is None or b.bill_date < oldest_date:
                    oldest_date = b.bill_date

                overdue_items.append(
                    OverdueBillItem(
                        bill_id=b.id,
                        bill_number=b.bill_number,
                        bill_date=b.bill_date,
                        age_days=age,
                        total_amount=float(b.total_amount),
                        paid_amount=float(b.paid_amount),
                        due_amount=round(due, 2),
                        status=b.status,
                        payment_mode=b.payment_mode,
                    )
                )

                if age <= 30:
                    b0_30 += due
                elif age <= 60:
                    b31_60 += due
                elif age <= 90:
                    b61_90 += due
                else:
                    b_above90 += due

        sum_buckets = b0_30 + b31_60 + b61_90 + b_above90
        if balance > sum_buckets:
            b_above90 += round(balance - sum_buckets, 2)
        elif sum_buckets > balance and sum_buckets > 0:
            scale = balance / sum_buckets
            b0_30 = round(b0_30 * scale, 2)
            b31_60 = round(b31_60 * scale, 2)
            b61_90 = round(b61_90 * scale, 2)
            b_above90 = round(balance - (b0_30 + b31_60 + b61_90), 2)

        area_title = sup.area.name if sup.area else None

        item = CreditorAgeingItem(
            supplier_id=sup.id,
            supplier_name=sup.name,
            mobile=sup.mobile,
            gst_number=sup.gst_number,
            area_name=area_title,
            current_balance=round(balance, 2),
            bucket_0_30=round(b0_30, 2),
            bucket_31_60=round(b31_60, 2),
            bucket_61_90=round(b61_90, 2),
            bucket_above_90=round(b_above90, 2),
            total_due=round(balance, 2),
            oldest_bill_date=oldest_date,
            overdue_bills=overdue_items,
        )
        creditor_items.append(item)

        bucket_0_30_tot += b0_30
        bucket_31_60_tot += b31_60
        bucket_61_90_tot += b61_90
        bucket_above_90_tot += b_above90
        total_outstanding_sum += balance

    creditor_items.sort(key=lambda x: x.total_due, reverse=True)

    return CreditorsAgeingResponse(
        as_of_date=ref_date.isoformat(),
        total_creditors=len(creditor_items),
        total_outstanding=round(total_outstanding_sum, 2),
        bucket_0_30_total=round(bucket_0_30_tot, 2),
        bucket_31_60_total=round(bucket_31_60_tot, 2),
        bucket_61_90_total=round(bucket_61_90_tot, 2),
        bucket_above_90_total=round(bucket_above_90_tot, 2),
        suppliers=creditor_items,
    )


async def generate_payment_reminders(
    db: AsyncSession,
    tenant_id: str,
    customer_ids: Optional[List[str]] = None,
    min_overdue_days: int = 0,
    custom_note: Optional[str] = None,
) -> PaymentRemindersResponse:
    """
    Generate automated WhatsApp & SMS payment reminder messages and direct click-to-chat links.
    """
    # 1. Fetch Tenant details
    t_stmt = select(Tenant).where(Tenant.id == tenant_id)
    t_res = await db.execute(t_stmt)
    tenant = t_res.scalar_one_or_none()
    business_name = tenant.business_name if tenant else "Our Business"
    business_phone = tenant.phone if tenant and tenant.phone else ""

    # 2. Get Debtors Ageing
    ageing = await compute_debtors_ageing(db, tenant_id=tenant_id, min_amount=0.01)

    reminder_items: List[PaymentReminderItem] = []
    total_overdue = 0.0

    for cust in ageing.customers:
        if customer_ids and cust.customer_id not in customer_ids:
            continue

        max_days = max([b.age_days for b in cust.overdue_bills], default=0)
        if max_days < min_overdue_days:
            continue

        clean_mobile = ""
        if cust.mobile:
            digits = "".join(filter(str.isdigit, cust.mobile))
            if len(digits) == 10:
                clean_mobile = f"91{digits}"
            elif len(digits) > 10:
                clean_mobile = digits

        # Build Bill summary lines if any
        bills_summary = ""
        if cust.overdue_bills:
            top_bills = cust.overdue_bills[:3]
            bills_summary = "\n" + "\n".join([
                f"• Inv #{b.bill_number}: ₹{b.due_amount:.2f} ({b.age_days}d overdue)"
                for b in top_bills
            ])
            if len(cust.overdue_bills) > 3:
                bills_summary += f"\n• ...and {len(cust.overdue_bills) - 3} more bill(s)"

        note_text = custom_note or "Kindly arrange to settle the balance at your earliest convenience."

        # WhatsApp Message
        wa_msg = (
            f"🔔 *PAYMENT REMINDER — {business_name}*\n\n"
            f"Dear *{cust.customer_name}*,\n"
            f"This is a gentle reminder regarding your outstanding balance of *₹{cust.total_due:.2f}* with {business_name}."
            f"{bills_summary}\n\n"
            f"{note_text}\n\n"
            f"If you have already processed this payment, please disregard this message.\n\n"
            f"Thank you for your business! 🙏\n"
            f"📞 Contact: {business_phone}"
        )

        # SMS Short Text (<= 160 chars optimized)
        sms_msg = (
            f"Dear {cust.customer_name}, pending payment of Rs.{cust.total_due:.2f} is due to {business_name}. "
            f"Please settle soon. Contact: {business_phone}"
        )

        encoded_text = urllib.parse.quote(wa_msg)
        wa_url = (
            f"https://wa.me/{clean_mobile}?text={encoded_text}"
            if clean_mobile
            else f"https://wa.me/?text={encoded_text}"
        )

        reminder_items.append(
            PaymentReminderItem(
                customer_id=cust.customer_id,
                customer_name=cust.customer_name,
                mobile=cust.mobile,
                total_due=cust.total_due,
                max_overdue_days=max_days,
                bills_count=len(cust.overdue_bills),
                message_text=wa_msg,
                sms_text=sms_msg,
                whatsapp_url=wa_url,
            )
        )
        total_overdue += cust.total_due

    return PaymentRemindersResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_customers=len(reminder_items),
        total_overdue_amount=round(total_overdue, 2),
        reminders=reminder_items,
    )
