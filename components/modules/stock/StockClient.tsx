'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCLP, formatQty, formatDateShort, getStockStatus, stockStatusClasses, cn } from '@/lib/utils/formatters'
import { useConfirmPurchase } from '@/hooks/useStock'
import { createClient } from '@/lib/supabase/client'

export function StockClient({ stock, alerts, recentPurchases, costCenters, suppliers }: any) {
  const router = useRouter()
  const supabase = createClient()
  const { mutate: confirmPurchase, isPending } = useConfirmPurchase()
  const [activeTab, setActiveTab] = useState<'inventory'|'purchase'|'history'>('inventory')
  const [search, setSearch] = useState('')
  const [editingStock, setEditingStock] = useState<any>(null)
  const [editForm, setEditForm] = useState({ current_qty: '', min_qty: '', unit: '' })
  const [saving, setSaving] = useState(false)

  const filtered = stock.filter((s: any) =>
    !search || s.products?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.products?.category?.toLowerCase().includes(search.toLowerCase())
  )

  const openEdit = (item: any) => {
    setEditingStock(item)
    setEditForm({
      current_qty: item.current_qty?.toString() ?? '0',
      min_qty: item.min_qty?.toString() ?? '0',
      unit: item.unit ?? item.products?.unit ?? '',
    })
  }

  const handleSaveStock = async () => {
    if (!editingStock) return
    setSaving(true)
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: editingStock.product_id,
        current_qty: parseFloat(editForm.current_qty) || 0,
        min_qty: parseFloat(editForm.min_qty) || 0,
        unit: editForm.unit || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingStock(null)
      router.refresh()
    }
  }

  const tabs = [
    { key: 'inventory', label: `Inventario (${stock.length})` },
    { key: 'purchase',  label: 'Compra pendiente' },
    { key: 'history',   label: 'Historial' },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((a: any) => {
            const status = getStockStatus(a.current_qty, a.min_qty)
            return (
              <div key={a.id} className={cn('card border flex items-center justify-between gap-4',
                status === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
              )}>
                <div>
                  <div className="font-medium text-sm">{a.products?.name}</div>
                  <div className="text-xs text-gray-500">{a.current_qty} {a.unit} disponibles</div>
                </div>
                <div className="flex gap-2 items-center">
                  <span className={cn('px-2 py-0.5 rounded text-xs font-semibold',
                    status === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  )}>
                    {status === 'critical' ? 'Crítico' : 'Bajo'}
                  </span>
                  <button onClick={() => openEdit(a)} className="btn btn-sm">Actualizar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {t.key === 'inventory' && alerts.length > 0
              ? <>{t.label} <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{alerts.length}</span></>
              : t.label}
          </button>
        ))}
      </div>

      {/* INVENTARIO */}
      {activeTab === 'inventory' && (
        <div className="flex flex-col gap-3">
          <input className="input max-w-sm" placeholder="Buscar producto o categoría..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {filtered.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-sm text-gray-400">Sin productos en el inventario aún.</p>
              <p className="text-xs text-gray-400 mt-1">Agrega productos en la sección Productos y luego actualiza su stock aquí.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cantidad</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mínimo</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Última compra</th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item: any) => {
                    const status = getStockStatus(item.current_qty, item.min_qty)
                    const { badge } = stockStatusClasses(status)
                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-gray-900">{item.products?.name}</div>
                          <div className="text-xs text-gray-400">{item.products?.category} · {item.products?.brand}</div>
                        </td>
                        <td className="py-2.5 px-3 font-medium">{item.current_qty} {item.unit ?? item.products?.unit}</td>
                        <td className="py-2.5 px-3 text-gray-500">{item.min_qty} {item.unit ?? item.products?.unit}</td>
                        <td className="py-2.5 px-3"><span className={cn('px-2 py-0.5 rounded text-xs font-medium', badge)}>{status === 'ok' ? 'OK' : status === 'low' ? 'Bajo' : 'Crítico'}</span></td>
                        <td className="py-2.5 px-3 text-gray-400 text-xs">{item.last_purchase_at ? formatDateShort(item.last_purchase_at) : '—'}</td>
                        <td className="py-2.5 px-3">
                          <button onClick={() => openEdit(item)} className="btn btn-sm">Editar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* COMPRA PENDIENTE */}
      {activeTab === 'purchase' && (
        <div className="card text-center py-10">
          <p className="text-sm text-gray-400">Los ítems marcados en Cotización aparecerán aquí para confirmar la compra.</p>
        </div>
      )}

      {/* HISTORIAL */}
      {activeTab === 'history' && (
        <div className="card">
          {recentPurchases.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin compras registradas aún.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recentPurchases.map((order: any) => (
                <div key={order.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{order.suppliers?.name ?? 'Proveedor no especificado'}</div>
                      <div className="text-xs text-gray-400">{order.purchased_at}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{formatCLP(order.total_clp ?? 0)}</div>
                  </div>
                  {order.purchase_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-xs text-gray-500 py-0.5">
                      <span>{item.products?.name} × {item.qty}</span>
                      <span>{formatCLP(item.unit_price_clp)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal editar stock */}
      {editingStock && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-gray-900">Editar stock</h3>
              <button onClick={() => setEditingStock(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="text-sm font-medium text-gray-700 mb-4">{editingStock.products?.name}</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Cantidad actual</label>
                <input className="input" type="number" step="0.1" value={editForm.current_qty}
                  onChange={e => setEditForm(p => ({ ...p, current_qty: e.target.value }))} />
              </div>
              <div>
                <label className="label">Cantidad mínima (alerta)</label>
                <input className="input" type="number" step="0.1" value={editForm.min_qty}
                  onChange={e => setEditForm(p => ({ ...p, min_qty: e.target.value }))} />
              </div>
              <div>
                <label className="label">Unidad</label>
                <input className="input" placeholder="kg, litros, unidades..."
                  value={editForm.unit} onChange={e => setEditForm(p => ({ ...p, unit: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditingStock(null)} className="btn flex-1">Cancelar</button>
              <button onClick={handleSaveStock} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
