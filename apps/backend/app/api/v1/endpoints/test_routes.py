from fastapi import APIRouter, Depends, status
from app.api.deps import require_permission, require_module_entitlement, get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/bill-create-test", status_code=status.HTTP_200_OK)
async def test_bill_create(user: User = Depends(require_permission("bill.create"))):
    """Test route: both admin and sub-user have bill.create"""
    return {"message": "Bill creation allowed", "user": user.name, "role": user.role.name}


@router.put("/bill-edit-test", status_code=status.HTTP_200_OK)
async def test_bill_edit(user: User = Depends(require_permission("bill.edit"))):
    """Test route: only admin has bill.edit; sub-users must get 403 Forbidden"""
    return {"message": "Bill edit allowed", "user": user.name}


@router.delete("/bill-delete-test", status_code=status.HTTP_200_OK)
async def test_bill_delete(user: User = Depends(require_permission("bill.delete"))):
    """Test route: only admin has bill.delete; sub-users must get 403 Forbidden"""
    return {"message": "Bill delete allowed", "user": user.name}


@router.get("/accounting-books-test", status_code=status.HTTP_200_OK)
async def test_accounting_books(
    user: User = Depends(require_permission("accounting.manage")),
    _entitled: User = Depends(require_module_entitlement("accounting"))
):
    """Test route: requires accounting.manage permission and accounting module entitlement"""
    return {"message": "Accounting books access granted", "tenant_id": user.tenant_id}
