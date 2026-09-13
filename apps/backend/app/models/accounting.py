from typing import List, Optional
from datetime import datetime, timezone
import uuid
from sqlalchemy import String, Float, Boolean, ForeignKey, DateTime, Text, Enum as SQLEnum, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class AccountGroup(Base, TimestampMixin):
    """Account Groups for hierarchical Chart of Accounts (e.g. Current Assets, Current Liabilities, Direct Expenses)"""
    __tablename__ = "account_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    nature: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="asset, liability, equity, income, expense"
    )
    parent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("account_groups.id", ondelete="SET NULL"), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    accounts: Mapped[List["Account"]] = relationship("Account", back_populates="group", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_accgroup_tenant_code", "tenant_id", "code", unique=True),
    )


class Account(Base, TimestampMixin):
    """Chart of Accounts (Ledger accounts)"""
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("account_groups.id", ondelete="SET NULL"), nullable=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    nature: Mapped[str] = mapped_column(String(20), nullable=False, comment="asset, liability, equity, income, expense")
    account_type: Mapped[str] = mapped_column(String(50), default="general", comment="cash, bank, debtor, creditor, tax, sales, purchase, general")
    opening_balance: Mapped[float] = mapped_column(Float, default=0.0)
    current_balance: Mapped[float] = mapped_column(Float, default=0.0)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    group: Mapped[Optional["AccountGroup"]] = relationship("AccountGroup", back_populates="accounts")
    journal_items: Mapped[List["JournalItem"]] = relationship("JournalItem", back_populates="account")

    __table_args__ = (
        Index("idx_account_tenant_code", "tenant_id", "code", unique=True),
        Index("idx_account_tenant_nature", "tenant_id", "nature"),
    )


class JournalEntry(Base, TimestampMixin):
    """Journal Voucher / Header record for double-entry bookkeeping"""
    __tablename__ = "journal_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_number: Mapped[str] = mapped_column(String(60), nullable=False)
    entry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    voucher_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="sale, purchase, payment, receipt, journal, contra"
    )
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="bill, payment, manual")
    reference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    total_debit: Mapped[float] = mapped_column(Float, default=0.0)
    total_credit: Mapped[float] = mapped_column(Float, default=0.0)
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="posted", comment="posted, void")
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    items: Mapped[List["JournalItem"]] = relationship("JournalItem", back_populates="journal_entry", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_jentry_tenant_num", "tenant_id", "entry_number", unique=True),
        Index("idx_jentry_tenant_date", "tenant_id", "entry_date"),
        Index("idx_jentry_tenant_ref", "tenant_id", "reference_type", "reference_id"),
    )


class JournalItem(Base, TimestampMixin):
    """Line items for a Journal Entry (Debits and Credits)"""
    __tablename__ = "journal_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    journal_entry_id: Mapped[str] = mapped_column(String(36), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    party_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, comment="Customer or Supplier ID if applicable")
    debit: Mapped[float] = mapped_column(Float, default=0.0)
    credit: Mapped[float] = mapped_column(Float, default=0.0)
    narration: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    journal_entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="items")
    account: Mapped["Account"] = relationship("Account", back_populates="journal_items")
