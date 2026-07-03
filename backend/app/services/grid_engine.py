"""
Grid trading engine.

Klasik spot grid mantığı: [alt, üst] aralığı eşit aralıklı çizgilere bölünür.
Fiyat bir çizgiye düştüğünde o seviyeden alım yapılır; tutulan seviye için
fiyat bir üst çizgiye çıktığında satılır. Her al-sat turu bir grid adımı
kadar kâr üretir. Saf hesaplama — DB/ağ çağrısı yok.
"""
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_DOWN
from typing import Optional


@dataclass
class GridBuy:
    level: int
    line_price: Decimal
    size_quote: Decimal


@dataclass
class GridSell:
    level: int
    line_price: Decimal      # satış hedefi (bir üst çizgi)
    qty_base: Decimal
    cost_quote: Decimal


@dataclass
class GridActions:
    buys: list[GridBuy] = field(default_factory=list)
    sells: list[GridSell] = field(default_factory=list)


class GridEngine:
    COMMISSION_RATE = Decimal("0.001")

    def compute_lines(self, lower: Decimal, upper: Decimal, levels: int) -> list[Decimal]:
        """levels adet eşit aralıklı fiyat çizgisi (alt ve üst dahil)."""
        if levels < 2 or upper <= lower:
            return []
        step = (upper - lower) / (levels - 1)
        return [self._round8(lower + step * i) for i in range(levels)]

    def decide_actions(
        self,
        lines: list[Decimal],
        held: dict[int, dict],
        prev_price: Optional[Decimal],
        current_price: Decimal,
        order_size: Decimal,
    ) -> GridActions:
        """
        held: {level_index: {"qty": Decimal, "cost": Decimal}}
        En üst çizgi alınmaz (üzerinde satış hedefi yok).
        """
        actions = GridActions()
        if not lines:
            return actions

        # Satışlar: tutulan seviye için fiyat bir üst çizgiye ulaştıysa
        for level, pos in sorted(held.items()):
            if level + 1 < len(lines) and current_price >= lines[level + 1]:
                actions.sells.append(GridSell(
                    level=level,
                    line_price=lines[level + 1],
                    qty_base=Decimal(str(pos["qty"])),
                    cost_quote=Decimal(str(pos["cost"])),
                ))

        # Alımlar: fiyat bir çizginin üzerinden altına indiyse ve seviye boşsa
        if prev_price is not None:
            for i in range(len(lines) - 1):  # en üst çizgi hariç
                if i in held:
                    continue
                if prev_price > lines[i] >= current_price:
                    actions.buys.append(GridBuy(
                        level=i, line_price=lines[i], size_quote=order_size,
                    ))

        return actions

    def apply_buy_fill(self, fill_price: Decimal, quote_size: Decimal) -> dict:
        """Alım sonrası pozisyon kaydı: komisyon düşülmüş miktar."""
        commission = quote_size * self.COMMISSION_RATE
        qty = (quote_size - commission) / fill_price
        return {"qty": str(self._round8(qty)), "cost": str(self._round8(quote_size))}

    def compute_sell_pnl(
        self, sell_price: Decimal, qty_base: Decimal, cost_quote: Decimal
    ) -> tuple[Decimal, Decimal]:
        """(net kâr, komisyon) — satış geliri - maliyet - satış komisyonu."""
        gross = sell_price * qty_base
        commission = gross * self.COMMISSION_RATE
        pnl = gross - commission - cost_quote
        return self._round8(pnl), self._round8(commission)

    @staticmethod
    def _round8(v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)


grid_engine = GridEngine()
