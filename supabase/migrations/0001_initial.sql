-- ═══════════════════════════════════════════════════════════
-- 0001_initial — schema P1 Fast (espelho do Dexie v13)
-- ═══════════════════════════════════════════════════════════
-- Workspace aberto por TIME (uma "garagem" colaborativa). Toda row
-- pertence a um time_id; RLS garante que só membros do time veem.
-- Espelha o schema Dexie v13 (src/core/db.js + src/data/schemas.js).
--
-- Convenção:
--   • IDs uuid com gen_random_uuid()
--   • created_at/updated_at via trigger genérico
--   • RLS habilitada em TODAS as tabelas
--   • Política padrão: row visível se auth.uid() pertence ao time_id da row
--
-- IMPORTANTE: este projeto Supabase é ISOLADO do CDAI (Imunoterapia).
-- Ver docs/SUPABASE_SETUP.md.

-- ─── Extensões ────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Helper: trigger updated_at ───────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Times (workspace) + membros ─────────────────────────
-- O time é a unidade de isolamento. 1 time pode ter N usuários.
create table public.times (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  criado_por  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_times_upd before update on public.times
  for each row execute function public.set_updated_at();

-- usuarios_time = junction (user × time, com role)
create table public.usuarios_time (
  user_id     uuid references auth.users(id) on delete cascade,
  time_id     uuid references public.times(id) on delete cascade,
  role        text not null default 'membro' check (role in ('admin','membro')),
  created_at  timestamptz not null default now(),
  primary key (user_id, time_id)
);

-- Helper: usuário é admin do time?
create or replace function auth.is_admin(p_time_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.usuarios_time
    where user_id = auth.uid() and time_id = p_time_id and role = 'admin'
  );
$$;

-- Helper: usuário é membro do time?
create or replace function auth.is_member(p_time_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.usuarios_time
    where user_id = auth.uid() and time_id = p_time_id
  );
$$;

-- ─── Pista (3 camadas: track → layout → segment) ─────────
-- Pistas são GLOBAIS (não pertencem a time) — Brasília/Interlagos/etc.
-- Layouts e segmentos também globais; cada time pode ter override próprio
-- via configuracoes mais tarde se necessário.
create table public.tracks (
  id          uuid primary key default gen_random_uuid(),
  apelido     text not null,
  nome_oficial text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_tracks_upd before update on public.tracks
  for each row execute function public.set_updated_at();

create table public.track_layouts (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid not null references public.tracks(id) on delete cascade,
  nome        text not null,
  parciais    jsonb,                                  -- N parciais por layout (ex: Brasília=4)
  svg_path    text,
  linha_chegada jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_track_layouts_upd before update on public.track_layouts
  for each row execute function public.set_updated_at();
create index on public.track_layouts (track_id);

create table public.track_segments (
  id          uuid primary key default gen_random_uuid(),
  layout_id   uuid not null references public.track_layouts(id) on delete cascade,
  parcial_id  text,
  ordem       int not null,
  eh_trecho   boolean not null default true,         -- true = curva; false = reta
  nome        text,
  geometria   jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_track_segments_upd before update on public.track_segments
  for each row execute function public.set_updated_at();
create index on public.track_segments (layout_id);
create index on public.track_segments (layout_id, ordem);

-- Marcos = pontos de evento (largada, chegada, pit-in, pit-out, etc.)
-- Tabela nova v13 (ghost-map). Pertence ao layout (global).
create table public.marcos (
  id          uuid primary key default gen_random_uuid(),
  layout_id   uuid not null references public.track_layouts(id) on delete cascade,
  tipo        text not null check (tipo in ('largada','chegada','pit-in','pit-out','sinalizacao','box')),
  posicao     jsonb not null,
  label       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_marcos_upd before update on public.marcos
  for each row execute function public.set_updated_at();
create index on public.marcos (layout_id);
create index on public.marcos (tipo);

-- Retas especiais = segmentos marcados como reta "rápida" pra ghost-map.
-- Tabela separada (ADR-019): segmento é geometria; reta especial é semântica
-- + metadados aprendidos. Pode pertencer a um time (auto-detectada do pipeline)
-- ou ser global (curadoria oficial). time_id NULL = global.
create table public.retas_especiais (
  id              uuid primary key default gen_random_uuid(),
  time_id         uuid references public.times(id) on delete cascade,
  track_id        uuid not null references public.tracks(id) on delete cascade,
  segment_id      uuid not null references public.track_segments(id) on delete cascade,
  tempo_medio_ms  integer,
  auto_detectada  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_retas_especiais_upd before update on public.retas_especiais
  for each row execute function public.set_updated_at();
create index on public.retas_especiais (track_id);
create index on public.retas_especiais (segment_id);

-- ─── Garagem do time: carros, configs, pneus, combustíveis ──
create table public.carros (
  id                 uuid primary key default gen_random_uuid(),
  time_id            uuid not null references public.times(id) on delete cascade,
  apelido            text not null,
  modelo             text,
  categoria          text,
  cor                text,
  fonte_temperatura  text not null default 'motor' check (fonte_temperatura in ('motor','pneu','ambos')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_carros_upd before update on public.carros
  for each row execute function public.set_updated_at();
create index on public.carros (time_id);

create table public.configuracoes (
  id                       uuid primary key default gen_random_uuid(),
  time_id                  uuid not null references public.times(id) on delete cascade,
  carro_id                 uuid not null references public.carros(id) on delete cascade,
  nome                     text,
  data_aplicacao           timestamptz,
  overrides                jsonb,
  temperatura_ideal_range  jsonb,                    -- {motor:{min,max}, pneu:{min,max}}
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger trg_configuracoes_upd before update on public.configuracoes
  for each row execute function public.set_updated_at();
create index on public.configuracoes (carro_id);
create index on public.configuracoes (time_id);

create table public.pilotos (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  nome        text not null,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_pilotos_upd before update on public.pilotos
  for each row execute function public.set_updated_at();
create index on public.pilotos (time_id);

create table public.passageiros (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  nome        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_passageiros_upd before update on public.passageiros
  for each row execute function public.set_updated_at();
create index on public.passageiros (time_id);

create table public.pneus (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  carro_id    uuid not null references public.carros(id) on delete cascade,
  marca       text,
  modelo      text,
  medida      text,
  composto    text,
  ciclos      int default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_pneus_upd before update on public.pneus
  for each row execute function public.set_updated_at();
create index on public.pneus (carro_id);
create index on public.pneus (time_id);

create table public.combustiveis (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  nome        text not null,
  tipo        text,
  octanagem   numeric,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_combustiveis_upd before update on public.combustiveis
  for each row execute function public.set_updated_at();
create index on public.combustiveis (time_id);

-- ─── Eventos / sessões / stints / voltas ─────────────────
create table public.eventos (
  id              uuid primary key default gen_random_uuid(),
  time_id         uuid not null references public.times(id) on delete cascade,
  track_id        uuid references public.tracks(id) on delete set null,
  tipo            text,
  data_evento     date not null,
  status          text default 'planejado',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_eventos_upd before update on public.eventos
  for each row execute function public.set_updated_at();
create index on public.eventos (time_id);
create index on public.eventos (data_evento);

-- sessoes = "stint" no vocabulário antigo. Mantemos os dois nomes
-- (sessoes é a tabela; stints é a view conceitual). voltas_planejadas
-- é o campo novo do ghost-map.
create table public.sessoes (
  id                  uuid primary key default gen_random_uuid(),
  time_id             uuid not null references public.times(id) on delete cascade,
  evento_id           uuid references public.eventos(id) on delete set null,
  carro_id            uuid references public.carros(id) on delete set null,
  piloto_id           uuid references public.pilotos(id) on delete set null,
  configuracao_id     uuid references public.configuracoes(id) on delete set null,
  status              text default 'planejada',
  data_inicio         timestamptz,
  data_fim            timestamptz,
  voltas_planejadas   integer check (voltas_planejadas is null or voltas_planejadas >= 1),
  objetivo            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_sessoes_upd before update on public.sessoes
  for each row execute function public.set_updated_at();
create index on public.sessoes (time_id);
create index on public.sessoes (evento_id);
create index on public.sessoes (carro_id);

create table public.voltas (
  id                  uuid primary key default gen_random_uuid(),
  time_id             uuid not null references public.times(id) on delete cascade,
  sessao_id           uuid not null references public.sessoes(id) on delete cascade,
  numero              int not null,
  tempo_ms            integer,
  tempos_por_parcial  jsonb,
  valida              boolean default true,
  motivo_invalidacao  text,
  inicio_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_voltas_upd before update on public.voltas
  for each row execute function public.set_updated_at();
create index on public.voltas (sessao_id);
create index on public.voltas (sessao_id, numero);

create table public.segment_executions (
  id              uuid primary key default gen_random_uuid(),
  time_id         uuid not null references public.times(id) on delete cascade,
  sessao_id       uuid not null references public.sessoes(id) on delete cascade,
  volta_id        uuid not null references public.voltas(id) on delete cascade,
  segment_id      uuid references public.track_segments(id) on delete set null,
  tempo_ms        integer,
  velocidade_max  numeric,
  created_at      timestamptz not null default now()
);
create index on public.segment_executions (sessao_id);
create index on public.segment_executions (volta_id);

-- ─── Telemetria append-only (ADR-014) ────────────────────
-- Append-only: NUNCA editada após insert. Sync remoto será por batch
-- quando existir, NÃO row a row (volume proibitivo: 36k rows/sessão a 10 Hz).
create table public.telemetry_samples (
  id            bigserial primary key,
  time_id       uuid not null references public.times(id) on delete cascade,
  sessao_id     uuid not null references public.sessoes(id) on delete cascade,
  seq           int not null,
  t             bigint not null,                     -- Date.now() do device
  t_mono        double precision,                    -- performance.now() (ADR-015)
  payload       jsonb not null,                      -- shape canônico mobile-telemetry.js
  uploaded_at   timestamptz default now()
);
create index on public.telemetry_samples (sessao_id, seq);
create index on public.telemetry_samples (sessao_id, t);

-- ─── Mensagens (Coach + sistema) ─────────────────────────
-- Filtragem cliente-side via visivel_no_box além do RLS.
create table public.mensagens (
  id              uuid primary key default gen_random_uuid(),
  time_id         uuid not null references public.times(id) on delete cascade,
  sessao_id       uuid references public.sessoes(id) on delete cascade,
  tipo            text not null,                     -- coach, sistema, alerta
  origem          text,
  texto           text not null,
  visivel_no_box  boolean not null default true,
  enviada_em      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index on public.mensagens (sessao_id);
create index on public.mensagens (time_id, enviada_em desc);

-- ─── Troféus (gamificação) ───────────────────────────────
create table public.trofeus_ganhos (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  piloto_id   uuid not null references public.pilotos(id) on delete cascade,
  sessao_id   uuid references public.sessoes(id) on delete set null,
  trofeu_id   text not null,                         -- enum no domínio
  ganho_em    timestamptz not null default now(),
  metadados   jsonb,
  created_at  timestamptz not null default now()
);
create index on public.trofeus_ganhos (piloto_id);
create index on public.trofeus_ganhos (time_id);

-- ═══════════════════════════════════════════════════════════
-- RLS — habilitada em TODAS as tabelas
-- ═══════════════════════════════════════════════════════════

alter table public.times              enable row level security;
alter table public.usuarios_time      enable row level security;
alter table public.tracks             enable row level security;
alter table public.track_layouts      enable row level security;
alter table public.track_segments     enable row level security;
alter table public.marcos             enable row level security;
alter table public.retas_especiais    enable row level security;
alter table public.carros             enable row level security;
alter table public.configuracoes      enable row level security;
alter table public.pilotos            enable row level security;
alter table public.passageiros        enable row level security;
alter table public.pneus              enable row level security;
alter table public.combustiveis       enable row level security;
alter table public.eventos            enable row level security;
alter table public.sessoes            enable row level security;
alter table public.voltas             enable row level security;
alter table public.segment_executions enable row level security;
alter table public.telemetry_samples  enable row level security;
alter table public.mensagens          enable row level security;
alter table public.trofeus_ganhos     enable row level security;

-- ─── Políticas: workspace por time ──────────────────────
-- Padrão: row visível/editável se auth.uid() é membro do time_id da row.

-- times: vê só os times dos quais é membro; admin pode editar
create policy times_select on public.times for select
  using (auth.is_member(id));
create policy times_update on public.times for update
  using (auth.is_admin(id));

-- usuarios_time: vê membros dos times dos quais é membro
create policy usuarios_time_select on public.usuarios_time for select
  using (auth.is_member(time_id));
create policy usuarios_time_admin_write on public.usuarios_time for all
  using (auth.is_admin(time_id))
  with check (auth.is_admin(time_id));

-- Tracks/layouts/segments/marcos = globais (todos veem; só superuser via service_role muta).
create policy tracks_public_read on public.tracks for select using (true);
create policy track_layouts_public_read on public.track_layouts for select using (true);
create policy track_segments_public_read on public.track_segments for select using (true);
create policy marcos_public_read on public.marcos for select using (true);

-- retas_especiais: globais (time_id null) ou do time
create policy retas_especiais_select on public.retas_especiais for select
  using (time_id is null or auth.is_member(time_id));
create policy retas_especiais_write on public.retas_especiais for all
  using (time_id is not null and auth.is_member(time_id))
  with check (time_id is not null and auth.is_member(time_id));

-- Garagem por time
create policy carros_all on public.carros for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));
create policy configuracoes_all on public.configuracoes for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));
create policy pilotos_all on public.pilotos for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));
create policy passageiros_all on public.passageiros for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));
create policy pneus_all on public.pneus for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));
create policy combustiveis_all on public.combustiveis for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));

-- Eventos / sessões / voltas / executions
create policy eventos_all on public.eventos for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));
create policy sessoes_all on public.sessoes for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));
create policy voltas_all on public.voltas for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));
create policy segment_executions_all on public.segment_executions for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));

-- Telemetria: insert por membro, select por membro, NUNCA update/delete
create policy telemetry_samples_select on public.telemetry_samples for select
  using (auth.is_member(time_id));
create policy telemetry_samples_insert on public.telemetry_samples for insert
  with check (auth.is_member(time_id));
-- NB: sem policy de UPDATE/DELETE = bloqueado por default (append-only, ADR-004).

-- Mensagens: além do RLS, app filtra por visivel_no_box no client.
create policy mensagens_all on public.mensagens for all
  using (auth.is_member(time_id)) with check (auth.is_member(time_id));

-- Troféus: leitura geral pelos membros, write só pelo backend (service_role)
create policy trofeus_select on public.trofeus_ganhos for select
  using (auth.is_member(time_id));
