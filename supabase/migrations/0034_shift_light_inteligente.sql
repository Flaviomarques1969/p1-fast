-- ═══════════════════════════════════════════════════════════════════════════
-- 0034_shift_light_inteligente — fundação do shift light contextual com IA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Autorização Flávio em 2026-05-29: "1. aplique" — após auditoria do engenheiro
-- de competição sênior. As 3 recomendações cirúrgicas adotadas:
--   1. Critério "força integrada com tempo de troca modelado".
--   2. Persistência com janela rolante de 90 dias + invalidação por mudança mecânica.
--   3. Aprovação invertida: chefe aprova envelope pré-stint, IA opera dentro dele.
--
-- Decisões de produto fechadas pelo Flávio:
--   - 3 modos: Durabilidade / Normal / Agressivo
--   - Aprendizagem online desde a volta 1 (regras-semente + refinamento contínuo)
--   - Barra de progresso de aprendizado no painel piloto (canto esquerdo)
--
-- Esta migration:
--   A. Estende `padroes_telemetria_por_volta` com 6 colunas que faltavam.
--   B. Cria `pontos_troca_aprendidos` (cardápio de pontos de troca por trecho).
--   C. Cria `envelopes_seguranca_stint` (envelope aprovado pelo chefe por stint).
--   D. Cria `qualidade_troca_marcha` (log da qualidade de cada troca — futuro).
--
-- Idempotente: usa IF NOT EXISTS em tudo. Pode rodar N vezes sem efeito colateral.
--
-- Reversão (se preciso):
--   ALTER TABLE public.padroes_telemetria_por_volta
--     DROP COLUMN IF EXISTS config_cambio,
--     DROP COLUMN IF EXISTS vida_pneu_pct,
--     DROP COLUMN IF EXISTS pontos_troca_por_trecho,
--     DROP COLUMN IF EXISTS valido_ate,
--     DROP COLUMN IF EXISTS hash_config_mecanica,
--     DROP COLUMN IF EXISTS modo_stint;
--   DROP TABLE IF EXISTS public.qualidade_troca_marcha CASCADE;
--   DROP TABLE IF EXISTS public.envelopes_seguranca_stint CASCADE;
--   DROP TABLE IF EXISTS public.pontos_troca_aprendidos CASCADE;

BEGIN;

-- ─── A. Estender padroes_telemetria_por_volta ───────────────────────────────

ALTER TABLE public.padroes_telemetria_por_volta
  ADD COLUMN IF NOT EXISTS config_cambio TEXT,
  -- identifica configuração de câmbio (ex: "Celta 1.0 padrão", "Celta 1.0 coroa 4.27").
  -- Quando essa string mudar, mapa entra em quarentena.

  ADD COLUMN IF NOT EXISTS vida_pneu_pct SMALLINT
    CHECK (vida_pneu_pct IS NULL OR (vida_pneu_pct BETWEEN 0 AND 100)),
  -- 0-30 / 30-60 / 60+ % de desgaste (Opção B do gestor).

  ADD COLUMN IF NOT EXISTS pontos_troca_por_trecho JSONB,
  -- Estrutura: { "<trecho_id>": { "1": rpm, "2": rpm, "3": rpm, "4": rpm } }
  -- Cardápio de pontos de troca aprendidos por trecho × marcha.

  ADD COLUMN IF NOT EXISTS valido_ate TIMESTAMPTZ,
  -- Janela rolante de 90 dias (auditor). Após essa data, mapa precisa reavaliar.

  ADD COLUMN IF NOT EXISTS hash_config_mecanica TEXT,
  -- SHA dos itens mecânicos relevantes (motor, embreagem, mapa injeção, diferencial).
  -- Se hash mudar → quarentena automática.

  ADD COLUMN IF NOT EXISTS modo_stint TEXT
    CHECK (modo_stint IS NULL OR modo_stint IN ('durabilidade', 'normal', 'agressivo'));
  -- 3 modos canônicos.

-- ─── B. pontos_troca_aprendidos ────────────────────────────────────────────
-- Cada linha = ponto de troca aprendido pra UMA combinação única
-- (carro × câmbio × pneu × autódromo × modo) em UM trecho específico,
-- pra UMA marcha específica (1→2, 2→3, 3→4, 4→5).

CREATE TABLE IF NOT EXISTS public.pontos_troca_aprendidos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Chave única (auditor: chave de identificação deve ser completa)
  carro_id           UUID NOT NULL REFERENCES public.carros(id) ON DELETE CASCADE,
  track_id           UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  tipo_pneu          TEXT NOT NULL,
  vida_pneu_faixa    TEXT NOT NULL DEFAULT '0-30',  -- '0-30', '30-60', '60+'
  config_cambio      TEXT NOT NULL DEFAULT 'padrao',
  modo_stint         TEXT NOT NULL CHECK (modo_stint IN ('durabilidade', 'normal', 'agressivo')),
  trecho_id          UUID NOT NULL REFERENCES public.track_segments(id) ON DELETE CASCADE,
  marcha_origem      SMALLINT NOT NULL CHECK (marcha_origem BETWEEN 1 AND 5),
  -- "marcha_origem" = de qual marcha está saindo (troca 1→2 = origem 1)

  -- O que foi aprendido
  rpm_alvo           INTEGER NOT NULL CHECK (rpm_alvo BETWEEN 1000 AND 8000),
  rpm_alvo_baixo     INTEGER,  -- limite inferior da janela do modo
  rpm_alvo_alto      INTEGER,  -- limite superior da janela do modo

  -- Critério "força integrada com tempo de troca modelado" (auditor rec. 1)
  ganho_estimado_s   NUMERIC(5,3),  -- segundos ganhos vs ponto naive
  tempo_troca_assumido_s NUMERIC(4,3) DEFAULT 0.500,  -- 0,5s default Celta H

  -- Confiança e contagem
  voltas_observadas  INTEGER NOT NULL DEFAULT 0,
  amostras_estaveis  INTEGER NOT NULL DEFAULT 0,
  confianca_pct      SMALLINT NOT NULL DEFAULT 0 CHECK (confianca_pct BETWEEN 0 AND 100),
  -- 0% = só regra-semente; 100% = mapa totalmente calibrado.
  -- Alimenta a barra de progresso no painel piloto (decisão Flávio 29/05).

  origem             TEXT NOT NULL DEFAULT 'semente'
    CHECK (origem IN ('semente', 'parcial', 'aprendido', 'manual')),
  -- semente = regra física inicial; aprendido = baseado em voltas reais.

  melhor_tempo_trecho_ms INTEGER,  -- melhor tempo registrado neste trecho com este ponto.

  -- Janela rolante 90 dias (auditor rec. 2)
  valido_ate         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  hash_config_mecanica TEXT NOT NULL DEFAULT 'inicial',

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (carro_id, track_id, tipo_pneu, vida_pneu_faixa, config_cambio, modo_stint, trecho_id, marcha_origem)
);

CREATE INDEX IF NOT EXISTS pontos_troca_carro_track_idx
  ON public.pontos_troca_aprendidos (carro_id, track_id);

CREATE INDEX IF NOT EXISTS pontos_troca_validade_idx
  ON public.pontos_troca_aprendidos (valido_ate);

COMMENT ON TABLE public.pontos_troca_aprendidos IS
  'Cardápio de pontos de troca de marcha aprendidos por combinação única '
  '(carro × câmbio × pneu × autódromo × modo × trecho × marcha). '
  'Alimenta o shift light contextual. Decisão Flávio + auditor 29/05/2026.';

-- ─── C. envelopes_seguranca_stint ──────────────────────────────────────────
-- Envelope aprovado pelo chefe ANTES do stint. IA opera autônoma dentro dele
-- durante o stint, log completo pra revisão depois (auditor rec. 3).

CREATE TABLE IF NOT EXISTS public.envelopes_seguranca_stint (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id          UUID REFERENCES public.sessoes(id) ON DELETE CASCADE,
  carro_id           UUID NOT NULL REFERENCES public.carros(id) ON DELETE CASCADE,

  -- O que o chefe escolheu
  modo_stint         TEXT NOT NULL CHECK (modo_stint IN ('durabilidade', 'normal', 'agressivo')),
  tipo_pneu          TEXT NOT NULL,
  vida_pneu_faixa    TEXT NOT NULL DEFAULT '0-30',
  config_cambio      TEXT NOT NULL DEFAULT 'padrao',

  -- Limites duros que IA NÃO PODE violar (auditor rec. 3)
  rpm_max_absoluto   INTEGER NOT NULL DEFAULT 6300,   -- nunca passa disso
  rpm_min_motor_celsius SMALLINT NOT NULL DEFAULT 80, -- nunca opera Agressivo abaixo disso
  forca_lateral_max_g  NUMERIC(3,2) NOT NULL DEFAULT 0.50, -- nunca troca acima disso

  -- Quem aprovou
  aprovado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes        TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS envelope_sessao_idx
  ON public.envelopes_seguranca_stint (sessao_id);

COMMENT ON TABLE public.envelopes_seguranca_stint IS
  'Envelope de segurança aprovado pelo chefe antes de cada stint. '
  'IA opera autônoma dentro dele. Inverte o modelo de aprovação anterior '
  '(que era ponto-a-ponto). Auditor recomendação 3, decisão Flávio 29/05/2026.';

-- ─── D. qualidade_troca_marcha ─────────────────────────────────────────────
-- Log da qualidade de cada troca de marcha executada — alimenta o "elefante
-- na sala" (o auditor apontou que 0,4-0,8s perdidos por troca em câmbio H
-- amador é o maior ganho potencial). Pré-requisito: sensor de rotação da
-- árvore primária — ainda NÃO instalado. Tabela criada pra estar pronta
-- quando o sensor chegar.

CREATE TABLE IF NOT EXISTS public.qualidade_troca_marcha (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id          UUID REFERENCES public.sessoes(id) ON DELETE CASCADE,
  carro_id           UUID NOT NULL REFERENCES public.carros(id) ON DELETE CASCADE,
  trecho_id          UUID REFERENCES public.track_segments(id) ON DELETE SET NULL,
  volta_numero       INTEGER,

  -- Marcha
  marcha_origem      SMALLINT NOT NULL CHECK (marcha_origem BETWEEN 1 AND 5),
  marcha_destino     SMALLINT NOT NULL CHECK (marcha_destino BETWEEN 1 AND 6),

  -- Pontos chave da troca
  rpm_antes          INTEGER NOT NULL,
  rpm_depois         INTEGER NOT NULL,
  rpm_esperado_depois INTEGER,  -- calculado pela razão das marchas

  -- Métricas de qualidade
  tempo_tracao_zero_s NUMERIC(4,3),  -- tempo sem tração durante a troca
  delta_rpm_inesperado INTEGER,       -- rpm_depois - rpm_esperado_depois (positivo = sub-rotação)
  embreagem_patinou  BOOLEAN DEFAULT FALSE,
  missed_shift       BOOLEAN DEFAULT FALSE,   -- engatou marcha errada

  -- Contexto
  forca_lateral_g    NUMERIC(3,2),
  velocidade_kmh     NUMERIC(5,1),

  ocorrido_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qualidade_troca_sessao_idx
  ON public.qualidade_troca_marcha (sessao_id, volta_numero);

COMMENT ON TABLE public.qualidade_troca_marcha IS
  'Log da qualidade de cada troca de marcha executada. Endereça "elefante '
  'na sala" do auditor (0,4-0,8s perdidos por troca em câmbio H amador). '
  'Pré-requisito: sensor de rotação da árvore primária. Tabela criada '
  'antecipadamente pra estar pronta quando sensor chegar.';

COMMIT;

-- ─── Verificação automática ────────────────────────────────────────────────
SELECT 'padroes_extendida'  AS objeto, COUNT(*) AS colunas_novas
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'padroes_telemetria_por_volta'
    AND column_name IN ('config_cambio', 'vida_pneu_pct', 'pontos_troca_por_trecho',
                        'valido_ate', 'hash_config_mecanica', 'modo_stint')
UNION ALL
SELECT 'pontos_troca_aprendidos', COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'pontos_troca_aprendidos'
UNION ALL
SELECT 'envelopes_seguranca_stint', COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'envelopes_seguranca_stint'
UNION ALL
SELECT 'qualidade_troca_marcha', COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'qualidade_troca_marcha';
-- Esperado: padroes_extendida=6, demais=1 cada.
