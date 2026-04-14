/**
 * app/api/stock/confirm-purchase/route.ts
 * POST /api/stock/confirm-purchase
 * Confirma una orden de compra completa:
 *   1. Crea purchase_orders + purchase_items
 *   2. Registra precios en price_history
 *   3. Actualiza stock de cada producto
 */
import { createClient } from '@/lib/supabase/server'
import { confirmPurchaseOrder } from '@/lib/db/stock'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { items, mainSupplierId, costCenterId, notes, purchasedAt } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un ítem en la compra' },
        { status: 400 }
      )
    }

    // Validar estructura de cada ítem
    for (const item of items) {
      if (!item.productId || !item.supplierId || !item.qty || !item.unitPriceCLP) {
        return NextResponse.json(
          { error: 'Cada ítem debe tener productId, supplierId, qty y unitPriceCLP' },
          { status: 400 }
        )
      }
    }

    const order = await confirmPurchaseOrder(supabase, user.id, items, {
      mainSupplierId,
      costCenterId,
      notes,
      purchasedAt,
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      totalCLP: order.total_clp,
      itemCount: items.length,
    }, { status: 201 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
