-- 0027_diag_storage_policies.sql
-- DIAGNÓSTICO 2026-05-16 — remover depois.
-- A migration 0026 dropou e recriou 3 policies do bucket carro-fotos
-- pra permitir "qualquer authenticated escreve", mas o app iOS ainda
-- recebe 403 RLS ao tentar subir JPEG. Esta migration cria uma RPC
-- pública que lista as policies vigentes e o estado do auth.uid()
-- pra eu diagnosticar via REST sem precisar de psql.

CREATE OR REPLACE FUNCTION public._diag_storage_state()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'auth_uid', auth.uid(),
    'current_role', current_user,
    'policies_carro_fotos', (
      SELECT jsonb_agg(jsonb_build_object(
        'policyname', policyname,
        'cmd', cmd,
        'roles', roles,
        'qual', qual,
        'with_check', with_check
      ))
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname ILIKE '%carro-fotos%'
    ),
    'all_storage_objects_policies', (
      SELECT jsonb_agg(jsonb_build_object(
        'policyname', policyname,
        'cmd', cmd
      ))
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
    ),
    'bucket_carro_fotos', (
      SELECT to_jsonb(b)
      FROM storage.buckets b
      WHERE id = 'carro-fotos'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public._diag_storage_state() TO anon, authenticated;
