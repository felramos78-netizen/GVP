/**
 * app/api/compras/analizar/route.ts
 */
import { NextRequest, NextResponse } from 'next/server'
import { genAI } from '@/lib/gemini/client'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No hay archivo' }, { status: 400 })

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite-preview-06-17' })

    const buffer = await file.arrayBuffer()
    const imagePart = {
      inlineData: {
        data: Buffer.from(buffer).toString('base64'),
        mimeType: file.type,
      },
    }

    const prompt = `Analiza esta boleta chilena y extrae los datos.
Responde ÚNICAMENTE con un JSON plano (sin markdown, sin bloques de código) con esta estructura exacta:
{
  "comercio": "Nombre del comercio",
  "fecha": "AAAA-MM-DD",
  "total_boleta": 0,
  "productos": [
    {
      "nombre_limpio": "Nombre del producto",
      "marca": "Marca si aparece o string vacío",
      "categoria": "proteína/lácteo/verdura/carbohidrato/bebida/limpieza/otro",
      "tipo": "comestible/aseo",
      "ubicacion_sugerida": "Despensa/Refrigerador/Congelador",
      "cantidad": 1,
      "precio_unitario": 0,
      "es_desayuno": false,
      "es_almuerzo": true,
      "es_cena": true,
      "es_snack": false
    }
  ]
}`

    const result = await model.generateContent([prompt, imagePart])
    const text = result.response.text().replace(/```json|```/g, '').trim()
    return NextResponse.json(JSON.parse(text))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
