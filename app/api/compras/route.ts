/**
 * app/api/compras/route.ts
 * Confirma una compra desde boleta analizada por IA.
 * Crea/actualiza productos, stock y registra el gasto financiero.
 * Incluye deduplicación: evita registrar la misma boleta dos veces.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      productos = [],
      comercio,
      fecha,
      total_boleta,
      registrar_stock = true,
      supplier_id = null,
      gasto_config = { registrar: false },
    } = body

    // ── 1. Deduplicación ──────────────────────────────────────────────────────
    // Evita cargar la misma boleta dos veces (mismo comercio + fecha + total ±1%)
    if (comercio && fecha && total_boleta) {
      const tolerance = Math.round(total_boleta * 0.01) // 1% de tolerancia
      const { data: existing } = await supabase
        .from('purchase_orders')
        .select('id, purchased_at, total_clp')
        .eq('user_id', user.id)
        .eq('purchased_at', fecha)
        .gte('total_clp', total_boleta - tolerance)
        .lte('total_clp', total_boleta + tolerance)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json(
          {
            error: 'Boleta duplicada',
            message: `Esta boleta ya fue registrada el ${fecha} por $${Math.round(total_boleta).toLocaleString('es-CL')}`,
            orden_existente_id: existing[0].id,
            duplicado: true,
          },
          { status: 409 }
        )
      }
    }

    // ── 2. Resolver supplier ──────────────────────────────────────────────────
    let resolvedSupplierId = supplier_id
    if (!resolvedSupplierId && comercio) {
      const { data: sup } = await supabase
        .from('suppliers')
        .select('id')
        .ilike('name', `%${comercio}%`)
        .eq('is_active', true)
        .limit(1)
        .single()
      resolvedSupplierId = sup?.id ?? null
    }

    // ── 3. Crear/actualizar productos ─────────────────────────────────────────
    const productosCreados: string[] = []
    const productoIds: Array<{ id: string; qty: number; precio: number }> = []

    for (const p of productos) {
      if (!p.nombre_limpio?.trim()) continue

      // Buscar producto existente (por nombre + marca, case-insensitive)
      const { data: existente } = await supabase
        .from('products')
        .select('id, name')
        .eq('user_id', user.id)
        .ilike('name', p.nombre_limpio.trim())
        .limit(1)
        .single()

      let productId: string

      if (existente) {
        productId = existente.id
        // Actualizar precio si cambió
        if (p.precio_unitario > 0 && resolvedSupplierId) {
          await supabase.from('price_history').insert({
            product_id: productId,
            supplier_id: resolvedSupplierId,
            price_clp: Math.round(p.precio_unitario),
            recorded_at: fecha ?? new Date().toISOString().split('T')[0],
            source: 'purchase',
            is_on_sale: false,
          })
        }
      } else {
        // Crear nuevo producto
        const { data: nuevo, error: createErr } = await supabase
          .from('products')
          .insert({
            user_id: user.id,
            name: p.nombre_limpio.trim(),
            brand: p.marca || null,
            category: p.categoria || 'otro',
            type: p.tipo || 'comestible',
            unit: p.unidad || 'unidad',
            quantity: p.cantidad_por_envase || 1,
            storage_location: p.ubicacion_sugerida || null,
            is_breakfast: p.es_desayuno ?? false,
            is_lunch: p.es_almuerzo ?? true,
            is_dinner: p.es_cena ?? true,
            is_snack: p.es_snack ?? false,
            is_active: true,
          })
          .select('id, name')
          .single()

        if (createErr || !nuevo) continue
        productId = nuevo.id
        productosCreados.push(nuevo.name)

        // Registrar precio inicial
        if (p.precio_unitario > 0 && resolvedSupplierId) {
          await supabase.from('price_history').insert({
            product_id: productId,
            supplier_id: resolvedSupplierId,
            price_clp: Math.round(p.precio_unitario),
            recorded_at: fecha ?? new Date().toISOString().split('T')[0],
            source: 'purchase',
            is_on_sale: false,
          })
        }
      }

      productoIds.push({
        id: productId,
        qty: p.cantidad || 1,
        precio: Math.round(p.precio_unitario || 0),
      })
    }

    // ── 4. Actualizar stock ───────────────────────────────────────────────────
    const stockActualizado: string[] = []

    if (registrar_stock) {
      for (const { id: productId, qty } of productoIds) {
        // Obtener stock actual
        const { data: stockActual } = await supabase
          .from('stock')
          .select('current_qty')
          .eq('user_id', user.id)
          .eq('product_id', productId)
          .single()

        const newQty = (stockActual?.current_qty ?? 0) + qty

        const { error: stockErr } = await supabase
          .from('stock')
          .upsert(
            {
              user_id: user.id,
              product_id: productId,
              current_qty: newQty,
              last_purchase_at: fecha ?? new Date().toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,product_id' }
          )

        if (!stockErr) stockActualizado.push(productId)
      }
    }

    // ── 5. Registrar gasto financiero ─────────────────────────────────────────
    let ordenId: string | null = null

    if (gasto_config?.registrar && productoIds.length > 0) {
      const total = total_boleta ?? productoIds.reduce((s, p) => s + p.qty * p.precio, 0)

      const { data: orden, error: ordenErr } = await supabase
        .from('purchase_orders')
        .insert({
          user_id: user.id,
          status: 'confirmed',
          supplier_id: resolvedSupplierId,
          total_clp: Math.round(total),
          cost_center_id: gasto_config.cost_center_id || null,
          purchased_at: fecha ?? new Date().toISOString().split('T')[0],
          notes: gasto_config.notas || `Compra en ${comercio ?? 'comercio'}`,
        })
        .select('id')
        .single()

      if (!ordenErr && orden) {
        ordenId = orden.id

        // Insertar ítems de la orden
        const items = productoIds.map(p => ({
          order_id: orden.id,
          product_id: p.id,
          supplier_id: resolvedSupplierId,
          qty: p.qty,
          unit_price_clp: p.precio,
          is_on_sale: false,
        }))

        if (items.length > 0) {
          await supabase.from('purchase_items').insert(items)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      productos_creados: productosCreados,
      stock_actualizado: stockActualizado,
      orden_id: ordenId,
      total_productos: productoIds.length,
    })
  } catch (err: any) {
    console.error('[POST /api/compras]', err)
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}

// GET: historial de compras del usuario
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        id, purchased_at, total_clp, notes,
        suppliers(name),
        cost_centers(name, icon),
        purchase_items(qty, unit_price_clp, products(name))
      `)
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .order('purchased_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
