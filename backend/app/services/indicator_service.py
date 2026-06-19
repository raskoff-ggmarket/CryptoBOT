import pandas as pd
import ta
from typing import Optional
import logging

logger = logging.getLogger(__name__)


AVAILABLE_INDICATORS = {
    "RSI": {
        "name": "RSI",
        "description": "Relative Strength Index",
        "params": {"period": {"type": "int", "default": 14, "min": 2, "max": 100}},
        "operators": ["<", ">", "<=", ">="],
        "output": "single",
    },
    "MACD": {
        "name": "MACD",
        "description": "Moving Average Convergence Divergence",
        "params": {
            "fast": {"type": "int", "default": 12},
            "slow": {"type": "int", "default": 26},
            "signal": {"type": "int", "default": 9},
        },
        "operators": ["cross_above", "cross_below", ">", "<"],
        "output": "histogram",
    },
    "EMA": {
        "name": "EMA",
        "description": "Exponential Moving Average",
        "params": {"period": {"type": "int", "default": 20}},
        "operators": ["price_above", "price_below", "cross_above", "cross_below"],
        "output": "single",
    },
    "SMA": {
        "name": "SMA",
        "description": "Simple Moving Average",
        "params": {"period": {"type": "int", "default": 50}},
        "operators": ["price_above", "price_below"],
        "output": "single",
    },
    "BB": {
        "name": "BB",
        "description": "Bollinger Bands",
        "params": {
            "period": {"type": "int", "default": 20},
            "std": {"type": "float", "default": 2.0},
        },
        "operators": ["price_above_upper", "price_below_lower", "price_inside"],
        "output": "bands",
    },
    "STOCH": {
        "name": "STOCH",
        "description": "Stochastic Oscillator",
        "params": {"k": {"type": "int", "default": 14}, "d": {"type": "int", "default": 3}},
        "operators": ["<", ">", "cross_above", "cross_below"],
        "output": "single",
    },
}


def klines_to_df(klines: list) -> pd.DataFrame:
    df = pd.DataFrame(klines, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_volume", "trades", "taker_buy_base",
        "taker_buy_quote", "ignore"
    ])
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col])
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
    return df.set_index("open_time")


def evaluate_condition(df: pd.DataFrame, condition: dict) -> bool:
    indicator = condition.get("indicator")
    params = condition.get("params", {})
    operator = condition.get("operator")
    value = condition.get("value")

    close = df["close"]
    high = df["high"]
    low = df["low"]

    if indicator == "RSI":
        period = params.get("period", 14)
        rsi = ta.momentum.RSIIndicator(close=close, window=period).rsi()
        if rsi is None or rsi.empty:
            return False
        latest = float(rsi.iloc[-1])
        return _compare(latest, operator, value)

    elif indicator == "MACD":
        fast = params.get("fast", 12)
        slow = params.get("slow", 26)
        signal_period = params.get("signal", 9)
        macd_obj = ta.trend.MACD(close=close, window_slow=slow, window_fast=fast, window_sign=signal_period)
        macd_line = macd_obj.macd()
        sig_line = macd_obj.macd_signal()
        hist = macd_obj.macd_diff()

        if operator in ("cross_above", "cross_below"):
            if len(macd_line) < 2:
                return False
            if operator == "cross_above":
                return (macd_line.iloc[-2] < sig_line.iloc[-2]) and (macd_line.iloc[-1] > sig_line.iloc[-1])
            else:
                return (macd_line.iloc[-2] > sig_line.iloc[-2]) and (macd_line.iloc[-1] < sig_line.iloc[-1])

        latest_hist = float(hist.iloc[-1])
        return _compare(latest_hist, operator, value)

    elif indicator == "EMA":
        period = params.get("period", 20)
        ema = ta.trend.EMAIndicator(close=close, window=period).ema_indicator()
        if ema is None or ema.empty:
            return False
        latest_ema = float(ema.iloc[-1])
        latest_price = float(close.iloc[-1])
        if operator == "price_above":
            return latest_price > latest_ema
        elif operator == "price_below":
            return latest_price < latest_ema
        return _compare(latest_price, operator, latest_ema)

    elif indicator == "SMA":
        period = params.get("period", 50)
        sma = ta.trend.SMAIndicator(close=close, window=period).sma_indicator()
        if sma is None or sma.empty:
            return False
        latest_sma = float(sma.iloc[-1])
        latest_price = float(close.iloc[-1])
        if operator == "price_above":
            return latest_price > latest_sma
        elif operator == "price_below":
            return latest_price < latest_sma
        return False

    elif indicator == "BB":
        period = params.get("period", 20)
        std = params.get("std", 2.0)
        bb = ta.volatility.BollingerBands(close=close, window=period, window_dev=std)
        upper = float(bb.bollinger_hband().iloc[-1])
        lower = float(bb.bollinger_lband().iloc[-1])
        latest_price = float(close.iloc[-1])
        if operator == "price_above_upper":
            return latest_price > upper
        elif operator == "price_below_lower":
            return latest_price < lower
        elif operator == "price_inside":
            return lower <= latest_price <= upper
        return False

    elif indicator == "STOCH":
        k_period = params.get("k", 14)
        d_period = params.get("d", 3)
        stoch = ta.momentum.StochasticOscillator(high=high, low=low, close=close, window=k_period, smooth_window=d_period)
        k_line = stoch.stoch()
        if k_line is None or k_line.empty:
            return False
        latest_k = float(k_line.iloc[-1])
        return _compare(latest_k, operator, value)

    logger.warning(f"Unknown indicator: {indicator}")
    return False


def evaluate_conditions(df: pd.DataFrame, conditions: list, logic_operator: str = "AND") -> bool:
    if not conditions:
        return True

    results = []
    for cond in conditions:
        try:
            result = evaluate_condition(df, cond)
            results.append(result)
        except Exception as e:
            logger.error(f"Error evaluating condition {cond}: {e}")
            results.append(False)

    if logic_operator == "AND":
        return all(results)
    else:
        return any(results)


def _compare(value: float, operator: str, threshold: float) -> bool:
    ops = {
        "<": value < threshold,
        ">": value > threshold,
        "<=": value <= threshold,
        ">=": value >= threshold,
        "==": abs(value - threshold) < 1e-9,
    }
    return ops.get(operator, False)
