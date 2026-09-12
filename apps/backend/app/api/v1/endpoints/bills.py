from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Response, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.schemas.bill import (
    BillCreateRequest,
    BillUpdateRequest,
    BillResponse,
    OfflineSyncBatchRequest,
    OfflineSyncBatchResponse,
)
from app.models.bill import Bill
from app.models.tenant import Tenant
from app.models.user import User
from app.api.deps import get_current_user, require_permission, require_admin
from app.services.bill_service import (
    create_bill,
    list_bills,
    get_staff_bills_review_queue,
    update_bill_by_admin,
    delete_bill_by_admin,
    sync_offline_bills,
    format_bill_response,
)
from app.services.pdf_service import generate_bill_pdf
from app.services.whatsapp_service import generate_whatsapp_share_payload

router = APIRouter()


@router.post("", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def make_bill(
    payload: BillCreateRequest,
    request: Request,
    current_user: User = Depends(require_permission("bill.create")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new bill (available to BOTH Admin and Sub-users / Staff)"""
    client_ip = request.client.host if request.client else None
    return await create_bill(
        db=db,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        payload=payload,
        client_ip=client_ip
    )


@router.get("", response_model=List[BillResponse])
async def get_all_bills(
    bill_type: Optional[str] = Query(None, description="Filter by type: sale, purchase, credit_note"),
    payment_status: Optional[str] = Query(None, description="Filter by payment status: paid, partial, unpaid"),
    search: Optional[str] = Query(None, description="Search by bill number, party name, mobile"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List bills (Admin sees all; Sub-user sees their own if limited permission)"""
    return await list_bills(
        db=db,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        bill_type=bill_type,
        payment_status=payment_status,
        search=search
    )


@router.get("/staff/review", response_model=List[BillResponse])
async def get_staff_review_bills(
    current_user: User = Depends(require_permission("bill.edit")),
    db: AsyncSession = Depends(get_db)
):
    """Admin Staff Bills Review: queue of bills entered by staff for Admin inspection"""
    return await get_staff_bills_review_queue(db=db, tenant_id=current_user.tenant_id)


@router.post("/sync", response_model=OfflineSyncBatchResponse)
async def sync_offline_batch(
    payload: OfflineSyncBatchRequest,
    request: Request,
    current_user: User = Depends(require_permission("bill.create")),
    db: AsyncSession = Depends(get_db)
):
    """Sync a batch of offline-created bills idempotently using client UUIDs"""
    client_ip = request.client.host if request.client else None
    return await sync_offline_bills(
        db=db,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        payload=payload,
        client_ip=client_ip
    )


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill_detail(
    bill_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get single bill details with line items"""
    result = await db.execute(
        select(Bill).where(Bill.tenant_id == current_user.tenant_id, Bill.id == bill_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return format_bill_response(bill)


@router.put("/{bill_id}", response_model=BillResponse)
async def edit_bill(
    bill_id: str,
    payload: BillUpdateRequest,
    request: Request,
    current_user: User = Depends(require_permission("bill.edit")),
    db: AsyncSession = Depends(get_db)
):
    """Admin edits or corrects an existing bill (FORBIDDEN FOR SUB-USERS)"""
    client_ip = request.client.host if request.client else None
    return await update_bill_by_admin(
        db=db,
        tenant_id=current_user.tenant_id,
        admin_user=current_user,
        bill_id=bill_id,
        payload=payload,
        client_ip=client_ip
    )


@router.delete("/{bill_id}", status_code=status.HTTP_200_OK)
async def void_bill(
    bill_id: str,
    request: Request,
    current_user: User = Depends(require_permission("bill.delete")),
    db: AsyncSession = Depends(get_db)
):
    """Admin voids/cancels an existing bill (FORBIDDEN FOR SUB-USERS)"""
    client_ip = request.client.host if request.client else None
    await delete_bill_by_admin(
        db=db,
        tenant_id=current_user.tenant_id,
        admin_user=current_user,
        bill_id=bill_id,
        client_ip=client_ip
    )
    return {"message": "Bill voided successfully"}


@router.get("/{bill_id}/pdf")
async def download_invoice_pdf(
    bill_id: str,
    format: Optional[str] = Query("a4", description="Paper size: a4 (full page) or a5 (half-A4 sheet)"),
    terms: Optional[str] = Query(None, description="Custom terms & conditions text or 'none' to omit"),
    include_terms: Optional[bool] = Query(True, description="Whether to include terms and conditions"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate and download GST-compliant PDF Tax Invoice (A4 Full Page or A5 Half-A4 Sheet)"""
    result = await db.execute(
        select(Bill)
        .options(selectinload(Bill.customer), selectinload(Bill.creator))
        .where(Bill.tenant_id == current_user.tenant_id, Bill.id == bill_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    tenant_res = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = tenant_res.scalar_one()

    # Determine effective terms & conditions (selected by owner / optional)
    effective_terms = None
    if include_terms:
        effective_terms = terms if terms is not None else bill.terms_conditions
    else:
        effective_terms = "none"

    pdf_bytes = generate_bill_pdf(
        bill=bill,
        tenant=tenant,
        paper_format=format or "a4",
        terms_conditions=effective_terms
    )
    suffix = "_A5_HalfSheet" if format in ["a5", "half_a4", "half-a4"] else ""
    filename = f"{bill.bill_number}{suffix}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )


@router.post("/{bill_id}/share-whatsapp")
async def get_whatsapp_share_link(
    bill_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate WhatsApp direct share link and message preview"""
    result = await db.execute(
        select(Bill).where(Bill.tenant_id == current_user.tenant_id, Bill.id == bill_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    tenant_res = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = tenant_res.scalar_one()

    return generate_whatsapp_share_payload(bill=bill, tenant=tenant)
