'use client'
/**
 * components/modules/compras/ProveedoresClient.tsx
 * Módulo de Proveedores — fichas con historial de compras por proveedor.
 */
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/formatters'
import { Modal } from '@/components/ui/Modal'
import type { Supplier } from '@/types/database'

const TYPE_LABELS: Record<string, string> = {
  supermercado: 'Supermercado',
  feria: 'Feria',
  online: 'Online',
}
const TYPE_ICONS: Record<string, string> = {
  supermercado: '🛒',
  feria: '🏪',
  online: '🌐',
}
const TYPE_COLORS: Record<string, string> = {
  supermercado: 'bg-blue-100 text-blue-700',
  feria: 'bg-green-100 text-green-700',
  online: 'bg-purple-100 text-purple-700',
}

interface PurchaseOrder {
  id: string
  purchased_at: string | null
  total_clp: number | null
  notes: string | null
  supplier_id: string | null
  purchase_items: Array<{
    qty: number
    unit_price_clp: number
    products: { name: string; unit: string } | null
  }>
}

interface ProveedoresClientProps {
  suppliers: Supplier[]
  purchases: PurchaseOrder[]
}

interface SupplierForm {
  name: string
  type: 'supermercado' | 'feria' | 'online' | ''
  base_url: string
  logo_url: string
}

const emptyForm = (): SupplierForm => ({ name: '', type: '', base_url: '', logo_url: '' })

export function ProveedoresClient({ suppliers: initialSuppliers, purchases }: ProveedoresClientProps) {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const formatCLP = (n: number) => Math.round(n).toLocaleString('es-CL')
  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Stats por proveedor (calculados desde purchases ya cargados)
  const statsBySupplier = useMemo(() => {
    const map: Record<string, { count: number; total: number; lastDate: string | null }> = {}
    for (const order of purchases) {
      if (!order.supplier_id) continue
      const s = map[order.supplier_id] ?? { count: 0, total: 0, lastDate: null }
      s.count++
      s.total += order.total_clp ?? 0
      if (!s.lastDate || (order.purchased_at && order.purchased_at > s.lastDate)) {
        s.lastDate = order.purchased_at
      }
      map[order.supplier_id] = s
    }
    return map
  }, [purchases])

  // Compras por proveedor para el historial expandido
  const purchasesBySupplier = useMemo(() => {
    const map: Record<string, PurchaseOrder[]> = {}
    for (const order of purchases) {
      if (!order.supplier_id) continue
      if (!map[order.supplier_id]) map[order.supplier_id] = []
      map[order.supplier_id].push(order)
    }
    return map
  }, [purchases])

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
      const matchType = !filterType || s.type === filterType
      return matchSearch && matchType
    })
  }, [suppliers, search, filterType])

  const openCreate = () => {
    setEditingSupplier(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s)
    setForm({
      name: s.name,
      type: (s.type as SupplierForm['type']) ?? '',
      base_url: s.base_url ?? '',
      logo_url: s.logo_url ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type || null,
        base_url: form.base_url.trim() || null,
        logo_url: form.logo_url.trim() || null,
      }

      if (editingSupplier) {
        const res = await fetch(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(await res.text())
        const updated: Supplier = await res.json()
        setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s))
      } else {
        const res = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(await res.text())
        const created: Supplier = await res.json()
        setSuppliers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setModalOpen(false)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (s: Supplier) => {
    if (!confirm(`¿Desactivar el proveedor "${s.name}"? No se borrará su historial.`)) return
    try {
      const res = await fetch(`/api/suppliers/${s.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setSuppliers(prev => prev.filter(p => p.id !== s.id))
      if (expandedId === s.id) setExpandedId(null)
    } catch (err) {
      alert('Error al desactivar: ' + (err as Error).message)
    }
  }

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id)

  return (
    <div className="flex flex-col gap-4">

      {/* Barra de filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="input max-w-xs"
          placeholder="Buscar proveedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="select max-w-[180px]" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="supermercado">Supermercado</option>
          <option value="feria">Feria</option>
          <option value="online">Online</option>
        </select>
        <button onClick={openCreate} className="btn-primary ml-auto">
          + Nuevo proveedor
        </button>
      </div>

      {/* Estado vacío */}
      {filtered.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-3xl mb-3">🏪</div>
          <div className="text-sm text-gray-500 mb-4">
            {search || filterType ? 'Sin resultados para esa búsqueda.' : 'Aún no hay proveedores registrados.'}
          </div>
          {!search && !filterType && (
            <button onClick={openCreate} className="btn">Agregar primer proveedor</button>
          )}
        </div>
      )}

      {/* Grid de fichas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(supplier => {
          const stats = statsBySupplier[supplier.id] ?? { count: 0, total: 0, lastDate: null }
          const isExpanded = expandedId === supplier.id
          const supplierOrders = purchasesBySupplier[supplier.id] ?? []

          return (
            <div key={supplier.id} className="flex flex-col">
              {/* Card principal */}
              <div className={cn(
                'card flex flex-col gap-3 transition-all',
                isExpanded ? 'rounded-b-none border-b-0' : ''
              )}>
                {/* Header de la ficha */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl w-10 h-10 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100">
                      {supplier.logo_url ? (
                        <img src={supplier.logo_url} alt={supplier.name} className="w-8 h-8 object-contain rounded" />
                      ) : (
                        TYPE_ICONS[supplier.type ?? ''] ?? '🏢'
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{supplier.name}</div>
                      {supplier.type && (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TYPE_COLORS[supplier.type] ?? 'bg-gray-100 text-gray-600')}>
                          {TYPE_LABELS[supplier.type]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(supplier)}
                      className="text-xs px-2 py-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Editar proveedor"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeactivate(supplier)}
                      className="text-xs px-2 py-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Desactivar proveedor"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Estadísticas de compras */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <div className="text-base font-bold text-gray-900">{stats.count}</div>
                    <div className="text-xs text-gray-400">compras</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <div className="text-sm font-bold text-gray-900">
                      {stats.total > 0 ? `$${formatCLP(stats.total)}` : '—'}
                    </div>
                    <div className="text-xs text-gray-400">total</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <div className="text-xs font-semibold text-gray-900 leading-tight">
                      {stats.lastDate ? formatDate(stats.lastDate) : '—'}
                    </div>
                    <div className="text-xs text-gray-400">última</div>
                  </div>
                </div>

                {supplier.base_url && (
                  <a
                    href={supplier.base_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate"
                  >
                    🔗 {supplier.base_url}
                  </a>
                )}

                {/* Botón historial */}
                <button
                  onClick={() => toggleExpand(supplier.id)}
                  className={cn(
                    'w-full text-xs font-medium py-2 rounded-lg border transition-all',
                    isExpanded
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {isExpanded ? '▲ Ocultar historial' : `📋 Ver historial${stats.count > 0 ? ` (${stats.count})` : ''}`}
                </button>
              </div>

              {/* Historial expandido */}
              {isExpanded && (
                <div className="border border-gray-200 border-t-0 rounded-b-xl bg-gray-50 p-3">
                  {supplierOrders.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="text-2xl mb-2">📭</div>
                      <p className="text-xs text-gray-400">Sin compras registradas en este proveedor.</p>
                      <p className="text-xs text-gray-400 mt-1">Importa una boleta de {supplier.name} para verla aquí.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                        Historial de compras
                      </div>
                      {supplierOrders.map(order => {
                        const items = order.purchase_items ?? []
                        const productNames = items
                          .map(i => i.products?.name)
                          .filter(Boolean)
                        const shown = productNames.slice(0, 4)
                        const extra = productNames.length - shown.length

                        return (
                          <div key={order.id} className="bg-white rounded-lg border border-gray-100 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs text-gray-500">{formatDate(order.purchased_at)}</div>
                              <div className="text-sm font-semibold text-gray-900">
                                ${formatCLP(order.total_clp ?? 0)}
                              </div>
                            </div>
                            {order.notes && (
                              <div className="text-xs text-gray-400 italic mb-2">{order.notes}</div>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {shown.map((name, i) => (
                                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  {name} ×{items[i]?.qty ?? 1}
                                </span>
                              ))}
                              {extra > 0 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">
                                  +{extra} más
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal crear / editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSupplier ? `Editar — ${editingSupplier.name}` : 'Nuevo proveedor'}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Nombre *</label>
            <input
              className="input"
              placeholder="ej: Líder, Jumbo, Feria Lo Valledor"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select
              className="select"
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as SupplierForm['type'] }))}
            >
              <option value="">Sin clasificar</option>
              <option value="supermercado">🛒 Supermercado</option>
              <option value="feria">🏪 Feria</option>
              <option value="online">🌐 Online</option>
            </select>
          </div>
          <div>
            <label className="label">URL del sitio web</label>
            <input
              className="input"
              placeholder="https://www.lider.cl"
              value={form.base_url}
              onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">URL del logo</label>
            <input
              className="input"
              placeholder="https://..."
              value={form.logo_url}
              onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            />
            {form.logo_url && (
              <img src={form.logo_url} alt="preview" className="mt-2 h-10 object-contain rounded border border-gray-100" />
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => setModalOpen(false)} className="btn flex-1">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Guardando...' : editingSupplier ? 'Guardar cambios' : 'Crear proveedor'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
