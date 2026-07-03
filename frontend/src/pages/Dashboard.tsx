import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { dashboardApi, dealsApi } from '@/services/api'
import { formatCurrency, formatPercent, formatDate, isPnlPositive } from '@/utils/formatters'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import {
  TrendingUp, TrendingDown, Bot, Activity, DollarSign, Target,
  ArrowUpRight, Plus, Wallet, Grid3X3,
} from 'lucide-react'
import { cn } from '@/utils/cn'

const num = (v: any) => parseFloat(v) || 0

function StatCard({ label, value, icon: Icon, trend, accent }: {
  label: string; value: string; icon: any; trend?: string; accent?: boolean
}) {
  const isPositive = trend ? parseFloat(trend) >= 0 : null
  return (
    <div className={cn(
      'rounded-2xl border p-5 relative overflow-hidden',
      accent ? 'bg-gradient-to-br from-primary/15 to-card border-primary/30' : 'bg-card border-border'
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', accent ? 'bg-primary/20' : 'bg-primary/10')}>
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {trend !== undefined && (
        <div className={cn('text-xs mt-1 flex items-center gap-1', isPositive ? 'text-profit' : 'text-loss')}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {formatPercent(trend)}
        </div>
      )}
    </div>
  )
}

function DealCard({ deal }: { deal: any }) {
  const cur = num(deal.current_price)
  const avg = num(deal.average_price)
  const tp = num(deal.take_profit_price)
  const pnlPct = num(deal.unrealized_pnl_pct)
  // Girişten TP hedefine ilerleme (0-100)
  const progress = avg && tp && tp !== avg
    ? Math.min(100, Math.max(0, ((cur - avg) / (tp - avg)) * 100))
    : 0
  const isGrid = !!deal.grid_state

  return (
    <Link
      to={`/bots/${deal.bot_id}`}
      className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold">
            {deal.pair.slice(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">{deal.pair}</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                isGrid ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-primary/10 text-primary border-primary/20'
              )}>
                {isGrid ? 'GRID' : 'DCA'}
              </span>
              {deal.is_paper && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">P</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {deal.opened_at ? formatDate(deal.opened_at) : ''}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className={cn('font-bold tabular-nums', isPnlPositive(pnlPct) ? 'text-profit' : 'text-loss')}>
            {formatPercent(pnlPct)}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">{formatCurrency(num(deal.total_quote_spent))}</div>
        </div>
      </div>

      {!isGrid && tp > 0 && (
        <>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>Giriş {formatCurrency(avg, 2)}</span>
            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> TP {formatCurrency(tp, 2)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', progress >= 100 ? 'bg-profit' : pnlPct >= 0 ? 'bg-primary' : 'bg-loss')}
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>
        </>
      )}
      {isGrid && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Grid3X3 className="w-3.5 h-3.5" />
          Gerçekleşen kâr:
          <span className={cn('font-semibold tabular-nums', num(deal.realized_pnl) >= 0 ? 'text-profit' : 'text-loss')}>
            {num(deal.realized_pnl) >= 0 ? '+' : ''}{formatCurrency(num(deal.realized_pnl))}
          </span>
        </div>
      )}
    </Link>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.summary(),
    refetchInterval: 30000,
  })

  const { data: activeDealsData } = useQuery({
    queryKey: ['deals', 'active-dash'],
    queryFn: () => dealsApi.list({ status: 'active', page_size: 12 }),
    refetchInterval: 10000,
  })

  const { data: recentTrades, isLoading: tradesLoading } = useQuery({
    queryKey: ['recent-trades'],
    queryFn: () => dashboardApi.recentTrades(10),
    refetchInterval: 30000,
  })

  const { data: performance } = useQuery({
    queryKey: ['bot-performance'],
    queryFn: () => dashboardApi.performance(),
    refetchInterval: 60000,
  })

  const s = summary?.data?.data
  const activeDeals = activeDealsData?.data?.data || []
  const trades = recentTrades?.data?.data || []
  const bots = performance?.data?.data || []

  if (summaryLoading) return <LoadingSpinner size="lg" className="mx-auto mt-20" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <Link
          to="/bots/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> Yeni Bot
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label={t('dashboard.totalProfit')}
          value={formatCurrency(s?.total_profit || 0)}
          icon={Wallet}
          trend={String(s?.total_profit || 0)}
          accent
        />
        <StatCard
          label={t('dashboard.dailyPnl')}
          value={formatCurrency(s?.daily_pnl || 0)}
          icon={DollarSign}
          trend={String(s?.daily_pnl_pct || 0)}
        />
        <StatCard
          label={t('dashboard.winRate')}
          value={s?.win_rate_pct ? `%${num(s.win_rate_pct).toFixed(1)}` : '—'}
          icon={Target}
        />
        <StatCard
          label={t('dashboard.activeBots')}
          value={String(s?.active_bots || 0)}
          icon={Bot}
        />
        <StatCard
          label={t('dashboard.activeDeals')}
          value={String(s?.active_deals || 0)}
          icon={Activity}
        />
      </div>

      {/* Active deals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Açık İşlemler
          </h2>
          <Link to="/deals" className="text-xs text-primary flex items-center gap-1 hover:gap-1.5 transition-all">
            Tümü <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {activeDeals.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Açık işlem yok — bot başlattığınızda işlemler burada görünür.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeDeals.map((deal: any) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Trades + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-4">{t('dashboard.recentTrades')}</h3>
          {tradesLoading ? (
            <LoadingSpinner size="sm" />
          ) : trades.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz kapanan işlem yok</p>
          ) : (
            <div className="space-y-1">
              {trades.slice(0, 6).map((trade: any) => (
                <div key={trade.id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                  <div>
                    <span className="font-medium text-sm">{trade.pair}</span>
                    <span className="text-muted-foreground text-xs ml-2">{formatDate(trade.closed_at)}</span>
                  </div>
                  <div className={cn(
                    'text-sm font-semibold tabular-nums',
                    isPnlPositive(trade.realized_pnl_pct) ? 'text-profit' : 'text-loss'
                  )}>
                    {formatPercent(trade.realized_pnl_pct)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold mb-4">{t('dashboard.performance')}</h3>
          {bots.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bot performans verisi yok</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border text-xs uppercase tracking-wide">
                    <th className="text-left pb-2 font-medium">Bot</th>
                    <th className="text-left pb-2 font-medium">Parite</th>
                    <th className="text-left pb-2 font-medium">Durum</th>
                    <th className="text-right pb-2 font-medium">İşlem</th>
                    <th className="text-right pb-2 font-medium">Kazanma</th>
                    <th className="text-right pb-2 font-medium">Toplam K/Z</th>
                  </tr>
                </thead>
                <tbody>
                  {bots.map((bot: any) => (
                    <tr key={bot.bot_id} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-2.5 font-medium">
                        <Link to={`/bots/${bot.bot_id}`} className="hover:text-primary">{bot.bot_name}</Link>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{bot.pair}</td>
                      <td className="py-2.5">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          bot.status === 'active' ? 'bg-profit/10 text-profit' :
                          bot.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {bot.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{bot.total_deals}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {bot.win_rate_pct ? `%${num(bot.win_rate_pct).toFixed(1)}` : '—'}
                      </td>
                      <td className={cn(
                        'py-2.5 text-right tabular-nums font-semibold',
                        isPnlPositive(bot.total_profit) ? 'text-profit' : 'text-loss'
                      )}>
                        {formatCurrency(bot.total_profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
