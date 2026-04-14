'use client'
/**
 * components/modules/productos/PriceHistoryChart.tsx
 * Tabla + sparkline del historial de precios por proveedor.
 */
import { formatCLP, formatDateShort } from '@/lib/utils/formatters'

interface PriceEntry {
  id: string
  price_clp: number
  recorded_at: string
  source: string
  is_on_sale: boolean
  suppliers?: { name: string }
}

interface PriceHistoryChartProps {
  priceHistory: PriceEntry[]
}

const SUPPLIER_COLORS: Record<string, string> = {
  'Líder':  '#D85A30',
  'Tottus': '#BA7517',
  'Jumbo':  '#185FA5',
  'Feria':  '#1D9E75',
}

export function PriceHistoryChart({ priceHistory }: PriceHistoryChartProps) {
  if (priceHistory.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        Sin historial de precios. Usa "Buscar precios" para obtener datos actuales.
      </p>
    )
  }

  // Agrupar por proveedor para el sparkline
  const bySupplier = priceHistory.reduce((acc, entry) => {
    const name = entry.suppliers?.name ?? 'Desconocido'
    if (!acc[name]) acc[name] = []
    acc[name].push(entry)
    return acc
  }, {} as Record<string, PriceEntry[]>)

  // Ordenar cada proveedor por fecha
  Object.values(bySupplier).forEach(entries =>
    entries.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
  )

  // Sparkline SVG por proveedor
  const renderSparkline = (entries: PriceEntry[], color: string) => {
    if (entries.length < 2) return null
    const prices = entries.map(e => e.price_clp)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1
    const w = 120, h = 32, pad = 4

    const points = prices.map((p, i) => {
      const x = pad + (i / (prices.length - 1)) * (w - pad * 2)
      const y = h - pad - ((p - min) / range) * (h - pad * 2)
      return `${x},${y}`
    }).join(' ')

    return (
      <svg width={w} height={h} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Punto final */}
        {(() => {
          const last = points.split(' ').pop()!.split(',')
          return <circle cx={parseFloat(last[0])} cy={parseFloat(last[1])} r="3" fill={color} />
        })()}
      </svg>
    )
  }

  const lastFive = [...priceHistory]
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .slice(0, 10)

  return (
    <div className="flex flex-col gap-4">
      {/* Sparklines por proveedor */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(bySupplier).map(([name, entries]) => {
          const color = SUPPLIER_COLORS[name] ?? '#888'
          const latest = entries[entries.length - 1]
          const prev = entries[entries.length - 2]
          const trend = prev
            ? latest.price_clp > prev.price_clp ? '↑' : latest.price_clp < prev.price_clp ? '↓' : '→'
            : '—'
          const trendColor = trend === '↑' ? 'text-coral-600' : trend === '↓' ? 'text-teal-600' : 'text-gray-400'

          return (
            <div key={name} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">{name}</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold" style={{ color }}>
                    {formatCLP(latest.price_clp)}
                  </span>
                  <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
                </div>
              </div>
              {renderSparkline(entries, color)}
            </div>
          )
        })}
      </div>

      {/* Tabla de historial */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Precio</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          {lastFive.map(entry => {
            const color = SUPPLIER_COLORS[entry.suppliers?.name ?? ''] ?? '#888'
            return (
              <tr key={entry.id}>
                <td className="text-gray-500">{formatDateShort(entry.recorded_at)}</td>
                <td>
                  <span className="text-xs font-medium" style={{ color }}>
                    {entry.suppliers?.name ?? '—'}
                  </span>
                </td>
                <td className="font-medium">
                  {formatCLP(entry.price_clp)}
                  {entry.is_on_sale && (
                    <span className="ml-1 badge-ok text-xs">Oferta</span>
                  )}
                </td>
                <td>
                  <span className="badge-neutral capitalize">{entry.source}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
