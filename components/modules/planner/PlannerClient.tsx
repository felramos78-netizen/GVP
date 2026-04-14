'use client'
import { useState } from 'react'
import { format, addDays, startOfWeek, addMonths, subMonths,
         startOfMonth, getDay, getDaysInMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils/formatters'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const MEAL_TYPES = ['desayuno', 'almuerzo', 'cena', 'snack'] as const
const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MEAL_COLORS = {
  desayuno: { cell: 'bg-teal-50 text-teal-800',   dot: 'bg-teal-400',  border: 'border-teal-200' },
  almuerzo: { cell: 'bg-blue-50 text-blue-800',    dot: 'bg-blue-400',  border: 'border-blue-200' },
  cena:     { cell: 'bg-amber-50 text-amber-800',  dot: 'bg-amber-400', border: 'border-amber-200' },
  snack:    { cell: 'bg-pink-50 text-pink-800',    dot: 'bg-pink-400',  border: 'border-pink-200' },
}

export function PlannerClient({
  monthPlan, weekStatus, shoppingList,
  currentYear, currentMonth, weekStartDate,
}: any) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'semana'|'mes'|'compras'>('semana')
  const [calYear, setCalYear] = useState(currentYear)
  const [calMonth, setCalMonth] = useState(currentMonth)
  const [selectedDay, setSelectedDay] = useState<string|null>(null)
  const [addingMeal, setAddingMeal] = useState<{date: string, type: string}|null>(null)
  const [mealForm, setMealForm] = useState({ free_text: '', mode: 'home', notes: '' })
  const [saving, setSaving] = useState(false)

  const monthIndex = new Map<string, any[]>()
  for (const entry of monthPlan) {
    const key = entry.plan_date
    if (!monthIndex.has(key)) monthIndex.set(key, [])
    monthIndex.get(key)!.push(entry)
  }

  const weekIndex = new Map<string, any>()
  for (const entry of weekStatus) {
    weekIndex.set(`${entry.plan_date}__${entry.meal_type}`, entry)
  }

  const weekStart = parseISO(weekStartDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const firstDay = startOfMonth(new Date(calYear, calMonth))
  const offset = (getDay(firstDay) + 6) % 7
  const daysInMonth = getDaysInMonth(new Date(calYear, calMonth))

  const handleAddMeal = async () => {
    if (!addingMeal || !mealForm.free_text.trim()) return
    setSaving(true)
    const { error } = await supabase.from('meal_plan').upsert({
      plan_date: addingMeal.date,
      meal_type: addingMeal.type,
      free_text: mealForm.free_text.trim(),
      mode: mealForm.mode,
      notes: mealForm.notes || null,
    }, { onConflict: 'user_id,plan_date,meal_type' })
    setSaving(false)
    if (!error) {
      setAddingMeal(null)
      setMealForm({ free_text: '', mode: 'home', notes: '' })
      router.refresh()
    }
  }

  const tabs = [
    { key: 'semana', label: 'Semana actual' },
    { key: 'mes',    label: 'Mes completo' },
    { key: 'compras', label: `Lista de compras (${shoppingList.length})` },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SEMANA */}
      {tab === 'semana' && (
        <div className="card overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-8 gap-1 mb-2">
              <div className="text-xs text-gray-400 font-medium py-2" />
              {weekDays.map((day, i) => (
                <div key={i} className="text-center">
                  <div className="text-xs font-semibold text-gray-500">{DAYS_ES[i]}</div>
                  <div className={cn('text-sm font-bold', format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                    ? 'text-blue-600' : 'text-gray-800')}>{format(day, 'd')}</div>
                </div>
              ))}
            </div>
            {MEAL_TYPES.map(mealType => {
              const colors = MEAL_COLORS[mealType]
              return (
                <div key={mealType} className="grid grid-cols-8 gap-1 mb-1">
                  <div className="flex items-center">
                    <div className={cn('w-2 h-2 rounded-full mr-1.5 flex-shrink-0', colors.dot)} />
                    <span className="text-xs font-medium text-gray-500 capitalize">{mealType}</span>
                  </div>
                  {weekDays.map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const key = `${dateStr}__${mealType}`
                    const entry = weekIndex.get(key)
                    return (
                      <div key={i}
                        onClick={() => setAddingMeal({ date: dateStr, type: mealType })}
                        className={cn(
                          'rounded-lg p-1.5 min-h-[52px] cursor-pointer border transition-all text-xs',
                          entry ? colors.cell + ' ' + colors.border : 'border-dashed border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                        )}>
                        {entry ? (
                          <div>
                            <div className="font-medium leading-tight">{entry.free_text ?? entry.recipes?.name ?? '—'}</div>
                            {entry.mode && entry.mode !== 'home' && (
                              <div className="text-xs opacity-60 mt-0.5">{entry.mode}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-300 text-center mt-2">+</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">Haz clic en cualquier celda para agregar o editar una comida.</p>
        </div>
      )}

      {/* MES */}
      {tab === 'mes' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1) } else setCalMonth(m => m-1) }} className="btn btn-sm">←</button>
            <span className="font-semibold text-gray-800 capitalize">
              {format(new Date(calYear, calMonth), 'MMMM yyyy', { locale: es })}
            </span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1) } else setCalMonth(m => m+1) }} className="btn btn-sm">→</button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_ES.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: offset }, (_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const entries = monthIndex.get(dateStr) ?? []
              const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')
              return (
                <div key={day}
                  onClick={() => setSelectedDay(selectedDay === dateStr ? null : dateStr)}
                  className={cn('min-h-[60px] rounded-lg border p-1 cursor-pointer transition-all',
                    isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-300'
                  )}>
                  <div className={cn('text-xs font-bold mb-1', isToday ? 'text-blue-600' : 'text-gray-600')}>{day}</div>
                  <div className="flex flex-col gap-0.5">
                    {entries.slice(0,3).map((e: any, ei: number) => {
                      const colors = MEAL_COLORS[e.meal_type as keyof typeof MEAL_COLORS]
                      return (
                        <div key={ei} className={cn('rounded px-1 text-xs truncate', colors?.cell ?? 'bg-gray-100 text-gray-600')}>
                          {e.free_text ?? e.recipes?.name ?? e.meal_type}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* LISTA COMPRAS */}
      {tab === 'compras' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Lista generada desde ingredientes faltantes</h3>
          {shoppingList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin ítems pendientes — stock completo ✓</p>
          ) : (
            <div className="flex flex-col gap-2">
              {shoppingList.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{item.product_name ?? item.name}</div>
                    {item.recipe_name && <div className="text-xs text-gray-400">Para: {item.recipe_name}</div>}
                  </div>
                  <div className="text-xs text-gray-500">{item.qty_needed ?? ''} {item.unit ?? ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal agregar comida */}
      {addingMeal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-gray-900 capitalize">
                {addingMeal.type} — {addingMeal.date}
              </h3>
              <button onClick={() => setAddingMeal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">¿Qué se come? *</label>
                <input className="input" placeholder="Ej: Arroz con pollo"
                  value={mealForm.free_text} onChange={e => setMealForm(p => ({ ...p, free_text: e.target.value }))}
                  autoFocus />
              </div>
              <div>
                <label className="label">Modalidad</label>
                <select className="select" value={mealForm.mode}
                  onChange={e => setMealForm(p => ({ ...p, mode: e.target.value }))}>
                  <option value="home">Cocinado en casa</option>
                  <option value="bought">Pedido / delivery</option>
                  <option value="invited">Invitado a comer</option>
                  <option value="skipped">No comí</option>
                </select>
              </div>
              <div>
                <label className="label">Notas (opcional)</label>
                <input className="input" placeholder="Ej: con ensalada"
                  value={mealForm.notes} onChange={e => setMealForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAddingMeal(null)} className="btn flex-1">Cancelar</button>
              <button onClick={handleAddMeal} disabled={saving || !mealForm.free_text.trim()} className="btn-primary flex-1">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
