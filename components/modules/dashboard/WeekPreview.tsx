/**
 * components/modules/dashboard/WeekPreview.tsx
 * Vista semanal de comidas en el dashboard.
 */
import { formatPlannerDate } from '@/lib/utils/formatters'
import { addDays, startOfWeek } from 'date-fns'
import type { MealPlanEntry } from '@/lib/db/meal-plan'

interface WeekPreviewProps {
  entries: MealPlanEntry[]
}

const MEAL_TYPES = ['desayuno', 'almuerzo', 'cena', 'snack'] as const
const MEAL_COLORS = {
  desayuno: 'bg-teal-50 text-teal-800',
  almuerzo: 'bg-blue-50 text-blue-800',
  cena:     'bg-amber-50 text-amber-800',
  snack:    'bg-pink-50 text-pink-800',
} as const

export function WeekPreview({ entries }: WeekPreviewProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Indexar entradas por fecha y tipo de comida
  const index = new Map<string, MealPlanEntry>()
  for (const entry of entries) {
    index.set(`${entry.plan_date}__${entry.meal_type}`, entry)
  }

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Semana actual</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 text-gray-400 font-medium w-20">Comida</th>
              {days.map(day => (
                <th key={day.toISOString()} className="text-center py-2 px-1 text-gray-500 font-medium">
                  {formatPlannerDate(day.toISOString().split('T')[0])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_TYPES.map(type => (
              <tr key={type} className="border-t border-gray-100">
                <td className="py-2 pr-3 text-gray-500 font-medium capitalize">{type}</td>
                {days.map(day => {
                  const dateStr = day.toISOString().split('T')[0]
                  const entry = index.get(`${dateStr}__${type}`)
                  const text = entry?.recipes?.name ?? entry?.free_text
                  return (
                    <td key={dateStr} className="py-1.5 px-1">
                      {text ? (
                        <span className={`block text-center px-1.5 py-1 rounded text-xs leading-tight ${MEAL_COLORS[type]}`}>
                          {text.split(' ').slice(0, 3).join(' ')}
                        </span>
                      ) : (
                        <span className="block text-center text-gray-300">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
