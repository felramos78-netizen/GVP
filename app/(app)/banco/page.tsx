/**
 * app/(app)/banco/page.tsx
 * Módulo de vinculación bancaria con Fintoc.
 */
import { createClient } from '@/lib/supabase/server'
import { BancoClient } from '@/components/modules/banco/BancoClient'

export default async function BancoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [connections, recentTx, costCenters] = await Promise.all([
    supabase.from('bank_connections').select(`*, bank_accounts(*)`).eq('user_id', user.id).eq('status', 'active'),
    supabase.from('bank_transactions')
      .select(`*, bank_accounts(name, type), cost_centers(name, icon, color)`)
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(50),
    supabase.from('cost_centers').select('id, name, icon, color').eq('user_id', user.id).eq('is_active', true),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Banco</h1>
        <p className="text-sm text-gray-500 mt-1">
          Vincula tu cuenta bancaria · sincroniza movimientos · clasifica gastos
        </p>
      </div>
      <BancoClient
        connections={connections.data ?? []}
        transactions={recentTx.data ?? []}
        costCenters={costCenters.data ?? []}
        fintocPublicKey={process.env.NEXT_PUBLIC_FINTOC_PUBLIC_KEY ?? ''}
      />
    </div>
  )
}
