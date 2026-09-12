import uuid
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tenant import Tenant, ModuleEntitlement
from app.models.user import Role, Permission, RolePermission, User
from app.core.security import get_password_hash, get_pin_hash
from app.services.audit_service import log_audit_event
from app.core.logging import logger

DEFAULT_PERMISSIONS = [
    ("bill.create", "Create counter POS and standard sale bills"),
    ("bill.view", "View all tenant sales and purchase bills"),
    ("bill.view_own", "View bills created by current user"),
    ("bill.edit", "Edit and correct existing bills (Admin/Manager only)"),
    ("bill.delete", "Delete / cancel bills (Admin only)"),
    ("inventory.manage", "Manage inventory, godowns, batches, and stock movements"),
    ("inventory.view", "View stock counts and item master"),
    ("accounting.manage", "Access full double-entry books, chart of accounts, and journals"),
    ("reports.view", "View financial reports, Trial Balance, P&L, and Balance Sheet"),
    ("outstanding.view", "View Sundry Debtors and Creditors ageing reports"),
    ("users.manage", "Manage sub-users, staff, roles, and staff PINs"),
    ("tenant.manage", "Manage business profile, GST details, and billing settings"),
    ("ai.query", "Query AI intelligence layer and view smart suggestions"),
]

DEFAULT_MODULES = [
    "billing_pos",
    "inventory",
    "accounting",
    "outstanding_reports",
    "ai_suggestions",
]


async def seed_roles_and_permissions(db: AsyncSession) -> Tuple[Role, Role]:
    """Ensure standard roles and permissions exist in database"""
    # 1. Seed Permissions
    permission_map = {}
    for perm_name, perm_desc in DEFAULT_PERMISSIONS:
        result = await db.execute(select(Permission).where(Permission.name == perm_name))
        perm = result.scalar_one_or_none()
        if not perm:
            perm = Permission(name=perm_name, description=perm_desc)
            db.add(perm)
            await db.flush()
        permission_map[perm_name] = perm

    # 2. Seed Admin Role (has all permissions)
    admin_res = await db.execute(select(Role).where(Role.name == "admin"))
    admin_role = admin_res.scalar_one_or_none()
    if not admin_role:
        admin_role = Role(name="admin", description="Tenant Owner with full unrestricted access")
        db.add(admin_role)
        await db.flush()
    
    # 3. Seed Sub-user Role (staff: strictly add-only billing)
    sub_user_res = await db.execute(select(Role).where(Role.name == "sub_user"))
    sub_user_role = sub_user_res.scalar_one_or_none()
    if not sub_user_role:
        sub_user_role = Role(
            name="sub_user",
            description="Store Staff: add-only billing, no edit/delete, no accounting books access"
        )
        db.add(sub_user_role)
        await db.flush()

    # 4. Map Admin Permissions
    for perm in permission_map.values():
        link_res = await db.execute(
            select(RolePermission).where(
                RolePermission.role_id == admin_role.id,
                RolePermission.permission_id == perm.id
            )
        )
        if not link_res.scalar_one_or_none():
            db.add(RolePermission(role_id=admin_role.id, permission_id=perm.id))

    # 5. Map Sub-user Permissions (strictly bill.create, bill.view_own, inventory.view)
    sub_user_allowed = ["bill.create", "bill.view_own", "inventory.view"]
    for perm_name in sub_user_allowed:
        perm = permission_map.get(perm_name)
        if perm:
            link_res = await db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == sub_user_role.id,
                    RolePermission.permission_id == perm.id
                )
            )
            if not link_res.scalar_one_or_none():
                db.add(RolePermission(role_id=sub_user_role.id, permission_id=perm.id))

    await db.commit()
    await db.refresh(admin_role)
    await db.refresh(sub_user_role)
    return admin_role, sub_user_role


async def create_tenant_with_admin(
    db: AsyncSession,
    business_name: str,
    gst_number: str | None,
    admin_name: str,
    mobile_number: str,
    email: str | None,
    password: str,
    pin: str | None = None,
    client_ip: str | None = None,
) -> Tuple[Tenant, User]:
    """Create new tenant, assign default module entitlements, and create admin user"""
    admin_role, _ = await seed_roles_and_permissions(db)

    # 1. Create Tenant
    tenant = Tenant(
        business_name=business_name,
        gst_number=gst_number,
        subscription_tier="all_in_one_trial",
        is_active=True
    )
    db.add(tenant)
    await db.flush()

    # 2. Add Default Module Entitlements
    for mod_name in DEFAULT_MODULES:
        entitlement = ModuleEntitlement(
            tenant_id=tenant.id,
            module_name=mod_name,
            active=True
        )
        db.add(entitlement)

    # 3. Create Admin User
    admin_user = User(
        tenant_id=tenant.id,
        name=admin_name,
        mobile_number=mobile_number,
        email=email,
        role_id=admin_role.id,
        password_hash=get_password_hash(password),
        pin_hash=get_pin_hash(pin) if pin else None,
        is_active=True
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(tenant)
    await db.refresh(admin_user)

    # 4. Audit Log
    await log_audit_event(
        db=db,
        tenant_id=tenant.id,
        user_id=admin_user.id,
        action="CREATE",
        entity_type="Tenant",
        entity_id=tenant.id,
        details={"business_name": business_name, "admin_name": admin_name},
        ip_address=client_ip
    )

    return tenant, admin_user
