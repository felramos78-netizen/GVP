/**
 * app/api/agente/deshacer/route.ts
 * POST /api/agente/deshacer — revierte la última acción ejecutada.
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { session_id } = await request.json()

    // Buscar última acción ejecutada (tiene result, no es solo propuesta, no está revertida)
    const { data: lastActions } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'agent')
      .not('action', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)

    const lastExecuted = lastActions?.find(a =>
      a.action?.result &&
      !a.action?.proposed &&
      !a.action?.reverted &&
      a.action?.tool !== 'deshacer'
    )

    if (!lastExecuted?.action) {
      return NextResponse.json({ error: 'No hay acción reciente para deshacer' })
    }

    const { tool, params } = lastExecuted.action
    let undoText = ''
    let undoOk = false

    switch (tool) {

      case 'actualizar_stock': {
        const { data: prod } = await supabase.from('products').select('id').eq('user_id', user.id).ilike('name', `%${params.product_name}%`).single()
        if (!prod) { undoText = `No encontré "${params.product_name}" para revertir`; break }
        const { data: stock } = await supabase.from('stock').select('id, current_qty').eq('user_id', user.id).eq('product_id', prod.id).single()
        if (!stock) { undoText = 'Sin stock registrado para revertir'; break }
        let prev = stock.current_qty
        if (params.operacion === 'sumar') prev = Math.max(0, stock.current_qty - params.cantidad)
        else if (params.operacion === 'restar') prev = stock.current_qty + params.cantidad
        await supabase.from('stock').update({ current_qty: prev, updated_at: new Date().toISOString() }).eq('id', stock.id)
        undoText = `Stock de "${params.product_name}" revertido a ${prev} ${params.unidad ?? ''}`
        undoOk = true
        break
      }

      case 'crear_producto': {
        const { data: prod } = await supabase.from('products').select('id').eq('user_id', user.id).ilike('name', `%${params.nombre}%`).eq('is_active', true).order('created_at', { ascending: false }).single()
        if (!prod) { undoText = `No encontré "${params.nombre}" para eliminar`; break }
        await supabase.from('products').update({ is_active: false }).eq('id', prod.id)
        undoText = `Producto "${params.nombre}" eliminado`
        undoOk = true
        break
      }

      case 'crear_centro_costo': {
        const { data: cc } = await supabase.from('cost_centers').select('id').eq('user_id', user.id).ilike('name', `%${params.nombre}%`).eq('is_active', true).order('created_at', { ascending: false }).single()
        if (!cc) { undoText = `No encontré el centro "${params.nombre}"`; break }
        await supabase.from('cost_centers').update({ is_active: false }).eq('id', cc.id)
        undoText = `Centro de costo "${params.nombre}" eliminado`
        undoOk = true
        break
      }

      case 'agregar_al_planner': {
        const { error } = await supabase.from('meal_plan').delete().eq('user_id', user.id).eq('plan_date', params.fecha).eq('meal_type', params.tipo_comida)
        undoText = error ? `Error al revertir: ${error.message}` : `${params.tipo_comida} del ${params.fecha} eliminado del planner`
        undoOk = !error
        break
      }

      case 'crear_receta': {
        const { data: rec } = await supabase.from('recipes').select('id').eq('user_id', user.id).ilike('name', `%${params.nombre}%`).eq('is_active', true).order('created_at', { ascending: false }).single()
        if (!rec) { undoText = `No encontré la receta "${params.nombre}"`; break }
        await supabase.from('recipes').update({ is_active: false }).eq('id', rec.id)
        undoText = `Receta "${params.nombre}" eliminada`
        undoOk = true
        break
      }

      default:
        undoText = `La acción "${tool}" no tiene reversión automática disponible`
    }

    // Marcar como revertida
    if (undoOk) {
      await supabase.from('agent_conversations').update({
        action: { ...lastExecuted.action, reverted: true }
      }).eq('id', lastExecuted.id)
    }

    // Registrar la reversión
    await supabase.from('agent_conversations').insert({
      user_id: user.id,
      session_id: session_id ?? lastExecuted.session_id,
      role: 'agent',
      content: `↩️ ${undoText}`,
      action: { tool: 'deshacer', original_tool: tool, ok: undoOk },
    })

    return NextResponse.json({ ok: undoOk, message: undoText })

  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
