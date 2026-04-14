'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCLP, formatPercent, cn } from '@/lib/utils/formatters'

const ICONOS = ['🏠','🚗','🛒','💊','🐱','📡','🎬','🎵','✂️','🍻','🛡','📚','👕','⚡','🚇','💰','🏦','🌱','🎯','💪','🏥','✈️','🎮','📱','🍕']

export function FinanzasClient({ income, payDay, costCenters, budgets, yearMonth }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [centers, setCenters] = useState(costCenters)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCenter, setNewCenter] = useState({
    name: '', icon: '💰', type: 'gasto_fijo', monthly_amount: '', description: '', color: '#185FA5'
  })

  const totalAssigned = centers.reduce((s: number, c: any) => s + (c.monthly_amount ?? 0), 0)
  const free = income - totalAssigned
  const budgetMap = new Map(budgets.map((b: any) => [b.cost_center_id, b]))

  const handleAddCenter = async () => {
    setError('')
    if (!newCenter.name.trim()) { setError('El nombre es obligatorio'); return }
    if (!newCenter.monthly_amount || isNaN(parseInt(newCenter.monthly_amount))) { setError('El monto debe ser un número'); return }
    setSaving(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    const { data, error: err } = await supabase.from('cost_centers').insert({
      name: newCenter.name.trim(),
      icon: newCenter.icon,
      type: newCenter.type,
      monthly_amount: parseInt(newCenter.monthly_amount),
      description: newCenter.description || null,
      color: newCenter.color,
      user_id: u?.id,
      sort_order: centers.length,
      is_active: true,
    }).select().single()
    setSaving(false)
    if (err) { setError('Error al guardar: ' + err.message); return }
    if (data) {
      setCenters((prev: any) => [...prev, data])
      setNewCenter({ name: '', icon: '💰', type: 'gasto_fijo', monthly_amount: '', description: '', color: '#185FA5' })
      setShowNew(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este centro de costo?')) return
    await supabase.from('cost_centers').update({ is_active: false }).eq('id', id)
    setCenters((prev: any) => prev.filter((c: any) => c.id !== id))
  }

  const handleIncomeUpdate = async (value: number) => {
    await supabase.from('users').update({ monthly_income: value }).eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <span className="metric-label">Ingreso mensual</span>
          <span className="metric-value">{income > 0 ? formatCLP(income) : <span className="text-gray-400 text-sm">Sin configurar</span>}</span>
          <span className="metric-sub">Pago el día {payDay}</span>
          {income === 0 && (
            <button
              onClick={() => {
                const v = prompt('Ingresa tu sueldo líquido mensual (CLP):')
                if (v && !isNaN(parseInt(v))) handleIncomeUpdate(parseInt(v))
              }}
              className="text-xs text-blue-600 underline mt-1"
            >
              Configurar sueldo
            </button>
          )}
        </div>
        <div className="metric-card">
          <span className="metric-label">Total asignado</span>
          <span className="metric-value text-amber-600">{formatCLP(totalAssigned)}</span>
          <span className="metric-sub">{income > 0 ? formatPercent(totalAssigned, income) : '—'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Sin asignar</span>
          <span className={cn('metric-value', free >= 0 ? 'text-teal-600' : 'text-red-600')}>{formatCLP(Math.abs(free))}</span>
          <span className="metric-sub">{free < 0 ? 'Sobre el ingreso' : 'Disponible'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Centros activos</span>
          <span className="metric-value text-blue-600">{centers.length}</span>
        </div>
      </div>

      {/* Barra distribución */}
      {income > 0 && centers.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Distribución del ingreso</h2>
            <button onClick={() => setShowNew(true)} className="btn-primary btn-sm">+ Nuevo centro</button>
          </div>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5 mb-3">
            {centers.map((c: any) => (
              <div key={c.id} style={{ flex: c.monthly_amount, background: c.color ?? '#888', minWidth: 2 }}
                title={`${c.name}: ${formatCLP(c.monthly_amount)}`} />
            ))}
            {free > 0 && <div style={{ flex: free, background: '#E5E7EB', minWidth: 2 }} title="Sin asignar" />}
          </div>
          <div className="flex flex-wrap gap-3">
            {centers.map((c: any) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                <span className="text-xs text-gray-500">{c.icon} {c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón si no hay centros */}
      {centers.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-sm text-gray-400 mb-3">Sin centros de costo configurados.</p>
          <button onClick={() => setShowNew(true)} className="btn-primary mx-auto">+ Crear primer centro</button>
        </div>
      )}

      {/* Grid de centros */}
      {centers.length > 0 && (
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
                  <div className="flex gap-1 items-center">
                    <span className="badge-neutral text-xs capitalize">{c.type.replace('_', ' ')}</span>
                    <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-500 text-sm ml-1">×</button>
                  </div>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className={cn('text-xl font-semibold', over ? 'text-red-600' : 'text-gray-900')}>{formatCLP(spent)}</span>
                  <span className="text-xs text-gray-400">de {formatCLP(c.monthly_amount)}</span>
                </div>
                <div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? '#DC2626' : c.color }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400">{pct}% utilizado</span>
                    {over && <span className="text-xs text-red-600 font-medium">Sobre presupuesto</span>}
                  </div>
                </div>
              </div>
            )
          })}
          <button onClick={() => setShowNew(true)} className="card border-dashed border-2 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 min-h-[120px] transition-colors">
            <span className="text-3xl mr-2">+</span> Nuevo centro
          </button>
        </div>
      )}

      {/* Modal nuevo centro */}
      {showNew && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Nuevo centro de costo</h3>
            {error && <div className="text-red-600 text-sm mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre *</label>
                  <input className="input" placeholder="Ej: Arriendo" value={newCenter.name}
                    onChange={e => setNewCenter(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Tipo *</label>
                  <select className="select" value={newCenter.type}
                    onChange={e => setNewCenter(p => ({ ...p, type: e.target.value }))}>
                    <option value="gasto_fijo">Gasto fijo</option>
                    <option value="variable">Variable</option>
                    <option value="ahorro">Ahorro</option>
                    <option value="meta">Meta / Fondo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Monto mensual (CLP) *</label>
                <input className="input" type="number" placeholder="540000" value={newCenter.monthly_amount}
                  onChange={e => setNewCenter(p => ({ ...p, monthly_amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Ícono</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ICONOS.map(ico => (
                    <button key={ico} type="button"
                      onClick={() => setNewCenter(p => ({ ...p, icon: ico }))}
                      className={cn('text-xl p-1 rounded-lg border-2 transition-all',
                        newCenter.icon === ico ? 'border-gray-900 bg-gray-50' : 'border-transparent hover:border-gray-200'
                      )}>
                      {ico}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Descripción (opcional)</label>
                <input className="input" placeholder="Ej: Depto Ñuñoa" value={newCenter.description}
                  onChange={e => setNewCenter(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex gap-2 items-center mt-1">
                  <input type="color" className="h-9 w-16 rounded border border-gray-200 cursor-pointer"
                    value={newCenter.color} onChange={e => setNewCenter(p => ({ ...p, color: e.target.value }))} />
                  <span className="text-xs text-gray-400">{newCenter.color}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowNew(false); setError('') }} className="btn">Cancelar</button>
              <button onClick={handleAddCenter} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Crear centro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
