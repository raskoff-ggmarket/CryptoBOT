import pytest
from decimal import Decimal
from app.services.dca_engine import DCAEngine, dca_engine


class TestDCAEngine:
    def test_compute_safety_levels_basic(self):
        levels = dca_engine.compute_safety_levels(
            base_price=Decimal("100"),
            base_order_size=Decimal("100"),
            safety_order_size=Decimal("50"),
            safety_order_step_pct=Decimal("2"),
            safety_order_volume_scale=Decimal("1.5"),
            safety_order_step_scale=Decimal("1.0"),
            max_safety_orders=3,
            take_profit_pct=Decimal("2"),
        )
        assert len(levels) == 3
        assert levels[0].num == 1
        assert levels[0].price == Decimal("98.0000")
        assert levels[0].deviation_pct == Decimal("2.0000")

    def test_compute_safety_levels_step_scale(self):
        levels = dca_engine.compute_safety_levels(
            base_price=Decimal("100"),
            base_order_size=Decimal("100"),
            safety_order_size=Decimal("50"),
            safety_order_step_pct=Decimal("2"),
            safety_order_volume_scale=Decimal("1.0"),
            safety_order_step_scale=Decimal("1.3"),
            max_safety_orders=3,
            take_profit_pct=Decimal("2"),
        )
        assert levels[1].deviation_pct == Decimal("2.6000")

    def test_initial_state(self):
        state = dca_engine.compute_initial_state(
            base_fill_price=Decimal("100"),
            base_order_size=Decimal("100"),
            safety_order_size=Decimal("50"),
            safety_order_step_pct=Decimal("2"),
            safety_order_volume_scale=Decimal("1.5"),
            safety_order_step_scale=Decimal("1.0"),
            max_safety_orders=3,
            take_profit_pct=Decimal("2"),
            stop_loss_pct=Decimal("5"),
        )
        assert state.avg_price == Decimal("100")
        assert state.take_profit_price == Decimal("102.0000")
        assert state.stop_loss_price == Decimal("95.0000")

    def test_apply_safety_order_updates_avg_price(self):
        state = dca_engine.compute_initial_state(
            base_fill_price=Decimal("100"),
            base_order_size=Decimal("100"),
            safety_order_size=Decimal("50"),
            safety_order_step_pct=Decimal("2"),
            safety_order_volume_scale=Decimal("1.5"),
            safety_order_step_scale=Decimal("1.0"),
            max_safety_orders=3,
            take_profit_pct=Decimal("2"),
            stop_loss_pct=None,
        )
        new_state = dca_engine.apply_safety_order_fill(
            state=state,
            so_fill_price=Decimal("98"),
            so_quote_size=Decimal("50"),
            take_profit_pct=Decimal("2"),
            stop_loss_pct=None,
        )
        # Avg price should be between 98 and 100
        assert Decimal("98") < new_state.avg_price < Decimal("100")
        assert new_state.take_profit_price > new_state.avg_price

    def test_check_take_profit_fixed(self):
        state = dca_engine.compute_initial_state(
            base_fill_price=Decimal("100"),
            base_order_size=Decimal("100"),
            safety_order_size=Decimal("50"),
            safety_order_step_pct=Decimal("2"),
            safety_order_volume_scale=Decimal("1.5"),
            safety_order_step_scale=Decimal("1.0"),
            max_safety_orders=3,
            take_profit_pct=Decimal("2"),
            stop_loss_pct=None,
        )
        # Below TP
        triggered, reason = dca_engine.check_take_profit(state, Decimal("101"), "fixed", Decimal("0.5"))
        assert not triggered

        # At TP
        triggered, reason = dca_engine.check_take_profit(state, Decimal("102"), "fixed", Decimal("0.5"))
        assert triggered
        assert reason == "take_profit"

    def test_check_stop_loss_fixed(self):
        state = dca_engine.compute_initial_state(
            base_fill_price=Decimal("100"),
            base_order_size=Decimal("100"),
            safety_order_size=Decimal("50"),
            safety_order_step_pct=Decimal("2"),
            safety_order_volume_scale=Decimal("1.5"),
            safety_order_step_scale=Decimal("1.0"),
            max_safety_orders=3,
            take_profit_pct=Decimal("2"),
            stop_loss_pct=Decimal("5"),
        )
        # Above SL
        triggered, reason = dca_engine.check_stop_loss(state, Decimal("96"), True, "fixed", None)
        assert not triggered

        # At SL
        triggered, reason = dca_engine.check_stop_loss(state, Decimal("95"), True, "fixed", None)
        assert triggered
        assert reason == "stop_loss"

    def test_reinvest_calculation(self):
        new_base, new_so = dca_engine.compute_reinvested_sizes(
            profit=Decimal("20"),
            base_order_size=Decimal("100"),
            safety_order_size=Decimal("50"),
            reinvest_pct=Decimal("100"),
        )
        assert new_base == Decimal("120")
        assert new_so == Decimal("60.00000000")

    def test_no_reinvest(self):
        new_base, new_so = dca_engine.compute_reinvested_sizes(
            profit=Decimal("20"),
            base_order_size=Decimal("100"),
            safety_order_size=Decimal("50"),
            reinvest_pct=Decimal("0"),
        )
        assert new_base == Decimal("100")
        assert new_so == Decimal("50")

    def test_unrealized_pnl(self):
        pnl_amount, pnl_pct = dca_engine.compute_unrealized_pnl(
            avg_price=Decimal("100"),
            current_price=Decimal("105"),
            total_base=Decimal("1"),
        )
        assert pnl_pct == Decimal("5.0000")
        assert pnl_amount == Decimal("5.00000000")

    def test_zero_safety_orders(self):
        levels = dca_engine.compute_safety_levels(
            base_price=Decimal("100"),
            base_order_size=Decimal("100"),
            safety_order_size=Decimal("50"),
            safety_order_step_pct=Decimal("2"),
            safety_order_volume_scale=Decimal("1.5"),
            safety_order_step_scale=Decimal("1.0"),
            max_safety_orders=0,
            take_profit_pct=Decimal("2"),
        )
        assert len(levels) == 0
