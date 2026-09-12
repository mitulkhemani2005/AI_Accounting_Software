import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_tenant_data_isolation(async_client: AsyncClient):
    """Verify that Tenant A data is strictly invisible to Tenant B"""
    # 1. Signup Tenant A
    res_a = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": "Store Alpha",
            "admin_name": "Alpha Owner",
            "mobile_number": "9100000001",
            "password": "Password123!"
        }
    )
    token_a = res_a.json()["access_token"]
    tenant_a_id = res_a.json()["tenant"]["id"]

    # 2. Signup Tenant B
    res_b = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": "Store Beta",
            "admin_name": "Beta Owner",
            "mobile_number": "9100000002",
            "password": "Password123!"
        }
    )
    token_b = res_b.json()["access_token"]
    tenant_b_id = res_b.json()["tenant"]["id"]
    assert tenant_a_id != tenant_b_id

    # 3. Add staff in Tenant A
    await async_client.post(
        "/api/v1/users/sub-users",
        json={"name": "Alpha Staff", "mobile_number": "9100000003", "pin": "1234"},
        headers={"Authorization": f"Bearer {token_a}"}
    )

    # 4. List users for Tenant B — must NOT contain Alpha Staff
    res_b_users = await async_client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert res_b_users.status_code == 200
    b_users_list = res_b_users.json()
    assert len(b_users_list) == 1
    assert b_users_list[0]["name"] == "Beta Owner"
    assert not any(u["name"] == "Alpha Staff" for u in b_users_list)
