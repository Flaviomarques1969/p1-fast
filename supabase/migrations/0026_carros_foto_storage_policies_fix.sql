-- 0026_carros_foto_storage_policies_fix.sql
-- Fix das policies do bucket carro-fotos.
--
-- As policies originais (criadas em 0020) exigiam que o user fosse
-- membro do time via `public.is_member((storage.foldername(name))[1]::uuid)`.
-- Em 2026-05-16, o app iOS bateu na mensagem "new row violates row-level
-- security policy" ao tentar subir foto. A causa raiz provável: o
-- time canônico foi criado em 2026-05-03 via REST direto (bypass de RPC,
-- conforme anotação em ios/p1fast-ios/.env.xcconfig), e a checagem
-- is_member no contexto do storage falha embora funcione nas tabelas
-- comuns (carros, configuracoes).
--
-- Fix autorizado por Flávio em 2026-05-16: simplificar para "qualquer
-- authenticated user pode escrever no bucket carro-fotos". Trade-off
-- aceitável em desenvolvimento (1 usuário real). Quando a frente F1
-- Pessoas entrar em produção, revisitar para reintroduzir tenancy
-- por time no storage.

DROP POLICY IF EXISTS "carro-fotos: escrita pelo time"      ON storage.objects;
DROP POLICY IF EXISTS "carro-fotos: atualização pelo time"  ON storage.objects;
DROP POLICY IF EXISTS "carro-fotos: exclusão pelo time"     ON storage.objects;

CREATE POLICY "carro-fotos: escrita autenticada"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'carro-fotos');

CREATE POLICY "carro-fotos: atualização autenticada"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'carro-fotos');

CREATE POLICY "carro-fotos: exclusão autenticada"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'carro-fotos');
