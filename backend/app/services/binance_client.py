import asyncio
import uuid
from decimal import Decimal, ROUND_DOWN
from typing import Optional
from binance.client import Client
from binance.exceptions import BinanceAPIException
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging

logger = logging.getLogger(__name__)


class BinanceClientError(Exception):
    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        self.code = code


class BinanceSpotClient:
    """Async-friendly wrapper around python-binance with retry logic."""

    def __init__(self, api_key: str, api_secret: str, testnet: bool = False):
        self._client = Client(
            api_key=api_key,
            api_secret=api_secret,
            testnet=testnet,
        )
        self._symbol_info_cache: dict = {}

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def _run_sync(self, func, *args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: func(*args, **kwargs))

    async def get_account_info(self) -> dict:
        try:
            return await self._run_sync(self._client.get_account)
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def get_balances(self) -> list[dict]:
        info = await self.get_account_info()
        return [b for b in info["balances"] if float(b["free"]) > 0 or float(b["locked"]) > 0]

    async def get_symbol_info(self, symbol: str) -> dict:
        if symbol in self._symbol_info_cache:
            return self._symbol_info_cache[symbol]
        try:
            info = await self._run_sync(self._client.get_symbol_info, symbol)
            if not info:
                raise BinanceClientError(f"Symbol {symbol} not found")
            self._symbol_info_cache[symbol] = info
            return info
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def get_ticker_price(self, symbol: str) -> Decimal:
        try:
            ticker = await self._run_sync(self._client.get_symbol_ticker, symbol=symbol)
            return Decimal(ticker["price"])
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def get_ticker_24h(self, symbol: str) -> dict:
        try:
            return await self._run_sync(self._client.get_ticker, symbol=symbol)
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def get_klines(self, symbol: str, interval: str, limit: int = 200) -> list:
        try:
            return await self._run_sync(
                self._client.get_klines, symbol=symbol, interval=interval, limit=limit
            )
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def place_market_buy(self, symbol: str, quote_qty: Decimal) -> dict:
        try:
            client_id = f"cb_{uuid.uuid4().hex[:16]}"
            result = await self._run_sync(
                self._client.order_market_buy,
                symbol=symbol,
                quoteOrderQty=str(quote_qty),
                newClientOrderId=client_id,
            )
            return result
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def place_limit_buy(
        self, symbol: str, quantity: Decimal, price: Decimal
    ) -> dict:
        try:
            client_id = f"cb_{uuid.uuid4().hex[:16]}"
            result = await self._run_sync(
                self._client.order_limit_buy,
                symbol=symbol,
                quantity=str(quantity),
                price=str(price),
                newClientOrderId=client_id,
            )
            return result
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def place_limit_sell(
        self, symbol: str, quantity: Decimal, price: Decimal
    ) -> dict:
        try:
            client_id = f"cb_{uuid.uuid4().hex[:16]}"
            result = await self._run_sync(
                self._client.order_limit_sell,
                symbol=symbol,
                quantity=str(quantity),
                price=str(price),
                newClientOrderId=client_id,
            )
            return result
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def place_market_sell(self, symbol: str, quantity: Decimal) -> dict:
        try:
            client_id = f"cb_{uuid.uuid4().hex[:16]}"
            result = await self._run_sync(
                self._client.order_market_sell,
                symbol=symbol,
                quantity=str(quantity),
                newClientOrderId=client_id,
            )
            return result
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def cancel_order(self, symbol: str, order_id: str) -> dict:
        try:
            return await self._run_sync(
                self._client.cancel_order, symbol=symbol, orderId=order_id
            )
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def get_order_status(self, symbol: str, order_id: str) -> dict:
        try:
            return await self._run_sync(
                self._client.get_order, symbol=symbol, orderId=order_id
            )
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def get_open_orders(self, symbol: Optional[str] = None) -> list:
        try:
            kwargs = {"symbol": symbol} if symbol else {}
            return await self._run_sync(self._client.get_open_orders, **kwargs)
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))

    async def validate_api_key(self) -> dict:
        try:
            info = await self.get_account_info()
            permissions = info.get("permissions", [])
            return {"valid": True, "permissions": permissions}
        except BinanceClientError as e:
            return {"valid": False, "permissions": [], "error": str(e)}

    async def quantize_quantity(self, symbol: str, quantity: Decimal) -> Decimal:
        info = await self.get_symbol_info(symbol)
        filters = {f["filterType"]: f for f in info["filters"]}
        lot_filter = filters.get("LOT_SIZE", {})
        step_size = Decimal(lot_filter.get("stepSize", "0.00000001"))
        if step_size > 0:
            precision = abs(step_size.normalize().as_tuple().exponent)
            fmt = Decimal("0." + "0" * precision)
            return quantity.quantize(fmt, rounding=ROUND_DOWN)
        return quantity

    async def quantize_price(self, symbol: str, price: Decimal) -> Decimal:
        info = await self.get_symbol_info(symbol)
        filters = {f["filterType"]: f for f in info["filters"]}
        price_filter = filters.get("PRICE_FILTER", {})
        tick_size = Decimal(price_filter.get("tickSize", "0.01"))
        if tick_size > 0:
            precision = abs(tick_size.normalize().as_tuple().exponent)
            fmt = Decimal("0." + "0" * precision)
            return price.quantize(fmt, rounding=ROUND_DOWN)
        return price

    async def get_tradable_pairs(self, quote_asset: str = "USDT") -> list[str]:
        try:
            exchange_info = await self._run_sync(self._client.get_exchange_info)
            return [
                s["symbol"]
                for s in exchange_info["symbols"]
                if s["quoteAsset"] == quote_asset
                and s["status"] == "TRADING"
                and s["isSpotTradingAllowed"]
            ]
        except BinanceAPIException as e:
            raise BinanceClientError(str(e), code=str(e.code))
