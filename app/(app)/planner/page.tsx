/**
 * app/(app)/planner/page.tsx
 * Planner de comidas — vista mensual y semanal generada desde el stock.
 */
import { createClient } from '@/lib/supabase/server'
import { getMealPlanMonth, checkMealPlanStock, generateShoppingList } from '@/lib/db/meal-plan'
import { startOfWeek } from 'date-fns'
import { PlannerClient } from '@/components/modules/planner/PlannerClient'

export default async function PlannerPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })

  const [monthPlan, weekStatus, shoppingList] = await Promise.all([
    getMealPlanMonth(supabase, user.id, now.getFullYear(), now.getMonth()),
    checkMealPlanStock(supabase, user.id, weekStart),
    generateShoppingList(supabase, user.id, weekStart),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Planner 2026</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generado desde el stock · vista mensual y semanal
        </p>
      </div>

      <PlannerClient
        monthPlan={monthPlan}
        weekStatus={weekStatus}
        shoppingList={shoppingList}
        currentYear={now.getFullYear()}
        currentMonth={now.getMonth()}
        weekStartDate={weekStart.toISOString().split('T')[0]}
      />
    </div>
  )
}
