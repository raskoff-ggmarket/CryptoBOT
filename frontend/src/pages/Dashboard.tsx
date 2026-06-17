import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dashboardApi } from '@/services/api'
import { formatCurrency, formatPercent, formatDate, isPnlPositive } from '@/utils/formatters'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { TrendingUp, TrendingDown, Bot, Activity, DollarSign, Target } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { cn } from '@/utils/cn'

function StatCard({ label, value, icon: Icon, trend, color }: {
  label: string; value: string; icon: any; trend?: string; color?: string
}) {
  const isPositive = trend ? parseFloat(trend) >= 0 : null
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color || 'bg-primary/10')}>
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

export default function DashboardPage() {
  const { t } = useTranslation()

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.summary(),
    refetchInterval: 30000,
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
  const trades = recentTrades?.data?.data || []
  const bots = performance?.data?.data || []

  if (summaryLoading) return <LoadingSpinner size="lg" className="mx-auto mt-20" />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('dashboard.totalProfit')}
          value={formatCurrency(s?.total_profit || 0)}
          icon={DollarSign}
          trend={String(s?.total_profit || 0)}
        />
        <StatCard
          label={t('dashboard.dailyPnl')}
          value={formatCurrency(s?.daily_pnl || 0)}
          icon={TrendingUp}
          trend={String(s?.daily_pnl_pct || 0)}
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

      {/* Win Rate + Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Win Rate Card */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            {t('dashboard.winRate')}
          </h3>
          <div className="text-4xl font-bold text-primary tabular-nums">
            {s?.win_rate_pct ? `${parseFloat(s.win_rate_pct).toFixed(1)}%` : '-'}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {s?.completed_deals_today || 0} deals today
          </div>
        </div>

        {/* Recent Trades */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">{t('dashboard.recentTrades')}</h3>
          {tradesLoading ? (
            <LoadingSpinner size="sm" />
          ) : trades.length === 0 ? (
            <p className="text-muted-foreground text-sm">İşlem bulunamadı</p>
          ) : (
            <div className="space-y-2">
              {trades.slice(0, 5).map((trade: any) => (
                <div key={trade.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
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
      </div>

      {/* Bot Performance Table */}
      {bots.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">{t('dashboard.performance')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 font-medium">Bot</th>
                  <th className="text-left pb-2 font-medium">Parite</th>
                  <th className="text-left pb-2 font-medium">Durum</th>
                  <th className="text-right pb-2 font-medium">İşlemler</th>
                  <th className="text-right pb-2 font-medium">Kazanma %</th>
                  <th className="text-right pb-2 font-medium">Toplam K/Z</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot: any) => (
                  <tr key={bot.bot_id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2.5 font-medium">{bot.bot_name}</td>
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
                      {bot.win_rate_pct ? `${parseFloat(bot.win_rate_pct).toFixed(1)}%` : '-'}
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
        </div>
      )}
    </div>
  )
}
