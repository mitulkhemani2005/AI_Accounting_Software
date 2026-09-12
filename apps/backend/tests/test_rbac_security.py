import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sub_user_server_side_rbac_restrictions(async_client: AsyncClient):
    """
    CRITICAL SECURITY TEST (Rule 5 & Phase 1 Checkpoint):
    Sub-users can create bills, but MUST NEVER be able to edit or delete bills,
    manage users, or view accounting ledgers, strictly enforced at the API layer.
    """
    # 1. Setup Tenant + Admin
    admin_signup = await async_client.post(
        "/api/v1/auth/signup-admin",
        json={
            "business_name": "Patel Provision Store",
            "gst_number": "24AABCU9603R1ZM",
            "admin_name": "Kirit Patel",
            "mobile_number": "9900112233",
            "password": "Password123!"
        }
    )
    assert admin_signup.status_code == 201
    admin_token = admin_signup.json()["access_token"]

    # 2. Add Sub-user (Staff)
    staff_create = await async_client.post(
        "/api/v1/users/sub-users",
        json={
            "name": "Karan Staff",
            "mobile_number": "9900112244",
            "pin": "4321",
            "role_name": "sub_user"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert staff_create.status_code == 201

    # 3. Login as Sub-user
    staff_login = await async_client.post(
        "/api/v1/auth/login-staff",
        json={"mobile_number": "9900112244", "pin": "4321"}
    )
    assert staff_login.status_code == 200
    staff_token = staff_login.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # =========================================================================
    # Test A: Bill Creation (Allowed for BOTH Admin and Sub-user)
    # =========================================================================
    res_admin_bill = await async_client.post("/api/v1/test-rbac/bill-create-test", headers=admin_headers)
    assert res_admin_bill.status_code == 200

    res_staff_bill = await async_client.post("/api/v1/test-rbac/bill-create-test", headers=staff_headers)
    assert res_staff_bill.status_code == 200
    assert res_staff_bill.json()["message"] == "Bill creation allowed"

    # =========================================================================
    # Test B: Bill Edit (Allowed for Admin, MUST BE 403 Forbidden for Sub-user)
    # =========================================================================
    res_admin_edit = await async_client.put("/api/v1/test-rbac/bill-edit-test", headers=admin_headers)
    assert res_admin_edit.status_code == 200

    res_staff_edit = await async_client.put("/api/v1/test-rbac/bill-edit-test", headers=staff_headers)
    assert res_staff_edit.status_code == 403
    assert "Permission denied" in res_staff_edit.json()["detail"]

    # =========================================================================
    # Test C: Bill Delete (Allowed for Admin, MUST BE 403 Forbidden for Sub-user)
    # =========================================================================
    res_admin_delete = await async_client.delete("/api/v1/test-rbac/bill-delete-test", headers=admin_headers)
    assert res_admin_delete.status_code == 200

    res_staff_delete = await async_client.delete("/api/v1/test-rbac/bill-delete-test", headers=staff_headers)
    assert res_staff_delete.status_code == 403
    assert "Permission denied" in res_staff_delete.json()["detail"]

    # =========================================================================
    # Test D: Accounting Books Access (MUST BE 403 Forbidden for Sub-user)
    # =========================================================================
    res_admin_acc = await async_client.get("/api/v1/test-rbac/accounting-books-test", headers=admin_headers)
    assert res_admin_acc.status_code == 200

    res_staff_acc = await async_client.get("/api/v1/test-rbac/accounting-books-test", headers=staff_headers)
    assert res_staff_acc.status_code == 403

    # =========================================================================
    # Test E: Sub-user attempting to create another user (MUST BE 403 Forbidden)
    # =========================================================================
    res_staff_create_user = await async_client.post(
        "/api/v1/users/sub-users",
        json={"name": "Hacker", "mobile_number": "9999999999", "pin": "1111"},
        headers=staff_headers
    )
    assert res_staff_create_user.status_code == 403

    # =========================================================================
    # Test F: Sub-user attempting to view audit logs (MUST BE 403 Forbidden)
    # =========================================================================
    res_staff_audit = await async_client.get("/api/v1/tenants/audit-logs", headers=staff_headers)
    assert res_staff_audit.status_code == 403
