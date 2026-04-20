/**
 * app/api/agente/route.ts — Mesa de Ayuda IA
 */
import { createClient } from '@/lib/supabase/server'
import { genAI } from '@/lib/gemini/client'
import { checkAndIncrement } from '@/lib/gemini/rate-limiter'
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
  { name: 'sugerir_recetas_con_stock', description: 'Sugiere recetas realizables con el stock actual.' },
  { name: 'reportar_bug', description: 'Reporta un error en el sistema.', parameters: { descripcion: 'string', pagina: 'string' } },
  { name: 'consultar_historial_compras', description: 'Muestra las últimas compras registradas.' },
]

function requireParams(params: any, keys: string[]): string | null {
  for (const key of keys) {
    if (params?.[key] === undefined || params?.[key] === null || params?.[key] === '') {
      return `Falta el parámetro "${key}"`
    }
  }
  return null
}

async function executeTool(toolName: string, params: any, supabase: any, userId: string) {
  switch (toolName) {
    case 'consultar_stock': {
      const { data } = await supabase.from('stock').select('current_qty, min_qty, unit, products(name, category)').eq('user_id', userId)
      return data?.map((s: any) => ({ producto: s.products?.name, cantidad: s.current_qty, minimo: s.min_qty, unidad: s.unit, estado: s.current_qty <= s.min_qty ? 'bajo' : 'ok' })) ?? []
    }
    case 'actualizar_stock': {
      const missing = requireParams(params, ['product_name', 'cantidad', 'operacion'])
      if (missing) return { error: missing }
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
      const missing = requireParams(params, ['nombre'])
      if (missing) return { error: missing }
      const { data, error } = await supabase.from('products').insert({ user_id: userId, name: params.nombre, category: params.categoria ?? 'otro', type: params.tipo ?? 'comestible', unit: params.unidad ?? 'unidad', quantity: 1, is_active: true }).select().single()
      if (error) return { error: `No se pudo crear el producto: ${error.message}` }
      return { ok: true, producto_creado: data?.name }
    }
    case 'consultar_finanzas': {
      const { data: profile } = await supabase.from('users').select('monthly_income, pay_day').eq('id', userId).single()
      const { data: centers } = await supabase.from('cost_centers').select('name, monthly_amount, type, icon').eq('user_id', userId).eq('is_active', true)
      const total = (centers ?? []).reduce((a: number, c: any) => a + c.monthly_amount, 0)
      return { ingreso: profile?.monthly_income ?? 0, total_asignado: total, saldo_libre: (profile?.monthly_income ?? 0) - total, centros: centers ?? [] }
    }
    case 'crear_centro_costo': {
      const missing = requireParams(params, ['nombre', 'tipo', 'monto'])
      if (missing) return { error: missing }
      const { data, error } = await supabase.from('cost_centers').insert({ user_id: userId, name: params.nombre, icon: params.icono ?? '💰', type: params.tipo ?? 'variable', monthly_amount: params.monto ?? 0, is_active: true, sort_order: 99 }).select().single()
      if (error) return { error: `No se pudo crear el centro de costo: ${error.message}` }
      return { ok: true, centro_creado: data?.name }
    }
    case 'agregar_al_planner': {
      const missing = requireParams(params, ['fecha', 'tipo_comida', 'descripcion'])
      if (missing) return { error: missing }
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
      const missing = requireParams(params, ['nombre', 'tipo'])
      if (missing) return { error: missing }
      const { data, error } = await supabase.from('recipes').insert({ user_id: userId, name: params.nombre, meal_type: params.tipo, instructions: params.instrucciones ?? null, is_active: true }).select().single()
      if (error) return { error: `No se pudo crear la receta: ${error.message}` }
      return { ok: true, receta_creada: data?.name }
    }
    case 'consultar_recetas': {
      const { data } = await supabase.from('recipes').select('name, meal_type, kcal, prep_time_min').eq('user_id', userId).eq('is_active', true).order('name')
      return data ?? []
    }
    case 'sugerir_recetas_con_stock': {
      const { data: stock } = await supabase.from('stock').select('product_id, current_qty').eq('user_id', userId).gt('current_qty', 0)
      const availableIds = new Set((stock ?? []).map((s: any) => s.product_id))
      const { data: recipes } = await supabase.from('recipes').select('id, name, meal_type, kcal, prep_time_min, recipe_ingredients(product_id)').eq('user_id', userId).eq('is_active', true)
      const feasible = (recipes ?? []).filter((r: any) => {
        const ingredients = r.recipe_ingredients ?? []
        return ingredients.length === 0 || ingredients.every((i: any) => availableIds.has(i.product_id))
      })
      return {
        recetas_posibles: feasible.map((r: any) => ({ nombre: r.name, tipo: r.meal_type, kcal: r.kcal, tiempo_min: r.prep_time_min })),
        total: feasible.length,
      }
    }
    case 'reportar_bug': {
      const missing = requireParams(params, ['descripcion'])
      if (missing) return { error: missing }
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

    // Rate limiting para el agente
    const rateLimit = await checkAndIncrement(user.id)
    if (!rateLimit.allowed) {
      const resetTime = new Date((rateLimit as any).resetAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      return NextResponse.json({ response: `Alcanzaste el límite diario del asistente. Se reinicia a las ${resetTime}.`, error: true }, { status: 200 })
    }

    const systemPrompt = `Eres el asistente IA de GDV (Gestión de Vida), app chilena de gestión personal.
Puedes ejecutar acciones reales en el sistema.

HERRAMIENTAS: ${TOOLS.map(t => `${t.name}: ${t.description}`).join(' | ')}

REGLAS:
1. Conversa naturalmente antes de actuar.
2. NUNCA ejecutes sin confirmación del usuario.
3. Si detectas un bug, repórtalo con reportar_bug.
4. Sé conciso y en español chileno.
5. Página actual: ${page ?? 'dashboard'}

Si necesitas ejecutar una acción, agrega al FINAL de tu respuesta:
<ACTION>{"tool":"nombre","params":{},"pregunta_confirmacion":"¿Confirmas...?","confirmation_text":"Texto de éxito"}</ACTION>`

    // Historial nativo de Gemini: requiere inicio con 'user' y roles alternados
    const rawHistory = (history ?? [])
      .slice(-6)
      .filter((h: any) => h.content?.trim())
      .map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }))
    while (rawHistory.length > 0 && rawHistory[0].role === 'model') rawHistory.shift()
    const chatHistory: { role: string; parts: { text: string }[] }[] = []
    for (const msg of rawHistory) {
      if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].role !== msg.role) {
        chatHistory.push(msg)
      }
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
      systemInstruction: systemPrompt,
    })

    const chat = model.startChat({ history: chatHistory })
    const result = await chat.sendMessage(message)
    const rawText = result.response.text()
    const actionMatch = rawText.match(/<ACTION>([\s\S]*?)<\/ACTION>/)
    const responseText = rawText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim()
    let pendingAction = null
    if (actionMatch) { try { pendingAction = JSON.parse(actionMatch[1]) } catch {} }

    await supabase.from('agent_conversations').insert({ user_id: user.id, session_id, role: 'agent', content: responseText, action: pendingAction ? { proposed: pendingAction } : null, page })

    return NextResponse.json({ response: responseText, pending_action: pendingAction })

  } catch (err) {
    const msg = (err as Error).message
    const friendlyMsg = msg.includes('429') || msg.includes('quota')
      ? 'La IA está temporalmente ocupada (límite de requests). Espera 1 minuto e intenta de nuevo.'
      : `Error: ${msg}`
    return NextResponse.json({ response: friendlyMsg, error: true }, { status: 200 })
  }
}
