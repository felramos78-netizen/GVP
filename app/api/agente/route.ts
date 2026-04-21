/**
 * app/api/agente/route.ts — Mesa de Ayuda IA
 * Usa gemini-1.5-flash (mayor cuota gratuita que 2.0-flash)
 */
import { createClient } from '@/lib/supabase/server'
import { genAI } from '@/lib/gemini/client'
import { NextRequest, NextResponse } from 'next/server'

const TOOLS = [
  { name: 'consultar_stock', description: 'Consulta el inventario actual del usuario.' },
  { name: 'actualizar_stock', description: 'Actualiza la cantidad de un producto.', parameters: { product_name: 'string', cantidad: 'number', operacion: 'sumar|restar|fijar' } },
  { name: 'crear_producto', description: 'Crea un nuevo producto en el catálogo.', parameters: { nombre: 'string', categoria: 'string', tipo: 'string', unidad: 'string', precio: 'number' } },
  { name: 'consultar_finanzas', description: 'Consulta ingreso, gastos por centro y saldo del mes.' },
  { name: 'crear_centro_costo', description: 'Crea un nuevo centro de costo.', parameters: { nombre: 'string', tipo: 'gasto_fijo|variable|ahorro|meta', monto: 'number', icono: 'string' } },
  { name: 'agregar_al_planner', description: 'Agrega una comida al planner.', parameters: { fecha: 'YYYY-MM-DD', tipo_comida: 'desayuno|almuerzo|cena|snack', descripcion: 'string' } },
  { name: 'consultar_planner', description: 'Consulta el plan de comidas de la semana.' },
  { name: 'crear_receta', description: 'Crea una receta en el recetario.', parameters: { nombre: 'string', tipo: 'desayuno|almuerzo|cena|snack', instrucciones: 'string' } },
  { name: 'consultar_recetas', description: 'Lista las recetas disponibles.' },
  { name: 'sugerir_recetas_con_stock', description: 'Sugiere recetas con el stock actual.' },
  { name: 'reportar_bug', description: 'Reporta un error en el sistema.', parameters: { descripcion: 'string', pagina: 'string' } },
  { name: 'consultar_historial_compras', description: 'Muestra las últimas compras registradas.' },
]

async function executeTool(toolName: string, params: any, supabase: any, userId: string) {
  switch (toolName) {
    case 'consultar_stock': {
      const { data } = await supabase.from('stock').select('current_qty, min_qty, unit, products(name, category)').eq('user_id', userId)
      return data?.map((s: any) => ({ producto: s.products?.name, cantidad: s.current_qty, minimo: s.min_qty, unidad: s.unit, estado: s.current_qty <= s.min_qty ? 'bajo' : 'ok' })) ?? []
    }
    case 'actualizar_stock': {
      const { data: prod } = await supabase.from('products').select('id').eq('user_id', userId).ilike('name', `%${params.product_name}%`).single()
      if (!prod) return { error: `No encontré "${params.product_name}"` }
      const { data: stock } = await supabase.from('stock').select('id, current_qty').eq('user_id', userId).eq('product_id', prod.id).single()
      let newQty = params.cantidad
      if (params.operacion === 'sumar') newQty = (stock?.current_qty ?? 0) + params.cantidad
      if (params.operacion === 'restar') newQty = Math.max(0, (stock?.current_qty ?? 0) - params.cantidad)
      if (stock) await supabase.from('stock').update({ current_qty: newQty, updated_at: new Date().toISOString() }).eq('id', stock.id)
      else await supabase.from('stock').insert({ user_id: userId, product_id: prod.id, current_qty: newQty, min_qty: 0 })
      return { ok: true, producto: params.product_name, cantidad_nueva: newQty }
    }
    case 'crear_producto': {
      const { data } = await supabase.from('products').insert({ user_id: userId, name: params.nombre, category: params.categoria ?? 'otro', type: params.tipo ?? 'comestible', unit: params.unidad ?? 'unidad', quantity: 1, is_active: true }).select().single()
      return { ok: true, producto_creado: data?.name }
    }
    case 'consultar_finanzas': {
      const { data: profile } = await supabase.from('users').select('monthly_income, pay_day').eq('id', userId).single()
      const { data: centers } = await supabase.from('cost_centers').select('name, monthly_amount, type, icon').eq('user_id', userId).eq('is_active', true)
      const total = (centers ?? []).reduce((a: number, c: any) => a + c.monthly_amount, 0)
      return { ingreso: profile?.monthly_income ?? 0, total_asignado: total, saldo_libre: (profile?.monthly_income ?? 0) - total, centros: centers ?? [] }
    }
    case 'crear_centro_costo': {
      const { data } = await supabase.from('cost_centers').insert({ user_id: userId, name: params.nombre, icon: params.icono ?? '💰', type: params.tipo ?? 'variable', monthly_amount: params.monto ?? 0, is_active: true, sort_order: 99 }).select().single()
      return { ok: true, centro_creado: data?.name }
    }
    case 'agregar_al_planner': {
      const { error } = await supabase.from('meal_plan').upsert({ user_id: userId, plan_date: params.fecha, meal_type: params.tipo_comida, free_text: params.descripcion, mode: 'home' }, { onConflict: 'user_id,plan_date,meal_type' })
      return error ? { error: error.message } : { ok: true }
    }
    case 'consultar_planner': {
      const today = new Date()
      const monday = new Date(today)
      monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1))
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
      const { data } = await supabase.from('meal_plan').select('plan_date, meal_type, free_text').eq('user_id', userId).gte('plan_date', monday.toISOString().split('T')[0]).lte('plan_date', sunday.toISOString().split('T')[0]).order('plan_date')
      return data ?? []
    }
    case 'crear_receta': {
      const { data } = await supabase.from('recipes').insert({ user_id: userId, name: params.nombre, meal_type: params.tipo, instructions: params.instrucciones ?? null, is_active: true }).select().single()
      return { ok: true, receta_creada: data?.name }
    }
    case 'consultar_recetas': {
      const { data } = await supabase.from('recipes').select('name, meal_type, kcal, prep_time_min').eq('user_id', userId).eq('is_active', true).order('name')
      return data ?? []
    }
    case 'sugerir_recetas_con_stock': {
      const { data: stock } = await supabase.from('stock').select('current_qty, products(name, type)').eq('user_id', userId).gt('current_qty', 0)
      const items = (stock ?? []).filter((s: any) => s.products?.type === 'comestible').map((s: any) => s.products?.name).join(', ')
      return { ingredientes_disponibles: items }
    }
    case 'reportar_bug': {
      await supabase.from('bug_reports').insert({ user_id: userId, page: params.pagina ?? 'desconocida', description: params.descripcion, status: 'pending' })
      return { ok: true }
    }
    case 'consultar_historial_compras': {
      const { data } = await supabase.from('purchase_orders').select('purchased_at, total_clp, suppliers(name)').eq('user_id', userId).eq('status', 'confirmed').order('purchased_at', { ascending: false }).limit(5)
      return data ?? []
    }
    default: return { error: `Herramienta "${toolName}" no disponible` }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { message, session_id, page, history, approved_action } = await request.json()

    await supabase.from('agent_conversations').insert({ user_id: user.id, session_id, role: 'user', content: message, page: page ?? null })

    if (approved_action) {
      const result = await executeTool(approved_action.tool, approved_action.params, supabase, user.id)
      const responseText = result.error ? `❌ ${result.error}` : `✅ ${approved_action.confirmation_text ?? 'Listo, acción ejecutada.'}`
      await supabase.from('agent_conversations').insert({ user_id: user.id, session_id, role: 'agent', content: responseText, action: { tool: approved_action.tool, params: approved_action.params, result }, page })
      return NextResponse.json({ response: responseText, action_executed: true, result })
    }

    const historyText = (history ?? []).slice(-6).map((h: any) => `${h.role === 'user' ? 'Usuario' : 'Agente'}: ${h.content}`).join('\n')

    const systemPrompt = `Eres el asistente IA de GDV (Gestión de Vida), app chilena de gestión personal.
Puedes ejecutar acciones reales en el sistema.

HERRAMIENTAS: ${TOOLS.map(t => `${t.name}: ${t.description}`).join(' | ')}

REGLAS:
1. Conversa naturalmente antes de actuar.
2. NUNCA ejecutes sin confirmación del usuario.
3. Si detectas un bug, repórtalo con reportar_bug.
4. Sé conciso y en español chileno.
5. Página actual: ${page ?? 'dashboard'}

Historial: ${historyText}

Si necesitas ejecutar una acción, agrega al FINAL de tu respuesta:
<ACTION>{"tool":"nombre","params":{},"pregunta_confirmacion":"¿Confirmas...?","confirmation_text":"Texto de éxito"}</ACTION>`

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
    })

    const result = await model.generateContent(`${systemPrompt}\n\nUsuario: ${message}`)
    const rawText = result.response.text()
    const actionMatch = rawText.match(/<ACTION>([\s\S]*?)<\/ACTION>/)
    const responseText = rawText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim()
    let pendingAction = null
    if (actionMatch) { try { pendingAction = JSON.parse(actionMatch[1]) } catch {} }

    await supabase.from('agent_conversations').insert({ user_id: user.id, session_id, role: 'agent', content: responseText, action: pendingAction ? { proposed: pendingAction } : null, page })

    return NextResponse.json({ response: responseText, pending_action: pendingAction })

  } catch (err) {
    const msg = (err as Error).message
    // Error amigable para quota excedida
    const friendlyMsg = msg.includes('429') || msg.includes('quota')
      ? 'La IA está temporalmente ocupada (límite de requests). Espera 1 minuto e intenta de nuevo.'
      : `Error: ${msg}`
    return NextResponse.json({ response: friendlyMsg, error: true }, { status: 200 })
  }
}
