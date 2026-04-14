import { createClient } from '@/lib/supabase/server'
import { getStock } from '@/lib/db/stock'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const stock = await getStock(supabase, user.id)
    return NextResponse.json(stock)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { product_id, current_qty, min_qty, unit, expiry_date } = body

    if (!product_id) return NextResponse.json({ error: 'product_id requerido' }, { status: 400 })

    const { data, error } = await supabase.from('stock').upsert({
      user_id: user.id,
      product_id,
      current_qty: current_qty ?? 0,
      min_qty: min_qty ?? 0,
      unit: unit ?? null,
      expiry_date: expiry_date ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,product_id' }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
