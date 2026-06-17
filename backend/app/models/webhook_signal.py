from sqlalchemy import String, Boolean, Numeric, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime
from decimal import Decimal
from typing import Optional


class WebhookSignal(Base):
    __tablename__ = "webhook_signals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bot_id: Mapped[int] = mapped_column(ForeignKey("bots.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    action: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    pair: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    bot: Mapped["Bot"] = relationship(back_populates="webhook_signals")
