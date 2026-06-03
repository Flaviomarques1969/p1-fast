-- 0028_carro_fotos_select_policy.sql
-- Fix complementar ao 0026: o Supabase Storage faz SELECT na tabela
-- storage.objects antes do INSERT (pra detectar conflitos com upsert).
-- Sem policy SELECT, o INSERT é rejeitado com 403 "new row violates
-- row-level security policy" mesmo quando a policy de INSERT seria
-- aprovada.
--
-- Adiciona policy SELECT pro bucket carro-fotos, alinhada com as
-- outras 3 que vivem desde 0026.

CREATE POLICY "carro-fotos: leitura autenticada"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'carro-fotos');
