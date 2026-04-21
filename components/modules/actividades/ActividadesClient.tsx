'use client'
/**
 * components/modules/actividades/ActividadesClient.tsx
 * Módulo de Actividades — tarjetas editables, stock asignable, registro de completado.
 */
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/formatters'

type Frecuencia = 'daily' | 'weekly' | 'biweekly' | 'monthly'
type Tab = 'actividades' | 'historial' | 'nueva'

const FREQ_LABEL: Record<Frecuencia, string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

const FREQ_COLOR: Record<Frecuencia, string> = {
  daily: 'bg-blue-100 text-blue-700',
  weekly: 'bg-green-100 text-green-700',
  biweekly: 'bg-amber-100 text-amber-700',
  monthly: 'bg-purple-100 text-purple-700',
}

const DIAS_SEMANA = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

function diasDesdeHoy(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / 86400000)
}

function calcularProximaFecha(lastDone: string | null, frecuencia: Frecuencia): string {
  const base = lastDone ? new Date(lastDone) : new Date()
  const days = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }
  const next = new Date(base)
  next.setDate(next.getDate() + days[frecuencia])
  return next.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isVencida(lastDone: string | null, frecuencia: Frecuencia): boolean {
  const dias = diasDesdeHoy(lastDone)
  if (dias === null) return true
  const limite = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }
  return dias >= limite[frecuencia]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ActividadesClient({ tasks, recentLogs, aseoStock }: {
  tasks: any[]
  recentLogs: any[]
  aseoStock: any[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('actividades')
  const [editingTask, setEditingTask] = useState<any>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Estado para nueva actividad
  const [nueva, setNueva] = useState({
    name: '',
    frequency: 'weekly' as Frecuencia,
    preferred_day: '',
    duration_min: '',
    products_needed: [] as string[],
  })

  // Últimos registros por tarea (para mostrar "última vez")
  const lastLogByTask = recentLogs.reduce((acc: Record<string, string>, log: any) => {
    if (!acc[log.task_id]) acc[log.task_id] = log.done_at
    return acc
  }, {} as Record<string, string>)

  // Tareas ordenadas: vencidas primero, luego por frecuencia
  const sortedTasks = [...tasks].sort((a, b) => {
    const aVenc = isVencida(lastLogByTask[a.id], a.frequency)
    const bVenc = isVencida(lastLogByTask[b.id], b.frequency)
    if (aVenc && !bVenc) return -1
    if (!aVenc && bVenc) return 1
    return 0
  })

  const handleMarcarHecho = async (taskId: string) => {
    setMarkingId(taskId)
    try {
      const res = await fetch('/api/actividades/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (e) {
      setError('Error al registrar: ' + (e as Error).message)
    } finally {
      setMarkingId(null)
    }
  }

  const handleGuardarEdicion = async () => {
    if (!editingTask) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/actividades/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTask.name,
          frequency: editingTask.frequency,
          preferred_day: editingTask.preferred_day || null,
          duration_min: editingTask.duration_min ? parseInt(editingTask.duration_min) : null,
          products_needed: editingTask.products_needed ?? [],
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setEditingTask(null)
      router.refresh()
    } catch (e) {
      setError('Error al guardar: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleEliminarTask = async (taskId: string) => {
    if (!confirm('¿Eliminar esta actividad?')) return
    try {
      await fetch(`/api/actividades/${taskId}`, { method: 'DELETE' })
      router.refresh()
    } catch (e) {
      setError('Error al eliminar')
    }
  }

  const handleCrearActividad = async () => {
    if (!nueva.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nueva.name.trim(),
          frequency: nueva.frequency,
          preferred_day: nueva.preferred_day || null,
          duration_min: nueva.duration_min ? parseInt(nueva.duration_min) : null,
          products_needed: nueva.products_needed,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setNueva({ name: '', frequency: 'weekly', preferred_day: '', duration_min: '', products_needed: [] })
      setTab('actividades')
      router.refresh()
    } catch (e) {
      setError('Error al crear: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const toggleProductoNecesitado = useCallback((productId: string, isEditing: boolean) => {
    if (isEditing && editingTask) {
      const current: string[] = editingTask.products_needed ?? []
      setEditingTask((prev: any) => ({
        ...prev,
        products_needed: current.includes(productId)
          ? current.filter((id: string) => id !== productId)
          : [...current, productId],
      }))
    } else {
      setNueva(prev => ({
        ...prev,
        products_needed: prev.products_needed.includes(productId)
          ? prev.products_needed.filter(id => id !== productId)
          : [...prev.products_needed, productId],
      }))
    }
  }, [editingTask])

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ['actividades', `Actividades (${sortedTasks.length})`],
          ['historial', 'Historial'],
          ['nueva', '+ Nueva'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === k ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {l}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* ── ACTIVIDADES ── */}
      {tab === 'actividades' && (
        <div className="flex flex-col gap-3">
          {sortedTasks.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-sm text-gray-400 mb-3">Sin actividades configuradas aún.</p>
              <button onClick={() => setTab('nueva')} className="btn">Crear primera actividad</button>
            </div>
          ) : sortedTasks.map((task: any) => {
            const lastDone = lastLogByTask[task.id] ?? null
            const diasAtras = diasDesdeHoy(lastDone)
            const vencida = isVencida(lastDone, task.frequency)
            const proxima = calcularProximaFecha(lastDone, task.frequency)
            const productosAsignados = (aseoStock ?? []).filter((s: any) =>
              (task.products_needed ?? []).includes(s.product_id)
            )
            const isMarking = markingId === task.id

            return (
              <div key={task.id} className={cn(
                'card border transition-all',
                vencida ? 'border-amber-200 bg-amber-50' : 'border-gray-100'
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-gray-900 text-sm">{task.name}</span>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', FREQ_COLOR[task.frequency as Frecuencia])}>
                        {FREQ_LABEL[task.frequency as Frecuencia]}
                      </span>
                      {vencida && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Pendiente
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                      {diasAtras !== null
                        ? <span>Última vez: hace {diasAtras === 0 ? 'hoy' : `${diasAtras} día${diasAtras !== 1 ? 's' : ''}`}</span>
                        : <span className="text-amber-600">Nunca realizada</span>
                      }
                      {!vencida && <span className="text-green-600">Próxima: {proxima}</span>}
                      {task.duration_min && <span>{task.duration_min} min</span>}
                      {task.preferred_day && <span>Día preferido: {task.preferred_day}</span>}
                    </div>
                    {productosAsignados.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {productosAsignados.map((s: any) => (
                          <span key={s.product_id} className={cn(
                            'px-1.5 py-0.5 rounded text-xs',
                            s.current_qty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          )}>
                            {s.products?.name} ({s.current_qty} {s.unit ?? 'u'})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setEditingTask({ ...task })} className="btn btn-sm">Editar</button>
                    <button
                      onClick={() => handleMarcarHecho(task.id)}
                      disabled={isMarking}
                      className={cn('btn btn-sm font-semibold',
                        vencida ? 'bg-green-600 text-white border-green-600 hover:bg-green-700' : ''
                      )}>
                      {isMarking ? '...' : '✓ Hecho'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {tab === 'historial' && (
        <div className="card">
          {recentLogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin registros aún. Marca actividades como hechas para verlas aquí.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentLogs.map((log: any) => {
                const task = tasks.find((t: any) => t.id === log.task_id)
                return (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{task?.name ?? 'Actividad'}</div>
                      {log.notes && <div className="text-xs text-gray-400">{log.notes}</div>}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(log.done_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── NUEVA ACTIVIDAD ── */}
      {tab === 'nueva' && (
        <div className="card max-w-xl">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Nueva actividad</h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="label">Nombre de la actividad *</label>
              <input className="input" placeholder="Ej: Limpiar baño, Pasar aspiradora..."
                value={nueva.name} onChange={e => setNueva(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Frecuencia</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(FREQ_LABEL) as [Frecuencia, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => setNueva(p => ({ ...p, frequency: k }))}
                    className={cn('px-3 py-1.5 rounded-lg text-sm border transition-all',
                      nueva.frequency === k ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Día preferido</label>
                <select className="select" value={nueva.preferred_day}
                  onChange={e => setNueva(p => ({ ...p, preferred_day: e.target.value }))}>
                  <option value="">Cualquier día</option>
                  {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Duración estimada (min)</label>
                <input className="input" type="number" placeholder="30"
                  value={nueva.duration_min} onChange={e => setNueva(p => ({ ...p, duration_min: e.target.value }))} />
              </div>
            </div>

            {aseoStock.length > 0 && (
              <div>
                <label className="label">Productos de stock necesarios</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {aseoStock.map((s: any) => (
                    <button key={s.product_id}
                      onClick={() => toggleProductoNecesitado(s.product_id, false)}
                      className={cn('px-2.5 py-1 rounded-lg text-xs border transition-all',
                        nueva.products_needed.includes(s.product_id)
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}>
                      {s.products?.name} ({s.current_qty})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleCrearActividad} disabled={saving} className="btn-primary mt-2">
              {saving ? 'Creando...' : 'Crear actividad'}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR ── */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-gray-900">Editar actividad</h3>
              <button onClick={() => setEditingTask(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={editingTask.name}
                  onChange={e => setEditingTask((p: any) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Frecuencia</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.entries(FREQ_LABEL) as [Frecuencia, string][]).map(([k, l]) => (
                    <button key={k} onClick={() => setEditingTask((p: any) => ({ ...p, frequency: k }))}
                      className={cn('px-3 py-1.5 rounded-lg text-sm border transition-all',
                        editingTask.frequency === k ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Día preferido</label>
                  <select className="select" value={editingTask.preferred_day ?? ''}
                    onChange={e => setEditingTask((p: any) => ({ ...p, preferred_day: e.target.value }))}>
                    <option value="">Cualquier día</option>
                    {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Duración (min)</label>
                  <input className="input" type="number"
                    value={editingTask.duration_min ?? ''}
                    onChange={e => setEditingTask((p: any) => ({ ...p, duration_min: e.target.value }))} />
                </div>
              </div>

              {aseoStock.length > 0 && (
                <div>
                  <label className="label">Productos necesarios</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {aseoStock.map((s: any) => (
                      <button key={s.product_id}
                        onClick={() => toggleProductoNecesitado(s.product_id, true)}
                        className={cn('px-2.5 py-1 rounded-lg text-xs border transition-all',
                          (editingTask.products_needed ?? []).includes(s.product_id)
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        )}>
                        {s.products?.name} ({s.current_qty})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => handleEliminarTask(editingTask.id)} className="btn text-red-600 border-red-200 hover:bg-red-50">Eliminar</button>
              <button onClick={() => setEditingTask(null)} className="btn flex-1">Cancelar</button>
              <button onClick={handleGuardarEdicion} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
