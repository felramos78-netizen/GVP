import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No hay archivo' }, { status: 400 })

    // USAMOS 1.5 FLASH PARA LA LECTURA (Más estable en cuota gratuita)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    const buffer = await file.arrayBuffer()
const imagePart = {
      inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType: file.type }
    }

    // ESTA ES LA LÍNEA QUE FALTA (Línea 18 aprox):
    const prompt = `Analiza esta boleta chilena y extrae los datos. 
    Responde ÚNICAMENTE con un JSON plano (sin markdown) con esta estructura:
    {
      "comercio": "Nombre del comercio",
      "fecha": "AAAA-MM-DD",
      "total_boleta": 0,
      "productos": [
        {
          "nombre_limpio": "Nombre del producto",
          "marca": "Marca si aparece",
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
    }` // No olvides cerrar con este símbolo ` al final

    // Y asegúrate de que abajo siga esto:
    const result = await model.generateContent([prompt, imagePart])
    const text = result.response.text().replace(/```json|```/g, "").trim()
    return NextResponse.json(JSON.parse(text))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}