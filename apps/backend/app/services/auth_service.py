from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from fastapi import HTTPException, status
from sqlalchemy.orm import selectinload
from app.models.user import User, Role, Permission
from app.models.tenant import Tenant, ModuleEntitlement
from app.core.security import verify_password, verify_pin, create_access_token
from app.services.audit_service import log_audit_event


async def get_user_permissions(db: AsyncSession, user: User) -> List[str]:
    """Fetch list of permission name strings for user's role"""
    role = user.role
    if not role and user.role_id:
        result = await db.execute(select(Role).options(selectinload(Role.permissions)).where(Role.id == user.role_id))
        role = result.scalar_one_or_none()
    
    if not role:
        return []
    
    if role.name == "admin":
        perm_res = await db.execute(select(Permission))
        all_perms = perm_res.scalars().all()
        return [p.name for p in all_perms]
    
    if not role.permissions:
        role_res = await db.execute(select(Role).options(selectinload(Role.permissions)).where(Role.id == role.id))
        loaded_role = role_res.scalar_one_or_none()
        if loaded_role and loaded_role.permissions:
            return [p.name for p in loaded_role.permissions]
        return []
    
    return [p.name for p in role.permissions]


async def get_tenant_entitlements(db: AsyncSession, tenant_id: str) -> List[str]:
    """Fetch list of active module names for tenant based on tier and active entitlements"""
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    tier = (tenant.subscription_tier or "free").lower() if tenant else "free"

    result = await db.execute(
        select(ModuleEntitlement).where(
            ModuleEntitlement.tenant_id == tenant_id,
            ModuleEntitlement.active == True
        )
    )
    entitlements = set(e.module_name for e in result.scalars().all())

    # Tier-based capabilities & active database entitlements
    if tier in ["enterprise", "enterprise_pro", "all_in_one_trial", "standard", "standard_business", "pro"]:
        entitlements.update([
            "billing_pos", "inventory", "parties", "accounting",
            "outstanding_reports", "gst_compliance", "transfers",
            "sub_users", "staff_management", "ai_suggestions", "audit_trail"
        ])
    else:  # free tier
        entitlements.update(["billing_pos", "inventory", "parties"])

    return list(entitlements)


async def authenticate_admin(
    db: AsyncSession,
    login_identifier: str,
    password: str,
    client_ip: Optional[str] = None
) -> Dict[str, Any]:
    """Authenticate Admin via email or mobile number + password"""
    result = await db.execute(
        select(User).where(
            or_(
                User.email == login_identifier.strip(),
                User.mobile_number == login_identifier.strip()
            )
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/mobile or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact support."
        )

    if not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/mobile or password"
        )

    # Fetch permissions & entitlements
    permissions = await get_user_permissions(db, user)
    entitlements = await get_tenant_entitlements(db, user.tenant_id)

    # Fetch tenant details
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = tenant_res.scalar_one()

    # Generate JWT
    token = create_access_token(
        subject=user.id,
        tenant_id=user.tenant_id,
        role=user.role.name if user.role else "admin",
        permissions=permissions
    )

    await log_audit_event(
        db=db,
        tenant_id=user.tenant_id,
        user_id=user.id,
        action="LOGIN",
        entity_type="Auth",
        entity_id=user.id,
        details={"login_type": "admin_password"},
        ip_address=client_ip
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_seconds": 86400,
        "user": {
            "id": user.id,
            "name": user.name,
            "mobile_number": user.mobile_number,
            "email": user.email,
            "role": user.role.name if user.role else "admin"
        },
        "tenant": {
            "id": tenant.id,
            "business_name": tenant.business_name,
            "gst_number": tenant.gst_number,
            "subscription_tier": tenant.subscription_tier
        },
        "permissions": permissions,
        "entitlements": entitlements
    }


async def authenticate_staff_pin(
    db: AsyncSession,
    mobile_number: str,
    pin: str,
    tenant_id: Optional[str] = None,
    client_ip: Optional[str] = None
) -> Dict[str, Any]:
    """Authenticate Staff / Sub-user via mobile number + PIN"""
    query = select(User).where(User.mobile_number == mobile_number.strip())
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)

    result = await db.execute(query)
    users = list(result.scalars().all())

    if not users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Staff member not found with this mobile number"
        )

    # Find matching user by PIN
    authenticated_user = None
    for u in users:
        if u.pin_hash and verify_pin(pin, u.pin_hash):
            authenticated_user = u
            break

    if not authenticated_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect PIN"
        )

    if not authenticated_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff account is deactivated. Contact store owner."
        )

    permissions = await get_user_permissions(db, authenticated_user)
    entitlements = await get_tenant_entitlements(db, authenticated_user.tenant_id)

    tenant_res = await db.execute(select(Tenant).where(Tenant.id == authenticated_user.tenant_id))
    tenant = tenant_res.scalar_one()

    token = create_access_token(
        subject=authenticated_user.id,
        tenant_id=authenticated_user.tenant_id,
        role=authenticated_user.role.name if authenticated_user.role else "sub_user",
        permissions=permissions
    )

    await log_audit_event(
        db=db,
        tenant_id=authenticated_user.tenant_id,
        user_id=authenticated_user.id,
        action="LOGIN",
        entity_type="Auth",
        entity_id=authenticated_user.id,
        details={"login_type": "staff_pin"},
        ip_address=client_ip
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_seconds": 86400,
        "user": {
            "id": authenticated_user.id,
            "name": authenticated_user.name,
            "mobile_number": authenticated_user.mobile_number,
            "email": authenticated_user.email,
            "role": authenticated_user.role.name if authenticated_user.role else "sub_user"
        },
        "tenant": {
            "id": tenant.id,
            "business_name": tenant.business_name,
            "gst_number": tenant.gst_number,
            "subscription_tier": tenant.subscription_tier
        },
        "permissions": permissions,
        "entitlements": entitlements
    }
