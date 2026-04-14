/**
 * app/(app)/aseo/page.tsx
 * Gestión de actividades de aseo, higiene y orden del hogar.
 */
import { createClient } from '@/lib/supabase/server'
import { AseoClient } from '@/components/modules/aseo/AseoClient'

export default async function AseoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [tasks, logs] = await Promise.all([
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
      .limit(30),
  ])

  // Stock para verificar productos de aseo disponibles
  const { data: stock } = await supabase
    .from('stock')
    .select('product_id, current_qty, products(name, type)')
    .eq('user_id', user.id)

  const aseoStock = (stock ?? []).filter((s: any) => s.products?.type === 'aseo')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Aseo e higiene</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tasks.data?.length ?? 0} actividades · registro semanal
        </p>
      </div>
      <AseoClient
        tasks={tasks.data ?? []}
        recentLogs={logs.data ?? []}
        aseoStock={aseoStock}
      />
    </div>
  )
}
