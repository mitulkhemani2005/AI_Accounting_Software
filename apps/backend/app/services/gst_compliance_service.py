from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone, date
import json
import io
import csv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from app.models.bill import Bill, BillItem
from app.models.tenant import Tenant
from app.schemas.report import (
    GSTR1InvoiceItem,
    GSTR1B2BInvoice,
    GSTR1B2BRecipient,
    GSTR1B2CLInvoice,
    GSTR1B2CSItem,
    GSTR1HSNItem,
    GSTR1DocSummary,
    GSTR1ReportResponse,
    GSTR3BSupplyRow,
    GSTR3BOutwardSupplies,
    GSTR3BITCRow,
    GSTR3BEligibleITC,
    GSTR3BNetTaxPayable,
    GSTR3BReportResponse,
)


def _get_state_code(state_str: Optional[str], gstin: Optional[str] = None) -> str:
    """Helper to derive 2-digit GST state code from GSTIN or state name"""
    if gstin and len(gstin) >= 2 and gstin[:2].isdigit():
        return gstin[:2]
    # Default state code
    return "27"


async def generate_gstr1_report(
    db: AsyncSession,
    tenant_id: str,
    from_date: date,
    to_date: date,
    period_str: Optional[str] = None,
) -> GSTR1ReportResponse:
    """
    Generate complete GSTR-1 Outward Supplies return report containing B2B, B2CL, B2CS,
    HSN summary (Table 12), and Document summary (Table 13).
    """
    # 1. Fetch Tenant
    t_res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = t_res.scalar_one_or_none()
    tenant_gstin = tenant.gst_number if tenant and tenant.gst_number else "UNREGISTERED"
    business_name = tenant.business_name if tenant else "Business"
    tenant_pos = _get_state_code(tenant.state if tenant else None, tenant_gstin)

    # 2. Fetch all Sale Bills in date range
    bills_stmt = (
        select(Bill)
        .options(selectinload(Bill.items))
        .where(
            Bill.tenant_id == tenant_id,
            Bill.type == "sale",
            Bill.status == "active",
            Bill.is_reviewed_by_admin == True,
            func.date(Bill.bill_date) >= from_date,
            func.date(Bill.bill_date) <= to_date,
        )
        .order_by(Bill.bill_date.asc(), Bill.bill_number.asc())
    )
    b_res = await db.execute(bills_stmt)
    bills = b_res.scalars().all()

    # Also count cancelled / void bills in range for doc summary
    void_stmt = (
        select(func.count(Bill.id))
        .where(
            Bill.tenant_id == tenant_id,
            Bill.type == "sale",
            Bill.status.in_(["void", "cancelled"]),
            func.date(Bill.bill_date) >= from_date,
            func.date(Bill.bill_date) <= to_date,
        )
    )
    v_res = await db.execute(void_stmt)
    cancelled_count = v_res.scalar_one() or 0

    # Data structures for sections
    b2b_recipients_map: Dict[str, Dict[str, Any]] = {}
    b2cl_list: List[GSTR1B2CLInvoice] = []
    b2cs_map: Dict[Tuple[str, float], Dict[str, float]] = {}
    hsn_map: Dict[Tuple[str, str], Dict[str, Any]] = {}

    tot_taxable = 0.0
    tot_igst = 0.0
    tot_cgst = 0.0
    tot_sgst = 0.0
    tot_invoice_val = 0.0

    min_bill_no = bills[0].bill_number if bills else "0"
    max_bill_no = bills[-1].bill_number if bills else "0"

    for b in bills:
        inv_val = float(b.total_amount)
        tot_invoice_val += inv_val
        tot_taxable += float(b.taxable_amount)
        tot_igst += float(b.igst_amount)
        tot_cgst += float(b.cgst_amount)
        tot_sgst += float(b.sgst_amount)

        b_date_str = b.bill_date.strftime("%d-%m-%Y")
        buyer_gstin = b.party_gst.strip().upper() if b.party_gst and len(b.party_gst.strip()) >= 15 else None
        buyer_pos = _get_state_code(None, buyer_gstin) if buyer_gstin else tenant_pos

        # Aggregate items on this invoice by gst_rate
        rate_items_map: Dict[float, Dict[str, float]] = {}
        for item in b.items:
            rate = float(item.gst_rate)
            rate_items_map.setdefault(
                rate, {"taxable": 0.0, "igst": 0.0, "cgst": 0.0, "sgst": 0.0}
            )
            rate_items_map[rate]["taxable"] += float(item.taxable_amount)
            rate_items_map[rate]["igst"] += float(item.igst_amount)
            rate_items_map[rate]["cgst"] += float(item.cgst_amount)
            rate_items_map[rate]["sgst"] += float(item.sgst_amount)

            # Accumulate HSN Table 12
            hsn = (item.hsn_code or "9999").strip()
            unit = (item.unit or "PCS").strip().upper()
            hsn_key = (hsn, unit)
            if hsn_key not in hsn_map:
                hsn_map[hsn_key] = {
                    "hsn_code": hsn,
                    "description": item.item_name,
                    "uqc": unit,
                    "total_quantity": 0.0,
                    "total_value": 0.0,
                    "taxable_value": 0.0,
                    "igst": 0.0,
                    "cgst": 0.0,
                    "sgst": 0.0,
                    "cess": 0.0,
                }
            hsn_map[hsn_key]["total_quantity"] += float(item.quantity)
            hsn_map[hsn_key]["total_value"] += float(item.total_amount)
            hsn_map[hsn_key]["taxable_value"] += float(item.taxable_amount)
            hsn_map[hsn_key]["igst"] += float(item.igst_amount)
            hsn_map[hsn_key]["cgst"] += float(item.cgst_amount)
            hsn_map[hsn_key]["sgst"] += float(item.sgst_amount)

        # Classify Invoice:
        if buyer_gstin:
            # --- 1. B2B Table ---
            if buyer_gstin not in b2b_recipients_map:
                b2b_recipients_map[buyer_gstin] = {
                    "ctin": buyer_gstin,
                    "customer_name": b.party_name,
                    "invoices": [],
                }
            inv_items = [
                GSTR1InvoiceItem(
                    rate=r,
                    taxable_value=round(vals["taxable"], 2),
                    igst=round(vals["igst"], 2),
                    cgst=round(vals["cgst"], 2),
                    sgst=round(vals["sgst"], 2),
                )
                for r, vals in rate_items_map.items()
            ]
            b2b_recipients_map[buyer_gstin]["invoices"].append(
                GSTR1B2BInvoice(
                    bill_id=b.id,
                    invoice_number=b.bill_number,
                    invoice_date=b_date_str,
                    invoice_value=round(inv_val, 2),
                    pos=buyer_pos,
                    reverse_charge="N",
                    invoice_type="Regular",
                    items=inv_items,
                )
            )
        elif b.is_interstate and inv_val > 250000.0:
            # --- 2. B2CL Table (Interstate Unregistered > 2.5L) ---
            for r, vals in rate_items_map.items():
                b2cl_list.append(
                    GSTR1B2CLInvoice(
                        invoice_number=b.bill_number,
                        invoice_date=b_date_str,
                        invoice_value=round(inv_val, 2),
                        pos=buyer_pos,
                        rate=r,
                        taxable_value=round(vals["taxable"], 2),
                        igst=round(vals["igst"], 2),
                    )
                )
        else:
            # --- 3. B2CS Table (Small Unregistered) ---
            for r, vals in rate_items_map.items():
                key = (buyer_pos, r)
                if key not in b2cs_map:
                    b2cs_map[key] = {
                        "taxable": 0.0,
                        "igst": 0.0,
                        "cgst": 0.0,
                        "sgst": 0.0,
                    }
                b2cs_map[key]["taxable"] += vals["taxable"]
                b2cs_map[key]["igst"] += vals["igst"]
                b2cs_map[key]["cgst"] += vals["cgst"]
                b2cs_map[key]["sgst"] += vals["sgst"]

    # Assemble B2B recipients list
    b2b_list: List[GSTR1B2BRecipient] = [
        GSTR1B2BRecipient(**data) for data in b2b_recipients_map.values()
    ]

    # Assemble B2CS list
    b2cs_list: List[GSTR1B2CSItem] = [
        GSTR1B2CSItem(
            pos=pos,
            rate=rate,
            taxable_value=round(vals["taxable"], 2),
            igst=round(vals["igst"], 2),
            cgst=round(vals["cgst"], 2),
            sgst=round(vals["sgst"], 2),
        )
        for (pos, rate), vals in b2cs_map.items()
    ]

    # Assemble HSN list
    hsn_list: List[GSTR1HSNItem] = [
        GSTR1HSNItem(
            hsn_code=data["hsn_code"],
            description=data["description"],
            uqc=data["uqc"],
            total_quantity=round(data["total_quantity"], 2),
            total_value=round(data["total_value"], 2),
            taxable_value=round(data["taxable_value"], 2),
            igst=round(data["igst"], 2),
            cgst=round(data["cgst"], 2),
            sgst=round(data["sgst"], 2),
            cess=0.0,
        )
        for data in hsn_map.values()
    ]

    # Document summary (Table 13)
    doc_summary = GSTR1DocSummary(
        from_serial=min_bill_no,
        to_serial=max_bill_no,
        total_count=len(bills) + cancelled_count,
        cancelled_count=cancelled_count,
        net_issued=len(bills),
    )

    period_calculated = period_str or from_date.strftime("%m%Y")

    return GSTR1ReportResponse(
        gstin=tenant_gstin,
        business_name=business_name,
        period=period_calculated,
        from_date=from_date.isoformat(),
        to_date=to_date.isoformat(),
        summary={
            "total_invoices": len(bills),
            "b2b_invoices_count": sum(len(r.invoices) for r in b2b_list),
            "b2cl_invoices_count": len(b2cl_list),
            "b2cs_groups_count": len(b2cs_list),
            "total_invoice_value": round(tot_invoice_val, 2),
            "total_taxable_value": round(tot_taxable, 2),
            "total_igst": round(tot_igst, 2),
            "total_cgst": round(tot_cgst, 2),
            "total_sgst": round(tot_sgst, 2),
            "total_gst": round(tot_igst + tot_cgst + tot_sgst, 2),
        },
        b2b=b2b_list,
        b2cl=b2cl_list,
        b2cs=b2cs_list,
        hsn_summary=hsn_list,
        doc_summary=doc_summary,
    )


def generate_gstr1_offline_tool_json(report: GSTR1ReportResponse) -> Dict[str, Any]:
    """
    Format GSTR-1 response to match official GST Portal Offline Tool JSON schema.
    """
    b2b_payload = []
    for r in report.b2b:
        inv_list = []
        for inv in r.invoices:
            itms = [
                {
                    "num": idx + 1,
                    "itm_det": {
                        "rt": item.rate,
                        "txval": item.taxable_value,
                        "iamt": item.igst,
                        "camt": item.cgst,
                        "samt": item.sgst,
                        "csamt": item.cess,
                    },
                }
                for idx, item in enumerate(inv.items)
            ]
            inv_list.append(
                {
                    "inum": inv.invoice_number,
                    "idt": inv.invoice_date,
                    "val": inv.invoice_value,
                    "pos": inv.pos,
                    "rchrg": inv.reverse_charge,
                    "inv_typ": "R",
                    "itms": itms,
                }
            )
        b2b_payload.append({"ctin": r.ctin, "inv": inv_list})

    b2cs_payload = [
        {
            "sply_ty": "INTER" if item.igst > 0 else "INTRA",
            "pos": item.pos,
            "typ": item.type,
            "rt": item.rate,
            "txval": item.taxable_value,
            "iamt": item.igst,
            "camt": item.cgst,
            "samt": item.sgst,
            "csamt": item.cess,
        }
        for item in report.b2cs
    ]

    hsn_payload = {
        "data": [
            {
                "num": idx + 1,
                "hsn_sc": item.hsn_code,
                "desc": item.description,
                "uqc": item.uqc,
                "qty": item.total_quantity,
                "val": item.total_value,
                "txval": item.taxable_value,
                "iamt": item.igst,
                "camt": item.cgst,
                "samt": item.sgst,
                "csamt": item.cess,
            }
            for idx, item in enumerate(report.hsn_summary)
        ]
    }

    doc_issue_payload = {
        "doc_det": [
            {
                "doc_num": 1,
                "doc_typ": report.doc_summary.doc_type,
                "docs": [
                    {
                        "num": 1,
                        "from": report.doc_summary.from_serial,
                        "to": report.doc_summary.to_serial,
                        "totnum": report.doc_summary.total_count,
                        "canc": report.doc_summary.cancelled_count,
                        "net_issue": report.doc_summary.net_issued,
                    }
                ],
            }
        ]
    }

    return {
        "gstin": report.gstin,
        "fp": report.period,
        "version": "GST1.0",
        "hash": "hash",
        "b2b": b2b_payload,
        "b2cl": [
            {
                "pos": item.pos,
                "inv": [
                    {
                        "inum": item.invoice_number,
                        "idt": item.invoice_date,
                        "val": item.invoice_value,
                        "itms": [
                            {
                                "num": 1,
                                "itm_det": {
                                    "rt": item.rate,
                                    "txval": item.taxable_value,
                                    "iamt": item.igst,
                                    "csamt": item.cess,
                                },
                            }
                        ],
                    }
                ],
            }
            for item in report.b2cl
        ],
        "b2cs": b2cs_payload,
        "hsn": hsn_payload,
        "doc_issue": doc_issue_payload,
    }


async def generate_gstr3b_report(
    db: AsyncSession,
    tenant_id: str,
    from_date: date,
    to_date: date,
    period_str: Optional[str] = None,
) -> GSTR3BReportResponse:
    """
    Generate complete GSTR-3B Summary return report computing Outward Tax Liabilities (Table 3.1)
    and Eligible Input Tax Credit (ITC) from Inward Purchases (Table 4) to determine Net Cash Tax Payable.
    """
    # 1. Fetch Tenant
    t_res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = t_res.scalar_one_or_none()
    tenant_gstin = tenant.gst_number if tenant and tenant.gst_number else "UNREGISTERED"
    business_name = tenant.business_name if tenant else "Business"

    # 2. Query Outward Sales
    sales_stmt = (
        select(Bill)
        .where(
            Bill.tenant_id == tenant_id,
            Bill.type == "sale",
            Bill.status == "active",
            Bill.is_reviewed_by_admin == True,
            func.date(Bill.bill_date) >= from_date,
            func.date(Bill.bill_date) <= to_date,
        )
    )
    s_res = await db.execute(sales_stmt)
    sales = s_res.scalars().all()

    taxable_outward_txval = 0.0
    taxable_outward_igst = 0.0
    taxable_outward_cgst = 0.0
    taxable_outward_sgst = 0.0
    exempt_outward_txval = 0.0

    for s in sales:
        if float(s.gst_amount) > 0.001:
            taxable_outward_txval += float(s.taxable_amount)
            taxable_outward_igst += float(s.igst_amount)
            taxable_outward_cgst += float(s.cgst_amount)
            taxable_outward_sgst += float(s.sgst_amount)
        else:
            exempt_outward_txval += float(s.taxable_amount)

    outward_supplies = GSTR3BOutwardSupplies(
        taxable_outward=GSTR3BSupplyRow(
            taxable_value=round(taxable_outward_txval, 2),
            igst=round(taxable_outward_igst, 2),
            cgst=round(taxable_outward_cgst, 2),
            sgst=round(taxable_outward_sgst, 2),
        ),
        zero_rated_outward=GSTR3BSupplyRow(),
        other_outward_exempt=GSTR3BSupplyRow(taxable_value=round(exempt_outward_txval, 2)),
        inward_reverse_charge=GSTR3BSupplyRow(),
        non_gst_outward=GSTR3BSupplyRow(),
    )

    # 3. Query Inward Purchases (Eligible ITC)
    purchases_stmt = (
        select(Bill)
        .where(
            Bill.tenant_id == tenant_id,
            Bill.type == "purchase",
            Bill.status == "active",
            func.date(Bill.bill_date) >= from_date,
            func.date(Bill.bill_date) <= to_date,
        )
    )
    p_res = await db.execute(purchases_stmt)
    purchases = p_res.scalars().all()

    itc_igst = 0.0
    itc_cgst = 0.0
    itc_sgst = 0.0

    for p in purchases:
        itc_igst += float(p.igst_amount)
        itc_cgst += float(p.cgst_amount)
        itc_sgst += float(p.sgst_amount)

    eligible_itc = GSTR3BEligibleITC(
        all_other_itc=GSTR3BITCRow(
            igst=round(itc_igst, 2),
            cgst=round(itc_cgst, 2),
            sgst=round(itc_sgst, 2),
        ),
        ineligible_itc=GSTR3BITCRow(),
    )

    # 4. Compute Net Cash Tax Payable
    cgst_net = max(0.0, round(taxable_outward_cgst - itc_cgst, 2))
    sgst_net = max(0.0, round(taxable_outward_sgst - itc_sgst, 2))
    igst_net = max(0.0, round(taxable_outward_igst - itc_igst, 2))
    tot_cash_payable = round(cgst_net + sgst_net + igst_net, 2)

    net_tax = GSTR3BNetTaxPayable(
        cgst_output=round(taxable_outward_cgst, 2),
        cgst_itc=round(itc_cgst, 2),
        cgst_net_payable=cgst_net,
        sgst_output=round(taxable_outward_sgst, 2),
        sgst_itc=round(itc_sgst, 2),
        sgst_net_payable=sgst_net,
        igst_output=round(taxable_outward_igst, 2),
        igst_itc=round(itc_igst, 2),
        igst_net_payable=igst_net,
        total_cash_tax_payable=tot_cash_payable,
    )

    period_calculated = period_str or from_date.strftime("%m%Y")

    return GSTR3BReportResponse(
        gstin=tenant_gstin,
        business_name=business_name,
        period=period_calculated,
        from_date=from_date.isoformat(),
        to_date=to_date.isoformat(),
        outward_supplies=outward_supplies,
        eligible_itc=eligible_itc,
        net_tax_payable=net_tax,
    )
