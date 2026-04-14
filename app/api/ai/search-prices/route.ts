/**
 * app/api/ai/search-prices/route.ts
 * POST /api/ai/search-prices
 * Busca precios actuales de productos usando Gemini + Google Search.
 * Aplica rate limiting por usuario antes de llamar a la IA.
 * Guarda los resultados en price_history automáticamente.
 */
import { createClient } from '@/lib/supabase/server'
import { checkAndIncrement } from '@/lib/gemini/rate-limiter'
import { searchPricesBatch } from '@/lib/gemini/price-search'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { productIds } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un productId' },
        { status: 400 }
      )
    }

    if (productIds.length > 10) {
      return NextResponse.json(
        { error: 'Máximo 10 productos por búsqueda' },
        { status: 400 }
      )
    }

    // 1. Verificar rate limit
    const rateCheck = await checkAndIncrement(user.id)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Límite diario de búsquedas IA alcanzado',
          resetAt: (rateCheck as any).resetAt,
          used: rateCheck.used,
        },
        { status: 429 }
      )
    }

    // 2. Obtener datos de productos y sus proveedores
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id, name,
        product_suppliers(
          supplier_id,
          suppliers(id, name, search_url_pattern)
        )
      `)
      .in('id', productIds)
      .eq('user_id', user.id)

    if (productsError || !products) {
      return NextResponse.json({ error: 'Productos no encontrados' }, { status: 404 })
    }

    // 3. Obtener todos los proveedores activos
    const { data: allSuppliers } = await supabase
      .from('suppliers')
      .select('id, name, search_url_pattern')
      .eq('is_active', true)

    // 4. Preparar batch para búsqueda
    const searchBatch = products.map(product => ({
      productId: product.id,
      productName: product.name,
      suppliers: (allSuppliers ?? []).map(s => ({
        id: s.id,
        name: s.name,
        searchUrl: s.search_url_pattern,
      })),
    }))

    // 5. Ejecutar búsqueda con Gemini
    const searchResults = await searchPricesBatch(searchBatch)

    // 6. Guardar resultados en price_history
    const today = new Date().toISOString().split('T')[0]
    const priceInserts = searchResults.flatMap(result =>
      result.results
        .filter(r => r.available && r.priceCLP !== null && r.supplierId)
        .map(r => ({
          product_id: result.productId,
          supplier_id: r.supplierId,
          price_clp: r.priceCLP!,
          recorded_at: today,
          source: 'ai_search' as const,
          is_on_sale: r.isOnSale,
          notes: `Confianza: ${r.confidence}`,
        }))
    )

    if (priceInserts.length > 0) {
      const { error: insertError } = await supabase
        .from('price_history')
        .insert(priceInserts)

      if (insertError) {
        console.error('Error guardando precios:', insertError.message)
      }

      // Actualizar last_checked_at en product_suppliers
      for (const insert of priceInserts) {
        await supabase
          .from('product_suppliers')
          .update({ last_checked_at: new Date().toISOString(), is_available: true })
          .eq('product_id', insert.product_id)
          .eq('supplier_id', insert.supplier_id)
      }
    }

    return NextResponse.json({
      success: true,
      results: searchResults,
      pricesSaved: priceInserts.length,
      rateLimitUsed: rateCheck.used,
      rateLimitRemaining: rateCheck.remaining,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('ai/search-prices error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
