'use client'
/**
 * components/modules/recetas/RecetasClient.tsx
 * Recetario con grid de tarjetas, filtros y ficha detallada.
 */
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/formatters'

const MEAL_TYPE_COLORS = {
  desayuno: { card: 'border-teal-200',  badge: 'bg-teal-50 text-teal-800',  dot: 'bg-teal-400' },
  almuerzo: { card: 'border-blue-200',  badge: 'bg-blue-50 text-blue-800',  dot: 'bg-blue-400' },
  cena:     { card: 'border-amber-200', badge: 'bg-amber-50 text-amber-800', dot: 'bg-amber-400' },
  snack:    { card: 'border-pink-200',  badge: 'bg-pink-50 text-pink-800',  dot: 'bg-pink-400' },
} as const

export function RecetasClient({ recipes, stockMap }: any) {
  const [filterType, setFilterType] = useState('')
  const [filterStock, setFilterStock] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  const filtered = useMemo(() => {
    return recipes.filter((r: any) => {
      const matchType = !filterType || r.meal_type === filterType
      const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase())
      return matchType && matchSearch
    })
  }, [recipes, filterType, search])

  const selectedRecipe = selected ? recipes.find((r: any) => r.id === selected) : null

  const tabs = [
    { key: '', label: `Todos (${recipes.length})` },
    { key: 'desayuno', label: 'Desayuno' },
    { key: 'almuerzo', label: 'Almuerzo' },
    { key: 'cena', label: 'Cena' },
    { key: 'snack', label: 'Snack' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilterType(t.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                filterType === t.key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          className="input max-w-xs ml-auto"
          placeholder="Buscar receta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button onClick={() => setShowNewForm(true)} className="btn-primary">
          + Nueva receta
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grid de recetas */}
        <div className={cn('flex flex-col gap-3', selectedRecipe ? 'lg:col-span-2' : 'lg:col-span-3')}>
          {filtered.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-sm text-gray-400">No hay recetas con esos filtros.</p>
              <button onClick={() => setShowNewForm(true)} className="btn mt-3 mx-auto">
                + Crear la primera receta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((recipe: any) => {
                const colors = MEAL_TYPE_COLORS[recipe.meal_type as keyof typeof MEAL_TYPE_COLORS]
                  ?? MEAL_TYPE_COLORS.snack
                const isSelected = selected === recipe.id

                return (
                  <button
                    key={recipe.id}
                    onClick={() => setSelected(isSelected ? null : recipe.id)}
                    className={cn(
                      'text-left rounded-xl border p-4 transition-all hover:shadow-sm',
                      isSelected
                        ? 'border-gray-900 shadow-sm'
                        : colors.card,
                      'bg-white'
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium capitalize', colors.badge)}>
                        {recipe.meal_type}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className={cn('w-2 h-2 rounded-full', 'bg-teal-400')} title="En stock" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm text-gray-900 mb-1 leading-tight">{recipe.name}</h3>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      {recipe.kcal && <span>{recipe.kcal} kcal</span>}
                      {recipe.protein_g && <span>{Math.round(recipe.protein_g)}g prot.</span>}
                      {recipe.prep_time_min && <span>{recipe.prep_time_min} min</span>}
                    </div>
                    {recipe.recipe_ingredients?.[0]?.count && (
                      <div className="text-xs text-gray-400 mt-1">
                        {recipe.recipe_ingredients[0].count} ingredientes
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel de detalle */}
        {selectedRecipe && (
          <div className="lg:col-span-1">
            <div className="card sticky top-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium capitalize mb-2 inline-block',
                    MEAL_TYPE_COLORS[selectedRecipe.meal_type as keyof typeof MEAL_TYPE_COLORS]?.badge ?? 'bg-gray-100 text-gray-700'
                  )}>
                    {selectedRecipe.meal_type}
                  </span>
                  <h2 className="text-base font-semibold text-gray-900">{selectedRecipe.name}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  ['Calorías', selectedRecipe.kcal ? `${selectedRecipe.kcal} kcal` : '—'],
                  ['Proteínas', selectedRecipe.protein_g ? `${Math.round(selectedRecipe.protein_g)}g` : '—'],
                  ['Carbohidratos', selectedRecipe.carbs_g ? `${Math.round(selectedRecipe.carbs_g)}g` : '—'],
                  ['Grasas', selectedRecipe.fat_g ? `${Math.round(selectedRecipe.fat_g)}g` : '—'],
                  ['Preparación', selectedRecipe.prep_time_min ? `${selectedRecipe.prep_time_min} min` : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="text-sm font-medium text-gray-800">{value}</div>
                  </div>
                ))}
              </div>

              {selectedRecipe.instructions && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Preparación</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{selectedRecipe.instructions}</p>
                </div>
              )}

              {selectedRecipe.external_url && (
                <a
                  href={selectedRecipe.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline block mb-4"
                >
                  Ver receta completa →
                </a>
              )}

              <div className="flex gap-2">
                <Link href={`/recetas/${selectedRecipe.id}`} className="btn flex-1 text-center">
                  Ficha completa
                </Link>
                <button className="btn-primary flex-1">
                  Planificar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal nueva receta */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-gray-900">Nueva receta</h3>
              <button onClick={() => setShowNewForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <NewRecipeForm onClose={() => setShowNewForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

function NewRecipeForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: '', meal_type: 'almuerzo', prep_time_min: '',
    kcal: '', protein_g: '', carbs_g: '', fat_g: '',
    instructions: '', external_url: '',
  })

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        prep_time_min: form.prep_time_min ? parseInt(form.prep_time_min) : null,
        kcal: form.kcal ? parseInt(form.kcal) : null,
        protein_g: form.protein_g ? parseFloat(form.protein_g) : null,
        carbs_g: form.carbs_g ? parseFloat(form.carbs_g) : null,
        fat_g: form.fat_g ? parseFloat(form.fat_g) : null,
      }),
    })
    if (res.ok) onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Nombre *</label>
        <input className="input" required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ej: Pollo grillado con arroz" />
      </div>
      <div>
        <label className="label">Tipo de comida *</label>
        <select className="select" value={form.meal_type} onChange={e => update('meal_type', e.target.value)}>
          <option value="desayuno">Desayuno</option>
          <option value="almuerzo">Almuerzo</option>
          <option value="cena">Cena</option>
          <option value="snack">Snack</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Calorías (kcal)</label><input className="input" type="number" value={form.kcal} onChange={e => update('kcal', e.target.value)} /></div>
        <div><label className="label">Proteínas (g)</label><input className="input" type="number" value={form.protein_g} onChange={e => update('protein_g', e.target.value)} /></div>
        <div><label className="label">Carbohidratos (g)</label><input className="input" type="number" value={form.carbs_g} onChange={e => update('carbs_g', e.target.value)} /></div>
        <div><label className="label">Grasas (g)</label><input className="input" type="number" value={form.fat_g} onChange={e => update('fat_g', e.target.value)} /></div>
        <div><label className="label">Tiempo prep. (min)</label><input className="input" type="number" value={form.prep_time_min} onChange={e => update('prep_time_min', e.target.value)} /></div>
      </div>
      <div>
        <label className="label">Instrucciones</label>
        <textarea className="input" rows={3} value={form.instructions} onChange={e => update('instructions', e.target.value)} placeholder="Pasos de preparación..." />
      </div>
      <div>
        <label className="label">URL de receta externa</label>
        <input className="input" type="url" value={form.external_url} onChange={e => update('external_url', e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn flex-1">Cancelar</button>
        <button type="submit" className="btn-primary flex-1">Crear receta</button>
      </div>
    </form>
  )
}
