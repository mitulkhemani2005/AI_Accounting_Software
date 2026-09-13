from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from datetime import datetime


# ==============================================================================
# Area Schemas
# ==============================================================================

class AreaCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = Field(None, max_length=255)


class AreaUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class AreaResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    customers_count: Optional[int] = 0
    suppliers_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Customer Schemas
# ==============================================================================

class CustomerCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    mobile: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = Field(None, max_length=15)
    state: str = Field("Maharashtra", max_length=50)
    address: Optional[str] = None
    area_id: Optional[str] = None
    opening_balance: float = Field(0.0)


class CustomerUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    area_id: Optional[str] = None
    opening_balance: Optional[float] = None


class CustomerResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    mobile: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    state: str
    address: Optional[str] = None
    area_id: Optional[str] = None
    area_name: Optional[str] = None
    opening_balance: float
    current_balance: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Supplier Schemas
# ==============================================================================

class SupplierCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    mobile: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = Field(None, max_length=15)
    state: str = Field("Maharashtra", max_length=50)
    address: Optional[str] = None
    area_id: Optional[str] = None
    opening_balance: float = Field(0.0)


class SupplierUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    area_id: Optional[str] = None
    opening_balance: Optional[float] = None


class SupplierResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    mobile: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    state: str
    address: Optional[str] = None
    area_id: Optional[str] = None
    area_name: Optional[str] = None
    opening_balance: float
    current_balance: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Payment & Ledger Schemas
# ==============================================================================

class PaymentCreateRequest(BaseModel):
    party_type: str = Field(..., description="customer or supplier")
    party_id: str = Field(..., min_length=1)
    payment_type: str = Field("payment_in", description="payment_in (receipt) or payment_out (voucher)")
    amount: float = Field(..., gt=0)
    payment_mode: str = Field("cash", description="cash, upi, bank_transfer, cheque, card")
    reference_number: Optional[str] = Field(None, max_length=100)
    payment_date: Optional[datetime] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: str
    tenant_id: str
    party_type: str
    party_id: str
    party_name: Optional[str] = None
    payment_type: str
    amount: float
    payment_mode: str
    reference_number: Optional[str] = None
    payment_date: datetime
    notes: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PartyLedgerEntry(BaseModel):
    id: str
    date: datetime
    type: str  # opening_balance, sale_invoice, purchase_invoice, payment_in, payment_out, bill_void
    type_label: str
    reference_no: str
    description: str
    payment_mode: Optional[str] = None
    debit: float = 0.0
    credit: float = 0.0
    running_balance: float = 0.0


class PartyLedgerResponse(BaseModel):
    party_id: str
    party_name: str
    party_type: str  # customer or supplier
    mobile: Optional[str] = None
    gst_number: Optional[str] = None
    area_name: Optional[str] = None
    opening_balance: float
    total_invoiced: float
    total_paid: float
    current_balance: float
    transactions: List[PartyLedgerEntry]


