import pytest
import uuid
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ai_entitlement_gate_free_tier(async_client: AsyncClient):
    """
    Verify that tenants on Free tier cannot access AI endpoints (403 Forbidden).
    """
    uid = str(uuid.uuid4())[:8]
    # Free tier admin signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Free Tier Store {uid}",
            "admin_name": "Free User",
            "mobile_number": f"91{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!",
            "subscription_tier": "free",
        },
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # All AI endpoints should return 403 Forbidden
    r1 = await async_client.get("/api/v1/ai/pos-suggestions", headers=headers)
    assert r1.status_code == 403

    r2 = await async_client.get("/api/v1/ai/restock-suggestions", headers=headers)
    assert r2.status_code == 403

    r3 = await async_client.get("/api/v1/ai/association-rules", headers=headers)
    assert r3.status_code == 403

    r4 = await async_client.post("/api/v1/ai/ask", json={"query": "total sales"}, headers=headers)
    assert r4.status_code == 403

    r5 = await async_client.post("/api/v1/ai/recompute-batch", headers=headers)
    assert r5.status_code == 403


@pytest.mark.asyncio
async def test_ai_pos_recommendations_and_association_rules(async_client: AsyncClient):
    """
    Verify market basket association rule mining (Apriori) and POS smart suggestions
    on Enterprise tier with co-purchased items.
    """
    uid = str(uuid.uuid4())[:8]
    # 1. Enterprise admin signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Enterprise AI Mart {uid}",
            "admin_name": "AI Super Admin",
            "mobile_number": f"92{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!",
            "subscription_tier": "enterprise",
        },
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Godown
    g_res = await async_client.post(
        "/api/v1/inventory/godowns",
        json={"name": f"Central Godown {uid}", "code": f"GDN-{uid}", "city": "Mumbai"},
        headers=headers,
    )
    assert g_res.status_code == 201
    godown_id = g_res.json()["id"]

    # 3. Create 3 Items (Bread, Butter, Milk)
    item_ids = []
    item_names = ["Whole Wheat Bread", "Table Butter 500g", "Fresh Milk 1L"]
    item_codes = [f"BREAD-{uid}", f"BUTR-{uid}", f"MILK-{uid}"]
    item_prices = [40.0, 250.0, 60.0]

    for name, code, price in zip(item_names, item_codes, item_prices):
        i_res = await async_client.post(
            "/api/v1/items",
            json={
                "name": name,
                "item_code": code,
                "sale_price": price,
                "purchase_price": price * 0.8,
                "tax_rate": 5.0,
                "unit": "PCS",
            },
            headers=headers,
        )
        assert i_res.status_code == 201
        item_id = i_res.json()["id"]
        item_ids.append(item_id)

        # Inward stock
        await async_client.post(
            "/api/v1/inventory/stock-in",
            json={
                "godown_id": godown_id,
                "items": [
                    {
                        "item_id": item_id,
                        "quantity": 100.0,
                        "purchase_price": price * 0.8,
                    }
                ],
            },
            headers=headers,
        )

    bread_id, butter_id, milk_id = item_ids

    # 4. Create Customer
    c_res = await async_client.post(
        "/api/v1/parties/customers",
        json={
            "name": f"Regular Customer {uid}",
            "mobile_number": f"97{str(uuid.uuid4().int)[:8]}",
        },
        headers=headers,
    )
    assert c_res.status_code == 201
    customer_id = c_res.json()["id"]

    # 5. Create 3 Sale Bills where Bread and Butter are bought together
    for i in range(3):
        bill_res = await async_client.post(
            "/api/v1/bills",
            json={
                "type": "sale",
                "party_id": customer_id,
                "party_name": f"Regular Customer {uid}",
                "godown_id": godown_id,
                "payment_mode": "cash",
                "payment_status": "paid",
                "items": [
                    {
                        "item_id": bread_id,
                        "item_name": "Whole Wheat Bread",
                        "quantity": 1.0,
                        "unit": "PCS",
                        "rate": 40.0,
                        "gst_rate": 5.0,
                    },
                    {
                        "item_id": butter_id,
                        "item_name": "Table Butter 500g",
                        "quantity": 1.0,
                        "unit": "PCS",
                        "rate": 250.0,
                        "gst_rate": 5.0,
                    },
                ],
            },
            headers=headers,
        )
        assert bill_res.status_code == 201

    # 6. Test Association Rules Mining Endpoint
    rules_res = await async_client.get(
        "/api/v1/ai/association-rules?min_confidence=0.1",
        headers=headers,
    )
    assert rules_res.status_code == 200
    rules_data = rules_res.json()
    assert rules_data["total_rules"] >= 1
    antecedents = [r["antecedent_id"] for r in rules_data["rules"]]
    consequents = [r["consequent_id"] for r in rules_data["rules"]]
    assert bread_id in antecedents or butter_id in antecedents

    # 7. Test POS Smart Suggestions when Bread is in Cart
    pos_res = await async_client.get(
        f"/api/v1/ai/pos-suggestions?cart_item_ids={bread_id}&customer_id={customer_id}",
        headers=headers,
    )
    assert pos_res.status_code == 200
    pos_data = pos_res.json()
    assert len(pos_data["suggestions"]) >= 1
    suggested_ids = [s["item_id"] for s in pos_data["suggestions"]]
    assert butter_id in suggested_ids


@pytest.mark.asyncio
async def test_ai_inventory_restock_forecasting(async_client: AsyncClient):
    """
    Verify inventory restock & runout forecasting calculations.
    """
    uid = str(uuid.uuid4())[:8]
    # 1. Enterprise admin signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Restock Test Co {uid}",
            "admin_name": "Inventory Mgr",
            "mobile_number": f"93{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!",
            "subscription_tier": "enterprise",
        },
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Godown
    g_res = await async_client.post(
        "/api/v1/inventory/godowns",
        json={"name": f"Restock Godown {uid}", "code": f"GDN-{uid}", "city": "Delhi"},
        headers=headers,
    )
    assert g_res.status_code == 201
    godown_id = g_res.json()["id"]

    # 3. Create Item with low stock
    i_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": f"Basmati Rice 5kg {uid}",
            "item_code": f"RICE-{uid}",
            "sale_price": 500.0,
            "purchase_price": 400.0,
            "tax_rate": 0.0,
            "unit": "BAG",
            "min_stock_alert": 10.0,
        },
        headers=headers,
    )
    assert i_res.status_code == 201
    rice_id = i_res.json()["id"]

    # Inward only 5 bags
    await async_client.post(
        "/api/v1/inventory/stock-in",
        json={
            "godown_id": godown_id,
            "items": [
                {
                    "item_id": rice_id,
                    "quantity": 5.0,
                    "purchase_price": 400.0,
                }
            ],
        },
        headers=headers,
    )

    # 4. Fetch Restock Suggestions
    restock_res = await async_client.get(
        "/api/v1/ai/restock-suggestions?urgency=ALL",
        headers=headers,
    )
    assert restock_res.status_code == 200
    r_data = restock_res.json()
    assert r_data["total_items_analyzed"] >= 1
    item_entry = next((item for item in r_data["suggestions"] if item["item_id"] == rice_id), None)
    assert item_entry is not None
    assert item_entry["current_stock"] == 5.0
    assert item_entry["urgency"] in ["CRITICAL", "WARNING"]
    assert item_entry["suggested_quantity"] >= 1.0


@pytest.mark.asyncio
async def test_ai_financial_nl_query_assistant(async_client: AsyncClient):
    """
    Verify Natural Language Query engine correctly resolves diverse business queries.
    """
    uid = str(uuid.uuid4())[:8]
    # 1. Enterprise admin signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"NL Query Hub {uid}",
            "admin_name": "Finance CFO",
            "mobile_number": f"94{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!",
            "subscription_tier": "enterprise",
        },
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Query 1: Sales Revenue
    q1_res = await async_client.post(
        "/api/v1/ai/ask",
        json={"query": "What is our total sales revenue this month?"},
        headers=headers,
    )
    assert q1_res.status_code == 200
    d1 = q1_res.json()
    assert d1["intent"] in ["sales_summary", "sales_overview"]
    assert "sales" in d1["answer"].lower() or "revenue" in d1["answer"].lower()

    # Query 2: Overdue Debtors
    q2_res = await async_client.post(
        "/api/v1/ai/ask",
        json={"query": "Who owes us money and has overdue debt?"},
        headers=headers,
    )
    assert q2_res.status_code == 200
    d2 = q2_res.json()
    assert d2["intent"] in ["debtors_ageing", "debtors_analysis"]

    # Query 3: Net GST Liability
    q3_res = await async_client.post(
        "/api/v1/ai/ask",
        json={"query": "What is our net GST tax liability?"},
        headers=headers,
    )
    assert q3_res.status_code == 200
    d3 = q3_res.json()
    assert d3["intent"] in ["gst_liability", "gst_compliance"]

    # Query 4: Cash and Bank Liquidity
    q4_res = await async_client.post(
        "/api/v1/ai/ask",
        json={"query": "What is our cash and bank balance liquidity?"},
        headers=headers,
    )
    assert q4_res.status_code == 200
    d4 = q4_res.json()
    assert d4["intent"] in ["liquidity_summary", "cash_bank_liquidity"]


@pytest.mark.asyncio
async def test_ai_batch_recomputation_job(async_client: AsyncClient):
    """
    Verify background/manual batch AI recomputation job triggers and caches results.
    """
    uid = str(uuid.uuid4())[:8]
    # Enterprise admin signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Batch AI Mart {uid}",
            "admin_name": "Batch Operator",
            "mobile_number": f"95{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!",
            "subscription_tier": "enterprise",
        },
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Trigger batch recompute
    batch_res = await async_client.post(
        "/api/v1/ai/recompute-batch",
        headers=headers,
    )
    assert batch_res.status_code == 200
    b_data = batch_res.json()
    assert b_data["success"] is True
    assert "rules_generated" in b_data
    assert "duration_seconds" in b_data
