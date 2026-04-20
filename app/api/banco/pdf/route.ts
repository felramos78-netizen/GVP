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
  "document_type": "cartola",
  "institution": "nombre del banco",
  "period_from": "YYYY-MM-DD",
  "period_to": "YYYY-MM-DD",
  "account_holder": "nombre del titular",
  "transactions": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "descripción completa tal como aparece",
      "comercio": null,
      "cargo": 0,
      "abono": 0,
      "saldo": null,
      "tipo": "compra"
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
- tipo: "compra", "transferencia", "cargo_bancario", "pago" u "otro"
- Incluye TODOS los movimientos, incluyendo cargos bancarios e intereses
- No omitas ninguna transacción
`

// Repara JSON truncado por límite de tokens: cierra arrays y objetos abiertos
function repairTruncatedJson(s: string): string {
  s = s.replace(/```json|```/g, '').trim()
  // Remover coma trailing si el JSON fue cortado después de un elemento
  s = s.replace(/,\s*$/, '')

  let braces = 0, brackets = 0, inString = false, escape = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escape) { escape = false; continue }
    if (c === '\\' && inString) { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') braces++
    else if (c === '}') braces--
    else if (c === '[') brackets++
    else if (c === ']') brackets--
  }
  while (brackets > 0) { s += ']'; brackets-- }
  while (braces > 0) { s += '}'; braces-- }
  return s
}

// Intenta parsear JSON, reparando si está truncado
function safeParseJson(raw: string): any {
  const clean = raw.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*/)
  if (!match) return null

  // Intento 1: parse directo (JSON completo)
  try { return JSON.parse(match[0]) } catch {}

  // Intento 2: reparar JSON truncado
  try { return JSON.parse(repairTruncatedJson(match[0])) } catch {}

  return null
}

// Retry con backoff exponencial para errores 503 de Gemini
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const msg = (err as Error).message ?? ''
      const isRetryable = msg.includes('503') || msg.includes('overloaded') ||
        msg.includes('Service Unavailable') || msg.includes('UNAVAILABLE')
      if (attempt < maxRetries && isRetryable) {
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

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

    // gemini-2.5-flash soporta hasta 65536 tokens de salida (vs 8192 de flash-lite)
    // lo que permite extraer cartolas grandes sin truncar el JSON
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
    })

    const result = await withRetry(() =>
      model.generateContent([
        { inlineData: { mimeType: 'application/pdf', data: base64 } },
        EXTRACTION_PROMPT,
      ])
    )

    const raw = result.response.text()
    const parsed = safeParseJson(raw)

    if (!parsed) {
      console.error('PDF parse failed, raw preview:', raw.slice(0, 500))
      return NextResponse.json({ error: 'No se pudo extraer la información del PDF. Verifica que sea una cartola o estado de cuenta válido.' }, { status: 422 })
    }

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
    const msg = (err as Error).message ?? ''
    if (msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('overloaded')) {
      return NextResponse.json({ error: 'El servicio de IA está saturado temporalmente. Intenta nuevamente en unos segundos.' }, { status: 503 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
