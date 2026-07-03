import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { botsApi } from '@/services/api'
import { toast } from 'sonner'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { Plus, Play, Pause, Square, Copy, Trash2, TrendingUp, Bot, Grid3X3 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatCurrency } from '@/utils/formatters'

function StatusBadge({ status }: { status: string }) {
  const colors = {
    active: 'bg-profit/10 text-profit border-profit/20',
    inactive: 'bg-muted text-muted-foreground border-border',
    paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', colors[status as keyof typeof colors] || colors.inactive)}>
      {status}
    </span>
  )
}

export default function BotsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: () => botsApi.list(),
    refetchInterval: 10000,
  })

  const startMut = useMutation({
    mutationFn: (id: number) => botsApi.start(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bots'] }); toast.success('Bot başlatıldı') },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const stopMut = useMutation({
    mutationFn: (id: number) => botsApi.stop(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bots'] }); toast.success('Bot durduruldu') },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const pauseMut = useMutation({
    mutationFn: (id: number) => botsApi.pause(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bots'] }); toast.success('Bot duraklatıldı') },
  })

  const dupMut = useMutation({
    mutationFn: (id: number) => botsApi.duplicate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bots'] }); toast.success('Bot kopyalandı') },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => botsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bots'] }); toast.success('Bot silindi') },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const bots = data?.data?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('bots.title')}</h1>
        <div className="flex items-center gap-2">
          <Link to="/bots/new-grid"
            className="flex items-center gap-2 px-4 py-2 border border-border bg-card rounded-lg hover:bg-accent transition-colors font-medium text-sm"
          >
            <Grid3X3 className="w-4 h-4" />
            Grid Bot
          </Link>
          <Link to="/bots/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('bots.create')}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="mx-auto mt-20" />
      ) : bots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bot className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Henüz bot yok</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">İlk botunuzu oluşturun</p>
          <Link to="/bots/new"
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            {t('bots.create')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {bots.map((bot: any) => (
            <div key={bot.id} className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/bots/${bot.id}`} className="font-semibold text-foreground hover:text-primary">
                      {bot.name}
                    </Link>
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded border font-medium',
                      bot.bot_type === 'grid'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : 'bg-primary/10 text-primary border-primary/20'
                    )}>
                      {bot.bot_type === 'grid' ? 'GRID' : 'DCA'}
                    </span>
                    {bot.is_paper && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">Paper</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-sm mt-0.5">{bot.pair}</div>
                </div>
                <StatusBadge status={bot.status} />
              </div>

              {/* Metrics */}
              {bot.bot_type === 'grid' ? (
                <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Aralık</div>
                    <div className="font-medium tabular-nums text-xs mt-0.5">
                      {formatCurrency(bot.grid_lower_price)} – {formatCurrency(bot.grid_upper_price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Seviye</div>
                    <div className="font-medium">{bot.grid_levels}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Emir</div>
                    <div className="font-medium tabular-nums">{formatCurrency(bot.grid_order_size)}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Base Order</div>
                    <div className="font-medium tabular-nums">{formatCurrency(bot.base_order_size)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">TP</div>
                    <div className="font-medium text-profit">+{bot.take_profit_pct}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Aktif İşlem</div>
                    <div className="font-medium">{bot.active_deals_count}</div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                {bot.status !== 'active' ? (
                  <button onClick={() => startMut.mutate(bot.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-profit/10 text-profit hover:bg-profit/20 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {t('bots.start')}
                  </button>
                ) : (
                  <>
                    <button onClick={() => pauseMut.mutate(bot.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      {t('bots.pause')}
                    </button>
                    <button onClick={() => stopMut.mutate(bot.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent rounded-lg text-xs font-medium transition-colors"
                    >
                      <Square className="w-3.5 h-3.5" />
                      {t('bots.stop')}
                    </button>
                  </>
                )}
                <button onClick={() => dupMut.mutate(bot.id)}
                  className="ml-auto p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  title={t('bots.duplicate')}
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (confirm('Botu silmek istediğinizden emin misiniz?')) deleteMut.mutate(bot.id) }}
                  className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                  title={t('bots.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
