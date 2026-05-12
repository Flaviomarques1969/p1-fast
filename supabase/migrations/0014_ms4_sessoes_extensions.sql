-- ═══════════════════════════════════════════════════════════
-- 0014_ms4_sessoes_extensions — campos novos pra StintPlan
-- ═══════════════════════════════════════════════════════════
-- MS-4 etapa 1. Estende `sessoes` com campos que cobrem as
-- decisões do Flávio em 37 perguntas respondidas em 2026-05-11
-- (rodadas 1+2 em .claude-perguntas/respostas/). Decisões grandes
-- (Pessoas multi-papel, IA do piloto, checklist em tempo real,
-- triagem volta-a-volta) ficaram pras frentes pós-MS-4 documentadas
-- em docs/FRENTES_POS_MS4.md (PR #175).
--
-- Campos:
--   - paradas_box: lista de paradas planejadas, cada uma com volta e motivo
--   - ia_ligada: flag — comportamento real = Frente F2 (P1 Coach)
--   - mapa_ghost_ligado: flag — comportamento real = frente UI futura
--   - licao_id: FK pra licoes (catálogo já existe — tabela criada em 0004)
--   - cancelado_em: timestamp do cancelamento (Q24 = marca, não apaga)
--   - pilotos_revezamento: lista de turnos pra endurance (Q8)
--   - convidado_id: piloto convidado em eventos não-endurance (Q8)
--
-- Mesma migração adiciona papel 'chefe_equipe' em usuarios_time.role
-- (Q23 = criar 7º papel) — permissões de edição usadas em MS-4.6.

-- ─── 1. Campos novos em sessoes ─────────────────────────
alter table public.sessoes
  add column paradas_box jsonb not null default '[]'::jsonb,
  add column ia_ligada boolean not null default false,
  add column mapa_ghost_ligado boolean not null default false,
  add column licao_id uuid references public.licoes(id) on delete set null,
  add column cancelado_em timestamptz,
  add column pilotos_revezamento jsonb,
  add column convidado_id uuid references public.pilotos(id) on delete set null;

create index if not exists idx_sessoes_licao on public.sessoes (licao_id);
create index if not exists idx_sessoes_convidado on public.sessoes (convidado_id);

-- ─── 2. Papel 'chefe_equipe' em usuarios_time ──────────
-- Drop e recria a check pra adicionar 'chefe_equipe' à lista
-- permitida. Rows existentes (admin/membro) continuam válidas.
alter table public.usuarios_time
  drop constraint usuarios_time_role_check;

alter table public.usuarios_time
  add constraint usuarios_time_role_check
  check (role in ('admin', 'membro', 'chefe_equipe'));

-- ─── 3. Helper: usuário é chefe de equipe? ─────────────
-- Mesmo padrão de is_admin/is_member (0001_initial.sql). Usado em
-- futuras políticas RLS de stints e pra MS-4.6 (UI permissions).
create or replace function public.is_chefe_equipe(p_time_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.usuarios_time
    where user_id = auth.uid() and time_id = p_time_id and role = 'chefe_equipe'
  );
$$;
