from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.party import (
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
    create_customer,
    list_customers,
    update_customer,
    create_supplier,
    list_suppliers,
)

router = APIRouter()


# Customer Endpoints
@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def add_customer(
    payload: CustomerCreateRequest,
    request: Request,
    current_user: User = Depends(require_permission("party.create")),
    db: AsyncSession = Depends(get_db)
):
    """Create a customer (ADMIN ONLY - Staff cannot add new customers)"""
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List customers with optional search filter (available for billing selection)"""
    return await list_customers(
        db=db,
        tenant_id=current_user.tenant_id,
        search=search
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


# Supplier Endpoints
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List suppliers for tenant"""
    return await list_suppliers(
        db=db,
        tenant_id=current_user.tenant_id,
        search=search
    )
