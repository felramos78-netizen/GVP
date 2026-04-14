/**
 * lib/db/products.ts
 * Queries de base de datos para el módulo de productos.
 * Todas las funciones reciben el cliente de Supabase como argumento
 * para poder usarse tanto en server como en client contexts.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto, UpdateDto } from '@/types/database'

type Supabase = SupabaseClient<Database>

// ─── Tipos extendidos con joins ────────────────────────────────────────────────

export type ProductWithDetails = Database['public']['Tables']['products']['Row'] & {
  stock: Database['public']['Tables']['stock']['Row'] | null
  product_suppliers: Array<
    Database['public']['Tables']['product_suppliers']['Row'] & {
      suppliers: Database['public']['Tables']['suppliers']['Row']
    }
  >
}

export type ProductWithPriceHistory = ProductWithDetails & {
  price_history: Database['public']['Tables']['price_history']['Row'][]
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Obtiene todos los productos activos del usuario con stock y proveedores.
 */
export async function getProducts(
  supabase: Supabase,
  userId: string,
  filters?: {
    category?: string
    type?: string
    supplierId?: string
    search?: string
  }
) {
  let query = supabase
    .from('products')
    .select(`
      *,
      stock(*),
      product_suppliers(
        *,
        suppliers(*)
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }
  if (filters?.type) {
    query = query.eq('type', filters.type)
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`getProducts: ${error.message}`)
  return data as ProductWithDetails[]
}

/**
 * Obtiene un producto por ID con todos sus detalles, historial de precios
 * e historial de compras.
 */
export async function getProductById(
  supabase: Supabase,
  productId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      stock(*),
      product_suppliers(
        *,
        suppliers(*)
      ),
      price_history(
        *,
        suppliers(name)
      ),
      recipe_ingredients(
        *,
        recipes(id, name, meal_type)
      )
    `)
    .eq('id', productId)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`getProductById: ${error.message}`)
  return data
}

/**
 * Obtiene el historial de precios de un producto por proveedor,
 * ordenado por fecha descendente.
 */
export async function getPriceHistory(
  supabase: Supabase,
  productId: string,
  options?: { supplierId?: string; limit?: number }
) {
  let query = supabase
    .from('price_history')
    .select(`*, suppliers(name)`)
    .eq('product_id', productId)
    .order('recorded_at', { ascending: false })

  if (options?.supplierId) {
    query = query.eq('supplier_id', options.supplierId)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw new Error(`getPriceHistory: ${error.message}`)
  return data
}

/**
 * Obtiene el historial de compras de un producto específico.
 * Cruza purchase_items con purchase_orders para obtener fecha y proveedor.
 */
export async function getProductPurchaseHistory(
  supabase: Supabase,
  productId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('purchase_items')
    .select(`
      id,
      qty,
      unit_price_clp,
      
      is_on_sale,
      suppliers(name),
      purchase_orders!inner(
        purchased_at,
        status,
        user_id
      )
    `)
    .eq('product_id', productId)
    .eq('purchase_orders.user_id', userId)
    .eq('purchase_orders.status', 'confirmed')
    .order('purchase_orders(purchased_at)', { ascending: false })
    .limit(20)

  if (error) throw new Error(`getProductPurchaseHistory: ${error.message}`)
  return data
}

/**
 * Crea un nuevo producto con su registro de stock inicial.
 * Usa una transacción implícita: si el stock falla, el producto se revierte.
 */
export async function createProduct(
  supabase: Supabase,
  product: InsertDto<'products'>,
  initialStock?: { current_qty: number; min_qty: number; unit: string }
) {
  // 1. Crear producto
  const { data: newProduct, error: productError } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single()

  if (productError) throw new Error(`createProduct: ${productError.message}`)

  // 2. Crear registro de stock si se proporcionó
  if (initialStock) {
    const { error: stockError } = await supabase.from('stock').insert({
      user_id: product.user_id,
      product_id: newProduct.id,
      current_qty: initialStock.current_qty,
      min_qty: initialStock.min_qty,
      unit: initialStock.unit,
    })
    if (stockError) {
      // Revertir producto creado
      await supabase.from('products').delete().eq('id', newProduct.id)
      throw new Error(`createProduct stock: ${stockError.message}`)
    }
  }

  return newProduct
}

/**
 * Actualiza un producto. Verifica que pertenezca al usuario.
 */
export async function updateProduct(
  supabase: Supabase,
  productId: string,
  userId: string,
  updates: UpdateDto<'products'>
) {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(`updateProduct: ${error.message}`)
  return data
}

/**
 * Soft delete — marca el producto como inactivo en lugar de eliminarlo.
 * Preserva el historial de compras y precios.
 */
export async function archiveProduct(
  supabase: Supabase,
  productId: string,
  userId: string
) {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', productId)
    .eq('user_id', userId)

  if (error) throw new Error(`archiveProduct: ${error.message}`)
}

/**
 * Agrega o actualiza la relación producto-proveedor con su URL.
 */
export async function upsertProductSupplier(
  supabase: Supabase,
  data: InsertDto<'product_suppliers'>
) {
  const { error } = await supabase
    .from('product_suppliers')
    .upsert(data, { onConflict: 'product_id,supplier_id' })

  if (error) throw new Error(`upsertProductSupplier: ${error.message}`)
}

/**
 * Registra un precio manualmente en el historial.
 */
export async function recordPrice(
  supabase: Supabase,
  entry: InsertDto<'price_history'>
) {
  const { data, error } = await supabase
    .from('price_history')
    .insert(entry)
    .select()
    .single()

  if (error) throw new Error(`recordPrice: ${error.message}`)
  return data
}

/**
 * Obtiene categorías únicas de productos del usuario.
 * Útil para poblar filtros dinámicamente.
 */
export async function getProductCategories(
  supabase: Supabase,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) throw new Error(`getProductCategories: ${error.message}`)
  return [...new Set(data.map(p => p.category))].sort()
}
