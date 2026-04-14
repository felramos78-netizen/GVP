/**
 * app/api/ai/suggest/route.ts
 * POST /api/ai/suggest
 * Sugiere comidas preparables con el stock actual usando Gemini.
 */
import { createClient } from '@/lib/supabase/server'
import { checkAndIncrement } from '@/lib/gemini/rate-limiter'
import { getSuggestModel } from '@/lib/gemini/client'
import { buildMealSuggestionPrompt } from '@/lib/gemini/prompts'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { mealType } = body

    if (!mealType) {
      return NextResponse.json({ error: 'mealType es requerido' }, { status: 400 })
    }

    // Verificar rate limit
    const rateCheck = await checkAndIncrement(user.id)
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: 'Límite diario alcanzado',
        resetAt: (rateCheck as any).resetAt,
      }, { status: 429 })
    }

    // Obtener stock disponible
    const { data: stock } = await supabase
      .from('stock')
      .select('current_qty, unit, products(name, type)')
      .eq('user_id', user.id)
      .gt('current_qty', 0)

    const { data: profile } = await supabase
      .from('users')
      .select('goal')
      .eq('id', user.id)
      .single()

    const stockItems = (stock ?? [])
      .filter((s: any) => s.products?.type === 'comestible' || s.products?.type === 'suplemento')
      .map((s: any) => ({
        name: s.products?.name ?? 'Desconocido',
        qty: s.current_qty,
        unit: s.unit ?? '',
      }))

    const goalLabel: Record<string, string> = {
      recomposicion: 'recomposición corporal (mantener músculo, bajar grasa)',
      bajar: 'bajar de peso',
      ganar: 'ganar masa muscular',
    }

    const prompt = buildMealSuggestionPrompt(
      stockItems,
      mealType,
      goalLabel[profile?.data?.goal ?? 'recomposicion'] ?? 'recomposición corporal'
    )

    const model = getSuggestModel()
    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(text)

    return NextResponse.json({
      suggestions: parsed.suggestions,
      rateLimitRemaining: rateCheck.remaining,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
