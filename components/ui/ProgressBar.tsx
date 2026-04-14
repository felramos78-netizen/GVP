/**
 * components/ui/ProgressBar.tsx
 * Barra de progreso con color semántico automático.
 */
import { cn } from '@/lib/utils/formatters'

interface ProgressBarProps {
  value: number        // 0-100
  max?: number         // por defecto 100
  color?: string       // color CSS o clase tailwind
  height?: 'xs' | 'sm' | 'md'
  className?: string
  showLabel?: boolean
}

const HEIGHTS = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2.5',
}

export function ProgressBar({
  value,
  max = 100,
  color,
  height = 'sm',
  className,
  showLabel = false,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)))

  // Color semántico automático si no se especifica
  const autoColor = color
    ?? (pct >= 60 ? '#1D9E75' : pct >= 30 ? '#BA7517' : '#D85A30')

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-gray-100 rounded-full overflow-hidden', HEIGHTS[height])}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: autoColor }}
        />
      </div>
      {showLabel && (
        <div className="text-xs text-gray-400 mt-1 text-right">{pct}%</div>
      )}
    </div>
  )
}
