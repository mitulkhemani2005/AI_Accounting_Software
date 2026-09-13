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

    # 4. Create Areas / Routes
    area_res = await async_client.post(
        "/api/v1/parties/areas",
        json={
            "name": "Main Market Sector 4",
            "code": "MM-04",
            "description": "Central shopping district route"
        },
        headers=headers
    )
    assert area_res.status_code == 201
    area_id = area_res.json()["id"]
    assert area_res.json()["name"] == "Main Market Sector 4"

    # Create second area
    area_res2 = await async_client.post(
        "/api/v1/parties/areas",
        json={
            "name": "Industrial Area",
            "code": "IND-01",
        },
        headers=headers
    )
    assert area_res2.status_code == 201
    area2_id = area_res2.json()["id"]

    # 5. Create Customer in specific Area
    cust_area_res = await async_client.post(
        "/api/v1/parties/customers",
        json={
            "name": "Sunil General Store",
            "mobile": "9820000003",
            "state": "Maharashtra",
            "area_id": area_id,
            "opening_balance": 500.0
        },
        headers=headers
    )
    assert cust_area_res.status_code == 201
    assert cust_area_res.json()["area_name"] == "Main Market Sector 4"
    assert cust_area_res.json()["area_id"] == area_id

    # 6. Filter Customers by Area
    list_area_cust = await async_client.get(f"/api/v1/parties/customers?area_id={area_id}", headers=headers)
    assert list_area_cust.status_code == 200
    assert len(list_area_cust.json()) == 1
    assert list_area_cust.json()[0]["name"] == "Sunil General Store"

    # 7. List Areas with Party counts
    list_areas = await async_client.get("/api/v1/parties/areas", headers=headers)
    assert list_areas.status_code == 200
    mm_area = next((a for a in list_areas.json() if a["id"] == area_id), None)
    assert mm_area is not None
    assert mm_area["customers_count"] == 1

    # 8. List Customers (all)
    list_cust = await async_client.get("/api/v1/parties/customers", headers=headers)
    assert list_cust.status_code == 200
    assert any(c["name"] == "Ajay Sharma" for c in list_cust.json())
    assert any(c["name"] == "Sunil General Store" and c["area_name"] == "Main Market Sector 4" for c in list_cust.json())
