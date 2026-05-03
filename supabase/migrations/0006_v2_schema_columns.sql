-- ═══════════════════════════════════════════════════════════
-- 0006_v2_schema_columns — Sprint 1A.4 / Prompt #16
-- ═══════════════════════════════════════════════════════════
-- Espelho Postgres do GRDB `v2a_columns` (ios/p1fast-core/Sources/
-- P1FastCore/Persistence/Migrations.swift).
--
-- Delta:
--   • sessoes: +pneu_id, +combustivel_id, +qt_combustivel_litros (FKs SET NULL)
--   • pilotos / passageiros: +altura_cm, +peso_kg, +nascimento (todos NULL pra rows existentes)
--   • Índices em pneu_id e combustivel_id (joins frequentes)
--
-- ATENÇÃO: este arquivo está versionado mas NÃO foi aplicado em prod.
-- O Flávio roda `supabase db push` manualmente após o merge do PR.

-- ─── sessoes ──────────────────────────────────────────────
alter table sessoes add column pneu_id uuid references pneus(id) on delete set null;
alter table sessoes add column combustivel_id uuid references combustiveis(id) on delete set null;
alter table sessoes add column qt_combustivel_litros numeric;

create index idx_sessoes_pneu on sessoes(pneu_id);
create index idx_sessoes_combustivel on sessoes(combustivel_id);

-- ─── pilotos ──────────────────────────────────────────────
alter table pilotos add column altura_cm integer;
alter table pilotos add column peso_kg numeric;
alter table pilotos add column nascimento date;

-- ─── passageiros ──────────────────────────────────────────
alter table passageiros add column altura_cm integer;
alter table passageiros add column peso_kg numeric;
alter table passageiros add column nascimento date;
