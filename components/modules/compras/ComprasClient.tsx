'use client'
/**
 * components/modules/compras/ComprasClient.tsx
 * Módulo de Compras — importar boleta con IA, historial, finanzas.
 */
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/formatters'

type Tab = 'importar' | 'historial'
type ImportStep = 'upload' | 'processing' | 'preview' | 'confirming' | 'done'

const TIPO_OPTIONS = ['comestible','bebestible','aseo','mascotas','suplemento']
const UBI_OPTIONS = ['Refrigerador','Congelador','Despensa','Mesón','Baño','Cajón']
const CAT_OPTIONS = ['proteína','lácteo','carbohidrato','verdura','fruta','legumbre','aceite','condimento','bebida','limpieza','higiene','mascotas','otro']

export function ComprasClient({ costCenters, recentPurchases, suppliers }: any) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('importar')
  const [step, setStep] = useState<ImportStep>('upload')
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<string|null>(null)
  const [boleta, setBoleta] = useState<any>(null)
  const [productos, setProductos] = useState<any[]>([])
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  // Config de confirmación
  const [registrarStock, setRegistrarStock] = useState(true)
  const [registrarGasto, setRegistrarGasto] = useState(true)
  const [guardarRecetas, setGuardarRecetas] = useState(true)
  const [gastoTipo, setGastoTipo] = useState<'puntual'|'presupuesto'>('puntual')
  const [costCenterId, setCostCenterId] = useState('')
  const [gastoNotas, setGastoNotas] = useState('')
  const [resultado, setResultado] = useState<any>(null)

  const formatCLP = (n: number) => Math.round(n).toLocaleString('es-CL')

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Solo se aceptan imágenes'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      const previewUrl = e.target?.result as string
      setPreview(previewUrl)
      setStep('processing')
      try {
        const res = await fetch('/api/ai/boleta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setBoleta(data)
        setProductos(data.productos ?? [])
        setGastoNotas(`Compra en ${data.comercio ?? 'comercio'} — ${data.fecha ?? 'hoy'}`)
        setStep('preview')
      } catch (err) {
        setError('Error leyendo la boleta: ' + (err as Error).message)
        setStep('upload')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const updateProducto = (i: number, field: string, value: any) => {
    setProductos(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], [field]: value }
      return updated
    })
  }

  const removeProducto = (i: number) => {
    setProductos(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleConfirmar = async () => {
    setStep('confirming')
    setError('')
    try {
      const supplierId = suppliers.find((s: any) =>
        s.name.toLowerCase().includes((boleta?.comercio ?? '').toLowerCase())
      )?.id ?? null

      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productos,
          comercio: boleta?.comercio,
          fecha: boleta?.fecha,
          total_boleta: boleta?.total_boleta,
          registrar_stock: registrarStock,
          guardar_recetas: guardarRecetas,
          supplier_id: supplierId,
          gasto_config: {
            registrar: registrarGasto,
            tipo: gastoTipo,
            cost_center_id: costCenterId || null,
            notas: gastoNotas,
          },
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResultado(data)
      setStep('done')
      router.refresh()
    } catch (err) {
      setError('Error al confirmar: ' + (err as Error).message)
      setStep('preview')
    }
  }

  const resetImport = () => {
    setStep('upload')
    setPreview(null)
    setBoleta(null)
    setProductos([])
    setResultado(null)
    setError('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['importar','📄 Importar boleta'],['historial','📋 Historial']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === k ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {l}
          </button>
        ))}
      </div>

      {/* ── IMPORTAR ── */}
      {tab === 'importar' && (
        <div>
          {/* UPLOAD */}
          {step === 'upload' && (
            <div className="max-w-xl">
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                )}
              >
                <div className="text-4xl mb-3">📸</div>
                <div className="text-sm font-semibold text-gray-700 mb-1">
                  Arrastra o haz clic para subir una boleta
                </div>
                <div className="text-xs text-gray-400">
                  Foto, captura de pantalla o escáner · JPG, PNG, WEBP
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
              {error && <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                💡 La IA leerá la boleta automáticamente, extraerá cada producto con su precio y los cruzará con tu inventario existente.
              </div>
            </div>
          )}

          {/* PROCESSING */}
          {step === 'processing' && (
            <div className="max-w-xl">
              <div className="card text-center py-10">
                <div className="text-4xl mb-4 animate-bounce">🤖</div>
                <div className="text-base font-semibold text-gray-800 mb-2">Leyendo tu boleta...</div>
                <div className="text-sm text-gray-500">Gemini está extrayendo los productos y precios</div>
                {preview && (
                  <img src={preview} alt="Boleta" className="mt-4 max-h-32 mx-auto rounded-lg object-contain opacity-50" />
                )}
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {step === 'preview' && boleta && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {boleta.comercio ?? 'Comercio'} · {boleta.fecha ?? 'hoy'}
                  </div>
                  <div className="text-xs text-gray-500">{productos.length} productos · Total: ${formatCLP(boleta.total_boleta ?? 0)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={resetImport} className="btn btn-sm">← Reimportar</button>
                  {preview && (
                    <img src={preview} alt="Boleta" className="h-10 rounded border border-gray-200 object-contain cursor-pointer"
                      onClick={() => window.open(preview, '_blank')} />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Productos */}
                <div className="lg:col-span-2 card">
                  <div className="text-sm font-semibold text-gray-800 mb-3">
                    🛒 Productos detectados — edita lo que necesites
                  </div>
                  <div className="flex flex-col gap-2">
                    {productos.map((p: any, i: number) => (
                      <div key={i} className={cn(
                        'border rounded-lg p-3 text-xs',
                        p.existe_en_sistema ? 'border-green-200 bg-green-50' : 'border-gray-100'
                      )}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <input className="input text-xs py-1 font-medium" value={p.nombre_limpio}
                              onChange={e => updateProducto(i, 'nombre_limpio', e.target.value)} />
                            {p.existe_en_sistema && (
                              <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">Ya existe</span>
                            )}
                          </div>
                          <button onClick={() => removeProducto(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0">×</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-gray-400 mb-1">Marca</div>
                            <input className="input text-xs py-1" value={p.marca ?? ''} placeholder="Marca"
                              onChange={e => updateProducto(i, 'marca', e.target.value)} />
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">Categoría</div>
                            <select className="select text-xs py-1" value={p.categoria ?? 'otro'}
                              onChange={e => updateProducto(i, 'categoria', e.target.value)}>
                              {CAT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">Tipo</div>
                            <select className="select text-xs py-1" value={p.tipo ?? 'comestible'}
                              onChange={e => updateProducto(i, 'tipo', e.target.value)}>
                              {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">Ubicación</div>
                            <select className="select text-xs py-1" value={p.ubicacion_sugerida ?? 'Despensa'}
                              onChange={e => updateProducto(i, 'ubicacion_sugerida', e.target.value)}>
                              {UBI_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">Cantidad</div>
                            <input className="input text-xs py-1" type="number" value={p.cantidad ?? 1}
                              onChange={e => updateProducto(i, 'cantidad', parseFloat(e.target.value))} />
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">Precio unitario</div>
                            <input className="input text-xs py-1" type="number" value={p.precio_unitario ?? 0}
                              onChange={e => updateProducto(i, 'precio_unitario', parseInt(e.target.value))} />
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="text-gray-400 mb-1">Aplica para</div>
                          <div className="flex gap-3">
                            {[['es_desayuno','D'],['es_almuerzo','A'],['es_cena','C'],['es_snack','S']].map(([k,l]) => (
                              <label key={k} className="flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={p[k] ?? false}
                                  onChange={e => updateProducto(i, k, e.target.checked)}
                                  className="accent-teal-500" />
                                <span className="text-gray-600">{l}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Config */}
                <div className="flex flex-col gap-3">
                  {/* Stock */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-800">📦 Agregar al stock</div>
                      <button onClick={() => setRegistrarStock(!registrarStock)}
                        className={cn('w-10 h-5 rounded-full transition-colors relative',
                          registrarStock ? 'bg-teal-400' : 'bg-gray-200')}>
                        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                          registrarStock ? 'left-5' : 'left-0.5')} />
                      </button>
                    </div>
                    {registrarStock && (
                      <p className="text-xs text-gray-500">Se sumará la cantidad de cada producto al inventario actual.</p>
                    )}
                  </div>

                  {/* Gasto */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-800">💰 Registrar gasto</div>
                      <button onClick={() => setRegistrarGasto(!registrarGasto)}
                        className={cn('w-10 h-5 rounded-full transition-colors relative',
                          registrarGasto ? 'bg-teal-400' : 'bg-gray-200')}>
                        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                          registrarGasto ? 'left-5' : 'left-0.5')} />
                      </button>
                    </div>
                    {registrarGasto && (
                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium text-gray-700">Total: ${formatCLP(boleta.total_boleta ?? 0)}</div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Tipo de gasto</div>
                          <div className="flex gap-2">
                            {(['puntual','presupuesto'] as const).map(t => (
                              <button key={t} onClick={() => setGastoTipo(t)}
                                className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all',
                                  gastoTipo === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                )}>
                                {t === 'puntual' ? 'Gasto puntual' : 'Al presupuesto'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Centro de costo (opcional)</div>
                          <select className="select text-xs" value={costCenterId}
                            onChange={e => setCostCenterId(e.target.value)}>
                            <option value="">Sin asignar</option>
                            {costCenters.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Notas</div>
                          <input className="input text-xs" value={gastoNotas}
                            onChange={e => setGastoNotas(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recetas */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-800">🍳 Generar recetas</div>
                      <button onClick={() => setGuardarRecetas(!guardarRecetas)}
                        className={cn('w-10 h-5 rounded-full transition-colors relative',
                          guardarRecetas ? 'bg-teal-400' : 'bg-gray-200')}>
                        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                          guardarRecetas ? 'left-5' : 'left-0.5')} />
                      </button>
                    </div>
                    {guardarRecetas && (
                      <p className="text-xs text-gray-500">8 recetas generadas con estos productos se agregarán a tu recetario.</p>
                    )}
                  </div>

                  {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

                  <button onClick={handleConfirmar} className="btn-primary w-full py-3 text-sm">
                    ✓ Confirmar compra
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRMING */}
          {step === 'confirming' && (
            <div className="card max-w-sm mx-auto text-center py-10">
              <div className="text-4xl mb-4 animate-spin">⚙️</div>
              <div className="text-sm font-semibold text-gray-800 mb-1">Procesando compra...</div>
              <div className="text-xs text-gray-500">Creando productos, actualizando stock y generando recetas</div>
            </div>
          )}

          {/* DONE */}
          {step === 'done' && resultado && (
            <div className="card max-w-lg mx-auto">
              <div className="text-center mb-5">
                <div className="text-4xl mb-3">🎉</div>
                <div className="text-base font-semibold text-gray-900">¡Compra registrada!</div>
              </div>
              <div className="flex flex-col gap-3">
                {resultado.productos_creados?.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-blue-800 mb-1">✓ {resultado.productos_creados.length} productos nuevos creados</div>
                    <div className="text-xs text-blue-600">{resultado.productos_creados.join(', ')}</div>
                  </div>
                )}
                {resultado.stock_actualizado?.length > 0 && (
                  <div className="bg-teal-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-teal-800 mb-1">✓ Stock actualizado ({resultado.stock_actualizado.length} items)</div>
                  </div>
                )}
                {resultado.orden_id && (
                  <div className="bg-amber-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-amber-800">✓ Gasto registrado en finanzas</div>
                  </div>
                )}
                {resultado.recetas?.length > 0 && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-purple-800 mb-1">✓ {resultado.recetas.length} recetas nuevas en tu recetario</div>
                    <div className="text-xs text-purple-600">{resultado.recetas.slice(0,4).join(', ')}{resultado.recetas.length > 4 ? '...' : ''}</div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={resetImport} className="btn flex-1">Importar otra boleta</button>
                <button onClick={() => setTab('historial')} className="btn-primary flex-1">Ver historial</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {tab === 'historial' && (
        <div>
          {recentPurchases.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-sm text-gray-400 mb-3">Sin compras registradas aún.</p>
              <button onClick={() => setTab('importar')} className="btn">Importar primera boleta</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentPurchases.map((order: any) => (
                <div key={order.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-sm text-gray-900">
                        {order.suppliers?.name ?? 'Comercio no especificado'}
                      </div>
                      <div className="text-xs text-gray-400">{order.purchased_at}</div>
                      {order.cost_centers && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {order.cost_centers.icon} {order.cost_centers.name}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">${(order.total_clp ?? 0).toLocaleString('es-CL')}</div>
                      <div className="text-xs text-gray-400">{order.purchase_items?.length ?? 0} productos</div>
                    </div>
                  </div>
                  {order.notes && <div className="text-xs text-gray-400 mb-2 italic">{order.notes}</div>}
                  <div className="flex flex-wrap gap-1">
                    {(order.purchase_items ?? []).slice(0, 5).map((item: any, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {item.products?.name} ×{item.qty}
                      </span>
                    ))}
                    {(order.purchase_items?.length ?? 0) > 5 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">
                        +{order.purchase_items.length - 5} más
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
