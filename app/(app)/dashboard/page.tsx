/**
 * app/(app)/dashboard/page.tsx
 * Dashboard principal — visión cruzada de costos, stock y planner.
 */
import { createClient } from '@/lib/supabase/server'
import { getStock, getLowStockAlerts } from '@/lib/db/stock'
import { getMealPlanWeek } from '@/lib/db/meal-plan'
import { formatDate } from '@/lib/utils/formatters'
import { startOfWeek, subMonths, format } from 'date-fns'
import { MetricCards } from '@/components/modules/dashboard/MetricCards'
import { WeekPreview } from '@/components/modules/dashboard/WeekPreview'
import { StockAlerts } from '@/components/modules/dashboard/StockAlerts'
import { CostDashboard } from '@/components/modules/dashboard/CostDashboard'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Rango de los últimos 6 meses para datos históricos
  const sixMonthsAgo = format(subMonths(new Date(), 5), 'yyyy-MM-01')

  const [
    profile,
    stock,
    alerts,
    weekPlan,
    costCenters,
    purchases,
    bankTxs,
    mantencion,
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    getStock(supabase, user.id),
    getLowStockAlerts(supabase, user.id),
    getMealPlanWeek(supabase, user.id, startOfWeek(new Date(), { weekStartsOn: 1 })),
    supabase
      .from('cost_centers')
      .select('id, name, icon, type, monthly_amount')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('purchase_orders')
      .select('id, purchased_at, total_clp, cost_center_id, suppliers(name)')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('purchased_at', sixMonthsAgo)
      .order('purchased_at', { ascending: false }),
    supabase
      .from('bank_transactions')
      .select('id, transaction_date, amount, description, cost_center_id, supplier_id, is_expense')
      .eq('user_id', user.id)
      .eq('is_expense', true)
      .gte('transaction_date', sixMonthsAgo)
      .order('transaction_date', { ascending: false }),
    supabase
      .from('mantencion_entries')
      .select('id, nombre, monto, activo')
      .eq('user_id', user.id)
      .eq('activo', true),
  ])

  const userData = profile.data
  const monthlyIncome = userData?.monthly_income ?? 0
  const totalAssigned = (costCenters.data ?? []).reduce((s: number, c: any) => s + c.monthly_amount, 0)
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

      {/* Visión cruzada de costos */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Resumen financiero cruzado</h2>
        <CostDashboard
          costCenters={costCenters.data ?? []}
          purchases={(purchases.data ?? []) as any[]}
          bankTxs={(bankTxs.data ?? []) as any[]}
          mantencion={mantencion.data ?? []}
          income={monthlyIncome}
        />
      </div>

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
    </div>
  )
}
