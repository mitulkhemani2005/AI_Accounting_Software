import uuid
from typing import Optional, List
from datetime import datetime, date
from sqlalchemy import String, Float, Boolean, ForeignKey, UniqueConstraint, Text, DateTime, Date, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Godown(Base, TimestampMixin):
    """Warehouse / Store location for inventory holding"""
    __tablename__ = "godowns"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_tenant_godown_name"),
        UniqueConstraint("tenant_id", "code", name="uq_tenant_godown_code"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contact_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    stocks: Mapped[List["Stock"]] = relationship("Stock", back_populates="godown", cascade="all, delete-orphan")
    batches: Mapped[List["StockBatch"]] = relationship("StockBatch", back_populates="godown", cascade="all, delete-orphan")
    movements: Mapped[List["StockMovement"]] = relationship("StockMovement", back_populates="godown")


class Stock(Base, TimestampMixin):
    """Aggregate on-hand inventory quantity per item per godown"""
    __tablename__ = "stock"
    __table_args__ = (
        UniqueConstraint("tenant_id", "godown_id", "item_id", name="uq_tenant_godown_item_stock"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    godown_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("godowns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    min_stock_alert: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_restocked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    godown: Mapped["Godown"] = relationship("Godown", back_populates="stocks", lazy="joined")
    item: Mapped["Item"] = relationship("Item", lazy="joined")


class StockBatch(Base, TimestampMixin):
    """Granular batch & expiry tracking per item in a godown"""
    __tablename__ = "stock_batches"
    __table_args__ = (
        UniqueConstraint("tenant_id", "godown_id", "item_id", "batch_number", name="uq_tenant_stock_batch"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    godown_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("godowns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch_number: Mapped[str] = mapped_column(String(50), nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    manufacturing_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    purchase_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    mrp: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sale_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    godown: Mapped["Godown"] = relationship("Godown", back_populates="batches", lazy="joined")
    item: Mapped["Item"] = relationship("Item", lazy="joined")


class StockMovement(Base, TimestampMixin):
    """Audit log of every stock change (sale, purchase, transfer, adjustment)"""
    __tablename__ = "stock_movements"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    godown_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("godowns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    movement_type: Mapped[str] = mapped_column(
        String(30), nullable=False, index=True
    )  # sale_out, purchase_in, transfer_in, transfer_out, adjustment_in, adjustment_out, void_restock
    quantity: Mapped[float] = mapped_column(Float, nullable=False)  # positive number moved
    balance_after: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cost_per_unit: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reference_type: Mapped[str] = mapped_column(
        String(50), default="manual", nullable=False
    )  # bill, purchase_entry, stock_transfer, manual_adjustment
    reference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    batch_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    performed_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    godown: Mapped["Godown"] = relationship("Godown", back_populates="movements", lazy="joined")
    item: Mapped["Item"] = relationship("Item", lazy="joined")
    performed_by: Mapped[Optional["User"]] = relationship("User", lazy="joined")


class StockTransfer(Base, TimestampMixin):
    """Inter-godown transfer header"""
    __tablename__ = "stock_transfers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "transfer_number", name="uq_tenant_transfer_number"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    transfer_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    from_godown_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("godowns.id", ondelete="RESTRICT"), nullable=False
    )
    to_godown_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("godowns.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), default="completed", nullable=False)  # completed, cancelled
    transfer_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    from_godown: Mapped["Godown"] = relationship("Godown", foreign_keys=[from_godown_id], lazy="joined")
    to_godown: Mapped["Godown"] = relationship("Godown", foreign_keys=[to_godown_id], lazy="joined")
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id], lazy="joined")
    items: Mapped[List["StockTransferItem"]] = relationship(
        "StockTransferItem", back_populates="transfer", cascade="all, delete-orphan", lazy="selectin"
    )


class StockTransferItem(Base, TimestampMixin):
    """Line items inside a stock transfer"""
    __tablename__ = "stock_transfer_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    transfer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("stock_transfers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    batch_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="PCS", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    transfer: Mapped["StockTransfer"] = relationship("StockTransfer", back_populates="items")
    item: Mapped["Item"] = relationship("Item", lazy="joined")
