'use client'
/**
 * BancoClient — importación por archivo PDF, Excel o CSV.
 * PDF: cartola o estado de cuenta tarjeta de crédito (extracción via Gemini).
 * Excel/CSV: exportado desde la web del banco.
 */
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/formatters'
import * as XLSX from 'xlsx'

type Tab = 'movimientos' | 'cuentas' | 'resumen'
type ImportStep = 'idle' | 'processing' | 'preview' | 'done'

export function BancoClient({ connections, transactions, costCenters, suppliers = [], fintocPublicKey }: any) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('movimientos')
  const [txList, setTxList] = useState(transactions)
  const [importStep, setImportStep] = useState<ImportStep>('idle')
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [documentType, setDocumentType] = useState<'cartola' | 'tarjeta_credito'>('cartola')
  const [pdfInstitution, setPdfInstitution] = useState<string>('Banco de Chile')
  const [processingMsg, setProcessingMsg] = useState('Leyendo archivo...')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [editingTx, setEditingTx] = useState<string|null>(null)
  const [filter, setFilter] = useState({ search: '', type: 'todos' })

  // ── Cruce de proveedores ──────────────────────────────────────────────────
  // matchMap: clave = (comercio || descripcion) → { supplier_id, nombre_sugerido, tipo_sugerido, es_nuevo }
  const [matchMap, setMatchMap] = useState<Record<string, any>>({})
  const [matchingProviders, setMatchingProviders] = useState(false)
  // rowOverrides: índice de fila → { supplier_id?, cost_center_id?, nombre_proveedor? }
  const [rowOverrides, setRowOverrides] = useState<Record<number, any>>({})
  // Mini-form para crear proveedor nuevo inline
  const [newProvForm, setNewProvForm] = useState<{ idx: number; nombre: string; tipo: string } | null>(null)
  const [savingProv, setSavingProv] = useState(false)

  const hasConnection = connections.length > 0
  const allAccounts = connections.flatMap((c: any) => c.bank_accounts ?? [])
  const totalBalance = allAccounts.reduce((a: number, acc: any) => a + (acc.balance_available ?? 0), 0)
  const fmt = (n: number) => Math.abs(Math.round(n)).toLocaleString('es-CL')

  // Parsear PDF usando Gemini via /api/banco/pdf
  const parsePdf = useCallback(async (file: File) => {
    setError('')
    setProcessingMsg('Extrayendo movimientos del PDF con IA...')
    setImportStep('processing')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/banco/pdf', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el PDF')

      const rows = (data.transactions ?? []).map((tx: any) => ({
        fecha: tx.fecha,
        descripcion: tx.descripcion,
        comercio: tx.comercio ?? null,
        cargo: tx.cargo ?? 0,
        abono: tx.abono ?? 0,
        saldo: tx.saldo ?? null,
      }))

      if (rows.length === 0) throw new Error('No se encontraron movimientos en el PDF. Verifica que sea una cartola o estado de cuenta válido con transacciones.')

      setDocumentType(data.document_type ?? 'cartola')
      setPdfInstitution(data.institution ?? 'Banco de Chile')
      setParsedRows(rows)
      setImportStep('preview')
      fetchProviderMatches(rows)
    } catch (err) {
      setError((err as Error).message)
      setImportStep('idle')
    }
  }, [])

  // Cruzar descripciones con proveedores existentes via IA
  const fetchProviderMatches = useCallback(async (rows: any[]) => {
    setMatchingProviders(true)
    setMatchMap({})
    setRowOverrides({})
    try {
      const descriptions = [...new Set(rows.map((r: any) => r.comercio || r.descripcion))]
      const res = await fetch('/api/banco/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'match', descriptions }),
      })
      const data = await res.json()
      const map: Record<string, any> = {}
      for (const m of (data.matches ?? [])) {
        map[m.description] = m
      }
      setMatchMap(map)
    } catch { /* si falla, se importa sin proveedor */ }
    setMatchingProviders(false)
  }, [])

  // Parsear archivo Excel o CSV del banco
  const parseFile = useCallback(async (file: File) => {
    // Despachar según tipo de archivo
    if (file.name.toLowerCase().endsWith('.pdf')) {
      return parsePdf(file)
    }

    setError('')
    setProcessingMsg('Leyendo archivo...')
    setImportStep('processing')
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Detectar fila de cabecera buscando palabras clave
      const headerKeywords = ['fecha', 'descripcion', 'descripción', 'cargo', 'abono', 'saldo', 'monto', 'glosa', 'debe', 'haber']
      let headerIdx = 0
      for (let i = 0; i < Math.min(15, raw.length); i++) {
        const row = raw[i].map((c: any) => String(c).toLowerCase())
        if (headerKeywords.filter(k => row.some((c: string) => c.includes(k))).length >= 2) {
          headerIdx = i; break
        }
      }

      const headers = raw[headerIdx].map((h: any) => String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim())
      const dataRows = raw.slice(headerIdx + 1).filter((r: any[]) => r.some(c => c !== ''))

      // Mapear columnas flexiblemente (normaliza tildes para comparar)
      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const col = (keys: string[]) => {
        for (const k of keys) {
          const idx = headers.findIndex((h: string) => h.includes(normalize(k)))
          if (idx >= 0) return idx
        }
        return -1
      }

      const fechaIdx = col(['fecha', 'date', 'fec'])
      const descIdx = col(['descripcion', 'glosa', 'concepto', 'detalle', 'descripci', 'movimiento', 'operacion'])
      const cargoIdx = col(['cargo', 'debito', 'debe', 'egreso', 'retiro', 'gasto'])
      const abonoIdx = col(['abono', 'credito', 'haber', 'ingreso', 'deposito'])
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
        .slice(0, 500)

      if (rows.length === 0) {
        const colsFound = [
          fechaIdx >= 0 ? 'fecha' : null,
          descIdx >= 0 ? 'descripción' : null,
          cargoIdx >= 0 ? 'cargo' : null,
          abonoIdx >= 0 ? 'abono' : null,
        ].filter(Boolean)
        const hint = colsFound.length < 2
          ? 'No se detectaron columnas bancarias estándar. Asegúrate de exportar desde tu banco incluyendo columnas de fecha, descripción y monto.'
          : 'Se detectaron columnas pero no se encontraron montos válidos. Verifica que el archivo tenga datos con cargos o abonos.'
        throw new Error(hint)
      }

      setDocumentType('cartola')
      setParsedRows(rows)
      setImportStep('preview')
      fetchProviderMatches(rows)
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
      // Fusionar matches de proveedores + overrides manuales en cada fila
      const enrichedRows = parsedRows.map((row, i) => {
        const key = row.comercio || row.descripcion
        const match = matchMap[key]
        const override = rowOverrides[i] ?? {}
        return {
          ...row,
          supplier_id: override.supplier_id ?? (match?.es_nuevo ? null : match?.supplier_id ?? null),
          cost_center_id: override.cost_center_id ?? null,
          comercio: override.nombre_proveedor ?? row.comercio,
        }
      })

      const res = await fetch('/api/banco', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: enrichedRows, institution: pdfInstitution, document_type: documentType }),
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

  // Crear proveedor desde el mini-form inline y asignarlo a la fila
  const handleCreateProvider = async () => {
    if (!newProvForm) return
    setSavingProv(true)
    try {
      const originalKey = parsedRows[newProvForm.idx].comercio || parsedRows[newProvForm.idx].descripcion
      const res = await fetch('/api/banco/proveedores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          nombre: newProvForm.nombre,
          tipo: newProvForm.tipo,
          aliases: [originalKey],
        }),
      })
      const data = await res.json()
      if (data.supplier) {
        // Actualizar matchMap para reutilizar en otras filas con la misma descripción
        const key = parsedRows[newProvForm.idx].comercio || parsedRows[newProvForm.idx].descripcion
        setMatchMap(prev => ({ ...prev, [key]: { supplier_id: data.supplier.id, nombre_sugerido: data.supplier.name, es_nuevo: false, confianza: 1 } }))
        setRowOverrides(prev => ({ ...prev, [newProvForm.idx]: { ...prev[newProvForm.idx], supplier_id: data.supplier.id, nombre_proveedor: data.supplier.name } }))
      }
      setNewProvForm(null)
    } catch {}
    setSavingProv(false)
  }

  const updateTxFields = async (txId: string, fields: { cost_center_id?: string; supplier_id?: string }) => {
    await fetch('/api/banco', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_id: txId, ...fields }),
    })
    setTxList((prev: any[]) => prev.map(t => {
      if (t.id !== txId) return t
      return {
        ...t,
        ...(fields.cost_center_id !== undefined && {
          cost_center_id: fields.cost_center_id,
          cost_centers: costCenters.find((c: any) => c.id === fields.cost_center_id),
        }),
        ...(fields.supplier_id !== undefined && {
          supplier_id: fields.supplier_id,
          suppliers: suppliers.find((s: any) => s.id === fields.supplier_id),
        }),
      }
    }))
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
              <div className="text-sm text-gray-600">{processingMsg}</div>
            </div>
          )}
          {importStep === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-gray-900">{parsedRows.length} movimientos detectados</div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      documentType === 'tarjeta_credito'
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-blue-100 text-blue-700'
                    )}>
                      {documentType === 'tarjeta_credito' ? 'Tarjeta de crédito' : 'Cartola'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">Revisa antes de importar — la IA clasificará centros de costo y proveedores</div>
                </div>
                <button onClick={() => setImportStep('idle')} className="btn btn-sm">Cancelar</button>
              </div>
              {/* Indicador de carga del matching */}
              {matchingProviders && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="animate-spin">⚙️</span>
                  Cruzando proveedores con IA...
                </div>
              )}

              <div className="overflow-x-auto max-h-[420px] overflow-y-auto mb-4 border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                    <tr>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Fecha</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Descripción</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Proveedor</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Centro de costo</th>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, i) => {
                      const key = r.comercio || r.descripcion
                      const match = matchMap[key]
                      const override = rowOverrides[i] ?? {}
                      const supplierId = override.supplier_id ?? (match?.es_nuevo ? null : match?.supplier_id ?? null)
                      const supplierName = override.nombre_proveedor ?? (match?.nombre_sugerido ?? null)
                      const isNew = !supplierId && !!supplierName
                      const isMatched = !!supplierId

                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-2 px-2 text-gray-400 whitespace-nowrap">{r.fecha}</td>
                          <td className="py-2 px-2 max-w-[180px]">
                            <div className="font-medium text-gray-800 truncate">{r.comercio || r.descripcion}</div>
                            {r.comercio && <div className="text-gray-400 truncate">{r.descripcion}</div>}
                          </td>

                          {/* Celda proveedor */}
                          <td className="py-2 px-2 min-w-[160px]">
                            {newProvForm?.idx === i ? (
                              /* Mini-form crear proveedor */
                              <div className="flex flex-col gap-1 bg-amber-50 rounded p-1.5 border border-amber-200">
                                <input
                                  className="input text-xs py-0.5"
                                  value={newProvForm.nombre}
                                  onChange={e => setNewProvForm(f => f ? { ...f, nombre: e.target.value } : f)}
                                  placeholder="Nombre del proveedor"
                                  autoFocus
                                />
                                <select
                                  className="select text-xs py-0.5"
                                  value={newProvForm.tipo}
                                  onChange={e => setNewProvForm(f => f ? { ...f, tipo: e.target.value } : f)}
                                >
                                  <option value="comercio">Comercio general</option>
                                  <option value="restaurant">Restaurant / Comida</option>
                                  <option value="supermercado">Supermercado</option>
                                  <option value="farmacia">Farmacia</option>
                                  <option value="combustible">Combustible</option>
                                  <option value="transporte">Transporte</option>
                                  <option value="servicio">Servicio / Suscripción</option>
                                  <option value="entretenimiento">Entretenimiento</option>
                                  <option value="banco">Banco / Finanzas</option>
                                </select>
                                <div className="flex gap-1">
                                  <button onClick={handleCreateProvider} disabled={savingProv || !newProvForm.nombre.trim()}
                                    className="btn btn-xs flex-1 bg-amber-500 text-white text-xs py-0.5">
                                    {savingProv ? '...' : 'Crear'}
                                  </button>
                                  <button onClick={() => setNewProvForm(null)} className="btn btn-xs text-xs py-0.5">✕</button>
                                </div>
                              </div>
                            ) : matchingProviders ? (
                              <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                            ) : (
                              <div className="flex items-center gap-1">
                                {/* Badge de proveedor */}
                                <select
                                  className="select text-xs py-0.5 flex-1 min-w-0"
                                  value={supplierId ?? ''}
                                  onChange={e => {
                                    const val = e.target.value
                                    if (val === '__new__') {
                                      setNewProvForm({ idx: i, nombre: supplierName ?? key, tipo: match?.tipo_sugerido ?? 'comercio' })
                                    } else {
                                      const sel = suppliers.find((s: any) => s.id === val)
                                      setRowOverrides(prev => ({ ...prev, [i]: { ...prev[i], supplier_id: val || null, nombre_proveedor: sel?.name ?? null } }))
                                    }
                                  }}
                                >
                                  <option value="">Sin proveedor</option>
                                  {suppliers.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                  <option value="__new__">+ Crear &quot;{supplierName ?? key}&quot;</option>
                                </select>
                                {/* Indicador visual */}
                                {isMatched && <span className="text-green-500 flex-shrink-0">✓</span>}
                                {isNew && <span className="text-amber-500 flex-shrink-0">★</span>}
                              </div>
                            )}
                          </td>

                          {/* Centro de costo */}
                          <td className="py-2 px-2 min-w-[140px]">
                            <select
                              className="select text-xs py-0.5 w-full"
                              value={override.cost_center_id ?? ''}
                              onChange={e => setRowOverrides(prev => ({ ...prev, [i]: { ...prev[i], cost_center_id: e.target.value || null } }))}
                            >
                              <option value="">Clasificar con IA</option>
                              {costCenters.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            {r.cargo > 0
                              ? <span className="text-red-600 font-medium">-${fmt(r.cargo)}</span>
                              : <span className="text-green-600 font-medium">+${fmt(r.abono)}</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Leyenda */}
              {!matchingProviders && Object.keys(matchMap).length > 0 && (
                <div className="flex gap-4 text-xs text-gray-400 mb-3">
                  <span><span className="text-green-500">✓</span> Proveedor encontrado</span>
                  <span><span className="text-amber-500">★</span> Proveedor nuevo sugerido</span>
                  <span>Los centros de costo vacíos se clasificarán automáticamente con IA</span>
                </div>
              )}

              <button onClick={handleImport} disabled={importing || matchingProviders} className="btn-primary w-full">
                {importing ? '⚙️ Importando...' : `✓ Importar ${parsedRows.length} movimientos`}
              </button>
            </div>
          )}
        </div>
      )}

      {importStep === 'done' && (
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl">✓</div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{importResult?.inserted} movimientos importados</div>
              <div className="text-xs text-gray-400">
                {documentType === 'tarjeta_credito' ? 'Tarjeta de crédito' : 'Cartola'} · {pdfInstitution}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-700">{importResult?.inserted}</div>
              <div className="text-xs text-green-600">Importados</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-700">
                {Object.values(matchMap).filter((m: any) => m && !m.es_nuevo).length}
              </div>
              <div className="text-xs text-blue-600">Prov. asociados</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-amber-700">
                {Object.values(rowOverrides).filter((o: any) => o?.cost_center_id).length}
              </div>
              <div className="text-xs text-amber-600">Con centro asignado</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-3">Los centros sin asignar fueron clasificados automáticamente por IA.</p>
          <button onClick={() => { setImportStep('idle'); setTab('movimientos') }} className="btn-primary w-full">
            Ver movimientos
          </button>
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
            <div className="text-4xl mb-3">📄</div>
            <div className="text-sm font-semibold text-gray-700 mb-2">Arrastra o sube tu documento bancario</div>
            <div className="text-xs text-gray-400 mb-4">PDF · Excel (.xlsx) · CSV — cartola o estado de cuenta tarjeta</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-blue-50 rounded-lg p-2.5 text-left text-xs text-blue-700">
                <div className="font-semibold mb-1">Cartola (PDF o Excel)</div>
                <div>Mi Banco en línea → Cuentas → Movimientos → Exportar</div>
              </div>
              <div className="bg-violet-50 rounded-lg p-2.5 text-left text-xs text-violet-700">
                <div className="font-semibold mb-1">Tarjeta de Crédito (PDF)</div>
                <div>Mi Banco en línea → Tarjetas → Estado de cuenta → Descargar PDF</div>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
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
            <input className="input max-w-xs text-sm" placeholder="Buscar movimiento o proveedor..."
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
                  {/* Icono con tipo de documento */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      tx.amount < 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600')}>
                      {tx.amount < 0 ? '↑' : '↓'}
                    </div>
                    {tx.document_type === 'tarjeta_credito' && (
                      <span className="text-[9px] text-violet-500 font-medium leading-none">TC</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {tx.merchant_name ?? tx.description}
                        </div>
                        {tx.merchant_name && (
                          <div className="text-xs text-gray-400 truncate">{tx.description}</div>
                        )}
                        <div className="text-xs text-gray-400">{tx.transaction_date}</div>
                      </div>
                      <div className={cn('text-sm font-semibold flex-shrink-0',
                        tx.amount < 0 ? 'text-red-600' : 'text-green-600')}>
                        {tx.amount < 0 ? '-' : '+'}${fmt(tx.amount)}
                      </div>
                    </div>

                    {/* Badges + edición inline */}
                    <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                      {editingTx === tx.id ? (
                        <>
                          {/* Centro de costo */}
                          <select className="select text-xs py-0.5"
                            defaultValue={tx.cost_center_id ?? ''}
                            onChange={e => updateTxFields(tx.id, { cost_center_id: e.target.value || undefined })}>
                            <option value="">Sin centro</option>
                            {costCenters.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                            ))}
                          </select>
                          {/* Proveedor */}
                          <select className="select text-xs py-0.5"
                            defaultValue={tx.supplier_id ?? ''}
                            onChange={e => updateTxFields(tx.id, { supplier_id: e.target.value || undefined })}>
                            <option value="">Sin proveedor</option>
                            {suppliers.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button onClick={() => setEditingTx(null)}
                            className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                        </>
                      ) : (
                        <>
                          {/* Badge centro de costo */}
                          <button onClick={() => setEditingTx(tx.id)}
                            className={cn('text-xs rounded-full px-2 py-0.5 transition-colors',
                              tx.cost_centers
                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            )}>
                            {tx.cost_centers
                              ? `${tx.cost_centers.icon ?? ''} ${tx.cost_centers.name}`
                              : '+ Centro'}
                          </button>
                          {/* Badge proveedor */}
                          <button onClick={() => setEditingTx(tx.id)}
                            className={cn('text-xs rounded-full px-2 py-0.5 transition-colors',
                              tx.suppliers
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                            )}>
                            {tx.suppliers ? tx.suppliers.name : '+ Proveedor'}
                          </button>
                        </>
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
