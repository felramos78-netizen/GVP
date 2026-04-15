/**
 * app/api/fintoc/sync/route.ts
 * POST /api/fintoc/sync
 * Sincroniza movimientos bancarios desde Fintoc.
 * Clasifica automáticamente con Gemini y asigna centros de costo.
 */
import { createClient } from '@/lib/supabase/server'
import { getMovements, getBalance } from '@/lib/fintoc/client'
import { genAI } from '@/lib/gemini/client'
import { NextRequest, NextResponse } from 'next/server'

async function classifyTransactions(
  transactions: any[],
  costCenters: any[],
  supabase: any,
  userId: string
) {
  if (transactions.length === 0) return []

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  })

  const centersDesc = costCenters.map((c: any) => `${c.id}|${c.name}`).join(', ')
  const txList = transactions.map((t: any, i: number) =>
    `${i}. "${t.description}" $${Math.abs(t.amount)} ${t.transaction_date}`
  ).join('\n')

  const prompt = `Clasifica estas transacciones bancarias chilenas en los centros de costo disponibles.

Centros de costo disponibles (id|nombre):
${centersDesc}

Transacciones:
${txList}

Responde SOLO con JSON (sin markdown):
{
  "clasificaciones": [
    {"index": 0, "cost_center_id": "uuid-aqui-o-null", "categoria": "alimentación", "es_gasto": true}
  ]
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/```json|```/g, '').trim()
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)![0])
  return json.clasificaciones ?? []
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { connection_id, days_back = 30 } = await request.json()

    // Obtener conexión
    const { data: connection } = await supabase
      .from('bank_connections')
      .select(`*, bank_accounts(*)`)
      .eq('user_id', user.id)
      .eq(connection_id ? 'id' : 'status', connection_id ?? 'active')
      .single()

    if (!connection) return NextResponse.json({ error: 'Sin conexión bancaria activa' }, { status: 404 })

    // Obtener centros de costo para clasificación
    const { data: costCenters } = await supabase
      .from('cost_centers')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const since = new Date()
    since.setDate(since.getDate() - days_back)
    const sinceStr = since.toISOString().split('T')[0]

    let totalNew = 0
    let totalAccounts = 0

    for (const account of connection.bank_accounts ?? []) {
      totalAccounts++

      // Actualizar saldo
      try {
        const balanceData = await getBalance(connection.fintoc_link_id, account.fintoc_account_id)
        await supabase.from('bank_accounts').update({
          balance_available: balanceData.balance?.available ?? account.balance_available,
          balance_current: balanceData.balance?.current ?? account.balance_current,
          refreshed_at: new Date().toISOString(),
        }).eq('id', account.id)
      } catch {}

      // Obtener movimientos
      const movements = await getMovements(
        connection.fintoc_link_id,
        account.fintoc_account_id,
        { since: sinceStr, perPage: 100 }
      )

      if (!movements?.length) continue

      // Filtrar los que ya tenemos
      const existingIds = new Set(
        (await supabase.from('bank_transactions')
          .select('fintoc_transaction_id')
          .eq('account_id', account.id)
          .in('fintoc_transaction_id', movements.map((m: any) => m.id))
        ).data?.map((r: any) => r.fintoc_transaction_id) ?? []
      )

      const newMovements = movements.filter((m: any) => !existingIds.has(m.id))
      if (!newMovements.length) continue

      // Clasificar con IA
      let clasificaciones: any[] = []
      try {
        clasificaciones = await classifyTransactions(newMovements, costCenters ?? [], supabase, user.id)
      } catch {}

      const clasMap = new Map(clasificaciones.map((c: any) => [c.index, c]))

      // Insertar transacciones nuevas
      const toInsert = newMovements.map((mov: any, i: number) => {
        const clas = clasMap.get(i)
        return {
          account_id: account.id,
          user_id: user.id,
          fintoc_transaction_id: mov.id,
          amount: mov.amount,
          currency: mov.currency ?? 'CLP',
          description: mov.description,
          transaction_date: mov.post_date ?? mov.date,
          post_date: mov.post_date ?? null,
          merchant_name: mov.merchant_name ?? null,
          category_fintoc: mov.type ?? null,
          category_gdv: clas?.categoria ?? null,
          cost_center_id: clas?.cost_center_id ?? null,
          is_expense: (clas?.es_gasto ?? mov.amount < 0) ? true : false,
          ai_classified: clasificaciones.length > 0,
        }
      })

      const { error: insertErr } = await supabase
        .from('bank_transactions')
        .insert(toInsert)

      if (!insertErr) totalNew += toInsert.length
    }

    // Actualizar last_sync_at
    await supabase.from('bank_connections').update({
      last_sync_at: new Date().toISOString()
    }).eq('id', connection.id)

    return NextResponse.json({
      ok: true,
      new_transactions: totalNew,
      accounts_synced: totalAccounts,
      synced_at: new Date().toISOString(),
    })

  } catch (err) {
    console.error('Fintoc sync error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
