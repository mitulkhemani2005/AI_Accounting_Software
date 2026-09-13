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

    # 9. Record Payment Received from Customer (Ajay Sharma: opening bal 1500)
    pay_res = await async_client.post(
        "/api/v1/parties/payments",
        json={
            "party_type": "customer",
            "party_id": cust_id,
            "payment_type": "receipt",
            "amount": 500.0,
            "payment_mode": "upi",
            "reference_number": "UPI/2026/09/9991",
            "notes": "Part payment of opening balance"
        },
        headers=headers
    )
    assert pay_res.status_code == 201
    assert pay_res.json()["amount"] == 500.0

    # 9.1 Verify GET /api/v1/parties/payments
    list_payments_res = await async_client.get("/api/v1/parties/payments?payment_type=receipt", headers=headers)
    assert list_payments_res.status_code == 200
    assert any(p["id"] == pay_res.json()["id"] for p in list_payments_res.json())

    # 10. Check Customer Ledger and Running Balance
    ledger_res = await async_client.get(f"/api/v1/parties/customer/{cust_id}/ledger", headers=headers)
    assert ledger_res.status_code == 200
    ledger_data = ledger_res.json()
    assert ledger_data["opening_balance"] == 1500.0
    assert ledger_data["total_paid"] == 500.0
    assert ledger_data["current_balance"] == 1000.0
    assert len(ledger_data["transactions"]) >= 2  # Opening balance + Payment receipt

    # 11. Recalculate All Balances
    recalc_res = await async_client.post("/api/v1/parties/recalculate", headers=headers)
    assert recalc_res.status_code == 200
    assert recalc_res.json()["status"] == "success"

    # Verify customer balance is exactly 1000.0
    cust_check = await async_client.get("/api/v1/parties/customers", headers=headers)
    ajay = next((c for c in cust_check.json() if c["id"] == cust_id), None)
    assert ajay is not None
    assert ajay["current_balance"] == 1000.0


@pytest.mark.asyncio
async def test_supplier_credit_stock_in_and_payable_ledger(async_client: AsyncClient):
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": "Metro Retailers",
            "admin_name": "Suresh Metro",
            "mobile_number": "9400000002",
            "password": "Password123!"
        }
    )
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create Supplier
    supp_res = await async_client.post(
        "/api/v1/parties/suppliers",
        json={
            "name": "Tata Consumer Products Distributor",
            "mobile": "9820000099",
            "opening_balance": 5000.0
        },
        headers=headers
    )
    assert supp_res.status_code == 201
    supp_id = supp_res.json()["id"]

    # 3. Create Item
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Tata Salt 1kg",
            "sale_price": 28.0,
            "purchase_price": 22.0,
            "unit": "PKT",
            "gst_rate": 0.0
        },
        headers=headers
    )
    assert item_res.status_code == 201
    item_id = item_res.json()["id"]

    godowns = await async_client.get("/api/v1/inventory/godowns", headers=headers)
    godown_id = godowns.json()[0]["id"]

    # 4. Stock-In with supplier on credit: 100 PKT @ 22.0 = 2200.0
    stock_in_res = await async_client.post(
        "/api/v1/inventory/stock-in",
        json={
            "godown_id": godown_id,
            "supplier_id": supp_id,
            "payment_mode": "credit",
            "items": [
                {
                    "item_id": item_id,
                    "quantity": 100.0,
                    "purchase_price": 22.0,
                    "batch_number": "BATCH-SALT-01"
                }
            ],
            "notes": "Credit purchase from Tata distributor"
        },
        headers=headers
    )
    assert stock_in_res.status_code == 200

    # 5. Check Supplier balance: 5000 (opening) + 2200 (credit purchase) = 7200.0
    supp_list = await async_client.get("/api/v1/parties/suppliers", headers=headers)
    assert supp_list.status_code == 200
    tata_supp = next((s for s in supp_list.json() if s["id"] == supp_id), None)
    assert tata_supp is not None
    assert tata_supp["current_balance"] == 7200.0

    # 6. Check Supplier ledger
    ledger_res = await async_client.get(f"/api/v1/parties/supplier/{supp_id}/ledger", headers=headers)
    assert ledger_res.status_code == 200
    ledger_data = ledger_res.json()
    assert ledger_data["opening_balance"] == 5000.0
    assert ledger_data["current_balance"] == 7200.0
    assert any(tx.get("type") == "purchase_invoice" for tx in ledger_data["transactions"])

    # 7. Record payment made to Supplier: 3200.0
    pay_res = await async_client.post(
        "/api/v1/parties/payments",
        json={
            "party_type": "supplier",
            "party_id": supp_id,
            "payment_type": "payment",
            "amount": 3200.0,
            "payment_mode": "bank_transfer",
            "reference_number": "NEFT-TATA-001"
        },
        headers=headers
    )
    assert pay_res.status_code == 201

    # 8. Check Supplier balance after payment: 7200 - 3200 = 4000.0
    supp_list2 = await async_client.get("/api/v1/parties/suppliers", headers=headers)
    tata_supp2 = next((s for s in supp_list2.json() if s["id"] == supp_id), None)
    assert tata_supp2["current_balance"] == 4000.0

