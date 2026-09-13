from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user, require_permission
from app.models.user import User
from app.schemas.subscription import (
    SubscriptionPlansResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
    SubscriptionUsageResponse,
)
from app.services.subscription_service import (
    get_available_plans,
    get_tenant_subscription_usage,
    create_razorpay_order,
    verify_and_activate_subscription,
)

router = APIRouter()


@router.get(
    "/plans",
    response_model=SubscriptionPlansResponse,
    summary="List all available subscription plans & pricing",
)
async def list_subscription_plans():
    """Returns Free, Standard (₹499/mo), and Enterprise (₹999/mo) plan features."""
    return get_available_plans()


@router.get(
    "/usage",
    response_model=SubscriptionUsageResponse,
    summary="Get live monthly bill consumption, limits, and active entitlements",
)
async def get_subscription_usage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns bills used this month, remaining free-tier capacity, current tier, and active modules.
    """
    return await get_tenant_subscription_usage(
        db=db,
        tenant_id=current_user.tenant_id,
    )


@router.post(
    "/create-order",
    response_model=CreateOrderResponse,
    summary="Create Razorpay Subscription Order",
)
async def create_subscription_order(
    payload: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("tenant.manage")),
):
    """
    Creates a Razorpay checkout order for the chosen tier and billing cycle.
    """
    return await create_razorpay_order(
        db=db,
        tenant_id=current_user.tenant_id,
        plan_id=payload.plan_id,
        billing_cycle=payload.billing_cycle,
    )


@router.post(
    "/verify-payment",
    response_model=VerifyPaymentResponse,
    summary="Verify Razorpay Payment Signature and Auto-Activate Plan",
)
async def verify_subscription_payment(
    payload: VerifyPaymentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("tenant.manage")),
):
    """
    Verifies Razorpay HMAC signature, upgrades tenant subscription tier,
    extends expiration date, and activates all module entitlements.
    """
    client_ip = request.client.host if request.client else None
    return await verify_and_activate_subscription(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        payload=payload,
        client_ip=client_ip,
    )
