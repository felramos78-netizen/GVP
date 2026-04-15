'use client'
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

const SESSION_ID = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString()

export function AgenteWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'chat'|'historial'>('chat')
  const [messages, setMessages] = useState<Message[]>([{
    role: 'agent',
    content: '¡Hola! Soy tu asistente GDV 👋 Puedo ayudarte con stock, planner, finanzas y recetas. ¿En qué te ayudo?',
    timestamp: new Date().toISOString(),
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historial, setHistorial] = useState<any[]>([])
  const [listening, setListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false) // VOZ DESACTIVADA POR DEFAULT
  const [lastExecutedTool, setLastExecutedTool] = useState<string|null>(null)
  const [undoing, setUndoing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  useEffect(() => {
    if (open && tab === 'historial') {
      fetch('/api/agente/historial').then(r => r.json()).then(data => setHistorial(Array.isArray(data) ? data : [])).catch(() => {})
    }
  }, [open, tab])

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const clean = text.replace(/[✅❌🎉👋💡📦💰🍳📋↩️]/g, '').substring(0, 150)
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = 'es-CL'; u.rate = 1.1
    window.speechSynthesis.speak(u)
  }, [voiceEnabled])

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Usa Chrome o Edge para reconocimiento de voz'); return }
    const r = new SR(); r.lang = 'es-CL'; r.continuous = false; r.interimResults = false
    r.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false) }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    recognitionRef.current = r; r.start(); setListening(true)
  }, [])

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setListening(false) }, [])

  const handleDeshacer = async () => {
    setUndoing(true)
    try {
      const res = await fetch('/api/agente/deshacer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: SESSION_ID }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'agent', content: data.ok ? `↩️ ${data.message}` : `❌ ${data.error ?? data.message}`, timestamp: new Date().toISOString() }])
      if (data.ok) setLastExecutedTool(null)
    } catch { setMessages(prev => [...prev, { role: 'agent', content: '❌ Error al deshacer', timestamp: new Date().toISOString() }]) }
    setUndoing(false)
  }

  const sendMessage = async (text: string, approvedAction?: any) => {
    if (!text.trim() && !approvedAction) return
    setLoading(true); setInput('')
    if (text.trim()) setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }])
    try {
      const res = await fetch('/api/agente', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text || 'Confirmo', session_id: SESSION_ID, page: pathname, history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })), approved_action: approvedAction ?? null }),
      })
      const data = await res.json()
      const agentMsg: Message = { role: 'agent', content: data.response ?? '...', pending_action: data.pending_action ?? null, action_executed: data.action_executed ?? false, timestamp: new Date().toISOString() }
      setMessages(prev => [...prev, agentMsg])
      speak(agentMsg.content)
      if (data.action_executed) setLastExecutedTool(data.result?.tool ?? 'acción')
    } catch { setMessages(prev => [...prev, { role: 'agent', content: '❌ Error de conexión.', timestamp: new Date().toISOString() }]) }
    setLoading(false)
  }

  const approveAction = (action: any) => sendMessage('', action)

  const rejectAction = () => {
    setMessages(prev => { const u = [...prev]; if (u[u.length-1]?.pending_action) u[u.length-1] = { ...u[u.length-1], pending_action: null }; return u })
    setMessages(prev => [...prev, { role: 'agent', content: 'Entendido, no ejecuto nada. ¿Algo más?', timestamp: new Date().toISOString() }])
  }

  const formatTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

  const QUICK = ['¿Qué tengo en stock?', '¿Qué puedo cocinar hoy?', '¿Cuánto gasté este mes?', 'Planifica mi almuerzo esta semana']

  return (
    <>
      <button onClick={() => setOpen(o => !o)}
        className={cn('fixed bottom-5 right-5 z-50 w-[52px] h-[52px] rounded-full shadow-lg flex items-center justify-center text-xl transition-all',
          open ? 'bg-gray-800 text-white' : 'bg-teal-500 text-white hover:bg-teal-600'
        )}>
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] max-h-[580px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-teal-500 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base">🤖</div>
              <div>
                <div className="text-sm font-semibold">Asistente GDV</div>
                <div className="text-xs opacity-75">{loading ? 'Pensando...' : '● En línea'}</div>
              </div>
            </div>
            <div className="flex gap-1.5 items-center">
              {lastExecutedTool && (
                <button onClick={handleDeshacer} disabled={undoing}
                  className="text-xs bg-white/20 rounded px-2 py-1 hover:bg-white/30 disabled:opacity-50">
                  {undoing ? '...' : '↩️'}
                </button>
              )}
              {/* Toggle voz */}
              <button onClick={() => setVoiceEnabled(v => !v)}
                className={cn('text-xs rounded px-2 py-1 transition-all', voiceEnabled ? 'bg-white text-teal-700 font-medium' : 'bg-white/20 hover:bg-white/30')}
                title={voiceEnabled ? 'Voz activada — click para desactivar' : 'Activar voz'}>
                {voiceEnabled ? '🔊' : '🔇'}
              </button>
              <button onClick={() => setTab(t => t === 'chat' ? 'historial' : 'chat')}
                className="text-xs bg-white/20 rounded px-2 py-1 hover:bg-white/30">
                {tab === 'chat' ? '📋' : '💬'}
              </button>
            </div>
          </div>

          {/* Chat */}
          {tab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
                    <div className={cn('rounded-2xl px-3 py-2 max-w-[85%] text-sm leading-relaxed',
                      msg.role === 'user' ? 'bg-teal-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    )}>
                      {msg.content}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 px-1">{formatTime(msg.timestamp)}</div>
                    {msg.pending_action && !msg.action_executed && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 max-w-[90%] w-full">
                        <div className="text-xs font-semibold text-amber-800 mb-1">Acción propuesta</div>
                        <div className="text-xs text-amber-700 mb-3">{msg.pending_action.pregunta_confirmacion}</div>
                        <div className="flex gap-2">
                          <button onClick={() => approveAction(msg.pending_action)} className="flex-1 bg-teal-500 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-teal-600">✓ Sí</button>
                          <button onClick={rejectAction} className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">✕ No</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-start">
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="flex gap-1">
                        {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />)}
                      </div>
                    </div>
                  </div>
                )}
                {messages.length === 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {QUICK.map(q => (
                      <button key={q} onClick={() => sendMessage(q)}
                        className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1 hover:bg-teal-100">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
                <div className="flex gap-2 items-center">
                  <button onClick={listening ? stopListening : startListening}
                    className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                      listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}>
                    {listening ? '⏹' : '🎤'}
                  </button>
                  <input ref={inputRef} className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-teal-400"
                    placeholder="Escribe o habla..." value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !loading && sendMessage(input)}
                    disabled={loading} />
                  <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
                    className="w-9 h-9 rounded-full bg-teal-500 text-white flex items-center justify-center flex-shrink-0 hover:bg-teal-600 disabled:opacity-40">
                    →
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Historial */}
          {tab === 'historial' && (
            <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
              {historial.length === 0 ? <div className="text-center text-sm text-gray-400 py-8">Sin historial aún</div> : (
                <div className="flex flex-col gap-2">
                  {historial.slice(0, 50).map((h: any) => (
                    <div key={h.id} className={cn('text-xs rounded-lg px-3 py-2', h.role === 'user' ? 'bg-teal-50 text-teal-800 ml-6' : 'bg-gray-50 text-gray-700 mr-6')}>
                      <div className="font-medium mb-0.5">{h.role === 'user' ? 'Tú' : 'Agente'}</div>
                      <div>{h.content}</div>
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
