'use client'
/**
 * app/(app)/recetas/[id]/editar/page.tsx
 * Formulario de edición de receta existente.
 */
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function EditRecetaPage() {
  const router = useRouter()
  const params = useParams()
  const recipeId = params.id as string

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/recipes/${recipeId}`)
      .then(r => r.json())
      .then(recipe => {
        setForm({
          name: recipe.name ?? '',
          meal_type: recipe.meal_type ?? 'almuerzo',
          prep_time_min: recipe.prep_time_min?.toString() ?? '',
          kcal: recipe.kcal?.toString() ?? '',
          protein_g: recipe.protein_g?.toString() ?? '',
          carbs_g: recipe.carbs_g?.toString() ?? '',
          fat_g: recipe.fat_g?.toString() ?? '',
          instructions: recipe.instructions ?? '',
          external_url: recipe.external_url ?? '',
        })
        setFetching(false)
      })
      .catch(() => { setError('No se pudo cargar la receta'); setFetching(false) })
  }, [recipeId])

  const update = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          prep_time_min: form.prep_time_min ? parseInt(form.prep_time_min) : null,
          kcal: form.kcal ? parseInt(form.kcal) : null,
          protein_g: form.protein_g ? parseFloat(form.protein_g) : null,
          carbs_g: form.carbs_g ? parseFloat(form.carbs_g) : null,
          fat_g: form.fat_g ? parseFloat(form.fat_g) : null,
          external_url: form.external_url || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.push(`/recetas/${recipeId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div className="p-8 text-gray-400 text-sm">Cargando...</div>
  if (!form) return <div className="p-8 text-coral-600 text-sm">{error}</div>

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <div>
        <Link href={`/recetas/${recipeId}`} className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">← Volver a la receta</Link>
        <h1 className="text-2xl font-semibold text-gray-900">Editar receta</h1>
      </div>
      <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
        <div><label className="label">Nombre *</label><input className="input" required value={form.name} onChange={e => update('name', e.target.value)} /></div>
        <div><label className="label">Tipo de comida *</label>
          <select className="select" value={form.meal_type} onChange={e => update('meal_type', e.target.value)}>
            <option value="desayuno">Desayuno</option><option value="almuerzo">Almuerzo</option>
            <option value="cena">Cena</option><option value="snack">Snack</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Calorías</label><input className="input" type="number" value={form.kcal} onChange={e => update('kcal', e.target.value)} /></div>
          <div><label className="label">Proteínas (g)</label><input className="input" type="number" value={form.protein_g} onChange={e => update('protein_g', e.target.value)} /></div>
          <div><label className="label">Carbohidratos (g)</label><input className="input" type="number" value={form.carbs_g} onChange={e => update('carbs_g', e.target.value)} /></div>
          <div><label className="label">Grasas (g)</label><input className="input" type="number" value={form.fat_g} onChange={e => update('fat_g', e.target.value)} /></div>
          <div><label className="label">Tiempo prep. (min)</label><input className="input" type="number" value={form.prep_time_min} onChange={e => update('prep_time_min', e.target.value)} /></div>
        </div>
        <div><label className="label">Instrucciones</label><textarea className="input" rows={4} value={form.instructions} onChange={e => update('instructions', e.target.value)} /></div>
        <div><label className="label">URL externa</label><input className="input" type="url" value={form.external_url} onChange={e => update('external_url', e.target.value)} /></div>
        {error && <div className="bg-coral-50 border border-coral-200 rounded-lg px-3 py-2 text-sm text-coral-700">{error}</div>}
        <div className="flex gap-3">
          <Link href={`/recetas/${recipeId}`} className="btn flex-1 text-center">Cancelar</Link>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}
