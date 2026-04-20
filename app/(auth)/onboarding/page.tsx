'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

// ── Tipos ──────────────────────────────────────────────────────
type Phase = 'chat' | 'preview' | 'saving' | 'done'

interface Answers {
  nombre: string
  ciudad: string
  hogar: string
  supermercado: string
  cocina: string
  ingreso: string
  dia_pago: string
  mascotas: string
  actividad: string
  objetivo: string
}

interface ChatMessage {
  role: 'bot' | 'user'
  text: string
  key?: string
  inputType?: 'text' | 'options' | 'number'
  options?: string[]
}

// ── Flujo de preguntas ─────────────────────────────────────────
const QUESTIONS: ChatMessage[] = [
  {
    role: 'bot',
    text: '¡Hola! Soy tu asistente de GDV 👋 Voy a configurar tu sistema personal en 2 minutos. Para empezar, ¿cuál es tu nombre?',
    key: 'nombre',
    inputType: 'text',
  },
  {
    role: 'bot',
    text: '¿En qué ciudad vives?',
    key: 'ciudad',
    inputType: 'options',
    options: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco', 'Otra'],
  },
  {
    role: 'bot',
    text: '¿Cuántas personas viven en tu hogar contigo?',
    key: 'hogar',
    inputType: 'options',
    options: ['Solo yo', '2 personas', '3 personas', '4 o más'],
  },
  {
    role: 'bot',
    text: '¿En qué supermercado compras más seguido?',
    key: 'supermercado',
    inputType: 'options',
    options: ['Lider', 'Tottus', 'Jumbo', 'Feria libre', 'Mezclo varios'],
  },
  {
    role: 'bot',
    text: '¿Cocinas en casa habitualmente o prefieres pedir delivery?',
    key: 'cocina',
    inputType: 'options',
    options: ['Cocino casi siempre', 'Mitad y mitad', 'Pido delivery bastante', 'Depende de la semana'],
  },
  {
    role: 'bot',
    text: '¿Tienes mascotas?',
    key: 'mascotas',
    inputType: 'options',
    options: ['No', '1 gato', '2 gatos', '1 perro', '2 perros', 'Gato y perro', 'Otra mascota'],
  },
  {
    role: 'bot',
    text: '¿Cuál es tu nivel de actividad física?',
    key: 'actividad',
    inputType: 'options',
    options: ['Sedentario (poco o nada)', 'Moderado (2-3 veces/sem)', 'Activo (4-5 veces/sem)', 'Muy activo (diario)'],
  },
  {
    role: 'bot',
    text: '¿Cuál es tu principal objetivo?',
    key: 'objetivo',
    inputType: 'options',
    options: ['Bajar de peso', 'Ganar músculo', 'Recomposición corporal', 'Mantenerme saludable', 'Solo organizar mis gastos'],
  },
  {
    role: 'bot',
    text: '¿Cuál es tu sueldo líquido mensual aproximado? (en pesos chilenos, solo el número)',
    key: 'ingreso',
    inputType: 'number',
  },
  {
    role: 'bot',
    text: '¿Qué día del mes te pagan?',
    key: 'dia_pago',
    inputType: 'options',
    options: ['Día 1', 'Día 5', 'Día 10', 'Día 15', 'Día 20', 'Día 25', 'Día 30'],
  },
]

// ── Componente principal ───────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([QUESTIONS[0]])
  const [currentQ, setCurrentQ] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [answers, setAnswers] = useState<Partial<Answers>>({})
  const [preview, setPreview] = useState<any>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [savingProgress, setSavingProgress] = useState('')
  const [error, setError] = useState('')
  const [editSection, setEditSection] = useState<string | null>(null)

  // Responder pregunta actual
  const handleAnswer = (value: string) => {
    const q = QUESTIONS[currentQ]
    const newAnswers = { ...answers, [q.key!]: value }
    setAnswers(newAnswers)

    // Agregar respuesta del usuario al chat
    const userMsg: ChatMessage = { role: 'user', text: value }
    const nextQ = currentQ + 1

    if (nextQ < QUESTIONS.length) {
      // Personalizar siguiente pregunta
      const next = { ...QUESTIONS[nextQ] }
      // Si ya sabemos el nombre, personalizar
      if (newAnswers.nombre && next.text.includes('¿')) {
        // mantenemos el texto base
      }
      setMessages(prev => [...prev, userMsg, next])
      setCurrentQ(nextQ)
    } else {
      // Todas las preguntas respondidas → llamar a la IA
      setMessages(prev => [...prev, userMsg, {
        role: 'bot',
        text: `¡Perfecto ${newAnswers.nombre}! 🎉 Con tus respuestas voy a generar tu perfil personalizado. Buscando productos reales en ${newAnswers.supermercado === 'Mezclo varios' ? 'Lider, Tottus y Jumbo' : newAnswers.supermercado}... Dame un momento.`,
      }])
      generateProfile(newAnswers as Answers)
    }
    setInputValue('')
  }

  const generateProfile = async (finalAnswers: Answers) => {
    setLoadingAI(true)
    setError('')
    try {
      const res = await fetch('/api/ai/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setPreview(data)
      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.mensaje_bienvenida ?? `¡Listo ${finalAnswers.nombre}! Generé tu perfil con ${data.productos?.length ?? 0} productos, ${data.centros_costo?.length ?? 0} centros de costo y un plan de la semana. Revísalo y ajusta lo que necesites antes de guardar.`,
      }])
      setPhase('preview')
    } catch (err) {
      setError('Hubo un error generando tu perfil. Intenta de nuevo.')
      setLoadingAI(false)
    }
    setLoadingAI(false)
  }

  const saveProfile = async () => {
    setPhase('saving')
    setError('')
    try {
      setSavingProgress('Guardando tu perfil...')
      const res = await fetch('/api/ai/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perfil: { ...preview.perfil, mascotas: answers.mascotas },
          centros_costo: preview.centros_costo,
          productos: preview.productos,
          plan_semana: preview.plan_semana,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSavingProgress('¡Todo listo!')
      setTimeout(() => router.push('/dashboard'), 1200)
    } catch (err) {
      setError('Error al guardar: ' + (err as Error).message)
      setPhase('preview')
    }
  }

  const updateProducto = (i: number, field: string, value: any) => {
    setPreview((prev: any) => {
      const prods = [...prev.productos]
      prods[i] = { ...prods[i], [field]: value }
      return { ...prev, productos: prods }
    })
  }

  const removeProducto = (i: number) => {
    setPreview((prev: any) => ({
      ...prev,
      productos: prev.productos.filter((_: any, idx: number) => idx !== i)
    }))
  }

  const updateCentro = (i: number, field: string, value: any) => {
    setPreview((prev: any) => {
      const cc = [...prev.centros_costo]
      cc[i] = { ...cc[i], [field]: value }
      return { ...prev, centros_costo: cc }
    })
  }

  // ── FASE: CHAT ─────────────────────────────────────────────
  if (phase === 'chat') {
    const currentQuestion = QUESTIONS[currentQ]
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-400 flex items-center justify-center text-white font-bold text-sm">G</div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Asistente GDV</div>
            <div className="text-xs text-teal-600">● En línea</div>
          </div>
          <div className="ml-auto text-xs text-gray-400">
            {currentQ}/{QUESTIONS.length} preguntas
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-teal-400 transition-all duration-500"
            style={{ width: `${(currentQ / QUESTIONS.length) * 100}%` }}
          />
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 max-w-2xl mx-auto w-full">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'bot' && (
                <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold mr-2 flex-shrink-0 mt-1">G</div>
              )}
              <div className={`rounded-2xl px-4 py-2.5 max-w-sm text-sm leading-relaxed ${
                msg.role === 'bot'
                  ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                  : 'bg-teal-500 text-white rounded-tr-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {loadingAI && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold mr-2 flex-shrink-0 mt-1">G</div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        {!loadingAI && currentQ < QUESTIONS.length && (
          <div className="bg-white border-t border-gray-200 px-4 py-3 max-w-2xl mx-auto w-full">
            {currentQuestion.inputType === 'options' ? (
              <div className="flex flex-wrap gap-2">
                {currentQuestion.options?.map(opt => (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 transition-all"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  type={currentQuestion.inputType === 'number' ? 'number' : 'text'}
                  placeholder={currentQuestion.inputType === 'number' ? '1300000' : 'Escribe tu respuesta...'}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && inputValue.trim() && handleAnswer(inputValue.trim())}
                  autoFocus
                />
                <button
                  onClick={() => inputValue.trim() && handleAnswer(inputValue.trim())}
                  disabled={!inputValue.trim()}
                  className="btn-primary px-4"
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}

        {error && <div className="px-4 pb-3 text-xs text-red-600 text-center">{error}</div>}
      </div>
    )
  }

  // ── FASE: PREVIEW ──────────────────────────────────────────
  if (phase === 'preview' && preview) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-400 flex items-center justify-center mx-auto mb-3 text-2xl">✨</div>
            <h1 className="text-xl font-semibold text-gray-900">Tu perfil está listo</h1>
            <p className="text-sm text-gray-500 mt-1">{preview.mensaje_bienvenida}</p>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

          {/* Centros de costo */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">💰 Centros de costo ({preview.centros_costo?.length})</h2>
              <button onClick={() => setEditSection(editSection === 'cc' ? null : 'cc')} className="text-xs text-blue-600 hover:underline">
                {editSection === 'cc' ? 'Listo' : 'Editar'}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {preview.centros_costo?.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-lg w-8">{c.icono}</span>
                  <div className="flex-1">
                    {editSection === 'cc' ? (
                      <input className="input text-sm py-1" value={c.nombre}
                        onChange={e => updateCentro(i, 'nombre', e.target.value)} />
                    ) : (
                      <div className="text-sm font-medium text-gray-800">{c.nombre}</div>
                    )}
                    <div className="text-xs text-gray-400 capitalize">{c.tipo.replace('_', ' ')}</div>
                  </div>
                  {editSection === 'cc' ? (
                    <input className="input text-sm py-1 w-28 text-right" type="number" value={c.monto}
                      onChange={e => updateCentro(i, 'monto', parseInt(e.target.value))} />
                  ) : (
                    <div className="text-sm font-semibold text-gray-900">${c.monto.toLocaleString('es-CL')}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-xs">
              <span className="text-gray-500">Total asignado</span>
              <span className="font-semibold">
                ${preview.centros_costo?.reduce((a: number, c: any) => a + c.monto, 0).toLocaleString('es-CL')} CLP
              </span>
            </div>
          </div>

          {/* Productos */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">🛒 Productos base ({preview.productos?.length})</h2>
              <button onClick={() => setEditSection(editSection === 'prod' ? null : 'prod')} className="text-xs text-blue-600 hover:underline">
                {editSection === 'prod' ? 'Listo' : 'Editar'}
              </button>
            </div>

            {/* Tabla compacta */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-1.5 text-gray-400 font-medium">Producto</th>
                    <th className="text-left py-1.5 text-gray-400 font-medium">Super</th>
                    <th className="text-right py-1.5 text-gray-400 font-medium">Precio</th>
                    <th className="text-right py-1.5 text-gray-400 font-medium">Stock</th>
                    {editSection === 'prod' && <th className="py-1.5" />}
                  </tr>
                </thead>
                <tbody>
                  {preview.productos?.map((p: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5">
                        {editSection === 'prod' ? (
                          <input className="input text-xs py-0.5" value={p.nombre}
                            onChange={e => updateProducto(i, 'nombre', e.target.value)} />
                        ) : (
                          <div>
                            <div className="font-medium text-gray-800">{p.nombre}</div>
                            <div className="text-gray-400">{p.marca}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-1.5">
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{p.supermercado}</span>
                      </td>
                      <td className="py-1.5 text-right">
                        {editSection === 'prod' ? (
                          <input className="input text-xs py-0.5 w-20 text-right" type="number" value={p.precio_clp}
                            onChange={e => updateProducto(i, 'precio_clp', parseInt(e.target.value))} />
                        ) : (
                          <span className="font-medium">${p.precio_clp?.toLocaleString('es-CL')}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right text-gray-500">{p.stock_inicial} {p.unidad}</td>
                      {editSection === 'prod' && (
                        <td className="py-1.5 pl-2">
                          <button onClick={() => removeProducto(i)} className="text-gray-300 hover:text-red-500">×</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Plan semana */}
          <div className="card mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">📅 Plan de la semana</h2>
            <div className="flex flex-col gap-2">
              {preview.plan_semana?.slice(0, 3).map((dia: any, i: number) => (
                <div key={i} className="flex gap-3 py-1.5 border-b border-gray-100 last:border-0 text-xs">
                  <div className="w-16 font-medium text-gray-600 capitalize">{dia.dia}</div>
                  <div className="flex-1 grid grid-cols-2 gap-1">
                    <span className="text-gray-500">🌅 {dia.desayuno}</span>
                    <span className="text-gray-500">☉ {dia.almuerzo}</span>
                    <span className="text-gray-500">🌙 {dia.cena}</span>
                    <span className="text-gray-500">◆ {dia.snack}</span>
                  </div>
                </div>
              ))}
              <div className="text-xs text-gray-400 text-center pt-1">+ {(preview.plan_semana?.length ?? 0) - 3} días más</div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={() => { setPhase('chat'); setMessages([QUESTIONS[0]]); setCurrentQ(0); setAnswers({}) }}
              className="btn flex-1"
            >
              ← Rehacer
            </button>
            <button onClick={saveProfile} className="btn-primary flex-1 py-3 text-base">
              ✓ Guardar y entrar a GDV
            </button>
          </div>
          <p className="text-xs text-center text-gray-400 mt-3">Podrás editar todo esto después desde el sistema</p>
        </div>
      </div>
    )
  }

  // ── FASE: SAVING ───────────────────────────────────────────
  if (phase === 'saving') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-400 flex items-center justify-center mx-auto mb-4 text-3xl animate-pulse">🚀</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{savingProgress}</h2>
          <p className="text-sm text-gray-500">Configurando tu sistema personalizado...</p>
        </div>
      </div>
    )
  }

  return null
}
