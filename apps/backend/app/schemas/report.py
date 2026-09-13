from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, date


# ==============================================================================
# Debtors & Creditors Ageing Schemas
# ==============================================================================

class OverdueBillItem(BaseModel):
    bill_id: str
    bill_number: str
    bill_date: datetime
    age_days: int
    total_amount: float
    paid_amount: float
    due_amount: float
    status: str
    payment_mode: str


class DebtorAgeingItem(BaseModel):
    customer_id: str
    customer_name: str
    mobile: Optional[str] = None
    gst_number: Optional[str] = None
    area_name: Optional[str] = None
    current_balance: float
    bucket_0_30: float = 0.0
    bucket_31_60: float = 0.0
    bucket_61_90: float = 0.0
    bucket_above_90: float = 0.0
    total_due: float = 0.0
    oldest_invoice_date: Optional[datetime] = None
    overdue_bills: List[OverdueBillItem] = []


class DebtorsAgeingResponse(BaseModel):
    as_of_date: str
    total_debtors: int
    total_outstanding: float
    bucket_0_30_total: float
    bucket_31_60_total: float
    bucket_61_90_total: float
    bucket_above_90_total: float
    customers: List[DebtorAgeingItem]


class CreditorAgeingItem(BaseModel):
    supplier_id: str
    supplier_name: str
    mobile: Optional[str] = None
    gst_number: Optional[str] = None
    area_name: Optional[str] = None
    current_balance: float
    bucket_0_30: float = 0.0
    bucket_31_60: float = 0.0
    bucket_61_90: float = 0.0
    bucket_above_90: float = 0.0
    total_due: float = 0.0
    oldest_bill_date: Optional[datetime] = None
    overdue_bills: List[OverdueBillItem] = []


class CreditorsAgeingResponse(BaseModel):
    as_of_date: str
    total_creditors: int
    total_outstanding: float
    bucket_0_30_total: float
    bucket_31_60_total: float
    bucket_61_90_total: float
    bucket_above_90_total: float
    suppliers: List[CreditorAgeingItem]


# ==============================================================================
# Automated Payment Reminders Schemas
# ==============================================================================

class PaymentReminderItem(BaseModel):
    customer_id: str
    customer_name: str
    mobile: Optional[str] = None
    total_due: float
    max_overdue_days: int
    bills_count: int
    message_text: str
    sms_text: str
    whatsapp_url: str
    upi_payment_link: Optional[str] = None


class PaymentRemindersResponse(BaseModel):
    generated_at: str
    total_customers: int
    total_overdue_amount: float
    reminders: List[PaymentReminderItem]


class PaymentReminderSendRequest(BaseModel):
    customer_ids: Optional[List[str]] = None
    custom_note: Optional[str] = None
    min_overdue_days: int = 0


# ==============================================================================
# GSTR-1 Schemas
# ==============================================================================

class GSTR1InvoiceItem(BaseModel):
    rate: float
    taxable_value: float
    igst: float
    cgst: float
    sgst: float
    cess: float = 0.0


class GSTR1B2BInvoice(BaseModel):
    bill_id: str
    invoice_number: str
    invoice_date: str
    invoice_value: float
    pos: str
    reverse_charge: str = "N"
    invoice_type: str = "Regular"
    items: List[GSTR1InvoiceItem]


class GSTR1B2BRecipient(BaseModel):
    ctin: str  # Customer GSTIN
    customer_name: str
    invoices: List[GSTR1B2BInvoice]


class GSTR1B2CLInvoice(BaseModel):
    invoice_number: str
    invoice_date: str
    invoice_value: float
    pos: str
    rate: float
    taxable_value: float
    igst: float
    cess: float = 0.0


class GSTR1B2CSItem(BaseModel):
    pos: str
    rate: float
    taxable_value: float
    igst: float
    cgst: float
    sgst: float
    cess: float = 0.0
    type: str = "OE"  # Other than E-commerce


class GSTR1HSNItem(BaseModel):
    hsn_code: str
    description: str
    uqc: str
    total_quantity: float
    total_value: float
    taxable_value: float
    igst: float
    cgst: float
    sgst: float
    cess: float = 0.0


class GSTR1DocSummary(BaseModel):
    doc_type: str = "Invoices for outward supply"
    from_serial: str
    to_serial: str
    total_count: int
    cancelled_count: int
    net_issued: int


class GSTR1ReportResponse(BaseModel):
    gstin: str
    business_name: str
    period: str  # e.g. "092026"
    from_date: str
    to_date: str
    summary: Dict[str, Any]
    b2b: List[GSTR1B2BRecipient]
    b2cl: List[GSTR1B2CLInvoice]
    b2cs: List[GSTR1B2CSItem]
    hsn_summary: List[GSTR1HSNItem]
    doc_summary: GSTR1DocSummary


# ==============================================================================
# GSTR-3B Schemas
# ==============================================================================

class GSTR3BSupplyRow(BaseModel):
    taxable_value: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0


class GSTR3BOutwardSupplies(BaseModel):
    taxable_outward: GSTR3BSupplyRow
    zero_rated_outward: GSTR3BSupplyRow
    other_outward_exempt: GSTR3BSupplyRow
    inward_reverse_charge: GSTR3BSupplyRow
    non_gst_outward: GSTR3BSupplyRow


class GSTR3BITCRow(BaseModel):
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0


class GSTR3BEligibleITC(BaseModel):
    all_other_itc: GSTR3BITCRow
    ineligible_itc: GSTR3BITCRow


class GSTR3BNetTaxPayable(BaseModel):
    cgst_output: float
    cgst_itc: float
    cgst_net_payable: float
    sgst_output: float
    sgst_itc: float
    sgst_net_payable: float
    igst_output: float
    igst_itc: float
    igst_net_payable: float
    total_cash_tax_payable: float


class GSTR3BReportResponse(BaseModel):
    gstin: str
    business_name: str
    period: str
    from_date: str
    to_date: str
    outward_supplies: GSTR3BOutwardSupplies
    eligible_itc: GSTR3BEligibleITC
    net_tax_payable: GSTR3BNetTaxPayable


# ==============================================================================
# E-Invoicing & QR Code Schemas
# ==============================================================================

class EInvoiceResponse(BaseModel):
    bill_id: str
    bill_number: str
    is_b2b: bool
    is_eligible: bool
    irn: Optional[str] = None
    ack_no: Optional[str] = None
    ack_date: Optional[str] = None
    signed_qr_data: Optional[str] = None
    dynamic_upi_qr: Optional[str] = None
    upi_intent_url: Optional[str] = None
    seller_gstin: Optional[str] = None
    buyer_gstin: Optional[str] = None
    total_invoice_value: float
    taxable_value: float
    total_tax_value: float
    einvoice_payload: Optional[Dict[str, Any]] = None
    status: str
    message: str
