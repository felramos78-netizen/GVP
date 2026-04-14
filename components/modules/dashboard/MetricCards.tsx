/**
 * components/modules/dashboard/MetricCards.tsx
 * Tarjetas de métricas del dashboard.
 */
import { formatCLP, formatPercent } from '@/lib/utils/formatters'

interface MetricCardsProps {
  income: number
  assigned: number
  free: number
  stockCount: number
  alertCount: number
}

export function MetricCards({ income, assigned, free, stockCount, alertCount }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="metric-card">
        <span className="metric-label">Ingreso mensual</span>
        <span className="metric-value text-gray-900">{formatCLP(income)}</span>
        <span className="metric-sub">Pago el día 5</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Total asignado</span>
        <span className="metric-value text-amber-600">{formatCLP(assigned)}</span>
        <span className="metric-sub">{formatPercent(assigned, income)} del ingreso</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Sin asignar</span>
        <span className="metric-value text-teal-600">{formatCLP(free)}</span>
        <span className="metric-sub">{formatPercent(free, income)} disponible</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Stock</span>
        <span className="metric-value text-blue-600">{stockCount}</span>
        <span className="metric-sub">
          {alertCount > 0
            ? <span className="text-coral-600 font-medium">{alertCount} alertas</span>
            : 'Sin alertas'}
        </span>
      </div>
    </div>
  )
}
