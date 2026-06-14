-- ═══════════════════════════════════════════════════════════
-- 0003_fix_recursive_rls — fix de recursão infinita em is_member/is_admin
-- ═══════════════════════════════════════════════════════════
-- Bug encontrado em smoke E2E (2026-05-03):
--   Insert em qualquer tabela com policy `is_member(time_id)` causa
--   "stack depth limit exceeded". Causa: is_member faz SELECT em
--   usuarios_time, que tem policy que invoca is_member de novo,
--   recursão infinita.
--
-- Fix: declarar is_member e is_admin como SECURITY DEFINER. Isso
-- faz a função rodar com permissões do owner (postgres), bypassando
-- RLS da tabela usuarios_time. Padrão recomendado pelo Supabase pra
-- helpers de membership.
--
-- search_path travado em 'public, auth' pra mitigar risco de path
-- injection (boa prática SECURITY DEFINER).

create or replace function public.is_admin(p_time_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.usuarios_time
    where user_id = auth.uid() and time_id = p_time_id and role = 'admin'
  );
$$;

create or replace function public.is_member(p_time_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.usuarios_time
    where user_id = auth.uid() and time_id = p_time_id
  );
$$;
