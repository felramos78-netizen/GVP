/**
 * lib/supabase/client.ts
 * Cliente Supabase para uso en componentes del lado del cliente (browser).
 * Usar este cliente en Client Components ('use client').
 */
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
