'use client'
/**
 * app/(auth)/onboarding/page.tsx
 * Onboarding para nuevos usuarios. Crea el perfil base y centros de costo
 * sugeridos según los datos ingresados.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STEPS = ['Perfil personal', 'Finanzas', 'Mascotas'] as const

const DEFAULT_COST_CENTERS = (income: number) => [
  { name: 'Arriendo', icon: '🏠', type: 'gasto_fijo',  monthly_amount: Math.round(income * 0.22), color: '#185FA5', description: 'Arriendo mensual' },
  { name: 'Alimentación', icon: '🛒', type: 'variable', monthly_amount: Math.round(income * 0.13), color: '#1D9E75', description: 'Supermercado y feria' },
  { name: 'Servicios básicos', icon: '💡', type: 'gasto_fijo', monthly_amount: Math.round(income * 0.06), color: '#BA7517', description: 'Agua, luz, gas, internet' },
  { name: 'Transporte', icon: '🚌', type: 'variable', monthly_amount: Math.round(income * 0.03), color: '#534AB7', description: 'Metro, buses, taxi' },
  { name: 'Ahorro', icon: '💰', type: 'ahorro', monthly_amount: Math.round(income * 0.10), color: '#0F6E56', description: '10% del ingreso' },
  { name: 'Ocio', icon: '🎮', type: 'variable', monthly_amount: Math.round(income * 0.04), color: '#639922', description: 'Entretenimiento y salidas' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    age: '',
    weight_kg: '',
    height_cm: '',
    activity_level: 'moderado',
    goal: 'recomposicion',
    city: '',
    monthly_income: '',
    pay_day: '5',
    pets: [] as Array<{ name: string; species: string }>,
  })

  const update = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const addPet = () =>
    setForm(prev => ({ ...prev, pets: [...prev.pets, { name: '', species: 'gato' }] }))

  const updatePet = (i: number, key: string, value: string) =>
    setForm(prev => {
      const pets = [...prev.pets]
      pets[i] = { ...pets[i], [key]: value }
      return { ...prev, pets }
    })

  const removePet = (i: number) =>
    setForm(prev => ({ ...prev, pets: prev.pets.filter((_, idx) => idx !== i) }))

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sin sesión activa')

      const income = parseInt(form.monthly_income) || 0

      // 1. Crear perfil de usuario
      const { error: profileError } = await supabase.from('users').upsert({
        id: user.id,
        name: form.name,
        age: form.age ? parseInt(form.age) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        activity_level: form.activity_level as any,
        goal: form.goal as any,
        monthly_income: income,
        pay_day: parseInt(form.pay_day),
        city: form.city || null,
        pets: form.pets,
      })
      if (profileError) throw profileError

      // 2. Crear centros de costo sugeridos
      if (income > 0) {
        const centers = DEFAULT_COST_CENTERS(income).map((c, i) => ({
          ...c,
          user_id: user.id,
          sort_order: i,
          is_active: true,
        }))
        const { error: ccError } = await supabase.from('cost_centers').insert(centers)
        if (ccError) throw ccError
      }

      // 3. Agregar centro por mascota si tiene
      if (form.pets.length > 0 && income > 0) {
        await supabase.from('cost_centers').insert({
          user_id: user.id,
          name: form.pets.length === 1 ? form.pets[0].name : 'Mascotas',
          icon: '🐾',
          type: 'variable',
          monthly_amount: Math.round(income * 0.05),
          description: `Comida, arena y veterinario`,
          color: '#993056',
          sort_order: 10,
          is_active: true,
        })
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar perfil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo + título */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-teal-400 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-11h2v6h-2zm0-4h2v2h-2z"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Configura tu perfil</h1>
          <p className="text-sm text-gray-500 mt-1">Solo tomaremos un par de minutos</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                i < step ? 'bg-teal-400 text-white' :
                i === step ? 'bg-gray-900 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        <div className="card">
          {/* Step 0 — Perfil personal */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-gray-900">Cuéntanos sobre ti</h2>
              <div>
                <label className="label">Nombre completo *</label>
                <input className="input" placeholder="Martín Flores" value={form.name} onChange={e => update('name', e.target.value)} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Edad</label>
                  <input className="input" type="number" placeholder="31" value={form.age} onChange={e => update('age', e.target.value)} />
                </div>
                <div>
                  <label className="label">Peso (kg)</label>
                  <input className="input" type="number" placeholder="78" value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)} />
                </div>
                <div>
                  <label className="label">Altura (cm)</label>
                  <input className="input" type="number" placeholder="175" value={form.height_cm} onChange={e => update('height_cm', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nivel de actividad</label>
                  <select className="select" value={form.activity_level} onChange={e => update('activity_level', e.target.value)}>
                    <option value="sedentario">Sedentario</option>
                    <option value="moderado">Moderado (2-3x/sem)</option>
                    <option value="activo">Activo (4-5x/sem)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Objetivo</label>
                  <select className="select" value={form.goal} onChange={e => update('goal', e.target.value)}>
                    <option value="recomposicion">Recomposición corporal</option>
                    <option value="bajar">Bajar de peso</option>
                    <option value="ganar">Ganar músculo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Ciudad</label>
                <input className="input" placeholder="Santiago" value={form.city} onChange={e => update('city', e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 1 — Finanzas */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-gray-900">Información financiera</h2>
              <p className="text-xs text-gray-500">Estos datos son privados y solo los ves tú. El sistema los usa para sugerir centros de costo y presupuestos.</p>
              <div>
                <label className="label">Sueldo líquido mensual (CLP) *</label>
                <input className="input" type="number" placeholder="1300000" value={form.monthly_income} onChange={e => update('monthly_income', e.target.value)} required />
              </div>
              <div>
                <label className="label">Día de pago</label>
                <select className="select" value={form.pay_day} onChange={e => update('pay_day', e.target.value)}>
                  {[1,5,10,15,20,25,30].map(d => (
                    <option key={d} value={d}>Día {d} de cada mes</option>
                  ))}
                </select>
              </div>
              {form.monthly_income && parseInt(form.monthly_income) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-800 mb-2">Centros de costo sugeridos</p>
                  <div className="flex flex-col gap-1">
                    {DEFAULT_COST_CENTERS(parseInt(form.monthly_income)).map(c => (
                      <div key={c.name} className="flex justify-between text-xs">
                        <span className="text-blue-700">{c.icon} {c.name}</span>
                        <span className="font-medium text-blue-900">${c.monthly_amount.toLocaleString('es-CL')}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600 mt-2">Puedes editar estos centros después en Finanzas.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Mascotas */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-gray-900">¿Tienes mascotas?</h2>
              <p className="text-xs text-gray-500">El sistema incluirá sus productos (comida, arena) en el inventario y planner.</p>
              {form.pets.map((pet, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Nombre</label>
                      <input className="input" placeholder="Miso" value={pet.name} onChange={e => updatePet(i, 'name', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Especie</label>
                      <select className="select" value={pet.species} onChange={e => updatePet(i, 'species', e.target.value)}>
                        <option value="gato">Gato</option>
                        <option value="perro">Perro</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => removePet(i)} className="btn btn-danger btn-sm mt-5">×</button>
                </div>
              ))}
              <button onClick={addPet} className="btn w-full">+ Agregar mascota</button>
              {form.pets.length === 0 && (
                <p className="text-xs text-center text-gray-400">Sin mascotas — puedes agregar después</p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 text-xs text-coral-600 bg-coral-50 border border-coral-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Navegación */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="btn"
            >
              Atrás
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 0 && !form.name}
                className="btn-primary"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || !form.name}
                className="btn-primary"
              >
                {loading ? 'Guardando...' : 'Crear mi perfil'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
