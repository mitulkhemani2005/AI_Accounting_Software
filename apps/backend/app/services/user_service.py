from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.user import User, Role
from app.models.tenant import Tenant
from app.core.security import get_pin_hash, get_password_hash
from app.services.audit_service import log_audit_event
from app.services.tenant_service import seed_roles_and_permissions


async def create_sub_user(
    db: AsyncSession,
    tenant_id: str,
    admin_user_id: str,
    name: str,
    mobile_number: str,
    pin: str,
    email: Optional[str] = None,
    client_ip: Optional[str] = None
) -> User:
    """Admin creates a staff sub-user with add-only billing permissions and PIN"""
    # 1. Ensure sub_user role exists
    _, sub_user_role = await seed_roles_and_permissions(db)

    # 2. Check duplicate mobile in tenant
    existing_res = await db.execute(
        select(User).where(
            User.tenant_id == tenant_id,
            User.mobile_number == mobile_number
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A staff member with this mobile number already exists in your business"
        )

    # 3. Create Sub-user
    sub_user = User(
        tenant_id=tenant_id,
        name=name,
        mobile_number=mobile_number,
        email=email,
        role_id=sub_user_role.id,
        pin_hash=get_pin_hash(pin),
        is_active=True
    )
    db.add(sub_user)
    await db.commit()
    await db.refresh(sub_user)

    # 4. Audit Log
    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=admin_user_id,
        action="CREATE",
        entity_type="SubUser",
        entity_id=sub_user.id,
        details={"name": name, "mobile_number": mobile_number, "role": "sub_user"},
        ip_address=client_ip
    )

    return sub_user


async def list_tenant_users(db: AsyncSession, tenant_id: str) -> List[User]:
    """List all users belonging to a tenant"""
    result = await db.execute(
        select(User).where(User.tenant_id == tenant_id).order_by(User.created_at.desc())
    )
    return list(result.scalars().all())


async def update_user_status(
    db: AsyncSession,
    tenant_id: str,
    admin_user_id: str,
    target_user_id: str,
    is_active: bool,
    client_ip: Optional[str] = None
) -> User:
    """Admin activates or deactivates a user"""
    result = await db.execute(
        select(User).where(User.tenant_id == tenant_id, User.id == target_user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in your business"
        )

    if user.id == admin_user_id and not is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin cannot deactivate their own account"
        )

    user.is_active = is_active
    await db.commit()
    await db.refresh(user)

    await log_audit_event(
        db=db,
        tenant_id=tenant_id,
        user_id=admin_user_id,
        action="UPDATE_STATUS",
        entity_type="User",
        entity_id=user.id,
        details={"is_active": is_active},
        ip_address=client_ip
    )

    return user
