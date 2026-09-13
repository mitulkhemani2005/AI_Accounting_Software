from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import get_current_user, require_permission
from app.models.user import User
from app.models.accounting import AccountGroup, Account, JournalEntry
from app.schemas.accounting import (
    AccountCreate,
    AccountUpdate,
    AccountResponse,
    AccountGroupResponse,
    JournalEntryCreate,
    JournalEntryResponse,
    DayBookReportResponse,
    CashBankBookResponse,
    LedgerStatementResponse,
    TrialBalanceResponse,
    ProfitLossResponse,
    BalanceSheetResponse,
)
from app.services.accounting_service import (
    seed_default_chart_of_accounts,
    post_journal_entry,
    get_day_book,
    get_cash_bank_book,
    get_account_ledger_statement,
    get_trial_balance,
    get_profit_and_loss,
    get_balance_sheet,
)
from app.services.audit_service import log_audit_event

router = APIRouter()


# --- 1. Account Groups & Chart of Accounts ---

@router.get("/groups", response_model=List[AccountGroupResponse])
async def list_account_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all account groups for tenant"""
    await seed_default_chart_of_accounts(db, current_user.tenant_id)
    res = await db.execute(
        select(AccountGroup).where(AccountGroup.tenant_id == current_user.tenant_id).order_by(AccountGroup.code.asc())
    )
    return list(res.scalars().all())


@router.get("/accounts", response_model=List[AccountResponse])
async def list_accounts(
    nature: Optional[str] = Query(None, description="Filter by nature: asset, liability, equity, income, expense"),
    account_type: Optional[str] = Query(None, description="Filter by account type: cash, bank, debtor, creditor, tax, sales, purchase, general"),
    search: Optional[str] = Query(None, description="Search account code or name"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List Chart of Accounts with current live balances"""
    await seed_default_chart_of_accounts(db, current_user.tenant_id)
    query = select(Account, AccountGroup.name.label("group_name"))\
        .outerjoin(AccountGroup, Account.group_id == AccountGroup.id)\
        .where(Account.tenant_id == current_user.tenant_id)

    if nature:
        query = query.where(Account.nature == nature.lower())
    if account_type:
        query = query.where(Account.account_type == account_type.lower())
    if search:
        term = f"%{search.strip()}%"
        query = query.where(Account.name.ilike(term) | Account.code.ilike(term))

    query = query.order_by(Account.code.asc())
    res = await db.execute(query)
    
    accounts = []
    for acc, grp_name in res.all():
        accounts.append(AccountResponse(
            id=acc.id,
            tenant_id=acc.tenant_id,
            group_id=acc.group_id,
            group_name=grp_name,
            code=acc.code,
            name=acc.name,
            nature=acc.nature,
            account_type=acc.account_type,
            opening_balance=acc.opening_balance,
            current_balance=acc.current_balance,
            is_system=acc.is_system,
            is_active=acc.is_active,
            description=acc.description,
            created_at=acc.created_at
        ))
    return accounts


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_account(
    payload: AccountCreate,
    request: Request,
    current_user: User = Depends(require_permission("accounting.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new custom ledger account in the Chart of Accounts"""
    await seed_default_chart_of_accounts(db, current_user.tenant_id)
    # Check duplicate code
    exist = await db.execute(
        select(Account).where(Account.tenant_id == current_user.tenant_id, Account.code == payload.code.strip().upper())
    )
    if exist.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Account code '{payload.code}' already exists")

    acc = Account(
        tenant_id=current_user.tenant_id,
        group_id=payload.group_id,
        code=payload.code.strip().upper(),
        name=payload.name.strip(),
        nature=payload.nature.lower(),
        account_type=payload.account_type.lower(),
        opening_balance=payload.opening_balance,
        current_balance=payload.opening_balance,
        is_system=False,
        is_active=True,
        description=payload.description
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="Account",
        entity_id=acc.id,
        details={"code": acc.code, "name": acc.name, "nature": acc.nature},
        ip_address=client_ip
    )

    return AccountResponse(
        id=acc.id,
        tenant_id=acc.tenant_id,
        group_id=acc.group_id,
        group_name=None,
        code=acc.code,
        name=acc.name,
        nature=acc.nature,
        account_type=acc.account_type,
        opening_balance=acc.opening_balance,
        current_balance=acc.current_balance,
        is_system=acc.is_system,
        is_active=acc.is_active,
        description=acc.description,
        created_at=acc.created_at
    )


@router.put("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: str,
    payload: AccountUpdate,
    request: Request,
    current_user: User = Depends(require_permission("accounting.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Update custom account details or opening balance"""
    res = await db.execute(
        select(Account).where(Account.tenant_id == current_user.tenant_id, Account.id == account_id)
    )
    acc = res.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if field == "opening_balance" and val is not None:
            diff = val - acc.opening_balance
            acc.opening_balance = val
            acc.current_balance += diff
        else:
            setattr(acc, field, val)

    await db.commit()
    await db.refresh(acc)

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="UPDATE",
        entity_type="Account",
        entity_id=acc.id,
        details=update_dict,
        ip_address=client_ip
    )

    return AccountResponse(
        id=acc.id,
        tenant_id=acc.tenant_id,
        group_id=acc.group_id,
        group_name=None,
        code=acc.code,
        name=acc.name,
        nature=acc.nature,
        account_type=acc.account_type,
        opening_balance=acc.opening_balance,
        current_balance=acc.current_balance,
        is_system=acc.is_system,
        is_active=acc.is_active,
        description=acc.description,
        created_at=acc.created_at
    )


# --- 2. Manual Journal Entry Vouchers ---

@router.post("/journal", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_journal_voucher(
    payload: JournalEntryCreate,
    request: Request,
    current_user: User = Depends(require_permission("accounting.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Post manual journal entry voucher (CA adjusting entries, depreciation, contra, expenses)"""
    entry = await post_journal_entry(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        payload=payload
    )

    client_ip = request.client.host if request.client else None
    await log_audit_event(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="JournalEntry",
        entity_id=entry.id,
        details={"entry_number": entry.entry_number, "total_debit": entry.total_debit},
        ip_address=client_ip
    )

    # Convert to response
    from app.models.accounting import JournalItem
    items_res = await db.execute(
        select(JournalItem, Account)
        .join(Account, JournalItem.account_id == Account.id)
        .where(JournalItem.journal_entry_id == entry.id)
    )
    items_dto = []
    for it, acc in items_res.all():
        items_dto.append({
            "id": it.id,
            "account_id": it.account_id,
            "account_code": acc.code,
            "account_name": acc.name,
            "party_id": it.party_id,
            "debit": it.debit,
            "credit": it.credit,
            "narration": it.narration
        })

    return JournalEntryResponse(
        id=entry.id,
        tenant_id=entry.tenant_id,
        entry_number=entry.entry_number,
        entry_date=entry.entry_date,
        voucher_type=entry.voucher_type,
        reference_type=entry.reference_type,
        reference_id=entry.reference_id,
        total_debit=entry.total_debit,
        total_credit=entry.total_credit,
        narration=entry.narration,
        status=entry.status,
        created_by_user_id=entry.created_by_user_id,
        created_at=entry.created_at,
        items=items_dto
    )


# --- 3. Financial Reports ---

@router.get("/reports/day-book", response_model=DayBookReportResponse)
async def get_day_book_report(
    start_date: Optional[datetime] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="End date (ISO format)"),
    voucher_type: Optional[str] = Query(None, description="Filter by voucher type: sale, purchase, receipt, payment, journal, contra"),
    search: Optional[str] = Query(None, description="Search voucher number or narration"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Day Book: chronological transaction register of all double-entry journal vouchers"""
    return await get_day_book(
        db=db,
        tenant_id=current_user.tenant_id,
        start_date=start_date,
        end_date=end_date,
        voucher_type=voucher_type,
        search=search
    )


@router.get("/reports/cash-book", response_model=CashBankBookResponse)
async def get_cash_book_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cash Book: cash receipts, payments, and running balance"""
    return await get_cash_bank_book(
        db=db,
        tenant_id=current_user.tenant_id,
        account_type="cash",
        start_date=start_date,
        end_date=end_date
    )


@router.get("/reports/bank-book", response_model=CashBankBookResponse)
async def get_bank_book_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Bank Book: bank receipts, payments, online settlements, and running balance"""
    return await get_cash_bank_book(
        db=db,
        tenant_id=current_user.tenant_id,
        account_type="bank",
        start_date=start_date,
        end_date=end_date
    )


@router.get("/reports/ledger/{account_id}", response_model=LedgerStatementResponse)
async def get_account_ledger(
    account_id: str,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """General Ledger / Statement of Account with debits, credits, and running balance"""
    return await get_account_ledger_statement(
        db=db,
        tenant_id=current_user.tenant_id,
        account_id=account_id,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/reports/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance_report(
    as_of_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Trial Balance: 2-column balancing report verifying Total Debit == Total Credit"""
    return await get_trial_balance(
        db=db,
        tenant_id=current_user.tenant_id,
        as_of_date=as_of_date
    )


@router.get("/reports/profit-and-loss", response_model=ProfitLossResponse)
async def get_profit_and_loss_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Profit & Loss Statement: Trading Account (Gross Profit) + Operating P&L (Net Profit)"""
    return await get_profit_and_loss(
        db=db,
        tenant_id=current_user.tenant_id,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/reports/balance-sheet", response_model=BalanceSheetResponse)
async def get_balance_sheet_report(
    as_of_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Balance Sheet: Assets (Fixed & Current) = Liabilities (Current Liabilities & Capital & Net Profit)"""
    return await get_balance_sheet(
        db=db,
        tenant_id=current_user.tenant_id,
        as_of_date=as_of_date
    )


@router.post("/seed-defaults", status_code=status.HTTP_200_OK)
async def seed_chart_of_accounts(
    current_user: User = Depends(require_permission("accounting.manage")),
    db: AsyncSession = Depends(get_db)
):
    """Seed / Re-seed default Indian SMB Chart of Accounts for current tenant"""
    await seed_default_chart_of_accounts(db, current_user.tenant_id)
    return {"status": "success", "message": "Chart of Accounts initialized successfully"}
