-- ═══════════════════════════════════════════════════════════
-- 0002_team_signup — RPC create_team + comentários de policies
-- ═══════════════════════════════════════════════════════════
-- Fecha lacuna identificada na auditoria 2026-05-02:
--   • public.times não tem policy INSERT — sem isso o cliente não cria
--     workspace. Esta migration adiciona uma RPC `create_team(nome)`
--     SECURITY DEFINER que cria o time + adiciona o caller como admin
--     atomicamente.
--
-- Por que RPC e não policy INSERT direta?
--   Em INSERT direto não dá pra garantir atomicamente que o caller vire
--   admin do time recém-criado — janela entre INSERT e o INSERT em
--   usuarios_time deixaria órfão. RPC fecha tudo numa transação.
--
-- Também documenta no SQL (via COMMENT) por que `trofeus_ganhos` e
-- `times` (UPDATE) ficam restritos a admin/service_role.

-- ─── RPC create_team(nome) ────────────────────────────────
create or replace function public.create_team(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_team_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'create_team: requires authenticated user' using errcode = '42501';
  end if;
  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'create_team: p_nome required' using errcode = '22023';
  end if;

  insert into public.times (nome, criado_por)
  values (trim(p_nome), v_user_id)
  returning id into v_team_id;

  insert into public.usuarios_time (user_id, time_id, role)
  values (v_user_id, v_team_id, 'admin');

  return v_team_id;
end;
$$;

-- Permite chamada por usuário autenticado (não anon).
revoke all on function public.create_team(text) from public;
grant execute on function public.create_team(text) to authenticated;

comment on function public.create_team(text) is
  'Cria um time novo e adiciona o caller como admin. Atomicamente. '
  'SECURITY DEFINER porque public.times não expõe policy INSERT — '
  'workspace só nasce via esta função, garantindo que cada time '
  'sempre tem ≥1 admin desde a criação.';

-- ─── Comentários documentando policies restritas ─────────
comment on table public.times is
  'Workspace. Membros enxergam (RLS times_select), admin edita (times_update). '
  'Criação só via RPC create_team(nome) — não há policy INSERT direta.';

comment on table public.trofeus_ganhos is
  'Gamificação. Membros leem (trofeus_select). Insert/update/delete só '
  'via service_role (backend premia, cliente não fabrica troféu). '
  'Sem policy INSERT/UPDATE/DELETE intencionalmente.';
