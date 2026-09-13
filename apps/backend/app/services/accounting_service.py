from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_, delete
from fastapi import HTTPException, status

from app.models.accounting import AccountGroup, Account, JournalEntry, JournalItem
from app.models.user import User
from app.models.party import Customer, Supplier
from app.models.inventory import Stock
from app.models.item import Item
from app.schemas.accounting import (
    AccountCreate,
    AccountUpdate,
    AccountResponse,
    AccountGroupResponse,
    JournalItemCreate,
    JournalEntryCreate,
    JournalEntryResponse,
    JournalItemResponse,
    DayBookReportResponse,
    DayBookItemResponse,
    CashBankBookResponse,
    CashBankTransaction,
    LedgerStatementResponse,
    LedgerStatementEntry,
    TrialBalanceResponse,
    TrialBalanceRow,
    ProfitLossResponse,
    PLItem,
    BalanceSheetResponse,
    BalanceSheetSection,
    BalanceSheetSectionItem,
)


# --- 1. Standard Indian SMB Chart of Accounts Seeding ---

DEFAULT_ACCOUNT_GROUPS = [
    {"code": "ASSET_CURRENT", "name": "Current Assets", "nature": "asset"},
    {"code": "ASSET_FIXED", "name": "Fixed Assets", "nature": "asset"},
    {"code": "LIAB_CURRENT", "name": "Current Liabilities", "nature": "liability"},
    {"code": "LIAB_DUTIES_TAXES", "name": "Duties & Taxes", "nature": "liability"},
    {"code": "EQUITY_CAPITAL", "name": "Capital & Equity", "nature": "equity"},
    {"code": "REV_SALES", "name": "Sales Accounts", "nature": "income"},
    {"code": "REV_INDIRECT", "name": "Indirect Income", "nature": "income"},
    {"code": "EXP_PURCHASE", "name": "Purchase Accounts", "nature": "expense"},
    {"code": "EXP_DIRECT", "name": "Direct Expenses", "nature": "expense"},
    {"code": "EXP_INDIRECT", "name": "Indirect Expenses", "nature": "expense"},
]

DEFAULT_ACCOUNTS = [
    # Assets
    {"code": "1010-CASH", "name": "Cash-in-Hand", "nature": "asset", "account_type": "cash", "group_code": "ASSET_CURRENT", "is_system": True},
    {"code": "1020-BANK", "name": "Bank Account (Primary)", "nature": "asset", "account_type": "bank", "group_code": "ASSET_CURRENT", "is_system": True},
    {"code": "1030-DEBTORS", "name": "Sundry Debtors (Customers)", "nature": "asset", "account_type": "debtor", "group_code": "ASSET_CURRENT", "is_system": True},
    {"code": "1040-INPUT-CGST", "name": "Input CGST", "nature": "asset", "account_type": "tax", "group_code": "ASSET_CURRENT", "is_system": True},
    {"code": "1041-INPUT-SGST", "name": "Input SGST", "nature": "asset", "account_type": "tax", "group_code": "ASSET_CURRENT", "is_system": True},
    {"code": "1042-INPUT-IGST", "name": "Input IGST", "nature": "asset", "account_type": "tax", "group_code": "ASSET_CURRENT", "is_system": True},
    {"code": "1050-STOCK", "name": "Stock-in-Hand / Inventory", "nature": "asset", "account_type": "general", "group_code": "ASSET_CURRENT", "is_system": True},
    {"code": "1060-MACHINERY", "name": "Machinery & Equipment", "nature": "asset", "account_type": "general", "group_code": "ASSET_FIXED", "is_system": False},
    {"code": "1070-FURNITURE", "name": "Furniture & Fixtures", "nature": "asset", "account_type": "general", "group_code": "ASSET_FIXED", "is_system": False},

    # Liabilities
    {"code": "2010-CREDITORS", "name": "Sundry Creditors (Suppliers)", "nature": "liability", "account_type": "creditor", "group_code": "LIAB_CURRENT", "is_system": True},
    {"code": "2020-OUTPUT-CGST", "name": "Output CGST", "nature": "liability", "account_type": "tax", "group_code": "LIAB_DUTIES_TAXES", "is_system": True},
    {"code": "2021-OUTPUT-SGST", "name": "Output SGST", "nature": "liability", "account_type": "tax", "group_code": "LIAB_DUTIES_TAXES", "is_system": True},
    {"code": "2022-OUTPUT-IGST", "name": "Output IGST", "nature": "liability", "account_type": "tax", "group_code": "LIAB_DUTIES_TAXES", "is_system": True},

    # Equity
    {"code": "3010-CAPITAL", "name": "Owner's Capital Account", "nature": "equity", "account_type": "general", "group_code": "EQUITY_CAPITAL", "is_system": True},
    {"code": "3020-EARNINGS", "name": "Retained / Current Earnings", "nature": "equity", "account_type": "general", "group_code": "EQUITY_CAPITAL", "is_system": True},

    # Income
    {"code": "4010-SALES", "name": "Sales Revenue", "nature": "income", "account_type": "sales", "group_code": "REV_SALES", "is_system": True},
    {"code": "4020-DISC-RECEIVED", "name": "Discount Received", "nature": "income", "account_type": "general", "group_code": "REV_INDIRECT", "is_system": True},
    {"code": "4030-OTHER-INCOME", "name": "Other Operating Income", "nature": "income", "account_type": "general", "group_code": "REV_INDIRECT", "is_system": False},

    # Expenses
    {"code": "5010-PURCHASE", "name": "Purchase Account", "nature": "expense", "account_type": "purchase", "group_code": "EXP_PURCHASE", "is_system": True},
    {"code": "5020-DISC-ALLOWED", "name": "Discount Allowed", "nature": "expense", "account_type": "general", "group_code": "EXP_INDIRECT", "is_system": True},
    {"code": "5030-FREIGHT", "name": "Freight & Inward Cartage", "nature": "expense", "account_type": "general", "group_code": "EXP_DIRECT", "is_system": False},
    {"code": "5040-RENT", "name": "Rent Expense", "nature": "expense", "account_type": "general", "group_code": "EXP_INDIRECT", "is_system": False},
    {"code": "5050-SALARY", "name": "Staff Salary & Wages", "nature": "expense", "account_type": "general", "group_code": "EXP_INDIRECT", "is_system": False},
    {"code": "5060-ELECTRICITY", "name": "Electricity & Utilities", "nature": "expense", "account_type": "general", "group_code": "EXP_INDIRECT", "is_system": False},
    {"code": "5070-OFFICE", "name": "General Office Expenses", "nature": "expense", "account_type": "general", "group_code": "EXP_INDIRECT", "is_system": False},
    {"code": "5080-ROUNDOFF", "name": "Round Off Adjustment", "nature": "expense", "account_type": "general", "group_code": "EXP_INDIRECT", "is_system": True},
]


async def seed_default_chart_of_accounts(db: AsyncSession, tenant_id: str) -> None:
    """Ensure standard Indian SMB Account Groups and Chart of Accounts are seeded for tenant"""
    # 1. Seed Groups
    group_map: Dict[str, str] = {}
    for g in DEFAULT_ACCOUNT_GROUPS:
        res = await db.execute(
            select(AccountGroup).where(
                AccountGroup.tenant_id == tenant_id,
                AccountGroup.code == g["code"]
            )
        )
        existing = res.scalar_one_or_none()
        if not existing:
            group = AccountGroup(
                tenant_id=tenant_id,
                code=g["code"],
                name=g["name"],
                nature=g["nature"],
                is_system=True
            )
            db.add(group)
            await db.flush()
            group_map[g["code"]] = group.id
        else:
            group_map[g["code"]] = existing.id

    # 2. Seed Accounts
    for acc in DEFAULT_ACCOUNTS:
        res = await db.execute(
            select(Account).where(
                Account.tenant_id == tenant_id,
                Account.code == acc["code"]
            )
        )
        existing = res.scalar_one_or_none()
        if not existing:
            group_id = group_map.get(acc["group_code"])
            account = Account(
                tenant_id=tenant_id,
                group_id=group_id,
                code=acc["code"],
                name=acc["name"],
                nature=acc["nature"],
                account_type=acc["account_type"],
                opening_balance=0.0,
                current_balance=0.0,
                is_system=acc.get("is_system", False),
                is_active=True
            )
            db.add(account)

    await db.commit()


async def get_account_by_code(db: AsyncSession, tenant_id: str, code: str) -> Account:
    """Retrieve an account by code for tenant, ensuring COA is seeded if missing"""
    res = await db.execute(
        select(Account).where(Account.tenant_id == tenant_id, Account.code == code)
    )
    acc = res.scalar_one_or_none()
    if not acc:
        await seed_default_chart_of_accounts(db, tenant_id)
        res = await db.execute(
            select(Account).where(Account.tenant_id == tenant_id, Account.code == code)
        )
        acc = res.scalar_one_or_none()
        if not acc:
            raise HTTPException(status_code=404, detail=f"Account with code '{code}' not found")
    return acc


async def generate_voucher_number(db: AsyncSession, tenant_id: str, voucher_type: str) -> str:
    """Generate sequential voucher number: JV-YYYY-0001, SV-YYYY-0001, PV-YYYY-0001, RC-YYYY-0001, PM-YYYY-0001"""
    prefix_map = {
        "sale": "SV",
        "purchase": "PV",
        "receipt": "RC",
        "payment": "PM",
        "contra": "CV",
        "journal": "JV"
    }
    prefix = prefix_map.get(voucher_type, "JV")
    year = datetime.now(timezone.utc).year
    pattern = f"{prefix}-{year}-%"

    res = await db.execute(
        select(func.count(JournalEntry.id)).where(
            JournalEntry.tenant_id == tenant_id,
            JournalEntry.entry_number.like(pattern)
        )
    )
    count = res.scalar() or 0
    return f"{prefix}-{year}-{str(count + 1).zfill(4)}"


# --- 2. Double-Entry Posting Engine ---

async def post_journal_entry(
    db: AsyncSession,
    tenant_id: str,
    user_id: Optional[str],
    payload: JournalEntryCreate
) -> JournalEntry:
    """Validate double-entry equality (Debit == Credit) and post entry with atomic account balance updates"""
    if not payload.items or len(payload.items) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Journal entry must contain at least 2 line items (one debit and one credit)"
        )

    total_debit = round(sum(i.debit for i in payload.items), 2)
    total_credit = round(sum(i.credit for i in payload.items), 2)

    if total_debit <= 0 or total_credit <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total debit and total credit must be greater than zero"
        )

    if abs(total_debit - total_credit) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Double-entry violation: Total Debit (₹{total_debit:.2f}) does not equal Total Credit (₹{total_credit:.2f})"
        )

    entry_num = await generate_voucher_number(db, tenant_id, payload.voucher_type)
    entry_date = payload.entry_date or datetime.now(timezone.utc)

    journal_entry = JournalEntry(
        tenant_id=tenant_id,
        entry_number=entry_num,
        entry_date=entry_date,
        voucher_type=payload.voucher_type,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        total_debit=total_debit,
        total_credit=total_credit,
        narration=payload.narration,
        status="posted",
        created_by_user_id=user_id
    )
    db.add(journal_entry)
    await db.flush()

    for item in payload.items:
        acc_res = await db.execute(
            select(Account).where(Account.tenant_id == tenant_id, Account.id == item.account_id)
        )
        acc = acc_res.scalar_one_or_none()
        if not acc:
            raise HTTPException(status_code=404, detail=f"Account '{item.account_id}' not found")

        j_item = JournalItem(
            journal_entry_id=journal_entry.id,
            account_id=acc.id,
            party_id=item.party_id,
            debit=round(item.debit, 2),
            credit=round(item.credit, 2),
            narration=item.narration
        )
        db.add(j_item)

        # Update Account current_balance
        # Nature asset & expense: Debit increases (+), Credit decreases (-)
        # Nature liability, equity, income: Credit increases (+), Debit decreases (-)
        if acc.nature in ["asset", "expense"]:
            acc.current_balance += (item.debit - item.credit)
        else:
            acc.current_balance += (item.credit - item.debit)

    await db.commit()
    await db.refresh(journal_entry)
    return journal_entry


# --- 3. Automatic Journal Entry Hooks ---

async def record_sale_journal_entry(
    db: AsyncSession,
    tenant_id: str,
    user_id: Optional[str],
    bill_id: str,
    bill_number: str,
    is_cash: bool,
    party_id: Optional[str],
    party_name: str,
    taxable_amount: float,
    cgst_amount: float,
    sgst_amount: float,
    igst_amount: float,
    discount_amount: float,
    round_off: float,
    total_amount: float,
    payment_mode: str = "cash"
) -> Optional[JournalEntry]:
    """Auto-generate double-entry voucher for Sale Bill"""
    await seed_default_chart_of_accounts(db, tenant_id)

    # 1. Accounts
    cash_acc = await get_account_by_code(db, tenant_id, "1010-CASH")
    bank_acc = await get_account_by_code(db, tenant_id, "1020-BANK")
    debtor_acc = await get_account_by_code(db, tenant_id, "1030-DEBTORS")
    sales_acc = await get_account_by_code(db, tenant_id, "4010-SALES")
    cgst_acc = await get_account_by_code(db, tenant_id, "2020-OUTPUT-CGST")
    sgst_acc = await get_account_by_code(db, tenant_id, "2021-OUTPUT-SGST")
    igst_acc = await get_account_by_code(db, tenant_id, "2022-OUTPUT-IGST")
    disc_acc = await get_account_by_code(db, tenant_id, "5020-DISC-ALLOWED")
    round_acc = await get_account_by_code(db, tenant_id, "5080-ROUNDOFF")

    items: List[JournalItemCreate] = []

    # Debit side: Cash, Bank, or Customer (Sundry Debtors)
    debit_acc = cash_acc if (is_cash or payment_mode == "cash") else (bank_acc if payment_mode in ["online", "upi", "card", "bank"] else debtor_acc)
    items.append(JournalItemCreate(
        account_id=debit_acc.id,
        party_id=party_id,
        debit=round(total_amount, 2),
        credit=0.0,
        narration=f"Sale #{bill_number} to {party_name}"
    ))

    # Debit side: Discount Allowed (if any)
    if discount_amount > 0:
        items.append(JournalItemCreate(
            account_id=disc_acc.id,
            debit=round(discount_amount, 2),
            credit=0.0,
            narration=f"Discount on Sale #{bill_number}"
        ))

    # Credit side: Sales Revenue Account
    items.append(JournalItemCreate(
        account_id=sales_acc.id,
        debit=0.0,
        credit=round(taxable_amount + discount_amount, 2),
        narration=f"Taxable Sales #{bill_number}"
    ))

    # Credit side: GST Outputs
    if cgst_amount > 0:
        items.append(JournalItemCreate(
            account_id=cgst_acc.id,
            debit=0.0,
            credit=round(cgst_amount, 2),
            narration=f"CGST Output #{bill_number}"
        ))
    if sgst_amount > 0:
        items.append(JournalItemCreate(
            account_id=sgst_acc.id,
            debit=0.0,
            credit=round(sgst_amount, 2),
            narration=f"SGST Output #{bill_number}"
        ))
    if igst_amount > 0:
        items.append(JournalItemCreate(
            account_id=igst_acc.id,
            debit=0.0,
            credit=round(igst_amount, 2),
            narration=f"IGST Output #{bill_number}"
        ))

    # Round off adjustment line if any
    if round_off != 0:
        if round_off > 0:
            # Credit round off (positive adjustment to reach total)
            items.append(JournalItemCreate(
                account_id=round_acc.id,
                debit=0.0,
                credit=round(round_off, 2),
                narration=f"Round off adjustment #{bill_number}"
            ))
        else:
            # Debit round off (negative adjustment)
            items.append(JournalItemCreate(
                account_id=round_acc.id,
                debit=round(abs(round_off), 2),
                credit=0.0,
                narration=f"Round off adjustment #{bill_number}"
            ))

    payload = JournalEntryCreate(
        voucher_type="sale",
        reference_type="bill",
        reference_id=bill_id,
        narration=f"Sale Invoice #{bill_number} for {party_name}",
        items=items
    )
    return await post_journal_entry(db, tenant_id, user_id, payload)


async def record_purchase_journal_entry(
    db: AsyncSession,
    tenant_id: str,
    user_id: Optional[str],
    purchase_bill_id: str,
    purchase_bill_number: str,
    supplier_name: str,
    is_cash: bool,
    supplier_id: Optional[str],
    taxable_amount: float,
    cgst_amount: float,
    sgst_amount: float,
    igst_amount: float,
    discount_amount: float,
    round_off: float,
    total_amount: float,
    payment_mode: str = "cash"
) -> Optional[JournalEntry]:
    """Auto-generate double-entry voucher for Purchase Inward"""
    await seed_default_chart_of_accounts(db, tenant_id)

    purch_acc = await get_account_by_code(db, tenant_id, "5010-PURCHASE")
    cgst_acc = await get_account_by_code(db, tenant_id, "1040-INPUT-CGST")
    sgst_acc = await get_account_by_code(db, tenant_id, "1041-INPUT-SGST")
    igst_acc = await get_account_by_code(db, tenant_id, "1042-INPUT-IGST")
    creditor_acc = await get_account_by_code(db, tenant_id, "2010-CREDITORS")
    cash_acc = await get_account_by_code(db, tenant_id, "1010-CASH")
    bank_acc = await get_account_by_code(db, tenant_id, "1020-BANK")
    disc_acc = await get_account_by_code(db, tenant_id, "4020-DISC-RECEIVED")
    round_acc = await get_account_by_code(db, tenant_id, "5080-ROUNDOFF")

    items: List[JournalItemCreate] = []

    # Debit side: Purchase Account (Taxable)
    items.append(JournalItemCreate(
        account_id=purch_acc.id,
        debit=round(taxable_amount + discount_amount, 2),
        credit=0.0,
        narration=f"Purchase Inward #{purchase_bill_number}"
    ))

    # Debit side: Input GST Credits
    if cgst_amount > 0:
        items.append(JournalItemCreate(
            account_id=cgst_acc.id,
            debit=round(cgst_amount, 2),
            credit=0.0,
            narration=f"CGST Input Credit #{purchase_bill_number}"
        ))
    if sgst_amount > 0:
        items.append(JournalItemCreate(
            account_id=sgst_acc.id,
            debit=round(sgst_amount, 2),
            credit=0.0,
            narration=f"SGST Input Credit #{purchase_bill_number}"
        ))
    if igst_amount > 0:
        items.append(JournalItemCreate(
            account_id=igst_acc.id,
            debit=round(igst_amount, 2),
            credit=0.0,
            narration=f"IGST Input Credit #{purchase_bill_number}"
        ))

    # Credit side: Cash, Bank, or Sundry Creditors (Supplier)
    credit_acc = cash_acc if (is_cash or payment_mode == "cash") else (bank_acc if payment_mode in ["online", "upi", "card", "bank"] else creditor_acc)
    items.append(JournalItemCreate(
        account_id=credit_acc.id,
        party_id=supplier_id,
        debit=0.0,
        credit=round(total_amount, 2),
        narration=f"Purchase #{purchase_bill_number} from {supplier_name}"
    ))

    # Credit side: Discount Received if any
    if discount_amount > 0:
        items.append(JournalItemCreate(
            account_id=disc_acc.id,
            debit=0.0,
            credit=round(discount_amount, 2),
            narration=f"Discount on Purchase #{purchase_bill_number}"
        ))

    # Round off adjustment line if any
    if round_off != 0:
        if round_off < 0:
            # Credit round off
            items.append(JournalItemCreate(
                account_id=round_acc.id,
                debit=0.0,
                credit=round(abs(round_off), 2),
                narration=f"Round off on Purchase #{purchase_bill_number}"
            ))
        else:
            # Debit round off
            items.append(JournalItemCreate(
                account_id=round_acc.id,
                debit=round(round_off, 2),
                credit=0.0,
                narration=f"Round off on Purchase #{purchase_bill_number}"
            ))

    payload = JournalEntryCreate(
        voucher_type="purchase",
        reference_type="bill",
        reference_id=purchase_bill_id,
        narration=f"Purchase Inward #{purchase_bill_number} from {supplier_name}",
        items=items
    )
    return await post_journal_entry(db, tenant_id, user_id, payload)


async def record_payment_journal_entry(
    db: AsyncSession,
    tenant_id: str,
    user_id: Optional[str],
    payment_id: str,
    party_type: str,
    party_name: str,
    party_id: str,
    amount: float,
    payment_mode: str,
    reference_number: Optional[str],
    notes: Optional[str]
) -> Optional[JournalEntry]:
    """Auto-generate double-entry voucher for Customer Receipt or Supplier Payment"""
    await seed_default_chart_of_accounts(db, tenant_id)

    cash_acc = await get_account_by_code(db, tenant_id, "1010-CASH")
    bank_acc = await get_account_by_code(db, tenant_id, "1020-BANK")
    debtor_acc = await get_account_by_code(db, tenant_id, "1030-DEBTORS")
    creditor_acc = await get_account_by_code(db, tenant_id, "2010-CREDITORS")

    is_bank = payment_mode.lower() in ["bank", "upi", "card", "cheque", "netbanking", "online"]
    source_acc = bank_acc if is_bank else cash_acc

    items: List[JournalItemCreate] = []

    if party_type == "customer":
        # Customer Receipt: Dr. Cash/Bank, Cr. Sundry Debtors
        items.append(JournalItemCreate(
            account_id=source_acc.id,
            debit=round(amount, 2),
            credit=0.0,
            narration=f"Receipt from Customer {party_name} ({payment_mode})"
        ))
        items.append(JournalItemCreate(
            account_id=debtor_acc.id,
            party_id=party_id,
            debit=0.0,
            credit=round(amount, 2),
            narration=f"Received on Account from {party_name}"
        ))
        v_type = "receipt"
    else:
        # Supplier Payment: Dr. Sundry Creditors, Cr. Cash/Bank
        items.append(JournalItemCreate(
            account_id=creditor_acc.id,
            party_id=party_id,
            debit=round(amount, 2),
            credit=0.0,
            narration=f"Payment to Supplier {party_name}"
        ))
        items.append(JournalItemCreate(
            account_id=source_acc.id,
            debit=0.0,
            credit=round(amount, 2),
            narration=f"Paid via {payment_mode} ({reference_number or 'Ref-None'})"
        ))
        v_type = "payment"

    payload = JournalEntryCreate(
        voucher_type=v_type,
        reference_type="payment",
        reference_id=payment_id,
        narration=notes or f"{v_type.capitalize()} for {party_name}",
        items=items
    )
    return await post_journal_entry(db, tenant_id, user_id, payload)


async def void_journal_entry_for_reference(
    db: AsyncSession,
    tenant_id: str,
    user_id: Optional[str],
    reference_type: str,
    reference_id: str
) -> bool:
    """Void / Reverse linked journal entries when a bill or payment is voided"""
    res = await db.execute(
        select(JournalEntry).where(
            JournalEntry.tenant_id == tenant_id,
            JournalEntry.reference_type == reference_type,
            JournalEntry.reference_id == reference_id,
            JournalEntry.status == "posted"
        )
    )
    entries = res.scalars().all()
    for entry in entries:
        # Revert account balances
        items_res = await db.execute(
            select(JournalItem).where(JournalItem.journal_entry_id == entry.id)
        )
        for item in items_res.scalars().all():
            acc_res = await db.execute(
                select(Account).where(Account.id == item.account_id)
            )
            acc = acc_res.scalar_one_or_none()
            if acc:
                if acc.nature in ["asset", "expense"]:
                    acc.current_balance -= (item.debit - item.credit)
                else:
                    acc.current_balance -= (item.credit - item.debit)

        entry.status = "void"

    await db.commit()
    return True


# --- 4. Financial Reports Implementation ---

# 1. Day Book Report
async def get_day_book(
    db: AsyncSession,
    tenant_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    voucher_type: Optional[str] = None,
    search: Optional[str] = None
) -> DayBookReportResponse:
    """Generate Day Book report for given date range and filters"""
    query = select(JournalEntry).where(JournalEntry.tenant_id == tenant_id, JournalEntry.status == "posted")

    if start_date:
        query = query.where(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.where(JournalEntry.entry_date <= end_date)
    if voucher_type:
        query = query.where(JournalEntry.voucher_type == voucher_type)
    if search:
        query = query.where(
            or_(
                JournalEntry.entry_number.ilike(f"%{search}%"),
                JournalEntry.narration.ilike(f"%{search}%")
            )
        )

    query = query.order_by(desc(JournalEntry.entry_date), desc(JournalEntry.created_at))
    res = await db.execute(query)
    entries = res.scalars().all()

    entry_dtos: List[DayBookItemResponse] = []
    total_deb = 0.0
    total_cred = 0.0

    for e in entries:
        items_res = await db.execute(
            select(JournalItem, Account)
            .join(Account, JournalItem.account_id == Account.id)
            .where(JournalItem.journal_entry_id == e.id)
        )
        items_dto = []
        for ji, acc in items_res.all():
            items_dto.append(JournalItemResponse(
                id=ji.id,
                account_id=ji.account_id,
                account_code=acc.code,
                account_name=acc.name,
                party_id=ji.party_id,
                debit=ji.debit,
                credit=ji.credit,
                narration=ji.narration
            ))

        total_deb += e.total_debit
        total_cred += e.total_credit

        entry_dtos.append(DayBookItemResponse(
            id=e.id,
            entry_number=e.entry_number,
            entry_date=e.entry_date,
            voucher_type=e.voucher_type,
            reference_type=e.reference_type,
            reference_id=e.reference_id,
            narration=e.narration,
            total_amount=e.total_debit,
            items=items_dto
        ))

    s_date = start_date or (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0))
    e_date = end_date or datetime.now(timezone.utc)

    return DayBookReportResponse(
        start_date=s_date,
        end_date=e_date,
        total_entries=len(entry_dtos),
        total_debit=round(total_deb, 2),
        total_credit=round(total_cred, 2),
        entries=entry_dtos
    )


# 2. Cash & Bank Book Reports
async def get_cash_bank_book(
    db: AsyncSession,
    tenant_id: str,
    account_type: str = "cash",
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> CashBankBookResponse:
    """Generate Cash Book or Bank Book statement"""
    await seed_default_chart_of_accounts(db, tenant_id)
    target_code = "1010-CASH" if account_type == "cash" else "1020-BANK"
    acc = await get_account_by_code(db, tenant_id, target_code)

    s_date = start_date or datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0)
    e_date = end_date or datetime.now(timezone.utc)

    # 1. Opening balance before start_date
    prior_res = await db.execute(
        select(
            func.coalesce(func.sum(JournalItem.debit), 0.0).label("deb"),
            func.coalesce(func.sum(JournalItem.credit), 0.0).label("cred")
        )
        .join(JournalEntry, JournalItem.journal_entry_id == JournalEntry.id)
        .where(
            JournalEntry.tenant_id == tenant_id,
            JournalEntry.status == "posted",
            JournalItem.account_id == acc.id,
            JournalEntry.entry_date < s_date
        )
    )
    p_deb, p_cred = prior_res.one()
    op_balance = round(acc.opening_balance + (p_deb - p_cred), 2)

    # 2. Period transactions
    period_res = await db.execute(
        select(JournalItem, JournalEntry)
        .join(JournalEntry, JournalItem.journal_entry_id == JournalEntry.id)
        .where(
            JournalEntry.tenant_id == tenant_id,
            JournalEntry.status == "posted",
            JournalItem.account_id == acc.id,
            JournalEntry.entry_date >= s_date,
            JournalEntry.entry_date <= e_date
        )
        .order_by(JournalEntry.entry_date.asc(), JournalEntry.created_at.asc())
    )

    transactions: List[CashBankTransaction] = []
    running = op_balance
    total_rec = 0.0
    total_pd = 0.0

    for ji, je in period_res.all():
        running += (ji.debit - ji.credit)
        total_rec += ji.debit
        total_pd += ji.credit

        particulars = je.narration or f"{je.voucher_type.capitalize()} #{je.entry_number}"
        transactions.append(CashBankTransaction(
            date=je.entry_date,
            entry_number=je.entry_number,
            voucher_type=je.voucher_type,
            particulars=particulars,
            debit=ji.debit,
            credit=ji.credit,
            running_balance=round(running, 2)
        ))

    return CashBankBookResponse(
        account_id=acc.id,
        account_name=acc.name,
        account_code=acc.code,
        account_type=acc.account_type,
        start_date=s_date,
        end_date=e_date,
        opening_balance=op_balance,
        total_received=round(total_rec, 2),
        total_paid=round(total_pd, 2),
        closing_balance=round(running, 2),
        transactions=transactions
    )


# 3. General Ledger Statement
async def get_account_ledger_statement(
    db: AsyncSession,
    tenant_id: str,
    account_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> LedgerStatementResponse:
    """Generate detailed Statement of Account / General Ledger"""
    acc_res = await db.execute(
        select(Account).where(Account.tenant_id == tenant_id, Account.id == account_id)
    )
    acc = acc_res.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    s_date = start_date or datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0)
    e_date = end_date or datetime.now(timezone.utc)

    # Prior balance
    prior_res = await db.execute(
        select(
            func.coalesce(func.sum(JournalItem.debit), 0.0).label("deb"),
            func.coalesce(func.sum(JournalItem.credit), 0.0).label("cred")
        )
        .join(JournalEntry, JournalItem.journal_entry_id == JournalEntry.id)
        .where(
            JournalEntry.tenant_id == tenant_id,
            JournalEntry.status == "posted",
            JournalItem.account_id == acc.id,
            JournalEntry.entry_date < s_date
        )
    )
    p_deb, p_cred = prior_res.one()
    if acc.nature in ["asset", "expense"]:
        op_balance = round(acc.opening_balance + (p_deb - p_cred), 2)
    else:
        op_balance = round(acc.opening_balance + (p_cred - p_deb), 2)

    # Period entries
    period_res = await db.execute(
        select(JournalItem, JournalEntry)
        .join(JournalEntry, JournalItem.journal_entry_id == JournalEntry.id)
        .where(
            JournalEntry.tenant_id == tenant_id,
            JournalEntry.status == "posted",
            JournalItem.account_id == acc.id,
            JournalEntry.entry_date >= s_date,
            JournalEntry.entry_date <= e_date
        )
        .order_by(JournalEntry.entry_date.asc(), JournalEntry.created_at.asc())
    )

    entries: List[LedgerStatementEntry] = []
    running = op_balance
    tot_deb = 0.0
    tot_cred = 0.0

    for ji, je in period_res.all():
        if acc.nature in ["asset", "expense"]:
            running += (ji.debit - ji.credit)
        else:
            running += (ji.credit - ji.debit)

        tot_deb += ji.debit
        tot_cred += ji.credit

        particulars = ji.narration or je.narration or f"{je.voucher_type.capitalize()} #{je.entry_number}"
        entries.append(LedgerStatementEntry(
            date=je.entry_date,
            entry_number=je.entry_number,
            voucher_type=je.voucher_type,
            reference_id=je.reference_id,
            particulars=particulars,
            debit=ji.debit,
            credit=ji.credit,
            balance=round(running, 2)
        ))

    return LedgerStatementResponse(
        account_id=acc.id,
        account_name=acc.name,
        account_code=acc.code,
        nature=acc.nature,
        start_date=s_date,
        end_date=e_date,
        opening_balance=op_balance,
        total_debit=round(tot_deb, 2),
        total_credit=round(tot_cred, 2),
        closing_balance=round(running, 2),
        entries=entries
    )


# 4. Trial Balance Report
async def get_trial_balance(
    db: AsyncSession,
    tenant_id: str,
    as_of_date: Optional[datetime] = None
) -> TrialBalanceResponse:
    """Generate 2-column balancing Trial Balance report (Total Debit == Total Credit)"""
    await seed_default_chart_of_accounts(db, tenant_id)
    target_date = as_of_date or datetime.now(timezone.utc)

    accounts_res = await db.execute(
        select(Account, AccountGroup)
        .outerjoin(AccountGroup, Account.group_id == AccountGroup.id)
        .where(Account.tenant_id == tenant_id, Account.is_active == True)
        .order_by(Account.code.asc())
    )

    rows: List[TrialBalanceRow] = []
    grand_debit = 0.0
    grand_credit = 0.0

    for acc, grp in accounts_res.all():
        mov_res = await db.execute(
            select(
                func.coalesce(func.sum(JournalItem.debit), 0.0).label("deb"),
                func.coalesce(func.sum(JournalItem.credit), 0.0).label("cred")
            )
            .join(JournalEntry, JournalItem.journal_entry_id == JournalEntry.id)
            .where(
                JournalEntry.tenant_id == tenant_id,
                JournalEntry.status == "posted",
                JournalItem.account_id == acc.id,
                JournalEntry.entry_date <= target_date
            )
        )
        deb_sum, cred_sum = mov_res.one()

        net_debit = 0.0
        net_credit = 0.0

        if acc.nature in ["asset", "expense"]:
            balance = acc.opening_balance + (deb_sum - cred_sum)
            if balance >= 0:
                net_debit = balance
            else:
                net_credit = abs(balance)
        else:
            balance = acc.opening_balance + (cred_sum - deb_sum)
            if balance >= 0:
                net_credit = balance
            else:
                net_debit = abs(balance)

        grand_debit += net_debit
        grand_credit += net_credit

        if deb_sum > 0 or cred_sum > 0 or acc.opening_balance != 0:
            rows.append(TrialBalanceRow(
                account_id=acc.id,
                account_code=acc.code,
                account_name=acc.name,
                group_name=grp.name if grp else None,
                nature=acc.nature,
                opening_balance=acc.opening_balance,
                debit_total=round(deb_sum, 2),
                credit_total=round(cred_sum, 2),
                net_debit=round(net_debit, 2),
                net_credit=round(net_credit, 2)
            ))

    diff = round(abs(grand_debit - grand_credit), 2)
    is_bal = diff < 0.01

    return TrialBalanceResponse(
        as_of_date=target_date,
        total_debit=round(grand_debit, 2),
        total_credit=round(grand_credit, 2),
        is_balanced=is_bal,
        difference=diff,
        rows=rows
    )


# 5. Profit & Loss Statement
async def get_profit_and_loss(
    db: AsyncSession,
    tenant_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> ProfitLossResponse:
    """Generate Profit & Loss (Trading & P&L) statement"""
    await seed_default_chart_of_accounts(db, tenant_id)
    s_date = start_date or datetime.now(timezone.utc).replace(month=1, day=1, hour=0, minute=0, second=0)
    e_date = end_date or (datetime.now(timezone.utc) + timedelta(days=1))

    # 1. Query Income Accounts
    inc_res = await db.execute(
        select(Account, func.coalesce(func.sum(JournalItem.credit - JournalItem.debit), 0.0).label("net"))
        .join(JournalItem, Account.id == JournalItem.account_id)
        .join(JournalEntry, JournalItem.journal_entry_id == JournalEntry.id)
        .where(
            Account.tenant_id == tenant_id,
            Account.nature == "income",
            JournalEntry.status == "posted",
            JournalEntry.entry_date >= s_date,
            JournalEntry.entry_date <= e_date
        )
        .group_by(Account.id)
    )

    sales_rev = 0.0
    other_rev = 0.0
    disc_rec = 0.0
    indirect_inc = 0.0
    income_items: List[PLItem] = []

    for acc, net in inc_res.all():
        val = max(0.0, net)
        income_items.append(PLItem(code=acc.code, name=acc.name, amount=round(val, 2)))
        if acc.code.startswith("4010"):
            sales_rev += val
        elif acc.code.startswith("4020"):
            disc_rec += val
        else:
            indirect_inc += val

    # 2. Query Expense Accounts
    exp_res = await db.execute(
        select(Account, func.coalesce(func.sum(JournalItem.debit - JournalItem.credit), 0.0).label("net"))
        .join(JournalItem, Account.id == JournalItem.account_id)
        .join(JournalEntry, JournalItem.journal_entry_id == JournalEntry.id)
        .where(
            Account.tenant_id == tenant_id,
            Account.nature == "expense",
            JournalEntry.status == "posted",
            JournalEntry.entry_date >= s_date,
            JournalEntry.entry_date <= e_date
        )
        .group_by(Account.id)
    )

    purch_cost = 0.0
    direct_exp = 0.0
    disc_allowed = 0.0
    indirect_exp = 0.0
    expense_items: List[PLItem] = []

    for acc, net in exp_res.all():
        val = max(0.0, net)
        expense_items.append(PLItem(code=acc.code, name=acc.name, amount=round(val, 2)))
        if acc.code.startswith("5010"):
            purch_cost += val
        elif acc.code.startswith("5030"):
            direct_exp += val
        elif acc.code.startswith("5020"):
            disc_allowed += val
        else:
            indirect_exp += val

    # Closing stock calculation for Trading Account COGS
    closing_res = await db.execute(
        select(
            func.coalesce(func.sum(Stock.quantity * Item.purchase_price), 0.0)
        )
        .join(Item, Stock.item_id == Item.id)
        .where(Stock.tenant_id == tenant_id, Item.is_active == True, Stock.quantity > 0)
    )
    closing_stock = closing_res.scalar() or 0.0

    cogs = max(0.0, purch_cost + direct_exp - closing_stock)
    tot_rev = sales_rev + other_rev
    gross_prof = tot_rev - cogs
    tot_indirect_exp = indirect_exp + disc_allowed
    net_prof = gross_prof + disc_rec + indirect_inc - tot_indirect_exp

    return ProfitLossResponse(
        start_date=s_date,
        end_date=e_date,
        sales_revenue=round(sales_rev, 2),
        other_operating_revenue=round(other_rev, 2),
        total_revenue=round(tot_rev, 2),
        purchase_costs=round(purch_cost, 2),
        direct_expenses=round(direct_exp, 2),
        cost_of_goods_sold=round(cogs, 2),
        gross_profit=round(gross_prof, 2),
        indirect_income=round(indirect_inc, 2),
        discount_received=round(disc_rec, 2),
        indirect_expenses=round(indirect_exp, 2),
        discount_allowed=round(disc_allowed, 2),
        total_indirect_expenses=round(tot_indirect_exp, 2),
        net_profit=round(net_prof, 2),
        income_breakdown=income_items,
        expense_breakdown=expense_items
    )


# 6. Balance Sheet Report
async def get_balance_sheet(
    db: AsyncSession,
    tenant_id: str,
    as_of_date: Optional[datetime] = None
) -> BalanceSheetResponse:
    """Generate Balance Sheet (Assets = Liabilities + Equity + Net Profit)"""
    await seed_default_chart_of_accounts(db, tenant_id)
    target_date = as_of_date or datetime.now(timezone.utc)

    # 1. Compute live inventory stock valuation (Closing Stock Asset)
    stock_res = await db.execute(
        select(
            func.coalesce(func.sum(Stock.quantity * Item.purchase_price), 0.0)
        )
        .join(Item, Stock.item_id == Item.id)
        .where(Stock.tenant_id == tenant_id, Item.is_active == True, Stock.quantity > 0)
    )
    closing_stock_val = stock_res.scalar() or 0.0

    # 2. Get trial balance as of date
    tb = await get_trial_balance(db, tenant_id, target_date)

    # 3. Compute Net Profit for Current Period
    pl = await get_profit_and_loss(db, tenant_id, None, target_date)
    net_profit = pl.net_profit

    fixed_assets_items: List[BalanceSheetSectionItem] = []
    current_assets_items: List[BalanceSheetSectionItem] = []
    capital_items: List[BalanceSheetSectionItem] = []
    current_liab_items: List[BalanceSheetSectionItem] = []

    tot_fixed = 0.0
    tot_current_assets = 0.0
    tot_capital = 0.0
    tot_current_liab = 0.0

    # Add Stock-in-Hand closing valuation
    if closing_stock_val > 0:
        current_assets_items.append(BalanceSheetSectionItem(
            code="1050-STOCK",
            name="Stock-in-Hand (Physical Inventory Valuation)",
            amount=round(closing_stock_val, 2)
        ))
        tot_current_assets += closing_stock_val

    for row in tb.rows:
        if row.nature == "asset":
            val = row.net_debit - row.net_credit
            if val != 0:
                if row.account_code.startswith("1060") or row.account_code.startswith("1070") or "FIXED" in (row.group_name or ""):
                    fixed_assets_items.append(BalanceSheetSectionItem(code=row.account_code, name=row.account_name, amount=round(val, 2)))
                    tot_fixed += val
                else:
                    if row.account_code != "1050-STOCK":  # already counted from live inventory
                        current_assets_items.append(BalanceSheetSectionItem(code=row.account_code, name=row.account_name, amount=round(val, 2)))
                        tot_current_assets += val
        elif row.nature == "liability":
            val = row.net_credit - row.net_debit
            if val != 0:
                current_liab_items.append(BalanceSheetSectionItem(code=row.account_code, name=row.account_name, amount=round(val, 2)))
                tot_current_liab += val
        elif row.nature == "equity":
            val = row.net_credit - row.net_debit
            if val != 0:
                capital_items.append(BalanceSheetSectionItem(code=row.account_code, name=row.account_name, amount=round(val, 2)))
                tot_capital += val

    total_assets = tot_fixed + tot_current_assets
    total_liabilities_equity = tot_capital + tot_current_liab + net_profit
    diff = round(abs(total_assets - total_liabilities_equity), 2)
    is_bal = diff < 0.05

    return BalanceSheetResponse(
        as_of_date=target_date,
        fixed_assets=BalanceSheetSection(title="Fixed Assets", total=round(tot_fixed, 2), items=fixed_assets_items),
        current_assets=BalanceSheetSection(title="Current Assets", total=round(tot_current_assets, 2), items=current_assets_items),
        total_assets=round(total_assets, 2),
        capital_and_equity=BalanceSheetSection(title="Capital & Reserves", total=round(tot_capital, 2), items=capital_items),
        current_liabilities=BalanceSheetSection(title="Current Liabilities & Provisions", total=round(tot_current_liab, 2), items=current_liab_items),
        net_profit_current_year=round(net_profit, 2),
        total_liabilities_and_equity=round(total_liabilities_equity, 2),
        is_balanced=is_bal,
        difference=diff
    )
