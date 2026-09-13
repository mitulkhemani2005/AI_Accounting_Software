from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    auth,
    users,
    tenants,
    items,
    parties,
    bills,
    inventory,
    test_routes,
)

api_router = APIRouter()

# Health & Liveness
api_router.include_router(health.router, tags=["Health & Status"])

# Auth & Identity
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Identity"])

# User Management (RBAC)
api_router.include_router(users.router, prefix="/users", tags=["Users & Staff Management"])

# Tenant & Organization
api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenants & Audit Trail"])

# Catalog & Items Master (Phase 2)
api_router.include_router(items.router, prefix="/items", tags=["Item Master & Barcodes"])

# Customer & Supplier Parties (Phase 2)
api_router.include_router(parties.router, prefix="/parties", tags=["Parties (Customers & Suppliers)"])

# Billing & POS Transactions (Phase 2)
api_router.include_router(bills.router, prefix="/bills", tags=["Billing & Point of Sale"])

# Inventory & Godowns (Phase 3)
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory, Stock & Godowns"])

# RBAC Test Verification Routes
api_router.include_router(test_routes.router, prefix="/test-rbac", tags=["RBAC & Security Verification"])
