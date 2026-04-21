import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/modules/layout/Sidebar'
import { Header } from '@/components/modules/layout/Header'
import { BottomNav } from '@/components/modules/layout/BottomNav'
import { AgenteWidget } from '@/components/modules/agente/AgenteWidget'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, preferences')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar: sólo visible en desktop */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header userName={profile.name} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Navegación inferior: sólo visible en móvil */}
      <BottomNav />

      <AgenteWidget />
    </div>
  )
}
