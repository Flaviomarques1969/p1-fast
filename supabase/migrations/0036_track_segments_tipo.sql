-- ═══════════════════════════════════════════════════════════════════════════
-- 0036_track_segments_tipo — classificação de tipo de trecho (curva/reta/etc)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Autorização Flávio 2026-05-29: "as três" (incluindo "classificar os 8 trechos
-- de Brasília como reta longa / reta curta / curva").
--
-- Adiciona coluna `tipo` em track_segments. Os 8 trechos atuais de Brasília
-- são todos CURVAS (decisão Flávio 27/05). Retas entre as curvas serão
-- cadastradas separadamente quando houver dado GPS pra elas.

BEGIN;

ALTER TABLE public.track_segments
  ADD COLUMN IF NOT EXISTS tipo TEXT
    CHECK (tipo IS NULL OR tipo IN ('curva','reta_longa','reta_curta','pit_lane','outra'));

-- Popula os 8 trechos atuais de Brasília como 'curva'
UPDATE public.track_segments
  SET tipo = 'curva'
  WHERE tipo IS NULL
    AND layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f';

COMMIT;

-- Verificação
SELECT 'track_segments_brasilia' AS objeto,
       COUNT(*) FILTER (WHERE tipo = 'curva') AS curvas,
       COUNT(*) FILTER (WHERE tipo = 'reta_longa') AS retas_longas,
       COUNT(*) FILTER (WHERE tipo = 'reta_curta') AS retas_curtas
  FROM public.track_segments
  WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f';
-- Esperado: curvas=8, retas_longas=0, retas_curtas=0.
