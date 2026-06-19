import { useState, forwardRef, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { botsApi, exchangeKeysApi } from '@/services/api'
import { ChevronRight, TrendingUp, Shield, Settings2, BarChart3, AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

const TOP_USDT_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'SHIBUSDT', 'TRXUSDT',
  'ATOMUSDT', 'NEARUSDT', 'FILUSDT', 'AAVEUSDT', 'ETCUSDT',
]

const schema = z.object({
  name: z.string().min(1, 'Bot adı zorunlu'),
  exchange_key_id: z.number().optional(),
  pair: z.string().min(3, 'Parite zorunlu'),
  is_paper: z.boolean().default(false),
  base_order_size: z.number({ required_error: 'Zorunlu', invalid_type_error: 'Sayı girin' }).positive('Sıfırdan büyük olmalı'),
  max_safety_orders: z.number().int().min(0).max(25).default(5),
  safety_order_size: z.number({ required_error: 'Zorunlu', invalid_type_error: 'Sayı girin' }).positive('Sıfırdan büyük olmalı'),
  safety_order_step_pct: z.number({ required_error: 'Zorunlu', invalid_type_error: 'Sayı girin' }).positive('Sıfırdan büyük olmalı'),
  safety_order_volume_scale: z.number().min(1).default(1.5),
  safety_order_step_scale: z.number().min(1).default(1.0),
  take_profit_type: z.enum(['fixed', 'trailing']).default('fixed'),
  take_profit_pct: z.number({ required_error: 'Zorunlu', invalid_type_error: 'Sayı girin' }).positive('Sıfırdan büyük olmalı'),
  trailing_deviation_pct: z.number().positive().default(0.5),
  stop_loss_enabled: z.boolean().default(false),
  stop_loss_pct: z.number().positive().optional(),
  start_condition: z.enum(['immediately', 'indicator', 'webhook']).default('immediately'),
  reinvest_pct: z.number().min(0).max(100).default(0),
})

type FormData = z.infer<typeof schema>

interface SOLevel {
  num: number
  price: number
  deviation: number
  cumDeviation: number
  soSize: number
  totalQuote: number
  avgPrice: number
  requiredChange: number
}

function computeDCALevels(
  refPrice: number,
  baseOrderSize: number,
  soSize: number,
  stepPct: number,
  volumeScale: number,
  stepScale: number,
  maxSOs: number,
  tpPct: number,
): SOLevel[] {
  if (!refPrice || !baseOrderSize || !soSize || !stepPct || !tpPct || maxSOs < 1) return []
  const levels: SOLevel[] = []
  let cumDev = 0
  let totalQuote = baseOrderSize
  let totalBase = baseOrderSize / refPrice
  let curStep = stepPct
  let curSOSize = soSize

  for (let i = 1; i <= Math.min(maxSOs, 25); i++) {
    if (i > 1) {
      curStep = curStep * stepScale
      curSOSize = curSOSize * volumeScale
    }
    cumDev += curStep
    const soPrice = refPrice * (1 - cumDev / 100)
    const soBase = curSOSize / soPrice
    totalQuote += curSOSize
    totalBase += soBase
    const avgPrice = totalQuote / totalBase
    const tpPrice = avgPrice * (1 + tpPct / 100)
    const requiredChange = ((tpPrice - soPrice) / soPrice) * 100

    levels.push({ num: i, price: soPrice, deviation: curStep, cumDeviation: cumDev, soSize: curSOSize, totalQuote, avgPrice, requiredChange })
  }
  return levels
}

const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn('w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary', className)}
      {...props}
    />
  )
)
Input.displayName = 'Input'

const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ children, className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn('w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary', className)}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

function SectionCard({ icon: Icon, title, color, children }: {
  icon: React.ElementType
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className={cn('flex items-center gap-2 px-4 py-3 border-b border-border', color)}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, error, hint, children, inline }: {
  label: string; error?: string; hint?: string; children: React.ReactNode; inline?: boolean
}) {
  return (
    <div className={cn(inline && 'flex items-center gap-3')}>
      {!inline && <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">{label}</label>}
      {children}
      {inline && <label className="text-sm text-foreground">{label}</label>}
      {hint && !error && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      {error && <p className="text-destructive text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  )
}

function InputGroup({ children, suffix }: { children: React.ReactNode; suffix?: string }) {
  return (
    <div className="flex items-center gap-0">
      <div className="flex-1">{children}</div>
      {suffix && (
        <span className="px-3 py-2 bg-muted border border-l-0 border-border rounded-r-lg text-xs text-muted-foreground">{suffix}</span>
      )}
    </div>
  )
}

export default function CreateBotPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [refPrice, setRefPrice] = useState<string>('100')

  const { data: keysData } = useQuery({
    queryKey: ['exchange-keys'],
    queryFn: () => exchangeKeysApi.list(),
  })
  const keys = keysData?.data?.data || []

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      is_paper: false,
      max_safety_orders: 5,
      safety_order_volume_scale: 1.5,
      safety_order_step_scale: 1.0,
      take_profit_type: 'fixed',
      trailing_deviation_pct: 0.5,
      stop_loss_enabled: false,
      start_condition: 'immediately',
      reinvest_pct: 0,
    },
  })

  const vals = watch()
  const stopLossEnabled = vals.stop_loss_enabled
  const tpType = vals.take_profit_type

  const createMut = useMutation({
    mutationFn: (data: FormData) => botsApi.create(data),
    onSuccess: () => {
      toast.success('Bot oluşturuldu!')
      navigate('/bots')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const onSubmit = (data: FormData) => {
    data.pair = data.pair.toUpperCase()
    if (!data.exchange_key_id || isNaN(data.exchange_key_id as number)) data.exchange_key_id = undefined
    createMut.mutate(data)
  }

  const onInvalid = () => {
    toast.error('Lütfen eksik / hatalı alanları doldurun')
  }

  // numeric register that accepts both comma and dot decimals (TR locale)
  const num = (name: keyof FormData) =>
    register(name as any, {
      setValueAs: (v) => {
        if (v === '' || v === null || v === undefined) return undefined
        const n = parseFloat(String(v).replace(',', '.'))
        return isNaN(n) ? undefined : n
      },
    })

  const e = (field: keyof FormData) => errors[field]?.message as string | undefined

  const refPriceNum = parseFloat(refPrice) || 100

  const dcaLevels = useMemo(() => computeDCALevels(
    refPriceNum,
    vals.base_order_size || 0,
    vals.safety_order_size || 0,
    vals.safety_order_step_pct || 0,
    vals.safety_order_volume_scale || 1.5,
    vals.safety_order_step_scale || 1.0,
    vals.max_safety_orders || 0,
    vals.take_profit_pct || 0,
  ), [refPriceNum, vals.base_order_size, vals.safety_order_size, vals.safety_order_step_pct, vals.safety_order_volume_scale, vals.safety_order_step_scale, vals.max_safety_orders, vals.take_profit_pct])

  const totalRequired = dcaLevels.length > 0
    ? dcaLevels[dcaLevels.length - 1].totalQuote
    : (vals.base_order_size || 0)

  const fmt = (n: number, d = 2) => n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d })

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <button onClick={() => navigate('/bots')} className="hover:text-foreground">Botlar</button>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">{t('bots.create')}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">

          {/* ── Left column: parameters ── */}
          <div className="space-y-4">

            {/* Bot Settings */}
            <SectionCard icon={Settings2} title="Bot Ayarları" color="bg-blue-500/10 text-blue-400">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bot Adı" error={e('name')}>
                  <Input {...register('name')} placeholder="BTC DCA Bot" />
                </Field>
                <Field label="Parite" error={e('pair')}>
                  <Input {...register('pair')} list="pair-list" placeholder="BTCUSDT" className="uppercase" />
                  <datalist id="pair-list">
                    {TOP_USDT_PAIRS.map(p => <option key={p} value={p} />)}
                  </datalist>
                </Field>
              </div>
              <Field label="Exchange API Anahtarı">
                <Select {...register('exchange_key_id', { setValueAs: (v) => v === '' ? undefined : Number(v) })}>
                  <option value="">— Anahtar seçin (Paper Trading için gerek yok) —</option>
                  {keys.map((k: any) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" {...register('is_paper')} className="w-4 h-4 accent-primary rounded" />
                <span className="text-sm font-medium">Paper Trading Modu</span>
                <span className="text-xs text-muted-foreground">(gerçek para kullanılmaz)</span>
              </label>
            </SectionCard>

            {/* Base Order */}
            <SectionCard icon={TrendingUp} title="Base Order" color="bg-green-500/10 text-green-400">
              <Field label="İlk Alım Miktarı" error={e('base_order_size')} hint="İşlem açılışında kullanılacak başlangıç yatırım miktarı">
                <InputGroup suffix="USDT">
                  <Input
                    type="text" inputMode="decimal"
                    {...num('base_order_size')}
                    placeholder="100"
                    className="rounded-r-none"
                  />
                </InputGroup>
              </Field>
            </SectionCard>

            {/* Safety Orders */}
            <SectionCard icon={BarChart3} title="Safety Orders (DCA)" color="bg-purple-500/10 text-purple-400">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Maks. SO Sayısı" error={e('max_safety_orders')} hint="0–25">
                  <Input
                    type="text" inputMode="numeric"
                    {...num('max_safety_orders')}
                    placeholder="5"
                  />
                </Field>
                <Field label="SO Miktarı" error={e('safety_order_size')} hint="İlk SO büyüklüğü">
                  <InputGroup suffix="USDT">
                    <Input
                      type="text" inputMode="decimal"
                      {...num('safety_order_size')}
                      placeholder="50"
                      className="rounded-r-none"
                    />
                  </InputGroup>
                </Field>
              </div>

              <Field label="İlk SO Fiyat Sapması" error={e('safety_order_step_pct')} hint="Base order fiyatından ilk SO'ya kadar düşüş yüzdesi">
                <InputGroup suffix="%">
                  <Input
                    type="text" inputMode="decimal"
                    {...num('safety_order_step_pct')}
                    placeholder="2.0"
                    className="rounded-r-none"
                  />
                </InputGroup>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Volume Scale" error={e('safety_order_volume_scale')} hint="Her SO öncekinin kaç katı büyüklükte">
                  <InputGroup suffix="×">
                    <Input
                      type="text" inputMode="decimal"
                      {...num('safety_order_volume_scale')}
                      placeholder="1.5"
                      className="rounded-r-none"
                    />
                  </InputGroup>
                </Field>
                <Field label="Step Scale" error={e('safety_order_step_scale')} hint="Her SO aralığı öncekinin kaç katı">
                  <InputGroup suffix="×">
                    <Input
                      type="text" inputMode="decimal"
                      {...num('safety_order_step_scale')}
                      placeholder="1.0"
                      className="rounded-r-none"
                    />
                  </InputGroup>
                </Field>
              </div>
            </SectionCard>

            {/* Take Profit / Stop Loss */}
            <SectionCard icon={Shield} title="Take Profit / Stop Loss" color="bg-orange-500/10 text-orange-400">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Take Profit Tipi">
                  <Select {...register('take_profit_type')}>
                    <option value="fixed">Sabit</option>
                    <option value="trailing">Trailing</option>
                  </Select>
                </Field>
                <Field label="Take Profit" error={e('take_profit_pct')}>
                  <InputGroup suffix="%">
                    <Input
                      type="text" inputMode="decimal"
                      {...num('take_profit_pct')}
                      placeholder="2.0"
                      className="rounded-r-none"
                    />
                  </InputGroup>
                </Field>
              </div>

              {tpType === 'trailing' && (
                <Field label="Trailing Deviation" error={e('trailing_deviation_pct')} hint="Zirve fiyattan ne kadar geri çekilince satılsın">
                  <InputGroup suffix="%">
                    <Input
                      type="text" inputMode="decimal"
                      {...num('trailing_deviation_pct')}
                      placeholder="0.5"
                      className="rounded-r-none"
                    />
                  </InputGroup>
                </Field>
              )}

              <div className="border-t border-border pt-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" id="sl_enabled" {...register('stop_loss_enabled')} className="w-4 h-4 accent-primary rounded" />
                  <span className="text-sm font-medium">Stop Loss Aktif</span>
                </label>
                {stopLossEnabled && (
                  <Field label="Stop Loss" error={e('stop_loss_pct')} hint="Ort. maliyetten bu kadar düşünce pozisyon kapatılır">
                    <InputGroup suffix="%">
                      <Input
                        type="text" inputMode="decimal"
                        {...num('stop_loss_pct')}
                        placeholder="5.0"
                        className="rounded-r-none"
                      />
                    </InputGroup>
                  </Field>
                )}
              </div>
            </SectionCard>

            {/* Advanced */}
            <SectionCard icon={Settings2} title="Gelişmiş Ayarlar" color="bg-gray-500/10 text-gray-400">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sinyal Kaynağı" hint="Bot ne zaman işlem açacak">
                  <Select {...register('start_condition')}>
                    <option value="immediately">Hemen Başlat</option>
                    <option value="indicator">İndikatör Sinyali</option>
                    <option value="webhook">TradingView Webhook</option>
                  </Select>
                </Field>
                <Field label="Yeniden Yatırım" hint="Kâr tekrar yatırıma eklenir">
                  <Select {...register('reinvest_pct', { valueAsNumber: true })}>
                    <option value={0}>Kapalı (%0)</option>
                    <option value={25}>%25 Reinvest</option>
                    <option value={50}>%50 Reinvest</option>
                    <option value={75}>%75 Reinvest</option>
                    <option value={100}>%100 Reinvest</option>
                  </Select>
                </Field>
              </div>
            </SectionCard>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {createMut.isPending ? 'Oluşturuluyor...' : 'Bot Oluştur →'}
              </button>
            </div>
          </div>

          {/* ── Right column: DCA Preview ── */}
          <div className="xl:sticky xl:top-6 space-y-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-accent/30">
                <span className="text-sm font-semibold">DCA Seviye Önizleme</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ref. Fiyat:</span>
                  <input
                    type="number"
                    value={refPrice}
                    onChange={e => setRefPrice(e.target.value)}
                    className="w-24 px-2 py-1 bg-input border border-border rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-right"
                    placeholder="100"
                  />
                  <span className="text-xs text-muted-foreground">USDT</span>
                </div>
              </div>

              {dcaLevels.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>Parametreleri girin</p>
                  <p className="text-xs mt-1">Safety order seviyeleri burada görünecek</p>
                </div>
              ) : (
                <>
                  {/* Base order row */}
                  <div className="px-4 py-2 bg-green-500/5 border-b border-border">
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <span className="font-medium text-green-400">Base</span>
                      <span className="text-right font-mono">{fmt(refPriceNum)}</span>
                      <span className="text-right text-muted-foreground">0.00%</span>
                      <span className="text-right font-mono">{fmt(vals.base_order_size || 0)} $</span>
                    </div>
                  </div>

                  {/* Column headers */}
                  <div className="px-4 py-1.5 bg-muted/30 border-b border-border">
                    <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground font-medium">
                      <span>SO #</span>
                      <span className="text-right">Fiyat</span>
                      <span className="text-right">Kümül %</span>
                      <span className="text-right">SO Büyük.</span>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {dcaLevels.map((lvl, idx) => (
                      <div
                        key={lvl.num}
                        className={cn(
                          'px-4 py-2 border-b border-border/50 hover:bg-accent/30 transition-colors',
                          idx % 2 === 0 ? 'bg-background' : 'bg-card'
                        )}
                      >
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <span className="font-medium text-purple-400">SO {lvl.num}</span>
                          <span className="text-right font-mono">{fmt(lvl.price)}</span>
                          <span className="text-right text-red-400">-{fmt(lvl.cumDeviation)}%</span>
                          <span className="text-right font-mono">{fmt(lvl.soSize)} $</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1">
                          <span>Ort. maliyet: {fmt(lvl.avgPrice)}</span>
                          <span className="text-right">TP için: +{fmt(lvl.requiredChange)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-accent/20 border-t border-border space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Toplam yatırım (tüm SOlar dolarsa):</span>
                      <span className="font-semibold font-mono">{fmt(totalRequired)} USDT</span>
                    </div>
                    {dcaLevels.length > 0 && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Maks. düşüş:</span>
                          <span className="text-red-400 font-mono">-{fmt(dcaLevels[dcaLevels.length - 1].cumDeviation)}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Maks. SO büyüklüğü:</span>
                          <span className="font-mono">{fmt(dcaLevels[dcaLevels.length - 1].soSize)} USDT</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Son SO ort. maliyeti:</span>
                          <span className="font-mono">{fmt(dcaLevels[dcaLevels.length - 1].avgPrice)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Quick tip */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-blue-400 mb-2">Nasıl çalışır?</p>
              <p>• <strong>Volume Scale:</strong> Her SO bir öncekinin x katı kadar büyük olur</p>
              <p>• <strong>Step Scale:</strong> Her SO arasındaki fiyat farkı bir öncekinin x katı kadar artar</p>
              <p>• <strong>Ort. Maliyet:</strong> Tüm alımlar hesaba katılarak güncellenen ortalama fiyat</p>
              <p>• <strong>TP için gereken %:</strong> O SO seviyesinden kâra geçmek için gereken yükseliş</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
