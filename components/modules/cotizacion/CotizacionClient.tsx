'use client'
/**
 * components/modules/cotizacion/CotizacionClient.tsx
 * Motor de cotización con:
 * - Búsqueda y selección de productos
 * - Comparativa de precios por proveedor
 * - Recomendación de consolidación según umbral configurable
 * - Envío directo al stock como compra pendiente
 */
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatCLP, cn } from '@/lib/utils/formatters'
import { useSearchPrices } from '@/hooks/useProducts'

interface QuoteItem {
  productId: string
  productName: string
  qty: number
  prices: Record<string, number | null>  // supplierName → price
  bestSupplier: string | null
  bestPrice: number | null
}

const SUPPLIER_COLORS: Record<string, string> = {
  'Líder':  'bg-red-50 text-red-800 border-red-200',
  'Tottus': 'bg-amber-50 text-amber-800 border-amber-200',
  'Jumbo':  'bg-blue-50 text-blue-800 border-blue-200',
  'Feria':  'bg-teal-50 text-teal-800 border-teal-200',
}

export function CotizacionClient({ products, suppliers, latestPrices }: any) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([])
  const [threshold, setThreshold] = useState(10) // % diferencia para consolidar
  const [preferredSupplier, setPreferredSupplier] = useState('')
  const [isSending, setIsSending] = useState(false)

  const { mutate: searchPrices, isPending: isSearching } = useSearchPrices()

  // Construir índice de precios: productId → supplierName → price
  const priceIndex = useMemo(() => {
    const idx = new Map<string, Map<string, number>>()
    for (const p of latestPrices) {
      if (!idx.has(p.product_id)) idx.set(p.product_id, new Map())
      idx.get(p.product_id)!.set(p.suppliers?.name ?? '', p.price_clp)
    }
    return idx
  }, [latestPrices])

  const supplierNames = suppliers.map((s: any) => s.name)

  // Productos filtrados para el buscador (excluir ya agregados)
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return products
      .filter((p: any) =>
        (p.name.toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q)) &&
        !quoteItems.find(qi => qi.productId === p.id)
      )
      .slice(0, 8)
  }, [search, products, quoteItems])

  const addToQuote = (product: any) => {
    const productPrices = priceIndex.get(product.id) ?? new Map()
    const prices: Record<string, number | null> = {}
    for (const s of supplierNames) {
      prices[s] = productPrices.get(s) ?? null
    }
    const available = Object.entries(prices).filter(([_, v]) => v !== null)
    const best = available.length
      ? available.reduce((a, b) => (a[1]! < b[1]! ? a : b))
      : null

    setQuoteItems(prev => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        qty: 1,
        prices,
        bestSupplier: best?.[0] ?? null,
        bestPrice: best?.[1] ?? null,
      },
    ])
    setSearch('')
  }

  const removeFromQuote = (productId: string) =>
    setQuoteItems(prev => prev.filter(i => i.productId !== productId))

  const updateQty = (productId: string, delta: number) =>
    setQuoteItems(prev =>
      prev.map(i => i.productId === productId
        ? { ...i, qty: Math.max(1, i.qty + delta) }
        : i
      )
    )

  // Totales por proveedor
  const supplierTotals = useMemo(() => {
    const totals: Record<string, { total: number; count: number; missing: string[] }> = {}
    for (const s of supplierNames) {
      totals[s] = { total: 0, count: 0, missing: [] }
    }
    for (const item of quoteItems) {
      for (const s of supplierNames) {
        const price = item.prices[s]
        if (price !== null && price !== undefined) {
          totals[s].total += price * item.qty
          totals[s].count++
        } else {
          totals[s].missing.push(item.productName)
        }
      }
    }
    return totals
  }, [quoteItems, supplierNames])

  // Recomendación inteligente
  const recommendation = useMemo(() => {
    if (quoteItems.length === 0) return null

    const completeSuppliers = Object.entries(supplierTotals)
      .filter(([_, v]) => v.missing.length === 0)
      .sort((a, b) => a[1].total - b[1].total)

    const cheapestComplete = completeSuppliers[0]

    // Calcular diferencia porcentual promedio entre el mejor y el peor precio por producto
    const avgDiff = quoteItems.reduce((sum, item) => {
      const available = Object.values(item.prices).filter(v => v !== null) as number[]
      if (available.length < 2) return sum
      const min = Math.min(...available), max = Math.max(...available)
      return sum + ((max - min) / min) * 100
    }, 0) / quoteItems.length

    const shouldConsolidate = avgDiff <= threshold

    if (shouldConsolidate && cheapestComplete) {
      return {
        type: 'consolidate' as const,
        supplier: cheapestComplete[0],
        total: cheapestComplete[1].total,
        avgDiff,
        message: `Diferencia promedio ${avgDiff.toFixed(1)}% (bajo umbral ${threshold}%). Conviene comprar todo en un portal.`,
      }
    }

    // Compra dividida: cada producto en su mejor proveedor
    const splitTotal = quoteItems.reduce((s, item) => s + (item.bestPrice ?? 0) * item.qty, 0)
    const worstTotal = Object.values(supplierTotals)
      .filter(v => v.missing.length === 0)
      .reduce((max, v) => Math.max(max, v.total), 0)

    return {
      type: 'split' as const,
      supplier: null,
      total: splitTotal,
      avgDiff,
      savings: worstTotal - splitTotal,
      message: `Diferencia promedio ${avgDiff.toFixed(1)}% (sobre umbral ${threshold}%). Conviene dividir la compra.`,
    }
  }, [quoteItems, supplierTotals, threshold])

  // Totales de la cotización
  const totalBestPrice = quoteItems.reduce((s, i) => s + (i.bestPrice ?? 0) * i.qty, 0)
  const totalWorstPrice = useMemo(() => {
    return quoteItems.reduce((s, item) => {
      const available = Object.values(item.prices).filter(v => v !== null) as number[]
      return s + (available.length ? Math.max(...available) : 0) * item.qty
    }, 0)
  }, [quoteItems])

  // Buscar precios con IA para todos los productos de la cotización
  const handleSearchAllPrices = () => {
    if (quoteItems.length === 0) return
    searchPrices(quoteItems.map(i => i.productId), {
      onSuccess: () => router.refresh(),
    })
  }

  // Enviar cotización al stock como compra pendiente
  const handleSendToStock = async () => {
    if (quoteItems.length === 0) return
    setIsSending(true)

    try {
      // Construir ítems según la recomendación
      const items = quoteItems.map(item => {
        const targetSupplier = recommendation?.type === 'consolidate' && recommendation.supplier
          ? recommendation.supplier
          : item.bestSupplier ?? supplierNames[0]
        const price = item.prices[targetSupplier] ?? item.bestPrice ?? 0
        const supplier = suppliers.find((s: any) => s.name === targetSupplier)

        return {
          productId: item.productId,
          supplierId: supplier?.id ?? '',
          qty: item.qty,
          unitPriceCLP: price,
          productName: item.productName,
          supplierName: targetSupplier,
        }
      })

      // Guardar en sessionStorage para que Stock los recupere
      sessionStorage.setItem('pendingPurchaseItems', JSON.stringify(items))

      router.push('/stock?tab=purchase')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controles superiores */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="label">Agregar producto a la cotización</label>
            <div className="relative">
              <input
                className="input"
                placeholder="Buscar por nombre o marca..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoComplete="off"
              />
              {filteredProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                  {filteredProducts.map((p: any) => {
                    const productPrices = priceIndex.get(p.id) ?? new Map()
                    const available = [...productPrices.values()]
                    const minPrice = available.length ? Math.min(...available) : null
                    return (
                      <button
                        key={p.id}
                        onClick={() => addToQuote(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-400">{p.brand} · {p.category}</div>
                        </div>
                        {minPrice && (
                          <span className="text-xs font-semibold text-teal-600">
                            desde {formatCLP(minPrice)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="label">Portal preferido</label>
            <select
              className="select w-auto"
              value={preferredSupplier}
              onChange={e => setPreferredSupplier(e.target.value)}
            >
              <option value="">Auto (mejor precio)</option>
              {supplierNames.map((s: string) => (
                <option key={s} value={s}>Prefiero {s}</option>
              ))}
            </select>
          </div>

          <div className="min-w-48">
            <label className="label">
              Umbral de diferencia: <strong>{threshold}%</strong>
            </label>
            <input
              type="range" min={3} max={30} step={1}
              value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {quoteItems.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Agrega productos para comenzar la cotización</p>
          <p className="text-xs text-gray-400 mt-1">Busca por nombre o marca en el campo de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Lista de cotización — 3 columnas */}
          <div className="lg:col-span-3 flex flex-col gap-4">

            {/* Tabla de productos */}
            <div className="table-wrap">
              <table className="data-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    {supplierNames.map((s: string) => (
                      <th key={s}>{s}</th>
                    ))}
                    <th>Mejor precio</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.map(item => {
                    const availablePrices = Object.entries(item.prices)
                      .filter(([_, v]) => v !== null)
                      .map(([_, v]) => v as number)
                    const minP = availablePrices.length ? Math.min(...availablePrices) : null
                    const maxP = availablePrices.length ? Math.max(...availablePrices) : null
                    const diffPct = minP && maxP && minP !== maxP
                      ? Math.round((maxP - minP) / minP * 100)
                      : 0

                    return (
                      <tr key={item.productId}>
                        <td className="font-medium">{item.productName}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQty(item.productId, -1)}
                              className="w-6 h-6 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center text-sm"
                            >−</button>
                            <span className="text-sm w-5 text-center">{item.qty}</span>
                            <button
                              onClick={() => updateQty(item.productId, 1)}
                              className="w-6 h-6 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center text-sm"
                            >+</button>
                          </div>
                        </td>
                        {supplierNames.map((s: string) => {
                          const price = item.prices[s]
                          const isBest = price !== null && price === minP
                          const isWorst = price !== null && price === maxP && minP !== maxP
                          return (
                            <td key={s}>
                              {price !== null ? (
                                <span className={cn(
                                  'text-sm font-medium',
                                  isBest ? 'text-teal-600' : isWorst ? 'text-coral-600' : 'text-gray-700'
                                )}>
                                  {formatCLP(price)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">No disp.</span>
                              )}
                            </td>
                          )
                        })}
                        <td>
                          <div>
                            <span className="text-sm font-semibold text-teal-600">
                              {formatCLP(item.bestPrice)}
                            </span>
                            <div className="text-xs text-gray-400">{item.bestSupplier}</div>
                          </div>
                          {diffPct > 0 && (
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded font-medium',
                              diffPct <= threshold
                                ? 'bg-teal-50 text-teal-700'
                                : diffPct <= 20
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-coral-50 text-coral-700'
                            )}>
                              Δ{diffPct}%
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => removeFromQuote(item.productId)}
                            className="text-gray-300 hover:text-coral-500 transition-colors text-lg"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="card">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Total mejor precio</div>
                  <div className="text-2xl font-semibold text-teal-600">{formatCLP(totalBestPrice)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Ahorro vs. opción más cara</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {formatCLP(totalWorstPrice - totalBestPrice)}
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <button
                    onClick={handleSearchAllPrices}
                    disabled={isSearching}
                    className="btn"
                  >
                    {isSearching ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Actualizando precios...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Actualizar precios con IA
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSendToStock}
                    disabled={isSending}
                    className="btn-primary"
                  >
                    {isSending ? 'Enviando...' : 'Enviar a compra pendiente →'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Panel derecho — recomendación + comparativa */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Recomendación */}
            {recommendation && (
              <div className={cn(
                'rounded-xl border p-4',
                recommendation.type === 'consolidate'
                  ? 'bg-teal-50 border-teal-300'
                  : 'bg-amber-50 border-amber-300'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                    recommendation.type === 'consolidate'
                      ? 'bg-teal-400 text-white'
                      : 'bg-amber-400 text-white'
                  )}>
                    {recommendation.type === 'consolidate' ? '✓' : '÷'}
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    {recommendation.type === 'consolidate'
                      ? `Consolida todo en ${recommendation.supplier}`
                      : 'Compra dividida recomendada'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-3">{recommendation.message}</p>
                <div className="text-sm font-semibold text-gray-900">
                  Total: {formatCLP(recommendation.total)}
                </div>
                {recommendation.type === 'split' && recommendation.savings > 0 && (
                  <div className="text-xs text-teal-600 mt-1">
                    Ahorro vs. opción más cara: {formatCLP(recommendation.savings)}
                  </div>
                )}
              </div>
            )}

            {/* Comparativa por proveedor */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Comparativa por proveedor</h2>
              <div className="flex flex-col gap-3">
                {supplierNames
                  .map((s: string) => ({ name: s, ...supplierTotals[s] }))
                  .sort((a: any, b: any) => {
                    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length
                    return a.total - b.total
                  })
                  .map((s: any) => {
                    const allTotals = Object.values(supplierTotals)
                      .filter((v: any) => v.missing.length === 0)
                      .map((v: any) => v.total)
                    const minTotal = allTotals.length ? Math.min(...allTotals) : 0
                    const isBest = s.missing.length === 0 && s.total === minTotal && allTotals.length > 0

                    return (
                      <div
                        key={s.name}
                        className={cn(
                          'rounded-lg border p-3',
                          s.missing.length > 0 ? 'opacity-50 border-gray-200' :
                          isBest ? 'border-teal-300 bg-teal-50' : 'border-gray-200'
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={cn(
                              'inline-block px-2 py-0.5 rounded text-xs font-medium border mb-1.5',
                              SUPPLIER_COLORS[s.name] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                            )}>
                              {s.name}
                            </span>
                            <div className="text-xs text-gray-500">
                              {quoteItems.length - s.missing.length}/{quoteItems.length} productos disponibles
                            </div>
                          </div>
                          <div className="text-right">
                            {s.missing.length === 0 ? (
                              <>
                                <div className={cn(
                                  'text-base font-semibold',
                                  isBest ? 'text-teal-700' : 'text-gray-900'
                                )}>
                                  {formatCLP(s.total)}
                                </div>
                                {isBest && (
                                  <div className="text-xs text-teal-600 font-medium">Mejor opción</div>
                                )}
                              </>
                            ) : (
                              <div className="text-sm text-gray-400">Incompleto</div>
                            )}
                          </div>
                        </div>
                        {s.missing.length > 0 && (
                          <div className="mt-1.5 text-xs text-gray-400">
                            Sin stock: {s.missing.join(', ')}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Tabla cruzada de precios */}
            <div className="card overflow-x-auto">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Tabla de precios cruzados</h2>
              <table className="data-table text-xs" style={{ minWidth: 340 }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    {supplierNames.map((s: string) => <th key={s}>{s}</th>)}
                    <th>Δ%</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.map(item => {
                    const available = Object.values(item.prices).filter(v => v !== null) as number[]
                    const minP = available.length ? Math.min(...available) : null
                    const maxP = available.length ? Math.max(...available) : null
                    const diff = minP && maxP ? Math.round((maxP - minP) / minP * 100) : 0

                    return (
                      <tr key={item.productId}>
                        <td className="font-medium max-w-[120px] truncate">{item.productName}</td>
                        {supplierNames.map((s: string) => {
                          const price = item.prices[s]
                          const isBest = price === minP && minP !== null
                          const isWorst = price === maxP && maxP !== null && minP !== maxP
                          return (
                            <td key={s} className={cn(
                              isBest ? 'text-teal-600 font-semibold' :
                              isWorst ? 'text-coral-500' : 'text-gray-600'
                            )}>
                              {price !== null ? `$${(price / 1000).toFixed(1)}k` : <span className="text-gray-200">—</span>}
                            </td>
                          )
                        })}
                        <td>
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-xs font-medium',
                            diff === 0 ? 'bg-gray-100 text-gray-500' :
                            diff <= threshold ? 'bg-teal-50 text-teal-700' :
                            diff <= 20 ? 'bg-amber-50 text-amber-700' : 'bg-coral-50 text-coral-700'
                          )}>
                            {diff}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
