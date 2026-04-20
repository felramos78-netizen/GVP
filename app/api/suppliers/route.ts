/**
 * app/api/suppliers/route.ts
 * GET  → lista todos los proveedores activos
 * POST → crea nuevo proveedor
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
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
    if (!body.name?.trim()) return NextResponse.json({ error: 'name requerido' }, { status: 400 })

    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: body.name.trim(),
        type: body.type ?? null,
        base_url: body.base_url?.trim() || null,
        search_url_pattern: body.search_url_pattern?.trim() || null,
        logo_url: body.logo_url?.trim() || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
