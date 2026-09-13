import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_
from fastapi import HTTPException, status

from app.models.inventory import Godown, Stock, StockBatch, StockMovement, StockTransfer, StockTransferItem
from app.models.item import Item
from app.models.bill import Bill, BillItem
from app.models.user import User
from app.models.party import Supplier
from app.schemas.inventory import (
    GodownCreate,
    GodownUpdate,
    GodownResponse,
    StockInRequest,
    StockAdjustmentRequest,
    StockTransferCreate,
    StockTransferResponse,
    StockTransferItemResponse,
    StockMovementResponse,
    ItemStockSummaryResponse,
    StockBatchResponse,
    InventoryMetricsResponse,
    LowStockAlertItem,
    ExpiringBatchAlertItem,
)
from app.services.audit_service import log_audit_event


# --- 1. Godown Management ---
async def get_or_create_default_godown(db: AsyncSession, tenant_id: str) -> Godown:
    """Ensure every tenant has at least one default Main Godown / Store"""
    result = await db.execute(
        select(Godown).where(Godown.tenant_id == tenant_id, Godown.is_default == True)
    )
    godown = result.scalars().first()
    if godown:
        return godown

    # Check if any godown exists
    any_godown = await db.execute(
        select(Godown).where(Godown.tenant_id == tenant_id).order_by(Godown.created_at.asc())
    )
    first = any_godown.scalars().first()
    if first:
        first.is_default = True
        await db.commit()
        await db.refresh(first)
        return first

    # Create initial Main Godown
    new_godown = Godown(
        tenant_id=tenant_id,
        name="Main Store / Godown",
        code="MAIN",
        is_default=True,
        is_active=True,
        address="Primary Shop Location",
    )
    db.add(new_godown)
    await db.commit()
    await db.refresh(new_godown)
    return new_godown


async def list_godowns(db: AsyncSession, tenant_id: str, active_only: bool = False) -> List[GodownResponse]:
    """List all godowns for tenant"""
    query = select(Godown).where(Godown.tenant_id == tenant_id)
    if active_only:
        query = query.where(Godown.is_active == True)
    query = query.order_by(desc(Godown.is_default), Godown.name.asc())
    result = await db.execute(query)
    godowns = result.scalars().all()
    return [GodownResponse.model_validate(g) for g in godowns]


async def create_godown(
    db: AsyncSession,
    tenant_id: str,
    user: User,
    payload: GodownCreate,
    client_ip: Optional[str] = None
) -> GodownResponse:
    """Create a new warehouse / branch godown"""
    # Check duplicate code or name
    existing = await db.execute(
        select(Godown).where(
            Godown.tenant_id == tenant_id,
            or_(
                func.lower(Godown.code) == payload.code.strip().lower(),
                func.lower(Godown.name) == payload.name.strip().lower(),
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Godown with name '{payload.name}' or code '{payload.code}' already exists"
        )

    # If new godown is set as default, reset previous default
    if payload.is_default:
        await db.execute(
            select(Godown).where(Godown.tenant_id == tenant_id, Godown.is_default == True)
        )
        prev_defaults = (await db.execute(
            select(Godown).where(Godown.tenant_id == tenant_id, Godown.is_default == True)
        )).scalars().all()
        for p in prev_defaults:
            p.is_default = False

    godown = Godown(
        tenant_id=tenant_id,
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        address=payload.address,
        city=payload.city,
        state=payload.state,
        pincode=payload.pincode,
        contact_person=payload.contact_person,
        contact_number=payload.contact_number,
        is_default=payload.is_default,
        is_active=payload.is_active,
    )
    db.add(godown)
    await db.commit()
    await db.refresh(godown)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="CREATE",
        entity_type="Godown",
        entity_id=godown.id,
        details={"name": godown.name, "code": godown.code},
        ip_address=client_ip
    )
    return GodownResponse.model_validate(godown)


async def update_godown(
    db: AsyncSession,
    tenant_id: str,
    godown_id: str,
    user: User,
    payload: GodownUpdate,
    client_ip: Optional[str] = None
) -> GodownResponse:
    """Update godown details"""
    result = await db.execute(
        select(Godown).where(Godown.tenant_id == tenant_id, Godown.id == godown_id)
    )
    godown = result.scalar_one_or_none()
    if not godown:
        raise HTTPException(status_code=404, detail="Godown not found")

    if payload.is_default is True:
        # Reset other defaults
        prev_defaults = (await db.execute(
            select(Godown).where(Godown.tenant_id == tenant_id, Godown.id != godown_id, Godown.is_default == True)
        )).scalars().all()
        for p in prev_defaults:
            p.is_default = False

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if field == "code" and val:
            setattr(godown, field, val.strip().upper())
        elif field == "name" and val:
            setattr(godown, field, val.strip())
        else:
            setattr(godown, field, val)

    await db.commit()
    await db.refresh(godown)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="UPDATE",
        entity_type="Godown",
        entity_id=godown.id,
        details={"name": godown.name, "code": godown.code},
        ip_address=client_ip
    )
    return GodownResponse.model_validate(godown)


# --- 2. Core Stock Management & Adjustments ---
async def get_or_create_stock_record(db: AsyncSession, tenant_id: str, godown_id: str, item_id: str) -> Stock:
    """Helper to fetch or initialize a Stock entry"""
    result = await db.execute(
        select(Stock).where(
            Stock.tenant_id == tenant_id,
            Stock.godown_id == godown_id,
            Stock.item_id == item_id
        )
    )
    stock = result.scalar_one_or_none()
    if not stock:
        stock = Stock(
            tenant_id=tenant_id,
            godown_id=godown_id,
            item_id=item_id,
            quantity=0.0
        )
        db.add(stock)
        await db.flush()
    return stock


async def record_stock_in(
    db: AsyncSession,
    tenant_id: str,
    user: User,
    payload: StockInRequest,
    client_ip: Optional[str] = None
) -> Dict[str, Any]:
    """Record incoming purchase stock or stock-in GRN"""
    # 1. Resolve Target Godown
    target_godown_id = payload.godown_id
    if not target_godown_id:
        def_godown = await get_or_create_default_godown(db, tenant_id)
        target_godown_id = def_godown.id
    else:
        g_check = await db.execute(
            select(Godown).where(Godown.tenant_id == tenant_id, Godown.id == target_godown_id)
        )
        if not g_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Selected Godown not found")

    processed_items = []
    bill_items_data = []
    total_qty_added = 0.0

    for item_req in payload.items:
        # Fetch Item
        item_res = await db.execute(
            select(Item).where(Item.tenant_id == tenant_id, Item.id == item_req.item_id)
        )
        item = item_res.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item ID {item_req.item_id} not found")

        # Update purchase price on master if provided
        cost = item_req.purchase_price if item_req.purchase_price is not None and item_req.purchase_price > 0 else item.purchase_price
        if item_req.purchase_price and item_req.purchase_price > 0:
            item.purchase_price = item_req.purchase_price

        # Calculate effective base units (EA / PCS)
        u_per_case = item.units_per_case if (item.units_per_case and item.units_per_case > 0) else 1.0
        effective_qty = item_req.quantity
        if item_req.unit and item_req.unit.upper() in ["CS", "CASE", "CASES", "BOX"]:
            effective_qty = item_req.quantity * u_per_case
        elif item_req.cases is not None and item_req.cases > 0:
            effective_qty = item_req.cases * u_per_case

        # Update or create aggregate Stock
        stock = await get_or_create_stock_record(db, tenant_id, target_godown_id, item.id)
        stock.quantity += effective_qty
        stock.last_restocked_at = datetime.now(timezone.utc)

        # Batch record if batch number provided
        batch_num = item_req.batch_number.strip() if item_req.batch_number else None
        if batch_num:
            batch_res = await db.execute(
                select(StockBatch).where(
                    StockBatch.tenant_id == tenant_id,
                    StockBatch.godown_id == target_godown_id,
                    StockBatch.item_id == item.id,
                    StockBatch.batch_number == batch_num
                )
            )
            batch = batch_res.scalar_one_or_none()
            if batch:
                batch.quantity += effective_qty
                if item_req.expiry_date:
                    batch.expiry_date = item_req.expiry_date
                if cost > 0:
                    batch.purchase_price = cost
            else:
                batch = StockBatch(
                    tenant_id=tenant_id,
                    godown_id=target_godown_id,
                    item_id=item.id,
                    batch_number=batch_num,
                    expiry_date=item_req.expiry_date,
                    manufacturing_date=item_req.manufacturing_date,
                    purchase_price=cost,
                    mrp=item_req.mrp,
                    sale_price=item_req.sale_price or item.sale_price,
                    quantity=effective_qty,
                    is_active=True
                )
                db.add(batch)

        # Audit movement
        ref_notes = f"Supplier: {payload.supplier_name or 'N/A'}"
        if payload.invoice_number:
            ref_notes += f" | Inv: {payload.invoice_number}"
        if item_req.unit and item_req.unit.upper() in ["CS", "CASE", "CASES", "BOX"]:
            ref_notes += f" | {item_req.quantity} CS ({effective_qty} {item.unit})"
        if payload.notes:
            ref_notes += f" | {payload.notes}"

        movement = StockMovement(
            tenant_id=tenant_id,
            godown_id=target_godown_id,
            item_id=item.id,
            movement_type="purchase",
            quantity=effective_qty,
            balance_after=stock.quantity,
            cost_per_unit=cost,
            reference_type="purchase_grn",
            reference_id=payload.invoice_number,
            batch_number=batch_num,
            notes=ref_notes,
            performed_by_user_id=user.id
        )
        db.add(movement)

        # Purchase Book line item financial calculation
        taxable_item = round(effective_qty * cost, 2)
        gst_r = item.gst_rate if item.gst_rate is not None else 0.0
        gst_item = round(taxable_item * (gst_r / 100.0), 2)
        cgst_item = round(gst_item / 2.0, 2)
        sgst_item = round(gst_item / 2.0, 2)
        total_item = taxable_item + gst_item

        bill_items_data.append({
            "item_id": item.id,
            "item_name": item.name,
            "hsn_code": item.hsn_code,
            "quantity": effective_qty,
            "unit": item.unit or "EA",
            "rate": cost,
            "gst_rate": gst_r,
            "taxable_amount": taxable_item,
            "gst_amount": gst_item,
            "cgst_amount": cgst_item,
            "sgst_amount": sgst_item,
            "total_amount": total_item
        })

        total_qty_added += effective_qty
        processed_items.append({
            "item_id": item.id,
            "item_name": item.name,
            "quantity_added": effective_qty,
            "cases_added": round(effective_qty / u_per_case, 2),
            "new_stock_level": stock.quantity,
            "batch_number": batch_num
        })

    # --- Create Official Purchase Book Entry (Bill of type 'purchase') ---
    supplier_name = payload.supplier_name.strip() if payload.supplier_name else "Supplier / Vendor"
    pur_bill_number = payload.invoice_number.strip() if payload.invoice_number else ""
    if pur_bill_number:
        # Check if invoice number already exists for this tenant
        exist_check = await db.execute(
            select(Bill).where(Bill.tenant_id == tenant_id, Bill.bill_number == pur_bill_number)
        )
        if exist_check.scalar_one_or_none():
            year = datetime.now(timezone.utc).year
            p_count = (await db.execute(select(func.count(Bill.id)).where(Bill.tenant_id == tenant_id, Bill.type == "purchase"))).scalar() or 0
            pur_bill_number = f"PUR-{year}-{str(p_count + 1).zfill(4)}"
    else:
        year = datetime.now(timezone.utc).year
        p_count = (await db.execute(select(func.count(Bill.id)).where(Bill.tenant_id == tenant_id, Bill.type == "purchase"))).scalar() or 0
        pur_bill_number = f"PUR-{year}-{str(p_count + 1).zfill(4)}"

    total_taxable = round(sum(b["taxable_amount"] for b in bill_items_data), 2)
    total_gst = round(sum(b["gst_amount"] for b in bill_items_data), 2)
    total_cgst = round(sum(b["cgst_amount"] for b in bill_items_data), 2)
    total_sgst = round(sum(b["sgst_amount"] for b in bill_items_data), 2)
    raw_total = total_taxable + total_gst
    final_amount = float(round(raw_total))
    round_off = round(final_amount - raw_total, 2)
    # Check if a Supplier exists with this name to link party_id
    supplier_obj = (await db.execute(
        select(Supplier).where(
            Supplier.tenant_id == tenant_id,
            func.lower(Supplier.name) == supplier_name.lower()
        )
    )).scalar_one_or_none()
    supplier_party_id = supplier_obj.id if supplier_obj else None

    purchase_bill = Bill(
        tenant_id=tenant_id,
        bill_number=pur_bill_number,
        type="purchase",
        party_id=supplier_party_id,
        party_name=supplier_name,
        created_by_user_id=user.id,
        subtotal=total_taxable,
        discount_amount=0.0,
        taxable_amount=total_taxable,
        gst_amount=total_gst,
        cgst_amount=total_cgst,
        sgst_amount=total_sgst,
        igst_amount=0.0,
        round_off=round_off,
        total_amount=final_amount,
        payment_mode="cash",
        payment_status="paid",
        paid_amount=final_amount,
        status="active",
        is_reviewed_by_admin=True,
        notes=f"Auto-recorded into Purchase Book from Stock-In Inward. Godown: {target_godown_id}. {payload.notes or ''}".strip(),
    )
    db.add(purchase_bill)
    await db.flush()

    for it_data in bill_items_data:
        b_item = BillItem(
            bill_id=purchase_bill.id,
            item_id=it_data["item_id"],
            item_name=it_data["item_name"],
            hsn_code=it_data.get("hsn_code"),
            quantity=it_data["quantity"],
            unit=it_data["unit"],
            rate=it_data["rate"],
            purchase_price=it_data["rate"],
            discount_amount=0.0,
            gst_rate=it_data["gst_rate"],
            is_tax_inclusive=False,
            taxable_amount=it_data["taxable_amount"],
            cgst_amount=it_data["cgst_amount"],
            sgst_amount=it_data["sgst_amount"],
            igst_amount=0.0,
            total_amount=it_data["total_amount"],
        )
        db.add(b_item)

    if supplier_party_id:
        from app.services.party_service import recalculate_party_balance
        await recalculate_party_balance(db, tenant_id, supplier_party_id, "supplier")

    await db.commit()

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="STOCK_IN",
        entity_type="Stock",
        entity_id=target_godown_id,
        details={"items_count": len(processed_items), "total_qty": total_qty_added, "supplier": supplier_name, "purchase_bill": purchase_bill.bill_number},
        ip_address=client_ip
    )

    return {
        "status": "success",
        "message": f"Successfully stocked in {len(processed_items)} item(s) and recorded in Purchase Book (#{purchase_bill.bill_number})",
        "godown_id": target_godown_id,
        "purchase_bill_id": purchase_bill.id,
        "purchase_bill_number": purchase_bill.bill_number,
        "purchase_total_amount": final_amount,
        "items": processed_items
    }


async def adjust_stock(
    db: AsyncSession,
    tenant_id: str,
    user: User,
    payload: StockAdjustmentRequest,
    client_ip: Optional[str] = None
) -> Dict[str, Any]:
    """Manual stock adjustments (Physical stock take, wastage, damaged goods, corrections)"""
    target_godown_id = payload.godown_id
    if not target_godown_id:
        def_godown = await get_or_create_default_godown(db, tenant_id)
        target_godown_id = def_godown.id

    item_res = await db.execute(
        select(Item).where(Item.tenant_id == tenant_id, Item.id == payload.item_id)
    )
    item = item_res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    stock = await get_or_create_stock_record(db, tenant_id, target_godown_id, item.id)
    old_qty = stock.quantity
    qty_diff = 0.0
    m_type = "adjustment_in"

    if payload.adjustment_type == "add":
        qty_diff = payload.quantity
        stock.quantity += qty_diff
        m_type = "adjustment_in"
    elif payload.adjustment_type == "subtract":
        qty_diff = payload.quantity
        stock.quantity = max(0.0, stock.quantity - qty_diff)
        m_type = "adjustment_out"
    elif payload.adjustment_type == "set":
        qty_diff = abs(payload.quantity - old_qty)
        m_type = "adjustment_in" if payload.quantity >= old_qty else "adjustment_out"
        stock.quantity = payload.quantity

    movement = StockMovement(
        tenant_id=tenant_id,
        godown_id=target_godown_id,
        item_id=item.id,
        movement_type=m_type,
        quantity=qty_diff,
        balance_after=stock.quantity,
        cost_per_unit=item.purchase_price,
        reference_type="manual_adjustment",
        reference_id=f"ADJ-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}",
        batch_number=payload.batch_number,
        notes=f"Reason: {payload.reason} | {payload.notes or ''}",
        performed_by_user_id=user.id
    )
    db.add(movement)
    await db.commit()

    return {
        "status": "success",
        "item_name": item.name,
        "old_quantity": old_qty,
        "new_quantity": stock.quantity,
        "adjustment_type": payload.adjustment_type,
        "reason": payload.reason
    }


# --- 3. POS Billing Integration: Auto Stock Deduction & Void Restock ---
async def record_stock_out_for_bill(
    db: AsyncSession,
    tenant_id: str,
    user: User,
    bill_id: str,
    bill_number: str,
    bill_items: List[Any],
    godown_id: Optional[str] = None
):
    """Automatically deduct stock when a POS or Sale bill is created"""
    if not godown_id:
        def_godown = await get_or_create_default_godown(db, tenant_id)
        godown_id = def_godown.id

    for bi in bill_items:
        item_id = bi.get("item_id") if isinstance(bi, dict) else getattr(bi, "item_id", None)
        qty = bi.get("quantity") if isinstance(bi, dict) else getattr(bi, "quantity", 0.0)
        rate = bi.get("rate") if isinstance(bi, dict) else getattr(bi, "rate", 0.0)

        if not item_id or qty <= 0:
            continue

        stock = await get_or_create_stock_record(db, tenant_id, godown_id, item_id)
        stock.quantity = max(0.0, stock.quantity - qty)

        movement = StockMovement(
            tenant_id=tenant_id,
            godown_id=godown_id,
            item_id=item_id,
            movement_type="sale_out",
            quantity=qty,
            balance_after=stock.quantity,
            cost_per_unit=rate,
            reference_type="bill",
            reference_id=bill_number,
            notes=f"Counter Sale #{bill_number}",
            performed_by_user_id=user.id
        )
        db.add(movement)


async def restore_stock_for_voided_bill(
    db: AsyncSession,
    tenant_id: str,
    user: User,
    bill_id: str,
    bill_number: str,
    bill_items: List[Any],
    godown_id: Optional[str] = None
):
    """Automatically return stock when an Admin voids a bill"""
    if not godown_id:
        def_godown = await get_or_create_default_godown(db, tenant_id)
        godown_id = def_godown.id

    for bi in bill_items:
        item_id = bi.get("item_id") if isinstance(bi, dict) else getattr(bi, "item_id", None)
        qty = bi.get("quantity") if isinstance(bi, dict) else getattr(bi, "quantity", 0.0)
        rate = bi.get("rate") if isinstance(bi, dict) else getattr(bi, "rate", 0.0)

        if not item_id or qty <= 0:
            continue

        stock = await get_or_create_stock_record(db, tenant_id, godown_id, item_id)
        stock.quantity += qty

        movement = StockMovement(
            tenant_id=tenant_id,
            godown_id=godown_id,
            item_id=item_id,
            movement_type="void_restock",
            quantity=qty,
            balance_after=stock.quantity,
            cost_per_unit=rate,
            reference_type="bill_void",
            reference_id=bill_number,
            notes=f"Restock from Voided Bill #{bill_number}",
            performed_by_user_id=user.id
        )
        db.add(movement)


# --- 4. Inter-Godown Transfers ---
async def generate_transfer_number(db: AsyncSession, tenant_id: str) -> str:
    """Generate sequential transfer number: TRF-YYYY-0001"""
    year = datetime.now(timezone.utc).year
    prefix_pattern = f"TRF-{year}-%"
    result = await db.execute(
        select(func.count(StockTransfer.id)).where(
            StockTransfer.tenant_id == tenant_id,
            StockTransfer.transfer_number.like(prefix_pattern)
        )
    )
    count = result.scalar() or 0
    return f"TRF-{year}-{str(count + 1).zfill(4)}"


async def transfer_stock_between_godowns(
    db: AsyncSession,
    tenant_id: str,
    user: User,
    payload: StockTransferCreate,
    client_ip: Optional[str] = None
) -> StockTransferResponse:
    """Transfer stock atomically between two godowns with sufficiency checks"""
    if payload.from_godown_id == payload.to_godown_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination godowns cannot be identical"
        )

    # Validate Godowns
    from_g_res = await db.execute(
        select(Godown).where(Godown.tenant_id == tenant_id, Godown.id == payload.from_godown_id)
    )
    from_g = from_g_res.scalar_one_or_none()
    to_g_res = await db.execute(
        select(Godown).where(Godown.tenant_id == tenant_id, Godown.id == payload.to_godown_id)
    )
    to_g = to_g_res.scalar_one_or_none()

    if not from_g or not to_g:
        raise HTTPException(status_code=404, detail="Source or destination Godown not found")

    transfer_num = await generate_transfer_number(db, tenant_id)

    transfer = StockTransfer(
        tenant_id=tenant_id,
        transfer_number=transfer_num,
        from_godown_id=payload.from_godown_id,
        to_godown_id=payload.to_godown_id,
        status="completed",
        notes=payload.notes,
        created_by_user_id=user.id
    )
    db.add(transfer)
    await db.flush()

    transfer_items_responses = []

    for item_req in payload.items:
        # Check source stock
        from_stock = await get_or_create_stock_record(db, tenant_id, payload.from_godown_id, item_req.item_id)
        if from_stock.quantity < item_req.quantity:
            item_obj = (await db.execute(select(Item).where(Item.id == item_req.item_id))).scalar_one_or_none()
            item_name = item_obj.name if item_obj else item_req.item_id
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{item_name}' in {from_g.name}. Available: {from_stock.quantity}, Requested: {item_req.quantity}"
            )

        # Destination stock
        to_stock = await get_or_create_stock_record(db, tenant_id, payload.to_godown_id, item_req.item_id)

        # Deduct from source & add to destination
        from_stock.quantity -= item_req.quantity
        to_stock.quantity += item_req.quantity

        t_item = StockTransferItem(
            transfer_id=transfer.id,
            item_id=item_req.item_id,
            batch_number=item_req.batch_number,
            quantity=item_req.quantity,
            unit=item_req.unit,
            notes=item_req.notes
        )
        db.add(t_item)
        await db.flush()

        # Audit movement: transfer_out
        move_out = StockMovement(
            tenant_id=tenant_id,
            godown_id=payload.from_godown_id,
            item_id=item_req.item_id,
            movement_type="transfer_out",
            quantity=item_req.quantity,
            balance_after=from_stock.quantity,
            cost_per_unit=0.0,
            reference_type="stock_transfer",
            reference_id=transfer_num,
            batch_number=item_req.batch_number,
            notes=f"Transferred to {to_g.name} (#{transfer_num})",
            performed_by_user_id=user.id
        )
        # Audit movement: transfer_in
        move_in = StockMovement(
            tenant_id=tenant_id,
            godown_id=payload.to_godown_id,
            item_id=item_req.item_id,
            movement_type="transfer_in",
            quantity=item_req.quantity,
            balance_after=to_stock.quantity,
            cost_per_unit=0.0,
            reference_type="stock_transfer",
            reference_id=transfer_num,
            batch_number=item_req.batch_number,
            notes=f"Transferred from {from_g.name} (#{transfer_num})",
            performed_by_user_id=user.id
        )
        db.add(move_out)
        db.add(move_in)

        transfer_items_responses.append(
            StockTransferItemResponse(
                id=t_item.id,
                item_id=t_item.item_id,
                item_name=t_item.item.name if t_item.item else None,
                batch_number=t_item.batch_number,
                quantity=t_item.quantity,
                unit=t_item.unit,
                notes=t_item.notes
            )
        )

    await db.commit()
    await db.refresh(transfer)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="STOCK_TRANSFER",
        entity_type="StockTransfer",
        entity_id=transfer.id,
        details={"transfer_number": transfer_num, "from": from_g.name, "to": to_g.name, "items": len(payload.items)},
        ip_address=client_ip
    )

    return StockTransferResponse(
        id=transfer.id,
        tenant_id=transfer.tenant_id,
        transfer_number=transfer.transfer_number,
        from_godown_id=transfer.from_godown_id,
        from_godown_name=from_g.name,
        to_godown_id=transfer.to_godown_id,
        to_godown_name=to_g.name,
        status=transfer.status,
        transfer_date=transfer.transfer_date,
        notes=transfer.notes,
        created_by_name=user.name,
        items=transfer_items_responses
    )


async def list_stock_transfers(
    db: AsyncSession,
    tenant_id: str,
    limit: int = 50
) -> List[StockTransferResponse]:
    """List recent stock transfers"""
    result = await db.execute(
        select(StockTransfer)
        .where(StockTransfer.tenant_id == tenant_id)
        .order_by(desc(StockTransfer.created_at))
        .limit(limit)
    )
    transfers = result.scalars().all()
    out = []
    for t in transfers:
        items_dto = [
            StockTransferItemResponse(
                id=i.id,
                item_id=i.item_id,
                item_name=i.item.name if i.item else None,
                batch_number=i.batch_number,
                quantity=i.quantity,
                unit=i.unit,
                notes=i.notes
            )
            for i in t.items
        ]
        out.append(
            StockTransferResponse(
                id=t.id,
                tenant_id=t.tenant_id,
                transfer_number=t.transfer_number,
                from_godown_id=t.from_godown_id,
                from_godown_name=t.from_godown.name if t.from_godown else None,
                to_godown_id=t.to_godown_id,
                to_godown_name=t.to_godown.name if t.to_godown else None,
                status=t.status,
                transfer_date=t.transfer_date,
                notes=t.notes,
                created_by_name=t.created_by.name if t.created_by else None,
                items=items_dto
            )
        )
    return out


# --- 5. Reports & Summary Metrics ---
async def get_inventory_metrics(db: AsyncSession, tenant_id: str) -> InventoryMetricsResponse:
    """Calculate aggregate inventory dashboard metrics"""
    # 1. Total items count
    items_count_res = await db.execute(
        select(func.count(Item.id)).where(Item.tenant_id == tenant_id, Item.is_active == True)
    )
    total_items = items_count_res.scalar() or 0

    # 2. Total active godowns
    godowns_count_res = await db.execute(
        select(func.count(Godown.id)).where(Godown.tenant_id == tenant_id, Godown.is_active == True)
    )
    active_godowns = godowns_count_res.scalar() or 0

    # 3. Sum of stock units & valuations (Active items only)
    stock_items = (await db.execute(
        select(Stock, Item).join(Item, Stock.item_id == Item.id).where(
            Stock.tenant_id == tenant_id,
            Item.is_active == True
        )
    )).all()

    total_stock_units = 0.0
    total_val_cost = 0.0
    total_val_sale = 0.0
    item_stock_map: Dict[str, float] = {}
    item_min_map: Dict[str, float] = {}

    for s, item in stock_items:
        total_stock_units += s.quantity
        total_val_cost += s.quantity * item.purchase_price
        total_val_sale += s.quantity * item.sale_price
        item_stock_map[item.id] = item_stock_map.get(item.id, 0.0) + s.quantity
        item_min_map[item.id] = item.min_stock_alert

    # 4. Low stock & out of stock count
    low_stock_count = 0
    out_of_stock_count = 0

    all_items = (await db.execute(
        select(Item).where(Item.tenant_id == tenant_id, Item.is_active == True)
    )).scalars().all()

    for it in all_items:
        current_qty = item_stock_map.get(it.id, 0.0)
        if current_qty == 0.0:
            out_of_stock_count += 1
            low_stock_count += 1
        elif current_qty <= it.min_stock_alert:
            low_stock_count += 1

    # 5. Batches expiring soon (within 60 days)
    today = date.today()
    exp_threshold = today + timedelta(days=60)
    expiring_res = await db.execute(
        select(func.count(StockBatch.id)).where(
            StockBatch.tenant_id == tenant_id,
            StockBatch.quantity > 0,
            StockBatch.expiry_date != None,
            StockBatch.expiry_date <= exp_threshold
        )
    )
    expiring_count = expiring_res.scalar() or 0

    return InventoryMetricsResponse(
        total_items_count=total_items,
        total_stock_units=round(total_stock_units, 2),
        total_inventory_valuation_cost=round(total_val_cost, 2),
        total_inventory_valuation_sale=round(total_val_sale, 2),
        low_stock_items_count=low_stock_count,
        out_of_stock_items_count=out_of_stock_count,
        expiring_soon_batches_count=expiring_count,
        active_godowns_count=active_godowns
    )


async def get_stock_summary(
    db: AsyncSession,
    tenant_id: str,
    godown_id: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    low_stock_only: bool = False
) -> List[ItemStockSummaryResponse]:
    """Comprehensive item-level stock summary with godown distribution and active batches"""
    item_query = select(Item).where(Item.tenant_id == tenant_id, Item.is_active == True)
    if search:
        s = f"%{search.strip().lower()}%"
        item_query = item_query.where(
            or_(
                func.lower(Item.name).like(s),
                func.lower(Item.sku).like(s),
                func.lower(Item.barcode).like(s)
            )
        )
    if category and category != "all":
        item_query = item_query.where(func.lower(Item.category) == category.strip().lower())

    item_query = item_query.order_by(Item.name.asc())
    items = (await db.execute(item_query)).scalars().all()

    # Load godowns
    all_godowns = (await db.execute(
        select(Godown).where(Godown.tenant_id == tenant_id)
    )).scalars().all()
    godown_dict = {g.id: g.name for g in all_godowns}

    # Load stock entries
    stock_query = select(Stock).where(Stock.tenant_id == tenant_id)
    if godown_id:
        stock_query = stock_query.where(Stock.godown_id == godown_id)
    stock_records = (await db.execute(stock_query)).scalars().all()

    # Group by item_id
    item_godown_stock: Dict[str, Dict[str, float]] = {}
    for sr in stock_records:
        if sr.item_id not in item_godown_stock:
            item_godown_stock[sr.item_id] = {}
        item_godown_stock[sr.item_id][sr.godown_id] = sr.quantity

    # Load active batches
    batches_res = await db.execute(
        select(StockBatch).where(StockBatch.tenant_id == tenant_id, StockBatch.quantity > 0)
    )
    all_batches = batches_res.scalars().all()
    item_batches: Dict[str, List[StockBatch]] = {}
    for b in all_batches:
        if b.item_id not in item_batches:
            item_batches[b.item_id] = []
        item_batches[b.item_id].append(b)

    results = []
    for it in items:
        g_stocks = item_godown_stock.get(it.id, {})
        total_qty = sum(g_stocks.values()) if not godown_id else g_stocks.get(godown_id, 0.0)

        is_out = total_qty == 0.0
        is_low = total_qty <= it.min_stock_alert

        if low_stock_only and not is_low:
            continue

        godown_breakdown = [
            {
                "godown_id": gid,
                "godown_name": godown_dict.get(gid, "Unknown"),
                "quantity": qty
            }
            for gid, qty in g_stocks.items()
        ]

        batch_responses = [
            StockBatchResponse.model_validate(b)
            for b in item_batches.get(it.id, [])
        ]

        u_per_case = it.units_per_case if (it.units_per_case and it.units_per_case > 0) else 1.0
        results.append(
            ItemStockSummaryResponse(
                item_id=it.id,
                item_name=it.name,
                sku=it.sku,
                barcode=it.barcode,
                category=it.category,
                unit=it.unit,
                secondary_unit=it.secondary_unit or "CS",
                units_per_case=u_per_case,
                total_cases=round(total_qty / u_per_case, 2),
                sale_price=it.sale_price,
                purchase_price=it.purchase_price,
                total_quantity=round(total_qty, 2),
                total_valuation_cost=round(total_qty * it.purchase_price, 2),
                total_valuation_sale=round(total_qty * it.sale_price, 2),
                min_stock_alert=it.min_stock_alert,
                is_low_stock=is_low,
                is_out_of_stock=is_out,
                godown_breakdown=godown_breakdown,
                active_batches=batch_responses
            )
        )

    return results


async def get_stock_movements_ledger(
    db: AsyncSession,
    tenant_id: str,
    item_id: Optional[str] = None,
    godown_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    limit: int = 100
) -> List[StockMovementResponse]:
    """Audit ledger of all stock ins, outs, transfers, and adjustments"""
    query = (
        select(StockMovement)
        .where(StockMovement.tenant_id == tenant_id)
        .order_by(desc(StockMovement.created_at))
        .limit(limit)
    )
    if item_id:
        query = query.where(StockMovement.item_id == item_id)
    if godown_id:
        query = query.where(StockMovement.godown_id == godown_id)
    if movement_type and movement_type != "all":
        query = query.where(StockMovement.movement_type == movement_type)

    result = await db.execute(query)
    movements = result.scalars().all()

    return [
        StockMovementResponse(
            id=m.id,
            tenant_id=m.tenant_id,
            created_at=m.created_at,
            godown_id=m.godown_id,
            godown_name=m.godown.name if m.godown else None,
            item_id=m.item_id,
            item_name=m.item.name if m.item else None,
            item_unit=m.item.unit if m.item else "PCS",
            movement_type=m.movement_type,
            quantity=m.quantity,
            balance_after=m.balance_after,
            cost_per_unit=m.cost_per_unit,
            reference_type=m.reference_type,
            reference_id=m.reference_id,
            batch_number=m.batch_number,
            notes=m.notes,
            performed_by_name=m.performed_by.name if m.performed_by else None
        )
        for m in movements
    ]


# --- 6. Alerts & Notifications ---
async def get_low_stock_alerts(db: AsyncSession, tenant_id: str) -> List[LowStockAlertItem]:
    """Fetch all items that are at or below minimum threshold"""
    summary = await get_stock_summary(db, tenant_id, low_stock_only=True)
    out = []
    for s in summary:
        status_label = "OUT_OF_STOCK" if s.is_out_of_stock else "LOW_STOCK"
        out.append(
            LowStockAlertItem(
                item_id=s.item_id,
                item_name=s.item_name,
                sku=s.sku,
                category=s.category,
                unit=s.unit,
                total_quantity=s.total_quantity,
                min_stock_alert=s.min_stock_alert,
                status=status_label,
                godown_distribution=s.godown_breakdown
            )
        )
    return out


async def get_expiring_batches_alerts(
    db: AsyncSession,
    tenant_id: str,
    days_threshold: int = 60
) -> List[ExpiringBatchAlertItem]:
    """Fetch all batches expired or expiring within threshold days"""
    today = date.today()
    cutoff = today + timedelta(days=days_threshold)

    result = await db.execute(
        select(StockBatch)
        .where(
            StockBatch.tenant_id == tenant_id,
            StockBatch.quantity > 0,
            StockBatch.expiry_date != None,
            StockBatch.expiry_date <= cutoff
        )
        .order_by(StockBatch.expiry_date.asc())
    )
    batches = result.scalars().all()
    out = []
    for b in batches:
        days_left = (b.expiry_date - today).days if b.expiry_date else 0
        status_label = "EXPIRED" if days_left < 0 else "EXPIRING_SOON"
        out.append(
            ExpiringBatchAlertItem(
                batch_id=b.id,
                item_id=b.item_id,
                item_name=b.item.name if b.item else "Unknown Item",
                godown_name=b.godown.name if b.godown else "Unknown Godown",
                batch_number=b.batch_number,
                expiry_date=b.expiry_date,
                days_to_expiry=days_left,
                quantity=b.quantity,
                unit=b.item.unit if b.item else "PCS",
                status=status_label
            )
        )
    return out
