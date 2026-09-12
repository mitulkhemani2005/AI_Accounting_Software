import urllib.parse
from app.models.bill import Bill
from app.models.tenant import Tenant


def generate_whatsapp_share_payload(bill: Bill, tenant: Tenant, base_web_url: str = "http://localhost:3000") -> dict:
    """Generate formatted invoice summary and WhatsApp click-to-chat link"""
    clean_mobile = ""
    if bill.party_mobile:
        clean_digits = "".join(filter(str.isdigit, bill.party_mobile))
        if len(clean_digits) == 10:
            clean_mobile = f"91{clean_digits}"
        elif len(clean_digits) > 10:
            clean_mobile = clean_digits

    # Message text template
    items_count = len(bill.items)
    msg_lines = [
        f"🧾 *TAX INVOICE — {tenant.business_name}*",
        f"Invoice No: *{bill.bill_number}*",
        f"Date: {bill.created_at.strftime('%d-%b-%Y')}",
        f"Customer: {bill.party_name}",
        "--------------------------------",
        f"Total Items: {items_count}",
        f"Subtotal: ₹{bill.subtotal:.2f}",
        f"GST: ₹{bill.gst_amount:.2f}",
        f"*Grand Total: ₹{bill.total_amount:.2f}*",
        f"Payment Mode: {bill.payment_mode.upper()} ({bill.payment_status.upper()})",
        "--------------------------------",
        f"📥 Download Invoice PDF: {base_web_url}/api/v1/bills/{bill.id}/pdf",
        "",
        "Thank you for shopping with us! 🙏"
    ]
    message_text = "\n".join(msg_lines)
    encoded_text = urllib.parse.quote(message_text)

    wa_link = f"https://wa.me/{clean_mobile}?text={encoded_text}" if clean_mobile else f"https://wa.me/?text={encoded_text}"

    return {
        "bill_id": bill.id,
        "bill_number": bill.bill_number,
        "recipient_mobile": clean_mobile,
        "message_text": message_text,
        "whatsapp_url": wa_link
    }
