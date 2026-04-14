/**
 * lib/db/meal-plan.ts
 * Queries para el módulo de planificación de comidas y recetas.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto, UpdateDto } from '@/types/database'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns'

type Supabase = SupabaseClient<Database>

export type MealPlanEntry = Database['public']['Tables']['meal_plan']['Row'] & {
  recipes: Pick<
    Database['public']['Tables']['recipes']['Row'],
    'id' | 'name' | 'kcal' | 'protein_g' | 'prep_time_min'
  > | null
}

export type RecipeWithIngredients = Database['public']['Tables']['recipes']['Row'] & {
  recipe_ingredients: Array<
    Database['public']['Tables']['recipe_ingredients']['Row'] & {
      products: Pick<
        Database['public']['Tables']['products']['Row'],
        'id' | 'name' | 'unit'
      > & {
        stock: Pick<Database['public']['Tables']['stock']['Row'], 'current_qty' | 'min_qty'> | null
      }
    }
  >
  parent_recipe?: Pick<Database['public']['Tables']['recipes']['Row'], 'id' | 'name'> | null
  variations?: Pick<Database['public']['Tables']['recipes']['Row'], 'id' | 'name'>[]
}

// ─── Meal Plan ────────────────────────────────────────────────────────────────

/**
 * Obtiene las entradas del planner para una semana completa.
 * Retorna las 4 comidas de cada día (desayuno, almuerzo, cena, snack).
 */
export async function getMealPlanWeek(
  supabase: Supabase,
  userId: string,
  weekStartDate: Date
) {
  const start = format(startOfWeek(weekStartDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const end   = format(endOfWeek(weekStartDate,   { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('meal_plan')
    .select(`*, recipes(id, name, kcal, protein_g, prep_time_min)`)
    .eq('user_id', userId)
    .gte('plan_date', start)
    .lte('plan_date', end)
    .order('plan_date', { ascending: true })
    .order('meal_type', { ascending: true })

  if (error) throw new Error(`getMealPlanWeek: ${error.message}`)
  return data as MealPlanEntry[]
}

/**
 * Obtiene las entradas del planner para un mes completo.
 * Usado en la vista de calendario mensual.
 */
export async function getMealPlanMonth(
  supabase: Supabase,
  userId: string,
  year: number,
  month: number // 0-indexed
) {
  const start = format(startOfMonth(new Date(year, month)), 'yyyy-MM-dd')
  const end   = format(endOfMonth(new Date(year, month)),   'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('meal_plan')
    .select(`*, recipes(id, name, meal_type)`)
    .eq('user_id', userId)
    .gte('plan_date', start)
    .lte('plan_date', end)
    .order('plan_date', { ascending: true })

  if (error) throw new Error(`getMealPlanMonth: ${error.message}`)
  return data as MealPlanEntry[]
}

/**
 * Crea o actualiza una entrada del planner para un día y comida específicos.
 * UNIQUE constraint: (user_id, plan_date, meal_type)
 */
export async function upsertMealPlan(
  supabase: Supabase,
  entry: InsertDto<'meal_plan'>
) {
  const { data, error } = await supabase
    .from('meal_plan')
    .upsert(entry, { onConflict: 'user_id,plan_date,meal_type' })
    .select()
    .single()

  if (error) throw new Error(`upsertMealPlan: ${error.message}`)
  return data
}

/**
 * Verifica qué comidas de la semana tienen stock suficiente.
 * Cruza meal_plan → recipes → recipe_ingredients → stock.
 * Retorna cada entrada con su estado: 'ok' | 'missing' | 'no_stock'
 */
export async function checkMealPlanStock(
  supabase: Supabase,
  userId: string,
  weekStartDate: Date
) {
  const entries = await getMealPlanWeek(supabase, userId, weekStartDate)

  const results = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.recipe_id) {
        return { ...entry, stockStatus: 'ok' as const, missingProducts: [] }
      }

      // Obtener ingredientes de la receta con stock actual
      const { data: ingredients, error } = await supabase
        .from('recipe_ingredients')
        .select(`
          qty_required, unit, is_optional,
          products(id, name, unit, stock(current_qty, min_qty))
        `)
        .eq('recipe_id', entry.recipe_id)

      if (error || !ingredients) {
        return { ...entry, stockStatus: 'ok' as const, missingProducts: [] }
      }

      const missing = ingredients
        .filter(ing => !ing.is_optional)
        .filter(ing => {
          const stock = (ing.products as any)?.stock
          if (!stock) return true
          return stock.current_qty < ing.qty_required
        })
        .map(ing => ({
          productId: (ing.products as any)?.id,
          productName: (ing.products as any)?.name,
          required: ing.qty_required,
          available: (ing.products as any)?.stock?.current_qty ?? 0,
          unit: ing.unit,
        }))

      return {
        ...entry,
        stockStatus: missing.length === 0 ? ('ok' as const) : ('missing' as const),
        missingProducts: missing,
      }
    })
  )

  return results
}

// ─── Recetas ──────────────────────────────────────────────────────────────────

/**
 * Obtiene todas las recetas activas del usuario.
 */
export async function getRecipes(
  supabase: Supabase,
  userId: string,
  mealType?: 'desayuno' | 'almuerzo' | 'cena' | 'snack'
) {
  let query = supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(count)
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('parent_recipe_id', null) // solo recetas base, no variaciones

  if (mealType) {
    query = query.eq('meal_type', mealType)
  }

  const { data, error } = await query.order('meal_type').order('name')
  if (error) throw new Error(`getRecipes: ${error.message}`)
  return data
}

/**
 * Obtiene una receta completa con ingredientes, variaciones y stock.
 */
export async function getRecipeById(
  supabase: Supabase,
  recipeId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(
        *,
        products(
          id, name, unit, category,
          stock(current_qty, min_qty, unit)
        )
      )
    `)
    .eq('id', recipeId)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`getRecipeById: ${error.message}`)

  // Obtener variaciones si es receta base
  const { data: variations } = await supabase
    .from('recipes')
    .select('id, name, kcal, protein_g')
    .eq('parent_recipe_id', recipeId)
    .eq('is_active', true)

  return { ...data, variations: variations ?? [] } as RecipeWithIngredients
}

/**
 * Crea una nueva receta con sus ingredientes.
 */
export async function createRecipe(
  supabase: Supabase,
  recipe: InsertDto<'recipes'>,
  ingredients: InsertDto<'recipe_ingredients'>[]
) {
  const { data: newRecipe, error: recipeError } = await supabase
    .from('recipes')
    .insert(recipe)
    .select()
    .single()

  if (recipeError) throw new Error(`createRecipe: ${recipeError.message}`)

  if (ingredients.length > 0) {
    const { error: ingError } = await supabase
      .from('recipe_ingredients')
      .insert(ingredients.map(ing => ({ ...ing, recipe_id: newRecipe.id })))

    if (ingError) throw new Error(`createRecipe ingredients: ${ingError.message}`)
  }

  return newRecipe
}

/**
 * Genera la lista de compras de la semana basada en las comidas planificadas
 * y el stock actual. Retorna solo los productos que faltan.
 */
export async function generateShoppingList(
  supabase: Supabase,
  userId: string,
  weekStartDate: Date
) {
  const checkedEntries = await checkMealPlanStock(supabase, userId, weekStartDate)

  // Consolidar productos faltantes (deduplicar por producto)
  const missingMap = new Map<string, {
    productId: string
    productName: string
    totalRequired: number
    available: number
    unit: string
    forMeals: string[]
  }>()

  for (const entry of checkedEntries) {
    if (entry.stockStatus === 'missing') {
      for (const missing of entry.missingProducts) {
        const existing = missingMap.get(missing.productId)
        const mealLabel = `${entry.plan_date} ${entry.meal_type}`

        if (existing) {
          existing.totalRequired += missing.required
          existing.forMeals.push(mealLabel)
        } else {
          missingMap.set(missing.productId, {
            productId: missing.productId,
            productName: missing.productName,
            totalRequired: missing.required,
            available: missing.available,
            unit: missing.unit,
            forMeals: [mealLabel],
          })
        }
      }
    }
  }

  return Array.from(missingMap.values())
}
