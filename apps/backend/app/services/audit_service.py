from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.core.logging import logger


async def log_audit_event(
    db: AsyncSession,
    tenant_id: str,
    action: str,
    entity_type: str,
    user_id: Optional[str] = None,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    """Record an immutable audit event for tenant compliance and security tracking"""
    try:
        audit_entry = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action.upper(),
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
            ip_address=ip_address
        )
        db.add(audit_entry)
        await db.commit()
        await db.refresh(audit_entry)
        return audit_entry
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")
        # Note: Do not block business operations if audit write encounters a non-fatal failure
        return None
