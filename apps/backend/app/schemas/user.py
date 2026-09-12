from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class UserCreateSubUserRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Staff member full name")
    mobile_number: str = Field(..., min_length=10, max_length=15, description="Staff 10-digit mobile number")
    email: Optional[str] = None
    pin: str = Field(..., min_length=4, max_length=6, description="4-6 digit numeric PIN for fast counter login")
    role_name: str = Field("sub_user", description="Assigned role: sub_user")


class UserResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    mobile_number: str
    email: Optional[str] = None
    role_id: str
    role_name: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserUpdateStatusRequest(BaseModel):
    is_active: bool
