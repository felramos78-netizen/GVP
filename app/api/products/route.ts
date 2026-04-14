/**
 * app/api/products/route.ts
 * GET  /api/products  → lista de productos del usuario (con filtros)
 * POST /api/products  → crear nuevo producto
 */
import { createClient } from '@/lib/supabase/server'
import { getProducts, createProduct } from '@/lib/db/products'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const filters = {
      category:   searchParams.get('category')   ?? undefined,
      type:       searchParams.get('type')        ?? undefined,
      supplierId: searchParams.get('supplierId')  ?? undefined,
      search:     searchParams.get('search')      ?? undefined,
    }

    const products = await getProducts(supabase, user.id, filters)
    return NextResponse.json(products)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { initialStock, ...productData } = body

    const product = await createProduct(
      supabase,
      { ...productData, user_id: user.id },
      initialStock
    )
    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
