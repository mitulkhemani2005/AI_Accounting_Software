from typing import List
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.user import UserCreateSubUserRequest, UserResponse, UserUpdateStatusRequest
from app.models.user import User
from app.api.deps import get_current_user, require_permission, require_module_entitlement
from app.services.user_service import create_sub_user, list_tenant_users, update_user_status

router = APIRouter()


@router.post("/sub-users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def add_sub_user(
    payload: UserCreateSubUserRequest,
    request: Request,
    current_user: User = Depends(require_permission("users.manage")),
    _entitled: User = Depends(require_module_entitlement("sub_users")),
    db: AsyncSession = Depends(get_db)
):
    """Admin creates a store sub-user (staff) with PIN for counter sales"""
    client_ip = request.client.host if request.client else None
    sub_user = await create_sub_user(
        db=db,
        tenant_id=current_user.tenant_id,
        admin_user_id=current_user.id,
        name=payload.name,
        mobile_number=payload.mobile_number,
        pin=payload.pin,
        email=payload.email,
        client_ip=client_ip
    )
    return UserResponse(
        id=sub_user.id,
        tenant_id=sub_user.tenant_id,
        name=sub_user.name,
        mobile_number=sub_user.mobile_number,
        email=sub_user.email,
        role_id=sub_user.role_id,
        role_name=sub_user.role.name if sub_user.role else "sub_user",
        is_active=sub_user.is_active,
        created_at=sub_user.created_at
    )


@router.get("", response_model=List[UserResponse])
async def get_all_users(
    current_user: User = Depends(require_permission("users.manage")),
    db: AsyncSession = Depends(get_db)
):
    """List all staff and admin users for current tenant"""
    users = await list_tenant_users(db, current_user.tenant_id)
    return [
        UserResponse(
            id=u.id,
            tenant_id=u.tenant_id,
            name=u.name,
            mobile_number=u.mobile_number,
            email=u.email,
            role_id=u.role_id,
            role_name=u.role.name if u.role else "sub_user",
            is_active=u.is_active,
            created_at=u.created_at
        )
        for u in users
    ]


@router.put("/{user_id}/status", response_model=UserResponse)
async def change_user_status(
    user_id: str,
    payload: UserUpdateStatusRequest,
    request: Request,
    current_user: User = Depends(require_permission("users.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Admin activates or deactivates a user's account"""
    client_ip = request.client.host if request.client else None
    updated_user = await update_user_status(
        db=db,
        tenant_id=current_user.tenant_id,
        admin_user_id=current_user.id,
        target_user_id=user_id,
        is_active=payload.is_active,
        client_ip=client_ip
    )
    return UserResponse(
        id=updated_user.id,
        tenant_id=updated_user.tenant_id,
        name=updated_user.name,
        mobile_number=updated_user.mobile_number,
        email=updated_user.email,
        role_id=updated_user.role_id,
        role_name=updated_user.role.name if updated_user.role else "sub_user",
        is_active=updated_user.is_active,
        created_at=updated_user.created_at
    )
