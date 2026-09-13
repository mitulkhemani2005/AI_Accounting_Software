from typing import List, Optional
from datetime import datetime, date
import json
import csv
import io
from fastapi import APIRouter, Depends, Query, Request, status, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user, require_permission
from app.models.user import User
from app.schemas.report import (
    DebtorsAgeingResponse,
    CreditorsAgeingResponse,
    PaymentRemindersResponse,
    PaymentReminderSendRequest,
    GSTR1ReportResponse,
    GSTR3BReportResponse,
    EInvoiceResponse,
)
from app.services.ageing_service import (
    compute_debtors_ageing,
    compute_creditors_ageing,
    generate_payment_reminders,
)
from app.services.gst_compliance_service import (
    generate_gstr1_report,
    generate_gstr1_offline_tool_json,
    generate_gstr3b_report,
)
from app.services.einvoice_service import generate_einvoice_for_bill

router = APIRouter()


# ==============================================================================
# 1. Sundry Debtors & Creditors Ageing Reports
# ==============================================================================

@router.get(
    "/debtors-ageing",
    response_model=DebtorsAgeingResponse,
    summary="Get Sundry Debtors (Customer Receivables) Ageing Report",
)
async def get_debtors_ageing_report(
    as_of_date: Optional[date] = Query(None, description="Reference calculation date (YYYY-MM-DD)"),
    min_amount: float = Query(0.0, ge=0, description="Filter customers with minimum balance"),
    area_id: Optional[str] = Query(None, description="Filter by customer area"),
    customer_id: Optional[str] = Query(None, description="Filter by single customer"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    """
    Returns customer balances aged across 0-30, 31-60, 61-90, and >90 days
    with detailed overdue bill breakdowns.
    """
    return await compute_debtors_ageing(
        db=db,
        tenant_id=current_user.tenant_id,
        as_of_date=as_of_date,
        min_amount=min_amount,
        area_id=area_id,
        customer_id=customer_id,
    )


@router.get(
    "/debtors-ageing/csv",
    summary="Download Sundry Debtors Ageing Report in CSV",
)
async def export_debtors_ageing_csv(
    as_of_date: Optional[date] = Query(None),
    min_amount: float = Query(0.0, ge=0),
    area_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    report = await compute_debtors_ageing(
        db=db,
        tenant_id=current_user.tenant_id,
        as_of_date=as_of_date,
        min_amount=min_amount,
        area_id=area_id,
        customer_id=customer_id,
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["SUNDRY DEBTORS (CUSTOMER RECEIVABLES) AGEING REPORT"])
    writer.writerow(["As of Date", report.as_of_date, "Total Debtors", report.total_debtors, "Total Outstanding (INR)", report.total_outstanding])
    writer.writerow(["0-30 Days Total", report.bucket_0_30_total, "31-60 Days Total", report.bucket_31_60_total, "61-90 Days Total", report.bucket_61_90_total, ">90 Days Total", report.bucket_above_90_total])
    writer.writerow([])
    writer.writerow(["Customer Name", "Mobile", "GSTIN", "Area", "0-30 Days (INR)", "31-60 Days (INR)", "61-90 Days (INR)", ">90 Days (INR)", "Total Due (INR)", "Overdue Invoices Count"])
    for c in report.customers:
        writer.writerow([
            c.customer_name,
            c.mobile or "",
            c.gst_number or "",
            c.area_name or "General",
            c.bucket_0_30,
            c.bucket_31_60,
            c.bucket_61_90,
            c.bucket_above_90,
            c.total_due,
            len(c.overdue_bills),
        ])
    filename = f"Debtors_Ageing_{report.as_of_date}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/creditors-ageing",
    response_model=CreditorsAgeingResponse,
    summary="Get Sundry Creditors (Supplier Payables) Ageing Report",
)
async def get_creditors_ageing_report(
    as_of_date: Optional[date] = Query(None, description="Reference calculation date (YYYY-MM-DD)"),
    min_amount: float = Query(0.0, ge=0, description="Filter suppliers with minimum balance"),
    supplier_id: Optional[str] = Query(None, description="Filter by single supplier"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    """
    Returns supplier payables aged across 0-30, 31-60, 61-90, and >90 days
    with purchase bill references.
    """
    return await compute_creditors_ageing(
        db=db,
        tenant_id=current_user.tenant_id,
        as_of_date=as_of_date,
        min_amount=min_amount,
        supplier_id=supplier_id,
    )


@router.get(
    "/creditors-ageing/csv",
    summary="Download Sundry Creditors Ageing Report in CSV",
)
async def export_creditors_ageing_csv(
    as_of_date: Optional[date] = Query(None),
    min_amount: float = Query(0.0, ge=0),
    supplier_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    report = await compute_creditors_ageing(
        db=db,
        tenant_id=current_user.tenant_id,
        as_of_date=as_of_date,
        min_amount=min_amount,
        supplier_id=supplier_id,
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["SUNDRY CREDITORS (SUPPLIER PAYABLES) AGEING REPORT"])
    writer.writerow(["As of Date", report.as_of_date, "Total Creditors", report.total_creditors, "Total Outstanding (INR)", report.total_outstanding])
    writer.writerow(["0-30 Days Total", report.bucket_0_30_total, "31-60 Days Total", report.bucket_31_60_total, "61-90 Days Total", report.bucket_61_90_total, ">90 Days Total", report.bucket_above_90_total])
    writer.writerow([])
    writer.writerow(["Supplier Name", "Mobile", "GSTIN", "Area", "0-30 Days (INR)", "31-60 Days (INR)", "61-90 Days (INR)", ">90 Days (INR)", "Total Payable (INR)", "Purchase Bills Count"])
    for s in report.suppliers:
        writer.writerow([
            s.supplier_name,
            s.mobile or "",
            s.gst_number or "",
            s.area_name or "General",
            s.bucket_0_30,
            s.bucket_31_60,
            s.bucket_61_90,
            s.bucket_above_90,
            s.total_due,
            len(s.overdue_bills),
        ])
    filename = f"Creditors_Ageing_{report.as_of_date}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ==============================================================================
# 2. Automated Due-Payment Reminders
# ==============================================================================

@router.get(
    "/reminders/due",
    response_model=PaymentRemindersResponse,
    summary="Get Automated Due-Payment Reminders for Overdue Debtors",
)
async def get_due_payment_reminders(
    min_overdue_days: int = Query(0, ge=0, description="Filter minimum overdue days"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("parties.view")),
):
    """
    Generates personalized WhatsApp and SMS payment reminders with 1-click wa.me links.
    """
    return await generate_payment_reminders(
        db=db,
        tenant_id=current_user.tenant_id,
        min_overdue_days=min_overdue_days,
    )


@router.post(
    "/reminders/generate",
    response_model=PaymentRemindersResponse,
    summary="Generate Custom Payment Reminders for Specific Customers",
)
async def generate_custom_reminders(
    payload: PaymentReminderSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("parties.view")),
):
    return await generate_payment_reminders(
        db=db,
        tenant_id=current_user.tenant_id,
        customer_ids=payload.customer_ids,
        min_overdue_days=payload.min_overdue_days,
        custom_note=payload.custom_note,
    )


# ==============================================================================
# 3. GSTR-1 Compliance Reports & Offline Exports
# ==============================================================================

@router.get(
    "/gstr-1",
    response_model=GSTR1ReportResponse,
    summary="Get GSTR-1 Outward Supplies Report",
)
async def get_gstr1_report_view(
    from_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    period: Optional[str] = Query(None, description="Return Period e.g. 092026"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    start = from_date or date(datetime.now().year, datetime.now().month, 1)
    end = to_date or datetime.now().date()
    return await generate_gstr1_report(
        db=db,
        tenant_id=current_user.tenant_id,
        from_date=start,
        to_date=end,
        period_str=period,
    )


@router.get(
    "/gstr-1/json",
    summary="Download GSTR-1 in Official GST Portal Offline Tool JSON Schema",
)
async def export_gstr1_offline_json(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    start = from_date or date(datetime.now().year, datetime.now().month, 1)
    end = to_date or datetime.now().date()
    report = await generate_gstr1_report(
        db=db,
        tenant_id=current_user.tenant_id,
        from_date=start,
        to_date=end,
        period_str=period,
    )
    json_data = generate_gstr1_offline_tool_json(report)
    filename = f"GSTR1_{report.gstin}_{report.period}.json"
    return JSONResponse(
        content=json_data,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/gstr-1/csv",
    summary="Download GSTR-1 B2B & HSN Summary in CSV Format",
)
async def export_gstr1_csv(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    start = from_date or date(datetime.now().year, datetime.now().month, 1)
    end = to_date or datetime.now().date()
    report = await generate_gstr1_report(
        db=db,
        tenant_id=current_user.tenant_id,
        from_date=start,
        to_date=end,
        period_str=period,
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Section 1: Header
    writer.writerow(["GSTR-1 OUTWARD SUPPLIES REPORT"])
    writer.writerow(["GSTIN", report.gstin, "Business Name", report.business_name])
    writer.writerow(["Period", report.period, "From", report.from_date, "To", report.to_date])
    writer.writerow([])

    # Section 2: B2B Invoices
    writer.writerow(["--- B2B INVOICES (TABLE 4) ---"])
    writer.writerow(["Receiver GSTIN", "Receiver Name", "Invoice No", "Date", "Value", "POS", "Rate%", "Taxable", "IGST", "CGST", "SGST"])
    for r in report.b2b:
        for inv in r.invoices:
            for item in inv.items:
                writer.writerow([
                    r.ctin,
                    r.customer_name,
                    inv.invoice_number,
                    inv.invoice_date,
                    inv.invoice_value,
                    inv.pos,
                    item.rate,
                    item.taxable_value,
                    item.igst,
                    item.cgst,
                    item.sgst,
                ])
    writer.writerow([])

    # Section 3: B2CS Summary
    writer.writerow(["--- B2CS SMALL INVOICES (TABLE 7) ---"])
    writer.writerow(["Place of Supply", "Rate%", "Taxable Value", "IGST", "CGST", "SGST"])
    for item in report.b2cs:
        writer.writerow([item.pos, item.rate, item.taxable_value, item.igst, item.cgst, item.sgst])
    writer.writerow([])

    # Section 4: HSN Summary
    writer.writerow(["--- HSN SUMMARY (TABLE 12) ---"])
    writer.writerow(["HSN Code", "Description", "UQC", "Total Qty", "Total Value", "Taxable Value", "IGST", "CGST", "SGST"])
    for h in report.hsn_summary:
        writer.writerow([
            h.hsn_code,
            h.description,
            h.uqc,
            h.total_quantity,
            h.total_value,
            h.taxable_value,
            h.igst,
            h.cgst,
            h.sgst,
        ])

    csv_content = output.getvalue()
    filename = f"GSTR1_{report.gstin}_{report.period}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ==============================================================================
# 4. GSTR-3B Compliance Reports & Offline Exports
# ==============================================================================

@router.get(
    "/gstr-3b",
    response_model=GSTR3BReportResponse,
    summary="Get GSTR-3B Summary Return Report",
)
async def get_gstr3b_report_view(
    from_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    period: Optional[str] = Query(None, description="Return Period e.g. 092026"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    start = from_date or date(datetime.now().year, datetime.now().month, 1)
    end = to_date or datetime.now().date()
    return await generate_gstr3b_report(
        db=db,
        tenant_id=current_user.tenant_id,
        from_date=start,
        to_date=end,
        period_str=period,
    )


@router.get(
    "/gstr-3b/json",
    summary="Download GSTR-3B JSON",
)
async def export_gstr3b_json(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    start = from_date or date(datetime.now().year, datetime.now().month, 1)
    end = to_date or datetime.now().date()
    report = await generate_gstr3b_report(
        db=db,
        tenant_id=current_user.tenant_id,
        from_date=start,
        to_date=end,
        period_str=period,
    )
    filename = f"GSTR3B_{report.gstin}_{report.period}.json"
    return JSONResponse(
        content=report.model_dump(),
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/gstr-3b/csv",
    summary="Download GSTR-3B Return Summary in CSV",
)
async def export_gstr3b_csv(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    start = from_date or date(datetime.now().year, datetime.now().month, 1)
    end = to_date or datetime.now().date()
    report = await generate_gstr3b_report(
        db=db,
        tenant_id=current_user.tenant_id,
        from_date=start,
        to_date=end,
        period_str=period,
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["GSTR-3B MONTHLY SUMMARY RETURN"])
    writer.writerow(["GSTIN", report.gstin, "Business Name", report.business_name])
    writer.writerow(["Period", report.period, "From", report.from_date, "To", report.to_date])
    writer.writerow([])

    # Table 3.1
    writer.writerow(["--- TABLE 3.1: OUTWARD SUPPLIES & TAX LIABILITY ---"])
    writer.writerow(["Nature of Supply", "Total Taxable Value", "Integrated Tax", "Central Tax", "State Tax", "Cess"])
    writer.writerow([
        "(a) Outward Taxable Supplies (Other than zero/nil/exempt)",
        report.outward_supplies.taxable_outward.taxable_value,
        report.outward_supplies.taxable_outward.igst,
        report.outward_supplies.taxable_outward.cgst,
        report.outward_supplies.taxable_outward.sgst,
        report.outward_supplies.taxable_outward.cess,
    ])
    writer.writerow([
        "(c) Other Outward Supplies (Nil rated, exempted)",
        report.outward_supplies.other_outward_exempt.taxable_value,
        0.0, 0.0, 0.0, 0.0,
    ])
    writer.writerow([])

    # Table 4
    writer.writerow(["--- TABLE 4: ELIGIBLE INPUT TAX CREDIT (ITC) ---"])
    writer.writerow(["Details", "Integrated Tax", "Central Tax", "State Tax", "Cess"])
    writer.writerow([
        "(A)(5) All Other ITC (From Inward Purchases)",
        report.eligible_itc.all_other_itc.igst,
        report.eligible_itc.all_other_itc.cgst,
        report.eligible_itc.all_other_itc.sgst,
        report.eligible_itc.all_other_itc.cess,
    ])
    writer.writerow([])

    # Net Cash Tax Payable
    writer.writerow(["--- NET CASH TAX PAYABLE ---"])
    writer.writerow(["Tax Head", "Output Liability", "Eligible ITC", "Net Cash Payable"])
    writer.writerow(["CGST", report.net_tax_payable.cgst_output, report.net_tax_payable.cgst_itc, report.net_tax_payable.cgst_net_payable])
    writer.writerow(["SGST", report.net_tax_payable.sgst_output, report.net_tax_payable.sgst_itc, report.net_tax_payable.sgst_net_payable])
    writer.writerow(["IGST", report.net_tax_payable.igst_output, report.net_tax_payable.igst_itc, report.net_tax_payable.igst_net_payable])
    writer.writerow(["TOTAL CASH TAX PAYABLE", "", "", report.net_tax_payable.total_cash_tax_payable])

    csv_content = output.getvalue()
    filename = f"GSTR3B_{report.gstin}_{report.period}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ==============================================================================
# 5. E-Invoicing (IRN & QR Code Generation)
# ==============================================================================

@router.post(
    "/einvoice/{bill_id}/generate",
    response_model=EInvoiceResponse,
    summary="Generate E-Invoice IRN & QR Code for Bill",
)
async def generate_bill_einvoice(
    bill_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("bills.create")),
):
    """
    Generates standard 64-char SHA256 IRN hash, INV-01 JSON payload, Signed QR Code,
    and Dynamic UPI QR Code for the specified bill.
    """
    return await generate_einvoice_for_bill(
        db=db,
        tenant_id=current_user.tenant_id,
        bill_id=bill_id,
    )


@router.get(
    "/einvoice/{bill_id}",
    response_model=EInvoiceResponse,
    summary="Retrieve E-Invoice IRN & QR Code for Bill",
)
async def get_bill_einvoice(
    bill_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("bills.view")),
):
    return await generate_einvoice_for_bill(
        db=db,
        tenant_id=current_user.tenant_id,
        bill_id=bill_id,
    )
