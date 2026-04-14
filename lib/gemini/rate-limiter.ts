/**
 * lib/gemini/rate-limiter.ts
 * Controla el uso diario de la API de Gemini por usuario.
 * Límite por defecto: 50 búsquedas/día (conservador dentro del free tier de 1.500).
 * Persiste el contador en Supabase (tabla ai_usage).
 */
import { createAdminClient } from '@/lib/supabase/server'

const DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT ?? '50', 10)

export type RateLimitResult =
  | { allowed: true; used: number; remaining: number }
  | { allowed: false; used: number; remaining: 0; resetAt: string }

/**
 * Verifica si el usuario puede hacer una búsqueda IA hoy.
 * Incrementa el contador si está permitido.
 */
export async function checkAndIncrement(userId: string): Promise<RateLimitResult> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Obtener uso actual del día
  const { data, error } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (error) {
    // Si falla la consulta, permitir para no bloquear al usuario
    console.error('rate-limiter error:', error.message)
    return { allowed: true, used: 0, remaining: DAILY_LIMIT }
  }

  const currentCount = data?.count ?? 0

  if (currentCount >= DAILY_LIMIT) {
    // Calcular cuándo se resetea (medianoche)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    return {
      allowed: false,
      used: currentCount,
      remaining: 0,
      resetAt: tomorrow.toISOString(),
    }
  }

  // Incrementar contador (upsert)
  await supabase.from('ai_usage').upsert(
    { user_id: userId, date: today, count: currentCount + 1 },
    { onConflict: 'user_id,date' }
  )

  return {
    allowed: true,
    used: currentCount + 1,
    remaining: DAILY_LIMIT - currentCount - 1,
  }
}

/**
 * Consulta el uso actual sin incrementar.
 * Para mostrar en la UI cuántas búsquedas quedan.
 */
export async function getUsage(userId: string) {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  const used = data?.count ?? 0
  return {
    used,
    remaining: Math.max(0, DAILY_LIMIT - used),
    limit: DAILY_LIMIT,
  }
}
