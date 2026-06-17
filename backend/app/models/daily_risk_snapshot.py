from sqlalchemy import Integer, Boolean, Numeric, ForeignKey, DateTime, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime, date
from decimal import Decimal


class DailyRiskSnapshot(Base):
    __tablename__ = "daily_risk_snapshots"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_daily_risk_user_date"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    starting_equity: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"))
    realized_loss: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"))
    deals_opened: Mapped[int] = mapped_column(Integer, default=0)
    risk_triggered: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
