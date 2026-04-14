/**
 * app/api/recipes/[id]/route.ts
 * GET    /api/recipes/:id → ficha completa de receta
 * PUT    /api/recipes/:id → actualizar receta
 * DELETE /api/recipes/:id → archivar receta (soft delete)
 */
import { createClient } from '@/lib/supabase/server'
import { getRecipeById } from '@/lib/db/meal-plan'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const recipe = await getRecipeById(supabase, params.id, user.id)
    return NextResponse.json(recipe)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const updates = await request.json()
    const { data, error } = await supabase
      .from('recipes')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { error } = await supabase
      .from('recipes')
      .update({ is_active: false })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
