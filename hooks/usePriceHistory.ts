'use client'
/**
 * hooks/usePriceHistory.ts
 * Hook para consultar y registrar historial de precios.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchPriceHistory(productId: string, supplierId?: string, limit?: number) {
  const params = new URLSearchParams({ productId })
  if (supplierId) params.set('supplierId', supplierId)
  if (limit) params.set('limit', limit.toString())
  const res = await fetch(`/api/price-history?${params}`)
  if (!res.ok) throw new Error('Error al cargar historial')
  return res.json()
}

async function recordPriceFn(data: {
  productId: string
  supplierId: string
  priceCLP: number
  isOnSale?: boolean
  notes?: string
}) {
  const res = await fetch('/api/price-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: data.productId,
      supplier_id: data.supplierId,
      price_clp: data.priceCLP,
      is_on_sale: data.isOnSale ?? false,
      notes: data.notes,
      source: 'manual',
    }),
  })
  if (!res.ok) throw new Error('Error al registrar precio')
  return res.json()
}

export function usePriceHistory(
  productId: string | null,
  options?: { supplierId?: string; limit?: number }
) {
  return useQuery({
    queryKey: ['price-history', productId, options?.supplierId, options?.limit],
    queryFn: () => fetchPriceHistory(productId!, options?.supplierId, options?.limit),
    enabled: !!productId,
  })
}

export function useRecordPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recordPriceFn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-history', variables.productId] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.productId] })
    },
  })
}
