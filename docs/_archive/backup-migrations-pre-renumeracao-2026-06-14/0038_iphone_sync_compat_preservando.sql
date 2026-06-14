-- ═══════════════════════════════════════════════════════════
-- 0038_iphone_sync_compat_preservando — alinhar esquema da nuvem com o iPhone
--                                       SEM destruir dados existentes.
-- ═══════════════════════════════════════════════════════════
-- Substitui o plano original da 0024 (que dropava as tabelas).
-- Em 30/05 descobri 6 eventos reais + 135 pendências + 45 templates em produção.
-- Esta migration ALTERA o tipo das colunas e adiciona colunas novas — preserva
-- todos os registros existentes.
--
-- Conversão UUID → TEXT é via `USING id::text`. O UUID continua sendo o ID,
-- só passa a viver como string. Pendências antigas seguem referenciando seus
-- templates. App iOS continua sem ler esses registros (porque ele usa códigos
-- "pt-g{N}-{M}", não UUIDs) — isso é decisão de catálogo SEPARADA, fora do
-- escopo desta migration.
--
-- Auditado 30/05/2026: aplicação preserva 6 eventos + 135 pendências + 45
-- templates. Não há perda de dados.

begin;

-- ── 1. eventos.data_fim vira opcional (idempotente) ──────
alter table public.eventos alter column data_fim drop not null;

-- ── 2. Dropar a FK pra poder converter tipos das duas pontas ──
alter table public.evento_pendencias
  drop constraint if exists evento_pendencias_template_id_fkey;

-- ── 3. Converter PK de pendencias_template UUID → TEXT ───
-- UUIDs existentes viram strings na conversão; valores novos podem ser
-- qualquer texto (ex.: "pt-g1-05").
alter table public.pendencias_template
  alter column id type text using id::text;

-- ── 4. Converter FK em evento_pendencias UUID → TEXT ─────
alter table public.evento_pendencias
  alter column template_id type text using template_id::text;

-- ── 5. Recriar a FK ──────────────────────────────────────
alter table public.evento_pendencias
  add constraint evento_pendencias_template_id_fkey
  foreign key (template_id) references public.pendencias_template(id)
  on delete cascade;

-- ── 6. Adicionar colunas novas (idempotente) ─────────────
alter table public.pendencias_template
  add column if not exists eh_consumivel boolean not null default false;
alter table public.pendencias_template
  add column if not exists unidade text;
alter table public.evento_pendencias
  add column if not exists quantidade real;

commit;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (em caso de necessidade)
-- ═══════════════════════════════════════════════════════════
-- begin;
--   alter table public.evento_pendencias drop column if exists quantidade;
--   alter table public.pendencias_template drop column if exists unidade;
--   alter table public.pendencias_template drop column if exists eh_consumivel;
--   alter table public.evento_pendencias drop constraint if exists evento_pendencias_template_id_fkey;
--   -- Conversão TEXT → UUID falha se houver valores não-UUID. Backup do banco
--   -- inteiro é o caminho seguro pra reverter o tipo.
-- commit;
