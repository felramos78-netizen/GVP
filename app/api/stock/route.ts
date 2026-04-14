/**
 * app/api/stock/route.ts
 * GET /api/stock → inventario completo del usuario
 */
import { createClient } from '@/lib/supabase/server'
import { getStock } from '@/lib/db/stock'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const stock = await getStock(supabase, user.id)
    return NextResponse.json(stock)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
