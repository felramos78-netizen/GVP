'use client'
/**
 * components/modules/layout/Header.tsx
 * Header superior con nombre del usuario y acceso rápido.
 */
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  userName: string
}

export function Header({ userName }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Iniciales del usuario
  const initials = userName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Breadcrumb — se puede mejorar con usePathname en el futuro */}
      <div />

      {/* Usuario */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 hidden sm:block">{userName}</span>
        <div className="relative group">
          <button className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center hover:bg-blue-200 transition-colors">
            {initials}
          </button>
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
