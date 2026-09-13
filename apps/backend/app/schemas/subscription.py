from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class PlanFeature(BaseModel):
    name: str
    included: bool
    highlight: Optional[str] = None


class SubscriptionPlan(BaseModel):
    id: str  # "free", "standard", "enterprise"
    name: str
    tagline: str
    price_monthly: float
    price_yearly: float
    is_popular: bool = False
    bills_limit_per_month: Optional[int] = None
    features: List[PlanFeature]


class SubscriptionPlansResponse(BaseModel):
    plans: List[SubscriptionPlan]


class CreateOrderRequest(BaseModel):
    plan_id: str = Field(..., description="'standard' or 'enterprise'")
    billing_cycle: str = Field("monthly", description="'monthly' or 'yearly'")


class CreateOrderResponse(BaseModel):
    order_id: str
    key_id: str
    amount: int  # in paise
    currency: str = "INR"
    plan_id: str
    plan_name: str
    billing_cycle: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str
    billing_cycle: str = "monthly"


class VerifyPaymentResponse(BaseModel):
    success: bool
    message: str
    subscription_tier: str
    is_active: bool
    expires_at: Optional[datetime] = None


class ModuleEntitlementStatus(BaseModel):
    module_name: str
    active: bool
    expires_at: Optional[datetime] = None


class SubscriptionUsageResponse(BaseModel):
    tenant_id: str
    business_name: str
    subscription_tier: str
    is_active: bool
    bills_this_month: int
    bills_limit: Optional[int] = None
    is_limit_reached: bool = False
    billing_cycle_start: str
    billing_cycle_end: str
    expires_at: Optional[datetime] = None
    entitlements: List[ModuleEntitlementStatus] = []


class CSVImportRowError(BaseModel):
    row_number: int
    error: str
    raw_data: Optional[Dict[str, Any]] = None


class CSVImportSummaryResponse(BaseModel):
    entity_type: str
    total_rows: int
    success_count: int
    failed_count: int
    errors: List[CSVImportRowError] = []
    message: str
