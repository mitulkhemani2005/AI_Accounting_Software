import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_party_management(async_client: AsyncClient):
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": "Kirana Traders",
            "admin_name": "Ramesh Trader",
            "mobile_number": "9400000001",
            "password": "Password123!"
        }
    )
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create Customer
    cust_res = await async_client.post(
        "/api/v1/parties/customers",
        json={
            "name": "Ajay Sharma",
            "mobile": "9820000001",
            "state": "Maharashtra",
            "opening_balance": 1500.0
        },
        headers=headers
    )
    assert cust_res.status_code == 201
    cust_id = cust_res.json()["id"]

    # 3. Create Supplier
    supp_res = await async_client.post(
        "/api/v1/parties/suppliers",
        json={
            "name": "Hindustan Unilever Distributor",
            "mobile": "9820000002",
            "gst_number": "27AAACH1111A1Z5",
            "opening_balance": 25000.0
        },
        headers=headers
    )
    assert supp_res.status_code == 201

    # 4. List Customers
    list_cust = await async_client.get("/api/v1/parties/customers", headers=headers)
    assert list_cust.status_code == 200
    assert any(c["name"] == "Ajay Sharma" for c in list_cust.json())
