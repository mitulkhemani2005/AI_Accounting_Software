from typing import List
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.schemas.tenant import TenantResponse, TenantUpdateRequest, ModuleEntitlementResponse
from app.schemas.audit import AuditLogResponse
from app.models.tenant import Tenant, ModuleEntitlement
from app.models.audit import AuditLog
from app.models.user import User
from app.api.deps import get_current_user, require_permission, require_admin
from app.services.audit_service import log_audit_event

router = APIRouter()


@router.get("/me", response_model=TenantResponse)
async def get_tenant_details(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current business tenant information and module entitlements"""
    tenant_res = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = tenant_res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    ent_res = await db.execute(
        select(ModuleEntitlement).where(ModuleEntitlement.tenant_id == tenant.id)
    )
    entitlements = ent_res.scalars().all()

    return TenantResponse(
        id=tenant.id,
        business_name=tenant.business_name,
        gst_number=tenant.gst_number,
        address=tenant.address,
        phone=tenant.phone,
        email=tenant.email,
        city=tenant.city,
        state=tenant.state,
        pincode=tenant.pincode,
        terms_conditions=tenant.terms_conditions,
        subscription_tier=tenant.subscription_tier,
        is_active=tenant.is_active,
        created_at=tenant.created_at,
        entitlements=[
            ModuleEntitlementResponse(
                module_name=e.module_name,
                active=e.active,
                expires_at=e.expires_at
            )
            for e in entitlements
        ]
    )


@router.put("/me", response_model=TenantResponse)
async def update_tenant_details(
    payload: TenantUpdateRequest,
    request: Request,
    current_user: User = Depends(require_permission("tenant.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Admin updates tenant business details"""
    tenant_res = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = tenant_res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if payload.business_name is not None:
        tenant.business_name = payload.business_name
    if payload.gst_number is not None:
        tenant.gst_number = payload.gst_number
    if payload.address is not None:
        tenant.address = payload.address
    if payload.phone is not None:
        tenant.phone = payload.phone
    if payload.email is not None:
        tenant.email = payload.email
    if payload.city is not None:
        tenant.city = payload.city
    if payload.state is not None:
        tenant.state = payload.state
    if payload.pincode is not None:
        tenant.pincode = payload.pincode
    if payload.terms_conditions is not None:
        tenant.terms_conditions = payload.terms_conditions

    await db.commit()
    await db.refresh(tenant)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        db=db,
        tenant_id=tenant.id,
        user_id=current_user.id,
        action="UPDATE",
        entity_type="Tenant",
        entity_id=tenant.id,
        details=payload.model_dump(exclude_unset=True),
        ip_address=client_ip
    )

    ent_res = await db.execute(
        select(ModuleEntitlement).where(ModuleEntitlement.tenant_id == tenant.id)
    )
    entitlements = ent_res.scalars().all()

    return TenantResponse(
        id=tenant.id,
        business_name=tenant.business_name,
        gst_number=tenant.gst_number,
        address=tenant.address,
        phone=tenant.phone,
        email=tenant.email,
        city=tenant.city,
        state=tenant.state,
        pincode=tenant.pincode,
        terms_conditions=tenant.terms_conditions,
        subscription_tier=tenant.subscription_tier,
        is_active=tenant.is_active,
        created_at=tenant.created_at,
        entitlements=[
            ModuleEntitlementResponse(
                module_name=e.module_name,
                active=e.active,
                expires_at=e.expires_at
            )
            for e in entitlements
        ]
    )


@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_trail(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin views full immutable audit log for their tenant"""
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.tenant_id == current_user.tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    logs = result.scalars().all()
    return [
        AuditLogResponse(
            id=l.id,
            tenant_id=l.tenant_id,
            user_id=l.user_id,
            action=l.action,
            entity_type=l.entity_type,
            entity_id=l.entity_id,
            details=l.details,
            ip_address=l.ip_address,
            created_at=l.created_at
        )
        for l in logs
    ]
