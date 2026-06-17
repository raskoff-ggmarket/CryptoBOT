import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { dealsApi } from '@/services/api'
import { toast } from 'sonner'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { formatCurrency, formatPercent, formatDate, isPnlPositive } from '@/utils/formatters'
import { cn } from '@/utils/cn'
import { X, XCircle } from 'lucide-react'

const STATUS_TABS = ['all', 'active', 'completed', 'cancelled']

export default function DealsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('active')

  const { data, isLoading } = useQuery({
    queryKey: ['deals', status],
    queryFn: () => dealsApi.list({ status: status === 'all' ? undefined : status, page_size: 50 }),
    refetchInterval: 10000,
  })

  const closeMut = useMutation({
    mutationFn: (id: number) => dealsApi.close(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deals'] }); toast.success('İşlem kapatıldı') },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const cancelMut = useMutation({
    mutationFn: (id: number) => dealsApi.cancel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deals'] }); toast.success('İşlem iptal edildi') },
  })

  const deals = data?.data?.data || []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('deals.title')}</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setStatus(tab)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              status === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'all' ? 'Tümü' : tab === 'active' ? 'Açık' : tab === 'completed' ? 'Kapalı' : 'İptal'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="mx-auto mt-20" />
      ) : deals.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">İşlem bulunamadı</div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium">Parite</th>
                  <th className="text-right px-4 py-3 font-medium">Ort. Maliyet</th>
                  <th className="text-right px-4 py-3 font-medium">Güncel</th>
                  <th className="text-right px-4 py-3 font-medium">SO</th>
                  <th className="text-right px-4 py-3 font-medium">Harcanan</th>
                  <th className="text-right px-4 py-3 font-medium">K/Z</th>
                  <th className="text-right px-4 py-3 font-medium">Açılış</th>
                  <th className="text-right px-4 py-3 font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal: any) => {
                  const pnl = deal.status === 'active' ? deal.unrealized_pnl_pct : deal.realized_pnl_pct
                  const pnlAmount = deal.status === 'active' ? null : deal.realized_pnl
                  const isPos = isPnlPositive(pnl)
                  return (
                    <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{deal.pair}</div>
                        <div className="text-xs text-muted-foreground">{deal.status}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {deal.average_price ? formatCurrency(deal.average_price, 4) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {deal.current_price ? formatCurrency(deal.current_price, 4) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deal.safety_orders_filled}/{deal.safety_orders_placed || '-'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(deal.total_quote_spent)}
                      </td>
                      <td className={cn('px-4 py-3 text-right tabular-nums font-semibold', isPos ? 'text-profit' : 'text-loss')}>
                        <div>{pnl !== null && pnl !== undefined ? formatPercent(pnl) : '-'}</div>
                        {pnlAmount && <div className="text-xs">{formatCurrency(pnlAmount)}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {formatDate(deal.opened_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deal.status === 'active' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => closeMut.mutate(deal.id)}
                              className="p-1.5 hover:bg-profit/10 text-muted-foreground hover:text-profit rounded transition-colors"
                              title="Kapat"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => cancelMut.mutate(deal.id)}
                              className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors"
                              title="İptal"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
