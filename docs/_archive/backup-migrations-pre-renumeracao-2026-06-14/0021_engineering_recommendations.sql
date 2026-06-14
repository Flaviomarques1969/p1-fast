-- ═══════════════════════════════════════════════════════════
-- 0021_engineering_recommendations — MS-16.3 (Command Box Engenharia)
-- ═══════════════════════════════════════════════════════════
-- Sugestões de ajuste derivadas de Findings (0020). Diferente de
-- findings, recommendations TÊM ciclo de vida (decisão humana). Campos
-- mutáveis: `decisao`, `decisao_em`, `decisao_por`, `payload_editado`.
--
-- Mesma estrutura conceitual do AdvisorSuggestion (Dexie web-legado)
-- mas em Postgres canônico. RLS por time + UPDATE permitido a membros
-- (D17 fechada — chefe + engenheiro + piloto editam/aprovam).
--
-- Refinamento de papéis (D8) fica em PR futuro via helper RPC
-- `is_chefe_equipe()` já existente (migration 0014).
--
-- ATENÇÃO: este arquivo está versionado mas NÃO foi aplicado em prod.
-- O Flávio roda `supabase db push` manualmente após o merge do PR.

create type public.recommendation_decisao as enum
  ('pendente', 'aprovada', 'editada', 'rejeitada');

create type public.finding_risco as enum ('alto', 'medio', 'baixo');

create table public.engineering_recommendations (
  id              text primary key,                 -- "rec-{uuid8}"
  time_id         uuid not null references public.times(id) on delete cascade,
  sessao_id       uuid not null references public.sessoes(id) on delete cascade,
  finding_ids     text[] not null default '{}',     -- referência a engineering_findings.id
  rule_id         text not null,
  titulo          text not null,
  racional        text not null,
  prioridade      text not null,
  ajustes         jsonb not null default '[]'::jsonb,
  nao_mexer       jsonb not null default '[]'::jsonb,
  como_validar    text not null,
  evidencia       jsonb not null default '[]'::jsonb,
  confianca       public.finding_confianca not null,
  risco           public.finding_risco not null,
  decisao         public.recommendation_decisao not null default 'pendente',
  decisao_em      timestamptz,
  decisao_por     uuid references auth.users(id) on delete set null,
  payload_editado jsonb,
  meta            jsonb,
  t               bigint not null,
  t_mono          double precision,
  criado_em       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_engineering_recommendations_upd
  before update on public.engineering_recommendations
  for each row execute function public.set_updated_at();

create index on public.engineering_recommendations (sessao_id, criado_em desc);
create index on public.engineering_recommendations (rule_id);
create index on public.engineering_recommendations (decisao);
create index on public.engineering_recommendations (time_id);

-- ─── RLS ─────────────────────────────────────────────────────
-- Insert + select + update por membro do time. DELETE bloqueado (sem policy).
-- Permissão fina de quem pode aprovar (D8) entra em PR futuro via
-- helper is_chefe_equipe() restringindo o UPDATE de `decisao`.
alter table public.engineering_recommendations enable row level security;

create policy engineering_recommendations_select on public.engineering_recommendations for select
  using (public.is_member(time_id));

create policy engineering_recommendations_insert on public.engineering_recommendations for insert
  with check (public.is_member(time_id));

create policy engineering_recommendations_update on public.engineering_recommendations for update
  using (public.is_member(time_id)) with check (public.is_member(time_id));
