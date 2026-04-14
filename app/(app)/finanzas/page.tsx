/**
 * app/(app)/finanzas/page.tsx
 * Gestión de centros de costo y presupuesto mensual.
 */
import { createClient } from '@/lib/supabase/server'
import { FinanzasClient } from '@/components/modules/finanzas/FinanzasClient'
import { format } from 'date-fns'

export default async function FinanzasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const yearMonth = format(now, 'yyyy-MM-01')

  const [profile, costCenters, budgets] = await Promise.all([
    supabase.from('users').select('monthly_income, pay_day').eq('id', user.id).single(),
    supabase.from('cost_centers').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('monthly_budget').select('*').eq('user_id', user.id).eq('year_month', yearMonth),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Finanzas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Centros de costo · presupuesto mensual · {format(now, 'MMMM yyyy')}
        </p>
      </div>
      <FinanzasClient
        income={profile.data?.monthly_income ?? 0}
        payDay={profile.data?.pay_day ?? 5}
        costCenters={costCenters.data ?? []}
        budgets={budgets.data ?? []}
        yearMonth={yearMonth}
      />
    </div>
  )
}
