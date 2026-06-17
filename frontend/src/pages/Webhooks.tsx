import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/services/api'
import { formatDate } from '@/utils/formatters'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { Copy, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/utils/cn'

export default function WebhooksPage() {
  const { t } = useTranslation()

  const { data: signalsData, isLoading } = useQuery({
    queryKey: ['webhook-signals'],
    queryFn: () => api.get('/webhooks/signals', { params: { page_size: 50 } }),
    refetchInterval: 10000,
  })

  const signals = signalsData?.data?.data || []

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Kopyalandı!')
  }

  const examplePayload = JSON.stringify({
    secret: "BOT_WEBHOOK_SECRET",
    action: "start_deal",
    pair: "BTCUSDT",
    price: "{{close}}"
  }, null, 2)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('nav.webhooks')}</h1>

      {/* Guide */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-3">TradingView Webhook Kurulumu</h3>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            TradingView Alert'ınızı aşağıdaki endpoint'e yönlendirin. Bot konfigürasyonunda
            <strong className="text-foreground"> start_condition = webhook</strong> seçilmiş olmalıdır.
          </p>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Webhook URL:</p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3 font-mono text-xs">
              <span className="flex-1">{window.location.origin}/api/v1/webhooks/bots/{'{'}{'{'}BOT_ID{'}'}{'}'}</span>
              <button onClick={() => copyToClipboard(`${window.location.origin}/api/v1/webhooks/bots/{BOT_ID}`)}
                className="hover:text-primary transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Örnek Payload (JSON body):</p>
            <div className="relative bg-muted/50 rounded-lg p-3">
              <pre className="font-mono text-xs text-foreground overflow-x-auto">{examplePayload}</pre>
              <button onClick={() => copyToClipboard(examplePayload)}
                className="absolute top-2 right-2 hover:text-primary text-muted-foreground transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-accent/50 rounded-lg p-3">
            <p className="text-xs font-medium mb-1">Desteklenen Aksiyonlar:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li><code className="text-foreground">start_deal</code> - Yeni işlem aç</li>
              <li><code className="text-foreground">close_deal</code> - Aktif işlemi kapat</li>
              <li><code className="text-foreground">add_funds</code> - Manuel SO ekle</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Signals Log */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-4">Sinyal Geçmişi</h3>
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : signals.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Henüz sinyal yok</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 font-medium">Bot ID</th>
                  <th className="text-left pb-2 font-medium">Aksiyon</th>
                  <th className="text-left pb-2 font-medium">Parite</th>
                  <th className="text-right pb-2 font-medium">Fiyat</th>
                  <th className="text-center pb-2 font-medium">İşlendi</th>
                  <th className="text-right pb-2 font-medium">Alındı</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-accent/20">
                    <td className="py-2.5 text-muted-foreground">#{s.bot_id}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 bg-accent rounded text-xs font-mono">{s.action}</span>
                    </td>
                    <td className="py-2.5 font-medium">{s.pair}</td>
                    <td className="py-2.5 text-right tabular-nums font-mono text-xs">
                      {s.price ? `$${parseFloat(s.price).toFixed(2)}` : '-'}
                    </td>
                    <td className="py-2.5 text-center">
                      {s.processed
                        ? <CheckCircle className="w-4 h-4 text-profit mx-auto" />
                        : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      }
                    </td>
                    <td className="py-2.5 text-right text-xs text-muted-foreground">
                      {formatDate(s.received_at)}
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
