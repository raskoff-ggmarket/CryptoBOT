from sqlalchemy import Integer, Numeric, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime
from decimal import Decimal
from typing import Optional


class BacktestResult(Base):
    __tablename__ = "backtest_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("backtest_runs.id", ondelete="CASCADE"), unique=True, nullable=False)

    total_deals: Mapped[int] = mapped_column(Integer, default=0)
    winning_deals: Mapped[int] = mapped_column(Integer, default=0)
    losing_deals: Mapped[int] = mapped_column(Integer, default=0)
    win_rate_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    total_profit: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    total_profit_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    max_drawdown_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    sharpe_ratio: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    profit_factor: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    avg_deal_duration_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    best_deal_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    worst_deal_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    total_commission: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)

    equity_curve: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    deals_detail: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    run: Mapped["BacktestRun"] = relationship(back_populates="result")
