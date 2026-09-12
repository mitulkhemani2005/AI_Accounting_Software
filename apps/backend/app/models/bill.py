import uuid
from typing import Optional, List
from sqlalchemy import String, Float, Boolean, ForeignKey, UniqueConstraint, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base, TimestampMixin


class Bill(Base, TimestampMixin):
    __tablename__ = "bills"
    __table_args__ = (
        UniqueConstraint("tenant_id", "bill_number", name="uq_tenant_bill_number"),
        UniqueConstraint("tenant_id", "offline_sync_id", name="uq_tenant_offline_sync_id"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bill_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(30), default="sale", nullable=False, index=True) # sale, purchase, credit_note, debit_note
    
    # Party / Customer details
    party_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    party_name: Mapped[str] = mapped_column(String(200), default="Cash Customer", nullable=False)
    party_mobile: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    party_gst: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    is_interstate: Mapped[bool] = mapped_column(default=False, nullable=False)  # If True, charge IGST instead of CGST+SGST

    # Audit & User tracking
    created_by_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    
    # Financial breakdown
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    taxable_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    gst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    igst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    round_off: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Payment status
    payment_mode: Mapped[str] = mapped_column(String(30), default="cash", nullable=False) # cash, upi, card, credit, split
    payment_status: Mapped[str] = mapped_column(String(30), default="paid", nullable=False) # paid, partial, unpaid
    paid_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Offline sync idempotency & review status
    offline_sync_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="active", nullable=False) # active, void, cancelled
    is_reviewed_by_admin: Mapped[bool] = mapped_column(default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bill_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    customer: Mapped[Optional["Customer"]] = relationship("Customer", back_populates="bills")
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id], lazy="selectin")
    items: Mapped[List["BillItem"]] = relationship(
        "BillItem", back_populates="bill", cascade="all, delete-orphan", lazy="selectin"
    )


class BillItem(Base, TimestampMixin):
    __tablename__ = "bill_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    bill_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bills.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="PCS", nullable=False)
    rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Taxes
    gst_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    taxable_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    igst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Relationships
    bill: Mapped["Bill"] = relationship("Bill", back_populates="items")
    item: Mapped[Optional["Item"]] = relationship("Item", back_populates="bill_items")
