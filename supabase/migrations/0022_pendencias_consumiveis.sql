-- 0022_pendencias_consumiveis.sql
-- S8 #21 da rodada 1 (2026-05-12). Templates de pendência ganham flag
-- de consumível + unidade fixa por item. evento_pendencias ganha
-- quantidade (numérica). UI mostra campo de quantidade só pra itens
-- consumíveis (óleo, combustível, aditivo, fluido).
--
-- Espelha v21_pendencias_consumiveis local.

ALTER TABLE pendencias_template
  ADD COLUMN eh_consumivel BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE pendencias_template
  ADD COLUMN unidade TEXT;

ALTER TABLE evento_pendencias
  ADD COLUMN quantidade NUMERIC;

COMMENT ON COLUMN pendencias_template.eh_consumivel IS
  'TRUE quando o item é consumível (óleo, combustível, aditivo). UI pede quantidade pra esses ao marcar como feita. S8 #21 rodada 1, 2026-05-12.';

COMMENT ON COLUMN pendencias_template.unidade IS
  'Unidade fixa do consumível (L, mL, etc). Só lida quando eh_consumivel=TRUE.';

COMMENT ON COLUMN evento_pendencias.quantidade IS
  'Quantidade aplicada (litros, mL etc). NULL pra pendências não-consumíveis.';

-- Backfill heurístico — marca itens com "óleo", "combustível", "aditivo",
-- "fluido" no título como consumíveis em litros. Lista canônica do
-- Flávio entra como UPDATE manual quando ele passar.
UPDATE pendencias_template
SET eh_consumivel = TRUE,
    unidade = 'L'
WHERE LOWER(titulo) ~* 'óleo|oleo|combustível|combustivel|aditivo|fluido';
