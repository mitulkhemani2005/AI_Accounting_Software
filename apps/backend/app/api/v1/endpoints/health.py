from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.config import settings
from app.db.session import get_db
import time

router = APIRouter()
START_TIME = time.time()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Basic liveness probe for container orchestration / load balancers"""
    return {
        "status": "healthy",
        "service": "ai-accounting-backend",
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "region": settings.DATA_REGION
    }


@router.get("/status", status_code=status.HTTP_200_OK)
async def system_status(db: AsyncSession = Depends(get_db)):
    """Readiness probe checking database connectivity and system status"""
    db_status = "unknown"
    try:
        result = await db.execute(text("SELECT 1"))
        if result.scalar() == 1:
            db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ready" if db_status == "connected" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "data_region": settings.DATA_REGION,
        "database": db_status,
        "uptime_seconds": round(time.time() - START_TIME, 2)
    }
