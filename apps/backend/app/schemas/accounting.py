from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# --- Account Groups & Chart of Accounts ---
class AccountGroupResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    code: str
    nature: str
    parent_id: Optional[str] = None
    is_system: bool = False

    model_config = ConfigDict(from_attributes=True)


class AccountCreate(BaseModel):
    code: str = Field(..., description="Unique account code, e.g. 1010, 5010")
    name: str = Field(..., description="Account name, e.g. Cash in Hand")
    nature: str = Field(..., description="asset, liability, equity, income, expense")
    account_type: str = Field("general", description="cash, bank, debtor, creditor, tax, sales, purchase, general")
    group_id: Optional[str] = None
    opening_balance: float = 0.0
    description: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    group_id: Optional[str] = None
    opening_balance: Optional[float] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class AccountResponse(BaseModel):
    id: str
    tenant_id: str
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    code: str
    name: str
    nature: str
    account_type: str
    opening_balance: float
    current_balance: float
    is_system: bool
    is_active: bool
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Journal Entries & Vouchers ---
class JournalItemCreate(BaseModel):
    account_id: str
    party_id: Optional[str] = None
    debit: float = 0.0
    credit: float = 0.0
    narration: Optional[str] = None


class JournalItemResponse(BaseModel):
    id: str
    account_id: str
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    party_id: Optional[str] = None
    party_name: Optional[str] = None
    debit: float
    credit: float
    narration: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class JournalEntryCreate(BaseModel):
    voucher_type: str = Field("journal", description="sale, purchase, payment, receipt, journal, contra")
    entry_date: Optional[datetime] = None
    reference_type: Optional[str] = Field("manual", description="bill, payment, manual")
    reference_id: Optional[str] = None
    narration: Optional[str] = None
    items: List[JournalItemCreate]


class JournalEntryResponse(BaseModel):
    id: str
    tenant_id: str
    entry_number: str
    entry_date: datetime
    voucher_type: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    total_debit: float
    total_credit: float
    narration: Optional[str] = None
    status: str
    created_by_user_id: Optional[str] = None
    created_at: datetime
    items: List[JournalItemResponse]

    model_config = ConfigDict(from_attributes=True)


# --- Financial Reports ---

# 1. Day Book Report
class DayBookItemResponse(BaseModel):
    id: str
    entry_number: str
    entry_date: datetime
    voucher_type: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    narration: Optional[str] = None
    total_amount: float
    items: List[JournalItemResponse]


class DayBookReportResponse(BaseModel):
    start_date: datetime
    end_date: datetime
    total_entries: int
    total_debit: float
    total_credit: float
    entries: List[DayBookItemResponse]


# 2. Cash & Bank Book Reports
class CashBankTransaction(BaseModel):
    date: datetime
    entry_number: str
    voucher_type: str
    particulars: str
    debit: float
    credit: float
    running_balance: float


class CashBankBookResponse(BaseModel):
    account_id: str
    account_name: str
    account_code: str
    account_type: str
    start_date: datetime
    end_date: datetime
    opening_balance: float
    total_received: float
    total_paid: float
    closing_balance: float
    transactions: List[CashBankTransaction]


# 3. General Ledger / Statement of Account
class LedgerStatementEntry(BaseModel):
    date: datetime
    entry_number: str
    voucher_type: str
    reference_id: Optional[str] = None
    particulars: str
    debit: float
    credit: float
    balance: float


class LedgerStatementResponse(BaseModel):
    account_id: str
    account_name: str
    account_code: str
    nature: str
    start_date: datetime
    end_date: datetime
    opening_balance: float
    total_debit: float
    total_credit: float
    closing_balance: float
    entries: List[LedgerStatementEntry]


# 4. Trial Balance Report
class TrialBalanceRow(BaseModel):
    account_id: str
    account_code: str
    account_name: str
    group_name: Optional[str] = None
    nature: str
    opening_balance: float
    debit_total: float
    credit_total: float
    net_debit: float
    net_credit: float


class TrialBalanceResponse(BaseModel):
    as_of_date: datetime
    total_debit: float
    total_credit: float
    is_balanced: bool
    difference: float
    rows: List[TrialBalanceRow]


# 5. Profit & Loss Statement
class PLItem(BaseModel):
    code: str
    name: str
    amount: float


class ProfitLossResponse(BaseModel):
    start_date: datetime
    end_date: datetime
    # Trading Account
    sales_revenue: float
    other_operating_revenue: float
    total_revenue: float
    purchase_costs: float
    direct_expenses: float
    cost_of_goods_sold: float
    gross_profit: float
    # P&L Operating Account
    indirect_income: float
    discount_received: float
    indirect_expenses: float
    discount_allowed: float
    total_indirect_expenses: float
    net_profit: float
    # Line breakdowns
    income_breakdown: List[PLItem]
    expense_breakdown: List[PLItem]


# 6. Balance Sheet
class BalanceSheetSectionItem(BaseModel):
    code: str
    name: str
    amount: float


class BalanceSheetSection(BaseModel):
    title: str
    total: float
    items: List[BalanceSheetSectionItem]


class BalanceSheetResponse(BaseModel):
    as_of_date: datetime
    # Assets
    fixed_assets: BalanceSheetSection
    current_assets: BalanceSheetSection
    total_assets: float
    # Liabilities & Equity
    capital_and_equity: BalanceSheetSection
    current_liabilities: BalanceSheetSection
    net_profit_current_year: float
    total_liabilities_and_equity: float
    is_balanced: bool
    difference: float
