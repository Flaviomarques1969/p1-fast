-- 0020_carros_foto_url.sql
-- S2 da rodada 1 de ajustes (2026-05-12). Adiciona o campo opcional
-- `foto_url` em `carros` + cria o bucket `carro-fotos` no Supabase
-- Storage com políticas de acesso.
--
-- Como o app usa esse campo:
--   • Caminho (key) da foto principal do carro no bucket carro-fotos.
--   • Estrutura: carro-fotos/{time_id}/{carro_id}.jpg
--   • App comprime localmente (~500KB alvo, qualidade JPEG 0.6) antes
--     de subir. Uma foto principal por carro.
--   • Quando NULL → card mostra placeholder colorido.
--
-- Espelha a versão local v19_carros_foto_url em
-- ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift

-- ── 1. Campo na tabela ─────────────────────────────────────
ALTER TABLE carros ADD COLUMN foto_url TEXT;

COMMENT ON COLUMN carros.foto_url IS
  'Key do arquivo no bucket carro-fotos. Compressão ≤500KB feita no app. Uma foto principal por carro. S2 rodada 1, 2026-05-12.';

-- ── 2. Bucket no Storage ───────────────────────────────────
-- public=true porque fotos de carro não são sensíveis. Leitura via
-- URL pública (AsyncImage no iPhone), escrita controlada por policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'carro-fotos',
  'carro-fotos',
  true,
  1048576,  -- 1MB hard cap (app já comprime pra ~500KB)
  ARRAY['image/jpeg','image/png']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Policies do Storage ─────────────────────────────────
-- Leitura: qualquer um (bucket público).
-- Escrita / atualização / exclusão: somente authenticated, e somente
-- em arquivos cujo primeiro nível do path bate com algum time do
-- usuário (reaproveita helper public.is_member criado em 0001_initial).

-- Insert
CREATE POLICY "carro-fotos: escrita pelo time"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'carro-fotos'
    AND public.is_member( ((storage.foldername(name))[1])::uuid )
  );

-- Update
CREATE POLICY "carro-fotos: atualização pelo time"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'carro-fotos'
    AND public.is_member( ((storage.foldername(name))[1])::uuid )
  );

-- Delete
CREATE POLICY "carro-fotos: exclusão pelo time"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'carro-fotos'
    AND public.is_member( ((storage.foldername(name))[1])::uuid )
  );
