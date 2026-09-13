import pytest
import uuid
from httpx import AsyncClient
from datetime import datetime, date


@pytest.mark.asyncio
async def test_debtors_and_creditors_ageing_reports(async_client: AsyncClient):
    uid = str(uuid.uuid4())[:8]
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Mega Wholesale Hub {uid}",
            "admin_name": "Suresh Gupta",
            "mobile_number": f"97{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!"
        }
    )
    assert res.status_code == 201
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create Area & Customer with opening balance
    area_res = await async_client.post(
        "/api/v1/parties/areas",
        json={"name": f"North Zone {uid}", "code": f"NZ-{uid[:4]}"},
        headers=headers
    )
    assert area_res.status_code == 201
    area_id = area_res.json()["id"]

    cust_res = await async_client.post(
        "/api/v1/parties/customers",
        json={
            "name": f"Reliance Retail Mart {uid}",
            "mobile": f"98{str(uuid.uuid4().int)[:8]}",
            "gst_number": "27AABCR1234A1Z5",
            "area_id": area_id,
            "opening_balance": 5000.0,
            "address": "Shop 12, High Street"
        },
        headers=headers
    )
    assert cust_res.status_code == 201
    cust_id = cust_res.json()["id"]

    # 3. Create Item & Supplier
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Basmati Rice 5kg",
            "barcode": f"890{uid}",
            "hsn_code": "1006",
            "unit": "PCS",
            "purchase_price": 400.0,
            "sale_price": 500.0,
            "gst_rate": 5.0
        },
        headers=headers
    )
    assert item_res.status_code == 201
    item_id = item_res.json()["id"]

    supp_res = await async_client.post(
        "/api/v1/parties/suppliers",
        json={
            "name": f"Agro Millers Ltd {uid}",
            "mobile": f"98{str(uuid.uuid4().int)[:8]}",
            "gst_number": "27AAACA9999A1Z1",
            "opening_balance": 12000.0,
            "address": "Agro Park, Industrial Area"
        },
        headers=headers
    )
    assert supp_res.status_code == 201
    supp_id = supp_res.json()["id"]

    # 4. Inward Stock-In on credit (so we have 20 units in stock)
    stock_in_res = await async_client.post(
        "/api/v1/inventory/stock-in",
        json={
            "supplier_id": supp_id,
            "payment_mode": "credit",
            "paid_amount": 0.0,
            "items": [
                {
                    "item_id": item_id,
                    "quantity": 20.0,
                    "purchase_price": 400.0,
                }
            ]
        },
        headers=headers
    )
    assert stock_in_res.status_code == 200

    # 5. Create an Unpaid Sale Bill for the customer (deducts 10 units from stock)
    bill_res = await async_client.post(
        "/api/v1/bills",
        json={
            "type": "sale",
            "party_id": cust_id,
            "party_name": "Reliance Retail Mart",
            "party_mobile": "9811122233",
            "party_gst": "27AABCR1234A1Z5",
            "is_interstate": False,
            "payment_mode": "credit",
            "payment_status": "unpaid",
            "paid_amount": 0.0,
            "items": [
                {
                    "item_id": item_id,
                    "item_name": "Basmati Rice 5kg",
                    "hsn_code": "1006",
                    "quantity": 10.0,
                    "unit": "PCS",
                    "rate": 500.0,
                    "discount_amount": 0.0,
                    "gst_rate": 5.0,
                    "is_tax_inclusive": False
                }
            ]
        },
        headers=headers
    )
    assert bill_res.status_code == 201
    bill_data = bill_res.json()
    bill_id = bill_data["id"]

    # 6. Query Debtors Ageing Report
    debtors_res = await async_client.get(
        "/api/v1/reports/debtors-ageing",
        headers=headers
    )
    assert debtors_res.status_code == 200
    debtors_data = debtors_res.json()
    assert debtors_data["total_debtors"] >= 1
    # Customer balance = 5000 (opening) + 5250 (bill) = 10250.0
    assert debtors_data["total_outstanding"] >= 10250.0
    assert debtors_data["bucket_0_30_total"] >= 5250.0

    # 7. Query Creditors Ageing Report
    creditors_res = await async_client.get(
        "/api/v1/reports/creditors-ageing",
        headers=headers
    )
    assert creditors_res.status_code == 200
    creditors_data = creditors_res.json()
    assert creditors_data["total_creditors"] >= 1
    # Supplier balance = 12000 (opening) + 8000 (stock in) = 20000.0
    assert creditors_data["total_outstanding"] >= 20000.0


@pytest.mark.asyncio
async def test_automated_payment_reminders_and_whatsapp(async_client: AsyncClient):
    uid = str(uuid.uuid4())[:8]
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Quick Mart Services {uid}",
            "admin_name": "Vikram Seth",
            "mobile_number": f"97{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!"
        }
    )
    assert res.status_code == 201
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create Overdue Customer
    cust_res = await async_client.post(
        "/api/v1/parties/customers",
        json={
            "name": f"Pooja Stores {uid}",
            "mobile": "9822334455",
            "opening_balance": 3500.0
        },
        headers=headers
    )
    assert cust_res.status_code == 201
    cust_id = cust_res.json()["id"]

    # 3. Get Due Payment Reminders
    rem_res = await async_client.get(
        "/api/v1/reports/reminders/due",
        headers=headers
    )
    assert rem_res.status_code == 200
    rem_data = rem_res.json()
    assert rem_data["total_customers"] >= 1
    matching = [r for r in rem_data["reminders"] if r["customer_id"] == cust_id]
    assert len(matching) == 1
    rem = matching[0]
    assert f"Pooja Stores {uid}" in rem["customer_name"]
    assert rem["total_due"] == 3500.0
    assert f"Quick Mart Services {uid}" in rem["message_text"]
    assert "wa.me/919822334455" in rem["whatsapp_url"]


@pytest.mark.asyncio
async def test_gstr1_gstr3b_and_einvoice_compliance(async_client: AsyncClient):
    uid = str(uuid.uuid4())[:8]
    # 1. Admin Signup
    res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": f"Apex Electronics Ltd {uid}",
            "admin_name": "Anil Agarwal",
            "mobile_number": f"97{str(uuid.uuid4().int)[:8]}",
            "password": "Password123!"
        }
    )
    assert res.status_code == 201
    admin_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create B2B Customer with GSTIN
    b2b_cust = await async_client.post(
        "/api/v1/parties/customers",
        json={
            "name": f"Tata Croma Retail {uid}",
            "mobile": "9988776655",
            "gst_number": "27AAACT2727A1ZB",
            "address": "Phoenix Mall, Lower Parel"
        },
        headers=headers
    )
    assert b2b_cust.status_code == 201
    b2b_cust_id = b2b_cust.json()["id"]

    # 3. Create Item & Supplier
    item_res = await async_client.post(
        "/api/v1/items",
        json={
            "name": "Wireless Headphones Pro",
            "barcode": f"890{uid}",
            "hsn_code": "8518",
            "unit": "PCS",
            "purchase_price": 2000.0,
            "sale_price": 3000.0,
            "gst_rate": 18.0
        },
        headers=headers
    )
    assert item_res.status_code == 201
    item_id = item_res.json()["id"]

    supp_res = await async_client.post(
        "/api/v1/parties/suppliers",
        json={
            "name": f"Sony OEM Distributor {uid}",
            "mobile": "9988001122",
            "gst_number": "27AAACS1010A1Z9"
        },
        headers=headers
    )
    assert supp_res.status_code == 201
    supp_id = supp_res.json()["id"]

    # Inward stock purchase to generate stock and ITC
    stock_in_res = await async_client.post(
        "/api/v1/inventory/stock-in",
        json={
            "supplier_id": supp_id,
            "payment_mode": "credit",
            "paid_amount": 0.0,
            "items": [
                {
                    "item_id": item_id,
                    "quantity": 10.0,
                    "purchase_price": 2000.0,
                }
            ]
        },
        headers=headers
    )
    assert stock_in_res.status_code == 200

    # 4. Create B2B Sale Bill
    b2b_bill_res = await async_client.post(
        "/api/v1/bills",
        json={
            "type": "sale",
            "party_id": b2b_cust_id,
            "party_name": "Tata Croma Retail",
            "party_gst": "27AAACT2727A1ZB",
            "is_interstate": False,
            "payment_mode": "upi",
            "payment_status": "paid",
            "paid_amount": 3540.0,
            "items": [
                {
                    "item_id": item_id,
                    "item_name": "Wireless Headphones Pro",
                    "hsn_code": "8518",
                    "quantity": 1.0,
                    "unit": "PCS",
                    "rate": 3000.0,
                    "discount_amount": 0.0,
                    "gst_rate": 18.0,
                    "is_tax_inclusive": False
                }
            ]
        },
        headers=headers
    )
    assert b2b_bill_res.status_code == 201
    b2b_bill = b2b_bill_res.json()
    b2b_bill_id = b2b_bill["id"]

    # 5. Test E-Invoicing for B2B Bill
    einv_res = await async_client.post(
        f"/api/v1/reports/einvoice/{b2b_bill_id}/generate",
        headers=headers
    )
    assert einv_res.status_code == 200
    einv_data = einv_res.json()
    assert einv_data["is_b2b"] is True
    assert einv_data["irn"] is not None
    assert len(einv_data["irn"]) == 64  # Valid 64-char SHA256 IRN hash
    assert einv_data["ack_no"] is not None
    assert einv_data["signed_qr_data"] is not None
    assert einv_data["dynamic_upi_qr"] is not None

    # 6. Test GSTR-1 Report View & JSON Export
    gstr1_res = await async_client.get(
        "/api/v1/reports/gstr-1",
        headers=headers
    )
    assert gstr1_res.status_code == 200
    gstr1_data = gstr1_res.json()
    assert gstr1_data["summary"]["total_invoices"] >= 1
    assert len(gstr1_data["b2b"]) >= 1
    assert gstr1_data["b2b"][0]["ctin"] == "27AAACT2727A1ZB"
    assert len(gstr1_data["hsn_summary"]) >= 1
    assert gstr1_data["hsn_summary"][0]["hsn_code"] == "8518"

    # GSTN offline tool JSON export
    gstr1_json_export = await async_client.get(
        "/api/v1/reports/gstr-1/json",
        headers=headers
    )
    assert gstr1_json_export.status_code == 200
    offline_json = gstr1_json_export.json()
    assert "b2b" in offline_json
    assert "hsn" in offline_json

    # GSTR-1 CSV export
    gstr1_csv_export = await async_client.get(
        "/api/v1/reports/gstr-1/csv",
        headers=headers
    )
    assert gstr1_csv_export.status_code == 200
    assert "GSTR-1 OUTWARD SUPPLIES REPORT" in gstr1_csv_export.text

    # 7. Test GSTR-3B Report View & Exports
    gstr3b_res = await async_client.get(
        "/api/v1/reports/gstr-3b",
        headers=headers
    )
    assert gstr3b_res.status_code == 200
    gstr3b_data = gstr3b_res.json()
    # Check Table 3.1 outward tax
    assert gstr3b_data["outward_supplies"]["taxable_outward"]["taxable_value"] >= 3000.0
    # Check Table 4 ITC inward tax
    assert gstr3b_data["eligible_itc"]["all_other_itc"]["cgst"] >= 180.0
    # Check Net Tax Payable
    assert "total_cash_tax_payable" in gstr3b_data["net_tax_payable"]

    # GSTR-3B CSV Export
    gstr3b_csv_export = await async_client.get(
        "/api/v1/reports/gstr-3b/csv",
        headers=headers
    )
    assert gstr3b_csv_export.status_code == 200
    assert "GSTR-3B MONTHLY SUMMARY RETURN" in gstr3b_csv_export.text
