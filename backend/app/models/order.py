from sqlalchemy import String, Boolean, Integer, Numeric, ForeignKey, DateTime, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime
from decimal import Decimal
from typing import Optional


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True)
    bot_id: Mapped[int] = mapped_column(ForeignKey("bots.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    binance_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    client_order_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)

    type: Mapped[str] = mapped_column(String(30), nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    order_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    safety_order_num: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    stop_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    filled_quantity: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"))
    quote_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    avg_fill_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    commission: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"))
    commission_asset: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    is_paper: Mapped[bool] = mapped_column(Boolean, default=False)
    placed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    filled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    deal: Mapped["Deal"] = relationship(back_populates="orders")
