/**
 * app/(app)/recetas/page.tsx
 * Recetario con filtros por tipo de comida y estado de stock.
 */
import { createClient } from '@/lib/supabase/server'
import { getRecipes } from '@/lib/db/meal-plan'
import { RecetasClient } from '@/components/modules/recetas/RecetasClient'

export default async function RecetasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Obtener todas las recetas base con conteo de ingredientes
  const recipes = await getRecipes(supabase, user.id)

  // Obtener stock actual para cruzar con ingredientes
  const { data: stock } = await supabase
    .from('stock')
    .select('product_id, current_qty, min_qty')
    .eq('user_id', user.id)

  const stockMap = new Map((stock ?? []).map(s => [s.product_id, s]))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Recetario</h1>
        <p className="text-sm text-gray-500 mt-1">
          {recipes.length} receta{recipes.length !== 1 ? 's' : ''} · desayuno · almuerzo · cena · snack
        </p>
      </div>
      <RecetasClient recipes={recipes} stockMap={Object.fromEntries(stockMap)} />
    </div>
  )
}
