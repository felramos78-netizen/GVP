'use client'
/**
 * components/modules/productos/PriceSearchButton.tsx
 * Botón que dispara la búsqueda de precios con Gemini IA.
 * Muestra estado de carga, límite diario y resultado.
 */
import { useState } from 'react'
import { useSearchPrices } from '@/hooks/useProducts'

interface PriceSearchButtonProps {
  productId: string
  productName: string
}

export function PriceSearchButton({ productId, productName }: PriceSearchButtonProps) {
  const [result, setResult] = useState<{
    pricesSaved: number
    rateLimitRemaining: number
  } | null>(null)

  const { mutate, isPending, error } = useSearchPrices()

  const handleSearch = () => {
    mutate([productId], {
      onSuccess: (data) => {
        setResult({
          pricesSaved: data.pricesSaved,
          rateLimitRemaining: data.rateLimitRemaining,
        })
        // Limpiar mensaje después de 5 segundos
        setTimeout(() => setResult(null), 5000)
      },
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSearch}
        disabled={isPending}
        className="btn"
      >
        {isPending ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Buscando precios...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar precios con IA
          </>
        )}
      </button>

      {result && (
        <p className="text-xs text-teal-600">
          ✓ {result.pricesSaved} precio{result.pricesSaved !== 1 ? 's' : ''} actualizados
          · {result.rateLimitRemaining} búsquedas restantes hoy
        </p>
      )}
      {error && (
        <p className="text-xs text-coral-600">
          {error instanceof Error ? error.message : 'Error en búsqueda'}
        </p>
      )}
    </div>
  )
}
