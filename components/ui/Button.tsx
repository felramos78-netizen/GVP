/**
 * components/ui/Button.tsx
 * Botón base tipado con variantes.
 */
import { cn } from '@/lib/utils/formatters'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'success' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const VARIANTS = {
  default: 'btn',
  primary: 'btn-primary',
  success: 'btn-success',
  danger:  'btn-danger',
} as const

const SIZES = {
  sm: 'btn-sm',
  md: '',
  lg: 'px-6 py-3 text-base',
} as const

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'default', size = 'md', loading = false, disabled, children, className, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(VARIANTS[variant], SIZES[size], className)}
        {...props}
      >
        {loading && (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        )}
        {children}
      </button>
    )
  }
)
