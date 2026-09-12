from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from fastapi import HTTPException, status
from app.models.item import Item
from app.schemas.item import ItemCreateRequest, ItemUpdateRequest
from app.services.audit_service import log_audit_event


async def create_item(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payload: ItemCreateRequest,
    client_ip: Optional[str] = None
) -> Item:
    """Create a new catalog item with optional SKU, Barcode, and HSN"""
    clean_sku = payload.sku.strip() if (payload.sku and payload.sku.strip()) else None
    clean_barcode = payload.barcode.strip() if (payload.barcode and payload.barcode.strip()) else None
    clean_hsn = payload.hsn_code.strip() if (payload.hsn_code and payload.hsn_code.strip()) else None

    # Check duplicate SKU in tenant if provided
    if clean_sku:
        existing_sku = await db.execute(
            select(Item).where(Item.tenant_id == tenant_id, Item.sku == clean_sku)
        )
        if existing_sku.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item with SKU '{clean_sku}' already exists"
            )

    # Check duplicate Barcode in tenant if provided
    if clean_barcode:
        existing_barcode = await db.execute(
            select(Item).where(Item.tenant_id == tenant_id, Item.barcode == clean_barcode)
        )
        if existing_barcode.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item with barcode '{clean_barcode}' already exists"
            )

    item = Item(
        tenant_id=tenant_id,
        name=payload.name.strip(),
        sku=clean_sku,
        barcode=clean_barcode,
        category=payload.category or "General",
        unit=(payload.unit or "PCS").upper(),
        sale_price=payload.sale_price,
        purchase_price=payload.purchase_price,
        gst_rate=payload.gst_rate,
        hsn_code=clean_hsn,
        min_stock_alert=payload.min_stock_alert,
        is_active=True
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="CREATE",
        entity_type="Item",
        entity_id=item.id,
        details={"name": item.name, "sale_price": item.sale_price, "barcode": item.barcode},
        ip_address=client_ip
    )

    return item


async def list_items(
    db: AsyncSession,
    tenant_id: str,
    search: Optional[str] = None,
    category: Optional[str] = None
) -> List[Item]:
    """List items for current tenant with optional keyword and category search"""
    query = select(Item).where(Item.tenant_id == tenant_id, Item.is_active == True)

    if category and category != "All":
        query = query.where(Item.category == category)

    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Item.name.ilike(term),
                Item.sku.ilike(term),
                Item.barcode.ilike(term),
                Item.hsn_code.ilike(term)
            )
        )

    query = query.order_by(Item.name.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_item_by_barcode(
    db: AsyncSession,
    tenant_id: str,
    barcode: str
) -> Optional[Item]:
    """Fast barcode scanner lookup"""
    result = await db.execute(
        select(Item).where(
            Item.tenant_id == tenant_id,
            Item.barcode == barcode.strip(),
            Item.is_active == True
        )
    )
    return result.scalar_one_or_none()


async def update_item(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    item_id: str,
    payload: ItemUpdateRequest,
    client_ip: Optional[str] = None
) -> Item:
    """Update item details"""
    result = await db.execute(
        select(Item).where(Item.tenant_id == tenant_id, Item.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "sku" in update_data:
        update_data["sku"] = update_data["sku"].strip() if (update_data["sku"] and update_data["sku"].strip()) else None
    if "barcode" in update_data:
        update_data["barcode"] = update_data["barcode"].strip() if (update_data["barcode"] and update_data["barcode"].strip()) else None
    if "hsn_code" in update_data:
        update_data["hsn_code"] = update_data["hsn_code"].strip() if (update_data["hsn_code"] and update_data["hsn_code"].strip()) else None

    for key, value in update_data.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="UPDATE",
        entity_type="Item",
        entity_id=item.id,
        details=update_data,
        ip_address=client_ip
    )

    return item


async def delete_item(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    item_id: str,
    client_ip: Optional[str] = None
) -> bool:
    """Soft delete / deactivate an item"""
    result = await db.execute(
        select(Item).where(Item.tenant_id == tenant_id, Item.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.is_active = False
    await db.commit()

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="DELETE",
        entity_type="Item",
        entity_id=item.id,
        details={"name": item.name},
        ip_address=client_ip
    )

    return True
