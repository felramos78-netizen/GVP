'use client'
/**
 * components/modules/agente/AgenteWidget.tsx
 * Mesa de ayuda — chat flotante con IA accesible desde cualquier pantalla.
 * Voz + texto, function calling, historial persistente, aprobación de acciones.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/formatters'

interface Message {
  role: 'user' | 'agent'
  content: string
  pending_action?: any
  action_executed?: boolean
  timestamp: string
}

const SESSION_ID = crypto.randomUUID()

export function AgenteWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'chat'|'historial'>('chat')
  const [messages, setMessages] = useState<Message[]>([{
    role: 'agent',
    content: '¡Hola! Soy tu asistente GDV 👋 Puedo ayudarte a gestionar tu stock, planner, finanzas y recetas. También puedo reportar errores automáticamente. ¿En qué te ayudo?',
    timestamp: new Date().toISOString(),
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historial, setHistorial] = useState<any[]>([])
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [lastExecutedTool, setLastExecutedTool] = useState<string|null>(null)
  const [undoing, setUndoing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Cargar historial cuando se abre
  useEffect(() => {
    if (open && tab === 'historial') {
      fetch('/api/agente/historial')
        .then(r => r.json())
        .then(data => setHistorial(Array.isArray(data) ? data : []))
        .catch(() => {})
    }
  }, [open, tab])

  // Web Speech API — reconocimiento de voz
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.')
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-CL'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setListening(false)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  // Text to speech
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const clean = text.replace(/[✅❌🎉👋💡📦💰🍳📋]/g, '')
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = 'es-CL'
    utterance.rate = 1.1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])


  const handleDeshacer = async () => {
    setUndoing(true)
    try {
      const res = await fetch('/api/agente/deshacer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID }),
      })
      const data = await res.json()
      const msg: Message = {
        role: 'agent',
        content: data.ok ? `↩️ ${data.message}` : `❌ ${data.error ?? data.message}`,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, msg])
      if (data.ok) setLastExecutedTool(null)
    } catch {
      setMessages(prev => [...prev, { role: 'agent', content: '❌ Error al deshacer', timestamp: new Date().toISOString() }])
    }
    setUndoing(false)
  }

  // Enviar mensaje
  const sendMessage = async (text: string, approvedAction?: any) => {
    if (!text.trim() && !approvedAction) return
    setLoading(true)
    setInput('')

    if (text.trim()) {
      setMessages(prev => [...prev, {
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      }])
    }

    try {
      const res = await fetch('/api/agente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text || (approvedAction ? `Confirmo: ${approvedAction.pregunta_confirmacion}` : ''),
          session_id: SESSION_ID,
          page: pathname,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          approved_action: approvedAction ?? null,
        }),
      })

      const data = await res.json()
      const agentMsg: Message = {
        role: 'agent',
        content: data.response ?? data.error ?? 'Sin respuesta',
        pending_action: data.pending_action ?? null,
        action_executed: data.action_executed ?? false,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, agentMsg])
      speak(agentMsg.content.substring(0, 200))
      if (data.action_executed) setLastExecutedTool(data.result?.tool ?? 'acción')
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'agent',
        content: '❌ Error de conexión. Intenta de nuevo.',
        timestamp: new Date().toISOString(),
      }])
    }
    setLoading(false)
  }

  // Aprobar acción propuesta
  const approveAction = (action: any) => {
    sendMessage('', action)
  }

  const rejectAction = () => {
    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last?.pending_action) {
        updated[updated.length - 1] = { ...last, pending_action: null }
      }
      return updated
    })
    setMessages(prev => [...prev, {
      role: 'agent',
      content: 'Entendido, no ejecuto la acción. ¿Hay algo más en que pueda ayudarte?',
      timestamp: new Date().toISOString(),
    }])
  }

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  // Sugerencias rápidas
  const QUICK = [
    '¿Qué tengo en stock?',
    '¿Qué puedo cocinar hoy?',
    '¿Cuánto gasté este mes?',
    'Planifica mi almuerzo esta semana',
  ]

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all',
          'w-[52px] h-[52px] text-xl',
          open ? 'bg-gray-800 text-white rotate-45' : 'bg-teal-500 text-white hover:bg-teal-600'
        )}
        title="Asistente GDV"
      >
        {open ? '✕' : '🤖'}
        {speaking && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
        )}
      </button>

      {/* Panel del chat */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-teal-500 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base">🤖</div>
              <div>
                <div className="text-sm font-semibold">Asistente GDV</div>
                <div className="text-xs opacity-75">
                  {loading ? 'Pensando...' : speaking ? '🔊 Hablando...' : '● En línea'}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {lastExecutedTool && (
                <button
                  onClick={handleDeshacer}
                  disabled={undoing}
                  className="text-xs bg-white/20 rounded px-2 py-1 hover:bg-white/30 disabled:opacity-50"
                  title="Deshacer última acción"
                >
                  {undoing ? '...' : '↩️ Deshacer'}
                </button>
              )}
              {speaking && (
                <button onClick={stopSpeaking} className="text-xs bg-white/20 rounded px-2 py-1 hover:bg-white/30">
                  🔇
                </button>
              )}
              <button
                onClick={() => setTab(t => t === 'chat' ? 'historial' : 'chat')}
                className="text-xs bg-white/20 rounded px-2 py-1 hover:bg-white/30"
              >
                {tab === 'chat' ? '📋 Historial' : '💬 Chat'}
              </button>
            </div>
          </div>

          {/* Chat */}
          {tab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
                    <div className={cn(
                      'rounded-2xl px-3 py-2 max-w-[85%] text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-teal-500 text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    )}>
                      {msg.content}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 px-1">{formatTime(msg.timestamp)}</div>

                    {/* Botones de aprobación */}
                    {msg.pending_action && !msg.action_executed && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 max-w-[90%] w-full">
                        <div className="text-xs font-semibold text-amber-800 mb-2">
                          Acción propuesta: <span className="font-mono">{msg.pending_action.tool}</span>
                        </div>
                        <div className="text-xs text-amber-700 mb-3">
                          {msg.pending_action.pregunta_confirmacion}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveAction(msg.pending_action)}
                            className="flex-1 bg-teal-500 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-teal-600 transition-colors"
                          >
                            ✓ Sí, ejecutar
                          </button>
                          <button
                            onClick={rejectAction}
                            className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            ✕ No
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex items-start gap-2">
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="flex gap-1">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sugerencias rápidas si es el inicio */}
                {messages.length === 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {QUICK.map(q => (
                      <button key={q} onClick={() => sendMessage(q)}
                        className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1 hover:bg-teal-100 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={listening ? stopListening : startListening}
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                      listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}
                    title={listening ? 'Detener' : 'Hablar'}
                  >
                    {listening ? '⏹' : '🎤'}
                  </button>
                  <input
                    ref={inputRef}
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-teal-400 transition-colors"
                    placeholder="Escribe o habla..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !loading && sendMessage(input)}
                    disabled={loading}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={loading || !input.trim()}
                    className="w-9 h-9 rounded-full bg-teal-500 text-white flex items-center justify-center flex-shrink-0 hover:bg-teal-600 disabled:opacity-40 transition-all"
                  >
                    →
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Historial */}
          {tab === 'historial' && (
            <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
              {historial.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-8">Sin historial aún</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {historial.slice(0, 50).map((h: any) => (
                    <div key={h.id} className={cn('text-xs rounded-lg px-3 py-2',
                      h.role === 'user' ? 'bg-teal-50 text-teal-800 ml-6' : 'bg-gray-50 text-gray-700 mr-6'
                    )}>
                      <div className="font-medium mb-0.5">{h.role === 'user' ? 'Tú' : 'Agente'}</div>
                      <div>{h.content}</div>
                      {h.action && <div className="mt-1 opacity-60 font-mono">↳ {JSON.stringify(h.action).substring(0, 60)}...</div>}
                      <div className="mt-1 opacity-50">{new Date(h.created_at).toLocaleString('es-CL')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
