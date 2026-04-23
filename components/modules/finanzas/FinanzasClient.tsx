'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCLP, formatPercent, cn } from '@/lib/utils/formatters'

const ICONOS = ['🏠','🚗','🛒','💊','🐱','📡','🎬','🎵','✂️','🍻','🛡','📚','👕','⚡','🚇','💰','🏦','🌱','🎯','💪','🏥','✈️','🎮','📱','🍕']

type Tab = 'presupuesto' | 'mantencion'

type CenterForm = {
  name: string; icon: string; type: string
  monthly_amount: string; description: string; color: string
}

type MantencionEntry = {
  id: string; nombre: string; monto: number
  supplier_id: string | null
  suppliers?: { id: string; name: string } | null
}

type MantForm = { nombre: string; monto: string; supplier_id: string }

const EMPTY_FORM: CenterForm = {
  name: '', icon: '💰', type: 'variable', monthly_amount: '', description: '', color: '#185FA5',
}

const EMPTY_MANT_FORM: MantForm = { nombre: '', monto: '', supplier_id: '' }

export function FinanzasClient({
  income, payDay, costCenters, budgets, yearMonth,
  mantencionEntries = [], suppliers = [],
}: any) {
  const router = useRouter()
  const supabase = createClient()

  // ── Presupuesto state ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('presupuesto')
  const [centers, setCenters] = useState(costCenters)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CenterForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [calculatingAhorro, setCalculatingAhorro] = useState(false)
  const [ahorroResult, setAhorroResult] = useState<{ total: number; detalle: { name: string; ahorro: number }[] } | null>(null)

  // ── Manutención state ──────────────────────────────────────────────────────
  const [mantenciones, setMantenciones] = useState<MantencionEntry[]>(mantencionEntries)
  const [savingMant, setSavingMant] = useState<string | null>(null)
  const [showMantModal, setShowMantModal] = useState(false)
  const [mantForm, setMantForm] = useState<MantForm>(EMPTY_MANT_FORM)
  const [savingMantModal, setSavingMantModal] = useState(false)
  const [mantError, setMantError] = useState('')

  // ── Computed ───────────────────────────────────────────────────────────────
  const totalAssigned = centers.reduce((s: number, c: any) => s + (c.monthly_amount ?? 0), 0)
  const totalMant = mantenciones.reduce((s, m) => s + (m.monto ?? 0), 0)
  const free = income - totalAssigned
  const budgetMap = new Map(budgets.map((b: any) => [b.cost_center_id, b]))
  const savingsCenter = centers.find((c: any) => c.type === 'ahorro')

  // ── Presupuesto handlers ───────────────────────────────────────────────────
  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setError(''); setShowModal(true) }
  const openEdit = (c: any) => {
    setForm({ name: c.name, icon: c.icon ?? '💰', type: c.type, monthly_amount: String(c.monthly_amount), description: c.description ?? '', color: c.color ?? '#185FA5' })
    setEditingId(c.id); setError(''); setShowModal(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.monthly_amount || isNaN(parseInt(form.monthly_amount))) { setError('El monto debe ser un número'); return }
    setSaving(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    const payload = { name: form.name.trim(), icon: form.icon, type: form.type, monthly_amount: parseInt(form.monthly_amount), description: form.description || null, color: form.color }
    if (editingId) {
      const { data, error: err } = await supabase.from('cost_centers').update(payload).eq('id', editingId).eq('user_id', u?.id ?? '').select().single()
      setSaving(false)
      if (err) { setError('Error al guardar: ' + err.message); return }
      if (data) { setCenters((prev: any) => prev.map((c: any) => c.id === editingId ? { ...c, ...data } : c)); setShowModal(false) }
    } else {
      const { data, error: err } = await supabase.from('cost_centers').insert({ ...payload, user_id: u?.id, sort_order: centers.length, is_active: true }).select().single()
      setSaving(false)
      if (err) { setError('Error al guardar: ' + err.message); return }
      if (data) { setCenters((prev: any) => [...prev, data]); setShowModal(false) }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este centro de costo?')) return
    await supabase.from('cost_centers').update({ is_active: false }).eq('id', id)
    setCenters((prev: any) => prev.filter((c: any) => c.id !== id))
  }

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= centers.length) return
    const updated = [...centers];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]]
    const { data: { user: u } } = await supabase.auth.getUser()
    await Promise.all([
      supabase.from('cost_centers').update({ sort_order: newIdx }).eq('id', updated[newIdx].id).eq('user_id', u?.id ?? ''),
      supabase.from('cost_centers').update({ sort_order: idx }).eq('id', updated[idx].id).eq('user_id', u?.id ?? ''),
    ])
    setCenters(updated.map((c: any, i: number) => ({ ...c, sort_order: i })))
  }

  const handleIncomeUpdate = async (value: number) => {
    const { data: { user: u } } = await supabase.auth.getUser()
    await supabase.from('users').update({ monthly_income: value }).eq('id', u?.id ?? '')
    router.refresh()
  }

  const handleCalcularAhorro = async () => {
    if (!savingsCenter) return
    setCalculatingAhorro(true); setAhorroResult(null)
    const res = await fetch('/api/finanzas/calcular-ahorro', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yearMonth, savingsCenterId: savingsCenter.id }),
    })
    if (res.ok) { setAhorroResult(await res.json()); router.refresh() }
    setCalculatingAhorro(false)
  }

  // ── Manutención handlers ───────────────────────────────────────────────────
  const handleOpenAddMant = () => {
    setMantForm(EMPTY_MANT_FORM)
    setMantError('')
    setShowMantModal(true)
  }

  const handleSaveMantModal = async () => {
    setMantError('')
    if (!mantForm.nombre.trim()) { setMantError('El nombre es obligatorio'); return }
    const monto = parseInt(mantForm.monto)
    if (!mantForm.monto || isNaN(monto) || monto < 0) { setMantError('El monto debe ser un número válido'); return }
    setSavingMantModal(true)
    try {
      const res = await fetch('/api/finanzas/mantencion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', nombre: mantForm.nombre.trim(), monto, supplier_id: mantForm.supplier_id || null }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setMantError(data.error || 'Error al guardar. Intenta nuevamente.'); return }
      if (data.entry) {
        setMantenciones(prev => [...prev, data.entry])
        setShowMantModal(false)
      }
    } catch {
      setMantError('Error de conexión. Intenta nuevamente.')
    } finally {
      setSavingMantModal(false)
    }
  }

  const handleUpdateMant = async (id: string, fields: Partial<MantencionEntry>) => {
    setSavingMant(id)
    try {
      const res = await fetch('/api/finanzas/mantencion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...fields }),
      })
      const data = await res.json()
      if (res.ok && data.entry) {
        setMantenciones(prev => prev.map(m => m.id === id ? { ...m, ...data.entry } : m))
      }
    } catch { /* optimistic local state remains */ }
    setSavingMant(null)
  }

  const handleMantField = (id: string, fields: Partial<MantencionEntry>) =>
    setMantenciones(prev => prev.map(m => m.id === id ? { ...m, ...fields } : m))

  const handleDeleteMant = async (id: string) => {
    if (!confirm('¿Eliminar este abono?')) return
    try {
      const res = await fetch('/api/finanzas/mantencion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      if (res.ok) setMantenciones(prev => prev.filter(m => m.id !== id))
    } catch { /* noop */ }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <span className="metric-label">Ingreso mensual</span>
          <span className="metric-value">{income > 0 ? formatCLP(income) : <span className="text-gray-400 text-sm">Sin configurar</span>}</span>
          <span className="metric-sub">Pago el día {payDay}</span>
          {income === 0 && (
            <button onClick={() => { const v = prompt('Ingresa tu sueldo líquido mensual (CLP):'); if (v && !isNaN(parseInt(v))) handleIncomeUpdate(parseInt(v)) }}
              className="text-xs text-blue-600 underline mt-1">Configurar sueldo</button>
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
          <span className="metric-label">Manutención</span>
          <span className="metric-value text-violet-600">{totalMant > 0 ? formatCLP(totalMant) : <span className="text-gray-400 text-sm">Sin registros</span>}</span>
          <span className="metric-sub">{mantenciones.length} abono{mantenciones.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['presupuesto', 'mantencion'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {t === 'presupuesto' ? 'Presupuesto' : 'Manutención'}
          </button>
        ))}
      </div>

      {/* ── TAB: PRESUPUESTO ─────────────────────────────────────────────────── */}
      {tab === 'presupuesto' && (
        <>
          {/* Banner Ahorros */}
          {savingsCenter && (
            <div className="card bg-teal-50 border border-teal-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
                    <span>{savingsCenter.icon}</span>
                    <span>Centro de Ahorros: {savingsCenter.name}</span>
                  </div>
                  <p className="text-xs text-teal-600 mt-0.5">Al calcular, el presupuesto no consumido se registrará aquí como ahorro.</p>
                  {ahorroResult && (
                    <div className="mt-2 flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-teal-800">Ahorro del mes: {formatCLP(ahorroResult.total)}</span>
                      {ahorroResult.detalle.map((d, i) => (
                        <span key={i} className="text-xs text-teal-600">· {d.name}: {formatCLP(d.ahorro)}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleCalcularAhorro} disabled={calculatingAhorro} className="btn-primary btn-sm whitespace-nowrap flex-shrink-0">
                  {calculatingAhorro ? 'Calculando...' : '💰 Calcular ahorro del mes'}
                </button>
              </div>
            </div>
          )}

          {/* Barra distribución */}
          {income > 0 && centers.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Distribución del ingreso</h2>
                <button onClick={openNew} className="btn-primary btn-sm">+ Nuevo centro</button>
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

          {/* Sin centros */}
          {centers.length === 0 && (
            <div className="card text-center py-10">
              <p className="text-sm text-gray-400 mb-3">Sin centros de costo configurados.</p>
              <button onClick={openNew} className="btn-primary mx-auto">+ Crear primer centro</button>
            </div>
          )}

          {/* Grid de centros */}
          {centers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {centers.map((c: any, idx: number) => {
                const budget = budgetMap.get(c.id)
                const spent = budget?.spent ?? 0
                const isSavings = c.type === 'ahorro'
                const pct = c.monthly_amount > 0 ? Math.min(100, Math.round(spent / c.monthly_amount * 100)) : 0
                const over = !isSavings && spent > c.monthly_amount
                const remaining = c.monthly_amount - spent
                return (
                  <div key={c.id} className={cn('card flex flex-col gap-3', isSavings && 'ring-2 ring-teal-300')}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{c.icon}</span>
                        <div>
                          <div className="font-medium text-sm text-gray-900 flex items-center gap-1">
                            {c.name}
                            {isSavings && <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full">Ahorros</span>}
                          </div>
                          {c.description && <div className="text-xs text-gray-400">{c.description}</div>}
                        </div>
                      </div>
                      <div className="flex gap-1 items-center">
                        <div className="flex flex-col">
                          <button onClick={() => handleMove(idx, -1)} disabled={idx === 0}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs px-0.5">▲</button>
                          <button onClick={() => handleMove(idx, 1)} disabled={idx === centers.length - 1}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs px-0.5">▼</button>
                        </div>
                        <button onClick={() => openEdit(c)} className="text-gray-300 hover:text-blue-500 text-sm px-1">✎</button>
                        <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-500 text-sm px-1">×</button>
                      </div>
                    </div>
                    {isSavings ? (
                      <>
                        <div className="flex justify-between items-baseline">
                          <span className="text-xl font-semibold text-teal-600">{formatCLP(spent)}</span>
                          <span className="text-xs text-gray-400">meta {formatCLP(c.monthly_amount)}</span>
                        </div>
                        <div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all bg-teal-400" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-gray-400">Ahorro acumulado</span>
                            <span className="text-xs text-teal-600 font-medium">{pct}% de meta</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
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
                            {over
                              ? <span className="text-xs text-red-600 font-medium">Sobre presupuesto</span>
                              : <span className="text-xs text-gray-400">Quedan {formatCLP(remaining)}</span>}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
              <button onClick={openNew} className="card border-dashed border-2 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 min-h-[120px] transition-colors">
                <span className="text-3xl mr-2">+</span> Nuevo centro
              </button>
            </div>
          )}
        </>
      )}

      {/* ── TAB: MANUTENCIÓN ─────────────────────────────────────────────────── */}
      {tab === 'mantencion' && (
        <div className="flex flex-col gap-4">

          {/* Resumen */}
          <div className="card bg-violet-50 border border-violet-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-violet-500 font-medium uppercase tracking-wide mb-0.5">Total manutención mensual</div>
                <div className="text-2xl font-bold text-violet-700">{formatCLP(totalMant)}</div>
                <div className="text-xs text-violet-400 mt-0.5">{mantenciones.length} abono{mantenciones.length !== 1 ? 's' : ''} registrado{mantenciones.length !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={handleOpenAddMant} className="btn-primary">
                + Agregar abono
              </button>
            </div>
          </div>

          {/* Lista de abonos */}
          {mantenciones.length === 0 ? (
            <div className="card text-center py-10">
              <div className="text-3xl mb-2">💸</div>
              <p className="text-sm text-gray-400 mb-3">Sin abonos registrados.</p>
              <button onClick={handleOpenAddMant} className="btn-primary mx-auto">+ Agregar primer abono</button>
            </div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {/* Cabecera */}
              <div className="grid grid-cols-[1fr_160px_200px_32px] gap-3 py-2 px-1">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nombre</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Monto mensual</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Proveedor / Pagador</span>
                <span />
              </div>

              {mantenciones.map(entry => {
                const supplierName = entry.suppliers?.name ?? null
                return (
                  <div key={entry.id} className="grid grid-cols-[1fr_160px_200px_32px] gap-3 items-center py-3 px-1">
                    {/* Nombre editable */}
                    <input
                      className="input text-sm"
                      value={entry.nombre}
                      onChange={e => handleMantField(entry.id, { nombre: e.target.value })}
                      onBlur={() => handleUpdateMant(entry.id, { nombre: entry.nombre })}
                      placeholder="Nombre del abono"
                    />

                    {/* Monto editable */}
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">$</span>
                      <input
                        className="input text-sm text-right pl-6"
                        type="number"
                        min="0"
                        value={entry.monto || ''}
                        onChange={e => handleMantField(entry.id, { monto: parseInt(e.target.value) || 0 })}
                        onBlur={() => handleUpdateMant(entry.id, { monto: entry.monto })}
                        placeholder="0"
                      />
                    </div>

                    {/* Proveedor */}
                    <div className="flex items-center gap-1.5">
                      <select
                        className="select text-sm flex-1"
                        value={entry.supplier_id ?? ''}
                        onChange={e => {
                          const sid = e.target.value || null
                          const sup = suppliers.find((s: any) => s.id === sid) ?? null
                          handleMantField(entry.id, { supplier_id: sid, suppliers: sup ? { id: sup.id, name: sup.name } : null })
                          handleUpdateMant(entry.id, { supplier_id: sid })
                        }}
                      >
                        <option value="">Sin proveedor</option>
                        {suppliers.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      {savingMant === entry.id && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0">guardando...</span>
                      )}
                    </div>

                    {/* Eliminar */}
                    <button
                      onClick={() => handleDeleteMant(entry.id)}
                      className="text-gray-300 hover:text-red-500 text-lg leading-none flex-shrink-0 text-center"
                    >×</button>
                  </div>
                )
              })}

              {/* Fila total */}
              <div className="grid grid-cols-[1fr_160px_200px_32px] gap-3 items-center py-3 px-1 bg-violet-50 rounded-b-lg">
                <span className="text-sm font-semibold text-violet-800">Total</span>
                <span className="text-sm font-bold text-violet-800 text-right">{formatCLP(totalMant)}</span>
                <span />
                <span />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal agregar abono de manutención */}
      {showMantModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Nuevo abono de manutención</h3>
            {mantError && <div className="text-red-600 text-sm mb-3 bg-red-50 rounded-lg px-3 py-2">{mantError}</div>}
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" placeholder="Ej: Pensión, arriendo recibido…" value={mantForm.nombre}
                  onChange={e => setMantForm(p => ({ ...p, nombre: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSaveMantModal()} />
              </div>
              <div>
                <label className="label">Monto mensual (CLP) *</label>
                <input className="input" type="number" min="0" placeholder="0" value={mantForm.monto}
                  onChange={e => setMantForm(p => ({ ...p, monto: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSaveMantModal()} />
              </div>
              <div>
                <label className="label">Proveedor / Pagador (opcional)</label>
                <select className="select" value={mantForm.supplier_id}
                  onChange={e => setMantForm(p => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowMantModal(false); setMantError('') }} className="btn">Cancelar</button>
              <button onClick={handleSaveMantModal} disabled={savingMantModal} className="btn-primary">
                {savingMantModal ? 'Guardando...' : 'Agregar abono'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear / editar centro de costo */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {editingId ? 'Editar centro de costo' : 'Nuevo centro de costo'}
            </h3>
            {error && <div className="text-red-600 text-sm mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre *</label>
                  <input className="input" placeholder="Ej: Arriendo" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Tipo *</label>
                  <select className="select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="gasto_fijo">Gasto fijo</option>
                    <option value="variable">Variable</option>
                    <option value="ahorro">Ahorros ✦</option>
                    <option value="meta">Meta / Fondo</option>
                  </select>
                </div>
              </div>
              {form.type === 'ahorro' && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-xs text-teal-700">
                  ✦ Al calcular el ahorro mensual, el presupuesto no consumido de los demás centros se acumulará aquí automáticamente.
                </div>
              )}
              <div>
                <label className="label">Monto mensual (CLP) *</label>
                <input className="input" type="number" placeholder="540000" value={form.monthly_amount}
                  onChange={e => setForm(p => ({ ...p, monthly_amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Ícono</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ICONOS.map(ico => (
                    <button key={ico} type="button" onClick={() => setForm(p => ({ ...p, icon: ico }))}
                      className={cn('text-xl p-1 rounded-lg border-2 transition-all',
                        form.icon === ico ? 'border-gray-900 bg-gray-50' : 'border-transparent hover:border-gray-200'
                      )}>{ico}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Descripción (opcional)</label>
                <input className="input" placeholder="Ej: Depto Ñuñoa" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex gap-2 items-center mt-1">
                  <input type="color" className="h-9 w-16 rounded border border-gray-200 cursor-pointer"
                    value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
                  <span className="text-xs text-gray-400">{form.color}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowModal(false); setError('') }} className="btn">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear centro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
