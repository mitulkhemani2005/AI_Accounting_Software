from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class ModuleEntitlementResponse(BaseModel):
    module_name: str
    active: bool
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TenantResponse(BaseModel):
    id: str
    business_name: str
    gst_number: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    terms_conditions: Optional[str] = None
    subscription_tier: str
    is_active: bool
    created_at: datetime
    entitlements: List[ModuleEntitlementResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TenantUpdateRequest(BaseModel):
    business_name: Optional[str] = Field(None, min_length=2, max_length=255)
    gst_number: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    terms_conditions: Optional[str] = None
