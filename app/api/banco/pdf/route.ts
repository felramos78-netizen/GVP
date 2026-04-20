/**
 * app/api/banco/pdf/route.ts
 * POST /api/banco/pdf — extrae movimientos bancarios desde PDF
 * usando Gemini multimodal (inline base64).
 *
 * Acepta FormData con:
 *   file: PDF (cartola o estado de cuenta tarjeta de crédito)
 *   institution?: string (default "Banco de Chile")
 *
 * Devuelve:
 *   { document_type, institution, period, transactions: [...] }
 */
import { createClient } from '@/lib/supabase/server'
import { genAI } from '@/lib/gemini/client'
import { NextRequest, NextResponse } from 'next/server'

const MAX_PDF_BYTES = 20 * 1024 * 1024 // 20 MB límite Gemini inline

const EXTRACTION_PROMPT = `Analiza este documento bancario chileno y extrae TODOS los movimientos.

El documento puede ser:
- "cartola": estado de cuenta corriente (columnas: fecha, descripción, cargo, abono, saldo)
- "tarjeta_credito": estado de cuenta tarjeta de crédito (columnas: lugar, fecha, código, descripción, monto)

Responde SOLO con JSON válido, sin markdown, con esta estructura exacta:
{
  "document_type": "cartola" | "tarjeta_credito",
  "institution": "nombre del banco",
  "period_from": "YYYY-MM-DD",
  "period_to": "YYYY-MM-DD",
  "account_holder": "nombre del titular",
  "transactions": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "descripción completa tal como aparece",
      "comercio": "nombre limpio del comercio/razón social (null si no aplica)",
      "cargo": 0,
      "abono": 0,
      "saldo": null,
      "tipo": "compra" | "transferencia" | "cargo_bancario" | "pago" | "otro"
    }
  ]
}

Reglas:
- Convierte fechas al formato YYYY-MM-DD (ej: 26/12/25 → 2025-12-26)
- cargo y abono son números positivos (sin símbolo $, sin puntos de miles)
- Si solo hay "monto" (tarjeta crédito), ponlo como cargo
- comercio: extrae el nombre del comercio limpio (sin ciudad, sin código)
  Ej: "SUMUP * DELIMARKT SANTIAGO" → "Delimarket"
  Ej: "MERCADOPAGO *LAS3B Las Condes" → "MercadoPago"
  Ej: "INTERESES LINEA DE CREDITO" → null
- Incluye TODOS los movimientos, incluyendo cargos bancarios e intereses
- No omitas ninguna transacción
`

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const institution = (formData.get('institution') as string) ?? 'Banco de Chile'

    if (!file) return NextResponse.json({ error: 'Archivo PDF requerido' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    if (buffer.byteLength > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'El PDF supera el límite de 20 MB' }, { status: 400 })
    }

    const base64 = Buffer.from(buffer).toString('base64')

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64,
        },
      },
      EXTRACTION_PROMPT,
    ])

    const raw = result.response.text().replace(/```json|```/g, '').trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No se pudo extraer la información del PDF' }, { status: 422 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const transactions = (parsed.transactions ?? []).map((tx: any) => ({
      fecha: tx.fecha ?? '',
      descripcion: tx.descripcion ?? '',
      comercio: tx.comercio ?? null,
      cargo: Number(tx.cargo) || 0,
      abono: Number(tx.abono) || 0,
      saldo: tx.saldo != null ? Number(tx.saldo) : null,
      tipo: tx.tipo ?? 'otro',
    })).filter((tx: any) => tx.fecha && (tx.cargo > 0 || tx.abono > 0))

    return NextResponse.json({
      document_type: parsed.document_type ?? 'cartola',
      institution: parsed.institution ?? institution,
      period_from: parsed.period_from ?? null,
      period_to: parsed.period_to ?? null,
      account_holder: parsed.account_holder ?? null,
      transactions,
    })

  } catch (err) {
    console.error('PDF extraction error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
