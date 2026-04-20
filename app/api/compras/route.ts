/**
 * app/api/compras/route.ts
 * POST /api/compras — confirma una compra importada desde boleta.
 * Guarda stock, historial de precios y gasto en monthly_budget.
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface ProductoBoleta {
  nombre_limpio: string
  marca?: string
  categoria?: string
  tipo?: string
  ubicacion_sugerida?: string
  cantidad: number
  precio_unitario: number
  es_desayuno?: boolean
  es_almuerzo?: boolean
  es_cena?: boolean
  es_snack?: boolean
}

interface GastoConfig {
  registrar: boolean
  tipo: 'puntual' | 'presupuesto'
  cost_center_id: string | null
  notas?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      productos,
      comercio,
      fecha,
      total_boleta,
      registrar_stock,
      guardar_recetas,
      supplier_id,
      gasto_config,
    }: {
      productos: ProductoBoleta[]
      comercio?: string
      fecha?: string
      total_boleta?: number
      registrar_stock: boolean
      guardar_recetas: boolean
      supplier_id?: string | null
      gasto_config: GastoConfig
    } = body

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un producto' }, { status: 400 })
    }

    const purchasedAt = fecha ?? new Date().toISOString().split('T')[0]
    const results = { stock_actualizado: 0, precios_registrados: 0, productos_creados: 0, gasto_registrado: false }

    for (const p of productos) {
      if (!p.nombre_limpio || p.cantidad <= 0) continue

      // Buscar producto existente del usuario
      let { data: existingProduct } = await supabase
        .from('products')
        .select('id, unit')
        .eq('user_id', user.id)
        .ilike('name', p.nombre_limpio)
        .eq('is_active', true)
        .maybeSingle()

      // Crear producto si no existe
      if (!existingProduct) {
        const { data: newProd, error: prodErr } = await supabase
          .from('products')
          .insert({
            user_id: user.id,
            name: p.nombre_limpio,
            brand: p.marca ?? null,
            category: p.categoria ?? 'otro',
            type: p.tipo ?? 'comestible',
            storage_location: p.ubicacion_sugerida ?? 'Despensa',
            unit: 'unidad',
            quantity: p.cantidad,
            is_active: true,
          })
          .select('id, unit')
          .single()

        if (prodErr) continue
        existingProduct = newProd
        results.productos_creados++
      }

      const productId = existingProduct.id
      const unit = existingProduct.unit ?? 'unidad'

      // Actualizar stock
      if (registrar_stock) {
        const { data: stockRow } = await supabase
          .from('stock')
          .select('id, current_qty')
          .eq('user_id', user.id)
          .eq('product_id', productId)
          .maybeSingle()

        if (stockRow) {
          await supabase.from('stock').update({
            current_qty: stockRow.current_qty + p.cantidad,
            updated_at: new Date().toISOString(),
          }).eq('id', stockRow.id)
        } else {
          await supabase.from('stock').insert({
            user_id: user.id,
            product_id: productId,
            current_qty: p.cantidad,
            min_qty: 0,
            unit,
          })
        }
        results.stock_actualizado++
      }

      // Registrar precio en historial si hay proveedor y precio
      if (supplier_id && p.precio_unitario > 0) {
        await supabase.from('price_history').insert({
          product_id: productId,
          supplier_id,
          price_clp: Math.round(p.precio_unitario),
          recorded_at: purchasedAt,
        })
        results.precios_registrados++
      }
    }

    // Registrar gasto en monthly_budget
    if (gasto_config?.registrar && gasto_config.cost_center_id && total_boleta && total_boleta > 0) {
      const yearMonth = purchasedAt.slice(0, 7) // YYYY-MM

      const { data: existing } = await supabase
        .from('monthly_budget')
        .select('id, spent')
        .eq('user_id', user.id)
        .eq('cost_center_id', gasto_config.cost_center_id)
        .eq('year_month', yearMonth)
        .maybeSingle()

      if (existing) {
        await supabase.from('monthly_budget').update({
          spent: (existing.spent ?? 0) + Math.round(total_boleta),
          notes: gasto_config.notas ?? null,
        }).eq('id', existing.id)
      } else {
        const { data: center } = await supabase
          .from('cost_centers')
          .select('monthly_amount')
          .eq('id', gasto_config.cost_center_id)
          .maybeSingle()

        await supabase.from('monthly_budget').insert({
          user_id: user.id,
          cost_center_id: gasto_config.cost_center_id,
          year_month: yearMonth,
          budgeted: center?.monthly_amount ?? 0,
          spent: Math.round(total_boleta),
          notes: gasto_config.notas ?? null,
        })
      }
      results.gasto_registrado = true
    }

    return NextResponse.json({
      ok: true,
      comercio,
      fecha: purchasedAt,
      total_boleta,
      ...results,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
