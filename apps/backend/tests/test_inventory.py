import pytest
import uuid
from httpx import AsyncClient
from datetime import date, timedelta


async def get_admin_headers(async_client: AsyncClient) -> dict:
    """Helper to register a fresh tenant admin and return authorization headers"""
    rand_id = uuid.uuid4().hex[:6]
    signup_res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Inventory Mart {rand_id}",
            "gst_number": "27AABCU9603R1ZM",
            "admin_name": f"Admin {rand_id}",
            "mobile_number": f"97{uuid.uuid4().int % 100000000:08d}",
            "password": "Password123!"
        }
    )
    assert signup_res.status_code in [200, 201], f"Signup failed: {signup_res.text}"
    token = signup_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_godown_management_and_defaults(async_client: AsyncClient):
    """Test Godown creation, listing, default assignment, and update"""
    admin_headers = await get_admin_headers(async_client)

    # 1. List godowns (should auto-create default 'Main Store / Godown')
    res = await async_client.get("/api/v1/inventory/godowns", headers=admin_headers)
    assert res.status_code == 200
    godowns = res.json()
    assert len(godowns) >= 1
    assert any(g["is_default"] for g in godowns)
    main_g = next(g for g in godowns if g["is_default"])
    assert main_g["code"] == "MAIN"

    # 2. Create a secondary branch godown
    payload = {
        "name": "Bandra Warehouse",
        "code": "WH-BNDR",
        "address": "Plot 42, Linking Road",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400050",
        "contact_person": "Suresh Patel",
        "contact_number": "9820198201",
        "is_default": False
    }
    create_res = await async_client.post("/api/v1/inventory/godowns", json=payload, headers=admin_headers)
    assert create_res.status_code == 201
    bndr_g = create_res.json()
    assert bndr_g["code"] == "WH-BNDR"
    assert bndr_g["name"] == "Bandra Warehouse"

    # 3. Duplicate code should fail
    dup_res = await async_client.post("/api/v1/inventory/godowns", json=payload, headers=admin_headers)
    assert dup_res.status_code == 400

    # 4. Update godown
    update_res = await async_client.put(
        f"/api/v1/inventory/godowns/{bndr_g['id']}",
        json={"contact_person": "Ramesh Patel"},
        headers=admin_headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["contact_person"] == "Ramesh Patel"


@pytest.mark.asyncio
async def test_stock_in_and_batches(async_client: AsyncClient):
    """Test Stock-In purchase entry with batch numbers and expiry dates"""
    admin_headers = await get_admin_headers(async_client)

    # 1. Create a test item
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Basmati Rice 25kg",
            "sku": "RICE-BAS-25",
            "category": "Grains",
            "unit": "BAG",
            "sale_price": 2400.0,
            "purchase_price": 1900.0,
            "gst_rate": 5.0,
            "min_stock_alert": 10.0
        },
        headers=admin_headers
    )
    assert item_res.status_code == 201
    item = item_res.json()

    # 2. Stock-In 50 bags with Batch and Expiry
    exp_date = (date.today() + timedelta(days=180)).isoformat()
    stock_in_payload = {
        "supplier_name": "Punjab Agro Mills",
        "invoice_number": "PUR-2026-089",
        "items": [
            {
                "item_id": item["id"],
                "quantity": 50.0,
                "purchase_price": 1950.0,
                "batch_number": "BATCH-PAM-01",
                "expiry_date": exp_date
            }
        ],
        "notes": "Premium harvest lot"
    }
    stock_in_res = await async_client.post("/api/v1/inventory/stock-in", json=stock_in_payload, headers=admin_headers)
    assert stock_in_res.status_code == 200
    assert stock_in_res.json()["status"] == "success"

    # 3. Verify Stock Overview
    stock_res = await async_client.get(f"/api/v1/inventory/stock?search={item['sku']}", headers=admin_headers)
    assert stock_res.status_code == 200
    summary_list = stock_res.json()
    assert len(summary_list) == 1
    item_summary = summary_list[0]
    assert item_summary["total_quantity"] == 50.0
    assert item_summary["total_valuation_cost"] == 50.0 * 1950.0
    assert len(item_summary["active_batches"]) >= 1
    assert item_summary["active_batches"][0]["batch_number"] == "BATCH-PAM-01"


@pytest.mark.asyncio
async def test_pos_sale_auto_stock_deduct_and_void_restock(async_client: AsyncClient):
    """Test that selling via POS decreases stock automatically and voiding restores it"""
    admin_headers = await get_admin_headers(async_client)

    # 1. Create test item
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Tata Tea Gold 500g",
            "sku": "TATA-TEA-500",
            "category": "Beverages",
            "unit": "PCS",
            "sale_price": 320.0,
            "purchase_price": 260.0,
            "gst_rate": 5.0,
            "min_stock_alert": 5.0
        },
        headers=admin_headers
    )
    assert item_res.status_code == 201
    item = item_res.json()

    # 2. Stock in 30 units
    await async_client.post(
        "/api/v1/inventory/stock-in",
        json={
            "items": [{"item_id": item["id"], "quantity": 30.0, "purchase_price": 260.0}]
        },
        headers=admin_headers
    )

    # Verify initial stock = 30
    check_init = await async_client.get(f"/api/v1/inventory/stock?search={item['sku']}", headers=admin_headers)
    assert check_init.json()[0]["total_quantity"] == 30.0

    # 3. Create POS Sale Bill for 8 units
    bill_payload = {
        "type": "sale",
        "party_name": "Walk-in Retail Customer",
        "payment_mode": "cash",
        "payment_status": "paid",
        "items": [
            {
                "item_id": item["id"],
                "item_name": item["name"],
                "quantity": 8.0,
                "unit": item["unit"],
                "rate": item["sale_price"],
                "gst_rate": item["gst_rate"]
            }
        ]
    }
    bill_res = await async_client.post("/api/v1/bills", json=bill_payload, headers=admin_headers)
    assert bill_res.status_code == 201
    bill = bill_res.json()

    # 4. Verify Stock after sale = 30 - 8 = 22
    check_after_sale = await async_client.get(f"/api/v1/inventory/stock?search={item['sku']}", headers=admin_headers)
    assert check_after_sale.json()[0]["total_quantity"] == 22.0

    # 5. Check Movement Ledger logged sale_out
    moves_res = await async_client.get(f"/api/v1/inventory/movements?item_id={item['id']}", headers=admin_headers)
    assert moves_res.status_code == 200
    moves = moves_res.json()
    assert any(m["movement_type"] == "sale_out" and m["quantity"] == 8.0 for m in moves)

    # 6. Admin Voids the Bill
    void_res = await async_client.delete(f"/api/v1/bills/{bill['id']}", headers=admin_headers)
    assert void_res.status_code == 200

    # 7. Verify Stock restored back to 30
    check_after_void = await async_client.get(f"/api/v1/inventory/stock?search={item['sku']}", headers=admin_headers)
    assert check_after_void.json()[0]["total_quantity"] == 30.0

    # Verify void_restock logged in movement ledger
    moves_void = await async_client.get(f"/api/v1/inventory/movements?item_id={item['id']}", headers=admin_headers)
    assert any(m["movement_type"] == "void_restock" and m["quantity"] == 8.0 for m in moves_void.json())


@pytest.mark.asyncio
async def test_inter_godown_stock_transfer(async_client: AsyncClient):
    """Test stock transfer between two godowns with atomic deduction & addition"""
    admin_headers = await get_admin_headers(async_client)

    # 1. Create two godowns
    g1_res = await async_client.post(
        "/api/v1/inventory/godowns",
        json={"name": "Central Depot", "code": "DEPOT-01", "is_default": False},
        headers=admin_headers
    )
    g1 = g1_res.json()

    g2_res = await async_client.post(
        "/api/v1/inventory/godowns",
        json={"name": "Retail Outlet 2", "code": "OUTLET-02", "is_default": False},
        headers=admin_headers
    )
    g2 = g2_res.json()

    # 2. Create item and stock 100 units in g1
    item_res = await async_client.post(
        "/api/v1/items",
        json={"name": "Surf Excel 1kg", "sku": "SURF-1KG", "sale_price": 140.0, "purchase_price": 110.0, "gst_rate": 18.0},
        headers=admin_headers
    )
    item = item_res.json()

    await async_client.post(
        "/api/v1/inventory/stock-in",
        json={
            "godown_id": g1["id"],
            "items": [{"item_id": item["id"], "quantity": 100.0, "purchase_price": 110.0}]
        },
        headers=admin_headers
    )

    # 3. Transfer 35 units from g1 to g2
    transfer_payload = {
        "from_godown_id": g1["id"],
        "to_godown_id": g2["id"],
        "items": [{"item_id": item["id"], "quantity": 35.0, "unit": "PCS"}],
        "notes": "Weekly branch replenishment"
    }
    trf_res = await async_client.post("/api/v1/inventory/transfers", json=transfer_payload, headers=admin_headers)
    assert trf_res.status_code == 201
    transfer_data = trf_res.json()
    assert transfer_data["transfer_number"].startswith("TRF-")
    assert transfer_data["status"] == "completed"

    # 4. Check stock distribution: g1 = 65, g2 = 35
    summary_res = await async_client.get(f"/api/v1/inventory/stock?search={item['sku']}", headers=admin_headers)
    summary = summary_res.json()[0]
    assert summary["total_quantity"] == 100.0
    g1_qty = next(b["quantity"] for b in summary["godown_breakdown"] if b["godown_id"] == g1["id"])
    g2_qty = next(b["quantity"] for b in summary["godown_breakdown"] if b["godown_id"] == g2["id"])
    assert g1_qty == 65.0
    assert g2_qty == 35.0

    # 5. Over-transfer (attempting to transfer 100 units from g1 when only 65 available) should fail
    fail_trf = await async_client.post(
        "/api/v1/inventory/transfers",
        json={
            "from_godown_id": g1["id"],
            "to_godown_id": g2["id"],
            "items": [{"item_id": item["id"], "quantity": 100.0}]
        },
        headers=admin_headers
    )
    assert fail_trf.status_code == 400


@pytest.mark.asyncio
async def test_low_stock_and_expiry_alerts(async_client: AsyncClient):
    """Test Low Stock alerts and Batch Expiry alerts"""
    admin_headers = await get_admin_headers(async_client)

    # 1. Create item with high min stock alert threshold (e.g. min 20)
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Amul Butter 500g",
            "sku": "AMUL-BUTTER-500",
            "category": "Dairy",
            "sale_price": 275.0,
            "purchase_price": 240.0,
            "gst_rate": 12.0,
            "min_stock_alert": 20.0
        },
        headers=admin_headers
    )
    item = item_res.json()

    # Stock only 5 units (less than min 20) with near-expiry date (15 days away)
    near_exp = (date.today() + timedelta(days=15)).isoformat()
    await async_client.post(
        "/api/v1/inventory/stock-in",
        json={
            "items": [
                {
                    "item_id": item["id"],
                    "quantity": 5.0,
                    "batch_number": "BATCH-EXP-01",
                    "expiry_date": near_exp
                }
            ]
        },
        headers=admin_headers
    )

    # 2. Check Low Stock alert API
    low_res = await async_client.get("/api/v1/inventory/alerts/low-stock", headers=admin_headers)
    assert low_res.status_code == 200
    low_items = low_res.json()
    assert any(li["item_id"] == item["id"] for li in low_items)

    # 3. Check Expiring Batches alert API
    exp_res = await async_client.get("/api/v1/inventory/alerts/expiring?days=30", headers=admin_headers)
    assert exp_res.status_code == 200
    exp_batches = exp_res.json()
    assert any(eb["batch_number"] == "BATCH-EXP-01" for eb in exp_batches)

    # 4. Check Metrics
    metrics_res = await async_client.get("/api/v1/inventory/metrics", headers=admin_headers)
    assert metrics_res.status_code == 200
    metrics = metrics_res.json()
    assert metrics["low_stock_items_count"] >= 1
    assert metrics["expiring_soon_batches_count"] >= 1


@pytest.mark.asyncio
async def test_dual_unit_packaging_and_case_stock_in(async_client: AsyncClient):
    """Test creating an item with 1 CS = 24 EA and restocking in Cases (CS)"""
    admin_headers = await get_admin_headers(async_client)

    # 1. Create item with dual units: EA base, CS secondary, 1 CS = 24 EA
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Coca Cola 300ml Can",
            "sku": "COKE-300",
            "category": "Beverages",
            "unit": "EA",
            "secondary_unit": "CS",
            "units_per_case": 24.0,
            "sale_price": 40.0,
            "purchase_price": 30.0,
            "gst_rate": 28.0,
            "min_stock_alert": 48.0
        },
        headers=admin_headers
    )
    assert item_res.status_code == 201
    item = item_res.json()
    assert item["units_per_case"] == 24.0
    assert item["secondary_unit"] == "CS"

    # 2. Stock-in 5 Cases (CS) -> Should automatically yield 5 * 24 = 120 EA
    stock_in_res = await async_client.post(
        "/api/v1/inventory/stock-in",
        json={
            "supplier_name": "Beverage Bottlers Ltd",
            "invoice_number": "INV-CS-001",
            "items": [
                {
                    "item_id": item["id"],
                    "quantity": 5.0,
                    "unit": "CS",
                    "purchase_price": 720.0,
                    "batch_number": "BATCH-CS-01"
                }
            ]
        },
        headers=admin_headers
    )
    assert stock_in_res.status_code == 200
    assert stock_in_res.json()["items"][0]["quantity_added"] == 120.0

    # 3. Verify stock summary returns both EA total and computed CS cases
    summary_res = await async_client.get(f"/api/v1/inventory/stock?search={item['sku']}", headers=admin_headers)
    assert summary_res.status_code == 200
    summary_list = summary_res.json()
    assert len(summary_list) == 1
    sum_item = summary_list[0]
    assert sum_item["total_quantity"] == 120.0
    assert sum_item["units_per_case"] == 24.0
    assert sum_item["total_cases"] == 5.0


@pytest.mark.asyncio
async def test_stock_in_creates_purchase_book_record(async_client: AsyncClient):
    """Test that every stock-in inward consignment automatically records into Purchase Book"""
    admin_headers = await get_admin_headers(async_client)

    # 1. Create a product
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Tata Tea Gold 500g",
            "sku": "TEA-500",
            "hsn_code": "0902",
            "unit": "EA",
            "secondary_unit": "CS",
            "units_per_case": 10.0,
            "sale_price": 320.0,
            "purchase_price": 250.0,
            "gst_rate": 5.0,
        },
        headers=admin_headers
    )
    assert item_res.status_code == 201
    item = item_res.json()

    # 2. Record Stock In / Purchase Goods
    stock_in_payload = {
        "supplier_name": "Tata Consumer Products Distributors",
        "invoice_number": "PUR-INV-9988",
        "items": [
            {
                "item_id": item["id"],
                "quantity": 20.0,  # 20 EA
                "unit": "EA",
                "purchase_price": 250.0,
                "batch_number": "TTG-2026-B1"
            }
        ],
        "notes": "Direct Inward Consignment from Distributor"
    }
    stock_in_res = await async_client.post("/api/v1/inventory/stock-in", json=stock_in_payload, headers=admin_headers)
    assert stock_in_res.status_code == 200
    stk_data = stock_in_res.json()
    assert "purchase_bill_id" in stk_data
    assert stk_data["purchase_bill_number"] == "PUR-INV-9988"
    assert stk_data["purchase_total_amount"] == 5250.0  # (20 * 250) = 5000 + 5% GST (250) = 5250

    # 3. Query Purchase Book via /api/v1/bills?bill_type=purchase
    pur_book_res = await async_client.get("/api/v1/bills?bill_type=purchase", headers=admin_headers)
    assert pur_book_res.status_code == 200
    pur_bills = pur_book_res.json()
    assert len(pur_bills) >= 1
    
    matching_bill = next((b for b in pur_bills if b["bill_number"] == "PUR-INV-9988"), None)
    assert matching_bill is not None
    assert matching_bill["type"] == "purchase"
    assert matching_bill["party_name"] == "Tata Consumer Products Distributors"
    assert matching_bill["taxable_amount"] == 5000.0
    assert matching_bill["gst_amount"] == 250.0
    assert matching_bill["total_amount"] == 5250.0
    assert len(matching_bill["items"]) == 1
    assert matching_bill["items"][0]["item_name"] == "Tata Tea Gold 500g"
    assert matching_bill["items"][0]["quantity"] == 20.0

    # 4. Verify PDF Generation for the Purchase Voucher
    pdf_res = await async_client.get(f"/api/v1/bills/{matching_bill['id']}/pdf?format=half_a4", headers=admin_headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 1000


@pytest.mark.asyncio
async def test_out_of_stock_counter_sale_blocked(async_client: AsyncClient):
    """Test that creating a sale bill for items with insufficient or 0 stock raises a 400 Bad Request error"""
    admin_headers = await get_admin_headers(async_client)

    # 1. Create item with 0 stock
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Zero Stock Product",
            "sku": "ZERO-STK-001",
            "category": "General",
            "unit": "EA",
            "secondary_unit": "CS",
            "units_per_case": 10,
            "sale_price": 100.0,
            "purchase_price": 80.0,
            "gst_rate": 18.0
        },
        headers=admin_headers
    )
    assert item_res.status_code == 201
    item = item_res.json()

    # 2. Attempt counter sale with 0 stock -> Must fail with 400
    sale_payload = {
        "type": "sale",
        "party_name": "Walk-in Cash Customer",
        "payment_mode": "cash",
        "payment_status": "paid",
        "items": [
            {
                "item_id": item["id"],
                "item_name": item["name"],
                "quantity": 1.0,
                "unit": "EA",
                "rate": 100.0,
                "gst_rate": 18.0
            }
        ]
    }
    fail_res = await async_client.post("/api/v1/bills", json=sale_payload, headers=admin_headers)
    assert fail_res.status_code == 400
    assert "Out of stock" in fail_res.json()["detail"]

    # 3. Stock in 5 EA
    await async_client.post(
        "/api/v1/inventory/stock-in",
        json={
            "items": [{"item_id": item["id"], "quantity": 5.0, "purchase_price": 80.0}]
        },
        headers=admin_headers
    )

    # 4. Attempt to sell 1 CS (which is 10 EA) when only 5 EA are in stock -> Must fail with 400
    case_sale_payload = {
        "type": "sale",
        "party_name": "Walk-in Cash Customer",
        "payment_mode": "cash",
        "payment_status": "paid",
        "items": [
            {
                "item_id": item["id"],
                "item_name": item["name"],
                "quantity": 1.0,
                "unit": "CS",
                "rate": 1000.0,
                "gst_rate": 18.0
            }
        ]
    }
    fail_case_res = await async_client.post("/api/v1/bills", json=case_sale_payload, headers=admin_headers)
    assert fail_case_res.status_code == 400
    assert "Out of stock" in fail_case_res.json()["detail"]

    # 5. Sell 3 EA -> Must succeed
    valid_sale_payload = {
        "type": "sale",
        "party_name": "Walk-in Cash Customer",
        "payment_mode": "cash",
        "payment_status": "paid",
        "items": [
            {
                "item_id": item["id"],
                "item_name": item["name"],
                "quantity": 3.0,
                "unit": "EA",
                "rate": 100.0,
                "gst_rate": 18.0
            }
        ]
    }
    valid_res = await async_client.post("/api/v1/bills", json=valid_sale_payload, headers=admin_headers)
    assert valid_res.status_code == 201

    # 6. Verify remaining stock = 5 - 3 = 2 EA
    stk_res = await async_client.get(f"/api/v1/inventory/stock?search={item['sku']}", headers=admin_headers)
    assert stk_res.json()[0]["total_quantity"] == 2.0



