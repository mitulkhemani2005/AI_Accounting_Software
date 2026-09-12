import pytest
from app.schemas.bill import BillItemInput
from app.services.gst_service import calculate_line_item_gst, calculate_bill_totals


def test_intra_state_gst_calculation():
    """Verify 18% GST split into 9% CGST and 9% SGST for intra-state sale"""
    item = BillItemInput(
        item_name="Basmati Rice 5kg",
        hsn_code="1006",
        quantity=2,
        rate=500.0,
        discount_amount=50.0,
        gst_rate=18.0
    )
    # Taxable: (2 * 500) - 50 = 950.0
    # CGST (9%): 85.50, SGST (9%): 85.50, Total: 950 + 171 = 1121.0
    res = calculate_line_item_gst(item, is_interstate=False)
    assert res["taxable_amount"] == 950.0
    assert res["cgst_amount"] == 85.50
    assert res["sgst_amount"] == 85.50
    assert res["igst_amount"] == 0.0
    assert res["total_amount"] == 1121.0


def test_inter_state_gst_calculation():
    """Verify 18% GST charged entirely as IGST for inter-state sale"""
    item = BillItemInput(
        item_name="Bluetooth Barcode Scanner",
        hsn_code="8471",
        quantity=1,
        rate=2000.0,
        discount_amount=0.0,
        gst_rate=18.0
    )
    # Taxable: 2000.0, IGST: 360.0, Total: 2360.0
    res = calculate_line_item_gst(item, is_interstate=True)
    assert res["taxable_amount"] == 2000.0
    assert res["cgst_amount"] == 0.0
    assert res["sgst_amount"] == 0.0
    assert res["igst_amount"] == 360.0
    assert res["total_amount"] == 2360.0


def test_bill_totals_and_round_off():
    """Verify multi-item bill totals, overall discount, and rounding off"""
    item1 = calculate_line_item_gst(
        BillItemInput(item_name="Item A", quantity=3, rate=33.33, gst_rate=5.0)
    )
    item2 = calculate_line_item_gst(
        BillItemInput(item_name="Item B", quantity=1, rate=100.0, gst_rate=12.0)
    )

    totals = calculate_bill_totals([item1, item2], bill_discount=10.0)
    assert totals["subtotal"] > 0
    assert totals["taxable_amount"] == round(totals["subtotal"] - 10.0, 2)
    assert totals["total_amount"] == float(round(totals["taxable_amount"] + totals["gst_amount"]))
