/**
 * app/api/banco/proveedores/route.ts
 * Cruce de datos entre descripciones bancarias y proveedores.
 *
 * GET  /api/banco/proveedores
 *   → Lista proveedores del usuario + aliases
 *
 * POST /api/banco/proveedores { action: 'match', descriptions: string[] }
 *   → Cruza cada descripción con proveedores existentes usando aliases + IA
 *   → { matches: [{ description, supplier_id|null, nombre_sugerido, confianza }] }
 *
 * POST /api/banco/proveedores { action: 'create', nombre, tipo, aliases[] }
 *   → Crea nuevo proveedor + guarda aliases
 *
 * POST /api/banco/proveedores { action: 'add_alias', supplier_id, alias }
 *   → Agrega alias a proveedor existente
 */
import { createClient } from '@/lib/supabase/server'
import { genAI } from '@/lib/gemini/client'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET: lista proveedores + aliases ────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Proveedores: globales (user_id null) + del usuario
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, type, category, razones_sociales, logo_url, is_active, user_id')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq('is_active', true)
      .order('name')

    // Aliases: globales + del usuario
    const { data: aliases } = await supabase
      .from('provider_aliases')
      .select('id, supplier_id, alias, user_id')
      .or(`user_id.is.null,user_id.eq.${user.id}`)

    return NextResponse.json({ suppliers: suppliers ?? [], aliases: aliases ?? [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    // ── Crear nuevo proveedor ─────────────────────────────────────────────────
    if (action === 'create') {
      const { nombre, tipo, aliases = [], razones_sociales = [] } = body
      if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

      // Verificar duplicado (case-insensitive)
      const { data: existing } = await supabase
        .from('suppliers')
        .select('id, name')
        .ilike('name', nombre.trim())
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .single()

      if (existing) {
        return NextResponse.json({ supplier: existing, already_exists: true })
      }

      const { data: supplier, error } = await supabase
        .from('suppliers')
        .insert({
          name: nombre.trim(),
          type: tipo ?? 'comercio',
          category: tipo ?? 'comercio',
          user_id: user.id,
          razones_sociales: razones_sociales,
          is_active: true,
        })
        .select('id, name, type, category')
        .single()

      if (error || !supplier) {
        return NextResponse.json({ error: error?.message ?? 'Error al crear proveedor' }, { status: 500 })
      }

      // Guardar aliases
      if (aliases.length > 0) {
        await supabase.from('provider_aliases').insert(
          aliases.map((a: string) => ({
            supplier_id: supplier.id,
            alias: a.trim(),
            user_id: user.id,
          }))
        )
      }

      return NextResponse.json({ supplier, already_exists: false })
    }

    // ── Agregar alias a proveedor existente ───────────────────────────────────
    if (action === 'add_alias') {
      const { supplier_id, alias } = body
      if (!supplier_id || !alias?.trim()) {
        return NextResponse.json({ error: 'supplier_id y alias requeridos' }, { status: 400 })
      }

      await supabase.from('provider_aliases').upsert(
        { supplier_id, alias: alias.trim(), user_id: user.id },
        { onConflict: 'alias,user_id' }
      )

      return NextResponse.json({ ok: true })
    }

    // ── Cruzar descripciones con proveedores ──────────────────────────────────
    if (action === 'match') {
      const { descriptions } = body as { descriptions: string[] }
      if (!descriptions?.length) return NextResponse.json({ matches: [] })

      // 1. Cargar aliases actuales
      const { data: aliases } = await supabase
        .from('provider_aliases')
        .select('supplier_id, alias, suppliers(id, name, type, category)')
        .or(`user_id.is.null,user_id.eq.${user.id}`)

      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, type, category, razones_sociales')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .eq('is_active', true)

      // 2. Intento de match por alias (case-insensitive, partial)
      const aliasMap = new Map<string, { supplier_id: string; name: string }>()
      for (const a of (aliases ?? [])) {
        if (a.alias && (a as any).suppliers) {
          aliasMap.set(a.alias.toLowerCase(), {
            supplier_id: a.supplier_id,
            name: (a as any).suppliers.name,
          })
        }
      }

      const directMatches = new Map<string, { supplier_id: string; name: string; confidence: number } | null>()

      for (const desc of descriptions) {
        const descLower = desc.toLowerCase()
        let found: { supplier_id: string; name: string; confidence: number } | null = null

        // Exact alias match
        for (const [alias, supplier] of aliasMap) {
          if (descLower.includes(alias)) {
            found = { ...supplier, confidence: 0.95 }
            break
          }
        }

        // Check razones_sociales
        if (!found && suppliers) {
          for (const s of suppliers) {
            const razones = Array.isArray(s.razones_sociales) ? s.razones_sociales : []
            for (const razon of razones) {
              if (typeof razon === 'string' && descLower.includes(razon.toLowerCase())) {
                found = { supplier_id: s.id, name: s.name, confidence: 0.9 }
                break
              }
            }
            if (found) break

            // Partial name match
            if (descLower.includes(s.name.toLowerCase())) {
              found = { supplier_id: s.id, name: s.name, confidence: 0.85 }
              break
            }
          }
        }

        directMatches.set(desc, found)
      }

      // 3. Para los sin match, usar Gemini
      const unmatched = descriptions.filter(d => !directMatches.get(d))

      if (unmatched.length > 0) {
        const suppliersDesc = (suppliers ?? [])
          .map((s: any) => `${s.id}|${s.name}|${s.type}`)
          .join('\n')

        const prompt = `Cruza estas descripciones bancarias chilenas con la lista de proveedores existentes.

Proveedores existentes (id|nombre|tipo):
${suppliersDesc}

Descripciones a cruzar:
${unmatched.map((d, i) => `${i}. "${d}"`).join('\n')}

Para cada descripción, determina:
1. Si corresponde a algún proveedor existente → devuelve su id
2. Si es un proveedor nuevo → devuelve null y sugiere un nombre limpio (razón social)
3. Si es un cargo bancario/interés/comisión → el proveedor es el banco (busca "Banco de Chile" u otro banco en la lista)

Responde SOLO con JSON válido sin markdown:
{
  "matches": [
    {
      "index": 0,
      "supplier_id": "uuid-o-null",
      "nombre_sugerido": "Nombre limpio del comercio",
      "tipo_sugerido": "comercio|servicio|banco|combustible|farmacia|restaurant|transporte|entretenimiento",
      "confianza": 0.8
    }
  ]
}`

        try {
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite',
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
          })
          const result = await model.generateContent(prompt)
          const text = result.response.text().replace(/```json|```/g, '').trim()
          const json = JSON.parse(text.match(/\{[\s\S]*\}/)![0])

          for (const m of (json.matches ?? [])) {
            const desc = unmatched[m.index]
            if (desc) {
              directMatches.set(desc, m.supplier_id
                ? { supplier_id: m.supplier_id, name: m.nombre_sugerido, confidence: m.confianza ?? 0.7 }
                : null
              )
              // Guardar nombre sugerido para nuevos
              if (!m.supplier_id) {
                directMatches.set(desc, {
                  supplier_id: '__new__',
                  name: m.nombre_sugerido ?? desc,
                  confidence: 0,
                  // @ts-ignore
                  tipo_sugerido: m.tipo_sugerido ?? 'comercio',
                })
              }
            }
          }
        } catch { /* si Gemini falla, dejamos sin match */ }
      }

      // 4. Construir respuesta
      const matches = descriptions.map(desc => {
        const m = directMatches.get(desc)
        if (!m) return { description: desc, supplier_id: null, nombre_sugerido: desc, confianza: 0, es_nuevo: true }
        if (m.supplier_id === '__new__') {
          return {
            description: desc,
            supplier_id: null,
            nombre_sugerido: m.name,
            // @ts-ignore
            tipo_sugerido: m.tipo_sugerido ?? 'comercio',
            confianza: 0,
            es_nuevo: true,
          }
        }
        return {
          description: desc,
          supplier_id: m.supplier_id,
          nombre_sugerido: m.name,
          confianza: m.confidence,
          es_nuevo: false,
        }
      })

      return NextResponse.json({ matches })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })

  } catch (err) {
    console.error('Proveedores API error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
