-- ═══════════════════════════════════════════════════════════
-- 0018_pessoas — Fase A da F1 (Unificação de pessoas multi-papel)
-- ═══════════════════════════════════════════════════════════
-- F1 etapa A.1 (registro em `docs/FRENTES_POS_MS4.md`). Cria a tabela
-- `pessoas` VAZIA. Não toca em `pilotos` nem `passageiros` — eles
-- continuam vivos até a Fase B (migração de dados + reescrita).
--
-- Decisão Flávio (mockups da Onda 1, PR #174): uma única entidade
-- Pessoa com múltiplos papéis selecionáveis. Os papéis ficam em tabela
-- separada `pessoa_papeis` (0019).
--
-- Campos espelham `pilotos` + `passageiros` (que já têm altura_cm,
-- peso_kg, nascimento via 0006_v2_schema_columns). user_id é o
-- vínculo com auth.users (mantido nullable — Tier 0 pode cadastrar
-- pessoa sem conta).

create table public.pessoas (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  user_id     uuid references auth.users(id) on delete set null,
  altura_cm   integer check (altura_cm is null or altura_cm between 50 and 250),
  peso_kg     numeric(5,2) check (peso_kg is null or peso_kg between 20 and 250),
  nascimento  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_pessoas_upd before update on public.pessoas
  for each row execute function public.set_updated_at();

create index idx_pessoas_time on public.pessoas (time_id);
create index idx_pessoas_user on public.pessoas (user_id) where user_id is not null;

-- ─── RLS ──────────────────────────────────────────────────
alter table public.pessoas enable row level security;

create policy pessoas_select_member on public.pessoas
  for select using (public.is_member(time_id));

create policy pessoas_insert_member on public.pessoas
  for insert with check (public.is_member(time_id));

create policy pessoas_update_member on public.pessoas
  for update using (public.is_member(time_id))
            with check (public.is_member(time_id));

create policy pessoas_delete_admin on public.pessoas
  for delete using (public.is_admin(time_id) or public.is_chefe_equipe(time_id));
