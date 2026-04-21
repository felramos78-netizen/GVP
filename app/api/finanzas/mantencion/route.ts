/**
 * app/api/finanzas/mantencion/route.ts
 * CRUD de entradas de manutención (abonos recibidos).
 *
 * POST { action: 'create', nombre, monto, supplier_id? }
 * POST { action: 'update', id, nombre?, monto?, supplier_id? }
 * POST { action: 'delete', id }
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const { nombre = 'Nuevo abono', monto = 0, supplier_id = null } = body
      const { data, error } = await supabase
        .from('mantencion_entries')
        .insert({ user_id: user.id, nombre, monto, supplier_id, activo: true })
        .select('*, suppliers(id, name)')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ entry: data })
    }

    if (action === 'update') {
      const { id, nombre, monto, supplier_id } = body
      if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
      const updates: Record<string, any> = {}
      if (nombre  !== undefined) updates.nombre = nombre
      if (monto   !== undefined) updates.monto = monto
      if (supplier_id !== undefined) updates.supplier_id = supplier_id || null
      const { data, error } = await supabase
        .from('mantencion_entries')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select('*, suppliers(id, name)')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ entry: data })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
      await supabase
        .from('mantencion_entries')
        .update({ activo: false })
        .eq('id', id)
        .eq('user_id', user.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
