from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class SafetyOrderPreview(BaseModel):
    num: int
    price: Decimal
    size_quote: Decimal
    deviation_pct: Decimal
    total_quote: Decimal
    avg_price: Decimal
    required_change_pct: Decimal


class BotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    exchange_key_id: Optional[int] = None
    pair: str = Field(min_length=3, max_length=20)
    base_order_type: str = Field(default="market", pattern="^(market|limit)$")
    base_order_size: Decimal = Field(gt=0)

    max_safety_orders: int = Field(default=5, ge=0, le=25)
    safety_order_size: Decimal = Field(gt=0)
    safety_order_step_pct: Decimal = Field(gt=0, le=100)
    safety_order_volume_scale: Decimal = Field(default=Decimal("1.5"), ge=1, le=10)
    safety_order_step_scale: Decimal = Field(default=Decimal("1.0"), ge=1, le=5)

    take_profit_type: str = Field(default="fixed", pattern="^(fixed|trailing)$")
    take_profit_pct: Decimal = Field(gt=0, le=100)
    trailing_deviation_pct: Decimal = Field(default=Decimal("0.5"), gt=0, le=10)

    stop_loss_enabled: bool = False
    stop_loss_type: str = Field(default="fixed", pattern="^(fixed|trailing)$")
    stop_loss_pct: Optional[Decimal] = Field(None, gt=0, le=100)
    stop_loss_trailing_pct: Optional[Decimal] = Field(None, gt=0, le=100)

    start_condition: str = Field(default="immediately", pattern="^(immediately|indicator|webhook|scheduled)$")
    reinvest_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)

    is_paper: bool = False
    max_deals_count: int = Field(default=0, ge=0)
    cooldown_seconds: int = Field(default=0, ge=0)

    @field_validator("pair")
    @classmethod
    def upper_pair(cls, v: str) -> str:
        return v.upper()


class BotUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    exchange_key_id: Optional[int] = None
    base_order_type: Optional[str] = Field(None, pattern="^(market|limit)$")
    base_order_size: Optional[Decimal] = Field(None, gt=0)
    max_safety_orders: Optional[int] = Field(None, ge=0, le=25)
    safety_order_size: Optional[Decimal] = Field(None, gt=0)
    safety_order_step_pct: Optional[Decimal] = Field(None, gt=0, le=100)
    safety_order_volume_scale: Optional[Decimal] = Field(None, ge=1, le=10)
    safety_order_step_scale: Optional[Decimal] = Field(None, ge=1, le=5)
    take_profit_type: Optional[str] = Field(None, pattern="^(fixed|trailing)$")
    take_profit_pct: Optional[Decimal] = Field(None, gt=0, le=100)
    trailing_deviation_pct: Optional[Decimal] = Field(None, gt=0, le=10)
    stop_loss_enabled: Optional[bool] = None
    stop_loss_type: Optional[str] = Field(None, pattern="^(fixed|trailing)$")
    stop_loss_pct: Optional[Decimal] = Field(None, gt=0, le=100)
    stop_loss_trailing_pct: Optional[Decimal] = Field(None, gt=0, le=100)
    reinvest_pct: Optional[Decimal] = Field(None, ge=0, le=100)
    max_deals_count: Optional[int] = Field(None, ge=0)
    cooldown_seconds: Optional[int] = Field(None, ge=0)


class BotRead(BaseModel):
    id: int
    user_id: int
    exchange_key_id: Optional[int]
    name: str
    pair: str
    base_asset: str
    quote_asset: str
    base_order_type: str
    base_order_size: Decimal
    max_safety_orders: int
    safety_order_size: Decimal
    safety_order_step_pct: Decimal
    safety_order_volume_scale: Decimal
    safety_order_step_scale: Decimal
    take_profit_type: str
    take_profit_pct: Decimal
    trailing_deviation_pct: Decimal
    stop_loss_enabled: bool
    stop_loss_type: str
    stop_loss_pct: Optional[Decimal]
    stop_loss_trailing_pct: Optional[Decimal]
    start_condition: str
    webhook_secret: Optional[str]
    reinvest_pct: Decimal
    status: str
    is_paper: bool
    max_deals_count: int
    deals_completed: int
    cooldown_seconds: int
    created_at: datetime
    updated_at: datetime
    last_deal_at: Optional[datetime]

    # Computed
    active_deals_count: int = 0
    total_profit: Optional[Decimal] = None
    win_rate: Optional[Decimal] = None

    model_config = {"from_attributes": True}


class BotStopRequest(BaseModel):
    close_deals: bool = False


class BotStats(BaseModel):
    bot_id: int
    total_deals: int
    winning_deals: int
    losing_deals: int
    win_rate_pct: Optional[Decimal]
    total_profit: Optional[Decimal]
    total_profit_pct: Optional[Decimal]
    avg_deal_duration_hours: Optional[Decimal]
