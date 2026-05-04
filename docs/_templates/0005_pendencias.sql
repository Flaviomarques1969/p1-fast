-- ═══════════════════════════════════════════════════════════
-- 0005_pendencias — templates de checklist + instâncias por evento
-- (Sprint 1A.5 / Prompt #21)
-- ═══════════════════════════════════════════════════════════
-- TEMPLATE PRÉ-BAKED. Cloud Code do prompt #21 deve copiar isto pra
-- supabase/migrations/0005_pendencias.sql sem alteração estrutural.
-- Seed das ~30 pendências é responsabilidade do PendenciaRepository.bootstrap()
-- no app (canônico em Swift, portado de src/data/schemas.js → SEED_PEND_TIPOS).
--
-- pendencias_template = GLOBAL (catálogo curado), padrão tracks/licoes.
-- evento_pendencias = por time (via evento), padrão garagem.

-- ─── Templates (catálogo) ─────────────────────────────────
create table public.pendencias_template (
  id            uuid primary key default gen_random_uuid(),
  grupo_id      text not null,
  grupo_titulo  text not null,
  grupo_num     text not null,
  titulo        text not null,
  observacao    text,
  obrigatorio   boolean not null default false,
  ordem         integer not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_pendencias_template_upd before update on public.pendencias_template
  for each row execute function public.set_updated_at();
create index on public.pendencias_template (grupo_id, ordem);

-- ─── Instâncias por evento ────────────────────────────────
create table public.evento_pendencias (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references public.eventos(id) on delete cascade,
  template_id  uuid not null references public.pendencias_template(id) on delete cascade,
  checado      boolean not null default false,
  checado_at   timestamptz,
  nota         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_evento_pendencias_upd before update on public.evento_pendencias
  for each row execute function public.set_updated_at();
create index on public.evento_pendencias (evento_id);
create unique index idx_evento_pendencias_unique
  on public.evento_pendencias (evento_id, template_id);

-- ─── RLS ──────────────────────────────────────────────────
alter table public.pendencias_template enable row level security;
alter table public.evento_pendencias enable row level security;

-- Templates = catálogo público (igual tracks/licoes)
create policy pendencias_template_public_read on public.pendencias_template
  for select using (true);
-- (write só service_role)

-- Instâncias seguem o time do evento. Subquery avoid SECURITY DEFINER recursion
-- porque eventos.policy já passa por is_member; aqui simplesmente delega.
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
