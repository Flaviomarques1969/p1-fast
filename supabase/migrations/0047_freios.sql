-- 0047_freios.sql
-- Cadastro próprio de itens de freio por carro (decisão Flávio 19/06/2026:
-- "criar cadastro próprio igual pneu"). Espelha public.pneus: FK pra
-- times/carros, trigger de updated_at, índices e RLS por time. Sobe pela
-- Edge Function `sync` (já na whitelist ALLOWED_TABLES) e desce pela `pull`
-- (TEAM_TABLES). `tipo` guarda o código do componente vindo do catálogo de
-- consumíveis já aprovado (pastilhas | discos | fluido_freio) — não inventado.
--
-- AMBIENTE: este arquivo é só a DEFINIÇÃO da migração (desenvolvimento). NÃO
-- foi aplicado em produção. Aplicar em produção exige autorização literal
-- "MIGRAR PARA PRODUÇÃO" (regra do projeto).

create table if not exists public.freios (
  id            uuid primary key default gen_random_uuid(),
  time_id       uuid not null references public.times(id) on delete cascade,
  carro_id      uuid not null references public.carros(id) on delete cascade,
  tipo          text,
  marca         text,
  especificacao text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_freios_upd before update on public.freios
  for each row execute function public.set_updated_at();
create index if not exists idx_freios_carro on public.freios (carro_id);
create index if not exists idx_freios_time on public.freios (time_id);

-- RLS por time, igual a public.pneus (membro do time vê/edita as próprias rows).
alter table public.freios enable row level security;
create policy freios_all on public.freios for all
  using (public.is_member(time_id)) with check (public.is_member(time_id));
