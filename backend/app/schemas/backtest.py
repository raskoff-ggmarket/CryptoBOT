from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, date
from decimal import Decimal


class BacktestCreate(BaseModel):
    bot_id: Optional[int] = None
    bot_config: Optional[dict] = None
    pair: str = Field(min_length=3, max_length=20)
    timeframe: str = Field(pattern="^(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)$")
    start_date: date
    end_date: date
    initial_capital: Decimal = Field(gt=0)


class BacktestRunRead(BaseModel):
    id: int
    user_id: int
    pair: str
    timeframe: str
    start_date: date
    end_date: date
    initial_capital: Decimal
    status: str
    progress_pct: Decimal
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class EquityPoint(BaseModel):
    ts: str
    equity: float


class DealDetail(BaseModel):
    opened_at: str
    closed_at: Optional[str]
    entry_price: float
    exit_price: Optional[float]
    pnl_pct: float
    pnl_amount: float
    safety_orders_used: int
    duration_hours: float
    close_reason: str


class BacktestResultRead(BaseModel):
    id: int
    run_id: int
    total_deals: int
    winning_deals: int
    losing_deals: int
    win_rate_pct: Optional[Decimal]
    total_profit: Optional[Decimal]
    total_profit_pct: Optional[Decimal]
    max_drawdown_pct: Optional[Decimal]
    sharpe_ratio: Optional[Decimal]
    profit_factor: Optional[Decimal]
    avg_deal_duration_hours: Optional[Decimal]
    best_deal_pct: Optional[Decimal]
    worst_deal_pct: Optional[Decimal]
    total_commission: Optional[Decimal]
    equity_curve: Optional[List[Any]]
    deals_detail: Optional[List[Any]]

    model_config = {"from_attributes": True}
