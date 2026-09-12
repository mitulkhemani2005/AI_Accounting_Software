from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.schemas.auth import (
    SignupAdminRequest,
    LoginAdminRequest,
    LoginStaffRequest,
    TokenResponse,
    UserProfileResponse
)
from app.services.tenant_service import create_tenant_with_admin
from app.services.auth_service import (
    authenticate_admin,
    authenticate_staff_pin,
    get_user_permissions,
    get_tenant_entitlements
)
from app.models.tenant import Tenant
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/signup-admin", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup_admin(
    payload: SignupAdminRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Register business tenant + admin user and seed permissions & entitlements"""
    # Check if admin mobile number already exists globally
    existing = await db.execute(
        select(User).where(User.mobile_number == payload.mobile_number.strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this mobile number is already registered"
        )

    client_ip = request.client.host if request.client else None
    tenant, admin_user = await create_tenant_with_admin(
        db=db,
        business_name=payload.business_name,
        gst_number=payload.gst_number,
        admin_name=payload.admin_name,
        mobile_number=payload.mobile_number,
        email=payload.email,
        password=payload.password,
        pin=payload.pin,
        client_ip=client_ip
    )

    auth_data = await authenticate_admin(
        db=db,
        login_identifier=admin_user.mobile_number,
        password=payload.password,
        client_ip=client_ip
    )
    return auth_data


@router.post("/login-admin", response_model=TokenResponse)
async def login_admin(
    payload: LoginAdminRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Admin login via Email or Mobile Number and password"""
    client_ip = request.client.host if request.client else None
    return await authenticate_admin(
        db=db,
        login_identifier=payload.login_identifier,
        password=payload.password,
        client_ip=client_ip
    )


@router.post("/login-staff", response_model=TokenResponse)
async def login_staff(
    payload: LoginStaffRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Sub-user / Staff quick POS login via registered mobile number and 4-6 digit PIN"""
    client_ip = request.client.host if request.client else None
    return await authenticate_staff_pin(
        db=db,
        mobile_number=payload.mobile_number,
        pin=payload.pin,
        tenant_id=payload.tenant_id,
        client_ip=client_ip
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile, role, permissions, and tenant details"""
    permissions = await get_user_permissions(db, current_user)
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_res.scalar_one()

    return UserProfileResponse(
        id=current_user.id,
        tenant_id=current_user.tenant_id,
        name=current_user.name,
        mobile_number=current_user.mobile_number,
        email=current_user.email,
        role=current_user.role.name if current_user.role else "unknown",
        permissions=permissions,
        tenant_name=tenant.business_name,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )
