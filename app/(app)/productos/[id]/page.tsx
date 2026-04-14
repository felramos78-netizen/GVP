/**
 * app/(app)/productos/[id]/page.tsx
 * Ficha completa de un producto: identificación, stock, cotizaciones,
 * historial de precios, historial de compras.
 */
import { createClient } from '@/lib/supabase/server'
import { getProductById, getProductPurchaseHistory } from '@/lib/db/products'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCLP, formatQty, formatDateShort, getStockStatus, stockStatusClasses } from '@/lib/utils/formatters'
import { PriceHistoryChart } from '@/components/modules/productos/PriceHistoryChart'
import { PriceSearchButton } from '@/components/modules/productos/PriceSearchButton'

export default async function ProductFichaPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [product, purchaseHistory] = await Promise.all([
    getProductById(supabase, params.id, user.id).catch(() => null),
    getProductPurchaseHistory(supabase, params.id, user.id),
  ])

  if (!product) notFound()

  const stockStatus = product.stock
    ? getStockStatus(product.stock.current_qty, product.stock.min_qty)
    : null
  const stockCls = stockStatus ? stockStatusClasses[stockStatus] : null

  const aplica = [
    product.is_breakfast && 'Desayuno',
    product.is_lunch && 'Almuerzo',
    product.is_dinner && 'Cena',
    product.is_snack && 'Snack',
  ].filter(Boolean)

  const suppliers = product.product_suppliers ?? []
  const availablePrices = suppliers
    .filter(ps => ps.is_available)
    .flatMap(ps => {
      // Obtener el precio más reciente de price_history para este proveedor
      const ph = (product as any).price_history?.filter(
        (h: any) => h.supplier_id === ps.supplier_id
      ).sort((a: any, b: any) => b.recorded_at.localeCompare(a.recorded_at))
      return ph?.[0] ? [{ supplier: ps.suppliers, price: ph[0].price_clp, isOnSale: ph[0].is_on_sale }] : []
    })

  const bestPrice = availablePrices.length
    ? availablePrices.reduce((a, b) => a.price < b.price ? a : b)
    : null
  const worstPrice = availablePrices.length
    ? availablePrices.reduce((a, b) => a.price > b.price ? a : b)
    : null

  const totalSpent = purchaseHistory.reduce(
    (s, h) => s + (h.total_price_clp ?? 0), 0
  )

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/productos" className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
            ← Volver a productos
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {product.brand && `${product.brand} · `}{product.category} · {product.type}
          </p>
        </div>
        <div className="flex gap-2">
          <PriceSearchButton productId={product.id} productName={product.name} />
          <Link href={`/productos/${product.id}/editar`} className="btn">Editar</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Identificación */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Identificación del producto</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ['Nombre', product.name],
                ['Marca', product.brand ?? '—'],
                ['Categoría', product.category],
                ['Tipo', product.type],
                ['Formato', product.format ?? '—'],
                ['Unidad', product.unit],
                ['Cantidad', `${product.quantity} ${product.unit}`],
                ['Dosis estimadas', product.doses ? `${product.doses} usos` : '—'],
                ['Duración / venc.', product.shelf_life_days ? `${product.shelf_life_days} días` : '—'],
                ['Ubicación', product.storage_location ?? '—'],
                ['Aplica para', aplica.join(', ') || '—'],
                ['Disponible en', suppliers.filter(ps => ps.is_available).map(ps => ps.suppliers?.name).join(', ') || '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
                  <div className="text-sm font-medium text-gray-800">{value}</div>
                </div>
              ))}
            </div>
            {product.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Descripción</div>
                <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
              </div>
            )}
            {product.comparison_notes && (
              <div className="mt-3">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Comparación con similares</div>
                <p className="text-sm text-gray-600 leading-relaxed">{product.comparison_notes}</p>
              </div>
            )}
          </div>

          {/* Stock */}
          {product.stock && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Stock actual</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Cantidad</div>
                  <div className={`text-base font-semibold ${stockCls?.text}`}>
                    {formatQty(product.stock.current_qty, product.stock.unit ?? product.unit)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Mínimo</div>
                  <div className="text-base font-semibold text-gray-700">
                    {formatQty(product.stock.min_qty, product.stock.unit ?? product.unit)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Estado</div>
                  <span className={stockStatus ? `badge-${stockStatus === 'ok' ? 'ok' : stockStatus === 'warning' ? 'warning' : 'critical'}` : ''}>
                    {stockStatus === 'ok' ? 'OK' : stockStatus === 'warning' ? 'Alerta' : 'Crítico'}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Última compra</div>
                  <div className="text-sm font-medium text-gray-700">
                    {formatDateShort(product.stock.last_purchase_at)}
                  </div>
                </div>
              </div>
              {/* Barra de nivel */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round(product.stock.current_qty / (product.stock.min_qty * 2) * 100))}%`,
                    background: stockStatus === 'ok' ? '#1D9E75' : stockStatus === 'warning' ? '#BA7517' : '#D85A30',
                  }}
                />
              </div>
            </div>
          )}

          {/* Historial de precios */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Historial de precios</h2>
            <PriceHistoryChart priceHistory={(product as any).price_history ?? []} />
          </div>

          {/* Historial de compras */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Historial de compras · {purchaseHistory.length} adquisición{purchaseHistory.length !== 1 ? 'es' : ''}
              </h2>
              <span className="text-xs text-gray-500">
                Total gastado: <strong className="text-teal-600">{formatCLP(totalSpent)}</strong>
              </span>
            </div>
            {purchaseHistory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin historial de compras aún.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cantidad</th>
                    <th>Precio unitario</th>
                    <th>Total</th>
                    <th>Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseHistory.map((h: any) => (
                    <tr key={h.id}>
                      <td className="text-gray-500">{formatDateShort(h.purchase_orders?.purchased_at)}</td>
                      <td>{h.qty} u.</td>
                      <td className="text-teal-600 font-medium">{formatCLP(h.unit_price_clp)}</td>
                      <td className="font-medium">{formatCLP(h.total_price_clp)}</td>
                      <td>
                        <span className="badge-info">{h.suppliers?.name ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Columna derecha — cotizaciones */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Cotizaciones</h2>
              {bestPrice && worstPrice && bestPrice.price !== worstPrice.price && (
                <span className="text-xs text-teal-600 font-medium">
                  Ahorro {formatCLP(worstPrice.price - bestPrice.price)}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {suppliers.map(ps => {
                const priceEntry = (product as any).price_history?.find(
                  (h: any) => h.supplier_id === ps.supplier_id
                )
                const isBest = priceEntry && bestPrice && priceEntry.price_clp === bestPrice.price
                return (
                  <div
                    key={ps.id}
                    className={`rounded-lg border px-3 py-3 ${
                      !ps.is_available ? 'opacity-40 border-gray-200' :
                      isBest ? 'border-teal-300 bg-teal-50' :
                      'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">
                        {ps.suppliers?.name}
                      </span>
                      {ps.is_available && priceEntry ? (
                        <span className={`text-base font-semibold ${isBest ? 'text-teal-700' : 'text-gray-900'}`}>
                          {formatCLP(priceEntry.price_clp)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">No disponible</span>
                      )}
                    </div>
                    {isBest && <div className="text-xs text-teal-600 mt-1">Mejor precio</div>}
                    {ps.is_available && priceEntry && bestPrice && priceEntry.price_clp > bestPrice.price && (
                      <div className="text-xs text-amber-600 mt-1">
                        +{formatCLP(priceEntry.price_clp - bestPrice.price)} vs mejor ({Math.round((priceEntry.price_clp - bestPrice.price) / bestPrice.price * 100)}%)
                      </div>
                    )}
                    {ps.product_url && ps.is_available && (
                      <a
                        href={ps.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 block"
                      >
                        Ver en tienda →
                      </a>
                    )}
                  </div>
                )
              })}
              {suppliers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">Sin proveedores configurados</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
