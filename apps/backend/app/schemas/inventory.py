from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict


# --- Godown Schemas ---
class GodownBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    is_default: bool = False
    is_active: bool = True


class GodownCreate(GodownBase):
    pass


class GodownUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class GodownResponse(GodownBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Batch Schemas ---
class StockBatchResponse(BaseModel):
    id: str
    godown_id: str
    item_id: str
    batch_number: str
    expiry_date: Optional[date] = None
    manufacturing_date: Optional[date] = None
    purchase_price: float = 0.0
    mrp: Optional[float] = None
    sale_price: Optional[float] = None
    quantity: float = 0.0
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


# --- Stock & Summary Schemas ---
class StockResponse(BaseModel):
    id: str
    tenant_id: str
    godown_id: str
    godown_name: Optional[str] = None
    item_id: str
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    item_category: Optional[str] = None
    unit: str = "PCS"
    quantity: float = 0.0
    sale_price: float = 0.0
    purchase_price: float = 0.0
    min_stock_alert: float = 5.0
    is_low_stock: bool = False
    last_restocked_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ItemStockSummaryResponse(BaseModel):
    item_id: str
    item_name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category: str
    unit: str
    secondary_unit: Optional[str] = "CS"
    units_per_case: float = 1.0
    total_cases: Optional[float] = None
    sale_price: float
    purchase_price: float
    total_quantity: float
    total_valuation_cost: float
    total_valuation_sale: float
    min_stock_alert: float
    is_low_stock: bool
    is_out_of_stock: bool
    godown_breakdown: List[dict]
    active_batches: List[StockBatchResponse]


class InventoryMetricsResponse(BaseModel):
    total_items_count: int
    total_stock_units: float
    total_inventory_valuation_cost: float
    total_inventory_valuation_sale: float
    low_stock_items_count: int
    out_of_stock_items_count: int
    expiring_soon_batches_count: int
    active_godowns_count: int


# --- Stock-In / Purchase Entry ---
class StockInItemRequest(BaseModel):
    item_id: str
    quantity: float = Field(..., gt=0)
    unit: Optional[str] = "EA"  # "EA" or "CS"
    cases: Optional[float] = None
    purchase_price: Optional[float] = 0.0
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    manufacturing_date: Optional[date] = None
    mrp: Optional[float] = None
    sale_price: Optional[float] = None


class StockInRequest(BaseModel):
    godown_id: Optional[str] = None  # If None, use default godown
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    payment_mode: Optional[str] = "credit"  # "credit", "cash", "bank_transfer", "upi", "cheque"
    paid_amount: Optional[float] = 0.0
    payment_status: Optional[str] = None  # "paid", "partial", "unpaid" (auto-computed if None)
    items: List[StockInItemRequest]
    notes: Optional[str] = None


# --- Manual Stock Adjustment ---
class StockAdjustmentRequest(BaseModel):
    item_id: str
    godown_id: Optional[str] = None
    adjustment_type: str = Field(..., pattern="^(add|subtract|set)$")
    quantity: float = Field(..., ge=0)
    batch_number: Optional[str] = None
    reason: str = Field(..., min_length=2)
    notes: Optional[str] = None


# --- Stock Transfer Schemas ---
class StockTransferItemRequest(BaseModel):
    item_id: str
    quantity: float = Field(..., gt=0)
    batch_number: Optional[str] = None
    unit: str = "PCS"
    notes: Optional[str] = None


class StockTransferCreate(BaseModel):
    from_godown_id: str
    to_godown_id: str
    items: List[StockTransferItemRequest]
    notes: Optional[str] = None


class StockTransferItemResponse(BaseModel):
    id: str
    item_id: str
    item_name: Optional[str] = None
    batch_number: Optional[str] = None
    quantity: float
    unit: str
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class StockTransferResponse(BaseModel):
    id: str
    tenant_id: str
    transfer_number: str
    from_godown_id: str
    from_godown_name: Optional[str] = None
    to_godown_id: str
    to_godown_name: Optional[str] = None
    status: str
    transfer_date: datetime
    notes: Optional[str] = None
    created_by_name: Optional[str] = None
    items: List[StockTransferItemResponse]
    model_config = ConfigDict(from_attributes=True)


# --- Stock Movement / Ledger ---
class StockMovementResponse(BaseModel):
    id: str
    tenant_id: str
    created_at: datetime
    godown_id: str
    godown_name: Optional[str] = None
    item_id: str
    item_name: Optional[str] = None
    item_unit: str = "PCS"
    movement_type: str
    quantity: float
    balance_after: float
    cost_per_unit: float
    reference_type: str
    reference_id: Optional[str] = None
    batch_number: Optional[str] = None
    notes: Optional[str] = None
    performed_by_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# --- Alert Schemas ---
class LowStockAlertItem(BaseModel):
    item_id: str
    item_name: str
    sku: Optional[str] = None
    category: str
    unit: str
    total_quantity: float
    min_stock_alert: float
    status: str  # "LOW_STOCK" | "OUT_OF_STOCK"
    godown_distribution: List[dict]


class ExpiringBatchAlertItem(BaseModel):
    batch_id: str
    item_id: str
    item_name: str
    godown_name: str
    batch_number: str
    expiry_date: date
    days_to_expiry: int
    quantity: float
    unit: str
    status: str  # "EXPIRED" | "EXPIRING_SOON"
