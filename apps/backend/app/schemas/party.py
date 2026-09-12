from typing import Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from datetime import datetime


class CustomerCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    mobile: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = Field(None, max_length=15)
    state: str = Field("Maharashtra", max_length=50)
    address: Optional[str] = None
    opening_balance: float = Field(0.0)


class CustomerUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
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
    opening_balance: float
    current_balance: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupplierCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    mobile: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = Field(None, max_length=15)
    state: str = Field("Maharashtra", max_length=50)
    address: Optional[str] = None
    opening_balance: float = Field(0.0)


class SupplierUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
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
    opening_balance: float
    current_balance: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
