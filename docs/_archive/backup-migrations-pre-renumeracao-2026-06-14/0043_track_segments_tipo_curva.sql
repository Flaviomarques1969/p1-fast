-- ═══════════════════════════════════════════════════════════════════════════
-- 0043_track_segments_tipo_curva — tipo FINO da curva (T0–T5/SF/ND) por trecho
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Padrão DEFINITIVO ditado por Flávio em 13/06/2026 (Command Box dos trechos).
-- Fonte de verdade: relatorios/_decisao-flavio-padrao-curvas-2026-06-13.json
-- (worktree classificador-trail) + memória p1-fast-classificador-vivo-command-box-
-- trechos-2026-06-13.
--
-- NÃO mexe na coluna `tipo` (curva/reta_longa/reta_curta/...) criada na 0036 —
-- esta é uma classificação COMPLEMENTAR e mais fina, exclusiva das curvas.
--
-- Coluna NULA por padrão (retas/outros trechos ficam NULL). Os 8 trechos de
-- Brasília recebem o tipo fino do padrão definitivo. ND = "indeterminado"
-- (o dado de maio a ~1 Hz não fecha; some quando chegar captura a 25 Hz).
--
-- AMBIENTE: aplicar primeiro em DESENVOLVIMENTO. Em PRODUÇÃO (cloud
-- fvhwltzhytpnhlqbttmd) só com autorização explícita "MIGRAR PARA PRODUÇÃO".

BEGIN;

ALTER TABLE public.track_segments
  ADD COLUMN IF NOT EXISTS tipo_curva TEXT
    CHECK (tipo_curva IS NULL OR tipo_curva IN ('T0','T1','T2','T3','T4','T5','SF','ND'));

COMMENT ON COLUMN public.track_segments.tipo_curva IS
  'Tipo fino da curva (T0–T5/SF/ND) — padrão Flávio 13/06/2026. Complementa a coluna tipo. NULL p/ retas.';

-- Padrão definitivo das 8 curvas de Brasília (por nome, escopo do layout principal).
UPDATE public.track_segments SET tipo_curva = 'T5' WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f' AND nome = 'CURVA 01';
UPDATE public.track_segments SET tipo_curva = 'T1' WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f' AND nome = 'CURVA DA RETA OPOSTA';
UPDATE public.track_segments SET tipo_curva = 'T0' WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f' AND nome = 'CURVA 2';
UPDATE public.track_segments SET tipo_curva = 'T2' WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f' AND nome = 'CURVA DA JUNÇÃO';
UPDATE public.track_segments SET tipo_curva = 'T0' WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f' AND nome = 'CURVA DA BRUXA';
UPDATE public.track_segments SET tipo_curva = 'T2' WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f' AND nome = 'CURVA DO PLACAR';
UPDATE public.track_segments SET tipo_curva = 'T4' WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f' AND nome = 'CURVA "S"';
UPDATE public.track_segments SET tipo_curva = 'SF' WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f' AND nome = 'CURVA DA VITÓRIA';

COMMIT;

-- Verificação (esperado: 8 linhas, tipo_curva preenchido conforme o padrão)
SELECT ordem, nome, tipo, tipo_curva
  FROM public.track_segments
  WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f'
  ORDER BY ordem;
-- Esperado:
--   CURVA 01 = T5 | CURVA DA RETA OPOSTA = T1 | CURVA 2 = T0 | CURVA DA JUNÇÃO = T2
--   CURVA DA BRUXA = T0 | CURVA DO PLACAR = T2 | CURVA "S" = T4 | CURVA DA VITÓRIA = SF
