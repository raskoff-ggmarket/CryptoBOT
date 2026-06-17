import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { botsApi, dealsApi } from '@/services/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { formatCurrency, formatPercent, formatDate, isPnlPositive } from '@/utils/formatters'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/utils/cn'

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const id = Number(botId)

  const { data: botData, isLoading } = useQuery({
    queryKey: ['bot', id],
    queryFn: () => botsApi.get(id),
    refetchInterval: 5000,
  })

  const { data: statsData } = useQuery({
    queryKey: ['bot-stats', id],
    queryFn: () => botsApi.stats(id),
  })

  const { data: dealsData } = useQuery({
    queryKey: ['deals', { bot_id: id }],
    queryFn: () => dealsApi.list({ bot_id: id, page_size: 20 }),
    refetchInterval: 10000,
  })

  const { data: previewData } = useQuery({
    queryKey: ['safety-preview', id],
    queryFn: () => botsApi.safetyPreview(id),
  })

  const bot = botData?.data?.data
  const stats = statsData?.data?.data
  const deals = dealsData?.data?.data || []
  const preview = previewData?.data?.data

  if (isLoading || !bot) return <LoadingSpinner size="lg" className="mx-auto mt-20" />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/bots')} className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{bot.name}</h1>
          <p className="text-muted-foreground text-sm">{bot.pair}</p>
        </div>
        <span className={cn('ml-auto px-3 py-1 rounded-full text-sm font-medium border',
          bot.status === 'active' ? 'bg-profit/10 text-profit border-profit/20' :
          'bg-muted text-muted-foreground border-border'
        )}>
          {bot.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Toplam İşlem', value: stats?.total_deals || 0 },
          { label: 'Kazanma Oranı', value: stats?.win_rate_pct ? `${parseFloat(stats.win_rate_pct).toFixed(1)}%` : '-' },
          { label: 'Toplam K/Z', value: formatCurrency(stats?.total_profit || 0) },
          { label: 'Aktif İşlem', value: bot.active_deals_count || 0 },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-xl font-bold tabular-nums mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Safety Order Preview */}
        {preview?.levels && (
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Safety Order Seviyeleri</h3>
            <div className="text-xs text-muted-foreground mb-2">
              Base Fiyat: <span className="font-mono text-foreground">{formatCurrency(preview.base_price, 4)}</span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {preview.levels.map((l: any) => (
                <div key={l.num} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">SO#{l.num}</span>
                  <span className="font-mono">{formatCurrency(l.price, 2)}</span>
                  <span className="text-loss">-{parseFloat(l.cumulative_deviation_pct || l.deviation_pct).toFixed(2)}%</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(l.size_quote)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bot Config Summary */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Bot Konfigürasyonu</h3>
          <div className="space-y-2 text-sm">
            {[
              ['Base Order', formatCurrency(bot.base_order_size)],
              ['Safety Order', formatCurrency(bot.safety_order_size)],
              ['Max SO', String(bot.max_safety_orders)],
              ['SO Step', `${bot.safety_order_step_pct}%`],
              ['Volume Scale', String(bot.safety_order_volume_scale)],
              ['Take Profit', `${bot.take_profit_pct}% (${bot.take_profit_type})`],
              ['Stop Loss', bot.stop_loss_enabled ? `${bot.stop_loss_pct}%` : 'Kapalı'],
              ['Reinvest', `${bot.reinvest_pct}%`],
              ['Sinyal', bot.start_condition],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deals */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-4">İşlemler</h3>
        {deals.length === 0 ? (
          <p className="text-muted-foreground text-sm">İşlem bulunamadı</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 font-medium">Durum</th>
                  <th className="text-right pb-2 font-medium">Ort. Maliyet</th>
                  <th className="text-right pb-2 font-medium">Güncel Fiyat</th>
                  <th className="text-right pb-2 font-medium">SO</th>
                  <th className="text-right pb-2 font-medium">K/Z</th>
                  <th className="text-right pb-2 font-medium">Açılış</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal: any) => (
                  <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs',
                        deal.status === 'active' ? 'bg-profit/10 text-profit' :
                        deal.status === 'completed' ? 'bg-muted text-muted-foreground' :
                        'bg-destructive/10 text-destructive'
                      )}>
                        {deal.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {deal.average_price ? formatCurrency(deal.average_price, 4) : '-'}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {deal.current_price ? formatCurrency(deal.current_price, 4) : '-'}
                    </td>
                    <td className="py-2.5 text-right">{deal.safety_orders_filled}/{deal.safety_orders_placed}</td>
                    <td className={cn('py-2.5 text-right tabular-nums font-medium',
                      deal.status === 'active'
                        ? isPnlPositive(deal.unrealized_pnl_pct) ? 'text-profit' : 'text-loss'
                        : isPnlPositive(deal.realized_pnl_pct) ? 'text-profit' : 'text-loss'
                    )}>
                      {deal.status === 'active'
                        ? formatPercent(deal.unrealized_pnl_pct || 0)
                        : formatPercent(deal.realized_pnl_pct || 0)
                      }
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground text-xs">
                      {formatDate(deal.opened_at)}
                    </td>
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
