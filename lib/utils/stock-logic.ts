/**
 * lib/utils/stock-logic.ts
 * Lógica de negocio compartida relacionada con inventario.
 * Funciones puras — sin efectos secundarios ni acceso a DB.
 */

/**
 * Estima los días de duración de un producto en stock.
 * Basado en el stock actual, la cantidad por envase y el número de dosis.
 */
export function estimateDaysRemaining(
  currentQty: number,
  productQuantity: number,
  doses: number,
  shelfLifeDays: number | null
): number {
  if (currentQty <= 0) return 0

  // Días basados en consumo (cuántas porciones × frecuencia asumida diaria)
  const dailyUsage = doses > 0 && productQuantity > 0
    ? (currentQty / productQuantity) * doses / 30  // asume consumo mensual
    : 0

  const daysByConsumption = dailyUsage > 0
    ? Math.round(currentQty / (productQuantity / doses / 30))
    : 999

  // Días hasta vencimiento si aplica
  const daysByExpiry = shelfLifeDays ?? 999

  return Math.min(daysByConsumption, daysByExpiry)
}

/**
 * Calcula cuántas unidades hay que comprar para cubrir N días.
 * Considera el stock mínimo de seguridad.
 */
export function calculateReplenishQty(
  currentQty: number,
  minQty: number,
  targetDays: number = 14
): number {
  const buffer = minQty * 1.5
  const needed = Math.max(0, buffer - currentQty)
  return Math.ceil(needed)
}

/**
 * Determina si un producto debería aparecer en la lista de reposición urgente.
 */
export function needsUrgentRestock(
  currentQty: number,
  minQty: number,
  daysEstimated: number
): boolean {
  return currentQty <= minQty || daysEstimated <= 3
}

/**
 * Genera el resumen de stock para el dashboard.
 */
export function summarizeStock(
  stockItems: Array<{
    current_qty: number
    min_qty: number
    products: { category: string } | null
  }>
) {
  const total = stockItems.length
  const critical = stockItems.filter(s => s.current_qty <= s.min_qty * 0.5).length
  const warning  = stockItems.filter(s =>
    s.current_qty > s.min_qty * 0.5 && s.current_qty <= s.min_qty
  ).length
  const ok = total - critical - warning

  const byCategory = stockItems.reduce((acc, s) => {
    const cat = s.products?.category ?? 'Sin categoría'
    acc[cat] = (acc[cat] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return { total, critical, warning, ok, byCategory }
}
