'use client'
/**
 * components/modules/stock/StockClient.tsx
 * Vista interactiva de inventario con confirmación de compras.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCLP, formatQty, formatDateShort, getStockStatus, stockStatusClasses, cn } from '@/lib/utils/formatters'
import { useConfirmPurchase } from '@/hooks/useStock'

interface PurchaseItem {
  productId: string
  supplierId: string
  qty: number
  unitPriceCLP: number
  isOnSale?: boolean
}

interface PendingItem extends PurchaseItem {
  productName: string
  supplierName: string
  selected: boolean
}

export function StockClient({ stock, alerts, recentPurchases, costCenters, suppliers }: any) {
  const router = useRouter()
  const { mutate: confirmPurchase, isPending } = useConfirmPurchase()

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([
    // Items precargados de ejemplo — en producción vendrían del cotizador
  ])
  const [activeTab, setActiveTab] = useState<'inventory' | 'purchase' | 'history'>('inventory')

  const totalSelected = pendingItems
    .filter(i => i.selected)
    .reduce((s, i) => s + i.qty * i.unitPriceCLP, 0)

  const handleConfirm = () => {
    const selected = pendingItems.filter(i => i.selected)
    if (!selected.length) return

    confirmPurchase(
      {
        items: selected.map(i => ({
          productId: i.productId,
          supplierId: i.supplierId,
          qty: i.qty,
          unitPriceCLP: i.unitPriceCLP,
          isOnSale: i.isOnSale,
        })),
        purchasedAt: new Date().toISOString().split('T')[0],
      },
      {
        onSuccess: () => {
          setPendingItems(prev => prev.filter(i => !i.selected))
          router.refresh()
          alert(`✓ Compra confirmada. Stock actualizado. El planner refleja los cambios.`)
        },
      }
    )
  }

  const tabs = [
    { key: 'inventory', label: `Inventario (${stock.length})` },
    { key: 'purchase', label: `Compra pendiente (${pendingItems.length})` },
    { key: 'history', label: 'Historial de compras' },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <span className="metric-label">Productos</span>
          <span className="metric-value text-gray-900">{stock.length}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Alertas</span>
          <span className={`metric-value ${alerts.length > 0 ? 'text-coral-600' : 'text-teal-600'}`}>
            {alerts.length}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Pendiente de compra</span>
          <span className="metric-value text-amber-600">{pendingItems.length}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total seleccionado</span>
          <span className="metric-value text-blue-600">{formatCLP(totalSelected)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Inventario */}
      {activeTab === 'inventory' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Cantidad actual</th>
                <th>Mínimo</th>
                <th>Estado</th>
                <th>Ubicación</th>
                <th>Última compra</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((item: any) => {
                const status = getStockStatus(item.current_qty, item.min_qty)
                const cls = stockStatusClasses[status]
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-medium">{item.products?.name}</div>
                      <div className="text-xs text-gray-400">{item.products?.type}</div>
                    </td>
                    <td><span className="badge-neutral">{item.products?.category}</span></td>
                    <td className={cn('font-medium', cls.text)}>
                      {formatQty(item.current_qty, item.unit ?? item.products?.unit ?? '')}
                    </td>
                    <td className="text-gray-500 text-sm">
                      {formatQty(item.min_qty, item.unit ?? '')}
                    </td>
                    <td>
                      <span className={`badge-${status === 'ok' ? 'ok' : status === 'warning' ? 'warning' : 'critical'}`}>
                        {status === 'ok' ? 'OK' : status === 'warning' ? 'Alerta' : 'Crítico'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">{item.products?.storage_location ?? '—'}</td>
                    <td className="text-sm text-gray-500">{formatDateShort(item.last_purchase_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Compra pendiente */}
      {activeTab === 'purchase' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Los productos pendientes vienen del cotizador. Marca los que compraste para actualizar el stock.
          </p>
          {pendingItems.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm text-gray-400">Sin compras pendientes.</p>
              <p className="text-xs text-gray-400 mt-1">
                Ve a Cotización para armar tu lista de compras.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Producto</th>
                      <th>Proveedor</th>
                      <th>Cant.</th>
                      <th>Precio unit.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingItems.map((item, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={e => setPendingItems(prev =>
                              prev.map((it, idx) => idx === i ? { ...it, selected: e.target.checked } : it)
                            )}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="font-medium">{item.productName}</td>
                        <td><span className="badge-info">{item.supplierName}</span></td>
                        <td>{item.qty}</td>
                        <td>{formatCLP(item.unitPriceCLP)}</td>
                        <td className="font-medium">{formatCLP(item.qty * item.unitPriceCLP)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Total seleccionado: <strong className="text-gray-900">{formatCLP(totalSelected)}</strong>
                </span>
                <button
                  onClick={handleConfirm}
                  disabled={isPending || pendingItems.filter(i => i.selected).length === 0}
                  className="btn-success"
                >
                  {isPending ? 'Confirmando...' : 'Confirmar compra y actualizar stock'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Historial */}
      {activeTab === 'history' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Total</th>
                <th>Ítems</th>
                <th>Centro de costo</th>
              </tr>
            </thead>
            <tbody>
              {recentPurchases.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400">Sin compras registradas</td></tr>
              ) : recentPurchases.map((order: any) => (
                <tr key={order.id}>
                  <td className="text-gray-600">{formatDateShort(order.purchased_at)}</td>
                  <td><span className="badge-info">{order.suppliers?.name ?? 'Varios'}</span></td>
                  <td className="font-medium text-teal-600">{formatCLP(order.total_clp)}</td>
                  <td className="text-gray-500">{order.purchase_items?.length ?? 0} productos</td>
                  <td className="text-gray-500">
                    {order.cost_centers ? `${order.cost_centers.icon} ${order.cost_centers.name}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
