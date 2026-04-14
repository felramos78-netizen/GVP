/**
 * app/(app)/productos/page.tsx
 * Base de productos con tabla completa, filtros y acceso a ficha.
 */
import { createClient } from '@/lib/supabase/server'
import { getProducts, getProductCategories } from '@/lib/db/products'
import { ProductsClient } from '@/components/modules/productos/ProductsClient'

export default async function ProductosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [products, categories, suppliers] = await Promise.all([
    getProducts(supabase, user.id),
    getProductCategories(supabase, user.id),
    supabase.from('suppliers').select('id, name').eq('is_active', true),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Base de productos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {products.length} producto{products.length !== 1 ? 's' : ''} · fichas completas · historial de precios y compras
          </p>
        </div>
      </div>

      <ProductsClient
        initialProducts={products}
        categories={categories}
        suppliers={suppliers.data ?? []}
      />
    </div>
  )
}
