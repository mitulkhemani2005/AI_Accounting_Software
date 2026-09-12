from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ai_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_ai_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ai-accounting-ai-service"
