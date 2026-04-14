/**
 * app/(app)/cotizacion/page.tsx
 * Motor de cotización: compara precios entre proveedores,
 * recomienda dónde comprar y pasa ítems al stock.
 */
import { createClient } from '@/lib/supabase/server'
import { getProducts } from '@/lib/db/products'
import { CotizacionClient } from '@/components/modules/cotizacion/CotizacionClient'

export default async function CotizacionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [products, suppliers] = await Promise.all([
    getProducts(supabase, user.id),
    supabase
      .from('suppliers')
      .select('id, name, base_url, search_url_pattern')
      .eq('is_active', true)
      .order('name'),
  ])

  // Para cada producto obtener su último precio por proveedor
  const productIds = products.map(p => p.id)
  const { data: latestPrices } = await supabase
    .from('price_history')
    .select('product_id, supplier_id, price_clp, recorded_at, is_on_sale, suppliers(name)')
    .in('product_id', productIds)
    .order('recorded_at', { ascending: false })

  // Agrupar: para cada (product_id, supplier_id) quedarse con el más reciente
  const priceMap = new Map<string, any>()
  for (const price of latestPrices ?? []) {
    const key = `${price.product_id}__${price.supplier_id}`
    if (!priceMap.has(key)) priceMap.set(key, price)
  }

  const pricesArray = Array.from(priceMap.values())

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Cotización inteligente</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compara precios · consolida compras · envía al stock
        </p>
      </div>
      <CotizacionClient
        products={products}
        suppliers={suppliers.data ?? []}
        latestPrices={pricesArray}
      />
    </div>
  )
}
