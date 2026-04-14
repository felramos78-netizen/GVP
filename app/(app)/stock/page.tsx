/**
 * app/(app)/stock/page.tsx
 * Inventario, alertas de stock y confirmación de compras.
 */
import { createClient } from '@/lib/supabase/server'
import { getStock, getLowStockAlerts, getPurchaseHistory } from '@/lib/db/stock'
import { StockClient } from '@/components/modules/stock/StockClient'

export default async function StockPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [stock, alerts, history, costCenters, suppliers] = await Promise.all([
    getStock(supabase, user.id),
    getLowStockAlerts(supabase, user.id),
    getPurchaseHistory(supabase, user.id, 10),
    supabase.from('cost_centers').select('id, name, icon').eq('user_id', user.id).eq('is_active', true),
    supabase.from('suppliers').select('id, name').eq('is_active', true),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Stock e inventario</h1>
        <p className="text-sm text-gray-500 mt-1">
          {stock.length} productos · {alerts.length} alertas activas
        </p>
      </div>

      <StockClient
        stock={stock}
        alerts={alerts}
        recentPurchases={history}
        costCenters={costCenters.data ?? []}
        suppliers={suppliers.data ?? []}
      />
    </div>
  )
}
