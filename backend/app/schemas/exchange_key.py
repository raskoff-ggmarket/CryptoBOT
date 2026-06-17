from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ExchangeKeyCreate(BaseModel):
    label: str = Field(min_length=1, max_length=100)
    exchange: str = Field(default="binance")
    api_key: str = Field(min_length=10)
    api_secret: str = Field(min_length=10)
    is_paper: bool = False


class ExchangeKeyRead(BaseModel):
    id: int
    user_id: int
    label: str
    exchange: str
    api_key_masked: str
    is_paper: bool
    is_valid: bool
    permissions: List[str]
    validated_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class ExchangeKeyUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=100)


class BalanceItem(BaseModel):
    asset: str
    free: str
    locked: str
    total: str


class AccountBalances(BaseModel):
    exchange_key_id: int
    balances: List[BalanceItem]
