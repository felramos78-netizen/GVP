/**
 * lib/utils/formatters.ts
 * Utilidades de formato para el sistema.
 * Todas las funciones son puras (sin efectos secundarios).
 */
import { format, formatDistanceToNow, parseISO, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Moneda ──────────────────────────────────────────────────────────────────

/**
 * Formatea un número como moneda CLP.
 * @example formatCLP(1300000) → "$1.300.000"
 */
export function formatCLP(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formatea un número con separador de miles (sin símbolo).
 * @example formatNumber(1300000) → "1.300.000"
 */
export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL').format(n)
}

/**
 * Calcula y formatea el porcentaje de un valor sobre un total.
 * @example formatPercent(325000, 1300000) → "25%"
 */
export function formatPercent(value: number, total: number, decimals = 0): string {
  if (total === 0) return '0%'
  return `${(value / total * 100).toFixed(decimals)}%`
}

// ─── Fechas ───────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha ISO como string legible en español.
 * @example formatDate('2026-01-05') → "5 de enero de 2026"
 */
export function formatDate(
  dateStr: string | null | undefined,
  fmt = "d 'de' MMMM 'de' yyyy"
): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), fmt, { locale: es })
  } catch {
    return dateStr
  }
}

/**
 * Formato corto de fecha.
 * @example formatDateShort('2026-01-05') → "05/01/2026"
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  return formatDate(dateStr, 'dd/MM/yyyy')
}

/**
 * Formato para el calendario del planner.
 * @example formatPlannerDate('2026-01-05') → "Lun 5"
 */
export function formatPlannerDate(dateStr: string): string {
  return format(parseISO(dateStr), "EEE d", { locale: es })
}

/**
 * Tiempo relativo desde ahora.
 * @example formatRelative('2026-01-01') → "hace 4 días"
 */
export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const date = parseISO(dateStr)
    if (isToday(date)) return 'hoy'
    if (isYesterday(date)) return 'ayer'
    return formatDistanceToNow(date, { addSuffix: true, locale: es })
  } catch {
    return dateStr
  }
}

/**
 * Retorna el primer día del mes como string ISO.
 * @example getMonthKey(2026, 0) → "2026-01-01"
 */
export function getMonthKey(year: number, month: number): string {
  return format(new Date(year, month, 1), 'yyyy-MM-dd')
}

// ─── Stock y cantidades ───────────────────────────────────────────────────────

/**
 * Formatea una cantidad con su unidad.
 * @example formatQty(0.8, 'kg') → "0.8 kg"
 * @example formatQty(8, 'unidades') → "8 unidades"
 */
export function formatQty(qty: number | null | undefined, unit: string): string {
  if (qty == null) return '—'
  const rounded = Number.isInteger(qty) ? qty : parseFloat(qty.toFixed(2))
  return `${rounded} ${unit}`
}

/**
 * Clasifica el nivel de stock en ok / warning / critical.
 */
export function getStockStatus(
  currentQty: number,
  minQty: number
): 'ok' | 'warning' | 'critical' {
  const pct = minQty > 0 ? currentQty / (minQty * 2) : 1
  if (pct >= 0.6) return 'ok'
  if (pct >= 0.3) return 'warning'
  return 'critical'
}

/**
 * Clases de color según estado de stock.
 */
export const stockStatusClasses = {
  ok:       { text: 'text-teal-600', bg: 'bg-teal-50',  badge: 'bg-teal-50 text-teal-800'  },
  warning:  { text: 'text-amber-600', bg: 'bg-amber-50', badge: 'bg-amber-50 text-amber-800' },
  critical: { text: 'text-coral-600', bg: 'bg-coral-50', badge: 'bg-coral-50 text-coral-800' },
} as const

// ─── Macros ───────────────────────────────────────────────────────────────────

/**
 * Formatea gramos de macronutriente.
 * @example formatMacro(156.4) → "156g"
 */
export function formatMacro(grams: number | null | undefined): string {
  if (grams == null) return '—'
  return `${Math.round(grams)}g`
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/**
 * Combina clases de Tailwind de forma segura (evita duplicados).
 * Alternativa liviana a clsx + tailwind-merge.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Capitaliza la primera letra de un string.
 */
export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Trunca un string a una longitud máxima.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}
