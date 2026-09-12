from fastapi import APIRouter
from app.api.v1.endpoints import health

api_router = APIRouter()

# Core system routes
api_router.include_router(health.router, tags=["Health & Status"])
