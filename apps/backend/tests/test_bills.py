import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_bill_creation_rbac_and_features(async_client: AsyncClient):
    # 1. Signup Admin
    signup_res = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": "Bharat Stores",
            "gst_number": "27AABCU9603R1ZM",
            "admin_name": "Bharat Patel",
            "mobile_number": "9500000001",
            "password": "Password123!"
        }
    )
    admin_token = signup_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Admin adds Staff Sub-user
    staff_create = await async_client.post(
        "/api/v1/users/sub-users",
        json={"name": "Pooja Staff", "mobile_number": "9500000002", "pin": "7777"},
        headers=admin_headers
    )
    assert staff_create.status_code == 201

    # 3. Staff Login
    staff_login = await async_client.post(
        "/api/v1/auth/login-staff",
        json={"mobile_number": "9500000002", "pin": "7777"}
    )
    staff_token = staff_login.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # 4. Staff Creates a Counter Sale Bill (ALLOWED)
    bill_payload = {
        "type": "sale",
        "party_name": "Walk-in Retail Customer",
        "party_mobile": "9800000001",
        "payment_mode": "upi",
        "payment_status": "paid",
        "items": [
            {
                "item_name": "Sunflower Oil 1L",
                "hsn_code": "1512",
                "quantity": 2,
                "unit": "LTR",
                "rate": 150.0,
                "discount_amount": 0.0,
                "gst_rate": 5.0
            },
            {
                "item_name": "Wheat Flour 10kg",
                "hsn_code": "1101",
                "quantity": 1,
                "unit": "BAG",
                "rate": 450.0,
                "discount_amount": 20.0,
                "gst_rate": 0.0
            }
        ]
    }
    create_res = await async_client.post("/api/v1/bills", json=bill_payload, headers=staff_headers)
    assert create_res.status_code == 201
    bill_data = create_res.json()
    assert bill_data["bill_number"].startswith("INV-")
    assert bill_data["total_amount"] > 0
    bill_id = bill_data["id"]

    # =========================================================================
    # Rule 5 & Phase 2 Restriction: Sub-user CANNOT edit or delete bill
    # =========================================================================
    edit_res = await async_client.put(
        f"/api/v1/bills/{bill_id}",
        json={"party_name": "Hacked Customer"},
        headers=staff_headers
    )
    assert edit_res.status_code == 403
    assert "Permission denied" in edit_res.json()["detail"]

    del_res = await async_client.delete(
        f"/api/v1/bills/{bill_id}",
        headers=staff_headers
    )
    assert del_res.status_code == 403
    assert "Permission denied" in del_res.json()["detail"]

    # =========================================================================
    # Admin Staff Bills Review queue & edit capability
    # =========================================================================
    review_queue = await async_client.get("/api/v1/bills/staff/review", headers=admin_headers)
    assert review_queue.status_code == 200
    queue_data = review_queue.json()
    assert any(b["id"] == bill_id for b in queue_data)

    # Admin edits bill
    admin_edit = await async_client.put(
        f"/api/v1/bills/{bill_id}",
        json={"notes": "Reviewed and approved by Admin Bharat"},
        headers=admin_headers
    )
    assert admin_edit.status_code == 200
    assert admin_edit.json()["notes"] == "Reviewed and approved by Admin Bharat"

    # =========================================================================
    # PDF Generation & WhatsApp Share Link
    # =========================================================================
    pdf_res = await async_client.get(f"/api/v1/bills/{bill_id}/pdf", headers=admin_headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 500

    wa_res = await async_client.post(f"/api/v1/bills/{bill_id}/share-whatsapp", headers=admin_headers)
    assert wa_res.status_code == 200
    wa_data = wa_res.json()
    assert "https://wa.me/" in wa_data["whatsapp_url"]
    assert "TAX INVOICE" in wa_data["message_text"]

    # =========================================================================
    # Offline Batch Sync with Client UUID Idempotency
    # =========================================================================
    offline_id = "offline-uuid-999-aaa"
    sync_payload = {
        "bills": [
            {
                "type": "sale",
                "party_name": "Offline Customer",
                "offline_sync_id": offline_id,
                "items": [
                    {
                        "item_name": "Sugar 1kg",
                        "quantity": 5,
                        "rate": 42.0,
                        "gst_rate": 5.0
                    }
                ]
            }
        ]
    }
    sync_res1 = await async_client.post("/api/v1/bills/sync", json=sync_payload, headers=staff_headers)
    assert sync_res1.status_code == 200
    assert sync_res1.json()["synced_count"] == 1

    # Repeating sync must NOT create duplicate bill
    sync_res2 = await async_client.post("/api/v1/bills/sync", json=sync_payload, headers=staff_headers)
    assert sync_res2.status_code == 200
    assert sync_res2.json()["synced_bills"][0]["offline_sync_id"] == offline_id
