/**
 * app/(app)/dashboard/page.tsx
 * Dashboard principal — Server Component.
 * Carga los datos iniciales en el servidor para evitar flicker.
 */
import { createClient } from '@/lib/supabase/server'
import { getStock, getLowStockAlerts } from '@/lib/db/stock'
import { getMealPlanWeek } from '@/lib/db/meal-plan'
import { formatCLP, formatDate } from '@/lib/utils/formatters'
import { startOfWeek } from 'date-fns'
import { MetricCards } from '@/components/modules/dashboard/MetricCards'
import { WeekPreview } from '@/components/modules/dashboard/WeekPreview'
import { StockAlerts } from '@/components/modules/dashboard/StockAlerts'
import { ProgressCard } from '@/components/modules/dashboard/ProgressCard'
import { SessionCalendar } from '@/components/modules/dashboard/SessionCalendar'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Cargar datos en paralelo
  const [profile, stock, alerts, weekPlan] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    getStock(supabase, user.id),
    getLowStockAlerts(supabase, user.id),
    getMealPlanWeek(supabase, user.id, startOfWeek(new Date(), { weekStartsOn: 1 })),
  ])

  const userData = profile.data
  const monthlyIncome = userData?.monthly_income ?? 0

  // Calcular métricas financieras básicas
  const { data: costCenters } = await supabase
    .from('cost_centers')
    .select('monthly_amount, type')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const totalAssigned = (costCenters ?? []).reduce((s, c) => s + c.monthly_amount, 0)
  const totalFree = monthlyIncome - totalAssigned

  return (
    <div className="flex flex-col gap-6">
      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Hola, {userData?.name?.split(' ')[0] ?? 'usuario'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">{formatDate(new Date().toISOString())}</p>
      </div>

      {/* Métricas financieras */}
      <MetricCards
        income={monthlyIncome}
        assigned={totalAssigned}
        free={totalFree}
        stockCount={stock.length}
        alertCount={alerts.length}
      />

      {/* Plan de acción y progreso */}
      <ProgressCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Semana actual */}
        <div className="lg:col-span-2">
          <WeekPreview entries={weekPlan} />
        </div>

        {/* Alertas de stock */}
        <div>
          <StockAlerts alerts={alerts} />
        </div>
      </div>

      {/* Calendario de sesiones */}
      <SessionCalendar />
    </div>
  )
}
