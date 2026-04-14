/**
 * lib/utils/meal-checker.ts
 * Utilidades para cruzar recetas con stock disponible.
 * Funciones puras para determinar qué comidas son preparables.
 */

export type StockMap = Map<string, { current_qty: number; min_qty: number }>

export type MealStockResult = {
  recipeId: string
  recipeName: string
  canPrepare: boolean
  missingIngredients: Array<{
    productId: string
    productName: string
    required: number
    available: number
    unit: string
  }>
}

/**
 * Verifica si una receta puede prepararse con el stock actual.
 */
export function checkRecipeStock(
  recipe: {
    id: string
    name: string
    recipe_ingredients: Array<{
      product_id: string
      qty_required: number
      unit: string | null
      is_optional: boolean
      products: { id: string; name: string; unit: string } | null
    }>
  },
  stockMap: StockMap
): MealStockResult {
  const missing: MealStockResult['missingIngredients'] = []

  for (const ing of recipe.recipe_ingredients) {
    if (ing.is_optional) continue
    if (!ing.products) continue

    const stock = stockMap.get(ing.product_id)
    const available = stock?.current_qty ?? 0

    if (available < ing.qty_required) {
      missing.push({
        productId: ing.product_id,
        productName: ing.products.name,
        required: ing.qty_required,
        available,
        unit: ing.unit ?? ing.products.unit,
      })
    }
  }

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    canPrepare: missing.length === 0,
    missingIngredients: missing,
  }
}

/**
 * Filtra recetas preparables y ordena por porcentaje de ingredientes disponibles.
 * Útil para sugerir qué cocinar hoy.
 */
export function rankRecipesByStock(
  recipes: Parameters<typeof checkRecipeStock>[0][],
  stockMap: StockMap
): Array<MealStockResult & { availabilityPct: number }> {
  return recipes
    .map(recipe => {
      const result = checkRecipeStock(recipe, stockMap)
      const total = recipe.recipe_ingredients.filter(i => !i.is_optional).length
      const missing = result.missingIngredients.length
      const availabilityPct = total > 0 ? Math.round((total - missing) / total * 100) : 100
      return { ...result, availabilityPct }
    })
    .sort((a, b) => b.availabilityPct - a.availabilityPct)
}
