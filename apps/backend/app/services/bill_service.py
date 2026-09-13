from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from fastapi import HTTPException, status
from datetime import datetime, timezone
from app.models.bill import Bill, BillItem
from app.models.user import User
from app.models.party import Customer
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
from app.services.inventory_service import record_stock_out_for_bill, restore_stock_for_voided_bill


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

    # 6. Flag review status (Sub-user bills need review by default)
    is_admin = current_user.role and current_user.role.name == "admin"
    is_reviewed = True if is_admin else False

    # 7. Create Bill Record
    bill = Bill(
        tenant_id=tenant_id,
        bill_number=bill_number,
        type=payload.type,
        party_id=payload.party_id,
        party_name=payload.party_name,
        party_mobile=payload.party_mobile,
        party_gst=payload.party_gst,
        party_address=payload.party_address,
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
        status="active",
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

    # 9. Update Customer Balance if credit or unpaid
    if payload.party_id and (payload.payment_mode == "credit" or payload.payment_status in ["unpaid", "partial"]):
        unpaid_diff = totals["total_amount"] - paid_amount
        if unpaid_diff > 0:
            cust_res = await db.execute(
                select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == payload.party_id)
            )
            cust = cust_res.scalar_one_or_none()
            if cust:
                cust.current_balance += unpaid_diff

    # 10. Auto-Deduct Inventory Stock
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
            "role": current_user.role.name if current_user.role else "sub_user"
        },
        ip_address=client_ip
    )

    return format_bill_response(bill)


async def list_bills(
    db: AsyncSession,
    tenant_id: str,
    current_user: User,
    bill_type: Optional[str] = None,
    payment_status: Optional[str] = None,
    search: Optional[str] = None
) -> List[BillResponse]:
    """List bills with role-based scoping (Admin sees all; Sub-users see their own if view_own)"""
    query = select(Bill).where(Bill.tenant_id == tenant_id)

    # If sub-user with only bill.view_own permission
    user_perms = [p.name for p in current_user.role.permissions] if (current_user.role and current_user.role.permissions) else []
    if "bill.view" not in user_perms and "bill.view_own" in user_perms:
        query = query.where(Bill.created_by_user_id == current_user.id)

    if bill_type:
        query = query.where(Bill.type == bill_type)
    if payment_status:
        query = query.where(Bill.payment_status == payment_status)
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

    # 3. Adjust customer balance if credit/unpaid debt changes
    new_unpaid = (bill.total_amount - bill.paid_amount) if (bill.payment_mode == "credit" or bill.payment_status in ["unpaid", "partial"]) else 0.0

    if old_party_id and old_party_id != bill.party_id:
        old_cust_res = await db.execute(select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == old_party_id))
        old_cust = old_cust_res.scalar_one_or_none()
        if old_cust:
            old_cust.current_balance = max(0.0, old_cust.current_balance - old_unpaid)
        if bill.party_id:
            new_cust_res = await db.execute(select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == bill.party_id))
            new_cust = new_cust_res.scalar_one_or_none()
            if new_cust:
                new_cust.current_balance += new_unpaid
    elif bill.party_id:
        cust_res = await db.execute(select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == bill.party_id))
        cust = cust_res.scalar_one_or_none()
        if cust:
            diff = new_unpaid - old_unpaid
            cust.current_balance += diff

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

    # Restore customer balance if credit sale
    if bill.party_id and (bill.payment_mode == "credit" or bill.payment_status in ["unpaid", "partial"]):
        unpaid_amount = bill.total_amount - bill.paid_amount
        if unpaid_amount > 0:
            cust_res = await db.execute(select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == bill.party_id))
            cust = cust_res.scalar_one_or_none()
            if cust:
                cust.current_balance = max(0.0, cust.current_balance - unpaid_amount)

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
