'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCLP, formatPercent, cn } from '@/lib/utils/formatters'

export function FinanzasClient({ income, payDay, costCenters, budgets, yearMonth }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [centers, setCenters] = useState(costCenters)
  const [showNew, setShowNew] = useState(false)
  const [newCenter, setNewCenter] = useState({ name: '', icon: '💰', type: 'variable', monthly_amount: '', description: '', color: '#185FA5' })

  const totalAssigned = centers.reduce((s: number, c: any) => s + c.monthly_amount, 0)
  const free = income - totalAssigned

  // Mapa de ejecución presupuestaria
  const budgetMap = new Map(budgets.map((b: any) => [b.cost_center_id, b]))

  const handleAddCenter = async () => {
    if (!newCenter.name || !newCenter.monthly_amount) return
    const { data, error } = await supabase.from('cost_centers').insert({
      name: newCenter.name, icon: newCenter.icon,
      type: newCenter.type, monthly_amount: parseInt(newCenter.monthly_amount),
      description: newCenter.description, color: newCenter.color,
      sort_order: centers.length, is_active: true,
    }).select().single()
    if (!error && data) {
      setCenters((prev: any) => [...prev, data])
      setNewCenter({ name: '', icon: '💰', type: 'variable', monthly_amount: '', description: '', color: '#185FA5' })
      setShowNew(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este centro de costo?')) return
    await supabase.from('cost_centers').update({ is_active: false }).eq('id', id)
    setCenters((prev: any) => prev.filter((c: any) => c.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <span className="metric-label">Ingreso mensual</span>
          <span className="metric-value">{formatCLP(income)}</span>
          <span className="metric-sub">Pago el día {payDay}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total asignado</span>
          <span className="metric-value text-amber-600">{formatCLP(totalAssigned)}</span>
          <span className="metric-sub">{formatPercent(totalAssigned, income)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Sin asignar</span>
          <span className={cn('metric-value', free >= 0 ? 'text-teal-600' : 'text-coral-600')}>{formatCLP(Math.abs(free))}</span>
          <span className="metric-sub">{free < 0 ? 'Sobre el ingreso' : 'Disponible'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Centros activos</span>
          <span className="metric-value text-blue-600">{centers.length}</span>
        </div>
      </div>

      {/* Barra de distribución */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Distribución del ingreso</h2>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm">+ Nuevo centro</button>
        </div>
        <div className="flex h-4 rounded-full overflow-hidden gap-0.5 mb-3">
          {centers.map((c: any) => (
            <div
              key={c.id}
              style={{ flex: c.monthly_amount, background: c.color ?? '#888', minWidth: 2 }}
              title={`${c.name}: ${formatCLP(c.monthly_amount)}`}
            />
          ))}
          {free > 0 && <div style={{ flex: free, background: '#E5E7EB', minWidth: 2 }} title="Sin asignar" />}
        </div>
        <div className="flex flex-wrap gap-3">
          {centers.map((c: any) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
              <span className="text-xs text-gray-500">{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid de centros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {centers.map((c: any) => {
          const budget = budgetMap.get(c.id)
          const spent = budget?.spent ?? 0
          const pct = c.monthly_amount > 0 ? Math.min(100, Math.round(spent / c.monthly_amount * 100)) : 0
          const over = spent > c.monthly_amount

          return (
            <div key={c.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <div className="font-medium text-sm text-gray-900">{c.name}</div>
                    {c.description && <div className="text-xs text-gray-400">{c.description}</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <span className="badge-neutral text-xs capitalize">{c.type.replace('_', ' ')}</span>
                  <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-coral-500 text-sm ml-1">×</button>
                </div>
              </div>
              <div className="flex justify-between items-baseline">
                <span className={cn('text-xl font-semibold', over ? 'text-coral-600' : 'text-gray-900')}>
                  {formatCLP(spent)}
                </span>
                <span className="text-xs text-gray-400">de {formatCLP(c.monthly_amount)}</span>
              </div>
              <div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: over ? '#D85A30' : c.color }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">{pct}% utilizado</span>
                  {over && <span className="text-xs text-coral-600 font-medium">Sobre presupuesto</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal nuevo centro */}
      {showNew && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Nuevo centro de costo</h3>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre *</label>
                  <input className="input" placeholder="Ej: Fondo viaje" value={newCenter.name} onChange={e => setNewCenter(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Ícono</label>
                  <input className="input" placeholder="💰" value={newCenter.icon} onChange={e => setNewCenter(p => ({ ...p, icon: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select className="select" value={newCenter.type} onChange={e => setNewCenter(p => ({ ...p, type: e.target.value }))}>
                    <option value="gasto_fijo">Gasto fijo</option>
                    <option value="variable">Variable</option>
                    <option value="ahorro">Ahorro</option>
                    <option value="meta">Meta / Fondo</option>
                  </select>
                </div>
                <div>
                  <label className="label">Monto mensual ($) *</label>
                  <input className="input" type="number" placeholder="0" value={newCenter.monthly_amount} onChange={e => setNewCenter(p => ({ ...p, monthly_amount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Descripción</label>
                <input className="input" placeholder="Opcional" value={newCenter.description} onChange={e => setNewCenter(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Color</label>
                <input type="color" className="h-9 w-full rounded-lg border border-gray-200 cursor-pointer" value={newCenter.color} onChange={e => setNewCenter(p => ({ ...p, color: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowNew(false)} className="btn">Cancelar</button>
              <button onClick={handleAddCenter} className="btn-primary">Crear centro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
