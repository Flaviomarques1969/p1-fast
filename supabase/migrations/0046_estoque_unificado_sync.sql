-- ═══════════════════════════════════════════════════════════
-- 0046_estoque_unificado_sync — Estoque UNIFICADO na nuvem.
-- ═══════════════════════════════════════════════════════════
-- Decisão de Flávio 2026-06-14 ("um só, com backup na nuvem"). Cria a
-- tabela `estoque_item`, que unifica o estoque geral + o estoque de cada
-- carro (escopo = 'geral' ou o carro_id, em texto). Espelha o esquema local
-- do app (GRDB, migrations v30/v31) e segue o padrão de `pecas` (0039):
-- id uuid, time_id uuid (RLS via public.is_member), timestamptz nos *_at.
--
-- `synced_at` é metadado SÓ-local (marca o que já subiu) — NÃO existe aqui,
-- igual a `pecas`; a Edge Function `sync` ignora colunas que a tabela não tem.
-- Campos de medida que não são *_at (volume, embalagens, quantidade) passam
-- o valor do app direto.
--
-- App envia ids no formato uuid (UUID().uuidString.lowercased()).
-- Idempotente: create table if not exists + drop/create de policy/trigger.
-- NÃO aplicar manualmente — Flávio autoriza e aplica.

begin;

create table if not exists public.estoque_item (
  id             uuid primary key default gen_random_uuid(),
  time_id        uuid not null references public.times(id) on delete cascade,
  escopo         text not null default 'geral',   -- 'geral' ou o carro_id (texto)
  kind           text not null default 'item',    -- 'item' | 'ferramenta'
  grupo_id       text not null,
  grupo_titulo   text not null,
  grupo_num      text not null,
  nome           text not null,
  especificacao  text,
  categoria      text not null default 'obrig',   -- 'obrig' | 'desej'
  contagem       text not null default 'simples', -- 'simples' | 'embalagem' | 'conjunto'
  quantidade     integer not null default 1,
  volume         double precision,
  unidade        text,
  embalagens     integer,
  partes_json    text,
  foto_url       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_estoque_item_time on public.estoque_item (time_id);
create index if not exists idx_estoque_item_escopo on public.estoque_item (time_id, escopo);

-- updated_at respeitando o cliente (mesmo set_updated_at de carros/pecas).
drop trigger if exists trg_estoque_item_upd on public.estoque_item;
create trigger trg_estoque_item_upd before update on public.estoque_item
  for each row execute function public.set_updated_at();

-- RLS por time (idêntico ao padrão pecas).
alter table public.estoque_item enable row level security;
drop policy if exists estoque_item_all on public.estoque_item;
create policy estoque_item_all on public.estoque_item for all
  using (public.is_member(time_id)) with check (public.is_member(time_id));

commit;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (se necessário)
-- ═══════════════════════════════════════════════════════════
-- begin;
--   drop table if exists public.estoque_item;
-- commit;
