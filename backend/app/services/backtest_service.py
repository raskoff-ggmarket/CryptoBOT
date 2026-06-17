"""
Backtesting engine: discrete event simulation on OHLCV data.
"""
import asyncio
import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN
from typing import Optional
import pandas as pd
import numpy as np

from app.services.dca_engine import DCAEngine, DCAState
from app.services.indicator_service import klines_to_df, evaluate_conditions

COMMISSION_RATE = Decimal("0.001")
dca_engine = DCAEngine()


class BacktestSimulator:

    async def run(
        self,
        klines: list,
        config: dict,
        initial_capital: Decimal,
        progress_callback=None,
    ) -> dict:
        df = klines_to_df(klines)
        total_candles = len(df)

        capital = initial_capital
        equity_curve = []
        deals_detail = []
        current_deal: Optional[dict] = None
        state: Optional[DCAState] = None

        base_order_size = Decimal(str(config["base_order_size"]))
        safety_order_size = Decimal(str(config["safety_order_size"]))
        tp_pct = Decimal(str(config["take_profit_pct"]))
        tp_type = config.get("take_profit_type", "fixed")
        trailing_dev = Decimal(str(config.get("trailing_deviation_pct", "0.5")))
        sl_enabled = config.get("stop_loss_enabled", False)
        sl_type = config.get("stop_loss_type", "fixed")
        sl_pct = Decimal(str(config["stop_loss_pct"])) if config.get("stop_loss_pct") else None
        sl_trailing_pct = Decimal(str(config["stop_loss_trailing_pct"])) if config.get("stop_loss_trailing_pct") else None
        max_so = config.get("max_safety_orders", 5)
        so_step_pct = Decimal(str(config["safety_order_step_pct"]))
        so_vol_scale = Decimal(str(config.get("safety_order_volume_scale", "1.5")))
        so_step_scale = Decimal(str(config.get("safety_order_step_scale", "1.0")))
        reinvest_pct = Decimal(str(config.get("reinvest_pct", "0")))
        indicator_conditions = config.get("indicator_conditions", [])
        logic_op = config.get("indicator_logic", "AND")

        for i, (ts, candle) in enumerate(df.iterrows()):
            open_p = Decimal(str(candle["open"]))
            high_p = Decimal(str(candle["high"]))
            low_p = Decimal(str(candle["low"]))
            close_p = Decimal(str(candle["close"]))

            # Report progress
            if progress_callback and i % max(1, total_candles // 20) == 0:
                pct = round(i / total_candles * 100, 1)
                await progress_callback(pct, str(ts)[:10], len(deals_detail))

            # Open new deal if no active deal
            if current_deal is None:
                required = base_order_size
                if capital < required:
                    continue

                # Check indicator signal
                if indicator_conditions and i >= 50:
                    window_df = df.iloc[max(0, i - 200): i + 1]
                    if not evaluate_conditions(window_df, indicator_conditions, logic_op):
                        continue

                fill_price = open_p
                state = dca_engine.compute_initial_state(
                    base_fill_price=fill_price,
                    base_order_size=base_order_size,
                    safety_order_size=safety_order_size,
                    safety_order_step_pct=so_step_pct,
                    safety_order_volume_scale=so_vol_scale,
                    safety_order_step_scale=so_step_scale,
                    max_safety_orders=max_so,
                    take_profit_pct=tp_pct,
                    stop_loss_pct=sl_pct if sl_enabled else None,
                )
                capital -= base_order_size

                current_deal = {
                    "opened_at": str(ts),
                    "entry_price": float(fill_price),
                    "safety_orders_used": 0,
                    "close_reason": "",
                }
                continue

            # Check stop loss (low of candle)
            sl_triggered, sl_reason = dca_engine.check_stop_loss(
                state, low_p, sl_enabled, sl_type, sl_trailing_pct
            )
            if sl_triggered:
                close_price = state.stop_loss_price or low_p
                pnl, pnl_pct = dca_engine.compute_realized_pnl(
                    state.avg_price, close_price, state.total_base,
                    state.total_base * close_price * COMMISSION_RATE
                )
                capital += state.total_quote + pnl
                current_deal["closed_at"] = str(ts)
                current_deal["exit_price"] = float(close_price)
                current_deal["pnl_pct"] = float(pnl_pct)
                current_deal["pnl_amount"] = float(pnl)
                current_deal["close_reason"] = sl_reason
                current_deal["duration_hours"] = _calc_duration(current_deal["opened_at"], str(ts))
                deals_detail.append(current_deal)
                equity_curve.append({"ts": str(ts), "equity": float(capital)})

                if reinvest_pct > 0 and pnl > 0:
                    base_order_size, safety_order_size = dca_engine.compute_reinvested_sizes(
                        pnl, base_order_size, safety_order_size, reinvest_pct
                    )
                current_deal = None
                state = None
                continue

            # Check safety orders (low of candle)
            if state.next_so_index < len(state.safety_levels):
                next_so = state.safety_levels[state.next_so_index]
                if low_p <= next_so.price:
                    so_cost = next_so.size_quote
                    if capital >= so_cost:
                        capital -= so_cost
                        state = dca_engine.apply_safety_order_fill(
                            state, next_so.price, so_cost, tp_pct, sl_pct, sl_type
                        )
                        current_deal["safety_orders_used"] += 1

            # Check take profit (high of candle for fixed, close for trailing)
            tp_check_price = high_p if tp_type == "fixed" else close_p
            tp_triggered, tp_reason = dca_engine.check_take_profit(
                state, tp_check_price, tp_type, trailing_dev
            )
            if tp_triggered:
                close_price = state.take_profit_price if tp_type == "fixed" else close_p
                pnl, pnl_pct = dca_engine.compute_realized_pnl(
                    state.avg_price, close_price, state.total_base,
                    state.total_base * close_price * COMMISSION_RATE
                )
                capital += state.total_quote + pnl
                current_deal["closed_at"] = str(ts)
                current_deal["exit_price"] = float(close_price)
                current_deal["pnl_pct"] = float(pnl_pct)
                current_deal["pnl_amount"] = float(pnl)
                current_deal["close_reason"] = tp_reason
                current_deal["duration_hours"] = _calc_duration(current_deal["opened_at"], str(ts))
                deals_detail.append(current_deal)
                equity_curve.append({"ts": str(ts), "equity": float(capital)})

                if reinvest_pct > 0 and pnl > 0:
                    base_order_size, safety_order_size = dca_engine.compute_reinvested_sizes(
                        pnl, base_order_size, safety_order_size, reinvest_pct
                    )
                current_deal = None
                state = None

        if progress_callback:
            await progress_callback(100.0, str(df.index[-1])[:10], len(deals_detail))

        return _compute_metrics(deals_detail, equity_curve, float(initial_capital))


def _calc_duration(opened_at: str, closed_at: str) -> float:
    try:
        t1 = pd.Timestamp(opened_at)
        t2 = pd.Timestamp(closed_at)
        return max(0.0, (t2 - t1).total_seconds() / 3600)
    except Exception:
        return 0.0


def _compute_metrics(deals: list, equity_curve: list, initial_capital: float) -> dict:
    if not deals:
        return {
            "total_deals": 0, "winning_deals": 0, "losing_deals": 0,
            "win_rate_pct": None, "total_profit": Decimal("0"),
            "total_profit_pct": Decimal("0"), "max_drawdown_pct": None,
            "sharpe_ratio": None, "profit_factor": None,
            "avg_deal_duration_hours": None, "best_deal_pct": None,
            "worst_deal_pct": None, "total_commission": Decimal("0"),
            "equity_curve": equity_curve, "deals_detail": deals,
        }

    pnls = [d["pnl_amount"] for d in deals]
    pnl_pcts = [d["pnl_pct"] for d in deals]
    durations = [d.get("duration_hours", 0) for d in deals]

    winning = [p for p in pnls if p > 0]
    losing = [p for p in pnls if p <= 0]
    total_profit = sum(pnls)
    win_rate = len(winning) / len(deals) * 100 if deals else 0

    # Max drawdown
    equities = [initial_capital] + [e["equity"] for e in equity_curve]
    peak = equities[0]
    max_dd = 0.0
    for e in equities:
        if e > peak:
            peak = e
        dd = (peak - e) / peak * 100 if peak > 0 else 0
        if dd > max_dd:
            max_dd = dd

    # Sharpe ratio (simplified, using deal returns)
    if len(pnl_pcts) > 1:
        arr = np.array(pnl_pcts)
        sharpe = (arr.mean() / arr.std()) * math.sqrt(252) if arr.std() > 0 else 0
    else:
        sharpe = 0

    profit_factor = (
        sum(winning) / abs(sum(losing)) if losing and abs(sum(losing)) > 0 else None
    )

    return {
        "total_deals": len(deals),
        "winning_deals": len(winning),
        "losing_deals": len(losing),
        "win_rate_pct": Decimal(str(round(win_rate, 2))),
        "total_profit": Decimal(str(round(total_profit, 8))),
        "total_profit_pct": Decimal(str(round(total_profit / initial_capital * 100, 4))),
        "max_drawdown_pct": Decimal(str(round(max_dd, 4))),
        "sharpe_ratio": Decimal(str(round(sharpe, 4))),
        "profit_factor": Decimal(str(round(profit_factor, 4))) if profit_factor else None,
        "avg_deal_duration_hours": Decimal(str(round(sum(durations) / len(durations), 2))) if durations else None,
        "best_deal_pct": Decimal(str(round(max(pnl_pcts), 4))),
        "worst_deal_pct": Decimal(str(round(min(pnl_pcts), 4))),
        "total_commission": Decimal("0"),
        "equity_curve": equity_curve,
        "deals_detail": deals,
    }
