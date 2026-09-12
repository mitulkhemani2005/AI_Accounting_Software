from fastapi import APIRouter
from app.config import ai_settings
import time

router = APIRouter()
START_TIME = time.time()


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": ai_settings.SERVICE_NAME,
        "environment": ai_settings.ENVIRONMENT,
        "version": ai_settings.VERSION,
        "uptime_seconds": round(time.time() - START_TIME, 2),
    }
