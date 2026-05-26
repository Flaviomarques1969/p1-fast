-- ═══════════════════════════════════════════════════════════
-- 0024_iphone_sync_compat — alinhar esquema da nuvem com o do iPhone.
-- Resolve 74 itens dead-letter da sync_queue (73 pendências + 1 evento)
-- + destrava 104.670 medições de telemetria que dependem do evento subir.
-- ═══════════════════════════════════════════════════════════
-- Origem da divergência: app envia (a) data_fim opcional em eventos,
-- (b) template_id TEXT em evento_pendencias (códigos "pt-g{N}-{M}"),
-- (c) coluna quantidade em evento_pendencias.
-- Produção tinha: data_fim NOT NULL, template_id UUID, sem quantidade.
-- Auditado 2026-05-26: pendencias_template + evento_pendencias VAZIAS em
-- produção (0 registros). Logo, recriar é seguro — zero perda de dados.

begin;

-- ── 1. eventos.data_fim vira opcional ─────────────────────
alter table public.eventos alter column data_fim drop not null;

-- ── 2. Recriar evento_pendencias e pendencias_template com chave TEXT ──
drop table if exists public.evento_pendencias cascade;
drop table if exists public.pendencias_template cascade;

create table public.pendencias_template (
  id            text primary key,        -- antes uuid; agora "pt-g{N}-{M}"
  grupo_id      text not null,
  grupo_titulo  text not null,
  grupo_num     text not null,
  titulo        text not null,
  observacao    text,
  obrigatorio   boolean not null default false,
  ordem         integer not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  eh_consumivel boolean not null default false,  -- novo (espelha iPhone)
  unidade       text                              -- novo (espelha iPhone)
);
create trigger trg_pendencias_template_upd before update on public.pendencias_template
  for each row execute function public.set_updated_at();
create index on public.pendencias_template (grupo_id, ordem);

create table public.evento_pendencias (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references public.eventos(id) on delete cascade,
  template_id  text not null references public.pendencias_template(id) on delete cascade,  -- antes uuid
  checado      boolean not null default false,
  checado_at   timestamptz,
  nota         text,
  quantidade   real,                              -- novo (espelha iPhone)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_evento_pendencias_upd before update on public.evento_pendencias
  for each row execute function public.set_updated_at();
create index on public.evento_pendencias (evento_id);
create unique index idx_evento_pendencias_unique
  on public.evento_pendencias (evento_id, template_id);

-- ── 3. RLS (mesmas regras de 0005_pendencias.sql) ─────────
alter table public.pendencias_template enable row level security;
alter table public.evento_pendencias enable row level security;

create policy pendencias_template_public_read on public.pendencias_template
  for select using (true);

create policy evento_pendencias_select on public.evento_pendencias for select
  using (
    exists (
      select 1 from public.eventos e
      where e.id = evento_pendencias.evento_id
        and public.is_member(e.time_id)
    )
  );
create policy evento_pendencias_write on public.evento_pendencias for all
  using (
    exists (
      select 1 from public.eventos e
      where e.id = evento_pendencias.evento_id
        and public.is_member(e.time_id)
    )
  )
  with check (
    exists (
      select 1 from public.eventos e
      where e.id = evento_pendencias.evento_id
        and public.is_member(e.time_id)
    )
  );

commit;
