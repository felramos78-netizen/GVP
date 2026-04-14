/**
 * components/ui/Badge.tsx
 * Badge semántico para estados, categorías y etiquetas.
 */
import { cn } from '@/lib/utils/formatters'

interface BadgeProps {
  variant?: 'ok' | 'warning' | 'critical' | 'info' | 'neutral'
  children: React.ReactNode
  className?: string
}

const VARIANTS = {
  ok:       'badge-ok',
  warning:  'badge-warning',
  critical: 'badge-critical',
  info:     'badge-info',
  neutral:  'badge-neutral',
} as const

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cn(VARIANTS[variant], className)}>
      {children}
    </span>
  )
}
