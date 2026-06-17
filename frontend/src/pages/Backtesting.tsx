import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { backtestApi, botsApi } from '@/services/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import { Play, BarChart2, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/utils/cn'

const schema = z.object({
  bot_id: z.number().optional(),
  pair: z.string().min(3),
  timeframe: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  initial_capital: z.number().positive(),
})

type FormData = z.infer<typeof schema>

export default function BacktestingPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedRun, setSelectedRun] = useState<number | null>(null)

  const { data: botsData } = useQuery({ queryKey: ['bots-simple'], queryFn: () => botsApi.list() })
  const bots = botsData?.data?.data || []

  const { data: runsData, isLoading } = useQuery({
    queryKey: ['backtest-runs'],
    queryFn: () => backtestApi.listRuns(),
    refetchInterval: 5000,
  })

  const { data: resultsData } = useQuery({
    queryKey: ['backtest-results', selectedRun],
    queryFn: () => backtestApi.getResults(selectedRun!),
    enabled: !!selectedRun,
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pair: 'BTCUSDT',
      timeframe: '1h',
      initial_capital: 1000,
    },
  })

  const createMut = useMutation({
    mutationFn: (data: FormData) => backtestApi.createRun(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['backtest-runs'] })
      toast.success('Backtest başlatıldı')
      setSelectedRun(res.data.data.id)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => backtestApi.deleteRun(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['backtest-runs'] }); setSelectedRun(null) },
  })

  const runs = runsData?.data?.data || []
  const results = resultsData?.data?.data
  const equityCurve = results?.equity_curve || []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('backtest.title')}</h1>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Config Form */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Yeni Backtest</h3>
          <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bot (opsiyonel)</label>
              <select {...register('bot_id', { valueAsNumber: true })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Manuel Konfigürasyon</option>
                {bots.map((b: any) => <option key={b.id} value={b.id}>{b.name} ({b.pair})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('backtest.pair')}</label>
              <input {...register('pair')}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                placeholder="BTCUSDT"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('backtest.timeframe')}</label>
              <select {...register('timeframe')}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {['1m','5m','15m','30m','1h','4h','1d'].map(tf => <option key={tf}>{tf}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('backtest.startDate')}</label>
                <input type="date" {...register('start_date')}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('backtest.endDate')}</label>
                <input type="date" {...register('end_date')}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('backtest.capital')} (USDT)</label>
              <input type="number" {...register('initial_capital', { valueAsNumber: true })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="1000"
              />
            </div>
            <button type="submit" disabled={isSubmitting || createMut.isPending}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {t('backtest.run')}
            </button>
          </form>
        </div>

        {/* Runs List */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Çalıştırmalar</h3>
          {isLoading ? <LoadingSpinner size="sm" /> : (
            <div className="space-y-2">
              {runs.map((run: any) => (
                <div
                  key={run.id}
                  onClick={() => setSelectedRun(run.id)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-colors',
                    selectedRun === run.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{run.pair} - {run.timeframe}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full',
                        run.status === 'completed' ? 'bg-profit/10 text-profit' :
                        run.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                        run.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {run.status}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); deleteMut.mutate(run.id) }}
                        className="p-1 hover:text-destructive text-muted-foreground transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {run.start_date} → {run.end_date}
                  </div>
                  {run.status === 'running' && (
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${run.progress_pct}%` }} />
                    </div>
                  )}
                </div>
              ))}
              {runs.length === 0 && <p className="text-sm text-muted-foreground">Henüz backtest yok</p>}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Sonuçlar
          </h3>
          {!results ? (
            <p className="text-sm text-muted-foreground">Backtest seçin</p>
          ) : (
            <div className="space-y-3">
              {[
                [t('backtest.totalDeals'), String(results.total_deals)],
                [t('backtest.winRate'), results.win_rate_pct ? `${parseFloat(results.win_rate_pct).toFixed(1)}%` : '-'],
                [t('backtest.totalProfit'), formatPercent(results.total_profit_pct || 0)],
                [t('backtest.maxDrawdown'), results.max_drawdown_pct ? `-${parseFloat(results.max_drawdown_pct).toFixed(2)}%` : '-'],
                [t('backtest.sharpeRatio'), results.sharpe_ratio ? parseFloat(results.sharpe_ratio).toFixed(2) : '-'],
                ['En iyi işlem', results.best_deal_pct ? formatPercent(results.best_deal_pct) : '-'],
                ['En kötü işlem', results.worst_deal_pct ? formatPercent(results.worst_deal_pct) : '-'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center py-1 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Equity Curve */}
      {equityCurve.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Equity Eğrisi</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="ts" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={v => v?.slice(0, 10)} interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={v => `$${v.toFixed(0)}`}
              />
              <Tooltip
                formatter={(v: any) => [formatCurrency(v), 'Equity']}
                labelFormatter={l => l?.slice(0, 10)}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
