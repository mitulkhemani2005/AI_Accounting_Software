from typing import List, Dict, Any, Tuple
from app.schemas.bill import BillItemInput


def calculate_line_item_gst(
    item: BillItemInput,
    is_interstate: bool = False
) -> Dict[str, Any]:
    """Calculate GST breakdown for an individual line item (supports tax inclusive & exclusive)"""
    raw_amount = item.quantity * item.rate
    net_line_amount = max(0.0, raw_amount - item.discount_amount)
    gst_rate = float(item.gst_rate)
    is_inclusive = getattr(item, "is_tax_inclusive", False)

    if is_inclusive and gst_rate > 0:
        # Tax is included in price (e.g. MRP ₹20 with 12% GST => taxable = 20 / 1.12)
        item_taxable = round(net_line_amount / (1.0 + (gst_rate / 100.0)), 2)
        total_item_gst = round(net_line_amount - item_taxable, 2)
        total_amount = round(net_line_amount, 2)

        if is_interstate:
            cgst = 0.0
            sgst = 0.0
            igst = total_item_gst
        else:
            cgst = round(total_item_gst / 2.0, 2)
            sgst = round(total_item_gst - cgst, 2)
            igst = 0.0
    else:
        # Tax is exclusive (added on top of price)
        item_taxable = round(net_line_amount, 2)
        if is_interstate:
            cgst = 0.0
            sgst = 0.0
            igst = round(item_taxable * (gst_rate / 100.0), 2)
        else:
            half_rate = gst_rate / 2.0
            cgst = round(item_taxable * (half_rate / 100.0), 2)
            sgst = round(item_taxable * (half_rate / 100.0), 2)
            igst = 0.0

        total_item_gst = round(cgst + sgst + igst, 2)
        total_amount = round(item_taxable + total_item_gst, 2)

    return {
        "item_id": item.item_id,
        "item_name": item.item_name,
        "hsn_code": item.hsn_code,
        "quantity": item.quantity,
        "unit": item.unit,
        "rate": item.rate,
        "purchase_price": getattr(item, "purchase_price", 0.0) or 0.0,
        "discount_amount": item.discount_amount,
        "gst_rate": gst_rate,
        "is_tax_inclusive": is_inclusive,
        "taxable_amount": item_taxable,
        "cgst_amount": cgst,
        "sgst_amount": sgst,
        "igst_amount": igst,
        "total_amount": total_amount
    }


def calculate_bill_totals(
    items_breakdown: List[Dict[str, Any]],
    bill_discount: float = 0.0,
    is_interstate: bool = False
) -> Dict[str, float]:
    """Calculate subtotal, GST breakdowns, round-off, and grand total for entire bill"""
    subtotal = sum(i["taxable_amount"] for i in items_breakdown)
    taxable_amount = round(max(0.0, subtotal - bill_discount), 2)

    total_cgst = round(sum(i["cgst_amount"] for i in items_breakdown), 2)
    total_sgst = round(sum(i["sgst_amount"] for i in items_breakdown), 2)
    total_igst = round(sum(i["igst_amount"] for i in items_breakdown), 2)
    total_gst = round(total_cgst + total_sgst + total_igst, 2)

    raw_total = taxable_amount + total_gst
    grand_total = float(round(raw_total))
    round_off = round(grand_total - raw_total, 2)

    return {
        "subtotal": subtotal,
        "discount_amount": bill_discount,
        "taxable_amount": taxable_amount,
        "gst_amount": total_gst,
        "cgst_amount": total_cgst,
        "sgst_amount": total_sgst,
        "igst_amount": total_igst,
        "round_off": round_off,
        "total_amount": grand_total
    }
