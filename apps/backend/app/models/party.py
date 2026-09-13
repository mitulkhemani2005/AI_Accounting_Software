import uuid
from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Float, Boolean, ForeignKey, UniqueConstraint, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Area(Base, TimestampMixin):
    __tablename__ = "areas"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_tenant_area_name"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    customers: Mapped[List["Customer"]] = relationship("Customer", back_populates="area")
    suppliers: Mapped[List["Supplier"]] = relationship("Supplier", back_populates="area")


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "mobile", name="uq_tenant_customer_mobile"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gst_number: Mapped[Optional[str]] = mapped_column(String(15), nullable=True, index=True)
    state: Mapped[str] = mapped_column(String(50), default="Maharashtra", nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    area_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("areas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    opening_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    current_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Relationships
    area: Mapped[Optional["Area"]] = relationship("Area", back_populates="customers")
    bills: Mapped[List["Bill"]] = relationship("Bill", back_populates="customer")


class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "mobile", name="uq_tenant_supplier_mobile"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gst_number: Mapped[Optional[str]] = mapped_column(String(15), nullable=True, index=True)
    state: Mapped[str] = mapped_column(String(50), default="Maharashtra", nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    area_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("areas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    opening_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    current_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Relationships
    area: Mapped[Optional["Area"]] = relationship("Area", back_populates="suppliers")


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    party_type: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )  # customer, supplier
    party_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    party_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    payment_type: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )  # payment_in (customer receipt), payment_out (supplier payment)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_mode: Mapped[str] = mapped_column(
        String(30), default="cash", nullable=False
    )  # cash, upi, bank_transfer, cheque, card
    reference_number: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )  # Txn ID, UTR, Cheque #
    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False
    )  # active, cancelled

