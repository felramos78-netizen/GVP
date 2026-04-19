/**
 * app/api/compras/route.ts
 * POST /api/compras — confirma una compra: crea productos, actualiza stock,
 * registra gasto financiero y guarda recetas sugeridas.
 */
import { createClient } from '@/lib/supabase/server'
import { genAI } from '@/lib/gemini/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const {
      productos,          // lista de productos de la boleta (ya editados por el usuario)
      comercio,           // nombre del comercio
      fecha,              // fecha de compra
      total_boleta,       // total en CLP
      gasto_config,       // { registrar: bool, tipo: 'puntual'|'presupuesto', cost_center_id, notas }
      registrar_stock,    // bool
      guardar_recetas,    // bool
      supplier_id,        // id del proveedor en suppliers table
    } = await request.json()

    const results: any = { productos_creados: [], stock_actualizado: [], orden_id: null, recetas: [] }

    // 1. Obtener o crear supplier
    let supplierId = supplier_id
    if (!supplierId && comercio) {
      const { data: sup } = await supabase
        .from('suppliers')
        .select('id')
        .ilike('name', `%${comercio}%`)
        .single()
      supplierId = sup?.id ?? null
    }

    // 2. Procesar cada producto
    const productIds: string[] = []
    for (const prod of productos) {
      let productId = prod.producto_id_existente

      if (!productId) {
        // Crear producto nuevo
        const { data: newProd } = await supabase.from('products').insert({
          user_id: user.id,
          name: prod.nombre_limpio,
          brand: prod.marca ?? null,
          category: prod.categoria ?? 'otro',
          type: prod.tipo ?? 'comestible',
          unit: prod.unidad ?? 'unidad',
          quantity: prod.cantidad ?? 1,
          storage_location: prod.ubicacion_sugerida ?? 'Despensa',
          is_breakfast: prod.es_desayuno ?? false,
          is_lunch: prod.es_almuerzo ?? false,
          is_dinner: prod.es_cena ?? false,
          is_snack: prod.es_snack ?? false,
          is_active: true,
        }).select().single()

        if (newProd) {
          productId = newProd.id
          results.productos_creados.push(newProd.name)
        }
      }

      if (productId) {
        productIds.push(productId)

        // Registrar precio si tenemos supplier
        if (supplierId && prod.precio_unitario > 0) {
          await supabase.from('price_history').insert({
            product_id: productId,
            supplier_id: supplierId,
            price_clp: prod.precio_unitario,
            recorded_at: fecha ?? new Date().toISOString().split('T')[0],
            source: 'purchase',
          })
        }

        // 3. Actualizar stock si corresponde
        if (registrar_stock) {
          const { data: existing } = await supabase
            .from('stock')
            .select('id, current_qty')
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .single()

          if (existing) {
            await supabase.from('stock').update({
              current_qty: existing.current_qty + (prod.cantidad ?? 1),
              last_purchase_at: fecha ?? new Date().toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id)
          } else {
            await supabase.from('stock').insert({
              user_id: user.id,
              product_id: productId,
              current_qty: prod.cantidad ?? 1,
              min_qty: 0,
              unit: prod.unidad ?? 'unidad',
              last_purchase_at: fecha ?? new Date().toISOString().split('T')[0],
            })
          }
          results.stock_actualizado.push(prod.nombre_limpio)
        }
      }
    }

    // 4. Registrar gasto financiero
    if (gasto_config?.registrar && total_boleta > 0) {
      const { data: orden } = await supabase.from('purchase_orders').insert({
        user_id: user.id,
        status: 'confirmed',
        supplier_id: supplierId ?? null,
        total_clp: Math.round(total_boleta),
        cost_center_id: gasto_config.cost_center_id ?? null,
        purchased_at: fecha ?? new Date().toISOString().split('T')[0],
        notes: gasto_config.notas ?? `Importado desde boleta${comercio ? ' — ' + comercio : ''}`,
      }).select().single()

      if (orden) {
        results.orden_id = orden.id
        // Crear items de la orden
        const orderItems = productos
          .filter((p: any) => p.producto_id_existente || productIds.length > 0)
          .map((p: any, i: number) => ({
            order_id: orden.id,
            product_id: productIds[i] ?? null,
            supplier_id: supplierId ?? null,
            qty: p.cantidad ?? 1,
            unit_price_clp: p.precio_unitario ?? 0,
            is_on_sale: false,
          }))
          .filter((item: any) => item.product_id)

        if (orderItems.length > 0) {
          await supabase.from('purchase_items').insert(orderItems)
        }

        // Si es tipo presupuesto, actualizar el spent del centro de costo
        if (gasto_config.tipo === 'presupuesto' && gasto_config.cost_center_id) {
          const yearMonth = (fecha ?? new Date().toISOString()).substring(0, 7) + '-01'
          const { data: budget } = await supabase
            .from('monthly_budget')
            .select('id, spent')
            .eq('user_id', user.id)
            .eq('cost_center_id', gasto_config.cost_center_id)
            .eq('year_month', yearMonth)
            .single()

          if (budget) {
            await supabase.from('monthly_budget').update({
              spent: budget.spent + Math.round(total_boleta)
            }).eq('id', budget.id)
          } else {
            await supabase.from('monthly_budget').insert({
              user_id: user.id,
              cost_center_id: gasto_config.cost_center_id,
              year_month: yearMonth,
              budgeted: 0,
              spent: Math.round(total_boleta),
            })
          }
        }
      }
    }

    // 5. Generar recetas con los productos comprados
    if (guardar_recetas && productIds.length > 0) {
      const nombresProductos = productos.map((p: any) => p.nombre_limpio).join(', ')
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite-preview-06-17',
        generationConfig: { temperature: 0.7, maxOutputTokens: 3000 },
      })

      const recipePrompt = `Eres un chef nutricionista chileno. El usuario acaba de comprar estos productos: ${nombresProductos}.

Genera 8 recetas variadas (2 desayunos, 3 almuerzos, 2 cenas, 1 snack) usando principalmente estos ingredientes.
Mezcla opciones saludables e indulgentes. Incluye recetas simples y otras más elaboradas.

Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "recetas": [
    {
      "nombre": "...",
      "tipo": "desayuno",
      "kcal": 0,
      "proteinas_g": 0,
      "carbohidratos_g": 0,
      "grasas_g": 0,
      "tiempo_min": 0,
      "instrucciones": "Pasos simples de preparación...",
      "ingredientes_principales": ["producto1", "producto2"],
      "es_saludable": true,
      "dificultad": "fácil"
    }
  ]
}`

      try {
        const recipeResult = await model.generateContent(recipePrompt)
        const recipeText = recipeResult.response.text().replace(/```json|```/g, '').trim()
        const recipeJson = JSON.parse(recipeText.match(/\{[\s\S]*\}/)![0])

        // Guardar recetas en la base de datos
        for (const receta of recipeJson.recetas ?? []) {
          await supabase.from('recipes').insert({
            user_id: user.id,
            name: receta.nombre,
            meal_type: receta.tipo,
            kcal: receta.kcal ?? null,
            protein_g: receta.proteinas_g ?? null,
            carbs_g: receta.carbohidratos_g ?? null,
            fat_g: receta.grasas_g ?? null,
            prep_time_min: receta.tiempo_min ?? null,
            instructions: receta.instrucciones ?? null,
            is_active: true,
          })
          results.recetas.push(receta.nombre)
        }
      } catch (recipeErr) {
        console.error('Error generando recetas:', recipeErr)
      }
    }

    return NextResponse.json({ ok: true, ...results })

  } catch (err) {
    console.error('Compras API error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// GET — historial de compras
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data } = await supabase
      .from('purchase_orders')
      .select(`*, suppliers(name), cost_centers(name,icon), purchase_items(qty, unit_price_clp, products(name,unit))`)
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .order('purchased_at', { ascending: false })
      .limit(50)

    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
