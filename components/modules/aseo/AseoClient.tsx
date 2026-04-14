'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/formatters'

const FREQ_LABELS: Record<string, string> = {
  daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual',
}
const FREQ_COLORS: Record<string, string> = {
  daily: 'bg-red-50 text-red-700', weekly: 'bg-blue-50 text-blue-700',
  biweekly: 'bg-amber-50 text-amber-700', monthly: 'bg-purple-50 text-purple-700',
}
const DIAS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
const CATEGORIAS = ['Aseo','Ejercicio','Ocio / Panorama','Salud','Trámite','Otro']

export function AseoClient({ tasks: initialTasks, recentLogs, aseoStock }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState(initialTasks)
  const [activeTab, setActiveTab] = useState<'tareas'|'historial'|'nueva'>('tareas')
  const [completing, setCompleting] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newTask, setNewTask] = useState({
    name: '', frequency: 'weekly', preferred_day: 'sábado',
    duration_min: '', categoria: 'Aseo',
  })

  const lastDoneMap = new Map<string, string>()
  for (const log of recentLogs) {
    if (!lastDoneMap.has(log.task_id)) lastDoneMap.set(log.task_id, log.done_at)
  }

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId)
    const { data: { user: ul } } = await supabase.auth.getUser()
    await supabase.from('task_log').insert({
      task_id: taskId,
      user_id: ul?.id,
      done_at: new Date().toISOString().split('T')[0],
    })
    setCompleting(null)
    router.refresh()
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!newTask.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    const { data, error: err } = await supabase.from('cleaning_tasks').insert({
      name: newTask.name.trim(),
      frequency: newTask.frequency,
      preferred_day: newTask.preferred_day,
      duration_min: newTask.duration_min ? parseInt(newTask.duration_min) : null,
      user_id: u?.id,
      products_needed: [],
      is_active: true,
    }).select().single()
    setSaving(false)
    if (err) { setError('Error: ' + err.message); return }
    if (data) {
      setTasks((prev: any) => [...prev, data])
      setNewTask({ name: '', frequency: 'weekly', preferred_day: 'sábado', duration_min: '', categoria: 'Aseo' })
      setActiveTab('tareas')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta actividad?')) return
    await supabase.from('cleaning_tasks').update({ is_active: false }).eq('id', id)
    setTasks((prev: any) => prev.filter((t: any) => t.id !== id))
  }

  const tabs = [
    { key: 'tareas', label: `Actividades (${tasks.length})` },
    { key: 'historial', label: 'Historial' },
    { key: 'nueva', label: '+ Nueva actividad' },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['daily','weekly','biweekly','monthly'] as const).map(freq => (
          <div key={freq} className="metric-card">
            <span className="metric-label">{FREQ_LABELS[freq]}s</span>
            <span className="metric-value text-gray-900">{tasks.filter((t: any) => t.frequency === freq).length}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ACTIVIDADES */}
      {activeTab === 'tareas' && (
        <div className="flex flex-col gap-3">
          {tasks.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-sm text-gray-400">Sin actividades configuradas.</p>
              <button onClick={() => setActiveTab('nueva')} className="btn mt-3 mx-auto">+ Crear primera actividad</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tasks.map((task: any) => {
                const lastDone = lastDoneMap.get(task.id)
                return (
                  <div key={task.id} className="card flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm text-gray-900">{task.name}</div>
                        {task.preferred_day && (
                          <div className="text-xs text-gray-400 mt-0.5">Preferido: {task.preferred_day}</div>
                        )}
                      </div>
                      <div className="flex gap-1 items-center">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', FREQ_COLORS[task.frequency] ?? 'bg-gray-100 text-gray-600')}>
                          {FREQ_LABELS[task.frequency] ?? task.frequency}
                        </span>
                        <button onClick={() => handleDelete(task.id)} className="text-gray-300 hover:text-red-500 ml-1">×</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{task.duration_min ? `${task.duration_min} min` : 'Sin duración'}</span>
                      <span>{lastDone ? `Última: ${lastDone}` : 'Sin registros'}</span>
                    </div>
                    <button
                      onClick={() => handleComplete(task.id)}
                      disabled={completing === task.id}
                      className="btn w-full text-sm"
                    >
                      {completing === task.id ? 'Registrando...' : '✓ Marcar realizada'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {activeTab === 'historial' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Últimas 30 actividades realizadas</h3>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin historial aún.</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {recentLogs.map((log: any) => {
                const task = tasks.find((t: any) => t.id === log.task_id)
                return (
                  <div key={log.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{task?.name ?? 'Actividad eliminada'}</span>
                    <span className="text-xs text-gray-400">{log.done_at}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* NUEVA ACTIVIDAD */}
      {activeTab === 'nueva' && (
        <div className="card max-w-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Nueva actividad</h3>
          {error && <div className="text-red-600 text-sm mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <form onSubmit={handleCreateTask} className="flex flex-col gap-4">
            <div>
              <label className="label">Nombre de la actividad *</label>
              <input className="input" placeholder="Ej: Limpiar baños"
                value={newTask.name} onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Categoría</label>
                <select className="select" value={newTask.categoria}
                  onChange={e => setNewTask(p => ({ ...p, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Frecuencia</label>
                <select className="select" value={newTask.frequency}
                  onChange={e => setNewTask(p => ({ ...p, frequency: e.target.value }))}>
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
              <div>
                <label className="label">Día preferido</label>
                <select className="select" value={newTask.preferred_day}
                  onChange={e => setNewTask(p => ({ ...p, preferred_day: e.target.value }))}>
                  {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Duración estimada (min)</label>
                <input className="input" type="number" placeholder="60"
                  value={newTask.duration_min} onChange={e => setNewTask(p => ({ ...p, duration_min: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setActiveTab('tareas')} className="btn flex-1">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Guardando...' : 'Crear actividad'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
