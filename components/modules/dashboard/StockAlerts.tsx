/**
 * components/modules/dashboard/StockAlerts.tsx
 * Panel de alertas de stock bajo en el dashboard.
 */
import Link from 'next/link'
import { formatQty } from '@/lib/utils/formatters'

interface StockAlertsProps {
  alerts: any[]
}

export function StockAlerts({ alerts }: StockAlertsProps) {
  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Alertas de stock</h2>
        <Link href="/stock" className="text-xs text-blue-600 hover:underline">
          Ver todo
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Stock en buen nivel</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((alert: any) => {
            const pct = alert.min_qty > 0
              ? Math.round((alert.current_qty / (alert.min_qty * 2)) * 100)
              : 100
            const isCritical = pct < 30

            return (
              <div
                key={alert.id}
                className={`rounded-lg p-3 border ${isCritical
                  ? 'bg-coral-50 border-coral-200'
                  : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-800">
                      {alert.products?.name ?? 'Producto'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatQty(alert.current_qty, alert.unit ?? '')} disponibles
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    isCritical ? 'badge-critical' : 'badge-warning'
                  }`}>
                    {isCritical ? 'Crítico' : 'Bajo'}
                  </span>
                </div>
                {/* Barra de nivel */}
                <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isCritical ? 'bg-coral-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
