'use client'
/**
 * components/modules/banco/BancoClient.tsx
 * Módulo bancario — conexión Fintoc, movimientos, clasificación IA.
 */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/formatters'

type Tab = 'movimientos' | 'cuentas' | 'resumen'

export function BancoClient({ connections, transactions, costCenters, fintocPublicKey }: any) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('movimientos')
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [txList, setTxList] = useState(transactions)
  const [filter, setFilter] = useState({ search: '', costCenter: '', type: 'todos' })
  const [editingTx, setEditingTx] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [error, setError] = useState('')

  const hasConnection = connections.length > 0
  const allAccounts = connections.flatMap((c: any) => c.bank_accounts ?? [])
  const totalBalance = allAccounts.reduce((a: number, acc: any) => a + (acc.balance_available ?? 0), 0)

  const fmt = (n: number) => Math.abs(n).toLocaleString('es-CL')

  // Fintoc widget — carga el script y abre el widget
  const openFintocWidget = useCallback(() => {
    setConnecting(true)
    setError('')

    const script = document.createElement('script')
    script.src = 'https://js.fintoc.com/v1/'
    script.onload = () => {
      const widget = (window as any).Fintoc.create({
        publicKey: fintocPublicKey,
        product: 'movements',
        country: 'cl',
        institutionId: 'cl_banco_de_chile',
        onSuccess: async (token: string) => {
          try {
            const res = await fetch('/api/fintoc/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ link_token: token }),
            })
            const data = await res.json()
            if (data.ok) {
              router.refresh()
              handleSync()
            } else {
              setError(data.error ?? 'Error al conectar')
            }
          } catch (err) {
            setError('Error de conexión')
          }
          setConnecting(false)
        },
        onExit: () => setConnecting(false),
        onEvent: (event: any) => console.log('Fintoc event:', event),
      })
      widget.open()
    }
    script.onerror = () => {
      setError('No se pudo cargar el widget de Fintoc')
      setConnecting(false)
    }
    document.head.appendChild(script)
  }, [fintocPublicKey, router])

  // Sincronizar movimientos
  const handleSync = async (connectionId?: string) => {
    setSyncing(true)
    setSyncResult(null)
    setError('')
    try {
      const res = await fetch('/api/fintoc/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId, days_back: 30 }),
      })
      const data = await res.json()
      if (data.ok) {
        setSyncResult(data)
        router.refresh()
      } else {
        setError(data.error ?? 'Error al sincronizar')
      }
    } catch {
      setError('Error de conexión al sincronizar')
    }
    setSyncing(false)
  }

  // Auto-sync al cargar si hay conexión
  useEffect(() => {
    if (hasConnection && transactions.length === 0) {
      handleSync()
    }
  }, [])

  // Actualizar clasificación de una transacción
  const updateTxClassification = async (txId: string, costCenterId: string) => {
    await fetch(`/api/fintoc/sync`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_id: txId, cost_center_id: costCenterId }),
    })
    setTxList((prev: any[]) => prev.map(t => t.id === txId ? { ...t, cost_center_id: costCenterId } : t))
    setEditingTx(null)
  }

  // Filtrar transacciones
  const filtered = txList.filter((tx: any) => {
    const matchSearch = !filter.search || tx.description?.toLowerCase().includes(filter.search.toLowerCase()) || tx.merchant_name?.toLowerCase().includes(filter.search.toLowerCase())
    const matchCC = !filter.costCenter || tx.cost_center_id === filter.costCenter
    const matchType = filter.type === 'todos' || (filter.type === 'gastos' && tx.amount < 0) || (filter.type === 'ingresos' && tx.amount > 0)
    return matchSearch && matchCC && matchType && !tx.is_ignored
  })

  const totalGastos = filtered.filter((t: any) => t.amount < 0).reduce((a: number, t: any) => a + Math.abs(t.amount), 0)
  const totalIngresos = filtered.filter((t: any) => t.amount > 0).reduce((a: number, t: any) => a + t.amount, 0)

  // ── SIN CONEXIÓN ──────────────────────────────────────────
  if (!hasConnection) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🏦</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Conecta tu banco</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Vincula tu cuenta del Banco de Chile para sincronizar movimientos automáticamente,
            clasificar gastos con IA y tener tus finanzas siempre actualizadas.
          </p>
          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
            <div className="text-xs font-semibold text-blue-800 mb-2">¿Es seguro?</div>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>✓ GDV nunca ve ni almacena tu contraseña bancaria</li>
              <li>✓ Fintoc es la plataforma oficial de Open Banking en Chile</li>
              <li>✓ Acceso de solo lectura — no puede hacer transferencias</li>
              <li>✓ Puedes desconectar en cualquier momento</li>
            </ul>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</div>}
          <button
            onClick={openFintocWidget}
            disabled={connecting}
            className="btn-primary w-full py-3 text-base"
          >
            {connecting ? 'Abriendo widget...' : '🔗 Conectar Banco de Chile'}
          </button>
          <p className="text-xs text-gray-400 mt-3">Powered by Fintoc · Open Banking Chile</p>
        </div>
      </div>
    )
  }

  // ── CON CONEXIÓN ──────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <span className="metric-label">Saldo disponible</span>
          <span className="metric-value text-teal-600">${fmt(totalBalance)}</span>
          <span className="metric-sub">{allAccounts.length} cuenta{allAccounts.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Gastos (30d)</span>
          <span className="metric-value text-red-600">${fmt(totalGastos)}</span>
          <span className="metric-sub">{filtered.filter((t: any) => t.amount < 0).length} movimientos</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Ingresos (30d)</span>
          <span className="metric-value text-green-600">${fmt(totalIngresos)}</span>
          <span className="metric-sub">{filtered.filter((t: any) => t.amount > 0).length} movimientos</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Sin clasificar</span>
          <span className="metric-value text-amber-600">
            {txList.filter((t: any) => !t.cost_center_id && t.amount < 0).length}
          </span>
          <span className="metric-sub">Requieren revisión</span>
        </div>
      </div>

      {/* Barra de acción */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 border-b border-gray-200">
          {([['movimientos','Movimientos'],['cuentas','Cuentas'],['resumen','Resumen']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === k ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          {syncResult && (
            <span className="text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded">
              ✓ {syncResult.new_transactions} nuevos
            </span>
          )}
          <button
            onClick={() => handleSync()}
            disabled={syncing}
            className={cn('btn btn-sm', syncing && 'opacity-50')}
          >
            {syncing ? '⟳ Sincronizando...' : '⟳ Sincronizar'}
          </button>
          <button onClick={openFintocWidget} disabled={connecting} className="btn btn-sm">
            + Conectar otra cuenta
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      {/* MOVIMIENTOS */}
      {tab === 'movimientos' && (
        <div className="flex flex-col gap-3">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <input className="input max-w-xs text-sm" placeholder="Buscar movimiento..."
              value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
            <select className="select text-sm" value={filter.costCenter}
              onChange={e => setFilter(f => ({ ...f, costCenter: e.target.value }))}>
              <option value="">Todos los centros</option>
              {costCenters.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <div className="flex gap-1">
              {(['todos','gastos','ingresos'] as const).map(t => (
                <button key={t} onClick={() => setFilter(f => ({ ...f, type: t }))}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    filter.type === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de transacciones */}
          <div className="card divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                {syncing ? 'Sincronizando movimientos...' : 'Sin movimientos con esos filtros'}
              </div>
            ) : (
              filtered.map((tx: any) => (
                <div key={tx.id} className="py-3 flex items-start gap-3">
                  {/* Ícono tipo */}
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm',
                    tx.amount < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                  )}>
                    {tx.amount < 0 ? '↑' : '↓'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {tx.merchant_name ?? tx.description ?? 'Sin descripción'}
                        </div>
                        {tx.merchant_name && tx.description && (
                          <div className="text-xs text-gray-400 truncate">{tx.description}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">{tx.transaction_date} · {tx.bank_accounts?.name}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className={cn('text-sm font-semibold', tx.amount < 0 ? 'text-red-600' : 'text-green-600')}>
                          {tx.amount < 0 ? '-' : '+'}${fmt(tx.amount)}
                        </div>
                        {tx.ai_classified && (
                          <div className="text-xs text-purple-500">✦ IA</div>
                        )}
                      </div>
                    </div>

                    {/* Centro de costo */}
                    <div className="mt-1.5 flex items-center gap-2">
                      {editingTx === tx.id ? (
                        <div className="flex gap-1 items-center">
                          <select className="select text-xs py-0.5"
                            defaultValue={tx.cost_center_id ?? ''}
                            onChange={e => updateTxClassification(tx.id, e.target.value)}>
                            <option value="">Sin centro</option>
                            {costCenters.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                            ))}
                          </select>
                          <button onClick={() => setEditingTx(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingTx(tx.id)}
                          className={cn('text-xs rounded-full px-2 py-0.5 transition-colors',
                            tx.cost_centers
                              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          )}
                        >
                          {tx.cost_centers ? `${tx.cost_centers.icon} ${tx.cost_centers.name}` : '+ Clasificar'}
                        </button>
                      )}
                      {tx.category_gdv && !tx.cost_centers && (
                        <span className="text-xs text-gray-400">({tx.category_gdv})</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CUENTAS */}
      {tab === 'cuentas' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {connections.map((conn: any) => (
            <div key={conn.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold text-sm text-gray-900">{conn.institution}</div>
                  <div className="text-xs text-gray-400">{conn.holder_name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                    conn.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  )}>
                    {conn.status === 'active' ? '● Activo' : '● Error'}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-400 mb-3">
                Última sync: {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString('es-CL') : 'Nunca'}
              </div>
              {(conn.bank_accounts ?? []).map((acc: any) => (
                <div key={acc.id} className="bg-gray-50 rounded-lg p-3 mb-2 last:mb-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{acc.name}</div>
                      <div className="text-xs text-gray-400 capitalize">{acc.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-teal-700">${fmt(acc.balance_available)}</div>
                      <div className="text-xs text-gray-400">disponible</div>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => handleSync(conn.id)} disabled={syncing} className="btn btn-sm w-full mt-2">
                {syncing ? 'Sincronizando...' : '⟳ Sincronizar esta cuenta'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* RESUMEN */}
      {tab === 'resumen' && (
        <div className="card">
          <div className="text-sm font-semibold text-gray-800 mb-4">Gastos por centro de costo (30 días)</div>
          {(() => {
            const byCenter: Record<string, { name: string; icon: string; color: string; total: number }> = {}
            txList.filter((t: any) => t.amount < 0 && t.cost_centers).forEach((t: any) => {
              const cc = t.cost_centers
              if (!byCenter[t.cost_center_id]) {
                byCenter[t.cost_center_id] = { name: cc.name, icon: cc.icon ?? '💰', color: cc.color ?? '#888', total: 0 }
              }
              byCenter[t.cost_center_id].total += Math.abs(t.amount)
            })
            const sorted = Object.values(byCenter).sort((a, b) => b.total - a.total)
            const max = sorted[0]?.total ?? 1
            return sorted.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin transacciones clasificadas aún</p>
            ) : sorted.map((cc, i) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">{cc.icon} {cc.name}</span>
                  <span className="text-sm font-semibold">${fmt(cc.total)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(cc.total/max)*100}%`, background: cc.color }} />
                </div>
              </div>
            ))
          })()}
          <div className="border-t border-gray-200 pt-3 mt-2 flex justify-between text-sm">
            <span className="text-gray-500">Sin clasificar</span>
            <span className="font-semibold text-amber-600">
              ${fmt(txList.filter((t: any) => t.amount < 0 && !t.cost_center_id).reduce((a: number, t: any) => a + Math.abs(t.amount), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
