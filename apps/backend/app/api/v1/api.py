from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, tenants, test_routes

api_router = APIRouter()

# Health & Liveness
api_router.include_router(health.router, tags=["Health & Status"])

# Auth & Identity
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Identity"])

# User Management (RBAC)
api_router.include_router(users.router, prefix="/users", tags=["Users & Staff Management"])

# Tenant & Organization
api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenants & Audit Trail"])

# RBAC Test Verification Routes
api_router.include_router(test_routes.router, prefix="/test-rbac", tags=["RBAC & Security Verification"])
