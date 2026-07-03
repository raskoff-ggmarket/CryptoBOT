from decimal import Decimal

from app.services.grid_engine import grid_engine


def test_compute_lines_even_spacing():
    lines = grid_engine.compute_lines(Decimal("100"), Decimal("200"), 11)
    assert len(lines) == 11
    assert lines[0] == Decimal("100")
    assert lines[-1] == Decimal("200")
    assert lines[1] == Decimal("110")


def test_compute_lines_invalid_range():
    assert grid_engine.compute_lines(Decimal("200"), Decimal("100"), 10) == []
    assert grid_engine.compute_lines(Decimal("100"), Decimal("200"), 1) == []


def test_buy_on_downward_cross():
    lines = grid_engine.compute_lines(Decimal("100"), Decimal("200"), 11)
    actions = grid_engine.decide_actions(lines, {}, Decimal("155"), Decimal("128"), Decimal("50"))
    assert [b.level for b in actions.buys] == [3, 4, 5]
    assert not actions.sells


def test_sell_on_next_line_up():
    lines = grid_engine.compute_lines(Decimal("100"), Decimal("200"), 11)
    held = {3: {"qty": "0.38", "cost": "50"}}
    actions = grid_engine.decide_actions(lines, held, Decimal("128"), Decimal("141"), Decimal("50"))
    assert len(actions.sells) == 1
    assert actions.sells[0].level == 3
    assert not actions.buys


def test_no_buy_on_first_tick():
    lines = grid_engine.compute_lines(Decimal("100"), Decimal("200"), 11)
    actions = grid_engine.decide_actions(lines, {}, None, Decimal("120"), Decimal("50"))
    assert not actions.buys and not actions.sells


def test_top_line_never_bought():
    lines = grid_engine.compute_lines(Decimal("100"), Decimal("200"), 11)
    actions = grid_engine.decide_actions(lines, {}, Decimal("205"), Decimal("99"), Decimal("50"))
    assert all(b.level < len(lines) - 1 for b in actions.buys)


def test_held_level_not_rebought():
    lines = grid_engine.compute_lines(Decimal("100"), Decimal("200"), 11)
    held = {3: {"qty": "0.38", "cost": "50"}}
    actions = grid_engine.decide_actions(lines, held, Decimal("135"), Decimal("129"), Decimal("50"))
    assert all(b.level != 3 for b in actions.buys)


def test_sell_pnl_includes_commission():
    pnl, commission = grid_engine.compute_sell_pnl(Decimal("141"), Decimal("0.38"), Decimal("50"))
    gross = Decimal("141") * Decimal("0.38")
    assert commission == grid_engine._round8(gross * grid_engine.COMMISSION_RATE)
    assert Decimal("3.4") < pnl < Decimal("3.6")


def test_buy_fill_deducts_commission():
    pos = grid_engine.apply_buy_fill(Decimal("130"), Decimal("50"))
    qty = Decimal(pos["qty"])
    assert qty < Decimal("50") / Decimal("130")
    assert Decimal(pos["cost"]) == Decimal("50")
