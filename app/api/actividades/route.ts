/**
 * app/api/actividades/route.ts
 * CRUD de actividades (cleaning_tasks).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('cleaning_tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('frequency')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { name, frequency, preferred_day, duration_min, products_needed } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (!['daily','weekly','biweekly','monthly'].includes(frequency)) {
    return NextResponse.json({ error: 'Frecuencia inválida' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cleaning_tasks')
    .insert({
      user_id: user.id,
      name: name.trim(),
      frequency,
      preferred_day: preferred_day || null,
      duration_min: duration_min || null,
      products_needed: products_needed ?? [],
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
