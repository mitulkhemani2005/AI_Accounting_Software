from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
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
from app.models.user import User
from app.api.deps import get_current_user, require_permission
from app.services.party_service import (
    create_area,
    list_areas,
    update_area,
    delete_area,
    create_customer,
    list_customers,
    update_customer,
    create_supplier,
    list_suppliers,
    update_supplier,
)

router = APIRouter()


# ==============================================================================
# Area Endpoints (Admin Managed)
# ==============================================================================

@router.post("/areas", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
async def add_area(
    payload: AreaCreateRequest,
    request: Request,
    current_user: User = Depends(require_permission("party.create")),
    db: AsyncSession = Depends(get_db)
):
    """Admin creates a new trade Area / Route"""
    client_ip = request.client.host if request.client else None
    return await create_area(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        payload=payload,
        client_ip=client_ip
    )


@router.get("/areas", response_model=List[AreaResponse])
async def get_areas(
    search: Optional[str] = Query(None, description="Search areas by name or code"),
    include_inactive: bool = Query(False, description="Include inactive areas"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all areas with party counts"""
    return await list_areas(
        db=db,
        tenant_id=current_user.tenant_id,
        search=search,
        include_inactive=include_inactive
    )


@router.put("/areas/{area_id}", response_model=AreaResponse)
async def edit_area(
    area_id: str,
    payload: AreaUpdateRequest,
    request: Request,
    current_user: User = Depends(require_permission("party.edit")),
    db: AsyncSession = Depends(get_db)
):
    """Admin updates an area"""
    client_ip = request.client.host if request.client else None
    return await update_area(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        area_id=area_id,
        payload=payload,
        client_ip=client_ip
    )


@router.delete("/areas/{area_id}")
async def remove_area(
    area_id: str,
    request: Request,
    current_user: User = Depends(require_permission("party.edit")),
    db: AsyncSession = Depends(get_db)
):
    """Admin deletes an area (detaches any assigned parties)"""
    client_ip = request.client.host if request.client else None
    return await delete_area(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        area_id=area_id,
        client_ip=client_ip
    )


# ==============================================================================
# Customer Endpoints
# ==============================================================================

@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def add_customer(
    payload: CustomerCreateRequest,
    request: Request,
    current_user: User = Depends(require_permission("party.create")),
    db: AsyncSession = Depends(get_db)
):
    """Create a customer (ADMIN ONLY)"""
    client_ip = request.client.host if request.client else None
    return await create_customer(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        payload=payload,
        client_ip=client_ip
    )


@router.get("/customers", response_model=List[CustomerResponse])
async def get_customers(
    search: Optional[str] = Query(None, description="Search by name, mobile, or GSTIN"),
    area_id: Optional[str] = Query(None, description="Filter customers by area"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List customers with optional search & area filter"""
    return await list_customers(
        db=db,
        tenant_id=current_user.tenant_id,
        search=search,
        area_id=area_id
    )


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def edit_customer(
    customer_id: str,
    payload: CustomerUpdateRequest,
    request: Request,
    current_user: User = Depends(require_permission("party.edit")),
    db: AsyncSession = Depends(get_db)
):
    """Update customer details (ADMIN ONLY)"""
    client_ip = request.client.host if request.client else None
    return await update_customer(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        customer_id=customer_id,
        payload=payload,
        client_ip=client_ip
    )


# ==============================================================================
# Supplier Endpoints
# ==============================================================================

@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def add_supplier(
    payload: SupplierCreateRequest,
    request: Request,
    current_user: User = Depends(require_permission("inventory.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Admin creates a supplier"""
    client_ip = request.client.host if request.client else None
    return await create_supplier(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        payload=payload,
        client_ip=client_ip
    )


@router.get("/suppliers", response_model=List[SupplierResponse])
async def get_suppliers(
    search: Optional[str] = Query(None, description="Search suppliers by name or mobile"),
    area_id: Optional[str] = Query(None, description="Filter suppliers by area"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List suppliers for tenant with area filter"""
    return await list_suppliers(
        db=db,
        tenant_id=current_user.tenant_id,
        search=search,
        area_id=area_id
    )


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def edit_supplier(
    supplier_id: str,
    payload: SupplierUpdateRequest,
    request: Request,
    current_user: User = Depends(require_permission("inventory.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Admin updates supplier details"""
    client_ip = request.client.host if request.client else None
    return await update_supplier(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        supplier_id=supplier_id,
        payload=payload,
        client_ip=client_ip
    )

