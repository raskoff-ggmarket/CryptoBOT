import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineStyle,
} from 'lightweight-charts'
import { marketApi } from '@/services/api'
import { cn } from '@/utils/cn'

export interface ChartLevel {
  price: number
  color: string
  title: string
  dashed?: boolean
}

interface Props {
  pair: string
  levels?: ChartLevel[]
  className?: string
}

const INTERVALS = ['15m', '1h', '4h', '1d'] as const

export default function CandleChart({ pair, levels = [], className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>('1h')

  const { data, isLoading } = useQuery({
    queryKey: ['klines', pair, interval],
    queryFn: () => marketApi.klines(pair, interval, 300),
    refetchInterval: 30_000,
  })

  // Chart oluşturma / temizleme
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.07)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.07)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.15)' },
      timeScale: { borderColor: 'rgba(148, 163, 184, 0.15)', timeVisible: true },
      autoSize: true,
    })

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    seriesRef.current = series

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      priceLinesRef.current = []
    }
  }, [])

  // Veri güncelleme
  useEffect(() => {
    const series = seriesRef.current
    const rows = data?.data?.data
    if (!series || !rows?.length) return

    series.setData(
      rows.map((k: any) => ({
        time: Math.floor(k.open_time / 1000) as any,
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
      }))
    )
    chartRef.current?.timeScale().fitContent()
  }, [data])

  // Seviye çizgileri (ort. maliyet, TP, SO seviyeleri)
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    priceLinesRef.current.forEach((l) => series.removePriceLine(l))
    priceLinesRef.current = levels
      .filter((l) => l.price > 0)
      .map((l) =>
        series.createPriceLine({
          price: l.price,
          color: l.color,
          lineWidth: 1,
          lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: true,
          title: l.title,
        })
      )
  }, [levels, data])

  return (
    <div className={cn('bg-card border border-border rounded-2xl overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-semibold">{pair} Grafiği</span>
        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                interval === iv
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[380px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Grafik yükleniyor…
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  )
}
