-- 0029_evento_periodo_e_dias.sql
-- 2026-05-16 (Flávio autorizou): evento vira guarda-chuva de período.
--
-- Decisões aprovadas via cards 20260516-093200..094800:
--   P1 Calendário com data início + data fim
--   P2 Rótulo opcional; default = "Dia de pista DD" (número do dia do mês),
--      calculado no app
--   P3 Tipo (treino/quali/corrida/livre) sobe pra evento_dias — fica vazio
--      no nível evento. Coluna eventos.tipo é preservada por compatibilidade
--      e marcada como deprecated.
--   P4 EventoDetalhe mostra abas no topo (1 aba por evento_dia)
--   P5 Eventos antigos convertem automático: cada um vira 1 dia
--      (data_dia = data_evento atual; rotulo NULL; tipo copiado de eventos.tipo)
--
-- Schema:
--   eventos.data_evento -> mantém como data_inicio do período (legado)
--   eventos.data_fim    -> NOVO, default = data_evento (1 dia)
--   evento_dias         -> NOVA tabela (1 row por dia do evento)
--   sessoes.evento_dia_id -> NOVO vínculo direto stint↔dia
--
-- Espelha v25_evento_periodo_e_dias local (a aplicar em
-- ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift).

-- ── 1. eventos: campo data_fim ─────────────────────────────
ALTER TABLE public.eventos ADD COLUMN data_fim DATE;

COMMENT ON COLUMN public.eventos.data_fim IS
  'Data fim do período do evento. Default = data_evento (evento de 1 dia). 2026-05-16 (Flávio).';

COMMENT ON COLUMN public.eventos.data_evento IS
  'Data início do período do evento (mantém o nome antigo por compatibilidade — refere-se ao 1º dia).';

COMMENT ON COLUMN public.eventos.tipo IS
  'DEPRECATED em 2026-05-16. Tipo agora vive em evento_dias.tipo. Mantido pra histórico.';

-- Backfill: eventos existentes viram período de 1 dia (data_fim = data_evento)
UPDATE public.eventos SET data_fim = data_evento WHERE data_fim IS NULL;

ALTER TABLE public.eventos ALTER COLUMN data_fim SET NOT NULL;

-- ── 2. evento_dias: 1 row por dia do período ──────────────
CREATE TABLE public.evento_dias (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_id      UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  evento_id    UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  data_dia     DATE NOT NULL,
  rotulo       TEXT,                    -- nullable; quando NULL, app exibe "Dia de pista DD"
  tipo         TEXT,                    -- treino/classificacao/corrida/livre — opcional
  ordem        INT NOT NULL DEFAULT 0,  -- 0-based, ordem cronológica dentro do evento
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.evento_dias IS
  'Dias filhos de um evento. 2026-05-16 (Flávio). 1:N evento → evento_dias. Stints linkam via sessoes.evento_dia_id.';

CREATE TRIGGER trg_evento_dias_upd
  BEFORE UPDATE ON public.evento_dias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX ON public.evento_dias (evento_id);
CREATE INDEX ON public.evento_dias (time_id);
CREATE INDEX ON public.evento_dias (data_dia);

-- RLS — padrão time-tenancy (igual eventos, configuracoes etc)
ALTER TABLE public.evento_dias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evento_dias: select pelo time"
  ON public.evento_dias FOR SELECT TO authenticated
  USING (public.is_member(time_id));

CREATE POLICY "evento_dias: insert pelo time"
  ON public.evento_dias FOR INSERT TO authenticated
  WITH CHECK (public.is_member(time_id));

CREATE POLICY "evento_dias: update pelo time"
  ON public.evento_dias FOR UPDATE TO authenticated
  USING (public.is_member(time_id))
  WITH CHECK (public.is_member(time_id));

CREATE POLICY "evento_dias: delete pelo time"
  ON public.evento_dias FOR DELETE TO authenticated
  USING (public.is_member(time_id));

-- ── 3. sessoes: vínculo direto stint ↔ dia ────────────────
ALTER TABLE public.sessoes ADD COLUMN evento_dia_id UUID
  REFERENCES public.evento_dias(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sessoes.evento_dia_id IS
  'Vínculo direto stint ↔ dia do evento. NULL é aceitável pra retro-compatibilidade. 2026-05-16 (Flávio).';

CREATE INDEX ON public.sessoes (evento_dia_id);

-- ── 4. Conversão automática (P5) ──────────────────────────
-- Pra cada evento existente, cria 1 row em evento_dias com data = data_evento.
-- Tipo herda do eventos.tipo (mesmo que o app vá parar de gravar lá).
INSERT INTO public.evento_dias (id, time_id, evento_id, data_dia, rotulo, tipo, ordem, created_at, updated_at)
SELECT
  gen_random_uuid(),
  e.time_id,
  e.id,
  e.data_evento,
  NULL,            -- rotulo: NULL → app exibe "Dia de pista DD"
  e.tipo,          -- copia o tipo legado pro dia
  0,               -- único dia do evento → ordem 0
  e.created_at,
  e.updated_at
FROM public.eventos e
WHERE NOT EXISTS (
  SELECT 1 FROM public.evento_dias d WHERE d.evento_id = e.id
);

-- Linka sessões existentes ao dia que casa com data_inicio do stint
-- (ou ao único dia do evento, se houver só 1).
UPDATE public.sessoes s
SET evento_dia_id = d.id
FROM public.evento_dias d
WHERE s.evento_id IS NOT NULL
  AND s.evento_dia_id IS NULL
  AND d.evento_id = s.evento_id
  AND (
    s.data_inicio IS NULL
    OR (s.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date = d.data_dia
    OR (SELECT COUNT(*) FROM public.evento_dias d2 WHERE d2.evento_id = s.evento_id) = 1
  );
