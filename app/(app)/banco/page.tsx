/**
 * app/(app)/banco/page.tsx
 * Módulo bancario con soporte para PDF (cartola + tarjeta de crédito)
 * y cruce automático de proveedores.
 */
import { createClient } from '@/lib/supabase/server'
import { BancoClient } from '@/components/modules/banco/BancoClient'

export default async function BancoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [connections, recentTx, costCenters, suppliers] = await Promise.all([
    supabase
      .from('bank_connections')
      .select(`*, bank_accounts(*)`)
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('bank_transactions')
      .select(`*, bank_accounts(name, type), cost_centers(name, icon, color), suppliers(id, name, type, category)`)
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(100),
    supabase
      .from('cost_centers')
      .select('id, name, icon, color')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('suppliers')
      .select('id, name, type, category, logo_url')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Banco</h1>
        <p className="text-sm text-gray-500 mt-1">
          Importa cartolas o estados de cuenta · clasifica gastos · asocia proveedores
        </p>
      </div>
      <BancoClient
        connections={connections.data ?? []}
        transactions={recentTx.data ?? []}
        costCenters={costCenters.data ?? []}
        suppliers={suppliers.data ?? []}
        fintocPublicKey={process.env.NEXT_PUBLIC_FINTOC_PUBLIC_KEY ?? ''}
      />
    </div>
  )
}
