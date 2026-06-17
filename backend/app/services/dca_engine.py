from decimal import Decimal, ROUND_DOWN
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class SafetyOrderLevel:
    num: int
    price: Decimal
    size_quote: Decimal
    deviation_pct: Decimal
    cumulative_deviation_pct: Decimal
    total_quote: Decimal
    total_base: Decimal
    avg_price: Decimal
    required_change_pct: Decimal


@dataclass
class TakeProfit:
    price: Decimal
    is_trailing: bool
    trailing_high: Optional[Decimal] = None
    trailing_active: bool = False


@dataclass
class DCAState:
    base_price: Decimal
    total_base: Decimal
    total_quote: Decimal
    avg_price: Decimal
    take_profit_price: Decimal
    stop_loss_price: Optional[Decimal]
    safety_levels: List[SafetyOrderLevel]
    next_so_index: int = 0
    trailing_tp_high: Optional[Decimal] = None
    trailing_tp_active: bool = False
    trailing_sl_high: Optional[Decimal] = None


class DCAEngine:
    """
    Core DCA calculation engine.
    Computes safety order levels, average prices, TP/SL levels.
    Pure functions — no DB or network calls.
    """

    COMMISSION_RATE = Decimal("0.001")  # 0.1% Binance default

    def compute_safety_levels(
        self,
        base_price: Decimal,
        base_order_size: Decimal,
        safety_order_size: Decimal,
        safety_order_step_pct: Decimal,
        safety_order_volume_scale: Decimal,
        safety_order_step_scale: Decimal,
        max_safety_orders: int,
        take_profit_pct: Decimal,
    ) -> List[SafetyOrderLevel]:
        levels = []
        cumulative_deviation = Decimal("0")
        total_quote = base_order_size
        total_base = base_order_size / base_price
        current_so_size = safety_order_size
        current_step = safety_order_step_pct

        for i in range(1, max_safety_orders + 1):
            if i > 1:
                current_step = current_step * safety_order_step_scale
                current_so_size = current_so_size * safety_order_volume_scale

            cumulative_deviation += current_step
            so_price = base_price * (1 - cumulative_deviation / 100)
            so_base = current_so_size / so_price

            total_quote += current_so_size
            total_base += so_base
            avg_price = total_quote / total_base
            tp_price = avg_price * (1 + take_profit_pct / 100)
            required_change = (tp_price - so_price) / so_price * 100

            levels.append(SafetyOrderLevel(
                num=i,
                price=self._round8(so_price),
                size_quote=self._round8(current_so_size),
                deviation_pct=self._round4(current_step),
                cumulative_deviation_pct=self._round4(cumulative_deviation),
                total_quote=self._round8(total_quote),
                total_base=self._round8(total_base),
                avg_price=self._round8(avg_price),
                required_change_pct=self._round4(required_change),
            ))

        return levels

    def compute_initial_state(
        self,
        base_fill_price: Decimal,
        base_order_size: Decimal,
        safety_order_size: Decimal,
        safety_order_step_pct: Decimal,
        safety_order_volume_scale: Decimal,
        safety_order_step_scale: Decimal,
        max_safety_orders: int,
        take_profit_pct: Decimal,
        stop_loss_pct: Optional[Decimal],
    ) -> DCAState:
        commission = base_order_size * self.COMMISSION_RATE
        effective_quote = base_order_size - commission
        base_qty = effective_quote / base_fill_price

        safety_levels = self.compute_safety_levels(
            base_price=base_fill_price,
            base_order_size=base_order_size,
            safety_order_size=safety_order_size,
            safety_order_step_pct=safety_order_step_pct,
            safety_order_volume_scale=safety_order_volume_scale,
            safety_order_step_scale=safety_order_step_scale,
            max_safety_orders=max_safety_orders,
            take_profit_pct=take_profit_pct,
        )

        avg_price = base_fill_price
        tp_price = self._round8(avg_price * (1 + take_profit_pct / 100))
        sl_price = None
        if stop_loss_pct:
            sl_price = self._round8(avg_price * (1 - stop_loss_pct / 100))

        return DCAState(
            base_price=base_fill_price,
            total_base=self._round8(base_qty),
            total_quote=self._round8(base_order_size),
            avg_price=self._round8(avg_price),
            take_profit_price=tp_price,
            stop_loss_price=sl_price,
            safety_levels=safety_levels,
        )

    def apply_safety_order_fill(
        self,
        state: DCAState,
        so_fill_price: Decimal,
        so_quote_size: Decimal,
        take_profit_pct: Decimal,
        stop_loss_pct: Optional[Decimal],
        stop_loss_type: str = "fixed",
    ) -> DCAState:
        commission = so_quote_size * self.COMMISSION_RATE
        effective_quote = so_quote_size - commission
        so_base_qty = effective_quote / so_fill_price

        new_total_base = state.total_base + so_base_qty
        new_total_quote = state.total_quote + so_quote_size
        new_avg_price = new_total_quote / new_total_base

        new_tp_price = self._round8(new_avg_price * (1 + take_profit_pct / 100))
        new_sl_price = None
        if stop_loss_pct:
            if stop_loss_type == "trailing":
                new_sl_price = state.stop_loss_price
            else:
                new_sl_price = self._round8(new_avg_price * (1 - stop_loss_pct / 100))

        return DCAState(
            base_price=state.base_price,
            total_base=self._round8(new_total_base),
            total_quote=self._round8(new_total_quote),
            avg_price=self._round8(new_avg_price),
            take_profit_price=new_tp_price,
            stop_loss_price=new_sl_price,
            safety_levels=state.safety_levels,
            next_so_index=state.next_so_index + 1,
            trailing_tp_high=state.trailing_tp_high,
            trailing_tp_active=state.trailing_tp_active,
            trailing_sl_high=state.trailing_sl_high,
        )

    def check_take_profit(
        self,
        state: DCAState,
        current_price: Decimal,
        tp_type: str,
        trailing_deviation_pct: Decimal,
    ) -> tuple[bool, str]:
        """Returns (should_close, reason)"""
        if tp_type == "fixed":
            if current_price >= state.take_profit_price:
                return True, "take_profit"
            return False, ""

        # Trailing TP
        if current_price >= state.take_profit_price:
            state.trailing_tp_active = True
            if state.trailing_tp_high is None or current_price > state.trailing_tp_high:
                state.trailing_tp_high = current_price

        if state.trailing_tp_active and state.trailing_tp_high:
            trigger = state.trailing_tp_high * (1 - trailing_deviation_pct / 100)
            if current_price <= trigger:
                return True, "take_profit_trailing"

        return False, ""

    def check_stop_loss(
        self,
        state: DCAState,
        current_price: Decimal,
        sl_enabled: bool,
        sl_type: str,
        sl_trailing_pct: Optional[Decimal],
    ) -> tuple[bool, str]:
        if not sl_enabled or not state.stop_loss_price:
            return False, ""

        if sl_type == "fixed":
            if current_price <= state.stop_loss_price:
                return True, "stop_loss"
            return False, ""

        # Trailing SL
        if state.trailing_sl_high is None or current_price > state.trailing_sl_high:
            state.trailing_sl_high = current_price

        if sl_trailing_pct and state.trailing_sl_high:
            trigger = state.trailing_sl_high * (1 - sl_trailing_pct / 100)
            if current_price <= trigger:
                return True, "stop_loss_trailing"

        return False, ""

    def compute_unrealized_pnl(
        self, avg_price: Decimal, current_price: Decimal, total_base: Decimal
    ) -> tuple[Decimal, Decimal]:
        """Returns (pnl_amount, pnl_pct)"""
        pnl_pct = (current_price - avg_price) / avg_price * 100
        pnl_amount = (current_price - avg_price) * total_base
        return self._round8(pnl_amount), self._round4(pnl_pct)

    def compute_realized_pnl(
        self, avg_price: Decimal, sell_price: Decimal, total_base: Decimal, commission: Decimal
    ) -> tuple[Decimal, Decimal]:
        gross = (sell_price - avg_price) * total_base
        net = gross - commission
        pnl_pct = (sell_price - avg_price) / avg_price * 100
        return self._round8(net), self._round4(pnl_pct)

    def compute_reinvested_sizes(
        self,
        profit: Decimal,
        base_order_size: Decimal,
        safety_order_size: Decimal,
        reinvest_pct: Decimal,
    ) -> tuple[Decimal, Decimal]:
        if reinvest_pct <= 0:
            return base_order_size, safety_order_size

        reinvested = profit * reinvest_pct / 100
        ratio = safety_order_size / base_order_size
        new_base = base_order_size + reinvested
        new_so = new_base * ratio
        return self._round8(new_base), self._round8(new_so)

    @staticmethod
    def _round8(v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)

    @staticmethod
    def _round4(v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.0001"), rounding=ROUND_DOWN)


dca_engine = DCAEngine()
