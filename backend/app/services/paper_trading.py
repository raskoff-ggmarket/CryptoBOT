"""
Paper trading virtual order execution engine.
Simulates fills based on current market price without real orders.
"""
from decimal import Decimal
from datetime import datetime, timezone
import uuid


COMMISSION_RATE = Decimal("0.001")


class PaperTradingEngine:
    def simulate_market_buy(
        self, current_price: Decimal, quote_qty: Decimal
    ) -> dict:
        commission = quote_qty * COMMISSION_RATE
        effective_quote = quote_qty - commission
        base_qty = effective_quote / current_price

        return {
            "binance_order_id": f"PAPER_{uuid.uuid4().hex[:12].upper()}",
            "status": "FILLED",
            "side": "BUY",
            "type": "MARKET",
            "avg_fill_price": current_price,
            "filled_quantity": base_qty,
            "quote_qty": quote_qty,
            "commission": commission,
            "commission_asset": "USDT",
            "filled_at": datetime.now(timezone.utc),
        }

    def simulate_market_sell(
        self, current_price: Decimal, base_qty: Decimal
    ) -> dict:
        gross = base_qty * current_price
        commission = gross * COMMISSION_RATE
        net_quote = gross - commission

        return {
            "binance_order_id": f"PAPER_{uuid.uuid4().hex[:12].upper()}",
            "status": "FILLED",
            "side": "SELL",
            "type": "MARKET",
            "avg_fill_price": current_price,
            "filled_quantity": base_qty,
            "quote_qty": net_quote,
            "commission": commission,
            "commission_asset": "USDT",
            "filled_at": datetime.now(timezone.utc),
        }

    def simulate_limit_buy(
        self, limit_price: Decimal, quote_qty: Decimal, current_price: Decimal
    ) -> dict:
        if current_price <= limit_price:
            return self.simulate_market_buy(current_price, quote_qty)
        base_qty = quote_qty / limit_price
        return {
            "binance_order_id": f"PAPER_{uuid.uuid4().hex[:12].upper()}",
            "status": "OPEN",
            "side": "BUY",
            "type": "LIMIT",
            "price": limit_price,
            "quantity": base_qty,
            "filled_quantity": Decimal("0"),
            "quote_qty": quote_qty,
            "commission": Decimal("0"),
            "commission_asset": "USDT",
            "filled_at": None,
        }

    def check_limit_fill(self, order: dict, current_price: Decimal) -> dict:
        if order["status"] != "OPEN":
            return order
        if order["side"] == "BUY" and current_price <= order["price"]:
            return self.simulate_market_buy(order["price"], order["quote_qty"])
        if order["side"] == "SELL" and current_price >= order["price"]:
            return self.simulate_market_sell(order["price"], order["quantity"])
        return order


paper_engine = PaperTradingEngine()
