/**
 * app/api/actividades/log/route.ts
 * Registra una actividad como completada en task_log.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { task_id, notes } = body

  if (!task_id) return NextResponse.json({ error: 'task_id requerido' }, { status: 400 })

  // Verificar que la tarea pertenece al usuario
  const { data: task } = await supabase
    .from('cleaning_tasks')
    .select('id')
    .eq('id', task_id)
    .eq('user_id', user.id)
    .single()

  if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

  const { data, error } = await supabase
    .from('task_log')
    .insert({
      task_id,
      user_id: user.id,
      done_at: new Date().toISOString(),
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
