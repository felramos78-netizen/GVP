/**
 * app/api/setup-db/route.ts
 * Aplica migraciones pendientes vía el SQL endpoint de PostgREST.
 * Llamar una vez: GET /api/setup-db
 */
import { NextResponse } from 'next/server'

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS public.mantencion_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL DEFAULT 'Nuevo abono',
  monto       NUMERIC(15,2) NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mantencion_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mantencion_entries' AND policyname = 'mantencion_self'
  ) THEN
    CREATE POLICY "mantencion_self" ON public.mantencion_entries
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
`

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      ok: false,
      error: 'Variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas.',
      sql: MIGRATION_SQL.trim(),
    }, { status: 500 })
  }

  // Intenta ejecutar la migración vía el endpoint SQL de PostgREST v12+
  const sqlEndpoint = `${supabaseUrl}/rest/v1/sql`
  try {
    const res = await fetch(sqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: MIGRATION_SQL,
    })

    if (res.ok) {
      return NextResponse.json({ ok: true, message: 'Migración aplicada correctamente. Tabla mantencion_entries creada.' })
    }

    const errText = await res.text()
    // Si el endpoint SQL no existe (404) o no está soportado, devolvemos el SQL manual
    return NextResponse.json({
      ok: false,
      status: res.status,
      error: errText,
      instruction: 'El endpoint SQL automático no está disponible. Aplica el SQL manualmente en el Dashboard de Supabase → SQL Editor.',
      sql: MIGRATION_SQL.trim(),
    }, { status: 200 })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: (err as Error).message,
      instruction: 'Aplica el SQL manualmente en el Dashboard de Supabase → SQL Editor.',
      sql: MIGRATION_SQL.trim(),
    }, { status: 200 })
  }
}
