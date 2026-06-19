import { useState } from 'react'
import { useForm, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { botsApi, exchangeKeysApi } from '@/services/api'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { cn } from '@/utils/cn'

const TOP_USDT_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'SHIBUSDT', 'TRXUSDT',
  'ATOMUSDT', 'NEARUSDT', 'FILUSDT', 'AAVEUSDT', 'ETCUSDT',
]

const schema = z.object({
  name: z.string({ required_error: 'Bot adı zorunlu' }).min(1, 'Bot adı zorunlu'),
  exchange_key_id: z.number().optional(),
  pair: z.string({ required_error: 'Parite zorunlu' }).min(3, 'En az 3 karakter'),
  is_paper: z.boolean().default(false),
  base_order_size: z.number({ required_error: 'Bu alan zorunlu', invalid_type_error: 'Geçerli bir sayı girin' }).positive('Sıfırdan büyük olmalı'),
  max_safety_orders: z.number().int().min(0).max(25).default(5),
  safety_order_size: z.number({ required_error: 'Bu alan zorunlu', invalid_type_error: 'Geçerli bir sayı girin' }).positive('Sıfırdan büyük olmalı'),
  safety_order_step_pct: z.number({ required_error: 'Bu alan zorunlu', invalid_type_error: 'Geçerli bir sayı girin' }).positive('Sıfırdan büyük olmalı'),
  safety_order_volume_scale: z.number().min(1).default(1.5),
  safety_order_step_scale: z.number().min(1).default(1.0),
  take_profit_type: z.enum(['fixed', 'trailing']).default('fixed'),
  take_profit_pct: z.number({ required_error: 'Bu alan zorunlu', invalid_type_error: 'Geçerli bir sayı girin' }).positive('Sıfırdan büyük olmalı'),
  trailing_deviation_pct: z.number().positive().default(0.5),
  stop_loss_enabled: z.boolean().default(false),
  stop_loss_pct: z.number().positive().optional(),
  start_condition: z.enum(['immediately', 'indicator', 'webhook']).default('immediately'),
  reinvest_pct: z.number().min(0).max(100).default(0),
})

type FormData = z.infer<typeof schema>

const STEPS = [
  'Genel',
  'Base Order',
  'Safety Orders',
  'Take Profit / Stop Loss',
  'Gelişmiş',
]

const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
  0: ['name', 'pair'],
  1: ['base_order_size'],
  2: ['max_safety_orders', 'safety_order_size', 'safety_order_step_pct', 'safety_order_volume_scale', 'safety_order_step_scale'],
  3: ['take_profit_type', 'take_profit_pct'],
  4: ['start_condition', 'reinvest_pct'],
}

function FormField({ label, error, children, hint }: { label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      {error && <p className="text-destructive text-xs mt-1">{error}</p>}
    </div>
  )
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn('w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary', className)}
      {...props}
    />
  )
}

function Select({ children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn('w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary', className)}
      {...props}
    >
      {children}
    </select>
  )
}

export default function CreateBotPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const { data: keysData } = useQuery({
    queryKey: ['exchange-keys'],
    queryFn: () => exchangeKeysApi.list(),
  })
  const keys = keysData?.data?.data || []

  const { register, handleSubmit, watch, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
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

  const stopLossEnabled = watch('stop_loss_enabled')
  const tpType = watch('take_profit_type')

  const clearErr = (field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const createMut = useMutation({
    mutationFn: (data: FormData) => botsApi.create(data),
    onSuccess: () => {
      toast.success('Bot oluşturuldu!')
      navigate('/bots')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const handleNext = async () => {
    const fields = STEP_FIELDS[step]
    const values = getValues()
    const result = schema.safeParse(values)

    const stepErrors: Record<string, string> = {}
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0])
        if ((fields as string[]).includes(field) && !stepErrors[field]) {
          stepErrors[field] = issue.message
        }
      }
    }

    if (Object.keys(stepErrors).length > 0) {
      setFieldErrors(prev => ({ ...prev, ...stepErrors }))
      return
    }

    setStep(s => s + 1)
  }

  const onSubmit = (data: FormData) => {
    data.pair = data.pair.toUpperCase()
    if (!data.exchange_key_id || isNaN(data.exchange_key_id as number)) {
      data.exchange_key_id = undefined
    }
    createMut.mutate(data)
  }

  const onSubmitError = (errs: FieldErrors<FormData>) => {
    const display: Record<string, string> = {}
    for (const [k, v] of Object.entries(errs)) {
      if (v?.message) display[k] = v.message as string
    }
    setFieldErrors(display)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <button onClick={() => navigate('/bots')} className="hover:text-foreground">Botlar</button>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">{t('bots.create')}</span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
              i < step ? 'bg-primary text-primary-foreground' :
              i === step ? 'bg-primary/20 text-primary border border-primary' :
              'bg-muted text-muted-foreground'
            )}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px w-6 flex-1', i < step ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold mb-6">{STEPS[step]}</h2>

        <form onSubmit={handleSubmit(onSubmit, onSubmitError)}>
          {/* Step 0: General */}
          {step === 0 && (
            <div className="space-y-4">
              <FormField label="Bot Adı" error={fieldErrors.name}>
                <Input
                  {...register('name')}
                  onInput={() => clearErr('name')}
                  placeholder="BTC DCA Bot"
                />
              </FormField>

              <FormField label="Parite" error={fieldErrors.pair}>
                <Input
                  {...register('pair')}
                  onInput={() => clearErr('pair')}
                  list="pair-list"
                  placeholder="BTCUSDT veya seçin..."
                  className="uppercase"
                />
                <datalist id="pair-list">
                  {TOP_USDT_PAIRS.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </FormField>

              <FormField label="Exchange API Anahtarı">
                <Select {...register('exchange_key_id', {
                  setValueAs: (v) => v === '' ? undefined : Number(v),
                })}>
                  <option value="">Anahtar seçin (Paper Trading için gerek yok)</option>
                  {keys.map((k: any) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </Select>
              </FormField>

              <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                <input type="checkbox" id="is_paper" {...register('is_paper')} className="w-4 h-4 accent-primary" />
                <label htmlFor="is_paper" className="text-sm">
                  <span className="font-medium">Paper Trading Modu</span>
                  <span className="text-muted-foreground ml-2">Gerçek para kullanılmaz</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 1: Base Order */}
          {step === 1 && (
            <div className="space-y-4">
              <FormField label="Base Order Miktarı (USDT)" error={fieldErrors.base_order_size}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('base_order_size', { valueAsNumber: true })}
                  onInput={() => clearErr('base_order_size')}
                  placeholder="100"
                />
              </FormField>

              <div className="p-4 bg-accent/30 rounded-lg text-sm">
                <p className="text-muted-foreground">İşlem açılışında kullanılacak ilk alım miktarı. USDT cinsinden giriniz.</p>
              </div>
            </div>
          )}

          {/* Step 2: Safety Orders */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Maks. Safety Order Sayısı" error={fieldErrors.max_safety_orders}>
                  <Input
                    type="number"
                    min="0"
                    max="25"
                    {...register('max_safety_orders', { valueAsNumber: true })}
                    onInput={() => clearErr('max_safety_orders')}
                  />
                </FormField>
                <FormField label="SO Miktarı (USDT)" error={fieldErrors.safety_order_size}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('safety_order_size', { valueAsNumber: true })}
                    onInput={() => clearErr('safety_order_size')}
                    placeholder="50"
                  />
                </FormField>
              </div>

              <FormField label="Fiyat Sapma % (İlk SO)" error={fieldErrors.safety_order_step_pct}>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  {...register('safety_order_step_pct', { valueAsNumber: true })}
                  onInput={() => clearErr('safety_order_step_pct')}
                  placeholder="2.0"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Volume Scale" error={fieldErrors.safety_order_volume_scale} hint="Her SO miktarı öncekinin kaç katı">
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    {...register('safety_order_volume_scale', { valueAsNumber: true })}
                    onInput={() => clearErr('safety_order_volume_scale')}
                    placeholder="1.5"
                  />
                </FormField>
                <FormField label="Step Scale" error={fieldErrors.safety_order_step_scale} hint="Her SO aralığı öncekinin kaç katı">
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    {...register('safety_order_step_scale', { valueAsNumber: true })}
                    onInput={() => clearErr('safety_order_step_scale')}
                    placeholder="1.0"
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* Step 3: TP/SL */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Take Profit Tipi">
                  <Select {...register('take_profit_type')}>
                    <option value="fixed">Sabit</option>
                    <option value="trailing">Trailing</option>
                  </Select>
                </FormField>
                <FormField label="Take Profit %" error={fieldErrors.take_profit_pct}>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    {...register('take_profit_pct', { valueAsNumber: true })}
                    onInput={() => clearErr('take_profit_pct')}
                    placeholder="2.0"
                  />
                </FormField>
              </div>

              {tpType === 'trailing' && (
                <FormField label="Trailing Deviation %" error={fieldErrors.trailing_deviation_pct}>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    {...register('trailing_deviation_pct', { valueAsNumber: true })}
                    onInput={() => clearErr('trailing_deviation_pct')}
                    placeholder="0.5"
                  />
                </FormField>
              )}

              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <input type="checkbox" id="sl_enabled" {...register('stop_loss_enabled')} className="w-4 h-4 accent-primary" />
                  <label htmlFor="sl_enabled" className="text-sm font-medium">Stop Loss Aktif</label>
                </div>

                {stopLossEnabled && (
                  <FormField label="Stop Loss %">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      {...register('stop_loss_pct', { valueAsNumber: true })}
                      placeholder="5.0"
                    />
                  </FormField>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Advanced */}
          {step === 4 && (
            <div className="space-y-4">
              <FormField label="Sinyal Kaynağı">
                <Select {...register('start_condition')}>
                  <option value="immediately">Hemen Başlat</option>
                  <option value="indicator">İndikatör Sinyali</option>
                  <option value="webhook">TradingView Webhook</option>
                </Select>
              </FormField>

              <FormField label="Yeniden Yatırım %">
                <Select {...register('reinvest_pct', { valueAsNumber: true })}>
                  <option value={0}>Kapalı (0%)</option>
                  <option value={50}>%50 Reinvest</option>
                  <option value={100}>%100 Reinvest</option>
                </Select>
              </FormField>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent disabled:opacity-30 text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('common.back')}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium"
              >
                {t('common.next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={createMut.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium"
              >
                <Check className="w-4 h-4" />
                {createMut.isPending ? 'Oluşturuluyor...' : 'Bot Oluştur'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
