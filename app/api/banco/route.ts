/**
 * app/api/banco/route.ts
 * POST /api/banco — procesa archivo Excel/CSV exportado del banco
 * y clasifica movimientos con Gemini.
 */
import { createClient } from '@/lib/supabase/server'
import { genAI } from '@/lib/gemini/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { rows, institution } = await request.json()
    // rows = array de { fecha, descripcion, cargo, abono, saldo }

    if (!rows?.length) return NextResponse.json({ error: 'Sin movimientos' }, { status: 400 })

    // Obtener centros de costo para clasificación
    const { data: costCenters } = await supabase
      .from('cost_centers').select('id, name').eq('user_id', user.id).eq('is_active', true)

    // Clasificar con Gemini
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
    })

    const centersDesc = (costCenters ?? []).map((c: any) => `${c.id}|${c.name}`).join(', ')
    const txSample = rows.slice(0, 50).map((r: any, i: number) =>
      `${i}. ${r.fecha} | "${r.descripcion}" | cargo:${r.cargo ?? 0} | abono:${r.abono ?? 0}`
    ).join('\n')

    const prompt = `Clasifica estos movimientos bancarios chilenos.

Centros de costo disponibles (id|nombre):
${centersDesc || 'Sin centros configurados'}

Movimientos:
${txSample}

Responde SOLO con JSON (sin markdown):
{
  "clasificaciones": [
    {
      "index": 0,
      "cost_center_id": "uuid-o-null",
      "categoria": "alimentación",
      "comercio": "nombre del comercio limpio",
      "es_gasto": true
    }
  ]
}`

    let clasificaciones: any[] = []
    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text().replace(/```json|```/g, '').trim()
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)![0])
      clasificaciones = json.clasificaciones ?? []
    } catch {}

    const clasMap = new Map(clasificaciones.map((c: any) => [c.index, c]))

    // Obtener o crear conexión "manual"
    let { data: connection } = await supabase
      .from('bank_connections').select('id, bank_accounts(id)')
      .eq('user_id', user.id).eq('institution', institution ?? 'Banco de Chile')
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

      // Crear cuenta manual
      if (connection) {
        await supabase.from('bank_accounts').insert({
          connection_id: connection.id,
          user_id: user.id,
          fintoc_account_id: `manual_${user.id}`,
          name: 'Cuenta corriente',
          type: 'checking_account',
          currency: 'CLP',
          balance_available: rows[0]?.saldo ?? 0,
          balance_current: rows[0]?.saldo ?? 0,
          refreshed_at: new Date().toISOString(),
        })
      }
    }

    const { data: account } = await supabase
      .from('bank_accounts').select('id').eq('connection_id', connection!.id).single()

    if (!account) return NextResponse.json({ error: 'Sin cuenta bancaria' }, { status: 500 })

    // Insertar movimientos nuevos
    let inserted = 0
    for (let i = 0; i < rows.slice(0, 50).length; i++) {
      const row = rows[i]
      const clas = clasMap.get(i)
      const amount = row.cargo ? -Math.abs(row.cargo) : Math.abs(row.abono ?? 0)
      const txId = `manual_${user.id}_${row.fecha}_${i}`

      const { error } = await supabase.from('bank_transactions').upsert({
        account_id: account.id,
        user_id: user.id,
        fintoc_transaction_id: txId,
        amount,
        currency: 'CLP',
        description: row.descripcion,
        transaction_date: row.fecha,
        merchant_name: clas?.comercio ?? null,
        category_gdv: clas?.categoria ?? null,
        cost_center_id: clas?.cost_center_id ?? null,
        is_expense: amount < 0,
        ai_classified: clasificaciones.length > 0,
      }, { onConflict: 'fintoc_transaction_id' })

      if (!error) inserted++
    }

    // Actualizar saldo
    if (rows[0]?.saldo) {
      await supabase.from('bank_accounts').update({
        balance_available: rows[0].saldo,
        balance_current: rows[0].saldo,
        refreshed_at: new Date().toISOString(),
      }).eq('id', account.id)
    }

    await supabase.from('bank_connections').update({
      last_sync_at: new Date().toISOString()
    }).eq('id', connection!.id)

    return NextResponse.json({ ok: true, inserted, total: rows.length })

  } catch (err) {
    console.error('Banco import error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// PATCH — actualizar clasificación de una transacción
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { tx_id, cost_center_id } = await request.json()
    await supabase.from('bank_transactions').update({ cost_center_id }).eq('id', tx_id).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
