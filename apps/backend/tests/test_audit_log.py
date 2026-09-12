import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_audit_log_recording(async_client: AsyncClient):
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": "Audit Test Store",
            "admin_name": "Audit Admin",
            "mobile_number": "9200000001",
            "password": "Password123!"
        }
    )
    assert res.status_code == 201
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Add Staff
    await async_client.post(
        "/api/v1/users/sub-users",
        json={"name": "Audit Staff", "mobile_number": "9200000002", "pin": "9999"},
        headers=admin_headers
    )

    # 3. Update Tenant Business Name
    update_res = await async_client.put(
        "/api/v1/tenants/me",
        json={"business_name": "Audit Test Store Updated", "gst_number": "27AAAAA0000A1Z5"},
        headers=admin_headers
    )
    assert update_res.status_code == 200

    # 4. Fetch Audit Logs
    audit_res = await async_client.get("/api/v1/tenants/audit-logs", headers=admin_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 3

    actions = [l["action"] for l in logs]
    assert "UPDATE" in actions
    assert "CREATE" in actions
    assert "LOGIN" in actions
