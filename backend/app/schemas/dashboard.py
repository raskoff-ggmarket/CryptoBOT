from pydantic import BaseModel
from typing import Optional, List, Any
from decimal import Decimal


class DashboardSummary(BaseModel):
    total_equity: Decimal
    used_capital: Decimal
    available_capital: Decimal
    daily_pnl: Decimal
    daily_pnl_pct: Decimal
    total_profit: Decimal
    active_bots: int
    inactive_bots: int
    active_deals: int
    completed_deals_today: int
    win_rate_pct: Optional[Decimal]
    avg_deal_duration_hours: Optional[Decimal]


class PnLPoint(BaseModel):
    date: str
    pnl: float
    cumulative_pnl: float
    deals_count: int


class BotPerformance(BaseModel):
    bot_id: int
    bot_name: str
    pair: str
    status: str
    total_deals: int
    win_rate_pct: Optional[Decimal]
    total_profit: Decimal
    active_deals: int


class RiskStatus(BaseModel):
    daily_loss_used_pct: Decimal
    daily_loss_limit_pct: Decimal
    open_deals: int
    max_open_deals: int
    capital_used_pct: Decimal
    max_capital_pct: Decimal
    risk_triggered: bool
