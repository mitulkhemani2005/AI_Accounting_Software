from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user, require_permission, require_module_entitlement
from app.models.user import User
from app.schemas.inventory import (
    GodownCreate,
    GodownUpdate,
    GodownResponse,
    StockInRequest,
    StockAdjustmentRequest,
    StockTransferCreate,
    StockTransferResponse,
    StockMovementResponse,
    ItemStockSummaryResponse,
    InventoryMetricsResponse,
    LowStockAlertItem,
    ExpiringBatchAlertItem,
)
from app.services.inventory_service import (
    get_or_create_default_godown,
    list_godowns,
    create_godown,
    update_godown,
    record_stock_in,
    adjust_stock,
    transfer_stock_between_godowns,
    list_stock_transfers,
    get_inventory_metrics,
    get_stock_summary,
    get_stock_movements_ledger,
    get_low_stock_alerts,
    get_expiring_batches_alerts,
)

router = APIRouter()


# --- Godowns ---
@router.get("/godowns", response_model=List[GodownResponse])
async def get_godowns_list(
    active_only: bool = Query(False, description="Filter active only"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all warehouses/godowns for tenant"""
    # Ensure default godown exists
    await get_or_create_default_godown(db, current_user.tenant_id)
    return await list_godowns(db=db, tenant_id=current_user.tenant_id, active_only=active_only)


@router.post("/godowns", response_model=GodownResponse, status_code=status.HTTP_201_CREATED)
async def create_new_godown(
    payload: GodownCreate,
    request: Request,
    current_user: User = Depends(require_permission("item.create")),
    db: AsyncSession = Depends(get_db)
):
    """Admin creates a new warehouse / branch location"""
    client_ip = request.client.host if request.client else None
    return await create_godown(
        db=db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        payload=payload,
        client_ip=client_ip
    )


@router.put("/godowns/{godown_id}", response_model=GodownResponse)
async def update_existing_godown(
    godown_id: str,
    payload: GodownUpdate,
    request: Request,
    current_user: User = Depends(require_permission("item.edit")),
    db: AsyncSession = Depends(get_db)
):
    """Admin updates godown location details or sets default"""
    client_ip = request.client.host if request.client else None
    return await update_godown(
        db=db,
        tenant_id=current_user.tenant_id,
        godown_id=godown_id,
        user=current_user,
        payload=payload,
        client_ip=client_ip
    )


# --- Metrics & Summary ---
@router.get("/metrics", response_model=InventoryMetricsResponse)
async def get_inventory_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get high-level inventory metrics: total valuation, low stock count, expiring count"""
    await get_or_create_default_godown(db, current_user.tenant_id)
    return await get_inventory_metrics(db=db, tenant_id=current_user.tenant_id)


@router.get("/stock", response_model=List[ItemStockSummaryResponse])
@router.get("/summary", response_model=List[ItemStockSummaryResponse])
async def get_stock_overview(
    godown_id: Optional[str] = Query(None, description="Filter by Godown ID"),
    search: Optional[str] = Query(None, description="Search item name, SKU, or barcode"),
    category: Optional[str] = Query(None, description="Filter by Category"),
    low_stock_only: bool = Query(False, description="Filter items at or below minimum threshold"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get item-level stock summary with godown breakdown and active batches"""
    await get_or_create_default_godown(db, current_user.tenant_id)
    return await get_stock_summary(
        db=db,
        tenant_id=current_user.tenant_id,
        godown_id=godown_id,
        search=search,
        category=category,
        low_stock_only=low_stock_only
    )


# --- Stock In & Adjustments ---
@router.post("/stock-in", status_code=status.HTTP_200_OK)
async def stock_in_purchase(
    payload: StockInRequest,
    request: Request,
    current_user: User = Depends(require_permission("item.create")),
    db: AsyncSession = Depends(get_db)
):
    """Record incoming purchase goods or GRN restock"""
    client_ip = request.client.host if request.client else None
    return await record_stock_in(
        db=db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        payload=payload,
        client_ip=client_ip
    )


@router.post("/adjust", status_code=status.HTTP_200_OK)
async def adjust_item_stock(
    payload: StockAdjustmentRequest,
    request: Request,
    current_user: User = Depends(require_permission("item.edit")),
    db: AsyncSession = Depends(get_db)
):
    """Admin performs manual stock adjustment (wastage, physical count correction)"""
    client_ip = request.client.host if request.client else None
    return await adjust_stock(
        db=db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        payload=payload,
        client_ip=client_ip
    )


# --- Transfers ---
@router.post("/transfers", response_model=StockTransferResponse, status_code=status.HTTP_201_CREATED)
async def transfer_stock(
    payload: StockTransferCreate,
    request: Request,
    current_user: User = Depends(require_permission("item.create")),
    _entitled: User = Depends(require_module_entitlement("transfers")),
    db: AsyncSession = Depends(get_db)
):
    """Transfer stock between two godowns with atomic deduction & addition"""
    client_ip = request.client.host if request.client else None
    return await transfer_stock_between_godowns(
        db=db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        payload=payload,
        client_ip=client_ip
    )


@router.get("/transfers", response_model=List[StockTransferResponse])
async def get_transfer_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    _entitled: User = Depends(require_module_entitlement("transfers")),
    db: AsyncSession = Depends(get_db)
):
    """List recent stock transfer logs"""
    return await list_stock_transfers(db=db, tenant_id=current_user.tenant_id, limit=limit)


# --- Movements / Ledger ---
@router.get("/movements", response_model=List[StockMovementResponse])
async def get_movements_ledger(
    item_id: Optional[str] = Query(None, description="Filter by Item ID"),
    godown_id: Optional[str] = Query(None, description="Filter by Godown ID"),
    movement_type: Optional[str] = Query(None, description="sale_out, purchase_in, transfer_in, etc."),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Audit ledger of all stock ins, outs, transfers, and adjustments"""
    return await get_stock_movements_ledger(
        db=db,
        tenant_id=current_user.tenant_id,
        item_id=item_id,
        godown_id=godown_id,
        movement_type=movement_type,
        limit=limit
    )


# --- Alerts ---
@router.get("/alerts/low-stock", response_model=List[LowStockAlertItem])
async def get_low_stock_alert_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all items currently below minimum stock alert threshold"""
    return await get_low_stock_alerts(db=db, tenant_id=current_user.tenant_id)


@router.get("/alerts/expiring", response_model=List[ExpiringBatchAlertItem])
async def get_expiring_batches_alert_items(
    days: int = Query(60, ge=1, le=365, description="Expiry threshold in days"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List batches expired or expiring within threshold days"""
    return await get_expiring_batches_alerts(db=db, tenant_id=current_user.tenant_id, days_threshold=days)
