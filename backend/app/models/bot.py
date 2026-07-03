from sqlalchemy import String, Boolean, Integer, Numeric, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime
from decimal import Decimal
from typing import Optional


class Bot(Base):
    __tablename__ = "bots"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exchange_key_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("exchange_keys.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    pair: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    base_asset: Mapped[str] = mapped_column(String(10), nullable=False)
    quote_asset: Mapped[str] = mapped_column(String(10), nullable=False)

    # Bot type: dca | grid
    bot_type: Mapped[str] = mapped_column(String(20), default="dca", server_default="dca", index=True)

    # Grid (bot_type == "grid")
    grid_lower_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    grid_upper_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    grid_levels: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    grid_order_size: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)

    # Base Order
    base_order_type: Mapped[str] = mapped_column(String(20), default="market")
    base_order_size: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)

    # Safety Orders
    max_safety_orders: Mapped[int] = mapped_column(Integer, default=5)
    safety_order_size: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    safety_order_step_pct: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    safety_order_volume_scale: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=Decimal("1.5"))
    safety_order_step_scale: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=Decimal("1.0"))

    # Take Profit
    take_profit_type: Mapped[str] = mapped_column(String(20), default="fixed")
    take_profit_pct: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    trailing_deviation_pct: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("0.5"))

    # Stop Loss
    stop_loss_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    stop_loss_type: Mapped[str] = mapped_column(String(20), default="fixed")
    stop_loss_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    stop_loss_trailing_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)

    # Start Condition
    start_condition: Mapped[str] = mapped_column(String(30), default="immediately")
    webhook_secret: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Reinvest
    reinvest_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))

    # Status
    status: Mapped[str] = mapped_column(String(20), default="inactive", index=True)
    is_paper: Mapped[bool] = mapped_column(Boolean, default=False)
    max_deals_count: Mapped[int] = mapped_column(Integer, default=0)
    deals_completed: Mapped[int] = mapped_column(Integer, default=0)
    cooldown_seconds: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_deal_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="bots")
    exchange_key: Mapped[Optional["ExchangeKey"]] = relationship(back_populates="bots")
    deals: Mapped[list["Deal"]] = relationship(back_populates="bot", cascade="all, delete-orphan")
    indicator_configs: Mapped[list["IndicatorConfig"]] = relationship(back_populates="bot", cascade="all, delete-orphan")
    webhook_signals: Mapped[list["WebhookSignal"]] = relationship(back_populates="bot", cascade="all, delete-orphan")
