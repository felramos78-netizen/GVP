'use client'
/**
 * components/modules/dashboard/CostDashboard.tsx
 * Visión cruzada mensual de costos: centros de costo, mantención y compras reales.
 */
import { useState, useMemo } from 'react'
import { formatCLP } from '@/lib/utils/formatters'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { cn } from '@/lib/utils/formatters'

interface CostCenter {
  id: string
  name: string
  icon: string | null
  type: string
  monthly_amount: number
}

interface Purchase {
  id: string
  purchased_at: string | null
  total_clp: number | null
  cost_center_id: string | null
  suppliers: { name: string } | null
}

interface BankTx {
  id: string
  transaction_date: string
  amount: number
  description: string
  cost_center_id: string | null
  supplier_id: string | null
  is_expense: boolean
}

interface MantencionEntry {
  id: string
  nombre: string
  monto: number
  activo: boolean
}

interface Props {
  costCenters: CostCenter[]
  purchases: Purchase[]
  bankTxs: BankTx[]
  mantencion: MantencionEntry[]
  income: number
}

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function isoToYM(dateStr: string | null): string {
  if (!dateStr) return ''
  return dateStr.slice(0, 7) // "YYYY-MM"
}

export function CostDashboard({ costCenters, purchases, bankTxs, mantencion, income }: Props) {
  const now = new Date()
  const [selectedYM, setSelectedYM] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  // Generar últimos 6 meses para el selector
  const months = useMemo(() => {
    const result: { ym: string; label: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      result.push({ ym, label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` })
    }
    return result
  }, [])

  // Filtrar compras del mes seleccionado
  const purchasesThisMonth = useMemo(
    () => purchases.filter(p => isoToYM(p.purchased_at) === selectedYM),
    [purchases, selectedYM]
  )

  // Filtrar transacciones bancarias del mes seleccionado (solo gastos)
  const bankThisMonth = useMemo(
    () => bankTxs.filter(t => isoToYM(t.transaction_date) === selectedYM && t.is_expense),
    [bankTxs, selectedYM]
  )

  // Total mantención mensual (siempre es el mismo, es fijo)
  const totalMantencion = useMemo(
    () => mantencion.filter(m => m.activo).reduce((s, m) => s + m.monto, 0),
    [mantencion]
  )

  // Total centros de costo presupuestados
  const totalBudgeted = useMemo(
    () => costCenters.reduce((s, c) => s + c.monthly_amount, 0),
    [costCenters]
  )

  // Gastos reales desde compras
  const totalCompras = useMemo(
    () => purchasesThisMonth.reduce((s, p) => s + (p.total_clp ?? 0), 0),
    [purchasesThisMonth]
  )

  // Gastos reales desde banco
  const totalBanco = useMemo(
    () => bankThisMonth.reduce((s, t) => s + Math.abs(t.amount), 0),
    [bankThisMonth]
  )

  // Agrupar compras por centro de costo
  const comprasPorCentro = useMemo(() => {
    const map: Record<string, number> = {}
    purchasesThisMonth.forEach(p => {
      const key = p.cost_center_id ?? '_sin_asignar'
      map[key] = (map[key] ?? 0) + (p.total_clp ?? 0)
    })
    return map
  }, [purchasesThisMonth])

  // Agrupar banco por centro de costo
  const bancoPorCentro = useMemo(() => {
    const map: Record<string, number> = {}
    bankThisMonth.forEach(t => {
      const key = t.cost_center_id ?? '_sin_asignar'
      map[key] = (map[key] ?? 0) + Math.abs(t.amount)
    })
    return map
  }, [bankThisMonth])

  // Datos para el gráfico de barras
  const chartData = useMemo(() => {
    const rows = costCenters.map(c => ({
      name: c.icon ? `${c.icon} ${c.name}` : c.name,
      presupuestado: c.monthly_amount,
      real: (comprasPorCentro[c.id] ?? 0) + (bancoPorCentro[c.id] ?? 0),
    }))
    const sinAsignar = (comprasPorCentro['_sin_asignar'] ?? 0) + (bancoPorCentro['_sin_asignar'] ?? 0)
    if (sinAsignar > 0) rows.push({ name: 'Sin asignar', presupuestado: 0, real: sinAsignar })
    return rows
  }, [costCenters, comprasPorCentro, bancoPorCentro])

  const selectedMonthLabel = months.find(m => m.ym === selectedYM)?.label ?? selectedYM

  return (
    <div className="flex flex-col gap-5">
      {/* Selector de mes */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-700">Mes:</span>
        <div className="flex gap-1 flex-wrap">
          {months.map(m => (
            <button key={m.ym} onClick={() => setSelectedYM(m.ym)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-all',
                selectedYM === m.ym
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-100'
              )}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas de resumen cruzado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="metric-card border-l-4 border-blue-400">
          <span className="metric-label">Presupuestado</span>
          <span className="metric-value text-blue-700">{formatCLP(totalBudgeted)}</span>
          <span className="metric-sub">Centros de costo</span>
        </div>
        <div className="metric-card border-l-4 border-amber-400">
          <span className="metric-label">Compras registradas</span>
          <span className="metric-value text-amber-700">{formatCLP(totalCompras)}</span>
          <span className="metric-sub">{purchasesThisMonth.length} órdenes · {selectedMonthLabel}</span>
        </div>
        <div className="metric-card border-l-4 border-teal-400">
          <span className="metric-label">Movimientos banco</span>
          <span className="metric-value text-teal-700">{formatCLP(totalBanco)}</span>
          <span className="metric-sub">{bankThisMonth.length} transacciones</span>
        </div>
        <div className="metric-card border-l-4 border-purple-400">
          <span className="metric-label">Mantención mensual</span>
          <span className="metric-value text-purple-700">{formatCLP(totalMantencion)}</span>
          <span className="metric-sub">{mantencion.filter(m => m.activo).length} ítems activos</span>
        </div>
      </div>

      {/* Gráfico presupuesto vs real */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Presupuesto vs. Gasto real — {selectedMonthLabel}</h3>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 inline-block" />Presupuestado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" />Real</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={48} />
              <Tooltip formatter={(v: number) => formatCLP(v)} />
              <Bar dataKey="presupuestado" fill="#bfdbfe" radius={[3,3,0,0]} />
              <Bar dataKey="real" radius={[3,3,0,0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.real > entry.presupuestado ? '#f59e0b' : '#34d399'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla detalle por centro de costo */}
      {costCenters.length > 0 && (
        <div className="card overflow-x-auto">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Detalle por centro de costo</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Centro</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Presupuesto</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Compras</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Banco</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Total real</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {costCenters.map(c => {
                const comp = comprasPorCentro[c.id] ?? 0
                const banco = bancoPorCentro[c.id] ?? 0
                const real = comp + banco
                const saldo = c.monthly_amount - real
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-2 font-medium text-gray-800">
                      {c.icon} {c.name}
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-600">{formatCLP(c.monthly_amount)}</td>
                    <td className="py-2.5 px-2 text-right text-amber-600">{comp > 0 ? formatCLP(comp) : '—'}</td>
                    <td className="py-2.5 px-2 text-right text-teal-600">{banco > 0 ? formatCLP(banco) : '—'}</td>
                    <td className="py-2.5 px-2 text-right font-medium">{real > 0 ? formatCLP(real) : '—'}</td>
                    <td className={cn('py-2.5 px-2 text-right font-semibold',
                      saldo >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {c.monthly_amount > 0 ? formatCLP(saldo) : '—'}
                    </td>
                  </tr>
                )
              })}
              {/* Mantención */}
              {totalMantencion > 0 && (
                <tr className="border-b border-gray-50 bg-purple-50/50">
                  <td className="py-2.5 px-2 font-medium text-purple-800">🔧 Mantención</td>
                  <td className="py-2.5 px-2 text-right text-gray-600">{formatCLP(totalMantencion)}</td>
                  <td className="py-2.5 px-2 text-right text-gray-400">—</td>
                  <td className="py-2.5 px-2 text-right text-gray-400">—</td>
                  <td className="py-2.5 px-2 text-right font-medium text-purple-700">{formatCLP(totalMantencion)}</td>
                  <td className="py-2.5 px-2 text-right">—</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="py-2.5 px-2 font-semibold text-gray-900">TOTAL</td>
                <td className="py-2.5 px-2 text-right font-semibold">{formatCLP(totalBudgeted + totalMantencion)}</td>
                <td className="py-2.5 px-2 text-right font-semibold text-amber-700">{formatCLP(totalCompras)}</td>
                <td className="py-2.5 px-2 text-right font-semibold text-teal-700">{formatCLP(totalBanco)}</td>
                <td className="py-2.5 px-2 text-right font-semibold">{formatCLP(totalCompras + totalBanco + totalMantencion)}</td>
                <td className={cn('py-2.5 px-2 text-right font-semibold',
                  income - totalCompras - totalBanco - totalMantencion >= 0 ? 'text-green-700' : 'text-red-700'
                )}>
                  {income > 0 ? formatCLP(income - totalCompras - totalBanco - totalMantencion) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Lista mantención */}
      {mantencion.filter(m => m.activo).length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">🔧 Ítems de mantención mensual</h3>
          <div className="flex flex-col gap-1.5">
            {mantencion.filter(m => m.activo).map(m => (
              <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{m.nombre}</span>
                <span className="text-sm font-medium text-purple-700">{formatCLP(m.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
