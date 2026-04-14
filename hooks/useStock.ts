'use client'
/**
 * hooks/useStock.ts
 * Hooks para gestionar inventario y confirmar compras.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchStock() {
  const res = await fetch('/api/stock')
  if (!res.ok) throw new Error('Error al cargar stock')
  return res.json()
}

interface PurchaseItem {
  productId: string
  supplierId: string
  qty: number
  unitPriceCLP: number
  isOnSale?: boolean
}

async function confirmPurchaseFn(payload: {
  items: PurchaseItem[]
  mainSupplierId?: string
  costCenterId?: string
  notes?: string
  purchasedAt?: string
}) {
  const res = await fetch('/api/stock/confirm-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Error al confirmar compra')
  }
  return res.json()
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useStock() {
  return useQuery({
    queryKey: ['stock'],
    queryFn: fetchStock,
  })
}

/**
 * Confirma una compra, actualiza stock y registra en price_history.
 * Invalida stock, productos y planner al completarse.
 */
export function useConfirmPurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: confirmPurchaseFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['meal-plan'] })
    },
  })
}
