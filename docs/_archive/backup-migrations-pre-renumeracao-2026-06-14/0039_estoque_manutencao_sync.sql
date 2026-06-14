-- ═══════════════════════════════════════════════════════════
-- 0039_estoque_manutencao_sync — tabelas de Estoque (peças) e
--                                 Manutenção na nuvem, pra sincronizar.
-- ═══════════════════════════════════════════════════════════
-- Espelha o esquema local do app (GRDB) e o padrão de `carros`:
-- id uuid, time_id uuid (RLS via public.is_member), timestamptz nos
-- campos *_at. Campos de tempo em ms-epoch que NÃO terminam em _at
-- (ocorrido_em, validade_etiqueta) ficam como bigint — a Edge Function
-- `sync` só converte colunas *_at / data_* / nascimento; as demais
-- passam o inteiro do app direto.
--
-- App envia ids no formato uuid (UUID().uuidString.lowercased()).
-- Idempotente: create table if not exists + drop/create de policy/trigger.
-- NÃO aplicar manualmente — Flávio autoriza e aplica.

begin;

-- ── 1. pecas_locais (Box / Caminhão / Oficina, cadastráveis) ──
create table if not exists public.pecas_locais (
  id          uuid primary key default gen_random_uuid(),
  time_id     uuid not null references public.times(id) on delete cascade,
  nome        text not null,
  descricao   text,
  ordem       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_pecas_locais_time on public.pecas_locais (time_id);

-- ── 2. pecas (banco único de peças, uma por carro) ────────────
create table if not exists public.pecas (
  id                    uuid primary key default gen_random_uuid(),
  time_id               uuid not null references public.times(id) on delete cascade,
  carro_id              uuid not null references public.carros(id) on delete cascade,
  nome                  text not null,
  codigo                text,
  area                  text not null,
  tipo                  text not null default 'componente',
  especificacao         text,
  foto_url              text,
  quantidade            integer not null default 0,
  local_id              uuid references public.pecas_locais(id) on delete set null,
  observacoes           text,
  preco_unitario_cents  bigint,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_pecas_time on public.pecas (time_id);
create index if not exists idx_pecas_carro on public.pecas (carro_id);

-- ── 3. pecas_movimentacoes (histórico −1/+1, append-only) ─────
create table if not exists public.pecas_movimentacoes (
  id           uuid primary key default gen_random_uuid(),
  time_id      uuid not null references public.times(id) on delete cascade,
  peca_id      uuid not null references public.pecas(id) on delete cascade,
  delta        integer not null,
  observacao   text,
  ocorrido_em  bigint not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_pecas_mov_peca on public.pecas_movimentacoes (peca_id);

-- ── 4. manutencoes (trocas/checagens dos consumíveis) ─────────
create table if not exists public.manutencoes (
  id                 uuid primary key default gen_random_uuid(),
  time_id            uuid not null references public.times(id) on delete cascade,
  carro_id           uuid not null references public.carros(id) on delete cascade,
  item_codigo        text not null,
  ocorrido_em        bigint not null,
  marca              text,
  modelo             text,
  especificacao      text,
  observacao         text,
  foto_url           text,
  validade_etiqueta  bigint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_manutencoes_carro_item on public.manutencoes (carro_id, item_codigo);

-- ── 5. updated_at respeitando cliente (mesmo set_updated_at de carros) ──
drop trigger if exists trg_pecas_locais_upd on public.pecas_locais;
create trigger trg_pecas_locais_upd before update on public.pecas_locais
  for each row execute function public.set_updated_at();
drop trigger if exists trg_pecas_upd on public.pecas;
create trigger trg_pecas_upd before update on public.pecas
  for each row execute function public.set_updated_at();
drop trigger if exists trg_manutencoes_upd on public.manutencoes;
create trigger trg_manutencoes_upd before update on public.manutencoes
  for each row execute function public.set_updated_at();

-- ── 6. RLS por time (idêntico ao padrão carros) ───────────────
alter table public.pecas_locais         enable row level security;
alter table public.pecas                enable row level security;
alter table public.pecas_movimentacoes  enable row level security;
alter table public.manutencoes          enable row level security;

drop policy if exists pecas_locais_all on public.pecas_locais;
create policy pecas_locais_all on public.pecas_locais for all
  using (public.is_member(time_id)) with check (public.is_member(time_id));

drop policy if exists pecas_all on public.pecas;
create policy pecas_all on public.pecas for all
  using (public.is_member(time_id)) with check (public.is_member(time_id));

drop policy if exists pecas_movimentacoes_all on public.pecas_movimentacoes;
create policy pecas_movimentacoes_all on public.pecas_movimentacoes for all
  using (public.is_member(time_id)) with check (public.is_member(time_id));

drop policy if exists manutencoes_all on public.manutencoes;
create policy manutencoes_all on public.manutencoes for all
  using (public.is_member(time_id)) with check (public.is_member(time_id));

commit;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (se necessário)
-- ═══════════════════════════════════════════════════════════
-- begin;
--   drop table if exists public.pecas_movimentacoes;
--   drop table if exists public.manutencoes;
--   drop table if exists public.pecas;
--   drop table if exists public.pecas_locais;
-- commit;
