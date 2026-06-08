-- 0023_t4000_live_channel.sql
-- Canal bidirecional de eventos + comandos entre a página WebUSB T4000
-- (rodando no notebook do Flávio) e o Claude (aqui no iMac).
-- Página POST eventos a cada estado; Claude POST comandos; página executa.

CREATE TABLE IF NOT EXISTS public.t4000_live_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS t4000_live_events_session_ts_idx
  ON public.t4000_live_events (session_id, ts DESC);

CREATE TABLE IF NOT EXISTS public.t4000_live_commands (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  command TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  result JSONB
);

CREATE INDEX IF NOT EXISTS t4000_live_commands_session_pending_idx
  ON public.t4000_live_commands (session_id, applied, ts);

ALTER TABLE public.t4000_live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t4000_live_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS t4000_events_anon_all ON public.t4000_live_events;
CREATE POLICY t4000_events_anon_all ON public.t4000_live_events
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS t4000_commands_anon_all ON public.t4000_live_commands;
CREATE POLICY t4000_commands_anon_all ON public.t4000_live_commands
  FOR ALL TO anon USING (true) WITH CHECK (true);
