from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class OrderRead(BaseModel):
    id: int
    deal_id: int
    type: str
    side: str
    order_type: str
    status: str
    safety_order_num: Optional[int]
    price: Optional[Decimal]
    quantity: Decimal
    filled_quantity: Decimal
    avg_fill_price: Optional[Decimal]
    quote_qty: Optional[Decimal]
    commission: Decimal
    commission_asset: Optional[str]
    placed_at: Optional[datetime]
    filled_at: Optional[datetime]

    model_config = {"from_attributes": True}


class DealRead(BaseModel):
    id: int
    bot_id: int
    user_id: int
    pair: str
    is_paper: bool
    status: str
    base_order_price: Optional[Decimal]
    average_price: Optional[Decimal]
    current_price: Optional[Decimal]
    take_profit_price: Optional[Decimal]
    stop_loss_price: Optional[Decimal]
    total_base_qty: Decimal
    total_quote_spent: Decimal
    safety_orders_placed: int
    safety_orders_filled: int
    realized_pnl: Optional[Decimal]
    realized_pnl_pct: Optional[Decimal]
    commission_paid: Decimal
    opened_at: Optional[datetime]
    closed_at: Optional[datetime]
    created_at: datetime

    # Computed
    unrealized_pnl: Optional[Decimal] = None
    unrealized_pnl_pct: Optional[Decimal] = None
    duration_minutes: Optional[int] = None

    orders: List[OrderRead] = []

    model_config = {"from_attributes": True}


class DealCloseRequest(BaseModel):
    reason: str = "manual"
