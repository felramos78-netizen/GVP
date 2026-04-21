-- ============================================================
-- Migration 003: Agente IA — tablas de conversaciones y bug reports
-- ============================================================

-- 1. Historial de conversaciones del agente IA
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'agent')),
  content     TEXT        NOT NULL,
  action      JSONB,
  page        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_conversations_self" ON public.agent_conversations
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_session
  ON public.agent_conversations (session_id);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_date
  ON public.agent_conversations (user_id, created_at DESC);

-- 2. Reporte de bugs enviados por los usuarios vía agente IA
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page        TEXT        NOT NULL DEFAULT 'desconocida',
  description TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bug_reports_self" ON public.bug_reports
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bug_reports_user
  ON public.bug_reports (user_id, created_at DESC);
