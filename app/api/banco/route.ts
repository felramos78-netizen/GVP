/**
 * app/api/banco/route.ts
 * POST /api/banco — importa movimientos bancarios (Excel/CSV o desde PDF ya parseado)
 *   Acepta rows con supplier_id y document_type pre-cruzados desde el cliente.
 *
 * PATCH /api/banco — reclasifica una transacción (centro de costo o proveedor)
 */
import { createClient } from '@/lib/supabase/server'
import { genAI } from '@/lib/gemini/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { rows, institution, document_type } = await request.json()
    // rows: { fecha, descripcion, cargo, abono, saldo,
    //         supplier_id?, cost_center_id?, comercio? }[]

    if (!rows?.length) return NextResponse.json({ error: 'Sin movimientos' }, { status: 400 })

    // Obtener centros de costo para clasificación automática (solo los no pre-asignados)
    const { data: costCenters } = await supabase
      .from('cost_centers')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Clasificar con Gemini solo los que no tienen cost_center_id
    const toClassify = rows.slice(0, 100).filter((r: any) => !r.cost_center_id)
    let clasificaciones: any[] = []

    if (toClassify.length > 0 && costCenters?.length) {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
      })

      const centersDesc = costCenters.map((c: any) => `${c.id}|${c.name}`).join(', ')
      const txSample = toClassify.map((r: any, i: number) =>
        `${i}. ${r.fecha} | "${r.descripcion}" | cargo:${r.cargo ?? 0} | abono:${r.abono ?? 0}`
      ).join('\n')

      const prompt = `Clasifica estos movimientos bancarios chilenos en los centros de costo disponibles.

Centros de costo (id|nombre):
${centersDesc}

Movimientos:
${txSample}

Responde SOLO con JSON (sin markdown):
{
  "clasificaciones": [
    {
      "index": 0,
      "cost_center_id": "uuid-o-null",
      "categoria": "alimentación",
      "comercio": "nombre limpio del comercio",
      "es_gasto": true
    }
  ]
}`

      try {
        const result = await model.generateContent(prompt)
        const text = result.response.text().replace(/```json|```/g, '').trim()
        const json = JSON.parse(text.match(/\{[\s\S]*\}/)![0])
        clasificaciones = json.clasificaciones ?? []
      } catch { /* continuar sin clasificación */ }
    }

    // Mapear clasificaciones al índice original en toClassify
    const clasMap = new Map(clasificaciones.map((c: any) => [c.index, c]))

    // Obtener o crear conexión "manual"
    let { data: connection } = await supabase
      .from('bank_connections')
      .select('id, bank_accounts(id)')
      .eq('user_id', user.id)
      .eq('institution', institution ?? 'Banco de Chile')
      .single()

    if (!connection) {
      const { data: newConn } = await supabase.from('bank_connections').insert({
        user_id: user.id,
        fintoc_link_id: `manual_${user.id}_${Date.now()}`,
        institution: institution ?? 'Banco de Chile',
        holder_type: 'individual',
        status: 'active',
        last_sync_at: new Date().toISOString(),
      }).select('id').single()
      connection = newConn

      if (connection) {
        await supabase.from('bank_accounts').insert({
          connection_id: connection.id,
          user_id: user.id,
          fintoc_account_id: `manual_${user.id}`,
          name: document_type === 'tarjeta_credito' ? 'Tarjeta de Crédito' : 'Cuenta corriente',
          type: document_type === 'tarjeta_credito' ? 'credit_card' : 'checking_account',
          currency: 'CLP',
          balance_available: rows[0]?.saldo ?? 0,
          balance_current: rows[0]?.saldo ?? 0,
          refreshed_at: new Date().toISOString(),
        })
      }
    }

    const { data: account } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('connection_id', connection!.id)
      .single()

    if (!account) return NextResponse.json({ error: 'Sin cuenta bancaria' }, { status: 500 })

    // Índice separado para clasificaciones de toClassify
    let classifyIdx = 0
    let inserted = 0

    for (let i = 0; i < rows.slice(0, 100).length; i++) {
      const row = rows[i]
      const amount = row.cargo ? -Math.abs(row.cargo) : Math.abs(row.abono ?? 0)
      const txId = `manual_${user.id}_${row.fecha}_${i}`

      // Si el row no tenía cost_center_id, buscar en clasificaciones
      let costCenterId = row.cost_center_id ?? null
      let merchantName = row.comercio ?? null
      let aiClassified = false

      if (!costCenterId) {
        const clas = clasMap.get(classifyIdx)
        costCenterId = clas?.cost_center_id ?? null
        merchantName = row.comercio ?? clas?.comercio ?? null
        aiClassified = clasificaciones.length > 0
        classifyIdx++
      }

      const { error } = await supabase.from('bank_transactions').upsert({
        account_id: account.id,
        user_id: user.id,
        fintoc_transaction_id: txId,
        amount,
        currency: 'CLP',
        description: row.descripcion,
        transaction_date: row.fecha,
        merchant_name: merchantName,
        category_gdv: null,
        cost_center_id: costCenterId,
        supplier_id: row.supplier_id ?? null,
        document_type: document_type ?? 'cartola',
        is_expense: amount < 0,
        ai_classified: aiClassified,
        manually_reviewed: !!row.cost_center_id,
      }, { onConflict: 'fintoc_transaction_id' })

      if (!error) inserted++
    }

    // Actualizar saldo si está disponible
    const lastWithSaldo = [...rows].reverse().find((r: any) => r.saldo != null)
    if (lastWithSaldo?.saldo != null) {
      await supabase.from('bank_accounts').update({
        balance_available: lastWithSaldo.saldo,
        balance_current: lastWithSaldo.saldo,
        refreshed_at: new Date().toISOString(),
      }).eq('id', account.id)
    }

    await supabase.from('bank_connections').update({
      last_sync_at: new Date().toISOString(),
    }).eq('id', connection!.id)

    return NextResponse.json({ ok: true, inserted, total: rows.length })

  } catch (err) {
    console.error('Banco import error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// PATCH — actualizar clasificación de una transacción (centro de costo y/o proveedor)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { tx_id, cost_center_id, supplier_id } = await request.json()

    const updates: Record<string, any> = { manually_reviewed: true }
    if (cost_center_id !== undefined) updates.cost_center_id = cost_center_id
    if (supplier_id !== undefined) updates.supplier_id = supplier_id

    await supabase
      .from('bank_transactions')
      .update(updates)
      .eq('id', tx_id)
      .eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
