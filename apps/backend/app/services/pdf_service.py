import io
from typing import List, Optional
from reportlab.lib.pagesizes import A4, A5
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models.bill import Bill
from app.models.tenant import Tenant


def number_to_words_inr(number: float) -> str:
    """Convert numerical amount into Indian currency words representation"""
    try:
        units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                 "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                 "Seventeen", "Eighteen", "Nineteen"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

        def _convert_below_thousand(n: int) -> str:
            res = ""
            if n >= 100:
                res += units[n // 100] + " Hundred "
                n %= 100
            if n >= 20:
                res += tens[n // 10] + " "
                n %= 10
            if n > 0:
                res += units[n] + " "
            return res.strip()

        rupees = int(number)
        paise = int(round((number - rupees) * 100))

        if rupees == 0:
            words = "Zero Rupees"
        else:
            crores = rupees // 10000000
            rupees %= 10000000
            lakhs = rupees // 100000
            rupees %= 100000
            thousands = rupees // 1000
            rupees %= 1000
            remainder = rupees

            parts = []
            if crores > 0:
                parts.append(_convert_below_thousand(crores) + " Crore")
            if lakhs > 0:
                parts.append(_convert_below_thousand(lakhs) + " Lakh")
            if thousands > 0:
                parts.append(_convert_below_thousand(thousands) + " Thousand")
            if remainder > 0:
                parts.append(_convert_below_thousand(remainder))
            words = "Rupees " + " ".join(parts).strip()

        if paise > 0:
            words += f" and {_convert_below_thousand(paise)} Paise"
        return words + " Only"
    except Exception:
        return f"Rupees {number:.2f} Only"


def _build_bill_story_elements(bill: Bill, tenant: Tenant, is_a5: bool, styles) -> List:
    """Construct flowable story elements for a single bill invoice (Zero Terms & Conditions)"""
    story = []

    title_font_size = 13 if is_a5 else 16
    title_leading = 15 if is_a5 else 19
    body_font_size = 7 if is_a5 else 8.5
    body_leading = 8.5 if is_a5 else 11
    table_font_size = 6.5 if is_a5 else 8
    table_leading = 7.5 if is_a5 else 10

    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontSize=title_font_size,
        leading=title_leading,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=2
    )
    subtitle_style = ParagraphStyle(
        'InvoiceSubtitle',
        parent=styles['Normal'],
        fontSize=body_font_size,
        leading=body_leading,
        textColor=colors.HexColor("#334155")
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=table_font_size,
        leading=table_leading,
        textColor=colors.HexColor("#0f172a")
    )
    footer_note_style = ParagraphStyle(
        'FooterNote',
        parent=styles['Normal'],
        fontSize=6 if is_a5 else 7.5,
        leading=7.5 if is_a5 else 9.5,
        textColor=colors.HexColor("#475569")
    )

    # 1. Header (Seller Details & Tax Invoice Badge)
    b_addr = tenant.address or ""
    b_city = tenant.city or ""
    b_state = tenant.state or ""
    b_pin = tenant.pincode or ""
    
    city_state_pin_parts = [p for p in [b_city, b_state] if p]
    city_state_str = ", ".join(city_state_pin_parts)
    if b_pin:
        city_state_str = f"{city_state_str} - {b_pin}" if city_state_str else b_pin

    address_lines = []
    if b_addr:
        address_lines.append(b_addr)
    if city_state_str:
        address_lines.append(city_state_str)
    full_address = "<br/>".join(address_lines) if address_lines else "—"

    store_html = (
        f"<b>{tenant.business_name}</b><br/>"
        f"{full_address}<br/>"
        f"<b>Phone:</b> {tenant.phone or '—'} &bull; <b>GSTIN:</b> {tenant.gst_number or '—'}"
    )
    if tenant.email:
        store_html += f" &bull; <b>Email:</b> {tenant.email}"

    voucher_title = "PURCHASE VOUCHER (INWARD)" if bill.type == "purchase" else "TAX INVOICE"
    party_label = "PURCHASED FROM (SUPPLIER):" if bill.type == "purchase" else "BILLED TO (CUSTOMER):"

    invoice_meta_html = (
        f"<b>{voucher_title}</b><br/>"
        f"Invoice No: <b>{bill.bill_number}</b><br/>"
        f"Date: <b>{bill.created_at.strftime('%d-%m-%Y')}</b><br/>"
        f"Time: <b>{bill.created_at.strftime('%I:%M %p')}</b><br/>"
        f"Supply: <b>{'Inter-State (IGST)' if bill.is_interstate else 'Intra-State'}</b>"
    )

    header_col_widths = [220, 168] if is_a5 else [305, 230]
    header_data = [
        [
            Paragraph(store_html, subtitle_style),
            Paragraph(invoice_meta_html, title_style)
        ]
    ]
    header_table = Table(header_data, colWidths=header_col_widths)
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 1.5, colors.HexColor("#0f172a")),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 5 if is_a5 else 8))

    # 2. Bill To (Customer Details) & Payment Summary Card
    cust_addr = bill.party_address or (bill.customer.address if getattr(bill, "customer", None) and bill.customer else None) or "—"
    cust_phone = bill.party_mobile or (bill.customer.mobile if getattr(bill, "customer", None) and bill.customer else None) or "—"
    cust_gst = bill.party_gst or (bill.customer.gst_number if getattr(bill, "customer", None) and bill.customer else None) or "—"

    customer_html = (
        f"<b>{party_label}</b><br/>"
        f"<b>Name:</b> <font color='#0f172a'><b>{bill.party_name}</b></font><br/>"
        f"<b>Address:</b> {cust_addr}<br/>"
        f"<b>Phone:</b> {cust_phone} &bull; <b>GSTIN:</b> {cust_gst}"
    )

    payment_html = (
        f"<b>PAYMENT & BILLING:</b><br/>"
        f"<b>Payment Mode:</b> {'CREDIT' if bill.payment_mode == 'credit' else 'CASH'}<br/>"
        f"<b>Payment Status:</b> {bill.payment_status.upper()} (Paid: Rs. {bill.paid_amount:.2f})<br/>"
        f"<b>Billed By:</b> {bill.creator.name if getattr(bill, 'creator', None) and bill.creator else 'Counter Staff'}"
    )

    bill_to_data = [
        [
            Paragraph(customer_html, subtitle_style),
            Paragraph(payment_html, subtitle_style)
        ]
    ]
    bill_to_table = Table(bill_to_data, colWidths=header_col_widths)
    bill_to_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ('PADDING', (0, 0), (-1, -1), 4 if is_a5 else 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(bill_to_table)
    story.append(Spacer(1, 5 if is_a5 else 8))

    # 3. Line Items Table
    headers = ["#", "Item Description", "HSN", "Qty", "Rate", "Taxable", "GST %", "Total (Rs.)"]
    table_rows = [headers]

    for idx, item in enumerate(bill.items, start=1):
        item_label = item.item_name
        if getattr(item, "is_tax_inclusive", False):
            item_label += " (Incl.)"
        table_rows.append([
            str(idx),
            Paragraph(item_label, table_cell_style),
            item.hsn_code or "—",
            f"{item.quantity} {item.unit}",
            f"{item.rate:.2f}",
            f"{item.taxable_amount:.2f}",
            f"{item.gst_rate:.0f}%",
            f"{item.total_amount:.2f}"
        ])

    items_col_widths = [16, 136, 32, 40, 42, 42, 35, 45] if is_a5 else [25, 175, 45, 55, 60, 65, 45, 65]
    items_table = Table(table_rows, colWidths=items_col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 6.5 if is_a5 else 8),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('PADDING', (0, 0), (-1, -1), 3 if is_a5 else 4.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 5 if is_a5 else 8))

    # 4. Amount in Words & Totals Breakdown Grid
    amount_in_words = number_to_words_inr(bill.total_amount)
    amount_words_html = (
        f"<b>Amount in Words:</b><br/>"
        f"<i>{amount_in_words}</i><br/><br/>"
        f"<b>Declaration:</b><br/>"
        f"Certified that the particulars given above are true and correct."
    )

    totals_data = [
        ["Taxable Amount:", f"Rs. {bill.taxable_amount:.2f}"],
    ]
    if bill.discount_amount > 0:
        totals_data.append(["Discount:", f"-Rs. {bill.discount_amount:.2f}"])

    if bill.is_interstate:
        totals_data.append(["Integrated GST (IGST):", f"Rs. {bill.igst_amount:.2f}"])
    else:
        if bill.cgst_amount > 0:
            totals_data.append(["Central GST (CGST):", f"Rs. {bill.cgst_amount:.2f}"])
        if bill.sgst_amount > 0:
            totals_data.append(["State GST (SGST):", f"Rs. {bill.sgst_amount:.2f}"])

    if bill.round_off != 0.0:
        totals_data.append(["Round Off:", f"Rs. {bill.round_off:.2f}"])

    totals_data.append(["Grand Total:", f"Rs. {bill.total_amount:.2f}"])

    totals_table = Table(totals_data, colWidths=[100, 75] if is_a5 else [125, 95])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -2), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -2), 6.5 if is_a5 else 8),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 8.5 if is_a5 else 10.5),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor("#0f172a")),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor("#0f172a")),
        ('PADDING', (0, 0), (-1, -1), 1.5 if is_a5 else 2.5),
    ]))

    bottom_grid_widths = [213, 175] if is_a5 else [315, 220]
    bottom_grid_data = [
        [
            Paragraph(amount_words_html, footer_note_style),
            totals_table
        ]
    ]
    bottom_grid_table = Table(bottom_grid_data, colWidths=bottom_grid_widths)
    bottom_grid_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('PADDING', (0, 0), (-1, -1), 4 if is_a5 else 6),
    ]))

    # 5. Signatures Section
    sig_col_widths = [190, 198] if is_a5 else [265, 270]
    sig_data = [
        [
            Paragraph("Customer's Signature", subtitle_style),
            Paragraph(f"For <b>{tenant.business_name}</b><br/><br/>Authorized Signatory", ParagraphStyle('RightSig', parent=subtitle_style, alignment=2))
        ]
    ]
    sig_table = Table(sig_data, colWidths=sig_col_widths)
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('LINEABOVE', (0, 0), (0, 0), 0.5, colors.HexColor("#94a3b8")),
        ('LINEABOVE', (1, 0), (1, 0), 0.5, colors.HexColor("#94a3b8")),
        ('PADDING', (0, 0), (-1, -1), 2),
    ]))

    # Keep Totals & Signatures together to avoid awkward page breaks
    bottom_section = [
        bottom_grid_table,
        Spacer(1, 10 if is_a5 else 16),
        sig_table
    ]
    story.append(KeepTogether(bottom_section))
    return story


def generate_bill_pdf(
    bill: Bill,
    tenant: Tenant,
    paper_format: str = "a5"
) -> bytes:
    """
    Generate a GST-compliant Tax Invoice PDF in memory.
    Defaults to A5 (Half-A4 Sheet). Supports A4 (Full Page) and A5 (Half-A4 Sheet).
    """
    is_a5 = str(paper_format).lower() in ["a5", "half_a4", "half-a4", "half_page"] or paper_format is None
    selected_pagesize = A5 if is_a5 else A4
    margins = 14 if is_a5 else 28

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=selected_pagesize,
        rightMargin=margins,
        leftMargin=margins,
        topMargin=margins,
        bottomMargin=margins
    )
    styles = getSampleStyleSheet()
    story = _build_bill_story_elements(bill=bill, tenant=tenant, is_a5=is_a5, styles=styles)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_combined_bills_pdf(
    bills: List[Bill],
    tenant: Tenant,
    paper_format: str = "a5"
) -> bytes:
    """
    Generate a multi-page combined PDF containing multiple selected bills.
    Defaults to A5 (Half-A4 Sheet). Each bill is rendered on its own distinct Half-A4 sheet (or sheets if items exceed).
    """
    is_a5 = str(paper_format).lower() in ["a5", "half_a4", "half-a4", "half_page"] or paper_format is None
    selected_pagesize = A5 if is_a5 else A4
    margins = 14 if is_a5 else 28

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=selected_pagesize,
        rightMargin=margins,
        leftMargin=margins,
        topMargin=margins,
        bottomMargin=margins
    )
    styles = getSampleStyleSheet()
    combined_story = []

    for i, bill in enumerate(bills):
        if i > 0:
            combined_story.append(PageBreak())
        bill_elements = _build_bill_story_elements(bill=bill, tenant=tenant, is_a5=is_a5, styles=styles)
        combined_story.extend(bill_elements)

    doc.build(combined_story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
