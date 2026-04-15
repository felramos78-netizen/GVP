'use client'
/**
 * BancoClient — importación por archivo Excel/CSV como método principal.
 * Fintoc queda como opción alternativa (requiere plan pagado).
 */
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/formatters'
import * as XLSX from 'xlsx'

type Tab = 'movimientos' | 'cuentas' | 'resumen'
type ImportStep = 'idle' | 'processing' | 'preview' | 'done'

export function BancoClient({ connections, transactions, costCenters, fintocPublicKey }: any) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('movimientos')
  const [txList, setTxList] = useState(transactions)
  const [importStep, setImportStep] = useState<ImportStep>('idle')
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [editingTx, setEditingTx] = useState<string|null>(null)
  const [filter, setFilter] = useState({ search: '', type: 'todos' })

  const hasConnection = connections.length > 0
  const allAccounts = connections.flatMap((c: any) => c.bank_accounts ?? [])
  const totalBalance = allAccounts.reduce((a: number, acc: any) => a + (acc.balance_available ?? 0), 0)
  const fmt = (n: number) => Math.abs(Math.round(n)).toLocaleString('es-CL')

  // Parsear archivo Excel o CSV del banco
  const parseFile = useCallback(async (file: File) => {
    setError('')
    setImportStep('processing')
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Detectar fila de cabecera buscando palabras clave
      const headerKeywords = ['fecha', 'descripcion', 'descripción', 'cargo', 'abono', 'saldo', 'monto']
      let headerIdx = 0
      for (let i = 0; i < Math.min(10, raw.length); i++) {
        const row = raw[i].map((c: any) => String(c).toLowerCase())
        if (headerKeywords.some(k => row.some((c: string) => c.includes(k)))) {
          headerIdx = i; break
        }
      }

      const headers = raw[headerIdx].map((h: any) => String(h).toLowerCase().trim())
      const dataRows = raw.slice(headerIdx + 1).filter((r: any[]) => r.some(c => c !== ''))

      // Mapear columnas flexiblemente
      const col = (keys: string[]) => {
        for (const k of keys) {
          const idx = headers.findIndex((h: string) => h.includes(k))
          if (idx >= 0) return idx
        }
        return -1
      }

      const fechaIdx = col(['fecha', 'date'])
      const descIdx = col(['descripcion', 'descripción', 'glosa', 'concepto', 'detalle'])
      const cargoIdx = col(['cargo', 'débito', 'debito', 'egreso'])
      const abonoIdx = col(['abono', 'crédito', 'credito', 'ingreso'])
      const saldoIdx = col(['saldo', 'balance'])

      const parseNum = (v: any) => {
        if (typeof v === 'number') return v
        const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
        return parseFloat(s) || 0
      }

      const parseDate = (v: any) => {
        if (!v) return ''
        if (v instanceof Date) return v.toISOString().split('T')[0]
        const s = String(v).trim()
        // DD/MM/YYYY o DD-MM-YYYY
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
        if (m) {
          const y = m[3].length === 2 ? '20' + m[3] : m[3]
          return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
        }
        return s
      }

      const rows = dataRows
        .map((r: any[]) => ({
          fecha: fechaIdx >= 0 ? parseDate(r[fechaIdx]) : '',
          descripcion: descIdx >= 0 ? String(r[descIdx]).trim() : '',
          cargo: cargoIdx >= 0 ? parseNum(r[cargoIdx]) : 0,
          abono: abonoIdx >= 0 ? parseNum(r[abonoIdx]) : 0,
          saldo: saldoIdx >= 0 ? parseNum(r[saldoIdx]) : 0,
        }))
        .filter(r => r.fecha && r.descripcion && (r.cargo > 0 || r.abono > 0))
        .slice(0, 100)

      if (rows.length === 0) throw new Error('No se encontraron movimientos. Verifica que el archivo sea el correcto.')

      setParsedRows(rows)
      setImportStep('preview')
    } catch (err) {
      setError((err as Error).message)
      setImportStep('idle')
    }
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const handleImport = async () => {
    setImporting(true); setError('')
    try {
      const res = await fetch('/api/banco', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows, institution: 'Banco de Chile' }),
      })
      const data = await res.json()
      if (data.ok) {
        setImportResult(data)
        setImportStep('done')
        router.refresh()
      } else {
        setError(data.error ?? 'Error al importar')
      }
    } catch { setError('Error de conexión') }
    setImporting(false)
  }

  const updateTxClass = async (txId: string, costCenterId: string) => {
    await fetch('/api/banco', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tx_id: txId, cost_center_id: costCenterId }) })
    setTxList((prev: any[]) => prev.map(t => t.id === txId ? { ...t, cost_center_id: costCenterId, cost_centers: costCenters.find((c: any) => c.id === costCenterId) } : t))
    setEditingTx(null)
  }

  const filtered = txList.filter((tx: any) => {
    const matchSearch = !filter.search || tx.description?.toLowerCase().includes(filter.search.toLowerCase()) || tx.merchant_name?.toLowerCase().includes(filter.search.toLowerCase())
    const matchType = filter.type === 'todos' || (filter.type === 'gastos' && tx.amount < 0) || (filter.type === 'ingresos' && tx.amount > 0)
    return matchSearch && matchType && !tx.is_ignored
  })

  const totalGastos = txList.filter((t: any) => t.amount < 0).reduce((a: number, t: any) => a + Math.abs(t.amount), 0)
  const totalIngresos = txList.filter((t: any) => t.amount > 0).reduce((a: number, t: any) => a + t.amount, 0)
  const sinClasificar = txList.filter((t: any) => !t.cost_center_id && t.amount < 0).length

  return (
    <div className="flex flex-col gap-4">

      {/* Métricas */}
      {(hasConnection || txList.length > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="metric-card"><span className="metric-label">Saldo</span><span className="metric-value text-teal-600">${fmt(totalBalance)}</span></div>
          <div className="metric-card"><span className="metric-label">Gastos (30d)</span><span className="metric-value text-red-600">${fmt(totalGastos)}</span></div>
          <div className="metric-card"><span className="metric-label">Ingresos (30d)</span><span className="metric-value text-green-600">${fmt(totalIngresos)}</span></div>
          <div className="metric-card"><span className="metric-label">Sin clasificar</span><span className="metric-value text-amber-600">{sinClasificar}</span></div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          {(['movimientos','cuentas','resumen'] as const).map(k => (
            <button key={k} onClick={() => setTab(k)}
              className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
                tab === k ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>{k}</button>
          ))}
        </div>
        <button onClick={() => { setImportStep('idle'); setParsedRows([]); setImportResult(null) }}
          className="btn btn-sm mb-1">
          + Importar movimientos
        </button>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      {/* PANEL IMPORTAR */}
      {importStep !== 'idle' && importStep !== 'done' && (
        <div className="card">
          {importStep === 'processing' && (
            <div className="text-center py-8">
              <div className="text-3xl mb-3 animate-spin">⚙️</div>
              <div className="text-sm text-gray-600">Leyendo archivo...</div>
            </div>
          )}
          {importStep === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{parsedRows.length} movimientos detectados</div>
                  <div className="text-xs text-gray-400">Revisa antes de importar — la IA los clasificará automáticamente</div>
                </div>
                <button onClick={() => setImportStep('idle')} className="btn btn-sm">Cancelar</button>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto mb-4">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1.5 px-2 text-gray-500">Fecha</th>
                      <th className="text-left py-1.5 px-2 text-gray-500">Descripción</th>
                      <th className="text-right py-1.5 px-2 text-gray-500">Cargo</th>
                      <th className="text-right py-1.5 px-2 text-gray-500">Abono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5 px-2 text-gray-500">{r.fecha}</td>
                        <td className="py-1.5 px-2 font-medium text-gray-800 max-w-[200px] truncate">{r.descripcion}</td>
                        <td className="py-1.5 px-2 text-right text-red-600">{r.cargo > 0 ? `$${fmt(r.cargo)}` : ''}</td>
                        <td className="py-1.5 px-2 text-right text-green-600">{r.abono > 0 ? `$${fmt(r.abono)}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={handleImport} disabled={importing} className="btn-primary w-full">
                {importing ? '⚙️ Importando y clasificando con IA...' : `✓ Importar ${parsedRows.length} movimientos`}
              </button>
            </div>
          )}
        </div>
      )}

      {importStep === 'done' && (
        <div className="card text-center">
          <div className="text-3xl mb-2">🎉</div>
          <div className="text-sm font-semibold text-gray-900 mb-1">{importResult?.inserted} movimientos importados</div>
          <p className="text-xs text-gray-500 mb-3">Clasificados automáticamente por IA. Revisa y ajusta en la lista.</p>
          <button onClick={() => { setImportStep('idle'); setTab('movimientos') }} className="btn">Ver movimientos</button>
        </div>
      )}

      {/* DROP ZONE — visible cuando importStep es idle */}
      {importStep === 'idle' && tab === 'movimientos' && txList.length === 0 && (
        <div className="max-w-xl">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn('border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
              dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
            )}>
            <div className="text-4xl mb-3">📊</div>
            <div className="text-sm font-semibold text-gray-700 mb-2">Arrastra o sube tu cartola bancaria</div>
            <div className="text-xs text-gray-400 mb-4">Excel (.xlsx) o CSV exportado desde la web del banco</div>
            <div className="bg-blue-50 rounded-lg p-3 text-left text-xs text-blue-700">
              <div className="font-semibold mb-1">¿Cómo exportar desde Banco de Chile?</div>
              <div>1. Entra a Mi Banco en línea → Cuentas</div>
              <div>2. Click en tu cuenta → Movimientos</div>
              <div>3. Selecciona el período → Exportar Excel</div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])} />
          </div>
          <div className="mt-3 text-center">
            <button onClick={() => {}} className="text-xs text-gray-400 hover:text-gray-600 underline">
              ¿Prefieres conectar directamente con Fintoc? (requiere plan pagado)
            </button>
          </div>
        </div>
      )}

      {/* MOVIMIENTOS */}
      {tab === 'movimientos' && txList.length > 0 && importStep === 'idle' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input className="input max-w-xs text-sm" placeholder="Buscar movimiento..."
              value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
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
          <div className="card divide-y divide-gray-100">
            {filtered.length === 0
              ? <div className="text-center py-8 text-sm text-gray-400">Sin movimientos</div>
              : filtered.map((tx: any) => (
                <div key={tx.id} className="py-3 flex items-start gap-3">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                    tx.amount < 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600')}>
                    {tx.amount < 0 ? '↑' : '↓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{tx.merchant_name ?? tx.description}</div>
                        {tx.merchant_name && <div className="text-xs text-gray-400 truncate">{tx.description}</div>}
                        <div className="text-xs text-gray-400">{tx.transaction_date}</div>
                      </div>
                      <div className={cn('text-sm font-semibold flex-shrink-0', tx.amount < 0 ? 'text-red-600' : 'text-green-600')}>
                        {tx.amount < 0 ? '-' : '+'}${fmt(tx.amount)}
                      </div>
                    </div>
                    <div className="mt-1.5">
                      {editingTx === tx.id ? (
                        <div className="flex gap-1">
                          <select className="select text-xs py-0.5" defaultValue={tx.cost_center_id ?? ''}
                            onChange={e => updateTxClass(tx.id, e.target.value)}>
                            <option value="">Sin centro</option>
                            {costCenters.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                          </select>
                          <button onClick={() => setEditingTx(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingTx(tx.id)}
                          className={cn('text-xs rounded-full px-2 py-0.5',
                            tx.cost_centers ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          )}>
                          {tx.cost_centers ? `${tx.cost_centers.icon ?? ''} ${tx.cost_centers.name}` : '+ Clasificar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* CUENTAS */}
      {tab === 'cuentas' && (
        <div>
          {connections.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm text-gray-400 mb-3">Sin cuentas importadas aún.</p>
              <button onClick={() => { setTab('movimientos'); setImportStep('idle') }} className="btn">Importar movimientos</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {connections.map((c: any) => (
                <div key={c.id} className="card">
                  <div className="font-semibold text-sm mb-1">{c.institution}</div>
                  <div className="text-xs text-gray-400 mb-3">Última sync: {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString('es-CL') : 'Nunca'}</div>
                  {(c.bank_accounts ?? []).map((acc: any) => (
                    <div key={acc.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between">
                        <div><div className="text-sm font-medium">{acc.name}</div><div className="text-xs text-gray-400 capitalize">{acc.type?.replace('_', ' ')}</div></div>
                        <div className="text-right"><div className="text-sm font-semibold text-teal-700">${fmt(acc.balance_available)}</div><div className="text-xs text-gray-400">disponible</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RESUMEN */}
      {tab === 'resumen' && (
        <div className="card">
          <div className="text-sm font-semibold text-gray-800 mb-4">Gastos por centro de costo</div>
          {(() => {
            const byCenter: Record<string, any> = {}
            txList.filter((t: any) => t.amount < 0 && t.cost_centers).forEach((t: any) => {
              const id = t.cost_center_id
              if (!byCenter[id]) byCenter[id] = { ...t.cost_centers, total: 0 }
              byCenter[id].total += Math.abs(t.amount)
            })
            const sorted = Object.values(byCenter).sort((a: any, b: any) => b.total - a.total)
            const max = sorted[0]?.total ?? 1
            return sorted.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Sin movimientos clasificados aún</p>
              : sorted.map((cc: any, i) => (
                <div key={i} className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm">{cc.icon ?? '💰'} {cc.name}</span>
                    <span className="text-sm font-semibold">${fmt(cc.total)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${(cc.total/max)*100}%` }} />
                  </div>
                </div>
              ))
          })()}
        </div>
      )}
    </div>
  )
}
