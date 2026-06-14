-- ═══════════════════════════════════════════════════════════
-- 0019_pessoa_papeis — Fase A da F1 (papéis múltiplos por pessoa)
-- ═══════════════════════════════════════════════════════════
-- F1 etapa A.2. Cada Pessoa pode ter N papéis selecionáveis: piloto,
-- passageiro, engenheiro, mecanico, coach, convidado, chefe_equipe.
-- Modelagem 1:N (PK composta) — adicionar/remover papel é insert/delete
-- de uma row.
--
-- Decisão Flávio (mockups Onda 1 + rodada 2 2026-05-11):
--   "Uma única entidade Pessoa com múltiplos papéis selecionáveis"
--
-- Lista canônica do enum cobre os papéis mapeados:
--   piloto       = quem pilota (substitui pilotos)
--   passageiro   = quem anda como passageiro (substitui passageiros)
--   engenheiro   = engenheiro de pista (papel novo)
--   mecanico     = mecânico do carro (papel novo)
--   coach        = treinador / observador (papel novo)
--   convidado    = convidado pontual (papel novo)
--   chefe_equipe = chefe da equipe (já existe em usuarios_time.role
--                  mas aqui é só marcação descritiva da pessoa)

create table public.pessoa_papeis (
  pessoa_id   uuid not null references public.pessoas(id) on delete cascade,
  papel       text not null check (papel in (
    'piloto',
    'passageiro',
    'engenheiro',
    'mecanico',
    'coach',
    'convidado',
    'chefe_equipe'
  )),
  created_at  timestamptz not null default now(),
  primary key (pessoa_id, papel)
);

create index idx_pessoa_papeis_papel on public.pessoa_papeis (papel);

-- ─── RLS ──────────────────────────────────────────────────
-- Herda do parent: quem tem acesso à pessoa tem acesso aos papéis dela.
-- Subquery valida membership via time_id da pessoa.
alter table public.pessoa_papeis enable row level security;

create policy pessoa_papeis_select_member on public.pessoa_papeis
  for select using (
    exists (
      select 1 from public.pessoas p
      where p.id = pessoa_papeis.pessoa_id
        and public.is_member(p.time_id)
    )
  );

create policy pessoa_papeis_insert_member on public.pessoa_papeis
  for insert with check (
    exists (
      select 1 from public.pessoas p
      where p.id = pessoa_papeis.pessoa_id
        and public.is_member(p.time_id)
    )
  );

create policy pessoa_papeis_delete_member on public.pessoa_papeis
  for delete using (
    exists (
      select 1 from public.pessoas p
      where p.id = pessoa_papeis.pessoa_id
        and public.is_member(p.time_id)
    )
  );
