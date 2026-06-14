-- ═══════════════════════════════════════════════════════════
-- 0014_carros_gears_dyno — MS-9.6 (cadastro por carro)
-- ═══════════════════════════════════════════════════════════
-- Tabelas que personalizam o pipeline T4000 por carro:
--   - carros           — cadastro do carro do time (Celta 1, Celta 2, etc.)
--   - gear_ratios      — relação de cada marcha (1ª, 2ª, ..., 6ª)
--   - dyno_curve       — curva torque×rpm e potência×rpm do dinamômetro
--   - gear_signatures  — assinaturas observadas no campo (mapeia rpm/speed → marcha)
--
-- Por que separar:
--   - O shift light precisa do redline + curva real pra acender
--     onde a potência cai (não no número plotado pelo fabricante).
--   - O detector de marcha real usa razão (rpm × velocidade) por
--     marcha pra inferir a marcha quando a central não exporta isso
--     direito (fallback).
--   - A curva de dyno alimenta o cálculo de "qual rpm trocar"
--     (MS-8.3 DynoTargetCalculator) e a "qual marcha é ideal aqui"
--     (MS-9 análise).
--
-- Esta migration NÃO sobe automaticamente em prod — Flávio roda
-- `supabase db push` quando aprovar. Idempotente (todas as criações
-- usam IF NOT EXISTS).
--
-- Dependências externas: nenhuma — só auth.users (já existe).

-- ── carros ────────────────────────────────────────────────────

create table if not exists public.carros (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null,
  apelido         text not null,                              -- "Celta 1", "Subaru pista"
  marca           text,
  modelo          text,
  ano             integer,
  redline_rpm     integer not null check (redline_rpm between 1000 and 15000),
  shift_fire_pct  numeric(4,3) not null default 0.95
                  check (shift_fire_pct between 0.5 and 1.0),    -- % do redline pra disparar fire
  shift_lit_pct   numeric(4,3) not null default 0.50
                  check (shift_lit_pct between 0.0 and 1.0),     -- % do redline pra começar a acender LEDs
  observacao      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,                                -- soft delete (padrão do projeto)
  constraint carros_lit_lt_fire check (shift_lit_pct < shift_fire_pct)
);

create index if not exists carros_team_id_idx on public.carros (team_id) where deleted_at is null;

-- ── gear_ratios ───────────────────────────────────────────────
-- Uma linha por marcha. Exemplo Celta:
--   marcha=1, ratio=3.55, primario=1.0, final=4.27
-- Razão composta = ratio × primario × final.

create table if not exists public.gear_ratios (
  id          uuid primary key default gen_random_uuid(),
  carro_id    uuid not null references public.carros(id) on delete cascade,
  marcha      smallint not null check (marcha between 1 and 8),
  ratio       numeric(8,4) not null check (ratio > 0),       -- razão da marcha (ex.: 3.55)
  primario    numeric(8,4) not null default 1.0 check (primario > 0),
  final_drive numeric(8,4) not null default 1.0 check (final_drive > 0),
  diametro_pneu_mm integer check (diametro_pneu_mm > 0),     -- pra converter em km/h
  created_at  timestamptz not null default now(),
  unique (carro_id, marcha)
);

create index if not exists gear_ratios_carro_id_idx on public.gear_ratios (carro_id);

-- ── dyno_curve ────────────────────────────────────────────────
-- Pontos (rpm, torque_nm, potencia_cv) lidos do gráfico do dinamômetro.
-- Espaçamento típico: a cada 500 rpm. Interpolação linear no app.

create table if not exists public.dyno_curve (
  id             uuid primary key default gen_random_uuid(),
  carro_id       uuid not null references public.carros(id) on delete cascade,
  rpm            integer not null check (rpm between 500 and 15000),
  torque_nm      numeric(7,2) check (torque_nm >= 0),
  potencia_cv    numeric(7,2) check (potencia_cv >= 0),
  fonte          text,                                       -- "Dynojet X", "Mustang Y", "estimado"
  data_medicao   date,
  created_at     timestamptz not null default now(),
  unique (carro_id, rpm)
);

create index if not exists dyno_curve_carro_id_idx on public.dyno_curve (carro_id);

-- ── gear_signatures ───────────────────────────────────────────
-- Assinaturas observadas no campo: par (rpm, velocidade) por marcha.
-- Usadas pelo detector de marcha (fallback quando central não exporta).
-- Append-only — cada observação vira uma linha; o app agrega por marcha.

create table if not exists public.gear_signatures (
  id             uuid primary key default gen_random_uuid(),
  carro_id       uuid not null references public.carros(id) on delete cascade,
  marcha         smallint not null check (marcha between 1 and 8),
  rpm            integer not null check (rpm between 500 and 15000),
  speed_kmh      numeric(6,2) not null check (speed_kmh >= 0),
  confianca      numeric(4,3) check (confianca between 0 and 1),
  observed_at    timestamptz not null default now(),
  observed_during text                                        -- stint_id ou "manual"
);

create index if not exists gear_signatures_carro_marcha_idx on public.gear_signatures (carro_id, marcha);

-- ── updated_at trigger ───────────────────────────────────────
-- Mantém updated_at em sincronia com mudanças no carros.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  if new.updated_at = old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'carros_set_updated_at'
  ) then
    create trigger carros_set_updated_at
      before update on public.carros
      for each row execute procedure public.set_updated_at();
  end if;
end $$;

-- ── comentários nas colunas (autodocumentação no SQL editor) ──

comment on table public.carros is
  'Cadastro de carros do time. shift_lit_pct/shift_fire_pct calibram o shift light por carro.';
comment on table public.gear_ratios is
  'Relação de marcha por carro (1ª..6ª). Usado pelo detector de marcha e cálculo de rpm-alvo.';
comment on table public.dyno_curve is
  'Curva torque×rpm do dinamômetro. Pontos espaçados a cada 500rpm; app interpola linear.';
comment on table public.gear_signatures is
  'Assinaturas (rpm, velocidade) → marcha observadas em campo. Fallback do detector quando central T4000 não exporta marcha confiável.';
