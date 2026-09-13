import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.db.session import engine, AsyncSessionLocal
from app.db.base import Base
import app.models  # load all models
from app.services.tenant_service import seed_roles_and_permissions


async def reset_database():
    print("Connecting to database and dropping all tables...")
    async with engine.begin() as conn:
        # Drop all tables with CASCADE in PostgreSQL
        await conn.run_sync(Base.metadata.drop_all)
        print("All tables dropped.")
        
        # Create all tables cleanly
        await conn.run_sync(Base.metadata.create_all)
        print("All tables created cleanly from SQLAlchemy models.")

    # Seed standard roles & permissions
    print("Seeding default roles and permissions...")
    async with AsyncSessionLocal() as session:
        await seed_roles_and_permissions(session)
    print("Roles and permissions seeded successfully.")
    print("Database has been completely cleared and initialized!")


if __name__ == "__main__":
    asyncio.run(reset_database())
