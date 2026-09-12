import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(async_client: AsyncClient):
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Welcome to AI Accounting Software" in data["message"]
    assert data["region"] == "ap-south-1"


@pytest.mark.asyncio
async def test_health_check(async_client: AsyncClient):
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ai-accounting-backend"
    assert data["region"] == "ap-south-1"


@pytest.mark.asyncio
async def test_system_status(async_client: AsyncClient):
    response = await async_client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    assert data["data_region"] == "ap-south-1"
