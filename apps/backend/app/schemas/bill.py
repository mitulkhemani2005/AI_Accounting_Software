from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class BillItemInput(BaseModel):
    item_id: Optional[str] = None
    item_name: str = Field(..., min_length=1, max_length=255)
    hsn_code: Optional[str] = None
    quantity: float = Field(..., gt=0)
    unit: str = Field("PCS", max_length=20)
    rate: float = Field(..., ge=0)
    discount_amount: float = Field(0.0, ge=0)
    gst_rate: float = Field(..., ge=0, le=100)


class BillCreateRequest(BaseModel):
    type: str = Field("sale", description="sale, purchase, credit_note, debit_note")
    party_id: Optional[str] = None
    party_name: str = Field("Cash Customer", min_length=1, max_length=200)
    party_mobile: Optional[str] = None
    party_gst: Optional[str] = None
    is_interstate: bool = Field(False, description="True for IGST, False for CGST+SGST")
    discount_amount: float = Field(0.0, ge=0)
    payment_mode: str = Field("cash", description="cash, upi, card, credit, split")
    payment_status: str = Field("paid", description="paid, partial, unpaid")
    paid_amount: Optional[float] = None
    notes: Optional[str] = None
    offline_sync_id: Optional[str] = Field(None, description="Client-generated UUID for offline idempotency")
    items: List[BillItemInput] = Field(..., min_length=1)


class BillUpdateRequest(BaseModel):
    party_name: Optional[str] = None
    party_mobile: Optional[str] = None
    payment_mode: Optional[str] = None
    payment_status: Optional[str] = None
    paid_amount: Optional[float] = None
    status: Optional[str] = Field(None, description="active, void")
    notes: Optional[str] = None


class BillItemResponse(BaseModel):
    id: str
    item_id: Optional[str] = None
    item_name: str
    hsn_code: Optional[str] = None
    quantity: float
    unit: str
    rate: float
    discount_amount: float
    gst_rate: float
    taxable_amount: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    total_amount: float

    model_config = ConfigDict(from_attributes=True)


class BillResponse(BaseModel):
    id: str
    tenant_id: str
    bill_number: str
    type: str
    party_id: Optional[str] = None
    party_name: str
    party_mobile: Optional[str] = None
    party_gst: Optional[str] = None
    is_interstate: bool
    created_by_user_id: str
    creator_name: Optional[str] = None
    creator_role: Optional[str] = None
    subtotal: float
    discount_amount: float
    taxable_amount: float
    gst_amount: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    round_off: float
    total_amount: float
    payment_mode: str
    payment_status: str
    paid_amount: float
    offline_sync_id: Optional[str] = None
    status: str
    is_reviewed_by_admin: bool
    notes: Optional[str] = None
    created_at: datetime
    items: List[BillItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OfflineSyncBatchRequest(BaseModel):
    bills: List[BillCreateRequest] = Field(..., min_length=1)


class OfflineSyncBatchResponse(BaseModel):
    synced_count: int
    failed_count: int
    synced_bills: List[BillResponse]
    errors: List[Dict[str, Any]] = []
