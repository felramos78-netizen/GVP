'use client'
/**
 * components/modules/aseo/AseoClient.tsx
 * Gestión de actividades de aseo con registro, frecuencias y productos.
 */
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatDateShort, formatRelative, cn } from '@/lib/utils/formatters'

const FREQ_LABELS: Record<string, string> = {
  daily:    'Diario',
  weekly:   'Semanal',
  biweekly: 'Quincenal',
  monthly:  'Mensual',
}

const FREQ_COLORS: Record<string, string> = {
  daily:    'bg-coral-50 text-coral-800',
  weekly:   'bg-blue-50 text-blue-800',
  biweekly: 'bg-amber-50 text-amber-800',
  monthly:  'bg-purple-50 text-purple-800',
}

export function AseoClient({ tasks, recentLogs, aseoStock }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'tareas' | 'historial' | 'nueva'>('tareas')
  const [completing, setCompleting] = useState<string | null>(null)
  const [newTask, setNewTask] = useState({
    name: '', frequency: 'weekly', preferred_day: 'sabado',
    duration_min: '', products_needed: [] as string[],
  })

  // Índice de última vez realizada
  const lastDoneMap = new Map<string, string>()
  for (const log of recentLogs) {
    if (!lastDoneMap.has(log.task_id)) lastDoneMap.set(log.task_id, log.done_at)
  }

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId)
    const { error } = await supabase.from('task_log').insert({
      task_id: taskId,
      done_at: new Date().toISOString().split('T')[0],
    })
    if (!error) {
      router.refresh()
    }
    setCompleting(null)
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('cleaning_tasks').insert({
      name: newTask.name,
      frequency: newTask.frequency,
      preferred_day: newTask.preferred_day,
      duration_min: newTask.duration_min ? parseInt(newTask.duration_min) : null,
      products_needed: newTask.products_needed,
      is_active: true,
    })
    if (!error) {
      setNewTask({ name: '', frequency: 'weekly', preferred_day: 'sabado', duration_min: '', products_needed: [] })
      setActiveTab('tareas')
      router.refresh()
    }
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
        {[
          ['Diarias', tasks.filter((t: any) => t.frequency === 'daily').length],
          ['Semanales', tasks.filter((t: any) => t.frequency === 'weekly').length],
          ['Quincenales', tasks.filter((t: any) => t.frequency === 'biweekly').length],
          ['Mensuales', tasks.filter((t: any) => t.frequency === 'monthly').length],
        ].map(([label, count]) => (
          <div key={label as string} className="metric-card">
            <span className="metric-label">{label}</span>
            <span className="metric-value text-gray-900">{count}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAREAS */}
      {activeTab === 'tareas' && (
        <div className="flex flex-col gap-3">
          {tasks.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-sm text-gray-400">Sin actividades de aseo configuradas.</p>
              <button onClick={() => setActiveTab('nueva')} className="btn mt-3 mx-auto">
                + Crear primera actividad
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tasks.map((task: any) => {
                const lastDone = lastDoneMap.get(task.id)
                const products = Array.isArray(task.products_needed) ? task.products_needed : []
                const isCompleting = completing === task.id

                return (
                  <div key={task.id} className="card flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <h3 className="text-sm font-semibold text-gray-900 leading-tight">{task.name}</h3>
                        {task.preferred_day && (
                          <p className="text-xs text-gray-400 mt-0.5 capitalize">{task.preferred_day}</p>
                        )}
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium flex-shrink-0',
                        FREQ_COLORS[task.frequency] ?? 'bg-gray-100 text-gray-600'
                      )}>
                        {FREQ_LABELS[task.frequency] ?? task.frequency}
                      </span>
                    </div>

                    {products.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {products.map((p: any) => (
                          <span key={typeof p === 'string' ? p : p.name} className="badge-neutral text-xs">
                            {typeof p === 'string' ? p : p.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <div className="text-xs text-gray-400">
                        {lastDone
                          ? <>Última vez: {formatRelative(lastDone)}</>
                          : 'Sin registros aún'}
                      </div>
                      <button
                        onClick={() => handleComplete(task.id)}
                        disabled={isCompleting}
                        className="btn-success btn-sm"
                      >
                        {isCompleting ? '...' : '✓ Marcar hecho'}
                      </button>
                    </div>

                    {task.duration_min && (
                      <div className="text-xs text-gray-400">
                        Duración estimada: {task.duration_min} min
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {activeTab === 'historial' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Fecha realizada</th>
                <th>Duración</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400">
                    Sin registros de actividades aún.
                  </td>
                </tr>
              ) : recentLogs.map((log: any) => {
                const task = tasks.find((t: any) => t.id === log.task_id)
                return (
                  <tr key={log.id}>
                    <td className="font-medium">{task?.name ?? 'Actividad eliminada'}</td>
                    <td className="text-gray-600">{formatDateShort(log.done_at)}</td>
                    <td className="text-gray-500">{log.duration_min ? `${log.duration_min} min` : '—'}</td>
                    <td className="text-gray-400 text-sm">{log.notes ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* NUEVA TAREA */}
      {activeTab === 'nueva' && (
        <div className="card max-w-lg">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Nueva actividad de aseo</h2>
          <form onSubmit={handleCreateTask} className="flex flex-col gap-4">
            <div>
              <label className="label">Nombre de la actividad *</label>
              <input
                className="input" required
                placeholder="Ej: Limpiar baños"
                value={newTask.name}
                onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Frecuencia</label>
                <select
                  className="select"
                  value={newTask.frequency}
                  onChange={e => setNewTask(p => ({ ...p, frequency: e.target.value }))}
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
              <div>
                <label className="label">Día preferido</label>
                <select
                  className="select"
                  value={newTask.preferred_day}
                  onChange={e => setNewTask(p => ({ ...p, preferred_day: e.target.value }))}
                >
                  {['lunes','martes','miércoles','jueves','viernes','sábado','domingo'].map(d => (
                    <option key={d} value={d} className="capitalize">{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Duración estimada (minutos)</label>
              <input
                className="input" type="number"
                placeholder="30"
                value={newTask.duration_min}
                onChange={e => setNewTask(p => ({ ...p, duration_min: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setActiveTab('tareas')} className="btn flex-1">Cancelar</button>
              <button type="submit" className="btn-primary flex-1">Crear actividad</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
