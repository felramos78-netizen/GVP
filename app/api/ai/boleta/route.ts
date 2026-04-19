/**
 * app/api/ai/boleta/route.ts
 * POST /api/ai/boleta
 * Recibe imagen de boleta en base64 y retorna los productos extraídos.
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
    const { imageBase64, mimeType = 'image/jpeg' } = body
    if (!imageBase64) return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 })

    // Obtener productos existentes para hacer matching
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, name, brand, category')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const existingList = (existingProducts ?? [])
      .map((p: any) => `${p.name}${p.brand ? ' (' + p.brand + ')' : ''}`)
      .join(', ')

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite-preview-06-17',
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    })

    const prompt = `Analiza esta boleta/ticket de compra chilena y extrae TODOS los productos.

${existingList ? `Productos que el usuario ya tiene en su sistema: ${existingList}

Para cada producto de la boleta, indica si ya existe en el sistema (campo "existe_en_sistema": true/false) y el id si corresponde.` : ''}

Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "comercio": "Nombre del supermercado o comercio",
  "fecha": "YYYY-MM-DD",
  "total_boleta": 0,
  "productos": [
    {
      "nombre_boleta": "Nombre exacto como aparece en la boleta",
      "nombre_limpio": "Nombre legible y normalizado",
      "marca": "Marca si se puede inferir",
      "cantidad": 1,
      "unidad": "unidad",
      "precio_unitario": 0,
      "precio_total": 0,
      "categoria": "...",
      "tipo": "comestible",
      "existe_en_sistema": false,
      "producto_id_existente": null,
      "ubicacion_sugerida": "Refrigerador",
      "es_desayuno": false,
      "es_almuerzo": false,
      "es_cena": false,
      "es_snack": false
    }
  ]
}

Categorías válidas: proteína, lácteo, carbohidrato, verdura, fruta, legumbre, aceite, condimento, bebida, limpieza, higiene, mascotas, otro.
Tipos válidos: comestible, bebestible, aseo, mascotas, suplemento.
Ubicaciones: Refrigerador, Congelador, Despensa, Mesón, Baño, Cajón.`

    const result = await model.generateContent([
      { inlineData: { mimeType, data: imageBase64 } },
      prompt,
    ])

    const text = result.response.text().replace(/```json|```/g, '').trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No se pudo leer la boleta')

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)

  } catch (err) {
    console.error('Boleta AI error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
