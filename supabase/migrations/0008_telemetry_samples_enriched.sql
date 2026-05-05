-- ═══════════════════════════════════════════════════════════
-- 0008_telemetry_samples_enriched — MS-2.7 PR B (PLANO_FASE_1)
-- ═══════════════════════════════════════════════════════════
-- Espelho Postgres do GRDB `v7_telemetry_samples_enriched`
-- (ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift).
--
-- Persiste a saída do KalmanINSGPS (MS-2.7 PR A, mergeada em #99) por
-- sample. Estado 2D em frame local + heading compass + posSigma + flag
-- sourceKalman (false antes do primeiro fix).
--
-- Append-only (ADR-014): NUNCA editada após insert. Sync remoto será
-- por batch quando existir, NÃO row a row (volume proibitivo: 36k
-- rows/sessão a 10 Hz). Mesmo padrão de telemetry_samples.
--
-- Schema-only nesta rodada — escrita real chega no MS-2.7 PR C
-- (LiveKalmanProcessor em p1fast-ios consumindo o stream do
-- LiveTelemetryRecorder).
--
-- ATENÇÃO: este arquivo está versionado mas NÃO foi aplicado em prod.
-- O Flávio roda `supabase db push` manualmente após o merge do PR.

create table public.telemetry_samples_enriched (
  id            bigserial primary key,
  time_id       uuid not null references public.times(id) on delete cascade,
  sessao_id     uuid not null references public.sessoes(id) on delete cascade,
  seq           int not null,
  t             bigint not null,                     -- Date.now() do device
  t_mono        double precision,                    -- performance.now (ADR-015)
  x_m           double precision not null,           -- frame local, +x = leste
  y_m           double precision not null,           -- frame local, +y = norte
  vx_mps        double precision not null,
  vy_mps        double precision not null,
  heading_deg   double precision not null,           -- compass [0, 360)
  pos_sigma_m   double precision not null,
  source_kalman boolean not null,                    -- false antes do 1º fix
  uploaded_at   timestamptz default now()
);
create index on public.telemetry_samples_enriched (sessao_id, seq);
create index on public.telemetry_samples_enriched (sessao_id, t);

-- RLS: insert por membro, select por membro, NUNCA update/delete.
-- Mesmo padrão de telemetry_samples (0001_initial.sql).
alter table public.telemetry_samples_enriched enable row level security;

create policy telemetry_samples_enriched_select on public.telemetry_samples_enriched for select
  using (public.is_member(time_id));
create policy telemetry_samples_enriched_insert on public.telemetry_samples_enriched for insert
  with check (public.is_member(time_id));
-- NB: sem policy de UPDATE/DELETE = bloqueado por default (append-only, ADR-004).
