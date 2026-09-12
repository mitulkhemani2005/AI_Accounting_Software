import uuid
from typing import Optional, List
from sqlalchemy import String, Float, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Item(Base, TimestampMixin):
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "sku", name="uq_tenant_item_sku"),
        UniqueConstraint("tenant_id", "barcode", name="uq_tenant_item_barcode"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(100), default="General", nullable=False, index=True)
    unit: Mapped[str] = mapped_column(String(20), default="PCS", nullable=False)  # PCS, KG, LTR, BOX, MTR
    sale_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    purchase_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    gst_rate: Mapped[float] = mapped_column(Float, default=18.0, nullable=False)  # 0, 5, 12, 18, 28
    is_tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    min_stock_alert: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    bill_items: Mapped[List["BillItem"]] = relationship("BillItem", back_populates="item")
