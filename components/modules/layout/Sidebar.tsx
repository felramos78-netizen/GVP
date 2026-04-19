'use client'
/**
 * components/modules/layout/Sidebar.tsx
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',     icon: '🏠' },
  { href: '/finanzas',   label: 'Finanzas',      icon: '💰' },
  { href: '/banco',      label: 'Banco',         icon: '🏦' },
  { href: '/stock',      label: 'Stock',         icon: '📦' },
  { href: '/compras',    label: 'Compras',       icon: '🛒' },
  { href: '/aseo',       label: 'Actividades',   icon: '✅' },
  { href: '/planner',    label: 'Planner',       icon: '📅' },
  { href: '/recetas',    label: 'Recetas',       icon: '🍽️' },
  { href: '/cotizacion', label: 'Cotización',    icon: '📊' },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="h-14 flex items-center px-5 border-b border-gray-200">
        <span className="text-lg font-bold text-blue-700 tracking-tight">GDV</span>
        <span className="ml-2 text-xs text-gray-400 font-medium">Gestión de Vida</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}>
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="px-5 py-3 border-t border-gray-200">
        <p className="text-xs text-gray-400">v0.1.0 · Zero cost</p>
      </div>
    </aside>
  )
}
