/**
 * app/api/price-history/route.ts
 * GET /api/price-history?productId=xxx&supplierId=xxx&limit=20
 * Retorna el historial de precios con filtros opcionales.
 */
import { createClient } from '@/lib/supabase/server'
import { getPriceHistory } from '@/lib/db/products'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const productId  = searchParams.get('productId')
    const supplierId = searchParams.get('supplierId') ?? undefined
    const limit      = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    if (!productId) {
      return NextResponse.json({ error: 'productId es requerido' }, { status: 400 })
    }

    const history = await getPriceHistory(supabase, productId, { supplierId, limit })
    return NextResponse.json(history)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { data, error } = await supabase
      .from('price_history')
      .insert({ ...body, source: body.source ?? 'manual' })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
