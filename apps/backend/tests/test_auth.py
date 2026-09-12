import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_signup_and_login(async_client: AsyncClient):
    # 1. Admin Signup
    signup_payload = {
        "business_name": "Sharma Supermarket",
        "gst_number": "27AABCU9603R1ZM",
        "admin_name": "Rajesh Sharma",
        "mobile_number": "9876543210",
        "email": "rajesh@sharmastore.in",
        "password": "Password123!",
        "pin": "1234"
    }
    signup_res = await async_client.post("/api/v1/auth/signup-admin", json=signup_payload)
    assert signup_res.status_code == 201
    data = signup_res.json()
    assert "access_token" in data
    assert data["user"]["name"] == "Rajesh Sharma"
    assert data["user"]["role"] == "admin"
    assert data["tenant"]["business_name"] == "Sharma Supermarket"
    assert "bill.create" in data["permissions"]
    assert "bill.edit" in data["permissions"]
    assert "bill.delete" in data["permissions"]
    assert "accounting.manage" in data["permissions"]
    assert "billing_pos" in data["entitlements"]

    admin_token = data["access_token"]

    # 2. Verify /auth/me
    me_res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["name"] == "Rajesh Sharma"
    assert me_data["role"] == "admin"
    assert me_data["tenant_name"] == "Sharma Supermarket"

    # 3. Admin Login with Mobile
    login_res = await async_client.post(
        "/api/v1/auth/login-admin",
        json={"login_identifier": "9876543210", "password": "Password123!"}
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # 4. Admin Login with Email
    login_res2 = await async_client.post(
        "/api/v1/auth/login-admin",
        json={"login_identifier": "rajesh@sharmastore.in", "password": "Password123!"}
    )
    assert login_res2.status_code == 200


@pytest.mark.asyncio
async def test_sub_user_creation_and_pin_login(async_client: AsyncClient):
    # 1. Signup Admin first
    signup_payload = {
        "business_name": "Gupta Medical Store",
        "gst_number": "27AABCU9603R2ZM",
        "admin_name": "Sunil Gupta",
        "mobile_number": "9822001122",
        "email": "sunil@guptamedical.in",
        "password": "Password123!",
    }
    signup_res = await async_client.post("/api/v1/auth/signup-admin", json=signup_payload)
    assert signup_res.status_code == 201
    admin_token = signup_res.json()["access_token"]

    # 2. Admin adds Staff / Sub-user
    sub_user_payload = {
        "name": "Ramesh Staff",
        "mobile_number": "9111223344",
        "pin": "5678",
        "role_name": "sub_user"
    }
    create_staff_res = await async_client.post(
        "/api/v1/users/sub-users",
        json=sub_user_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert create_staff_res.status_code == 201
    staff_info = create_staff_res.json()
    assert staff_info["name"] == "Ramesh Staff"
    assert staff_info["role_name"] == "sub_user"

    # 3. Staff Login via Mobile + PIN
    staff_login_res = await async_client.post(
        "/api/v1/auth/login-staff",
        json={"mobile_number": "9111223344", "pin": "5678"}
    )
    assert staff_login_res.status_code == 200
    staff_auth = staff_login_res.json()
    assert staff_auth["user"]["name"] == "Ramesh Staff"
    assert staff_auth["user"]["role"] == "sub_user"
    assert "bill.create" in staff_auth["permissions"]
    # Staff must NOT have edit/delete/accounting permissions in claims
    assert "bill.edit" not in staff_auth["permissions"]
    assert "bill.delete" not in staff_auth["permissions"]
    assert "accounting.manage" not in staff_auth["permissions"]

    # 4. Incorrect PIN rejection
    bad_pin_res = await async_client.post(
        "/api/v1/auth/login-staff",
        json={"mobile_number": "9111223344", "pin": "0000"}
    )
    assert bad_pin_res.status_code == 401
