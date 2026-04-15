/**
 * app/api/agente/route.ts
 * POST /api/agente
 * Agente conversacional con function calling.
 * Conversa, entiende intención, propone acciones y ejecuta con aprobación.
 */
import { createClient } from '@/lib/supabase/server'
import { genAI } from '@/lib/gemini/client'
import { NextRequest, NextResponse } from 'next/server'

// ── Definición de herramientas disponibles ──────────────────────
const TOOLS = [
  {
    name: 'consultar_stock',
    description: 'Consulta el inventario actual del usuario. Retorna productos con cantidades.',
  },
  {
    name: 'actualizar_stock',
    description: 'Actualiza la cantidad de un producto en el inventario.',
    parameters: { product_name: 'string', cantidad: 'number', operacion: 'sumar|restar|fijar' },
  },
  {
    name: 'crear_producto',
    description: 'Crea un nuevo producto en el catálogo del usuario.',
    parameters: { nombre: 'string', categoria: 'string', tipo: 'string', unidad: 'string', supermercado: 'string', precio: 'number' },
  },
  {
    name: 'consultar_finanzas',
    description: 'Consulta el resumen financiero del mes actual: ingreso, gastos por centro, saldo.',
  },
  {
    name: 'crear_centro_costo',
    description: 'Crea un nuevo centro de costo en finanzas.',
    parameters: { nombre: 'string', tipo: 'gasto_fijo|variable|ahorro|meta', monto: 'number', icono: 'string' },
  },
  {
    name: 'agregar_al_planner',
    description: 'Agrega una comida al planner semanal.',
    parameters: { fecha: 'YYYY-MM-DD', tipo_comida: 'desayuno|almuerzo|cena|snack', descripcion: 'string', modalidad: 'home|bought|invited|skipped' },
  },
  {
    name: 'consultar_planner',
    description: 'Consulta el plan de comidas de la semana actual.',
  },
  {
    name: 'crear_receta',
    description: 'Crea una nueva receta en el recetario.',
    parameters: { nombre: 'string', tipo: 'desayuno|almuerzo|cena|snack', kcal: 'number', proteinas: 'number', instrucciones: 'string' },
  },
  {
    name: 'consultar_recetas',
    description: 'Consulta las recetas disponibles del usuario.',
    parameters: { tipo: 'desayuno|almuerzo|cena|snack|todas' },
  },
  {
    name: 'sugerir_recetas_con_stock',
    description: 'Sugiere recetas que se pueden preparar con el stock actual.',
  },
  {
    name: 'reportar_bug',
    description: 'Reporta un error o problema encontrado en el sistema.',
    parameters: { descripcion: 'string', pagina: 'string' },
  },
  {
    name: 'consultar_historial_compras',
    description: 'Consulta el historial de compras recientes.',
  },
]

// ── Ejecutores de herramientas ──────────────────────────────────
async function executeTool(toolName: string, params: any, supabase: any, userId: string) {
  switch (toolName) {

    case 'consultar_stock': {
      const { data } = await supabase
        .from('stock')
        .select('current_qty, min_qty, unit, products(name, category)')
        .eq('user_id', userId)
        .order('products(name)')
      return data?.map((s: any) => ({
        producto: s.products?.name,
        categoria: s.products?.category,
        cantidad: s.current_qty,
        minimo: s.min_qty,
        unidad: s.unit,
        estado: s.current_qty <= s.min_qty ? 'bajo' : 'ok'
      })) ?? []
    }

    case 'actualizar_stock': {
      const { data: prod } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', `%${params.product_name}%`)
        .single()
      if (!prod) return { error: `No se encontró el producto "${params.product_name}"` }

      const { data: stock } = await supabase
        .from('stock')
        .select('id, current_qty')
        .eq('user_id', userId)
        .eq('product_id', prod.id)
        .single()

      let newQty = params.cantidad
      if (params.operacion === 'sumar') newQty = (stock?.current_qty ?? 0) + params.cantidad
      if (params.operacion === 'restar') newQty = Math.max(0, (stock?.current_qty ?? 0) - params.cantidad)

      if (stock) {
        await supabase.from('stock').update({ current_qty: newQty, updated_at: new Date().toISOString() }).eq('id', stock.id)
      } else {
        await supabase.from('stock').insert({ user_id: userId, product_id: prod.id, current_qty: newQty, min_qty: 0 })
      }
      return { ok: true, producto: params.product_name, cantidad_nueva: newQty }
    }

    case 'crear_producto': {
      const { data } = await supabase.from('products').insert({
        user_id: userId,
        name: params.nombre,
        category: params.categoria ?? 'otro',
        type: params.tipo ?? 'comestible',
        unit: params.unidad ?? 'unidad',
        quantity: 1,
        is_active: true,
      }).select().single()
      if (data && params.precio > 0) {
        const { data: sup } = await supabase.from('suppliers').select('id').ilike('name', `%${params.supermercado ?? 'Lider'}%`).single()
        if (sup) {
          await supabase.from('price_history').insert({ product_id: data.id, supplier_id: sup.id, price_clp: params.precio, source: 'manual' })
        }
      }
      return { ok: true, producto_creado: data?.name }
    }

    case 'consultar_finanzas': {
      const { data: profile } = await supabase.from('users').select('monthly_income, pay_day').eq('id', userId).single()
      const { data: centers } = await supabase.from('cost_centers').select('name, monthly_amount, type, icon').eq('user_id', userId).eq('is_active', true)
      const totalAsignado = (centers ?? []).reduce((a: number, c: any) => a + c.monthly_amount, 0)
      return {
        ingreso: profile?.monthly_income ?? 0,
        dia_pago: profile?.pay_day ?? 5,
        total_asignado: totalAsignado,
        saldo_libre: (profile?.monthly_income ?? 0) - totalAsignado,
        centros: centers ?? []
      }
    }

    case 'crear_centro_costo': {
      const { data } = await supabase.from('cost_centers').insert({
        user_id: userId,
        name: params.nombre,
        icon: params.icono ?? '💰',
        type: params.tipo ?? 'variable',
        monthly_amount: params.monto ?? 0,
        is_active: true,
        sort_order: 99,
      }).select().single()
      return { ok: true, centro_creado: data?.name }
    }

    case 'agregar_al_planner': {
      const { error } = await supabase.from('meal_plan').upsert({
        user_id: userId,
        plan_date: params.fecha,
        meal_type: params.tipo_comida,
        free_text: params.descripcion,
        mode: params.modalidad ?? 'home',
      }, { onConflict: 'user_id,plan_date,meal_type' })
      return error ? { error: error.message } : { ok: true }
    }

    case 'consultar_planner': {
      const today = new Date()
      const monday = new Date(today)
      monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const { data } = await supabase
        .from('meal_plan')
        .select('plan_date, meal_type, free_text, mode, recipes(name)')
        .eq('user_id', userId)
        .gte('plan_date', monday.toISOString().split('T')[0])
        .lte('plan_date', sunday.toISOString().split('T')[0])
        .order('plan_date')
      return data ?? []
    }

    case 'crear_receta': {
      const { data } = await supabase.from('recipes').insert({
        user_id: userId,
        name: params.nombre,
        meal_type: params.tipo,
        kcal: params.kcal ?? null,
        protein_g: params.proteinas ?? null,
        instructions: params.instrucciones ?? null,
        is_active: true,
      }).select().single()
      return { ok: true, receta_creada: data?.name }
    }

    case 'consultar_recetas': {
      let query = supabase.from('recipes').select('name, meal_type, kcal, protein_g, prep_time_min').eq('user_id', userId).eq('is_active', true)
      if (params.tipo && params.tipo !== 'todas') query = query.eq('meal_type', params.tipo)
      const { data } = await query.order('name')
      return data ?? []
    }

    case 'sugerir_recetas_con_stock': {
      const { data: stock } = await supabase
        .from('stock')
        .select('current_qty, unit, products(name, type)')
        .eq('user_id', userId)
        .gt('current_qty', 0)
      const items = (stock ?? []).filter((s: any) => s.products?.type === 'comestible').map((s: any) => s.products?.name).join(', ')
      return { ingredientes_disponibles: items, mensaje: `Con estos ingredientes disponibles: ${items}. El agente sugerirá recetas.` }
    }

    case 'reportar_bug': {
      await supabase.from('bug_reports').insert({
        user_id: userId,
        page: params.pagina ?? 'desconocida',
        description: params.descripcion,
        status: 'pending',
      })
      return { ok: true, mensaje: 'Bug reportado al equipo de desarrollo' }
    }

    case 'consultar_historial_compras': {
      const { data } = await supabase
        .from('purchase_orders')
        .select('purchased_at, total_clp, suppliers(name), purchase_items(qty, products(name))')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .order('purchased_at', { ascending: false })
        .limit(5)
      return data ?? []
    }

    default:
      return { error: `Herramienta "${toolName}" no reconocida` }
  }
}

// ── Handler principal ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { message, session_id, page, history, approved_action } = await request.json()

    // Guardar mensaje del usuario
    await supabase.from('agent_conversations').insert({
      user_id: user.id,
      session_id,
      role: 'user',
      content: message,
      page: page ?? null,
    })

    // Si el usuario aprobó una acción pendiente, ejecutarla
    if (approved_action) {
      const result = await executeTool(approved_action.tool, approved_action.params, supabase, user.id)

      const responseText = result.error
        ? `❌ Error al ejecutar: ${result.error}`
        : `✅ Listo. ${approved_action.confirmation_text ?? 'Acción ejecutada correctamente.'}`

      await supabase.from('agent_conversations').insert({
        user_id: user.id,
        session_id,
        role: 'agent',
        content: responseText,
        action: { tool: approved_action.tool, params: approved_action.params, result },
        page,
      })

      return NextResponse.json({ response: responseText, action_executed: true, result })
    }

    // Construir contexto de la conversación
    const historyText = (history ?? []).slice(-6).map((h: any) =>
      `${h.role === 'user' ? 'Usuario' : 'Agente'}: ${h.content}`
    ).join('\n')

    const systemPrompt = `Eres el asistente IA de GDV (Gestión de Vida), una app chilena de gestión personal.
Estás integrado dentro del sistema y puedes ejecutar acciones reales.

HERRAMIENTAS DISPONIBLES:
${TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')}

REGLAS CRÍTICAS:
1. SIEMPRE conversa antes de actuar. Entiende la intención del usuario.
2. NUNCA ejecutes una acción sin confirmación explícita del usuario.
3. Si detectas un error o bug en el sistema, repórtalo automáticamente con reportar_bug.
4. Cuando propongas una acción, explica qué harás y pide confirmación.
5. Sé conciso, amigable y en español chileno casual.
6. Página actual del usuario: ${page ?? 'dashboard'}

Historial reciente:
${historyText}

Si necesitas ejecutar una herramienta, responde con este JSON al final de tu mensaje:
<ACTION>{"tool":"nombre_herramienta","params":{},"pregunta_confirmacion":"¿Confirmas que quieres...?","confirmation_text":"texto de éxito"}</ACTION>

Si no necesitas ejecutar ninguna acción, responde solo en texto normal.`

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
    })

    const result = await model.generateContent(`${systemPrompt}\n\nUsuario: ${message}`)
    const rawText = result.response.text()

    // Parsear si hay acción propuesta
    const actionMatch = rawText.match(/<ACTION>([\s\S]*?)<\/ACTION>/)
    let responseText = rawText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim()
    let pendingAction = null

    if (actionMatch) {
      try {
        pendingAction = JSON.parse(actionMatch[1])
      } catch {}
    }

    // Detectar bugs automáticamente
    if (rawText.toLowerCase().includes('error') && rawText.toLowerCase().includes('sistema')) {
      await supabase.from('bug_reports').insert({
        user_id: user.id,
        page,
        description: `Agente detectó posible problema: ${responseText.substring(0, 200)}`,
        context: { message, page },
        status: 'pending',
      })
    }

    // Guardar respuesta del agente
    await supabase.from('agent_conversations').insert({
      user_id: user.id,
      session_id,
      role: 'agent',
      content: responseText,
      action: pendingAction ? { proposed: pendingAction } : null,
      page,
    })

    return NextResponse.json({
      response: responseText,
      pending_action: pendingAction,
    })

  } catch (err) {
    console.error('Agente error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
