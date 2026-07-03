from sqlalchemy import String, Boolean, Integer, Numeric, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime
from decimal import Decimal
from typing import Optional


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bot_id: Mapped[int] = mapped_column(ForeignKey("bots.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pair: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    is_paper: Mapped[bool] = mapped_column(Boolean, default=False)

    # State
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)

    # Pricing
    base_order_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    average_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    current_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    take_profit_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    stop_loss_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    trailing_tp_high: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    trailing_sl_high: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    trailing_tp_active: Mapped[bool] = mapped_column(Boolean, default=False)

    # Volume
    total_base_qty: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"))
    total_quote_spent: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"))
    safety_orders_placed: Mapped[int] = mapped_column(Integer, default=0)
    safety_orders_filled: Mapped[int] = mapped_column(Integer, default=0)

    # Grid bot durumu (JSON: prev_price + tutulan seviyeler)
    grid_state: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # P&L
    realized_pnl: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    realized_pnl_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    commission_paid: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"))

    # Timing
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    bot: Mapped["Bot"] = relationship(back_populates="deals")
    user: Mapped["User"] = relationship(back_populates="deals")
    orders: Mapped[list["Order"]] = relationship(back_populates="deal", cascade="all, delete-orphan")
