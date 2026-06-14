-- ═══════════════════════════════════════════════════════════
-- 0020_engineering_findings — MS-16.3 (Command Box Engenharia)
-- ═══════════════════════════════════════════════════════════
-- Camada 2 (Calibration Engine) emite achados determinísticos sobre
-- o VehicleContextAggregator (MS-16.2). Cada finding é insert-only
-- (append-only, padrão ADR-014 igual telemetry_samples_enriched).
--
-- Workspace isolation por time_id + RLS por membro (paridade com
-- segment_executions / telemetry_samples / mensagens).
--
-- Estrutura cobre os 3 rules do MVP D6 (fuel-lean-sustained-load,
-- water-temp-drift-no-cooling, vmin-progressive-loss-segment) e
-- estende fácil pra rules futuras — payload jsonb livre.
--
-- ATENÇÃO: este arquivo está versionado mas NÃO foi aplicado em prod.
-- O Flávio roda `supabase db push` manualmente após o merge do PR.

create type public.finding_severidade as enum ('info', 'atencao', 'alta');
create type public.finding_confianca as enum ('Alta', 'Média', 'Baixa');
create type public.finding_escopo as enum ('stint', 'lap', 'segment', 'cell');

create table public.engineering_findings (
  id             text primary key,                  -- "fin-{uuid8}"
  time_id        uuid not null references public.times(id) on delete cascade,
  sessao_id      uuid not null references public.sessoes(id) on delete cascade,
  rule_id        text not null,                     -- ex: 'fuel-lean-sustained-load'
  severidade     public.finding_severidade not null,
  titulo         text not null,
  descricao      text not null,
  escopo         public.finding_escopo not null,
  segment_id     uuid references public.track_segments(id) on delete set null,
  lap_numero     integer,
  evidencia      jsonb not null default '{}'::jsonb,        -- metric → value
  evidencia_texto jsonb not null default '[]'::jsonb,        -- string[]
  confianca      public.finding_confianca not null,
  t              bigint not null,                  -- Date.now() do dispositivo
  t_mono         double precision,                 -- relógio monotônico
  criado_em      timestamptz not null default now()
);
create index on public.engineering_findings (sessao_id, criado_em desc);
create index on public.engineering_findings (rule_id);
create index on public.engineering_findings (segment_id) where segment_id is not null;
create index on public.engineering_findings (time_id);

-- ─── RLS ─────────────────────────────────────────────────────
-- Append-only: select por membro, insert por membro. UPDATE/DELETE
-- bloqueados por default (sem policy = bloqueado em RLS habilitada).
alter table public.engineering_findings enable row level security;

create policy engineering_findings_select on public.engineering_findings for select
  using (public.is_member(time_id));

create policy engineering_findings_insert on public.engineering_findings for insert
  with check (public.is_member(time_id));
