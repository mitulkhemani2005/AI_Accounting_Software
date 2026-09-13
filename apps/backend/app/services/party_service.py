from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, and_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.models.party import Area, Customer, Supplier
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
        else:
            setattr(customer, key, value)

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
        else:
            setattr(supplier, key, value)

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

