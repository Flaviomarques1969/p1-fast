-- ═══════════════════════════════════════════════════════════════════════════
-- 0035_perfis_reacao_piloto — persistência do tempo de troca aprendido
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Autorização Flávio 2026-05-29: "ataque a persistência agora" — Onda 7+.
--
-- Conceito: o orquestrador do shift light aprende o tempo de troca de marcha
-- do piloto e antecipa a luz pra ele fazer a troca exatamente no giro alvo.
-- Esta tabela guarda esse aprendizado pra sobreviver entre sessões.
--
-- Estrutura:
--   - Chave: piloto + carro + marcha + trecho (cada um pode ser NULL pra
--     suportar hierarquia de fallback: exact → piloto+carro+marcha →
--     piloto+carro → default).
--   - Valor: reaction_time_ms (média ponderada) + sample_count (quantos
--     eventos alimentaram) + last_updated.

BEGIN;

CREATE TABLE IF NOT EXISTS public.perfis_reacao_piloto (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Chave (NULL = "qualquer")
  piloto_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  carro_id           UUID NOT NULL REFERENCES public.carros(id) ON DELETE CASCADE,
  marcha             SMALLINT CHECK (marcha IS NULL OR marcha BETWEEN 1 AND 6),
  trecho_id          UUID REFERENCES public.track_segments(id) ON DELETE CASCADE,

  -- Valor aprendido
  reaction_time_ms   NUMERIC(6,2) NOT NULL CHECK (reaction_time_ms BETWEEN 50 AND 400),
  sample_count       INTEGER NOT NULL DEFAULT 0 CHECK (sample_count >= 0),

  -- Auditoria
  last_updated       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unicidade aceita NULL (PostgreSQL trata NULL como distinto, então
-- usamos índice único com expressão pra ter comportamento determinístico).
CREATE UNIQUE INDEX IF NOT EXISTS perfis_reacao_uniq
  ON public.perfis_reacao_piloto (
    COALESCE(piloto_id::text, ''),
    carro_id,
    COALESCE(marcha, -1),
    COALESCE(trecho_id::text, '')
  );

CREATE INDEX IF NOT EXISTS perfis_reacao_carro_idx
  ON public.perfis_reacao_piloto (carro_id);

CREATE INDEX IF NOT EXISTS perfis_reacao_piloto_carro_idx
  ON public.perfis_reacao_piloto (piloto_id, carro_id);

COMMENT ON TABLE public.perfis_reacao_piloto IS
  'Perfis de tempo de troca de marcha aprendidos pelo orquestrador do shift light. '
  'Chave hierárquica (piloto+carro+marcha+trecho com NULL = qualquer). '
  'Auditor recomendação 2 + persistência Onda 7. Flávio 2026-05-29.';

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Mesma política das outras tabelas do car-team: membros do time do carro
-- têm acesso. Pra simplicidade no protótipo: anon lê e grava
-- (igual padroes_telemetria_por_volta).
ALTER TABLE public.perfis_reacao_piloto ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'perfis_reacao_piloto' AND policyname = 'perfis_reacao_all'
  ) THEN
    CREATE POLICY perfis_reacao_all ON public.perfis_reacao_piloto
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- ── Verificação ────────────────────────────────────────────────────────
SELECT 'perfis_reacao_piloto' AS objeto, COUNT(*) AS existe
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'perfis_reacao_piloto';
-- Esperado: 1
