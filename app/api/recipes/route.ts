/**
 * app/api/recipes/route.ts
 * GET  /api/recipes       → lista de recetas del usuario
 * POST /api/recipes       → crear nueva receta
 */
import { createClient } from '@/lib/supabase/server'
import { getRecipes, createRecipe } from '@/lib/db/meal-plan'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const mealType = searchParams.get('meal_type') as any

    const recipes = await getRecipes(supabase, user.id, mealType)
    return NextResponse.json(recipes)
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
    const { ingredients = [], ...recipeData } = body

    const recipe = await createRecipe(
      supabase,
      { ...recipeData, user_id: user.id, is_active: true },
      ingredients
    )
    return NextResponse.json(recipe, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
