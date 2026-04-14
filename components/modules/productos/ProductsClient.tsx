'use client'
/**
 * components/modules/productos/ProductsClient.tsx
 * Tabla interactiva de productos con filtros, búsqueda y apertura de ficha.
 */
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatCLP, formatQty, getStockStatus, stockStatusClasses, cn } from '@/lib/utils/formatters'
import type { ProductWithDetails } from '@/lib/db/products'

interface ProductsClientProps {
  initialProducts: ProductWithDetails[]
  categories: string[]
  suppliers: Array<{ id: string; name: string }>
}

const MEAL_LABELS = {
  is_breakfast: 'D',
  is_lunch: 'A',
  is_dinner: 'C',
  is_snack: 'S',
} as const

export function ProductsClient({ initialProducts, categories, suppliers }: ProductsClientProps) {
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')

  const filtered = useMemo(() => {
    return initialProducts.filter(p => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.brand ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCat = !filterCat || p.category === filterCat
      const matchType = !filterType || p.type === filterType
      const matchSupplier = !filterSupplier ||
        p.product_suppliers.some(ps => ps.suppliers?.name === filterSupplier)
      return matchSearch && matchCat && matchType && matchSupplier
    })
  }, [initialProducts, search, filterCat, filterType, filterSupplier])

  const getBestPrice = (p: ProductWithDetails) => {
    const prices = p.product_suppliers
      .filter(ps => ps.is_available)
      .map(ps => {
        // En producción aquí cruzaríamos con price_history
        // Por ahora usamos los datos del supplier directamente
        return null
      })
      .filter(Boolean)
    return null
  }

  const getAplica = (p: ProductWithDetails) => {
    return [
      p.is_breakfast && 'D',
      p.is_lunch && 'A',
      p.is_dinner && 'C',
      p.is_snack && 'S',
    ].filter(Boolean).join(' ')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          className="input max-w-xs"
          placeholder="Buscar producto o marca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="select w-auto" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select w-auto" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="comestible">Comestible</option>
          <option value="bebestible">Bebestible</option>
          <option value="aseo">Aseo</option>
          <option value="mascotas">Mascotas</option>
          <option value="suplemento">Suplemento</option>
        </select>
        <select className="select w-auto" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <Link href="/productos/new" className="btn-primary ml-auto">
          + Nuevo producto
        </Link>
      </div>

      {/* Tabla */}
      <div className="table-wrap">
        <table className="data-table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th>Producto / Marca</th>
              <th>Categoría</th>
              <th>Tipo</th>
              <th>Formato</th>
              <th>Cantidad</th>
              <th>Ubicación</th>
              <th>Dosis</th>
              <th>Vence</th>
              <th>Proveedores</th>
              <th>Aplica</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-8 text-gray-400 text-sm">
                  No se encontraron productos con esos filtros
                </td>
              </tr>
            ) : filtered.map(p => {
              const stockStatus = p.stock
                ? getStockStatus(p.stock.current_qty, p.stock.min_qty)
                : null
              const stockCls = stockStatus ? stockStatusClasses[stockStatus] : null
              const aplica = getAplica(p)
              const supplierNames = p.product_suppliers
                .filter(ps => ps.is_available)
                .map(ps => ps.suppliers?.name)
                .filter(Boolean)
                .join(', ')

              return (
                <tr key={p.id} className="cursor-pointer" onClick={() => {}}>
                  <td>
                    <div className="font-medium text-gray-900">{p.name}</div>
                    {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                  </td>
                  <td>
                    <span className="badge-neutral">{p.category}</span>
                  </td>
                  <td className="text-gray-500 text-xs">{p.type}</td>
                  <td className="text-gray-500 text-xs">{p.format ?? '—'}</td>
                  <td className="text-gray-700 text-xs">{p.quantity} {p.unit}</td>
                  <td className="text-gray-500 text-xs">{p.storage_location ?? '—'}</td>
                  <td className="text-gray-500 text-xs">{p.doses ?? '—'}</td>
                  <td className="text-gray-500 text-xs">{p.shelf_life_days ? `${p.shelf_life_days}d` : '—'}</td>
                  <td className="text-xs text-gray-500">{supplierNames || '—'}</td>
                  <td>
                    <span className="text-xs font-mono text-gray-500">{aplica || '—'}</span>
                  </td>
                  <td>
                    {p.stock && stockCls ? (
                      <div>
                        <span className={cn('text-xs font-medium', stockCls.text)}>
                          {formatQty(p.stock.current_qty, p.stock.unit ?? p.unit)}
                        </span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', stockCls.bg)}
                            style={{
                              width: `${Math.min(100, Math.round(p.stock.current_qty / (p.stock.min_qty * 2) * 100))}%`,
                              background: stockStatus === 'ok' ? '#1D9E75' : stockStatus === 'warning' ? '#BA7517' : '#D85A30'
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">Sin stock</span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/productos/${p.id}`}
                      onClick={e => e.stopPropagation()}
                      className="btn btn-sm"
                    >
                      Ficha →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Mostrando {filtered.length} de {initialProducts.length} productos
      </p>
    </div>
  )
}
