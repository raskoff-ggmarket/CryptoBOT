import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { botsApi, exchangeKeysApi, marketApi } from '@/services/api'
import CandleChart, { ChartLevel } from '@/components/common/CandleChart'
import { ArrowLeft, Grid3X3, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

const num = (v: string) => parseFloat(String(v).replace(',', '.'))

const schema = z.object({
  name: z.string().min(1, 'Bot adı gerekli'),
  pair: z.string().min(3, 'Parite gerekli'),
  exchange_key_id: z.string().optional(),
  is_paper: z.boolean(),
  grid_lower_price: z.string().refine((v) => num(v) > 0, 'Geçerli bir fiyat girin'),
  grid_upper_price: z.string().refine((v) => num(v) > 0, 'Geçerli bir fiyat girin'),
  grid_levels: z.string().refine((v) => Number.isInteger(num(v)) && num(v) >= 2 && num(v) <= 100, '2-100 arası seviye'),
  grid_order_size: z.string().refine((v) => num(v) > 0, 'Geçerli bir tutar girin'),
}).refine((d) => num(d.grid_upper_price) > num(d.grid_lower_price), {
  message: 'Üst fiyat alt fiyattan büyük olmalı',
  path: ['grid_upper_price'],
})

type FormData = z.infer<typeof schema>

export default function CreateGridBotPage() {
  const navigate = useNavigate()
  const [pairInput, setPairInput] = useState('BTCUSDT')

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      pair: 'BTCUSDT',
      is_paper: true,
      grid_lower_price: '',
      grid_upper_price: '',
      grid_levels: '10',
      grid_order_size: '50',
    },
  })

  const { data: keysData } = useQuery({
    queryKey: ['exchange-keys'],
    queryFn: () => exchangeKeysApi.list(),
  })
  const keys = keysData?.data?.data || []

  const { data: tickerData } = useQuery({
    queryKey: ['ticker', pairInput],
    queryFn: () => marketApi.ticker(pairInput),
    enabled: pairInput.length >= 6,
    refetchInterval: 15000,
  })
  const lastPrice = parseFloat(tickerData?.data?.data?.lastPrice || '0')

  const w = watch()
  const lower = num(w.grid_lower_price)
  const upper = num(w.grid_upper_price)
  const levels = num(w.grid_levels)
  const orderSize = num(w.grid_order_size)

  const preview = useMemo(() => {
    if (!(lower > 0 && upper > lower && levels >= 2 && levels <= 100)) return null
    const step = (upper - lower) / (levels - 1)
    const lines = Array.from({ length: levels }, (_, i) => lower + step * i)
    const profitPerGridPct = (step / lower) * 100 - 0.2 // iki yön komisyonu ~%0.2
    const totalInvest = orderSize > 0 ? orderSize * (levels - 1) : 0
    return { lines, step, profitPerGridPct, totalInvest }
  }, [lower, upper, levels, orderSize])

  const chartLevels: ChartLevel[] = useMemo(
    () =>
      (preview?.lines || []).map((p, i) => ({
        price: p,
        color: i === 0 || i === (preview?.lines.length || 0) - 1 ? '#3b82f6' : '#f59e0b',
        title: i === 0 ? 'Alt' : i === (preview?.lines.length || 0) - 1 ? 'Üst' : '',
        dashed: !(i === 0 || i === (preview?.lines.length || 0) - 1),
      })),
    [preview]
  )

  const createMut = useMutation({
    mutationFn: (data: FormData) =>
      botsApi.create({
        name: data.name,
        pair: data.pair.toUpperCase(),
        bot_type: 'grid',
        exchange_key_id: data.exchange_key_id ? Number(data.exchange_key_id) : null,
        is_paper: data.is_paper,
        grid_lower_price: num(data.grid_lower_price),
        grid_upper_price: num(data.grid_upper_price),
        grid_levels: num(data.grid_levels),
        grid_order_size: num(data.grid_order_size),
      }),
    onSuccess: (res) => {
      toast.success('Grid bot oluşturuldu')
      const id = res?.data?.data?.id
      navigate(id ? `/bots/${id}` : '/bots')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Bot oluşturulamadı'),
  })

  const onSubmit = (data: FormData) => createMut.mutate(data)

  const inputCls =
    'w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1.5'

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/bots')} className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Grid3X3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Grid Bot Oluştur</h1>
            <p className="text-xs text-muted-foreground">Fiyat aralığında otomatik al-sat ızgarası</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <label className={labelCls}>Bot Adı</label>
            <input {...register('name')} placeholder="BTC Grid" className={inputCls} />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Parite</label>
            <input
              {...register('pair')}
              onChange={(e) => setPairInput(e.target.value.toUpperCase())}
              placeholder="BTCUSDT"
              className={inputCls}
            />
            {lastPrice > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Güncel fiyat: <span className="font-mono text-foreground">{lastPrice.toLocaleString()}</span>
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Borsa Anahtarı</label>
            <select {...register('exchange_key_id')} className={inputCls}>
              <option value="">— Seçilmedi (kağıt işlem) —</option>
              {keys.map((k: any) => (
                <option key={k.id} value={k.id}>{k.label} ({k.exchange})</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" {...register('is_paper')} className="w-4 h-4 accent-[#22c55e]" />
            Kağıt işlem (sanal bakiye ile risksiz)
          </label>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Alt Fiyat</label>
                <input {...register('grid_lower_price')} placeholder="55000" className={inputCls} />
                {errors.grid_lower_price && <p className="text-xs text-destructive mt-1">{errors.grid_lower_price.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Üst Fiyat</label>
                <input {...register('grid_upper_price')} placeholder="75000" className={inputCls} />
                {errors.grid_upper_price && <p className="text-xs text-destructive mt-1">{errors.grid_upper_price.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Grid Seviyesi</label>
                <input {...register('grid_levels')} placeholder="10" className={inputCls} />
                {errors.grid_levels && <p className="text-xs text-destructive mt-1">{errors.grid_levels.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Emir Büyüklüğü (USDT)</label>
                <input {...register('grid_order_size')} placeholder="50" className={inputCls} />
                {errors.grid_order_size && <p className="text-xs text-destructive mt-1">{errors.grid_order_size.message}</p>}
              </div>
            </div>
          </div>

          {preview && (
            <div className="bg-secondary/60 border border-border rounded-xl p-3.5 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grid aralığı</span>
                <span className="font-mono">{preview.step.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grid başına ~kâr</span>
                <span className={cn('font-mono', preview.profitPerGridPct > 0 ? 'text-profit' : 'text-loss')}>
                  %{preview.profitPerGridPct.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maks. yatırım</span>
                <span className="font-mono">{preview.totalInvest.toFixed(0)} USDT</span>
              </div>
              {preview.profitPerGridPct <= 0 && (
                <p className="text-xs text-loss pt-1">
                  ⚠ Grid aralığı komisyonu karşılamıyor — seviye sayısını azaltın veya aralığı genişletin.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || createMut.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Grid Bot Oluştur
          </button>
        </form>

        {/* Grafik + grid önizleme */}
        <div className="space-y-4">
          <CandleChart pair={pairInput.length >= 6 ? pairInput : 'BTCUSDT'} levels={chartLevels} />
          {preview && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Grid Seviyeleri ({preview.lines.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...preview.lines].reverse().map((p, i) => (
                  <span
                    key={i}
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-mono border',
                      i === 0 || i === preview.lines.length - 1
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-secondary text-muted-foreground'
                    )}
                  >
                    {p.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
