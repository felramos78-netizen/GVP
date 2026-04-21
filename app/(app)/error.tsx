'use client'
import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GVP App Error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="text-5xl">⚠️</div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Algo salió mal</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          {error.message?.includes('getStock') || error.message?.includes('stock')
            ? 'Error al cargar el inventario. Puede que no haya datos disponibles aún.'
            : error.message?.includes('getPurchaseHistory')
            ? 'Error al cargar el historial de compras.'
            : 'Ocurrió un error inesperado en esta sección.'}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mt-1">Código: {error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="btn-primary px-6"
      >
        Reintentar
      </button>
    </div>
  )
}
