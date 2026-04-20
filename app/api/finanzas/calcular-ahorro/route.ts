/**
 * POST /api/finanzas/calcular-ahorro
 * Calcula el presupuesto no consumido de todos los centros activos (excepto el de Ahorros)
 * y lo registra en el monthly_budget del centro Ahorros como ahorro acumulado del mes.
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { yearMonth, savingsCenterId } = await request.json()
    if (!yearMonth || !savingsCenterId) {
      return NextResponse.json({ error: 'yearMonth y savingsCenterId son requeridos' }, { status: 400 })
    }

    // Centros activos, excluyendo el de ahorros
    const { data: centers, error: centersErr } = await supabase
      .from('cost_centers')
      .select('id, name, monthly_amount')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .neq('id', savingsCenterId)

    if (centersErr) throw new Error(centersErr.message)

    // Registros de gasto del mes
    const { data: budgetRows, error: budgetErr } = await supabase
      .from('monthly_budget')
      .select('cost_center_id, spent')
      .eq('user_id', user.id)
      .eq('year_month', yearMonth)

    if (budgetErr) throw new Error(budgetErr.message)

    const spentMap = new Map((budgetRows ?? []).map((b: any) => [b.cost_center_id, b.spent]))

    // Calcular no-consumido por centro (solo positivos = ahorro real)
    const detalle: { name: string; ahorro: number }[] = []
    let total = 0

    for (const c of centers ?? []) {
      const spent = spentMap.get(c.id) ?? 0
      const unspent = c.monthly_amount - spent
      if (unspent > 0) {
        detalle.push({ name: c.name, ahorro: unspent })
        total += unspent
      }
    }

    // Registrar en monthly_budget del centro Ahorros (SET, no suma, para idempotencia)
    const { error: upsertErr } = await supabase
      .from('monthly_budget')
      .upsert({
        user_id: user.id,
        cost_center_id: savingsCenterId,
        year_month: yearMonth,
        spent: total,
        budgeted: 0,
        notes: `Ahorro calculado: presupuesto no consumido de ${detalle.length} centros`,
      }, { onConflict: 'user_id,cost_center_id,year_month' })

    if (upsertErr) throw new Error(upsertErr.message)

    return NextResponse.json({ total, detalle })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
