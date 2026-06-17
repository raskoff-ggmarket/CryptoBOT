import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { exchangeKeysApi } from '@/services/api'
import { Plus, Trash2, CheckCircle, XCircle, Loader2, Key, Shield, User } from 'lucide-react'
import { cn } from '@/utils/cn'

const TABS = [
  { id: 'api', label: 'API Anahtarları', icon: Key },
  { id: 'risk', label: 'Risk Profili', icon: Shield },
  { id: 'profile', label: 'Profil', icon: User },
]

function APIKeysTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()

  const { data, isLoading } = useQuery({ queryKey: ['exchange-keys'], queryFn: () => exchangeKeysApi.list() })
  const keys = data?.data?.data || []

  const createMut = useMutation({
    mutationFn: (d: any) => exchangeKeysApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exchange-keys'] }); reset(); setShowForm(false); toast.success('API anahtarı eklendi') },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => exchangeKeysApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exchange-keys'] }); toast.success('Silindi') },
  })

  const validateMut = useMutation({
    mutationFn: (id: number) => exchangeKeysApi.validate(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['exchange-keys'] })
      if (res.data.data.valid) toast.success('API anahtarı geçerli ✓')
      else toast.error('API anahtarı geçersiz')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('settings.apiKeys')}</h3>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          {t('settings.addKey')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(d => createMut.mutate(d))}
          className="bg-accent/30 rounded-xl border border-border p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('settings.keyLabel')}</label>
              <input {...register('label', { required: true })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ana Binance"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Exchange</label>
              <select {...register('exchange')}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="binance">Binance</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('settings.apiKey')}</label>
            <input {...register('api_key', { required: true })}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="API Key..."
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('settings.apiSecret')}</label>
            <input type="password" {...register('api_secret', { required: true })}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="API Secret..."
            />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_paper" {...register('is_paper')} className="accent-primary" />
            <label htmlFor="is_paper" className="text-sm">Paper Trading anahtarı</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Ekle
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {keys.map((key: any) => (
          <div key={key.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{key.label}</span>
                {key.is_paper && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">Paper</span>
                )}
                {key.is_valid ? (
                  <CheckCircle className="w-4 h-4 text-profit" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-0.5">{key.api_key_masked}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => validateMut.mutate(key.id)}
                disabled={validateMut.isPending}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors"
              >
                {t('settings.validate')}
              </button>
              <button onClick={() => deleteMut.mutate(key.id)}
                className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {keys.length === 0 && !isLoading && (
          <p className="text-muted-foreground text-sm text-center py-8">API anahtarı eklenmemiş</p>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('api')

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        {tab === 'api' && <APIKeysTab />}
        {tab === 'risk' && (
          <div>
            <h3 className="font-semibold mb-4">Risk Profili</h3>
            <p className="text-muted-foreground text-sm">Risk profili ayarları yakında eklenecek.</p>
          </div>
        )}
        {tab === 'profile' && (
          <div>
            <h3 className="font-semibold mb-4">Profil Bilgileri</h3>
            <p className="text-muted-foreground text-sm">Profil ayarları yakında eklenecek.</p>
          </div>
        )}
      </div>
    </div>
  )
}
