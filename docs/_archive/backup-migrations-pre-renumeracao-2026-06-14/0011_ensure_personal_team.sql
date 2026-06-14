-- ═══════════════════════════════════════════════════════════
-- 0011_ensure_personal_team — RPC idempotente + backfill (MS-10 C.1)
-- ═══════════════════════════════════════════════════════════
-- Sprint C.1 do MS-10. Sprint A entregou login (PRs #124-#126), Sprint
-- B (PR #127) faz o transport mandar JWT do user no Authorization. Pra
-- a telemetria realmente chegar via Edge Function `ingest`, o usuário
-- precisa ter um TIME registrado em public.times + linha em
-- public.usuarios_time — `ingest/index.ts` valida membership antes de
-- aceitar samples (rejeita 403 "user-not-in-team" caso contrário).
--
-- A RPC `create_team(nome)` (migration 0002) cria um time NOVO a cada
-- chamada — não dá pra usar como bootstrap idempotente. Esta migration
-- adiciona `ensure_personal_team()`:
--
--   1. Se o caller já é admin de algum time → devolve esse time_id.
--   2. Senão, cria um time "Equipe pessoal de <email>" + adiciona o
--      caller como admin atomicamente. Devolve o novo time_id.
--
-- Idempotência via "primeiro time onde caller é admin" — um piloto
-- solo só vai ter o time pessoal. Se entrar em outras equipes depois,
-- como `membro` (não `admin`), o time pessoal continua sendo o
-- "primeiro como admin" — estável.
--
-- Backfill: aplica pra todos os usuários existentes em auth.users que
-- ainda não têm nenhum time como admin. Garante que contas antigas
-- (Flávio, devs de teste futuros) ficam consistentes na primeira
-- aplicação desta migration.

-- ─── RPC ensure_personal_team() ──────────────────────────
create or replace function public.ensure_personal_team()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_team_id uuid;
  v_user_id uuid := auth.uid();
  v_email   text;
begin
  if v_user_id is null then
    raise exception 'ensure_personal_team: requires authenticated user'
      using errcode = '42501';
  end if;

  -- Já é admin de algum time? Reusa o mais antigo (= time pessoal).
  select t.id into v_team_id
    from public.times t
    join public.usuarios_time ut on ut.time_id = t.id
   where ut.user_id = v_user_id
     and ut.role = 'admin'
   order by t.created_at asc
   limit 1;

  if v_team_id is not null then
    return v_team_id;
  end if;

  -- Sem time como admin — cria um pessoal.
  select email into v_email from auth.users where id = v_user_id;

  insert into public.times (nome, criado_por)
  values (
    'Equipe pessoal de ' || coalesce(nullif(v_email, ''), v_user_id::text),
    v_user_id
  )
  returning id into v_team_id;

  insert into public.usuarios_time (user_id, time_id, role)
  values (v_user_id, v_team_id, 'admin');

  return v_team_id;
end;
$$;

revoke all on function public.ensure_personal_team() from public;
grant execute on function public.ensure_personal_team() to authenticated;

comment on function public.ensure_personal_team() is
  'Idempotente. Devolve o time_id do time pessoal do caller (cria se '
  'não existir). Sprint C.1 do MS-10 — app chama após login pra '
  'descobrir/inicializar o time onde a telemetria vai aterrissar.';

-- ─── Backfill pra usuários existentes ────────────────────
-- Bypassa o auth.uid() (que é null em transação de migration) e
-- rodando como service role direto no schema. Cobre todos os usuários
-- em auth.users que ainda não são admin de nenhum time.
do $$
declare
  r record;
  v_team_id uuid;
begin
  for r in
    select u.id as user_id, u.email
      from auth.users u
     where not exists (
       select 1 from public.usuarios_time ut
        where ut.user_id = u.id
          and ut.role = 'admin'
     )
  loop
    insert into public.times (nome, criado_por)
    values (
      'Equipe pessoal de ' || coalesce(nullif(r.email, ''), r.user_id::text),
      r.user_id
    )
    returning id into v_team_id;

    insert into public.usuarios_time (user_id, time_id, role)
    values (r.user_id, v_team_id, 'admin');
  end loop;
end;
$$;
