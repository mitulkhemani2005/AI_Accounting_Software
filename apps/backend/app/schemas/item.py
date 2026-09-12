from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class ItemCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    sku: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    category: str = Field("General", max_length=100)
    unit: str = Field("PCS", max_length=20)
    sale_price: float = Field(..., ge=0)
    purchase_price: float = Field(0.0, ge=0)
    gst_rate: float = Field(18.0, ge=0, le=100)
    hsn_code: Optional[str] = Field(None, max_length=20)
    min_stock_alert: float = Field(5.0, ge=0)


class ItemUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    sale_price: Optional[float] = Field(None, ge=0)
    purchase_price: Optional[float] = Field(None, ge=0)
    gst_rate: Optional[float] = Field(None, ge=0, le=100)
    hsn_code: Optional[str] = None
    min_stock_alert: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ItemResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category: str
    unit: str
    sale_price: float
    purchase_price: float
    gst_rate: float
    hsn_code: Optional[str] = None
    min_stock_alert: float
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
