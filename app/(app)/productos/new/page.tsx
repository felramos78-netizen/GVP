'use client'
/**
 * app/(app)/productos/new/page.tsx
 * Formulario completo para crear un nuevo producto con todos sus campos.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', brand: '', category: 'Proteína', type: 'comestible',
    format: 'Bolsa', unit: 'kg', quantity: '', shelf_life_days: '',
    doses: '', storage_location: 'Despensa',
    is_breakfast: false, is_lunch: false, is_dinner: false, is_snack: false,
    description: '', comparison_notes: '',
    // Stock inicial
    initial_qty: '', initial_min_qty: '',
  })

  const update = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, brand: form.brand || null,
          category: form.category, type: form.type,
          format: form.format, unit: form.unit,
          quantity: parseFloat(form.quantity),
          shelf_life_days: form.shelf_life_days ? parseInt(form.shelf_life_days) : null,
          doses: form.doses ? parseInt(form.doses) : null,
          storage_location: form.storage_location,
          is_breakfast: form.is_breakfast, is_lunch: form.is_lunch,
          is_dinner: form.is_dinner, is_snack: form.is_snack,
          description: form.description || null,
          comparison_notes: form.comparison_notes || null,
          is_active: true,
          initialStock: form.initial_qty ? {
            current_qty: parseFloat(form.initial_qty),
            min_qty: parseFloat(form.initial_min_qty || '0'),
            unit: form.unit,
          } : undefined,
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }

      const product = await res.json()
      router.push(`/productos/${product.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear producto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <Link href="/productos" className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
          ← Volver a productos
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Nuevo producto</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Identificación */}
        <div className="card flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700">Identificación</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre *</label>
              <input className="input" required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Pechuga de pollo" />
            </div>
            <div>
              <label className="label">Marca</label>
              <input className="input" value={form.brand} onChange={e => update('brand', e.target.value)} placeholder="SuperPollo" />
            </div>
            <div>
              <label className="label">Categoría *</label>
              <select className="select" value={form.category} onChange={e => update('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select className="select" value={form.type} onChange={e => update('type', e.target.value)}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Formato</label>
              <select className="select" value={form.format} onChange={e => update('format', e.target.value)}>
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unidad *</label>
              <select className="select" value={form.unit} onChange={e => update('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cantidad por envase *</label>
              <input className="input" type="number" step="0.001" required value={form.quantity} onChange={e => update('quantity', e.target.value)} placeholder="1" />
            </div>
            <div>
              <label className="label">Dosis estimadas</label>
              <input className="input" type="number" value={form.doses} onChange={e => update('doses', e.target.value)} placeholder="4" />
            </div>
            <div>
              <label className="label">Duración / vencimiento (días)</label>
              <input className="input" type="number" value={form.shelf_life_days} onChange={e => update('shelf_life_days', e.target.value)} placeholder="7" />
            </div>
            <div>
              <label className="label">Ubicación en casa</label>
              <select className="select" value={form.storage_location} onChange={e => update('storage_location', e.target.value)}>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Uso */}
        <div className="card flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700">Uso y aplicación</h2>
          <div>
            <label className="label">Apto para</label>
            <div className="flex gap-4 mt-1">
              {[
                ['is_breakfast', 'Desayuno'],
                ['is_lunch', 'Almuerzo'],
                ['is_dinner', 'Cena'],
                ['is_snack', 'Snack'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={e => update(key, e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Descripción nutricional / uso</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Alta en proteínas, baja en grasa..." />
          </div>
          <div>
            <label className="label">Comparación con productos similares</label>
            <textarea className="input" rows={2} value={form.comparison_notes} onChange={e => update('comparison_notes', e.target.value)} placeholder="Vs. muslo de pollo: más proteína, menos grasa..." />
          </div>
        </div>

        {/* Stock inicial */}
        <div className="card flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700">Stock inicial (opcional)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad actual</label>
              <input className="input" type="number" step="0.001" value={form.initial_qty} onChange={e => update('initial_qty', e.target.value)} placeholder="0.8" />
            </div>
            <div>
              <label className="label">Mínimo recomendado</label>
              <input className="input" type="number" step="0.001" value={form.initial_min_qty} onChange={e => update('initial_min_qty', e.target.value)} placeholder="0.5" />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-coral-50 border border-coral-200 rounded-lg px-4 py-3 text-sm text-coral-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/productos" className="btn flex-1 text-center">Cancelar</Link>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Creando...' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  )
}
