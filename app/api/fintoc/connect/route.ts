/**
 * app/api/fintoc/connect/route.ts
 * POST /api/fintoc/connect
 * Guarda el link_token de Fintoc después de que el usuario
 * completa el widget de conexión bancaria.
 * 
 * GET /api/fintoc/connect
 * Retorna las conexiones activas del usuario.
 */
import { createClient } from '@/lib/supabase/server'
import { getAccounts, getLink } from '@/lib/fintoc/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { link_token } = await request.json()
    if (!link_token) return NextResponse.json({ error: 'link_token requerido' }, { status: 400 })

    // Obtener info del link desde Fintoc
    const linkData = await getLink(link_token)

    // Guardar conexión
    const { data: connection, error: connErr } = await supabase
      .from('bank_connections')
      .upsert({
        user_id: user.id,
        fintoc_link_id: link_token,
        institution: linkData.institution?.name ?? 'Banco',
        holder_name: linkData.holder_name ?? null,
        holder_type: linkData.holder_type ?? 'individual',
        status: 'active',
        last_sync_at: new Date().toISOString(),
      }, { onConflict: 'user_id,fintoc_link_id' })
      .select().single()

    if (connErr) throw connErr

    // Obtener y guardar cuentas
    const accounts = await getAccounts(link_token)
    for (const acc of accounts ?? []) {
      await supabase.from('bank_accounts').upsert({
        connection_id: connection.id,
        user_id: user.id,
        fintoc_account_id: acc.id,
        name: acc.name,
        official_name: acc.official_name ?? acc.name,
        type: acc.type,
        currency: acc.currency ?? 'CLP',
        balance_available: acc.balance?.available ?? 0,
        balance_current: acc.balance?.current ?? 0,
        refreshed_at: new Date().toISOString(),
      }, { onConflict: 'fintoc_account_id' })
    }

    return NextResponse.json({ ok: true, connection_id: connection.id, accounts_count: accounts?.length ?? 0 })

  } catch (err) {
    console.error('Fintoc connect error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: connections } = await supabase
      .from('bank_connections')
      .select(`*, bank_accounts(*)`)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    return NextResponse.json(connections ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
