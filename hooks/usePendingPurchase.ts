'use client'
/**
 * hooks/usePendingPurchase.ts
 * Lee los ítems pendientes de compra que el cotizador guardó en sessionStorage.
 * Los pone disponibles para el módulo de Stock.
 */
import { useEffect, useState } from 'react'

export interface PendingItem {
  productId: string
  supplierId: string
  qty: number
  unitPriceCLP: number
  isOnSale?: boolean
  productName: string
  supplierName: string
  selected: boolean
}

const KEY = 'pendingPurchaseItems'

export function usePendingPurchase() {
  const [items, setItems] = useState<PendingItem[]>([])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY)
      if (raw) {
        const parsed: Omit<PendingItem, 'selected'>[] = JSON.parse(raw)
        setItems(parsed.map(i => ({ ...i, selected: false })))
      }
    } catch { /* sessionStorage no disponible en SSR */ }
  }, [])

  const toggleItem = (index: number, value: boolean) =>
    setItems(prev => prev.map((it, i) => i === index ? { ...it, selected: value } : it))

  const updateQty = (index: number, delta: number) =>
    setItems(prev => prev.map((it, i) =>
      i === index ? { ...it, qty: Math.max(1, it.qty + delta) } : it
    ))

  const clearConfirmed = () => {
    const remaining = items.filter(i => !i.selected)
    setItems(remaining)
    if (remaining.length === 0) {
      sessionStorage.removeItem(KEY)
    } else {
      sessionStorage.setItem(KEY, JSON.stringify(remaining))
    }
  }

  const count = items.length
  const selectedCount = items.filter(i => i.selected).length
  const selectedTotal = items
    .filter(i => i.selected)
    .reduce((s, i) => s + i.qty * i.unitPriceCLP, 0)

  return { items, toggleItem, updateQty, clearConfirmed, count, selectedCount, selectedTotal }
}
