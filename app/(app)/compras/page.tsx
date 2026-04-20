/**
 * app/(app)/compras/page.tsx
 * Módulo de Compras — boletas, historial, integración financiera y bancaria.
 */
import { createClient } from '@/lib/supabase/server'
import { ComprasClient } from '@/components/modules/compras/ComprasClient'

export default async function ComprasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [costCenters, recentPurchases, suppliers, allPurchases] = await Promise.all([
    supabase.from('cost_centers').select('id, name, icon, color, type').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('purchase_orders')
      .select(`*, suppliers(name), cost_centers(name,icon), purchase_items(*, products(name,unit))`)
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .order('purchased_at', { ascending: false })
      .limit(20),
    supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
    // Todas las compras para el módulo de proveedores (historial completo)
    supabase.from('purchase_orders')
      .select(`id, purchased_at, total_clp, notes, supplier_id, purchase_items(qty, unit_price_clp, products(name, unit))`)
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .order('purchased_at', { ascending: false }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Compras</h1>
        <p className="text-sm text-gray-500 mt-1">
          Importa boletas · registra gastos · actualiza stock · descubre recetas
        </p>
      </div>
      <ComprasClient
        costCenters={costCenters.data ?? []}
        recentPurchases={recentPurchases.data ?? []}
        suppliers={suppliers.data ?? []}
        allPurchases={allPurchases.data ?? []}
      />
    </div>
  )
}
