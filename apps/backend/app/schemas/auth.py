from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime


class SignupAdminRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=255, description="Registered legal / trade name")
    gst_number: Optional[str] = Field(None, max_length=15, description="15-digit Indian GSTIN")
    admin_name: str = Field(..., min_length=2, max_length=150, description="Owner / Admin full name")
    mobile_number: str = Field(..., min_length=10, max_length=15, description="10-digit Indian mobile number")
    email: Optional[EmailStr] = Field(None, description="Admin email address")
    password: str = Field(..., min_length=6, max_length=100, description="Secure account password")
    pin: Optional[str] = Field(None, min_length=4, max_length=6, description="Optional 4-6 digit quick POS PIN")


class LoginAdminRequest(BaseModel):
    login_identifier: str = Field(..., description="Mobile number or Email")
    password: str = Field(..., description="Password")


class LoginStaffRequest(BaseModel):
    tenant_id: Optional[str] = Field(None, description="Tenant ID (optional if mobile number is globally mapped or provided in sub-domain/header)")
    mobile_number: str = Field(..., description="Staff registered 10-digit mobile number")
    pin: str = Field(..., min_length=4, max_length=6, description="Staff 4-6 digit quick PIN")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: Dict[str, Any]
    tenant: Dict[str, Any]
    permissions: List[str]
    entitlements: List[str]


class UserProfileResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    mobile_number: str
    email: Optional[str] = None
    role: str
    permissions: List[str]
    tenant_name: str
    is_active: bool
    created_at: datetime
