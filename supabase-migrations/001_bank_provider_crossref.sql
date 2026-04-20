-- ============================================================
-- Migration 001: Bank Provider Cross-Reference
-- Adds provider alias matching for bank statement imports
-- ============================================================

-- 1. Extend suppliers table
--    - user_id: null = sistema global, non-null = creado por usuario
--    - category: clasificación semántica del proveedor
--    - razones_sociales: nombres legales alternativos (JSON array)
-- ============================================================
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'comercio',
  ADD COLUMN IF NOT EXISTS razones_sociales jsonb DEFAULT '[]'::jsonb;

-- Ampliar el check de type para abarcar más categorías de proveedores
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_type_check;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_type_check
  CHECK (type IN (
    'supermercado','feria','online',
    'servicio','banco','combustible','farmacia',
    'restaurant','transporte','entretenimiento','comercio'
  ));

-- 2. Tabla de aliases de proveedores
--    Mapea fragmentos de texto de las descripciones de movimientos
--    a un supplier_id canónico.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.provider_aliases (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id uuid        NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  alias       text        NOT NULL,
  user_id     uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- índice único case-insensitive por usuario (null = global)
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_aliases_unique
  ON public.provider_aliases (lower(alias), COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_provider_aliases_supplier
  ON public.provider_aliases (supplier_id);

CREATE INDEX IF NOT EXISTS idx_provider_aliases_user
  ON public.provider_aliases (user_id);

-- 3. Extender bank_transactions con supplier_id y tipo de documento
-- ============================================================
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS supplier_id   uuid REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS document_type text CHECK (document_type IN ('cartola', 'tarjeta_credito'));

CREATE INDEX IF NOT EXISTS idx_bank_tx_supplier
  ON public.bank_transactions (supplier_id);

-- 4. Aliases globales iniciales para proveedores comunes en Chile
-- ============================================================
DO $$
DECLARE
  v_banco_chile uuid;
  v_copec uuid;
  v_entel uuid;
  v_movistar uuid;
  v_wom uuid;
  v_vtr uuid;
BEGIN
  -- Banco de Chile
  INSERT INTO public.suppliers (name, type, category, is_active)
    VALUES ('Banco de Chile', 'banco', 'banco', true)
    ON CONFLICT (name) DO UPDATE SET type = 'banco', category = 'banco'
    RETURNING id INTO v_banco_chile;

  IF v_banco_chile IS NOT NULL THEN
    INSERT INTO public.provider_aliases (supplier_id, alias) VALUES
      (v_banco_chile, 'INTERESES LINEA DE CREDITO'),
      (v_banco_chile, 'IMPUESTO LINEA DE CREDITO'),
      (v_banco_chile, 'COMISION CUENTA CORRIENTE'),
      (v_banco_chile, 'PAGO AUTOMATICO TARJETA'),
      (v_banco_chile, 'CARGO SEGURO PROTECCION'),
      (v_banco_chile, 'GIRO CAJERO AUTOMATICO'),
      (v_banco_chile, 'RECAUDACION Y PAGOS'),
      (v_banco_chile, 'TRANSFERENCIA DESDE LINEA')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Copec
  INSERT INTO public.suppliers (name, type, category, razones_sociales, is_active)
    VALUES ('Copec', 'combustible', 'combustible', '["COPEC S.A.","ESTACION COPEC","COPEC SERVICENTRO"]'::jsonb, true)
    ON CONFLICT (name) DO UPDATE SET type = 'combustible', category = 'combustible'
    RETURNING id INTO v_copec;

  IF v_copec IS NOT NULL THEN
    INSERT INTO public.provider_aliases (supplier_id, alias) VALUES
      (v_copec, 'COPEC'),
      (v_copec, 'ESTACION DE SERVICIO COPEC'),
      (v_copec, 'SERVICENTRO COPEC')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Entel
  INSERT INTO public.suppliers (name, type, category, is_active)
    VALUES ('Entel', 'servicio', 'telecomunicaciones', true)
    ON CONFLICT (name) DO UPDATE SET type = 'servicio', category = 'telecomunicaciones'
    RETURNING id INTO v_entel;

  IF v_entel IS NOT NULL THEN
    INSERT INTO public.provider_aliases (supplier_id, alias) VALUES
      (v_entel, 'ENTEL'),
      (v_entel, 'ENTEL PCS'),
      (v_entel, 'ENTEL TELEFONIA')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Movistar
  INSERT INTO public.suppliers (name, type, category, is_active)
    VALUES ('Movistar', 'servicio', 'telecomunicaciones', true)
    ON CONFLICT (name) DO UPDATE SET type = 'servicio', category = 'telecomunicaciones'
    RETURNING id INTO v_movistar;

  IF v_movistar IS NOT NULL THEN
    INSERT INTO public.provider_aliases (supplier_id, alias) VALUES
      (v_movistar, 'MOVISTAR'),
      (v_movistar, 'TELEFONICA MOVILES'),
      (v_movistar, 'TELEFONICA CHILE')
    ON CONFLICT DO NOTHING;
  END IF;

  -- WOM
  INSERT INTO public.suppliers (name, type, category, is_active)
    VALUES ('WOM', 'servicio', 'telecomunicaciones', true)
    ON CONFLICT (name) DO UPDATE SET type = 'servicio', category = 'telecomunicaciones'
    RETURNING id INTO v_wom;

  IF v_wom IS NOT NULL THEN
    INSERT INTO public.provider_aliases (supplier_id, alias) VALUES
      (v_wom, 'WOM'),
      (v_wom, 'WOM MOVIL'),
      (v_wom, 'VTR WOM')
    ON CONFLICT DO NOTHING;
  END IF;

  -- VTR
  INSERT INTO public.suppliers (name, type, category, is_active)
    VALUES ('VTR', 'servicio', 'telecomunicaciones', true)
    ON CONFLICT (name) DO UPDATE SET type = 'servicio', category = 'telecomunicaciones'
    RETURNING id INTO v_vtr;

  IF v_vtr IS NOT NULL THEN
    INSERT INTO public.provider_aliases (supplier_id, alias) VALUES
      (v_vtr, 'VTR'),
      (v_vtr, 'VTR BANDA ANCHA')
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
