import io
from typing import Optional
from reportlab.lib.pagesizes import A4, A5
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models.bill import Bill
from app.models.tenant import Tenant


def generate_bill_pdf(
    bill: Bill,
    tenant: Tenant,
    paper_format: str = "a4",
    terms_conditions: Optional[str] = None
) -> bytes:
    """
    Generate a GST-compliant Tax Invoice PDF in memory.
    Supports A4 (Full Page) and A5 (Half-A4 Sheet).
    Includes complete Business & Customer details:
      - Business: Name, Full Address, Phone Number, GSTIN
      - Customer: Name, Full Address, Phone Number, GSTIN
      - Terms & Conditions: Selected by owner / Optional
    """
    is_a5 = str(paper_format).lower() in ["a5", "half_a4", "half-a4", "half_page"]
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
    story = []
    styles = getSampleStyleSheet()

    # Custom typography styles scaled for paper format
    title_font_size = 13 if is_a5 else 17
    title_leading = 15 if is_a5 else 20
    body_font_size = 7 if is_a5 else 8.5
    body_leading = 8.5 if is_a5 else 11
    table_font_size = 6.5 if is_a5 else 8
    table_leading = 7.5 if is_a5 else 10

    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontSize=title_font_size,
        leading=title_leading,
        textColor=colors.HexColor("#1e3a8a"),
        fontName="Helvetica-Bold",
        alignment=2 # Right aligned
    )
    store_title_style = ParagraphStyle(
        'StoreTitle',
        parent=styles['Heading2'],
        fontSize=11 if is_a5 else 14,
        leading=13 if is_a5 else 17,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold"
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
        textColor=colors.HexColor("#1e293b")
    )
    terms_style = ParagraphStyle(
        'TermsText',
        parent=styles['Normal'],
        fontSize=6.5 if is_a5 else 8,
        leading=8 if is_a5 else 10,
        textColor=colors.HexColor("#475569")
    )

    # -------------------------------------------------------------
    # 1. Header: Store (Business) Details & Tax Invoice Title
    # -------------------------------------------------------------
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
    
    full_store_addr = "<br/>".join(address_lines) if address_lines else "Retail Store Address"
    store_phone = tenant.phone or "—"
    store_gst = tenant.gst_number or "Unregistered"

    store_html = (
        f"<b>{tenant.business_name}</b><br/>"
        f"<b>Address:</b> {full_store_addr}<br/>"
        f"<b>Phone:</b> {store_phone} &bull; <b>GSTIN:</b> {store_gst}"
    )

    invoice_meta_html = (
        f"<b>TAX INVOICE</b><br/>"
        f"Invoice No: <b>{bill.bill_number}</b><br/>"
        f"Date: <b>{bill.created_at.strftime('%d-%m-%Y')}</b><br/>"
        f"Supply: <b>{'Inter-State (IGST)' if bill.is_interstate else 'Intra-State (CGST+SGST)'}</b>"
    )

    header_col_widths = [220, 168] if is_a5 else [300, 235]
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
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6 if is_a5 else 10))

    # -------------------------------------------------------------
    # 2. Bill To (Customer Details) & Payment Details
    # -------------------------------------------------------------
    cust_addr = bill.party_address or (bill.customer.address if getattr(bill, "customer", None) and bill.customer else None) or "—"
    cust_phone = bill.party_mobile or (bill.customer.mobile if getattr(bill, "customer", None) and bill.customer else None) or "—"
    cust_gst = bill.party_gst or (bill.customer.gst_number if getattr(bill, "customer", None) and bill.customer else None) or "—"

    customer_html = (
        f"<b>Billed To (Customer):</b><br/>"
        f"<b>Name:</b> {bill.party_name}<br/>"
        f"<b>Address:</b> {cust_addr}<br/>"
        f"<b>Phone:</b> {cust_phone} &bull; <b>GSTIN:</b> {cust_gst}"
    )

    payment_html = (
        f"<b>Payment & Billing:</b><br/>"
        f"<b>Mode:</b> {'CREDIT' if bill.payment_mode == 'credit' else 'CASH'}<br/>"
        f"<b>Status:</b> {bill.payment_status.upper()} (Paid: Rs. {bill.paid_amount:.2f})<br/>"
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
    story.append(Spacer(1, 6 if is_a5 else 10))

    # -------------------------------------------------------------
    # 3. Line Items Table
    # -------------------------------------------------------------
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
    items_table = Table(table_rows, colWidths=items_col_widths)
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
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

    # -------------------------------------------------------------
    # 4. Totals Breakdown Table
    # -------------------------------------------------------------
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

    totals_col_widths = [115, 80] if is_a5 else [140, 100]
    totals_table = Table(totals_data, colWidths=totals_col_widths, hAlign='RIGHT')
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 8 if is_a5 else 10),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor("#1e3a8a")),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor("#1e3a8a")),
        ('PADDING', (0, 0), (-1, -1), 1.5 if is_a5 else 2.5),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 6 if is_a5 else 10))

    # -------------------------------------------------------------
    # 5. Terms & Conditions (Selected by Owner / Optional)
    # -------------------------------------------------------------
    effective_terms = terms_conditions if terms_conditions is not None else (bill.terms_conditions or getattr(tenant, "terms_conditions", None))
    if effective_terms and effective_terms.strip().lower() not in ["none", "false", "off", ""]:
        formatted_terms = effective_terms.replace("\n", "<br/>")
        terms_box = Table(
            [[Paragraph(f"<b>Terms & Conditions:</b><br/>{formatted_terms}", terms_style)]],
            colWidths=[388 if is_a5 else 535]
        )
        terms_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('PADDING', (0, 0), (-1, -1), 3.5 if is_a5 else 5),
        ]))
        story.append(terms_box)
        story.append(Spacer(1, 6 if is_a5 else 10))

    # -------------------------------------------------------------
    # 6. Signatures Section
    # -------------------------------------------------------------
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
    story.append(sig_table)

    # Build document
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

