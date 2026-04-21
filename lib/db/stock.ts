/**
 * lib/db/stock.ts
 * Queries para el módulo de stock, inventario y órdenes de compra.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto } from '@/types/database'

type Supabase = SupabaseClient<Database>

export type StockWithProduct = Database['public']['Tables']['stock']['Row'] & {
  products: Database['public']['Tables']['products']['Row']
}

export type PurchaseOrderWithItems = Database['public']['Tables']['purchase_orders']['Row'] & {
  purchase_items: Array<
    Database['public']['Tables']['purchase_items']['Row'] & {
      products: Pick<Database['public']['Tables']['products']['Row'], 'id' | 'name' | 'unit'>
      suppliers: Pick<Database['public']['Tables']['suppliers']['Row'], 'id' | 'name'> | null
    }
  >
}

// ─── Stock ────────────────────────────────────────────────────────────────────

/**
 * Obtiene el inventario completo del usuario con datos del producto.
 */
export async function getStock(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from('stock')
    .select(`
      *,
      products(
        id, name, brand, category, type,
        unit, quantity, shelf_life_days,
        storage_location, is_breakfast, is_lunch, is_dinner, is_snack
      )
    `)
    .eq('user_id', userId)

  if (error) throw new Error(`getStock: ${error.message}`)
  const sorted = (data ?? []).sort((a, b) => {
    const ca = (a as any).products?.category ?? ''
    const cb = (b as any).products?.category ?? ''
    return ca.localeCompare(cb, 'es')
  })
  return sorted as StockWithProduct[]
}

/**
 * Obtiene los productos con stock bajo el mínimo (alertas).
 */
export async function getLowStockAlerts(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from('stock')
    .select(`*, products(id, name, category, unit)`)
    .eq('user_id', userId)
    .order('current_qty', { ascending: true })

  if (error) {
    console.error('getLowStockAlerts:', error.message)
    return []
  }
  return (data ?? []).filter(row => row.current_qty <= row.min_qty)
}

/**
 * Actualiza la cantidad en stock de un producto.
 * Se llama después de confirmar una compra o registrar consumo.
 */
export async function updateStockQty(
  supabase: Supabase,
  userId: string,
  productId: string,
  deltaQty: number, // positivo = agregar, negativo = consumir
  purchaseDate?: string
) {
  // Obtener stock actual
  const { data: current, error: fetchError } = await supabase
    .from('stock')
    .select('current_qty')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single()

  if (fetchError) throw new Error(`updateStockQty fetch: ${fetchError.message}`)

  const newQty = Math.max(0, (current?.current_qty ?? 0) + deltaQty)

  const { error } = await supabase
    .from('stock')
    .update({
      current_qty: newQty,
      ...(purchaseDate && { last_purchase_at: purchaseDate }),
    })
    .eq('user_id', userId)
    .eq('product_id', productId)

  if (error) throw new Error(`updateStockQty update: ${error.message}`)
  return newQty
}

// ─── Órdenes de compra ────────────────────────────────────────────────────────

/**
 * Confirma una orden de compra completa.
 * Ejecuta en secuencia:
 * 1. Crea la orden de compra
 * 2. Crea cada ítem de la orden
 * 3. Registra el precio en price_history
 * 4. Actualiza el stock de cada producto
 */
export async function confirmPurchaseOrder(
  supabase: Supabase,
  userId: string,
  items: Array<{
    productId: string
    supplierId: string
    qty: number
    unitPriceCLP: number
    isOnSale?: boolean
  }>,
  options?: {
    mainSupplierId?: string
    costCenterId?: string
    notes?: string
    purchasedAt?: string
  }
) {
  const purchasedAt = options?.purchasedAt ?? new Date().toISOString().split('T')[0]
  const totalCLP = items.reduce((sum, item) => sum + item.qty * item.unitPriceCLP, 0)

  // 1. Crear orden de compra
  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .insert({
      user_id: userId,
      status: 'confirmed',
      supplier_id: options?.mainSupplierId ?? null,
      total_clp: Math.round(totalCLP),
      cost_center_id: options?.costCenterId ?? null,
      purchased_at: purchasedAt,
      notes: options?.notes ?? null,
    })
    .select()
    .single()

  if (orderError) throw new Error(`confirmPurchase order: ${orderError.message}`)

  // 2. Crear ítems + registrar precios + actualizar stock
  for (const item of items) {
    // 2a. Ítem de la orden
    const { error: itemError } = await supabase.from('purchase_items').insert({
      order_id: order.id,
      product_id: item.productId,
      supplier_id: item.supplierId,
      qty: item.qty,
      unit_price_clp: item.unitPriceCLP,
      is_on_sale: item.isOnSale ?? false,
    })
    if (itemError) throw new Error(`confirmPurchase item: ${itemError.message}`)

    // 2b. Registrar en price_history
    const { error: priceError } = await supabase.from('price_history').insert({
      product_id: item.productId,
      supplier_id: item.supplierId,
      price_clp: item.unitPriceCLP,
      recorded_at: purchasedAt,
      source: 'purchase',
      is_on_sale: item.isOnSale ?? false,
    })
    if (priceError) throw new Error(`confirmPurchase price: ${priceError.message}`)

    // 2c. Actualizar stock (upsert por si no existe el registro)
    const { error: stockError } = await supabase
      .from('stock')
      .upsert(
        {
          user_id: userId,
          product_id: item.productId,
          current_qty: item.qty,
          last_purchase_at: purchasedAt,
        },
        {
          onConflict: 'user_id,product_id',
          // En conflicto: sumar la qty al stock existente
          ignoreDuplicates: false,
        }
      )

    // Si ya existía, sumamos la qty en lugar de reemplazar
    if (!stockError) {
      await updateStockQty(supabase, userId, item.productId, item.qty, purchasedAt)
    } else {
      throw new Error(`confirmPurchase stock: ${stockError.message}`)
    }
  }

  return order
}

/**
 * Obtiene las últimas órdenes de compra confirmadas del usuario.
 */
export async function getPurchaseHistory(
  supabase: Supabase,
  userId: string,
  limit = 20
) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      suppliers(name),
      cost_centers(name, icon),
      purchase_items(
        *,
        products(name, unit),
        suppliers(name)
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('purchased_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getPurchaseHistory:', error.message)
    return []
  }
  return data ?? []
}
