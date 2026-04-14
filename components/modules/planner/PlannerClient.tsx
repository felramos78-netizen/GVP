'use client'
/**
 * components/modules/planner/PlannerClient.tsx
 * Planner con tabs: semana, mes, lista de compras y aseo.
 */
import { useState } from 'react'
import { format, addDays, startOfWeek, addMonths, subMonths,
         startOfMonth, endOfMonth, getDay, getDaysInMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCLP, cn } from '@/lib/utils/formatters'

const MEAL_TYPES = ['desayuno', 'almuerzo', 'cena', 'snack'] as const
const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MEAL_COLORS = {
  desayuno: { cell: 'bg-teal-50 text-teal-800',   dot: 'bg-teal-400'  },
  almuerzo: { cell: 'bg-blue-50 text-blue-800',    dot: 'bg-blue-400'  },
  cena:     { cell: 'bg-amber-50 text-amber-800',  dot: 'bg-amber-400' },
  snack:    { cell: 'bg-pink-50 text-pink-800',    dot: 'bg-pink-400'  },
}

export function PlannerClient({
  monthPlan, weekStatus, shoppingList,
  currentYear, currentMonth, weekStartDate,
}: any) {
  const [tab, setTab] = useState<'semana' | 'mes' | 'compras'>('semana')
  const [calYear, setCalYear] = useState(currentYear)
  const [calMonth, setCalMonth] = useState(currentMonth)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Indexar plan del mes
  const monthIndex = new Map<string, any[]>()
  for (const entry of monthPlan) {
    const key = entry.plan_date
    if (!monthIndex.has(key)) monthIndex.set(key, [])
    monthIndex.get(key)!.push(entry)
  }

  // Indexar semana con estado de stock
  const weekIndex = new Map<string, any>()
  for (const entry of weekStatus) {
    weekIndex.set(`${entry.plan_date}__${entry.meal_type}`, entry)
  }

  const weekStart = parseISO(weekStartDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Calendario mensual
  const firstDay = startOfMonth(new Date(calYear, calMonth))
  const offset = (getDay(firstDay) + 6) % 7 // lunes = 0
  const daysInMonth = getDaysInMonth(new Date(calYear, calMonth))

  const tabs = [
    { key: 'semana', label: 'Semana actual' },
    { key: 'mes',    label: 'Mes completo' },
    { key: 'compras', label: `Lista de compras (${shoppingList.length})` },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* VISTA SEMANA */}
      {tab === 'semana' && (
        <div className="flex flex-col gap-3">
          <div className="card overflow-x-auto">
            <table style={{ minWidth: 560, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th className="text-left py-2 pr-3 text-gray-400 font-medium w-20 text-xs">Comida</th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} className="text-center py-2 px-1 text-gray-600 font-medium text-xs">
                      {format(day, 'EEE d', { locale: es })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map(type => (
                  <tr key={type}>
                    <td className="py-2 pr-2 text-gray-500 font-medium text-xs capitalize align-top">{type}</td>
                    {weekDays.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const entry = weekIndex.get(`${dateStr}__${type}`)
                      const text = entry?.recipes?.name ?? entry?.free_text
                      const isMissing = entry?.stockStatus === 'missing'
                      const colors = MEAL_COLORS[type]
                      return (
                        <td key={dateStr} className="py-1 px-1 align-top">
                          <button
                            onClick={() => setSelectedDay(`${dateStr}__${type}`)}
                            className={cn(
                              'w-full text-left rounded-md px-1.5 py-1.5 text-xs transition-all min-h-[44px]',
                              text
                                ? isMissing ? 'bg-coral-50 text-coral-800 border border-coral-200' : colors.cell
                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                            )}
                          >
                            {text
                              ? <span className="leading-tight">{text.split(' ').slice(0, 4).join(' ')}</span>
                              : <span className="text-gray-300">+</span>
                            }
                            {isMissing && (
                              <div className="text-xs text-coral-500 mt-0.5">Sin stock</div>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detalle del día seleccionado */}
          {selectedDay && (() => {
            const [date, type] = selectedDay.split('__')
            const entry = weekIndex.get(selectedDay)
            return (
              <div className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-gray-900 capitalize">
                      {format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })} — {type}
                    </div>
                    {entry && <div className="text-sm text-gray-500 mt-0.5">{entry.recipes?.name ?? entry.free_text}</div>}
                  </div>
                  <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Modo</label>
                    <select className="select" defaultValue={entry?.mode ?? 'home'}>
                      <option value="home">Cocina en casa</option>
                      <option value="bought">Compra afuera</option>
                      <option value="invited">Fue invitado</option>
                      <option value="skipped">No comió</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Costo real ($)</label>
                    <input type="number" className="input" placeholder="0" defaultValue={entry?.actual_cost_clp ?? ''} />
                  </div>
                  <div>
                    <label className="label">Calorías reales</label>
                    <input type="number" className="input" placeholder="kcal" defaultValue={entry?.actual_kcal ?? ''} />
                  </div>
                  <div>
                    <label className="label">Notas</label>
                    <input type="text" className="input" placeholder="Opcional" defaultValue={entry?.notes ?? ''} />
                  </div>
                </div>
                {entry?.missingProducts?.length > 0 && (
                  <div className="mt-3 bg-coral-50 border border-coral-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-coral-800 mb-1">Ingredientes con stock insuficiente:</p>
                    {entry.missingProducts.map((mp: any) => (
                      <p key={mp.productId} className="text-xs text-coral-700">
                        · {mp.productName}: necesita {mp.required} {mp.unit}, disponible {mp.available}
                      </p>
                    ))}
                  </div>
                )}
                <button className="btn-primary mt-3">Guardar cambios</button>
              </div>
            )
          })()}
        </div>
      )}

      {/* VISTA MES */}
      {tab === 'mes' && (
        <div className="flex flex-col gap-3">
          {/* Nav mes */}
          <div className="flex items-center justify-between">
            <button onClick={() => {
              const prev = subMonths(new Date(calYear, calMonth), 1)
              setCalYear(prev.getFullYear()); setCalMonth(prev.getMonth())
            }} className="btn btn-sm">← Anterior</button>
            <span className="text-base font-semibold text-gray-900">
              {format(new Date(calYear, calMonth), 'MMMM yyyy', { locale: es })}
            </span>
            <button onClick={() => {
              const next = addMonths(new Date(calYear, calMonth), 1)
              setCalYear(next.getFullYear()); setCalMonth(next.getMonth())
            }} className="btn btn-sm">Siguiente →</button>
          </div>

          {/* Grid del calendario */}
          <div className="card">
            {/* Cabeceras de días */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_ES.map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Días */}
            <div className="grid grid-cols-7 gap-1">
              {/* Espacios vacíos al inicio */}
              {Array.from({ length: offset }, (_, i) => (
                <div key={`empty-${i}`} className="min-h-[72px]" />
              ))}
              {/* Días del mes */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                const dateStr = format(new Date(calYear, calMonth, day), 'yyyy-MM-dd')
                const entries = monthIndex.get(dateStr) ?? []
                const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')

                return (
                  <div
                    key={day}
                    className={cn(
                      'min-h-[72px] rounded-lg border p-1.5 cursor-pointer transition-colors',
                      isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
                    )}
                    onClick={() => setSelectedDay(dateStr + '__desayuno')}
                  >
                    <div className={cn(
                      'text-xs font-semibold mb-1',
                      isToday ? 'text-blue-700' : 'text-gray-600'
                    )}>{day}</div>
                    <div className="flex flex-col gap-0.5">
                      {MEAL_TYPES.map(type => {
                        const entry = entries.find(e => e.meal_type === type)
                        const text = entry?.recipes?.name ?? entry?.free_text
                        if (!text) return null
                        return (
                          <div
                            key={type}
                            className={cn('text-[9px] px-1 py-0.5 rounded leading-tight truncate', MEAL_COLORS[type].cell)}
                          >
                            {text.split(' ').slice(0, 2).join(' ')}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Leyenda */}
            <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
              {MEAL_TYPES.map(type => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', MEAL_COLORS[type].dot)} />
                  <span className="text-xs text-gray-500 capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LISTA DE COMPRAS */}
      {tab === 'compras' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Productos que faltan en el stock para completar las comidas de esta semana.
          </p>
          {shoppingList.length === 0 ? (
            <div className="card text-center py-8">
              <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">Stock completo para esta semana</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Necesario</th>
                      <th>Disponible</th>
                      <th>Falta</th>
                      <th>Para las comidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shoppingList.map((item: any) => (
                      <tr key={item.productId}>
                        <td className="font-medium">{item.productName}</td>
                        <td>{item.totalRequired} {item.unit}</td>
                        <td className="text-coral-600">{item.available} {item.unit}</td>
                        <td className="font-semibold text-coral-700">
                          {(item.totalRequired - item.available).toFixed(1)} {item.unit}
                        </td>
                        <td className="text-xs text-gray-400">{item.forMeals.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn-primary w-fit"
                onClick={() => alert('Productos enviados a Stock → Compra pendiente')}
              >
                Enviar a compra pendiente →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
