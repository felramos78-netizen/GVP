/**
 * app/(app)/layout.tsx
 * Layout para todas las rutas protegidas.
 * Incluye sidebar, header y verifica que el usuario esté autenticado.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/modules/layout/Sidebar'
import { Header } from '@/components/modules/layout/Header'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Obtener perfil del usuario
  const { data: profile } = await supabase
    .from('users')
    .select('name, preferences')
    .eq('id', user.id)
    .single()

  // Si no tiene perfil, ir al onboarding
  if (!profile) redirect('/onboarding')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header userName={profile.name} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
