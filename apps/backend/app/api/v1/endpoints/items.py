from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.item import ItemCreateRequest, ItemUpdateRequest, ItemResponse
from app.models.user import User
from app.api.deps import get_current_user, require_permission, require_module_entitlement
from app.services.item_service import (
    create_item,
    list_items,
    get_item_by_barcode,
    update_item,
    delete_item,
)

router = APIRouter()


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def add_item(
    payload: ItemCreateRequest,
    request: Request,
    current_user: User = Depends(require_permission("inventory.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Admin creates a new catalog item"""
    client_ip = request.client.host if request.client else None
    return await create_item(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        payload=payload,
        client_ip=client_ip
    )


@router.get("", response_model=List[ItemResponse])
async def get_items(
    search: Optional[str] = Query(None, description="Search by name, SKU, or barcode"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List catalog items (accessible to Admin & POS staff)"""
    return await list_items(
        db=db,
        tenant_id=current_user.tenant_id,
        search=search,
        category=category
    )


@router.get("/barcode/{barcode}", response_model=Optional[ItemResponse])
async def lookup_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fast barcode scanner lookup for POS counter billing"""
    return await get_item_by_barcode(
        db=db,
        tenant_id=current_user.tenant_id,
        barcode=barcode
    )


@router.put("/{item_id}", response_model=ItemResponse)
async def edit_item(
    item_id: str,
    payload: ItemUpdateRequest,
    request: Request,
    current_user: User = Depends(require_permission("inventory.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Admin updates item information"""
    client_ip = request.client.host if request.client else None
    return await update_item(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        item_id=item_id,
        payload=payload,
        client_ip=client_ip
    )


@router.delete("/{item_id}", status_code=status.HTTP_200_OK)
async def remove_item(
    item_id: str,
    request: Request,
    current_user: User = Depends(require_permission("inventory.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Admin deactivates / deletes an item"""
    client_ip = request.client.host if request.client else None
    await delete_item(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        item_id=item_id,
        client_ip=client_ip
    )
    return {"message": "Item deleted successfully"}
