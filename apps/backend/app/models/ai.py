import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class AISuggestionCache(Base, TimestampMixin):
    """
    Caches association rule mining patterns and customer-specific product recommendation scores.
    """
    __tablename__ = "ai_suggestions_cache"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    customer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), index=True, nullable=True)

    # Serialized list of recommended item suggestions: [{item_id, item_name, score, reason, sale_price, unit}]
    suggested_items: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, default=list, nullable=True)

    # Serialized market basket association rules: [{antecedents: [id], consequent: id, support, confidence, lift}]
    frequent_patterns: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, default=list, nullable=True)

    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class RestockSuggestionCache(Base, TimestampMixin):
    """
    Caches inventory demand forecasts, average daily sales velocities, and dynamic reorder recommendations.
    """
    __tablename__ = "restock_suggestions_cache"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    item_id: Mapped[str] = mapped_column(String(36), ForeignKey("items.id", ondelete="CASCADE"), index=True, nullable=False)
    godown_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("godowns.id", ondelete="SET NULL"), nullable=True)

    current_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    avg_daily_sales: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    safety_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reorder_point: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    suggested_quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    days_of_stock_left: Mapped[float] = mapped_column(Float, default=999.0, nullable=False)
    
    # Urgency status: CRITICAL (<= 3 days), WARNING (4-7 days), HEALTHY (> 7 days)
    urgency: Mapped[str] = mapped_column(String(20), default="HEALTHY", index=True, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.85, nullable=False)

    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
