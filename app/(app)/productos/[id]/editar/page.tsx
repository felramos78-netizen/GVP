'use client'
/**
 * app/(app)/productos/[id]/editar/page.tsx
 * Formulario de edición de producto existente.
 * Pre-carga los datos del producto y permite modificar todos los campos.
 */
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = ['Proteína','Cereal','Verdura','Fruta','Lácteo','Snack','Grasa saludable','Bebestible','Mascotas','Aseo']
const TYPES = [
  { value: 'comestible', label: 'Comestible' },
  { value: 'bebestible', label: 'Bebestible' },
  { value: 'aseo',       label: 'Aseo / Limpieza' },
  { value: 'mascotas',   label: 'Mascotas' },
  { value: 'suplemento', label: 'Suplemento' },
]
const LOCATIONS = ['Refrigerador','Congelador','Despensa','Mesón','Cajón 1','Cajón 2','Baño','Bodega']
const FORMATS = ['Bolsa','Caja','Botella','Bandeja','Pote','Tarro','Frasco','Lata','Unidad']
const UNITS = ['kg','g','L','mL','unidades','porciones']

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/products/${productId}`)
      .then(r => r.json())
      .then(product => {
        setForm({
          name: product.name ?? '',
          brand: product.brand ?? '',
          category: product.category ?? 'Proteína',
          type: product.type ?? 'comestible',
          format: product.format ?? 'Bolsa',
          unit: product.unit ?? 'kg',
          quantity: product.quantity?.toString() ?? '',
          shelf_life_days: product.shelf_life_days?.toString() ?? '',
          doses: product.doses?.toString() ?? '',
          storage_location: product.storage_location ?? 'Despensa',
          is_breakfast: product.is_breakfast ?? false,
          is_lunch: product.is_lunch ?? false,
          is_dinner: product.is_dinner ?? false,
          is_snack: product.is_snack ?? false,
          description: product.description ?? '',
          comparison_notes: product.comparison_notes ?? '',
        })
        setFetching(false)
      })
      .catch(() => { setError('No se pudo cargar el producto'); setFetching(false) })
  }, [productId])

  const update = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity: parseFloat(form.quantity),
          shelf_life_days: form.shelf_life_days ? parseInt(form.shelf_life_days) : null,
          doses: form.doses ? parseInt(form.doses) : null,
          brand: form.brand || null,
          description: form.description || null,
          comparison_notes: form.comparison_notes || null,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }
      router.push(`/productos/${productId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div className="p-8 text-gray-400 text-sm">Cargando producto...</div>
  if (!form) return <div className="p-8 text-coral-600 text-sm">{error}</div>

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <Link href={`/productos/${productId}`} className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
          ← Volver a la ficha
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Editar producto</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="card flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700">Identificación</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre *</label>
              <input className="input" required value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div><label className="label">Marca</label><input className="input" value={form.brand} onChange={e => update('brand', e.target.value)} /></div>
            <div><label className="label">Categoría *</label>
              <select className="select" value={form.category} onChange={e => update('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Tipo *</label>
              <select className="select" value={form.type} onChange={e => update('type', e.target.value)}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className="label">Formato</label>
              <select className="select" value={form.format} onChange={e => update('format', e.target.value)}>
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div><label className="label">Unidad *</label>
              <select className="select" value={form.unit} onChange={e => update('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="label">Cantidad *</label><input className="input" type="number" step="0.001" required value={form.quantity} onChange={e => update('quantity', e.target.value)} /></div>
            <div><label className="label">Dosis</label><input className="input" type="number" value={form.doses} onChange={e => update('doses', e.target.value)} /></div>
            <div><label className="label">Vencimiento (días)</label><input className="input" type="number" value={form.shelf_life_days} onChange={e => update('shelf_life_days', e.target.value)} /></div>
            <div><label className="label">Ubicación</label>
              <select className="select" value={form.storage_location} onChange={e => update('storage_location', e.target.value)}>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700">Uso y descripción</h2>
          <div className="flex gap-4">
            {[['is_breakfast','Desayuno'],['is_lunch','Almuerzo'],['is_dinner','Cena'],['is_snack','Snack']].map(([k,l]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[k]} onChange={e => update(k, e.target.checked)} className="cursor-pointer" />
                <span className="text-sm text-gray-700">{l}</span>
              </label>
            ))}
          </div>
          <div><label className="label">Descripción</label><textarea className="input" rows={2} value={form.description} onChange={e => update('description', e.target.value)} /></div>
          <div><label className="label">Comparación con similares</label><textarea className="input" rows={2} value={form.comparison_notes} onChange={e => update('comparison_notes', e.target.value)} /></div>
        </div>

        {error && <div className="bg-coral-50 border border-coral-200 rounded-lg px-4 py-3 text-sm text-coral-700">{error}</div>}

        <div className="flex gap-3">
          <Link href={`/productos/${productId}`} className="btn flex-1 text-center">Cancelar</Link>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
