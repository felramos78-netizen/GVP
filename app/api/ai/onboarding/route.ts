/**
 * app/api/ai/onboarding/route.ts
 * POST /api/ai/onboarding
 * Recibe las respuestas del usuario y genera con Gemini:
 * - Perfil completo
 * - Lista de productos base (20-30 items) con precios reales
 * - Centros de costo sugeridos
 * - Plan de comidas inicial
 */
import { createClient } from '@/lib/supabase/server'
import { genAI } from '@/lib/gemini/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { answers } = body
    // answers = { nombre, ciudad, hogar, supermercado, cocina, ingreso, dia_pago, mascotas, actividad, objetivo }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite-preview-06-17',
      tools: [{ googleSearch: {} }] as any,
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    })

    const prompt = `Eres el asistente de configuración de GDV (Gestión de Vida), una app chilena de gestión personal.

Un nuevo usuario acaba de responder estas preguntas:
- Nombre: ${answers.nombre}
- Ciudad: ${answers.ciudad}
- Personas en el hogar: ${answers.hogar}
- Supermercado preferido: ${answers.supermercado}
- ¿Cocina en casa o pide delivery?: ${answers.cocina}
- Ingreso mensual líquido: $${answers.ingreso} CLP
- Día de pago: ${answers.dia_pago}
- Mascotas: ${answers.mascotas}
- Nivel de actividad física: ${answers.actividad}
- Objetivo: ${answers.objetivo}

Tu tarea es generar un perfil inicial completo y realista para este usuario chileno en 2026.

Busca en Google precios actuales de productos en supermercados chilenos (Líder, Tottus, Jumbo) para hacer los datos lo más reales posible.

Genera exactamente este JSON (sin markdown, sin texto adicional):
{
  "perfil": {
    "nombre": "...",
    "ciudad": "...",
    "ingreso": 0,
    "dia_pago": 5,
    "actividad": "moderado",
    "objetivo": "recomposicion"
  },
  "centros_costo": [
    {
      "nombre": "Arriendo",
      "icono": "🏠",
      "tipo": "gasto_fijo",
      "monto": 0,
      "color": "#185FA5",
      "descripcion": "..."
    }
  ],
  "productos": [
    {
      "nombre": "...",
      "marca": "...",
      "categoria": "...",
      "tipo": "comestible",
      "supermercado": "Lider",
      "precio_clp": 0,
      "unidad": "kg",
      "cantidad": 1,
      "ubicacion": "Refrigerador",
      "es_desayuno": false,
      "es_almuerzo": false,
      "es_cena": false,
      "es_snack": false,
      "stock_inicial": 1,
      "stock_minimo": 1
    }
  ],
  "plan_semana": [
    {
      "dia": "lunes",
      "desayuno": "...",
      "almuerzo": "...",
      "cena": "...",
      "snack": "..."
    }
  ],
  "mensaje_bienvenida": "Mensaje personalizado de bienvenida de 2 oraciones para ${answers.nombre}"
}

Reglas:
- centros_costo: entre 5-8 centros realistas según el ingreso de $${answers.ingreso} CLP. Incluir arriendo, alimentación, servicios, transporte, ahorro y ocio mínimo. Si tiene mascotas, agregar uno para ellas.
- productos: entre 25-35 productos base realistas para ${answers.ciudad}, Chile. Mezcla de Líder, Tottus, Jumbo y Feria. Incluye alimentos, bebestibles, y si tiene mascotas sus productos. Precios reales en CLP 2026.
- plan_semana: 7 días completos (lunes a domingo) con comidas simples y preparables.
- mensaje_bienvenida: cálido, personalizado, menciona su nombre y ciudad.`

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json|```/g, '').trim()

    // Extraer JSON aunque venga con texto alrededor
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Gemini no retornó JSON válido')

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)

  } catch (err) {
    console.error('Onboarding AI error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// Guarda el perfil generado en Supabase
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { perfil, centros_costo, productos, plan_semana } = await request.json()

    // 1. Guardar perfil
    await supabase.from('users').upsert({
      id: user.id,
      name: perfil.nombre,
      city: perfil.ciudad,
      monthly_income: perfil.ingreso,
      pay_day: perfil.dia_pago,
      activity_level: perfil.actividad,
      goal: perfil.objetivo,
      pets: perfil.mascotas ?? [],
      age: perfil.edad ?? null,
      weight_kg: perfil.peso ?? null,
      height_cm: perfil.altura ?? null,
    })

    // 2. Guardar centros de costo
    if (centros_costo?.length > 0) {
      await supabase.from('cost_centers').insert(
        centros_costo.map((c: any, i: number) => ({
          user_id: user.id,
          name: c.nombre,
          icon: c.icono,
          type: c.tipo,
          monthly_amount: c.monto,
          color: c.color,
          description: c.descripcion ?? null,
          sort_order: i,
          is_active: true,
        }))
      )
    }

    // 3. Guardar productos y su stock inicial
    if (productos?.length > 0) {
      // Obtener IDs de suppliers
      const { data: suppliers } = await supabase.from('suppliers').select('id, name')
      const supplierMap = new Map((suppliers ?? []).map((s: any) => [s.name.toLowerCase(), s.id]))

      for (const prod of productos) {
        // Crear producto
        const { data: newProd } = await supabase.from('products').insert({
          user_id: user.id,
          name: prod.nombre,
          brand: prod.marca ?? null,
          category: prod.categoria,
          type: prod.tipo ?? 'comestible',
          unit: prod.unidad ?? 'unidad',
          quantity: prod.cantidad ?? 1,
          storage_location: prod.ubicacion ?? 'Despensa',
          is_breakfast: prod.es_desayuno ?? false,
          is_lunch: prod.es_almuerzo ?? false,
          is_dinner: prod.es_cena ?? false,
          is_snack: prod.es_snack ?? false,
          is_active: true,
        }).select().single()

        if (!newProd) continue

        // Stock inicial
        if (prod.stock_inicial > 0) {
          await supabase.from('stock').insert({
            user_id: user.id,
            product_id: newProd.id,
            current_qty: prod.stock_inicial,
            min_qty: prod.stock_minimo ?? 0,
            unit: prod.unidad ?? 'unidad',
          })
        }

        // Precio inicial si existe supermercado
        const supKey = (prod.supermercado ?? '').toLowerCase()
        const supplierId = supplierMap.get(supKey) ??
          supplierMap.get('líder') ?? supplierMap.get('lider')
        if (supplierId && prod.precio_clp > 0) {
          await supabase.from('product_suppliers').insert({
            product_id: newProd.id,
            supplier_id: supplierId,
            is_available: true,
          }).then(() =>
            supabase.from('price_history').insert({
              product_id: newProd.id,
              supplier_id: supplierId,
              price_clp: prod.precio_clp,
              source: 'manual',
            })
          )
        }
      }
    }

    // 4. Guardar plan de la semana
    if (plan_semana?.length > 0) {
      const diasMap: Record<string, number> = {
        lunes: 0, martes: 1, miercoles: 2, miércoles: 2,
        jueves: 3, viernes: 4, sabado: 5, sábado: 5, domingo: 6
      }
      const today = new Date()
      const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1
      const monday = new Date(today)
      monday.setDate(today.getDate() - dayOfWeek)

      const mealEntries: any[] = []
      for (const dia of plan_semana) {
        const offset = diasMap[dia.dia.toLowerCase()] ?? 0
        const date = new Date(monday)
        date.setDate(monday.getDate() + offset)
        const dateStr = date.toISOString().split('T')[0]

        const meals: Record<string, string> = {
          desayuno: dia.desayuno,
          almuerzo: dia.almuerzo,
          cena: dia.cena,
          snack: dia.snack,
        }
        for (const [tipo, texto] of Object.entries(meals)) {
          if (texto) {
            mealEntries.push({
              user_id: user.id,
              plan_date: dateStr,
              meal_type: tipo,
              free_text: texto,
              mode: 'home',
            })
          }
        }
      }
      if (mealEntries.length > 0) {
        await supabase.from('meal_plan').upsert(mealEntries, {
          onConflict: 'user_id,plan_date,meal_type'
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Onboarding save error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
