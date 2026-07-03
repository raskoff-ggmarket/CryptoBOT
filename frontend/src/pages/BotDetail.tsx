import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { botsApi, dealsApi } from '@/services/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import CandleChart, { ChartLevel } from '@/components/common/CandleChart'
import { formatCurrency, formatPercent, formatDate, isPnlPositive } from '@/utils/formatters'
import { ArrowLeft, TrendingUp, ArrowDownToLine, Target, Check, Circle, Clock } from 'lucide-react'
import { cn } from '@/utils/cn'

interface LadderRow {
  kind: 'tp' | 'base' | 'so'
  num: number
  price: number
  deviation: number      // % from entry (negative for SOs)
  volume: number         // quote size for this order
  cumVolume: number      // cumulative quote spent up to here
  avgPrice: number       // avg cost after this order fills
  status: 'filled' | 'next' | 'pending'
}

// Recompute the DCA ladder from the deal's actual entry price (same formula as backend engine)
function buildLadder(
  entry: number,
  baseSize: number,
  soSize: number,
  stepPct: number,
  volScale: number,
  stepScale: number,
  maxSO: number,
  tpPct: number,
  filledSO: number,
): LadderRow[] {
  if (!entry) return []
  const rows: LadderRow[] = []
  let cumDev = 0
  let totalQuote = baseSize
  let totalBase = baseSize / entry
  let curStep = stepPct
  let curSize = soSize

  // base order
  rows.push({
    kind: 'base', num: 0, price: entry, deviation: 0,
    volume: baseSize, cumVolume: baseSize, avgPrice: entry, status: 'filled',
  })

  for (let i = 1; i <= maxSO; i++) {
    if (i > 1) { curStep = curStep * stepScale; curSize = curSize * volScale }
    cumDev += curStep
    const price = entry * (1 - cumDev / 100)
    totalQuote += curSize
    totalBase += curSize / price
    const avg = totalQuote / totalBase
    rows.push({
      kind: 'so', num: i, price, deviation: -cumDev,
      volume: curSize, cumVolume: totalQuote, avgPrice: avg,
      status: i <= filledSO ? 'filled' : i === filledSO + 1 ? 'next' : 'pending',
    })
  }
  return rows
}

function StatusDot({ status }: { status: LadderRow['status'] }) {
  if (status === 'filled') return <Check className="w-3.5 h-3.5 text-profit" />
  if (status === 'next') return <Circle className="w-3.5 h-3.5 text-primary animate-pulse" />
  return <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
}

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>()
  const navigate = useNavigate()
  const id = Number(botId)

  const { data: botData, isLoading } = useQuery({
    queryKey: ['bot', id],
    queryFn: () => botsApi.get(id),
    refetchInterval: 5000,
  })
  const { data: statsData } = useQuery({
    queryKey: ['bot-stats', id],
    queryFn: () => botsApi.stats(id),
    refetchInterval: 10000,
  })
  const { data: dealsData } = useQuery({
    queryKey: ['deals', { bot_id: id }],
    queryFn: () => dealsApi.list({ bot_id: id, page_size: 50 }),
    refetchInterval: 5000,
  })

  const bot = botData?.data?.data
  const stats = statsData?.data?.data
  const deals = dealsData?.data?.data || []

  if (isLoading || !bot) return <LoadingSpinner size="lg" className="mx-auto mt-20" />

  const activeDeal = deals.find((d: any) => d.status === 'active')
  const historyDeals = deals.filter((d: any) => d.status !== 'active')

  const num = (v: any) => parseFloat(v) || 0
  const pair = bot.pair
  const quote = bot.quote_asset || 'USDT'
  const base = bot.base_asset || pair.replace(quote, '')

  // Build ladder from the active deal's entry, or fall back to a hypothetical entry of current price
  const entry = activeDeal ? num(activeDeal.base_order_price) : 0
  const filledSO = activeDeal ? activeDeal.safety_orders_filled : 0
  const ladder = activeDeal
    ? buildLadder(
        entry,
        num(bot.base_order_size), num(bot.safety_order_size),
        num(bot.safety_order_step_pct), num(bot.safety_order_volume_scale),
        num(bot.safety_order_step_scale), bot.max_safety_orders,
        num(bot.take_profit_pct), filledSO,
      )
    : []

  const curPrice = activeDeal ? num(activeDeal.current_price) : 0
  const avgPrice = activeDeal ? num(activeDeal.average_price) : 0
  const tpPrice = activeDeal ? num(activeDeal.take_profit_price) : 0
  const boughtVol = activeDeal ? num(activeDeal.total_quote_spent) : 0
  const boughtQty = activeDeal ? num(activeDeal.total_base_qty) : 0
  const pnlPct = activeDeal ? num(activeDeal.unrealized_pnl_pct) : 0
  const pnlAmount = activeDeal && curPrice && avgPrice ? (curPrice - avgPrice) * boughtQty : 0
  const tpDistance = curPrice && tpPrice ? ((tpPrice - curPrice) / curPrice) * 100 : 0

  // Grid bot: seviye çizgileri ve tutulan pozisyonlar
  const isGrid = bot.bot_type === 'grid'
  const gridLower = num(bot.grid_lower_price)
  const gridUpper = num(bot.grid_upper_price)
  const gridLevelCount = bot.grid_levels || 0
  const gridLines: number[] =
    isGrid && gridLevelCount >= 2 && gridUpper > gridLower
      ? Array.from({ length: gridLevelCount }, (_, i) => gridLower + ((gridUpper - gridLower) / (gridLevelCount - 1)) * i)
      : []
  let heldLevels: Record<number, { qty: number; cost: number }> = {}
  if (isGrid && activeDeal?.grid_state) {
    try {
      const gs = JSON.parse(activeDeal.grid_state)
      heldLevels = Object.fromEntries(
        Object.entries(gs.held || {}).map(([k, v]: [string, any]) => [Number(k), { qty: num(v.qty), cost: num(v.cost) }])
      )
    } catch { /* bozuk state görmezden gel */ }
  }
  const gridRealized = activeDeal ? num(activeDeal.realized_pnl) : 0

  // Grafik seviye çizgileri: DCA'da ort. maliyet + TP + SO'lar; grid'de ızgara çizgileri
  const chartLevels: ChartLevel[] = isGrid
    ? gridLines.map((p, i) => ({
        price: p,
        color: i in heldLevels ? '#22c55e' : i === 0 || i === gridLines.length - 1 ? '#3b82f6' : '#f59e0b',
        title: i in heldLevels ? '● tutuluyor' : '',
        dashed: !(i in heldLevels),
      }))
    : activeDeal
    ? [
        { price: avgPrice, color: '#3b82f6', title: 'Ort. maliyet' },
        { price: tpPrice, color: '#22c55e', title: 'TP hedefi' },
        ...ladder
          .filter((r) => r.kind === 'so' && r.status !== 'filled')
          .slice(0, 5)
          .map((r) => ({
            price: r.price,
            color: '#f59e0b',
            title: `SO ${r.num}`,
            dashed: true,
          })),
      ]
    : []

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/bots')} className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
            {base.slice(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{bot.name}</h1>
              {bot.is_paper && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">PAPER</span>}
            </div>
            <p className="text-muted-foreground text-sm">{pair}</p>
          </div>
        </div>
        <span className={cn('ml-auto px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wide',
          bot.status === 'active' ? 'bg-profit/10 text-profit border-profit/20' :
          bot.status === 'paused' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
          'bg-muted text-muted-foreground border-border'
        )}>
          {bot.status}
        </span>
      </div>

      {/* ── Candlestick chart ── */}
      <CandleChart pair={pair} levels={chartLevels} />

      {/* ── Grid panel ── */}
      {isGrid && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-border bg-gradient-to-r from-card to-accent/20">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Gerçekleşen Grid Kârı</div>
              <div className={cn('text-3xl font-bold tabular-nums', gridRealized >= 0 ? 'text-profit' : 'text-loss')}>
                {gridRealized >= 0 ? '+' : ''}{formatCurrency(gridRealized)}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {bot.deals_completed} tamamlanan grid turu
              </div>
            </div>
            <div className="text-sm text-right">
              <div className="text-muted-foreground">
                Aralık: <span className="font-mono text-foreground">{formatCurrency(gridLower, 2)} – {formatCurrency(gridUpper, 2)}</span>
              </div>
              <div className="text-muted-foreground mt-1">
                {gridLevelCount} seviye · emir {formatCurrency(num(bot.grid_order_size))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border-b border-border">
            {[
              ['Tutulan Seviye', `${Object.keys(heldLevels).length} / ${Math.max(gridLevelCount - 1, 0)}`],
              ['Pozisyon', `${boughtQty.toFixed(6)} ${base}`],
              ['Maliyet', formatCurrency(boughtVol)],
              ['Güncel Fiyat', formatCurrency(curPrice, 4)],
            ].map(([label, value], i) => (
              <div key={i} className="px-5 py-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
                <div className="font-semibold tabular-nums mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          {/* Grid seviyeleri */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left font-medium px-6 py-2.5">Seviye</th>
                  <th className="text-right font-medium px-3 py-2.5">Fiyat</th>
                  <th className="text-right font-medium px-3 py-2.5">Durum</th>
                  <th className="text-right font-medium px-3 py-2.5">Miktar</th>
                  <th className="text-right font-medium px-6 py-2.5">Satış Hedefi</th>
                </tr>
              </thead>
              <tbody>
                {[...gridLines].map((price, i) => ({ price, i })).reverse().map(({ price, i }) => {
                  const held = heldLevels[i]
                  const isTop = i === gridLines.length - 1
                  return (
                    <tr key={i} className={cn(
                      'border-b border-border/50',
                      held ? 'bg-profit/[0.05]' : curPrice && Math.abs(price - curPrice) / price < 0.005 ? 'bg-primary/[0.06]' : ''
                    )}>
                      <td className="px-6 py-2">#{i + 1}{isTop && <span className="text-xs text-muted-foreground ml-1.5">(üst)</span>}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(price, 4)}</td>
                      <td className="px-3 py-2 text-right">
                        {held ? (
                          <span className="text-xs font-medium text-profit">● Tutuluyor</span>
                        ) : isTop ? (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Bekliyor</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">
                        {held ? `${held.qty.toFixed(6)} ${base}` : '—'}
                      </td>
                      <td className="px-6 py-2 text-right font-mono tabular-nums text-xs">
                        {held && i + 1 < gridLines.length ? formatCurrency(gridLines[i + 1], 4) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Active deal panel (3commas style) ── */}
      {!isGrid && activeDeal ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* PnL banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-border bg-gradient-to-r from-card to-accent/20">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Açık İşlem K/Z</div>
              <div className={cn('text-3xl font-bold tabular-nums', isPnlPositive(pnlPct) ? 'text-profit' : 'text-loss')}>
                {formatPercent(pnlPct)}
              </div>
              <div className={cn('text-sm tabular-nums mt-0.5', isPnlPositive(pnlAmount) ? 'text-profit' : 'text-loss')}>
                {pnlAmount >= 0 ? '+' : ''}{formatCurrency(pnlAmount)}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">TP hedefi:</span>
              <span className="font-mono font-semibold">{formatCurrency(tpPrice, 4)}</span>
              <span className="text-xs text-muted-foreground">({formatPercent(tpDistance)} uzakta)</span>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border-b border-border">
            {[
              ['Alınan Hacim', `${formatCurrency(boughtVol)}`],
              ['Ort. Alım Fiyatı', formatCurrency(avgPrice, 4)],
              ['Güncel Fiyat', formatCurrency(curPrice, 4)],
              ['Kullanılan SO', `${filledSO} / ${bot.max_safety_orders}`],
            ].map(([label, value], i) => (
              <div key={i} className="px-5 py-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
                <div className="font-semibold tabular-nums mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          {/* SO progress bar */}
          <div className="px-6 py-3 border-b border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Safety Order ilerlemesi</span>
              <span>{filledSO}/{bot.max_safety_orders}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden flex gap-0.5">
              {Array.from({ length: bot.max_safety_orders }).map((_, i) => (
                <div key={i} className={cn('flex-1 rounded-full', i < filledSO ? 'bg-profit' : i === filledSO ? 'bg-primary' : 'bg-muted-foreground/15')} />
              ))}
            </div>
          </div>

          {/* ── DCA Ladder ── */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left font-medium px-6 py-2.5">Emir</th>
                  <th className="text-right font-medium px-3 py-2.5">Fiyat</th>
                  <th className="text-right font-medium px-3 py-2.5">Sapma</th>
                  <th className="text-right font-medium px-3 py-2.5">Hacim</th>
                  <th className="text-right font-medium px-3 py-2.5">Kümül. Hacim</th>
                  <th className="text-right font-medium px-6 py-2.5">Ort. Maliyet</th>
                </tr>
              </thead>
              <tbody>
                {/* Take profit target row */}
                <tr className="border-b border-border bg-profit/5">
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-profit" />
                      <span className="font-medium text-profit">Take Profit</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-profit">{formatCurrency(tpPrice, 4)}</td>
                  <td className="px-3 py-2.5 text-right text-profit">+{num(bot.take_profit_pct).toFixed(2)}%</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                  <td className="px-6 py-2.5 text-right text-muted-foreground">—</td>
                </tr>

                {/* Current price marker */}
                <tr className="border-b border-border bg-primary/5">
                  <td className="px-6 py-2 text-xs text-primary font-medium" colSpan={6}>
                    ↳ Güncel fiyat: <span className="font-mono">{formatCurrency(curPrice, 4)}</span> ({formatPercent(pnlPct)})
                  </td>
                </tr>

                {ladder.map((row) => (
                  <tr key={`${row.kind}-${row.num}`} className={cn(
                    'border-b border-border/50 transition-colors',
                    row.status === 'filled' ? 'bg-profit/[0.03]' :
                    row.status === 'next' ? 'bg-primary/[0.06]' : 'opacity-50'
                  )}>
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-2">
                        <StatusDot status={row.status} />
                        {row.kind === 'base' ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Base Order
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <ArrowDownToLine className="w-3.5 h-3.5 text-muted-foreground" /> SO {row.num}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCurrency(row.price, 4)}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', row.deviation < 0 ? 'text-loss' : 'text-muted-foreground')}>
                      {row.deviation === 0 ? '0%' : `${row.deviation.toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(row.volume)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(row.cumVolume)}</td>
                    <td className="px-6 py-2.5 text-right font-mono tabular-nums">{formatCurrency(row.avgPrice, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-3 text-xs text-muted-foreground border-t border-border">
            <span>Açılış: {formatDate(activeDeal.opened_at)}</span>
            <span>Toplam: {formatCurrency(boughtVol)} • {boughtQty.toFixed(6)} {base}</span>
          </div>
        </div>
      ) : !isGrid ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Açık işlem yok</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {bot.status === 'active' ? 'Bot sinyal bekliyor...' : 'Botu başlatın'}
          </p>
        </div>
      ) : null}

      {/* ── Stats + config row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bot stats */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-1">
          <h3 className="font-semibold mb-4 text-sm">Performans</h3>
          <div className="space-y-3">
            {[
              ['Toplam İşlem', stats?.total_deals ?? 0],
              ['Kazanma Oranı', stats?.win_rate_pct ? `${parseFloat(stats.win_rate_pct).toFixed(1)}%` : '—'],
              ['Toplam K/Z', formatCurrency(stats?.total_profit || 0)],
              ['Aktif İşlem', bot.active_deals_count || 0],
            ].map(([k, v], i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bot config */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4 text-sm">Bot Konfigürasyonu</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {[
              ['Base Order', formatCurrency(bot.base_order_size)],
              ['Safety Order', formatCurrency(bot.safety_order_size)],
              ['Max SO', String(bot.max_safety_orders)],
              ['SO Adımı', `${bot.safety_order_step_pct}%`],
              ['Volume Scale', `${bot.safety_order_volume_scale}×`],
              ['Step Scale', `${bot.safety_order_step_scale}×`],
              ['Take Profit', `${bot.take_profit_pct}%`],
              ['TP Tipi', bot.take_profit_type],
              ['Stop Loss', bot.stop_loss_enabled ? `${bot.stop_loss_pct}%` : 'Kapalı'],
              ['Reinvest', `${bot.reinvest_pct}%`],
              ['Sinyal', bot.start_condition],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Deal history ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold mb-4 text-sm">İşlem Geçmişi</h3>
        {historyDeals.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tamamlanmış işlem yok</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left pb-2 font-medium">Durum</th>
                  <th className="text-right pb-2 font-medium">Ort. Maliyet</th>
                  <th className="text-right pb-2 font-medium">Kapanış</th>
                  <th className="text-right pb-2 font-medium">SO</th>
                  <th className="text-right pb-2 font-medium">K/Z</th>
                  <th className="text-right pb-2 font-medium">Açılış</th>
                </tr>
              </thead>
              <tbody>
                {historyDeals.map((deal: any) => (
                  <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs',
                        deal.status === 'completed' ? 'bg-profit/10 text-profit' : 'bg-destructive/10 text-destructive'
                      )}>
                        {deal.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{deal.average_price ? formatCurrency(deal.average_price, 4) : '-'}</td>
                    <td className="py-2.5 text-right tabular-nums">{deal.current_price ? formatCurrency(deal.current_price, 4) : '-'}</td>
                    <td className="py-2.5 text-right">{deal.safety_orders_filled}</td>
                    <td className={cn('py-2.5 text-right tabular-nums font-medium',
                      isPnlPositive(deal.realized_pnl_pct) ? 'text-profit' : 'text-loss'
                    )}>
                      {formatPercent(deal.realized_pnl_pct || 0)}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground text-xs">{formatDate(deal.opened_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
