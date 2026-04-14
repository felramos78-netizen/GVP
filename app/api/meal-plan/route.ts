/**
 * app/api/meal-plan/route.ts
 * GET  /api/meal-plan?week=2026-01-05  → semana completa
 * GET  /api/meal-plan?year=2026&month=0 → mes completo
 * POST /api/meal-plan                   → crear/actualizar entrada
 */
import { createClient } from '@/lib/supabase/server'
import { getMealPlanWeek, getMealPlanMonth, upsertMealPlan, generateShoppingList } from '@/lib/db/meal-plan'
import { NextRequest, NextResponse } from 'next/server'
import { parseISO } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const week  = searchParams.get('week')
    const year  = searchParams.get('year')
    const month = searchParams.get('month')
    const shoppingList = searchParams.get('shoppingList')

    if (week) {
      const weekDate = parseISO(week)

      if (shoppingList === 'true') {
        const list = await generateShoppingList(supabase, user.id, weekDate)
        return NextResponse.json(list)
      }

      const entries = await getMealPlanWeek(supabase, user.id, weekDate)
      return NextResponse.json(entries)
    }

    if (year && month !== null) {
      const entries = await getMealPlanMonth(
        supabase, user.id, parseInt(year), parseInt(month)
      )
      return NextResponse.json(entries)
    }

    return NextResponse.json(
      { error: 'Parámetro requerido: week o (year + month)' },
      { status: 400 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const entry = await upsertMealPlan(supabase, { ...body, user_id: user.id })
    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
