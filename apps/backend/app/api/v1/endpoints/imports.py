from typing import Optional
from fastapi import APIRouter, Depends, Request, status, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user, require_permission
from app.models.user import User
from app.schemas.subscription import CSVImportSummaryResponse
from app.services.csv_import_service import (
    import_items_from_csv,
    import_customers_from_csv,
    import_suppliers_from_csv,
    generate_sample_csv_template,
)

router = APIRouter()


async def _extract_csv_text(request: Request) -> str:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        if uploaded_file and hasattr(uploaded_file, "read"):
            content_bytes = await uploaded_file.read()
            return content_bytes.decode("utf-8-sig", errors="replace")
        elif "csv_content" in form:
            return str(form.get("csv_content"))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either a CSV file or csv_content in form data",
        )
    elif "application/json" in content_type:
        try:
            body = await request.json()
            csv_text = body.get("csv_content")
            if not csv_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing 'csv_content' field in JSON body",
                )
            return csv_text
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload",
            )
    else:
        # Fallback raw text body
        raw_body = await request.body()
        if raw_body:
            return raw_body.decode("utf-8-sig", errors="replace")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide CSV data via multipart form or JSON body with csv_content",
        )


# ==============================================================================
# 1. Bulk CSV Import Endpoints
# ==============================================================================

@router.post(
    "/items",
    response_model=CSVImportSummaryResponse,
    summary="Bulk Import Products & Stock from CSV",
)
async def bulk_import_items(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
):
    """
    Import items, barcodes, prices, taxes, and initial opening stock batches from CSV.
    """
    csv_text = await _extract_csv_text(request)
    return await import_items_from_csv(
        db=db,
        tenant_id=current_user.tenant_id,
        csv_content=csv_text,
    )


@router.post(
    "/customers",
    response_model=CSVImportSummaryResponse,
    summary="Bulk Import Customers & Balances from CSV",
)
async def bulk_import_customers(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("party.create")),
):
    """
    Import customer parties, GST numbers, areas, and opening balances from CSV.
    """
    csv_text = await _extract_csv_text(request)
    return await import_customers_from_csv(
        db=db,
        tenant_id=current_user.tenant_id,
        csv_content=csv_text,
    )


@router.post(
    "/suppliers",
    response_model=CSVImportSummaryResponse,
    summary="Bulk Import Suppliers & Balances from CSV",
)
async def bulk_import_suppliers(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("party.create")),
):
    """
    Import supplier parties, GST numbers, and opening balances from CSV.
    """
    csv_text = await _extract_csv_text(request)
    return await import_suppliers_from_csv(
        db=db,
        tenant_id=current_user.tenant_id,
        csv_content=csv_text,
    )


# ==============================================================================
# 2. Downloadable Sample CSV Templates
# ==============================================================================

@router.get(
    "/template/{entity_type}",
    summary="Download Sample CSV Template for Data Import",
)
async def download_import_template(
    entity_type: str,
    current_user: User = Depends(get_current_user),
):
    """
    Download structured CSV templates for 'items', 'customers', or 'suppliers'.
    """
    filename, content = generate_sample_csv_template(entity_type)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
