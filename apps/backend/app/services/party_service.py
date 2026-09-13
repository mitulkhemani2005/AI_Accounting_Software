from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, and_, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.models.party import Area, Customer, Supplier, Payment
from app.models.bill import Bill
from app.models.user import User
from app.schemas.party import (
    AreaCreateRequest,
    AreaUpdateRequest,
    AreaResponse,
    CustomerCreateRequest,
    CustomerUpdateRequest,
    CustomerResponse,
    SupplierCreateRequest,
    SupplierUpdateRequest,
    SupplierResponse,
    PaymentCreateRequest,
    PaymentResponse,
    PartyLedgerEntry,
    PartyLedgerResponse,
)
from app.services.audit_service import log_audit_event


# ==============================================================================
# Helper Formatters
# ==============================================================================

def format_customer_response(customer: Customer) -> CustomerResponse:
    area_name = customer.area.name if getattr(customer, "area", None) and customer.area else None
    return CustomerResponse(
        id=customer.id,
        tenant_id=customer.tenant_id,
        name=customer.name,
        mobile=customer.mobile,
        email=customer.email,
        gst_number=customer.gst_number,
        state=customer.state,
        address=customer.address,
        area_id=customer.area_id,
        area_name=area_name,
        opening_balance=customer.opening_balance,
        current_balance=customer.current_balance,
        created_at=customer.created_at,
    )


def format_supplier_response(supplier: Supplier) -> SupplierResponse:
    area_name = supplier.area.name if getattr(supplier, "area", None) and supplier.area else None
    return SupplierResponse(
        id=supplier.id,
        tenant_id=supplier.tenant_id,
        name=supplier.name,
        mobile=supplier.mobile,
        email=supplier.email,
        gst_number=supplier.gst_number,
        state=supplier.state,
        address=supplier.address,
        area_id=supplier.area_id,
        area_name=area_name,
        opening_balance=supplier.opening_balance,
        current_balance=supplier.current_balance,
        created_at=supplier.created_at,
    )


# ==============================================================================
# Area Operations (Admin Managed)
# ==============================================================================

async def create_area(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payload: AreaCreateRequest,
    client_ip: Optional[str] = None
) -> AreaResponse:
    name_clean = payload.name.strip()
    existing = await db.execute(
        select(Area).where(Area.tenant_id == tenant_id, func.lower(Area.name) == name_clean.lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Area with name '{name_clean}' already exists"
        )

    area = Area(
        tenant_id=tenant_id,
        name=name_clean,
        code=payload.code.strip().upper() if payload.code else None,
        description=payload.description.strip() if payload.description else None,
        is_active=True
    )
    db.add(area)
    await db.commit()
    await db.refresh(area)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="CREATE",
        entity_type="Area",
        entity_id=area.id,
        details={"name": area.name, "code": area.code},
        ip_address=client_ip
    )

    return AreaResponse(
        id=area.id,
        tenant_id=area.tenant_id,
        name=area.name,
        code=area.code,
        description=area.description,
        is_active=area.is_active,
        created_at=area.created_at,
        customers_count=0,
        suppliers_count=0
    )


async def list_areas(
    db: AsyncSession,
    tenant_id: str,
    search: Optional[str] = None,
    include_inactive: bool = False
) -> List[AreaResponse]:
    query = select(Area).where(Area.tenant_id == tenant_id)
    if not include_inactive:
        query = query.where(Area.is_active == True)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Area.name.ilike(term),
                Area.code.ilike(term),
                Area.description.ilike(term)
            )
        )
    query = query.order_by(Area.name.asc())
    result = await db.execute(query)
    areas = list(result.scalars().all())

    # Calculate assigned party counts
    responses = []
    for a in areas:
        cust_count = (await db.execute(
            select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id, Customer.area_id == a.id)
        )).scalar() or 0
        supp_count = (await db.execute(
            select(func.count(Supplier.id)).where(Supplier.tenant_id == tenant_id, Supplier.area_id == a.id)
        )).scalar() or 0

        responses.append(
            AreaResponse(
                id=a.id,
                tenant_id=a.tenant_id,
                name=a.name,
                code=a.code,
                description=a.description,
                is_active=a.is_active,
                created_at=a.created_at,
                customers_count=cust_count,
                suppliers_count=supp_count
            )
        )
    return responses


async def update_area(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    area_id: str,
    payload: AreaUpdateRequest,
    client_ip: Optional[str] = None
) -> AreaResponse:
    result = await db.execute(
        select(Area).where(Area.tenant_id == tenant_id, Area.id == area_id)
    )
    area = result.scalar_one_or_none()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")

    if payload.name:
        name_clean = payload.name.strip()
        existing = await db.execute(
            select(Area).where(
                Area.tenant_id == tenant_id,
                Area.id != area_id,
                func.lower(Area.name) == name_clean.lower()
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Area '{name_clean}' already exists")
        area.name = name_clean

    if payload.code is not None:
        area.code = payload.code.strip().upper() if payload.code else None
    if payload.description is not None:
        area.description = payload.description.strip() if payload.description else None
    if payload.is_active is not None:
        area.is_active = payload.is_active

    await db.commit()
    await db.refresh(area)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="UPDATE",
        entity_type="Area",
        entity_id=area.id,
        details={"name": area.name, "is_active": area.is_active},
        ip_address=client_ip
    )

    cust_count = (await db.execute(
        select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id, Customer.area_id == area.id)
    )).scalar() or 0
    supp_count = (await db.execute(
        select(func.count(Supplier.id)).where(Supplier.tenant_id == tenant_id, Supplier.area_id == area.id)
    )).scalar() or 0

    return AreaResponse(
        id=area.id,
        tenant_id=area.tenant_id,
        name=area.name,
        code=area.code,
        description=area.description,
        is_active=area.is_active,
        created_at=area.created_at,
        customers_count=cust_count,
        suppliers_count=supp_count
    )


async def delete_area(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    area_id: str,
    client_ip: Optional[str] = None
) -> dict:
    result = await db.execute(
        select(Area).where(Area.tenant_id == tenant_id, Area.id == area_id)
    )
    area = result.scalar_one_or_none()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")

    # Set area_id to null for attached parties
    await db.execute(
        Customer.__table__.update().where(Customer.area_id == area_id).values(area_id=None)
    )
    await db.execute(
        Supplier.__table__.update().where(Supplier.area_id == area_id).values(area_id=None)
    )

    await db.delete(area)
    await db.commit()

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="DELETE",
        entity_type="Area",
        entity_id=area_id,
        details={"name": area.name},
        ip_address=client_ip
    )
    return {"status": "success", "message": f"Area '{area.name}' deleted successfully"}


# ==============================================================================
# Customer Operations
# ==============================================================================

async def create_customer(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payload: CustomerCreateRequest,
    client_ip: Optional[str] = None
) -> CustomerResponse:
    if payload.mobile:
        existing = await db.execute(
            select(Customer).where(
                Customer.tenant_id == tenant_id, Customer.mobile == payload.mobile
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Customer with mobile number '{payload.mobile}' already exists"
            )

    # Validate Area if provided
    if payload.area_id:
        area_check = await db.execute(
            select(Area).where(Area.tenant_id == tenant_id, Area.id == payload.area_id)
        )
        if not area_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Selected Area not found")

    customer = Customer(
        tenant_id=tenant_id,
        name=payload.name.strip(),
        mobile=payload.mobile.strip() if payload.mobile else None,
        email=payload.email,
        gst_number=payload.gst_number.strip().upper() if payload.gst_number else None,
        state=payload.state,
        address=payload.address.strip() if payload.address else None,
        area_id=payload.area_id,
        opening_balance=payload.opening_balance,
        current_balance=payload.opening_balance
    )
    db.add(customer)
    await db.commit()
    
    # Reload with area relationship
    reload_res = await db.execute(
        select(Customer).options(selectinload(Customer.area)).where(Customer.id == customer.id)
    )
    customer = reload_res.scalar_one()

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="CREATE",
        entity_type="Customer",
        entity_id=customer.id,
        details={"name": customer.name, "mobile": customer.mobile, "area_id": customer.area_id},
        ip_address=client_ip
    )

    return format_customer_response(customer)


async def list_customers(
    db: AsyncSession,
    tenant_id: str,
    search: Optional[str] = None,
    area_id: Optional[str] = None
) -> List[CustomerResponse]:
    query = select(Customer).options(selectinload(Customer.area)).where(Customer.tenant_id == tenant_id)
    if area_id:
        query = query.where(Customer.area_id == area_id)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Customer.name.ilike(term),
                Customer.mobile.ilike(term),
                Customer.gst_number.ilike(term)
            )
        )
    query = query.order_by(Customer.name.asc())
    result = await db.execute(query)
    customers = list(result.scalars().all())
    return [format_customer_response(c) for c in customers]


async def update_customer(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    customer_id: str,
    payload: CustomerUpdateRequest,
    client_ip: Optional[str] = None
) -> CustomerResponse:
    result = await db.execute(
        select(Customer).options(selectinload(Customer.area)).where(Customer.tenant_id == tenant_id, Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "area_id" in update_data and update_data["area_id"]:
        area_check = await db.execute(
            select(Area).where(Area.tenant_id == tenant_id, Area.id == update_data["area_id"])
        )
        if not area_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Selected Area not found")

    for key, value in update_data.items():
        if key == "name" and value:
            setattr(customer, key, value.strip())
        elif key == "gst_number" and value:
            setattr(customer, key, value.strip().upper())
        elif key == "opening_balance" and value is not None:
            customer.opening_balance = float(value)
        else:
            setattr(customer, key, value)

    await db.flush()
    # Recalculate customer balance to account for any opening balance change
    await recalculate_party_balance(db, tenant_id, customer.id, "customer")
    await db.commit()
    
    # Reload with area relationship
    reload_res = await db.execute(
        select(Customer).options(selectinload(Customer.area)).where(Customer.id == customer.id)
    )
    customer = reload_res.scalar_one()

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="UPDATE",
        entity_type="Customer",
        entity_id=customer.id,
        details=update_data,
        ip_address=client_ip
    )

    return format_customer_response(customer)


# ==============================================================================
# Supplier Operations
# ==============================================================================

async def create_supplier(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payload: SupplierCreateRequest,
    client_ip: Optional[str] = None
) -> SupplierResponse:
    if payload.mobile:
        existing = await db.execute(
            select(Supplier).where(
                Supplier.tenant_id == tenant_id, Supplier.mobile == payload.mobile
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier with mobile number '{payload.mobile}' already exists"
            )

    if payload.area_id:
        area_check = await db.execute(
            select(Area).where(Area.tenant_id == tenant_id, Area.id == payload.area_id)
        )
        if not area_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Selected Area not found")

    supplier = Supplier(
        tenant_id=tenant_id,
        name=payload.name.strip(),
        mobile=payload.mobile.strip() if payload.mobile else None,
        email=payload.email,
        gst_number=payload.gst_number.strip().upper() if payload.gst_number else None,
        state=payload.state,
        address=payload.address.strip() if payload.address else None,
        area_id=payload.area_id,
        opening_balance=payload.opening_balance,
        current_balance=payload.opening_balance
    )
    db.add(supplier)
    await db.commit()
    
    reload_res = await db.execute(
        select(Supplier).options(selectinload(Supplier.area)).where(Supplier.id == supplier.id)
    )
    supplier = reload_res.scalar_one()

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="CREATE",
        entity_type="Supplier",
        entity_id=supplier.id,
        details={"name": supplier.name, "mobile": supplier.mobile, "area_id": supplier.area_id},
        ip_address=client_ip
    )

    return format_supplier_response(supplier)


async def list_suppliers(
    db: AsyncSession,
    tenant_id: str,
    search: Optional[str] = None,
    area_id: Optional[str] = None
) -> List[SupplierResponse]:
    query = select(Supplier).options(selectinload(Supplier.area)).where(Supplier.tenant_id == tenant_id)
    if area_id:
        query = query.where(Supplier.area_id == area_id)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Supplier.name.ilike(term),
                Supplier.mobile.ilike(term),
                Supplier.gst_number.ilike(term)
            )
        )
    query = query.order_by(Supplier.name.asc())
    result = await db.execute(query)
    suppliers = list(result.scalars().all())
    return [format_supplier_response(s) for s in suppliers]


async def update_supplier(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    supplier_id: str,
    payload: SupplierUpdateRequest,
    client_ip: Optional[str] = None
) -> SupplierResponse:
    result = await db.execute(
        select(Supplier).options(selectinload(Supplier.area)).where(Supplier.tenant_id == tenant_id, Supplier.id == supplier_id)
    )
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "area_id" in update_data and update_data["area_id"]:
        area_check = await db.execute(
            select(Area).where(Area.tenant_id == tenant_id, Area.id == update_data["area_id"])
        )
        if not area_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Selected Area not found")

    for key, value in update_data.items():
        if key == "name" and value:
            setattr(supplier, key, value.strip())
        elif key == "gst_number" and value:
            setattr(supplier, key, value.strip().upper())
        elif key == "opening_balance" and value is not None:
            supplier.opening_balance = float(value)
        else:
            setattr(supplier, key, value)

    await db.flush()
    await recalculate_party_balance(db, tenant_id, supplier.id, "supplier")
    await db.commit()
    
    reload_res = await db.execute(
        select(Supplier).options(selectinload(Supplier.area)).where(Supplier.id == supplier.id)
    )
    supplier = reload_res.scalar_one()

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="UPDATE",
        entity_type="Supplier",
        entity_id=supplier.id,
        details=update_data,
        ip_address=client_ip
    )

    return format_supplier_response(supplier)


# ==============================================================================
# Dynamic Balance Recalculation & Ledger
# ==============================================================================

async def recalculate_party_balance(
    db: AsyncSession,
    tenant_id: str,
    party_id: str,
    party_type: str = "customer"
) -> float:
    """
    Recalculates current outstanding balance for a customer or supplier with 100% mathematical precision:
    - Customer Outstanding (Receivable) = Opening Balance + Sum(Confirmed Unpaid Sale Invoices) - Sum(Payment In) + Sum(Payment Out)
    - Supplier Outstanding (Payable) = Opening Balance + Sum(Confirmed Unpaid Purchase Inward) - Sum(Payment Out) + Sum(Payment In)
    """
    if party_type == "customer":
        cust_res = await db.execute(
            select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == party_id)
        )
        customer = cust_res.scalar_one_or_none()
        if not customer:
            return 0.0

        # 1. Sum active & confirmed sale bills (unreviewed staff bills do not alter financial balance until confirmed)
        bills_res = await db.execute(
            select(Bill).where(
                Bill.tenant_id == tenant_id,
                Bill.party_id == party_id,
                Bill.type == "sale",
                Bill.status == "active",
                Bill.is_reviewed_by_admin == True
            )
        )
        bills = list(bills_res.scalars().all())

        unpaid_sales_debt = 0.0
        for b in bills:
            unpaid_sales_debt += max(0.0, float(b.total_amount) - float(b.paid_amount or 0.0))

        # 2. Sum active payment records
        payments_res = await db.execute(
            select(Payment).where(
                Payment.tenant_id == tenant_id,
                Payment.party_id == party_id,
                Payment.party_type == "customer",
                Payment.status == "active"
            )
        )
        payments = list(payments_res.scalars().all())

        total_payments_in = sum(float(p.amount) for p in payments if p.payment_type in ["payment_in", "receipt", "in", "receive"])
        total_payments_out = sum(float(p.amount) for p in payments if p.payment_type in ["payment_out", "voucher", "payment", "out", "refund"])

        new_balance = round((float(customer.opening_balance) or 0.0) + unpaid_sales_debt - total_payments_in + total_payments_out, 2)
        customer.current_balance = new_balance
        await db.flush()
        return new_balance

    else:  # supplier
        supp_res = await db.execute(
            select(Supplier).where(Supplier.tenant_id == tenant_id, Supplier.id == party_id)
        )
        supplier = supp_res.scalar_one_or_none()
        if not supplier:
            return 0.0

        # 1. Sum active purchase bills (matched by party_id or supplier name)
        bills_res = await db.execute(
            select(Bill).where(
                Bill.tenant_id == tenant_id,
                or_(Bill.party_id == party_id, func.lower(Bill.party_name) == func.lower(supplier.name)),
                Bill.type == "purchase",
                Bill.status == "active"
            )
        )
        bills = list(bills_res.scalars().all())

        unpaid_purchases_debt = 0.0
        for b in bills:
            unpaid_purchases_debt += max(0.0, float(b.total_amount) - float(b.paid_amount or 0.0))

        # 2. Sum active payments
        payments_res = await db.execute(
            select(Payment).where(
                Payment.tenant_id == tenant_id,
                Payment.party_id == party_id,
                Payment.party_type == "supplier",
                Payment.status == "active"
            )
        )
        payments = list(payments_res.scalars().all())

        total_payments_out = sum(float(p.amount) for p in payments if p.payment_type in ["payment_out", "voucher", "payment", "out", "pay"])
        total_payments_in = sum(float(p.amount) for p in payments if p.payment_type in ["payment_in", "receipt", "in", "refund"])

        new_balance = round((float(supplier.opening_balance) or 0.0) + unpaid_purchases_debt - total_payments_out + total_payments_in, 2)
        supplier.current_balance = new_balance
        await db.flush()
        return new_balance


async def record_party_payment(
    db: AsyncSession,
    tenant_id: str,
    user: User,
    payload: PaymentCreateRequest,
    client_ip: Optional[str] = None
) -> PaymentResponse:
    party_name = None
    if payload.party_type == "customer":
        cust = (await db.execute(
            select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == payload.party_id)
        )).scalar_one_or_none()
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found")
        party_name = cust.name
    else:
        supp = (await db.execute(
            select(Supplier).where(Supplier.tenant_id == tenant_id, Supplier.id == payload.party_id)
        )).scalar_one_or_none()
        if not supp:
            raise HTTPException(status_code=404, detail="Supplier not found")
        party_name = supp.name

    ptype_raw = (payload.payment_type or "").lower().strip()
    if ptype_raw in ["receipt", "payment_in", "in", "inward", "receive"]:
        normalized_ptype = "payment_in"
    elif ptype_raw in ["voucher", "payment_out", "out", "payment", "outward", "pay"]:
        normalized_ptype = "payment_out"
    else:
        normalized_ptype = "payment_in" if payload.party_type == "customer" else "payment_out"

    payment = Payment(
        tenant_id=tenant_id,
        party_type=payload.party_type,
        party_id=payload.party_id,
        party_name=party_name,
        payment_type=normalized_ptype,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        reference_number=payload.reference_number.strip() if payload.reference_number else None,
        payment_date=payload.payment_date or datetime.now(timezone.utc),
        notes=payload.notes.strip() if payload.notes else None,
        created_by_user_id=user.id,
        status="active"
    )
    db.add(payment)
    await db.flush()

    # Recalculate balance
    await recalculate_party_balance(
        db=db,
        tenant_id=tenant_id,
        party_id=payload.party_id,
        party_type=payload.party_type
    )

    # Auto-Post Double-Entry Payment Journal Voucher
    from app.services.accounting_service import record_payment_journal_entry
    await record_payment_journal_entry(
        db=db,
        tenant_id=tenant_id,
        user_id=user.id,
        payment_id=payment.id,
        party_type=payload.party_type,
        party_name=party_name,
        party_id=payload.party_id,
        amount=payment.amount,
        payment_mode=payment.payment_mode,
        reference_number=payment.reference_number,
        notes=payment.notes
    )

    await db.commit()
    await db.refresh(payment)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="RECORD_PAYMENT",
        entity_type="Payment",
        entity_id=payment.id,
        details={"party_name": party_name, "amount": payment.amount, "mode": payment.payment_mode, "type": payment.payment_type},
        ip_address=client_ip
    )

    return PaymentResponse(
        id=payment.id,
        tenant_id=payment.tenant_id,
        party_type=payment.party_type,
        party_id=payment.party_id,
        party_name=payment.party_name,
        payment_type=payment.payment_type,
        amount=payment.amount,
        payment_mode=payment.payment_mode,
        reference_number=payment.reference_number,
        payment_date=payment.payment_date,
        notes=payment.notes,
        status=payment.status,
        created_at=payment.created_at
    )


async def get_party_ledger(
    db: AsyncSession,
    tenant_id: str,
    party_id: str,
    party_type: str
) -> PartyLedgerResponse:
    """Builds a complete, chronological statement of account with running balance."""
    if party_type == "customer":
        cust = (await db.execute(
            select(Customer).options(selectinload(Customer.area)).where(Customer.tenant_id == tenant_id, Customer.id == party_id)
        )).scalar_one_or_none()
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found")

        await recalculate_party_balance(db, tenant_id, party_id, "customer")
        await db.refresh(cust)

        bills = list((await db.execute(
            select(Bill).where(Bill.tenant_id == tenant_id, Bill.party_id == party_id, Bill.type == "sale")
            .order_by(Bill.bill_date.asc(), Bill.created_at.asc())
        )).scalars().all())

        payments = list((await db.execute(
            select(Payment).where(Payment.tenant_id == tenant_id, Payment.party_id == party_id, Payment.party_type == "customer")
            .order_by(Payment.payment_date.asc(), Payment.created_at.asc())
        )).scalars().all())

        transactions = []
        if cust.opening_balance != 0:
            transactions.append(
                PartyLedgerEntry(
                    id="OP-BAL",
                    date=cust.created_at,
                    type="opening_balance",
                    type_label="Opening Balance",
                    reference_no="OP-BAL",
                    description="Initial Opening Balance",
                    payment_mode="N/A",
                    debit=cust.opening_balance if cust.opening_balance > 0 else 0.0,
                    credit=abs(cust.opening_balance) if cust.opening_balance < 0 else 0.0,
                    running_balance=cust.opening_balance
                )
            )

        for b in bills:
            if b.status == "void":
                transactions.append(
                    PartyLedgerEntry(
                        id=b.id,
                        date=b.bill_date or b.created_at,
                        type="bill_void",
                        type_label="Voided Sale Invoice",
                        reference_no=b.bill_number,
                        description=f"Cancelled/Voided Bill #{b.bill_number}",
                        payment_mode=b.payment_mode,
                        debit=0.0,
                        credit=0.0,
                        running_balance=0.0
                    )
                )
            elif not b.is_reviewed_by_admin or b.status == "under_review":
                transactions.append(
                    PartyLedgerEntry(
                        id=b.id,
                        date=b.bill_date or b.created_at,
                        type="bill_under_review",
                        type_label="Order (Under Admin Review)",
                        reference_no=b.bill_number,
                        description=f"Staff Order #{b.bill_number} (Pending Admin Confirmation)",
                        payment_mode=b.payment_mode,
                        debit=0.0,
                        credit=0.0,
                        running_balance=0.0
                    )
                )
            else:
                transactions.append(
                    PartyLedgerEntry(
                        id=b.id,
                        date=b.bill_date or b.created_at,
                        type="sale_invoice",
                        type_label=f"Tax Invoice ({b.payment_mode.upper()})",
                        reference_no=b.bill_number,
                        description=f"Sale Bill #{b.bill_number}",
                        payment_mode=b.payment_mode,
                        debit=b.total_amount,
                        credit=b.paid_amount or 0.0,
                        running_balance=0.0
                    )
                )

        for p in payments:
            if p.status == "cancelled":
                continue
            if p.payment_type == "payment_in":
                transactions.append(
                    PartyLedgerEntry(
                        id=p.id,
                        date=p.payment_date or p.created_at,
                        type="payment_in",
                        type_label=f"Receipt ({p.payment_mode.upper()})",
                        reference_no=p.reference_number or f"RCPT-{p.id[:8]}",
                        description=f"Payment Received from Customer. {p.notes or ''}".strip(),
                        payment_mode=p.payment_mode,
                        debit=0.0,
                        credit=p.amount,
                        running_balance=0.0
                    )
                )
            else:
                transactions.append(
                    PartyLedgerEntry(
                        id=p.id,
                        date=p.payment_date or p.created_at,
                        type="payment_out",
                        type_label=f"Refund/Payment ({p.payment_mode.upper()})",
                        reference_no=p.reference_number or f"PMT-{p.id[:8]}",
                        description=f"Refund/Payment Out to Customer. {p.notes or ''}".strip(),
                        payment_mode=p.payment_mode,
                        debit=p.amount,
                        credit=0.0,
                        running_balance=0.0
                    )
                )

        transactions.sort(key=lambda x: x.date)

        running = float(cust.opening_balance) or 0.0
        total_invoiced = 0.0
        total_paid = 0.0

        for tx in transactions:
            if tx.type == "opening_balance":
                tx.running_balance = running
            elif tx.type not in ["bill_void", "bill_under_review"]:
                running = round(running + tx.debit - tx.credit, 2)
                if tx.type == "sale_invoice":
                    total_invoiced += tx.debit
                    total_paid += tx.credit
                elif tx.type == "payment_in":
                    total_paid += tx.credit
                tx.running_balance = running
            else:
                tx.running_balance = running

        return PartyLedgerResponse(
            party_id=cust.id,
            party_name=cust.name,
            party_type="customer",
            mobile=cust.mobile,
            gst_number=cust.gst_number,
            area_name=cust.area.name if cust.area else None,
            opening_balance=cust.opening_balance,
            total_invoiced=round(total_invoiced, 2),
            total_paid=round(total_paid, 2),
            current_balance=cust.current_balance,
            transactions=transactions
        )

    else:  # Supplier
        supp = (await db.execute(
            select(Supplier).options(selectinload(Supplier.area)).where(Supplier.tenant_id == tenant_id, Supplier.id == party_id)
        )).scalar_one_or_none()
        if not supp:
            raise HTTPException(status_code=404, detail="Supplier not found")

        await recalculate_party_balance(db, tenant_id, party_id, "supplier")
        await db.refresh(supp)

        bills = list((await db.execute(
            select(Bill).where(
                Bill.tenant_id == tenant_id,
                or_(Bill.party_id == party_id, func.lower(Bill.party_name) == func.lower(supp.name)),
                Bill.type == "purchase"
            ).order_by(Bill.bill_date.asc(), Bill.created_at.asc())
        )).scalars().all())

        payments = list((await db.execute(
            select(Payment).where(Payment.tenant_id == tenant_id, Payment.party_id == party_id, Payment.party_type == "supplier")
            .order_by(Payment.payment_date.asc(), Payment.created_at.asc())
        )).scalars().all())

        transactions = []
        if supp.opening_balance != 0:
            transactions.append(
                PartyLedgerEntry(
                    id="OP-BAL",
                    date=supp.created_at,
                    type="opening_balance",
                    type_label="Opening Balance",
                    reference_no="OP-BAL",
                    description="Initial Opening Balance",
                    payment_mode="N/A",
                    debit=0.0,
                    credit=supp.opening_balance,
                    running_balance=supp.opening_balance
                )
            )

        for b in bills:
            if b.status == "void":
                transactions.append(
                    PartyLedgerEntry(
                        id=b.id,
                        date=b.bill_date or b.created_at,
                        type="bill_void",
                        type_label="Voided Purchase Bill",
                        reference_no=b.bill_number,
                        description=f"Cancelled/Voided Purchase #{b.bill_number}",
                        payment_mode=b.payment_mode,
                        debit=0.0,
                        credit=0.0,
                        running_balance=0.0
                    )
                )
            else:
                transactions.append(
                    PartyLedgerEntry(
                        id=b.id,
                        date=b.bill_date or b.created_at,
                        type="purchase_invoice",
                        type_label=f"Purchase Inward ({b.payment_mode.upper()})",
                        reference_no=b.bill_number,
                        description=f"Purchase Bill #{b.bill_number}",
                        payment_mode=b.payment_mode,
                        debit=b.paid_amount or 0.0,
                        credit=b.total_amount,
                        running_balance=0.0
                    )
                )

        for p in payments:
            if p.status == "cancelled":
                continue
            if p.payment_type == "payment_out":
                transactions.append(
                    PartyLedgerEntry(
                        id=p.id,
                        date=p.payment_date or p.created_at,
                        type="payment_out",
                        type_label=f"Payment Made ({p.payment_mode.upper()})",
                        reference_no=p.reference_number or f"PMT-{p.id[:8]}",
                        description=f"Payment to Supplier. {p.notes or ''}".strip(),
                        payment_mode=p.payment_mode,
                        debit=p.amount,
                        credit=0.0,
                        running_balance=0.0
                    )
                )
            else:
                transactions.append(
                    PartyLedgerEntry(
                        id=p.id,
                        date=p.payment_date or p.created_at,
                        type="payment_in",
                        type_label=f"Supplier Refund ({p.payment_mode.upper()})",
                        reference_no=p.reference_number or f"RCPT-{p.id[:8]}",
                        description=f"Refund from Supplier. {p.notes or ''}".strip(),
                        payment_mode=p.payment_mode,
                        debit=0.0,
                        credit=p.amount,
                        running_balance=0.0
                    )
                )

        transactions.sort(key=lambda x: x.date)

        running = float(supp.opening_balance) or 0.0
        total_invoiced = 0.0
        total_paid = 0.0

        for tx in transactions:
            if tx.type == "opening_balance":
                tx.running_balance = running
            elif tx.type != "bill_void":
                running = round(running + tx.credit - tx.debit, 2)
                if tx.type == "purchase_invoice":
                    total_invoiced += tx.credit
                    total_paid += tx.debit
                elif tx.type == "payment_out":
                    total_paid += tx.debit
                tx.running_balance = running
            else:
                tx.running_balance = running

        return PartyLedgerResponse(
            party_id=supp.id,
            party_name=supp.name,
            party_type="supplier",
            mobile=supp.mobile,
            gst_number=supp.gst_number,
            area_name=supp.area.name if supp.area else None,
            opening_balance=supp.opening_balance,
            total_invoiced=round(total_invoiced, 2),
            total_paid=round(total_paid, 2),
            current_balance=supp.current_balance,
            transactions=transactions
        )


async def recalculate_all_parties(db: AsyncSession, tenant_id: str) -> Dict[str, Any]:
    custs = (await db.execute(select(Customer.id).where(Customer.tenant_id == tenant_id))).scalars().all()
    for cid in custs:
        await recalculate_party_balance(db, tenant_id, cid, "customer")

    supps = (await db.execute(select(Supplier.id).where(Supplier.tenant_id == tenant_id))).scalars().all()
    for sid in supps:
        await recalculate_party_balance(db, tenant_id, sid, "supplier")

    await db.commit()
    return {
        "status": "success",
        "recalculated_customers": len(custs),
        "recalculated_suppliers": len(supps)
    }


