-- Tabla de abonos de manutención (pensiones, arriendos recibidos, etc.)
CREATE TABLE IF NOT EXISTS mantencion_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL DEFAULT 'Nuevo abono',
  monto       NUMERIC(15,2) NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mantencion_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mantencion_self" ON mantencion_entries
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
