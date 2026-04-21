/**
 * app/api/suppliers/[id]/route.ts
 * GET    → proveedor + historial de compras del usuario autenticado
 * PUT    → actualiza datos del proveedor
 * DELETE → desactiva (soft delete)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const [supplierRes, ordersRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', params.id).single(),
      supabase
        .from('purchase_orders')
        .select(`*, purchase_items(*, products(name, unit))`)
        .eq('user_id', user.id)
        .eq('supplier_id', params.id)
        .eq('status', 'confirmed')
        .order('purchased_at', { ascending: false }),
    ])

    if (supplierRes.error) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    return NextResponse.json({ supplier: supplierRes.data, orders: ordersRes.data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.type !== undefined) updates.type = body.type
    if (body.base_url !== undefined) updates.base_url = body.base_url || null
    if (body.logo_url !== undefined) updates.logo_url = body.logo_url || null
    if (body.search_url_pattern !== undefined) updates.search_url_pattern = body.search_url_pattern || null
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: false })
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
