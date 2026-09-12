from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from fastapi import HTTPException, status
from app.models.party import Customer, Supplier
from app.schemas.party import (
    CustomerCreateRequest,
    CustomerUpdateRequest,
    SupplierCreateRequest,
    SupplierUpdateRequest,
)
from app.services.audit_service import log_audit_event


# ==============================================================================
# Customer Operations
# ==============================================================================

async def create_customer(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payload: CustomerCreateRequest,
    client_ip: Optional[str] = None
) -> Customer:
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

    customer = Customer(
        tenant_id=tenant_id,
        name=payload.name,
        mobile=payload.mobile,
        email=payload.email,
        gst_number=payload.gst_number,
        state=payload.state,
        address=payload.address,
        opening_balance=payload.opening_balance,
        current_balance=payload.opening_balance
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="CREATE",
        entity_type="Customer",
        entity_id=customer.id,
        details={"name": customer.name, "mobile": customer.mobile},
        ip_address=client_ip
    )

    return customer


async def list_customers(
    db: AsyncSession,
    tenant_id: str,
    search: Optional[str] = None
) -> List[Customer]:
    query = select(Customer).where(Customer.tenant_id == tenant_id)
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
    return list(result.scalars().all())


async def update_customer(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    customer_id: str,
    payload: CustomerUpdateRequest,
    client_ip: Optional[str] = None
) -> Customer:
    result = await db.execute(
        select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(customer, key, value)

    await db.commit()
    await db.refresh(customer)

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

    return customer


# ==============================================================================
# Supplier Operations
# ==============================================================================

async def create_supplier(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payload: SupplierCreateRequest,
    client_ip: Optional[str] = None
) -> Supplier:
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

    supplier = Supplier(
        tenant_id=tenant_id,
        name=payload.name,
        mobile=payload.mobile,
        email=payload.email,
        gst_number=payload.gst_number,
        state=payload.state,
        address=payload.address,
        opening_balance=payload.opening_balance,
        current_balance=payload.opening_balance
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="CREATE",
        entity_type="Supplier",
        entity_id=supplier.id,
        details={"name": supplier.name, "mobile": supplier.mobile},
        ip_address=client_ip
    )

    return supplier


async def list_suppliers(
    db: AsyncSession,
    tenant_id: str,
    search: Optional[str] = None
) -> List[Supplier]:
    query = select(Supplier).where(Supplier.tenant_id == tenant_id)
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
    return list(result.scalars().all())
