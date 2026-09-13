import pytest
from httpx import AsyncClient
from datetime import datetime, timezone


async def get_admin_headers(async_client: AsyncClient) -> dict:
    """Helper to register a fresh tenant admin and return authorization headers"""
    import uuid
    rand_id = uuid.uuid4().hex[:6]
    signup_res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Accounting Mart {rand_id}",
            "gst_number": "27AABCU9603R1ZM",
            "admin_name": f"Admin {rand_id}",
            "mobile_number": f"97{uuid.uuid4().int % 100000000:08d}",
            "password": "Password123!",
            "subscription_tier": "enterprise",
        }
    )
    assert signup_res.status_code in [200, 201], f"Signup failed: {signup_res.text}"
    token = signup_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_chart_of_accounts_seeding_and_custom_account(async_client: AsyncClient):
    """Test standard Indian SMB Chart of Accounts auto-seeding and custom ledger creation"""
    headers = await get_admin_headers(async_client)

    # 1. Get Account Groups
    grp_res = await async_client.get("/api/v1/accounting/groups", headers=headers)
    assert grp_res.status_code == 200
    groups = grp_res.json()
    assert len(groups) >= 10
    assert any(g["code"] == "ASSET_CURRENT" for g in groups)
    assert any(g["code"] == "REV_SALES" for g in groups)

    # 2. Get Chart of Accounts
    acc_res = await async_client.get("/api/v1/accounting/accounts", headers=headers)
    assert acc_res.status_code == 200
    accounts = acc_res.json()
    assert len(accounts) >= 20
    assert any(a["code"] == "1010-CASH" for a in accounts)
    assert any(a["code"] == "1020-BANK" for a in accounts)
    assert any(a["code"] == "1030-DEBTORS" for a in accounts)
    assert any(a["code"] == "2010-CREDITORS" for a in accounts)
    assert any(a["code"] == "4010-SALES" for a in accounts)
    assert any(a["code"] == "5010-PURCHASE" for a in accounts)

    # 3. Create Custom Ledger Account
    custom_acc_payload = {
        "code": "5090-INTERNET",
        "name": "Broadband & Internet Charges",
        "nature": "expense",
        "account_type": "general",
        "opening_balance": 0.0,
        "description": "Office broadband internet bills"
    }
    create_res = await async_client.post("/api/v1/accounting/accounts", json=custom_acc_payload, headers=headers)
    assert create_res.status_code == 201
    custom_acc = create_res.json()
    assert custom_acc["code"] == "5090-INTERNET"
    assert custom_acc["nature"] == "expense"


@pytest.mark.asyncio
async def test_manual_journal_voucher_and_double_entry_validation(async_client: AsyncClient):
    """Test posting manual journal entry voucher with double-entry equality enforcement"""
    headers = await get_admin_headers(async_client)

    # Get accounts
    acc_res = await async_client.get("/api/v1/accounting/accounts", headers=headers)
    accounts = acc_res.json()
    cash_acc = next(a for a in accounts if a["code"] == "1010-CASH")
    bank_acc = next(a for a in accounts if a["code"] == "1020-BANK")

    # 1. Attempt unbalanced journal voucher (Debit != Credit) -> Must fail with 400
    unbalanced_payload = {
        "voucher_type": "contra",
        "narration": "Cash deposit into Bank",
        "items": [
            {"account_id": bank_acc["id"], "debit": 5000.0, "credit": 0.0},
            {"account_id": cash_acc["id"], "debit": 0.0, "credit": 4000.0}  # Unbalanced
        ]
    }
    fail_res = await async_client.post("/api/v1/accounting/journal", json=unbalanced_payload, headers=headers)
    assert fail_res.status_code == 400
    assert "Double-entry violation" in fail_res.json()["detail"]

    # 2. Post balanced Contra entry (₹5,000 Cash Deposited into Bank)
    balanced_payload = {
        "voucher_type": "contra",
        "narration": "Cash deposit into Bank Account",
        "items": [
            {"account_id": bank_acc["id"], "debit": 5000.0, "credit": 0.0, "narration": "Bank account credited with cash deposit"},
            {"account_id": cash_acc["id"], "debit": 0.0, "credit": 5000.0, "narration": "Cash withdrawn for bank deposit"}
        ]
    }
    jv_res = await async_client.post("/api/v1/accounting/journal", json=balanced_payload, headers=headers)
    assert jv_res.status_code == 201
    jv_data = jv_res.json()
    assert jv_data["total_debit"] == 5000.0
    assert jv_data["total_credit"] == 5000.0
    assert jv_data["status"] == "posted"

    # Verify Cash Book and Bank Book reflect the movements
    cash_book = await async_client.get("/api/v1/accounting/reports/cash-book", headers=headers)
    assert cash_book.status_code == 200
    assert cash_book.json()["total_paid"] == 5000.0

    bank_book = await async_client.get("/api/v1/accounting/reports/bank-book", headers=headers)
    assert bank_book.status_code == 200
    assert bank_book.json()["total_received"] == 5000.0


@pytest.mark.asyncio
async def test_full_accounting_cycle_and_financial_statements(async_client: AsyncClient):
    """
    Test complete accounting cycle:
    1. Purchase Inward goods (Credit Purchase) -> Auto-creates PV voucher
    2. Cash POS Sale -> Auto-creates SV voucher
    3. Credit Customer Sale -> Auto-creates SV voucher
    4. Customer Payment Receipt -> Auto-creates RC voucher
    5. Supplier Payment -> Auto-creates PM voucher
    6. Verify Day Book, Trial Balance (100% balanced), P&L Statement, and Balance Sheet
    """
    headers = await get_admin_headers(async_client)

    # 1. Create Product Master Item
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Basmati Rice 5kg",
            "sku": "RICE-5KG-01",
            "category": "Groceries",
            "unit": "PCS",
            "sale_price": 500.0,
            "purchase_price": 400.0,
            "gst_rate": 5.0
        },
        headers=headers
    )
    assert item_res.status_code == 201
    item = item_res.json()

    # 2. Create Supplier
    supp_res = await async_client.post(
        "/api/v1/parties/suppliers",
        json={
            "name": "Shree Ganesh Grain Wholesalers",
            "mobile": "9820011223",
            "gst_number": "27AABCS1429B1Z1",
            "state": "Maharashtra"
        },
        headers=headers
    )
    assert supp_res.status_code == 201
    supplier = supp_res.json()

    # 3. Create Customer
    cust_res = await async_client.post(
        "/api/v1/parties/customers",
        json={
            "name": "Aakash Supermarket Retail",
            "mobile": "9820099887",
            "gst_number": "27AABCA5555B1Z5",
            "state": "Maharashtra"
        },
        headers=headers
    )
    assert cust_res.status_code == 201
    customer = cust_res.json()

    # 4. Stock in 50 PCS from Supplier (Credit Purchase)
    stock_in_payload = {
        "supplier_name": supplier["name"],
        "invoice_number": "PUR-GRAIN-001",
        "items": [
            {
                "item_id": item["id"],
                "quantity": 50.0,
                "unit": "PCS",
                "purchase_price": 400.0
            }
        ]
    }
    stk_res = await async_client.post("/api/v1/inventory/stock-in", json=stock_in_payload, headers=headers)
    assert stk_res.status_code == 200

    # 5. Make Cash Sale: 10 PCS (10 * 500 = 5000 + 5% GST = 5250)
    cash_sale_payload = {
        "type": "sale",
        "party_name": "Walk-in Cash Customer",
        "payment_mode": "cash",
        "payment_status": "paid",
        "items": [
            {
                "item_id": item["id"],
                "item_name": item["name"],
                "quantity": 10.0,
                "unit": "PCS",
                "rate": 500.0,
                "gst_rate": 5.0
            }
        ]
    }
    cash_sale_res = await async_client.post("/api/v1/bills", json=cash_sale_payload, headers=headers)
    assert cash_sale_res.status_code == 201

    # 6. Make Credit Sale to Customer: 20 PCS (20 * 500 = 10000 + 5% GST = 10500)
    credit_sale_payload = {
        "type": "sale",
        "party_id": customer["id"],
        "party_name": customer["name"],
        "payment_mode": "credit",
        "payment_status": "unpaid",
        "items": [
            {
                "item_id": item["id"],
                "item_name": item["name"],
                "quantity": 20.0,
                "unit": "PCS",
                "rate": 500.0,
                "gst_rate": 5.0
            }
        ]
    }
    credit_sale_res = await async_client.post("/api/v1/bills", json=credit_sale_payload, headers=headers)
    assert credit_sale_res.status_code == 201

    # 7. Customer pays ₹5,000 via UPI (Payment In)
    payment_in_payload = {
        "party_type": "customer",
        "party_id": customer["id"],
        "payment_type": "payment_in",
        "amount": 5000.0,
        "payment_mode": "upi",
        "reference_number": "UPI-REF-9988"
    }
    pay_in_res = await async_client.post("/api/v1/parties/payments", json=payment_in_payload, headers=headers)
    assert pay_in_res.status_code == 201

    # 8. Pay Supplier ₹10,000 via Bank Transfer (Payment Out)
    payment_out_payload = {
        "party_type": "supplier",
        "party_id": supplier["id"],
        "payment_type": "payment_out",
        "amount": 10000.0,
        "payment_mode": "bank",
        "reference_number": "IMPS-SUPP-1122"
    }
    pay_out_res = await async_client.post("/api/v1/parties/payments", json=payment_out_payload, headers=headers)
    assert pay_out_res.status_code == 201

    # --- 9. VERIFY DAY BOOK ---
    daybook_res = await async_client.get("/api/v1/accounting/reports/day-book", headers=headers)
    assert daybook_res.status_code == 200
    daybook = daybook_res.json()
    assert daybook["total_entries"] >= 5
    assert daybook["total_debit"] == daybook["total_credit"]

    # --- 10. VERIFY TRIAL BALANCE (Must be 100% Balanced) ---
    tb_res = await async_client.get("/api/v1/accounting/reports/trial-balance", headers=headers)
    assert tb_res.status_code == 200
    tb = tb_res.json()
    assert tb["is_balanced"] is True
    assert tb["difference"] == 0.0
    assert tb["total_debit"] > 0
    assert tb["total_debit"] == tb["total_credit"]

    # --- 11. VERIFY PROFIT & LOSS STATEMENT ---
    pl_res = await async_client.get("/api/v1/accounting/reports/profit-and-loss", headers=headers)
    assert pl_res.status_code == 200
    pl = pl_res.json()
    # Total sales taxable = 5000 (cash) + 10000 (credit) = 15000
    assert pl["sales_revenue"] == 15000.0
    # Total purchase taxable = 50 * 400 = 20000
    assert pl["purchase_costs"] == 20000.0

    # --- 12. VERIFY BALANCE SHEET ---
    bs_res = await async_client.get("/api/v1/accounting/reports/balance-sheet", headers=headers)
    assert bs_res.status_code == 200
    bs = bs_res.json()
    assert bs["total_assets"] > 0
    assert bs["is_balanced"] is True
