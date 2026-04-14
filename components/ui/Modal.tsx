'use client'
/**
 * components/ui/Modal.tsx
 * Modal reutilizable con overlay y cierre por clic externo o Escape.
 */
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils/formatters'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={cn('bg-white rounded-xl border border-gray-200 p-6 w-full shadow-lg', SIZES[size])}>
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
