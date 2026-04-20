'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard',  label: 'Inicio',    icon: '🏠' },
  { href: '/finanzas',   label: 'Finanzas',  icon: '💰' },
  { href: '/stock',      label: 'Stock',     icon: '📦' },
  { href: '/compras',    label: 'Compras',   icon: '🛒' },
  { href: '/planner',   label: 'Planner',   icon: '📅' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex md:hidden safe-area-bottom">
      {navItems.map(({ href, label, icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors min-h-[56px] ${
              isActive ? 'text-blue-700' : 'text-gray-500'
            }`}
          >
            <span className={`text-xl leading-none transition-transform ${isActive ? 'scale-110' : ''}`}>
              {icon}
            </span>
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
