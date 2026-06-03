-- 0021_tracks_cidade.sql
-- S4 da rodada 1 de ajustes (2026-05-12). Adiciona o campo `cidade`
-- em `tracks` — usado pra agrupar autódromos por cidade na tela de
-- seleção do cadastro de evento.
--
-- Decisão de produto (Flávio): cadastro de autódromo é tarefa interna.
-- O piloto só escolhe. Uma cidade pode ter vários autódromos (exemplo
-- Brasília: Nelson Piquet, Cartódromo do Ferrari, Autódromo do Ará, etc).
-- Inversão S3↔S4 já aprovada: S4 vem ANTES de S3 (tela inicial) porque
-- o card "Autódromos" da Home depende do agrupamento por cidade.
--
-- Espelha a versão local v20_tracks_cidade em
-- ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift

ALTER TABLE tracks ADD COLUMN cidade TEXT;

COMMENT ON COLUMN tracks.cidade IS
  'Cidade onde o autódromo fica (ex: Brasília, Goiânia, Interlagos). Usado pra agrupar na seleção. Pode ser NULL em pistas legadas — UI mostra como "Sem cidade". S4 rodada 1, 2026-05-12.';

-- ── Seed: preenche Brasília do seed canônico (migration 0012) ──
-- ID UUID5 determinístico de "p1fast.brasilia" (ver 0012_seed_brasilia.sql).
UPDATE tracks
SET cidade = 'Brasília'
WHERE id = 'e8335412-3312-54fe-b634-db2d02c7fa81' AND cidade IS NULL;
