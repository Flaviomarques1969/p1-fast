-- ═══════════════════════════════════════════════════════════
-- 0049_multiaparelho_equipe_checklist — Fase 1 multi-aparelho.
-- ═══════════════════════════════════════════════════════════
-- Faz a EQUIPE do box e os CHECKLISTS (do stint e do dia) passarem a
-- sincronizar entre aparelhos (cada pessoa no seu celular, mesma equipe e
-- mesmas marcações). Cria 3 tabelas que hoje só existem local (SQLite,
-- migrations v36/v37/v38 do app):
--   equipe_membros  — pessoa + papel + PIN (hash) por time
--   stint_check     — marcações do checklist DENTRO de um stint
--   dia_check       — marcações do checklist do DIA do evento
--
-- Padrão idêntico a `estoque_item` (0046): id uuid, time_id uuid (RLS via
-- public.is_member), timestamptz nos *_at, trigger public.set_updated_at
-- (respeita o updated_at do cliente — 0013). Colunas de ms-epoch que NÃO
-- terminam em `_at` (pin_set_em, feito_em) ficam BIGINT: a Edge Function
-- `sync` (coerceTimestamps) só converte `_at`/`data_`/`nascimento`, então
-- passar timestamptz aqui geraria "out of range". `synced_at` é só-local —
-- NÃO existe aqui (a função ignora colunas que a tabela não tem).
--
-- App envia ids no formato uuid minúsculo. stint_id/evento_id/dia ficam TEXT
-- (chave opaca de casamento entre aparelhos; sem FK pra não acoplar ordem de
-- sync). Sem unique além do id: 2 aparelhos podem criar marcas distintas do
-- mesmo item; o app colapsa no Set ao ler (dedup fino = refinamento futuro).
--
-- Idempotente: create table if not exists + drop/create de policy/trigger.
-- NÃO aplicar manualmente — Flávio autoriza e aplica.

begin;

-- ── equipe_membros ────────────────────────────────────────
create table if not exists public.equipe_membros (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  nome        text not null,
  papel       text not null,
  pin_hash    text,
  pin_set_em  bigint,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_equipe_membros_time on public.equipe_membros (time_id);

drop trigger if exists trg_equipe_membros_upd on public.equipe_membros;
create trigger trg_equipe_membros_upd before update on public.equipe_membros
  for each row execute function public.set_updated_at();

alter table public.equipe_membros enable row level security;
drop policy if exists equipe_membros_all on public.equipe_membros;
create policy equipe_membros_all on public.equipe_membros for all
  using (public.is_member(time_id)) with check (public.is_member(time_id));

-- ── stint_check ───────────────────────────────────────────
create table if not exists public.stint_check (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  stint_id    text not null,
  item_id     text not null,
  feito       boolean not null default false,
  feito_por   text,
  feito_papel text,
  feito_em    bigint,
  updated_at  timestamptz not null default now()
);
create index if not exists idx_stint_check_time on public.stint_check (time_id);
create index if not exists idx_stint_check_stint on public.stint_check (time_id, stint_id);

drop trigger if exists trg_stint_check_upd on public.stint_check;
create trigger trg_stint_check_upd before update on public.stint_check
  for each row execute function public.set_updated_at();

alter table public.stint_check enable row level security;
drop policy if exists stint_check_all on public.stint_check;
create policy stint_check_all on public.stint_check for all
  using (public.is_member(time_id)) with check (public.is_member(time_id));

-- ── dia_check ─────────────────────────────────────────────
create table if not exists public.dia_check (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  evento_id   text not null,
  dia         text not null,
  item_id     text not null,
  feito       boolean not null default false,
  feito_por   text,
  feito_papel text,
  feito_em    bigint,
  updated_at  timestamptz not null default now()
);
create index if not exists idx_dia_check_time on public.dia_check (time_id);
create index if not exists idx_dia_check_evento on public.dia_check (time_id, evento_id, dia);

drop trigger if exists trg_dia_check_upd on public.dia_check;
create trigger trg_dia_check_upd before update on public.dia_check
  for each row execute function public.set_updated_at();

alter table public.dia_check enable row level security;
drop policy if exists dia_check_all on public.dia_check;
create policy dia_check_all on public.dia_check for all
  using (public.is_member(time_id)) with check (public.is_member(time_id));

commit;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (se necessário)
-- ═══════════════════════════════════════════════════════════
-- begin;
--   drop table if exists public.dia_check;
--   drop table if exists public.stint_check;
--   drop table if exists public.equipe_membros;
-- commit;
