from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.core.sentry import init_sentry
from app.api.v1.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]")
    init_sentry()
    
    # Initialize DB tables & run migrations
    try:
        from sqlalchemy import text
        from app.db.session import engine
        from app.db.base import Base
        import app.models  # load all models
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            migration_statements = [
                "ALTER TABLE items ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT FALSE NOT NULL",
                "ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS purchase_price FLOAT DEFAULT 0.0",
                "ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT FALSE NOT NULL",
                "ALTER TABLE bills ADD COLUMN IF NOT EXISTS party_address TEXT",
                "ALTER TABLE bills ADD COLUMN IF NOT EXISTS terms_conditions TEXT",
                "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address VARCHAR(500)",
                "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
                "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
                "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
                "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state VARCHAR(100)",
                "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pincode VARCHAR(20)",
                "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terms_conditions VARCHAR(2000)",
            ]
            for stmt in migration_statements:
                try:
                    await conn.execute(text(stmt))
                except Exception as me:
                    logger.debug(f"Migration note ({stmt}): {me}")
        logger.info("Database schema and migrations initialized successfully.")

        # Seed roles and permissions
        try:
            from app.db.session import AsyncSessionLocal
            from app.services.tenant_service import seed_roles_and_permissions
            async with AsyncSessionLocal() as session:
                await seed_roles_and_permissions(session)
            logger.info("Roles and permissions seeded successfully.")
        except Exception as se:
            logger.warning(f"Role/permission seeding note: {se}")
    except Exception as e:
        logger.error(f"Database schema initialization warning: {e}")

    yield
    # Shutdown tasks
    logger.info(f"Shutting down {settings.PROJECT_NAME}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multi-tenant AI-Powered Billing, Inventory & Double-Entry Accounting Platform for Indian SMBs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Set CORS middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API v1 routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
        "environment": settings.ENVIRONMENT,
        "region": settings.DATA_REGION
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
