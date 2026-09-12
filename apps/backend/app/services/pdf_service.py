import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models.bill import Bill
from app.models.tenant import Tenant


def generate_bill_pdf(bill: Bill, tenant: Tenant) -> bytes:
    """Generate a GST-compliant A4 Tax Invoice PDF in memory"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    story = []
    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1e3a8a"),
        fontName="Helvetica-Bold"
    )
    subtitle_style = ParagraphStyle(
        'InvoiceSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569")
    )
    bold_style = ParagraphStyle(
        'BoldText',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a")
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b")
    )

    # 1. Header: Store Info & Tax Invoice Badge
    header_data = [
        [
            Paragraph(f"<b>{tenant.business_name}</b><br/>GSTIN: {tenant.gst_number or 'Unregistered'}<br/>Authorized Tax Invoice", subtitle_style),
            Paragraph("<b>TAX INVOICE</b><br/>" + f"Invoice No: <b>{bill.bill_number}</b><br/>Date: {bill.created_at.strftime('%d-%m-%Y')}", title_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[280, 250])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 15))

    # 2. Bill To (Customer Details)
    bill_to_data = [
        [
            Paragraph(f"<b>Bill To:</b><br/>Name: <b>{bill.party_name}</b><br/>Mobile: {bill.party_mobile or '—'}<br/>GSTIN: {bill.party_gst or '—'}", subtitle_style),
            Paragraph(f"<b>Payment Details:</b><br/>Mode: <b>{bill.payment_mode.upper()}</b><br/>Status: <b>{bill.payment_status.upper()}</b><br/>Place of Supply: {'Inter-state (IGST)' if bill.is_interstate else 'Intra-state (CGST+SGST)'}", subtitle_style)
        ]
    ]
    bill_to_table = Table(bill_to_data, colWidths=[280, 250])
    bill_to_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(bill_to_table)
    story.append(Spacer(1, 15))

    # 3. Line Items Table
    headers = ["#", "Item Description", "HSN", "Qty", "Rate (Rs.)", "Taxable (Rs.)", "GST %", "Total (Rs.)"]
    table_rows = [headers]

    for idx, item in enumerate(bill.items, start=1):
        table_rows.append([
            str(idx),
            Paragraph(item.item_name, table_cell_style),
            item.hsn_code or "—",
            f"{item.quantity} {item.unit}",
            f"{item.rate:.2f}",
            f"{item.taxable_amount:.2f}",
            f"{item.gst_rate:.0f}%",
            f"{item.total_amount:.2f}"
        ])

    items_table = Table(table_rows, colWidths=[25, 175, 45, 55, 60, 65, 45, 60])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 12))

    # 4. Totals Breakdown Table
    totals_data = [
        ["Subtotal:", f"Rs. {bill.subtotal:.2f}"],
        ["Discount:", f"-Rs. {bill.discount_amount:.2f}"],
        ["Taxable Amount:", f"Rs. {bill.taxable_amount:.2f}"],
    ]
    if bill.is_interstate:
        totals_data.append(["Integrated GST (IGST):", f"Rs. {bill.igst_amount:.2f}"])
    else:
        totals_data.append(["Central GST (CGST):", f"Rs. {bill.cgst_amount:.2f}"])
        totals_data.append(["State GST (SGST):", f"Rs. {bill.sgst_amount:.2f}"])

    if bill.round_off != 0.0:
        totals_data.append(["Round Off:", f"Rs. {bill.round_off:.2f}"])

    totals_data.append(["Grand Total:", f"Rs. {bill.total_amount:.2f}"])

    totals_table = Table(totals_data, colWidths=[140, 100], hAlign='RIGHT')
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 10),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor("#1e3a8a")),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor("#1e3a8a")),
        ('PADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 20))

    # 5. Footer & Terms
    footer_text = Paragraph(
        "<b>Terms & Conditions:</b><br/>"
        "1. Goods once sold will be accepted back within 7 days with original invoice.<br/>"
        "2. This is a computer-generated tax invoice.<br/>"
        "<i>Thank you for your business!</i>",
        subtitle_style
    )
    story.append(footer_text)

    # Build document
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
