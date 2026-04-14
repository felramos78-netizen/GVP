/**
 * app/(app)/recetas/[id]/page.tsx
 * Ficha completa de una receta con ingredientes, stock y variaciones.
 */
import { createClient } from '@/lib/supabase/server'
import { getRecipeById } from '@/lib/db/meal-plan'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatQty, getStockStatus, stockStatusClasses, cn } from '@/lib/utils/formatters'

export default async function RecetaFichaPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const recipe = await getRecipeById(supabase, params.id, user.id).catch(() => null)
  if (!recipe) notFound()

  const MEAL_COLORS = {
    desayuno: 'bg-teal-50 text-teal-800',
    almuerzo: 'bg-blue-50 text-blue-800',
    cena:     'bg-amber-50 text-amber-800',
    snack:    'bg-pink-50 text-pink-800',
  }

  const allInStock = recipe.recipe_ingredients.every(ing => {
    if (ing.is_optional) return true
    const stock = (ing.products as any)?.stock
    return stock && stock.current_qty >= ing.qty_required
  })

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/recetas" className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
            ← Volver al recetario
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">{recipe.name}</h1>
            <span className={cn(
              'px-2 py-0.5 rounded text-xs font-medium capitalize',
              MEAL_COLORS[recipe.meal_type as keyof typeof MEAL_COLORS] ?? 'bg-gray-100 text-gray-600'
            )}>
              {recipe.meal_type}
            </span>
            <span className={allInStock ? 'badge-ok' : 'badge-warning'}>
              {allInStock ? 'En stock' : 'Faltan ingredientes'}
            </span>
          </div>
        </div>
        <Link href={`/recetas/${recipe.id}/editar`} className="btn">Editar</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Macros */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Información nutricional por porción</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                ['Calorías', recipe.kcal ? `${recipe.kcal} kcal` : '—'],
                ['Proteínas', recipe.protein_g ? `${Math.round(recipe.protein_g)}g` : '—'],
                ['Carbohidratos', recipe.carbs_g ? `${Math.round(recipe.carbs_g)}g` : '—'],
                ['Grasas', recipe.fat_g ? `${Math.round(recipe.fat_g)}g` : '—'],
                ['Preparación', recipe.prep_time_min ? `${recipe.prep_time_min} min` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  <div className="text-sm font-semibold text-gray-800">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ingredientes */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Ingredientes ({recipe.recipe_ingredients.length})
            </h2>
            <div className="flex flex-col gap-2">
              {recipe.recipe_ingredients.map(ing => {
                const product = ing.products as any
                const stock = product?.stock
                const stockStatus = stock
                  ? getStockStatus(stock.current_qty, ing.qty_required)
                  : null
                const hasEnough = stock && stock.current_qty >= ing.qty_required
                const cls = stockStatus ? stockStatusClasses[stockStatus] : null

                return (
                  <div
                    key={ing.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      hasEnough ? 'border-gray-100 bg-gray-50' :
                      ing.is_optional ? 'border-gray-100 bg-gray-50 opacity-60' :
                      'border-coral-200 bg-coral-50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        hasEnough ? 'bg-teal-400' : ing.is_optional ? 'bg-gray-300' : 'bg-coral-400'
                      )} />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {product?.name ?? 'Producto no encontrado'}
                          {ing.is_optional && (
                            <span className="ml-1 text-xs text-gray-400">(opcional)</span>
                          )}
                        </div>
                        {ing.notes && (
                          <div className="text-xs text-gray-400">{ing.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700">
                        {formatQty(ing.qty_required, ing.unit ?? product?.unit ?? '')}
                      </div>
                      {stock ? (
                        <div className={cn('text-xs', hasEnough ? 'text-teal-600' : 'text-coral-600')}>
                          Stock: {formatQty(stock.current_qty, product?.unit ?? '')}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">Sin stock</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Ingredientes faltantes */}
            {!allInStock && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-coral-600 font-medium">
                    Faltan ingredientes para esta receta
                  </p>
                  <Link href="/cotizacion" className="btn btn-sm">
                    Ir a cotización →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Preparación */}
          {recipe.instructions && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Preparación</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {recipe.instructions}
              </p>
            </div>
          )}
        </div>

        {/* Columna lateral */}
        <div className="flex flex-col gap-4">

          {/* Variaciones */}
          {recipe.variations && recipe.variations.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Variaciones ({recipe.variations.length})
              </h2>
              <div className="flex flex-col gap-2">
                {recipe.variations.map((v: any) => (
                  <Link
                    key={v.id}
                    href={`/recetas/${v.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm text-gray-700">{v.name}</span>
                    <span className="text-xs text-gray-400">{v.kcal ? `${v.kcal} kcal` : ''}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Receta externa */}
          {recipe.external_url && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Receta completa</h2>
              <a
                href={recipe.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn w-full text-center"
              >
                Ver receta en web →
              </a>
            </div>
          )}

          {/* Acciones */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Acciones</h2>
            <div className="flex flex-col gap-2">
              <button className="btn-primary w-full">
                Planificar esta receta
              </button>
              <Link href={`/recetas/nueva?parent=${recipe.id}`} className="btn w-full text-center">
                Crear variación
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
