import pytest
import uuid
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_subscription_plans_and_usage(async_client: AsyncClient):
    uid = str(uuid.uuid4())[:8]
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Subscription Test Mart {uid}",
            "admin_name": "Rohan Mehra",
            "mobile_number": f"98{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!"
        }
    )
    assert res.status_code == 201
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Get Plans List
    plans_res = await async_client.get("/api/v1/subscriptions/plans", headers=headers)
    assert plans_res.status_code == 200
    plans_data = plans_res.json()["plans"]
    assert len(plans_data) == 3
    plan_ids = [p["id"] for p in plans_data]
    assert "free" in plan_ids
    assert "standard" in plan_ids
    assert "enterprise" in plan_ids

    # 3. Get Current Usage
    usage_res = await async_client.get("/api/v1/subscriptions/usage", headers=headers)
    assert usage_res.status_code == 200
    usage = usage_res.json()
    assert "bills_this_month" in usage
    assert usage["is_active"] is True
    assert len(usage["entitlements"]) >= 1


@pytest.mark.asyncio
async def test_razorpay_order_and_payment_verification(async_client: AsyncClient):
    uid = str(uuid.uuid4())[:8]
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Razorpay Store {uid}",
            "admin_name": "Dev Sharma",
            "mobile_number": f"98{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!"
        }
    )
    assert res.status_code == 201
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create Razorpay Order
    order_res = await async_client.post(
        "/api/v1/subscriptions/create-order",
        json={"plan_id": "enterprise", "billing_cycle": "monthly"},
        headers=headers
    )
    assert order_res.status_code == 200
    order_data = order_res.json()
    assert order_data["amount"] == 99900  # ₹999.00 in paise
    assert order_data["currency"] == "INR"
    assert order_data["order_id"].startswith("order_")
    order_id = order_data["order_id"]

    # 3. Verify Payment Signature
    verify_res = await async_client.post(
        "/api/v1/subscriptions/verify-payment",
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": f"pay_{uid}",
            "razorpay_signature": "test_sig",
            "plan_id": "enterprise",
            "billing_cycle": "monthly"
        },
        headers=headers
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["success"] is True
    assert verify_data["subscription_tier"] == "enterprise"
    assert verify_data["is_active"] is True


@pytest.mark.asyncio
async def test_bulk_csv_data_imports(async_client: AsyncClient):
    uid = str(uuid.uuid4())[:8]
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Import Hub {uid}",
            "admin_name": "Karan Patel",
            "mobile_number": f"98{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!"
        }
    )
    assert res.status_code == 201
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Test Sample CSV Template Downloads
    tpl_items = await async_client.get("/api/v1/import/template/items", headers=headers)
    assert tpl_items.status_code == 200
    assert "Opening Stock" in tpl_items.text

    tpl_cust = await async_client.get("/api/v1/import/template/customers", headers=headers)
    assert tpl_cust.status_code == 200
    assert "Opening Balance" in tpl_cust.text

    tpl_supp = await async_client.get("/api/v1/import/template/suppliers", headers=headers)
    assert tpl_supp.status_code == 200
    assert "GSTIN" in tpl_supp.text

    # 3. Bulk Import Items CSV
    items_csv = (
        "Name,Barcode,Category,Unit,Sale Price,Purchase Price,GST Rate,HSN Code,Opening Stock\n"
        f"Organic Honey 500g,890{uid}01,Grocery,PCS,250.00,190.00,5.0,0409,25\n"
        f"Almond Milk 1L,890{uid}02,Beverages,PCS,180.00,140.00,12.0,2202,40\n"
    )
    import_items_res = await async_client.post(
        "/api/v1/import/items",
        json={"csv_content": items_csv},
        headers=headers
    )
    assert import_items_res.status_code == 200
    assert import_items_res.json()["success_count"] == 2
    assert import_items_res.json()["failed_count"] == 0

    # 4. Bulk Import Customers CSV
    cust_csv = (
        "Name,Mobile,GSTIN,State,Address,Area,Opening Balance\n"
        f"Sharma Sweets {uid},99{str(uuid.uuid4().int)[:8]},27AABCS1111A1Z1,Maharashtra,Station Road,Station Market,4500.00\n"
        f"Gupta Stores {uid},99{str(uuid.uuid4().int)[:8]},,Maharashtra,Main Bazar,City Center,1200.00\n"
    )
    import_cust_res = await async_client.post(
        "/api/v1/import/customers",
        json={"csv_content": cust_csv},
        headers=headers
    )
    assert import_cust_res.status_code == 200
    assert import_cust_res.json()["success_count"] == 2

    # 5. Bulk Import Suppliers CSV
    supp_csv = (
        "Name,Mobile,GSTIN,State,Address,Opening Balance\n"
        f"Nestle Distribution {uid},99{str(uuid.uuid4().int)[:8]},27AAACN2222A1Z5,Maharashtra,MIDC Area,18000.00\n"
    )
    import_supp_res = await async_client.post(
        "/api/v1/import/suppliers",
        json={"csv_content": supp_csv},
        headers=headers
    )
    assert import_supp_res.status_code == 200
    assert import_supp_res.json()["success_count"] == 1


@pytest.mark.asyncio
async def test_free_tier_restrictions_and_upgrade_unlock(async_client: AsyncClient):
    """
    Verify that Free Tier tenants are blocked from premium modules (Accounting, Reports, Sub-users)
    and that upgrading via Razorpay instantly unlocks all entitlements without manual admin action.
    """
    uid = str(uuid.uuid4())[:8]
    # 1. Sign up on default Free Tier
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Free Tier Store {uid}",
            "admin_name": "Manish Verma",
            "mobile_number": f"98{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!",
            "subscription_tier": "free",
        }
    )
    assert res.status_code == 201
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Verify Free Tier locks on premium modules
    # 2a. Accounting is locked (403)
    acc_res = await async_client.get("/api/v1/accounting/accounts", headers=headers)
    assert acc_res.status_code == 403
    assert "Module access restricted" in acc_res.json()["detail"]

    # 2b. Reports is locked (403)
    rep_res = await async_client.get("/api/v1/reports/debtors-ageing", headers=headers)
    assert rep_res.status_code == 403
    assert "Module access restricted" in rep_res.json()["detail"]

    # 2c. Sub-users creation is locked (403)
    sub_res = await async_client.post(
        "/api/v1/users/sub-users",
        json={"name": "Staff 1", "mobile_number": "9123456789", "pin": "1234"},
        headers=headers
    )
    assert sub_res.status_code == 403

    # 3. Upgrade to Enterprise Pro via Razorpay
    order_res = await async_client.post(
        "/api/v1/subscriptions/create-order",
        json={"plan_id": "enterprise", "billing_cycle": "monthly"},
        headers=headers
    )
    assert order_res.status_code == 200
    order_id = order_res.json()["order_id"]

    verify_res = await async_client.post(
        "/api/v1/subscriptions/verify-payment",
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": f"pay_{uid}",
            "razorpay_signature": "test_sig",
            "plan_id": "enterprise",
            "billing_cycle": "monthly"
        },
        headers=headers
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["success"] is True
    assert verify_res.json()["subscription_tier"] == "enterprise"

    # 4. Verify all premium modules are now instantly UNLOCKED!
    # 4a. Accounting is unlocked (200)
    acc_unlocked = await async_client.get("/api/v1/accounting/accounts", headers=headers)
    assert acc_unlocked.status_code == 200
    assert len(acc_unlocked.json()) >= 10

    # 4b. Reports is unlocked (200)
    rep_unlocked = await async_client.get("/api/v1/reports/debtors-ageing", headers=headers)
    assert rep_unlocked.status_code == 200

    # 4c. Sub-users creation is unlocked (201)
    sub_unlocked = await async_client.post(
        "/api/v1/users/sub-users",
        json={"name": "Staff 1", "mobile_number": f"91{str(uuid.uuid4().int)[:8]}", "pin": "1234"},
        headers=headers
    )
    assert sub_unlocked.status_code == 201

