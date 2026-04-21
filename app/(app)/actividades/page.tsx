/**
 * app/(app)/actividades/page.tsx
 * Módulo de Actividades — tareas del hogar, aseo, recordatorios.
 * Reemplaza /aseo con URL canónica /actividades.
 */
import { createClient } from '@/lib/supabase/server'
import { ActividadesClient } from '@/components/modules/actividades/ActividadesClient'

export default async function ActividadesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [tasks, logs, stock] = await Promise.all([
    supabase
      .from('cleaning_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('frequency'),
    supabase
      .from('task_log')
      .select('*')
      .eq('user_id', user.id)
      .order('done_at', { ascending: false })
      .limit(50),
    supabase
      .from('stock')
      .select('product_id, current_qty, unit, products(name, type, category)')
      .eq('user_id', user.id),
  ])

  const aseoStock = (stock.data ?? []).filter((s: any) =>
    s.products?.type === 'aseo' || s.products?.type === 'mascotas'
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Actividades</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tasks.data?.length ?? 0} actividades configuradas · seguimiento semanal
        </p>
      </div>
      <ActividadesClient
        tasks={tasks.data ?? []}
        recentLogs={logs.data ?? []}
        aseoStock={aseoStock}
      />
    </div>
  )
}
