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

