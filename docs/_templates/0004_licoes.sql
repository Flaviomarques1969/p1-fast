-- ═══════════════════════════════════════════════════════════
-- 0004_licoes — catálogo curado de lições (Sprint 1A.5 / Prompt #20)
-- ═══════════════════════════════════════════════════════════
-- TEMPLATE PRÉ-BAKED. Cloud Code do prompt #20 deve copiar isto pra
-- supabase/migrations/0004_licoes.sql sem alteração estrutural.
-- Seed das 12 lições é responsabilidade do LicaoRepository.bootstrap()
-- no app (não no SQL — mantém canônico em Swift, não duplicar).
--
-- Lições são GLOBAIS (catálogo curado pelo dev) — segue padrão de
-- tracks/track_layouts em 0001: RLS public read, write só via service_role.

create table public.licoes (
  id                 uuid primary key default gen_random_uuid(),
  titulo             text not null,
  descricao          text,
  categoria          text not null,
  nivel              text not null,
  fase               text,
  tipo_curva         text,
  sinais_requeridos  text,                                   -- JSON serializado pelo client
  ativa              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_licoes_upd before update on public.licoes
  for each row execute function public.set_updated_at();

-- Índices
create index on public.licoes (ativa);
create index on public.licoes (categoria);

-- RLS: leitura pública (todos veem), escrita só service_role
alter table public.licoes enable row level security;
create policy licoes_public_read on public.licoes for select using (true);
-- (sem policy de write → só service_role consegue mutar)
