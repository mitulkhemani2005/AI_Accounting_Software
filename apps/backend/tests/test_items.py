import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_item_crud_and_barcode_lookup(async_client: AsyncClient):
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": "Modern Supermarket",
            "admin_name": "Mahesh Kumar",
            "mobile_number": "9300000001",
            "password": "Password123!"
        }
    )
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create Item
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Tata Tea Gold 500g",
            "sku": "TT-GOLD-500",
            "barcode": "8901052000012",
            "category": "Groceries",
            "unit": "PCS",
            "sale_price": 280.0,
            "purchase_price": 240.0,
            "gst_rate": 5.0,
            "hsn_code": "0902",
            "min_stock_alert": 10.0
        },
        headers=headers
    )
    assert item_res.status_code == 201
    item_data = item_res.json()
    assert item_data["name"] == "Tata Tea Gold 500g"
    item_id = item_data["id"]

    # 3. Barcode Lookup
    barcode_res = await async_client.get(
        "/api/v1/items/barcode/8901052000012",
        headers=headers
    )
    assert barcode_res.status_code == 200
    assert barcode_res.json()["name"] == "Tata Tea Gold 500g"

    # 4. Search Item
    search_res = await async_client.get(
        "/api/v1/items?search=Tata",
        headers=headers
    )
    assert search_res.status_code == 200
    assert len(search_res.json()) >= 1

    # 5. Update Item
    update_res = await async_client.put(
        f"/api/v1/items/{item_id}",
        json={"sale_price": 290.0},
        headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["sale_price"] == 290.0

    # 6. Delete Item
    del_res = await async_client.delete(
        f"/api/v1/items/{item_id}",
        headers=headers
    )
    assert del_res.status_code == 200
