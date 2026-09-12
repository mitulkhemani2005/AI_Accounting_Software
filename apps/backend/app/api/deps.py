from typing import Optional, Callable, List, AsyncGenerator
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import decode_token
from app.models.user import User, Role
from app.models.tenant import Tenant, ModuleEntitlement
from app.services.auth_service import get_user_permissions, get_tenant_entitlements

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login-admin",
    auto_error=False
)


async def get_current_user(
    request: Request,
    header_token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extract and validate current authenticated user and tenant context from JWT (header or query param)"""
    token = header_token or request.query_params.get("token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    if not user_id or not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from DB
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or does not belong to active tenant",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated"
        )

    # Validate Tenant is active
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    if not tenant or not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Business tenant account is deactivated or suspended"
        )

    return user


async def get_current_tenant_id(
    current_user: User = Depends(get_current_user)
) -> str:
    """Dependency that guarantees the current request is isolated to the authenticated user's tenant_id"""
    return current_user.tenant_id


def require_permission(required_permission: str) -> Callable:
    """Factory dependency enforcing that the user's role has the exact permission server-side"""
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        user_permissions = await get_user_permissions(db, current_user)
        if required_permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: Action requires '{required_permission}' permission"
            )
        return current_user

    return permission_checker


def require_module_entitlement(required_module: str) -> Callable:
    """Factory dependency enforcing that the tenant has purchased/activated the specific module"""
    async def entitlement_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        tenant_entitlements = await get_tenant_entitlements(db, current_user.tenant_id)
        if required_module not in tenant_entitlements:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Module access restricted: '{required_module}' is not enabled on your subscription"
            )
        return current_user

    return entitlement_checker


async def require_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency requiring that the user has the 'admin' role"""
    if not current_user.role or current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Admin role required"
        )
    return current_user
