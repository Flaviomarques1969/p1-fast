-- 0042_plano_stint_no_envelope.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- PLANO DO STINT VIAJA COM O ENVELOPE (decisão da fila aprovada 11/06/2026).
--
-- Problema: o plano do stint (propósito/foco/ghost/voltas/paradas) era gravado
-- só no localStorage do navegador onde o chefe aprovou o envelope
-- ('p1fast-plano-stint-v1', configuracao-stint.js). No notebook do carro
-- (outro navegador) o painel não tinha como armar o treino de técnica.
--
-- Solução: o plano vira coluna JSONB no próprio envelope — escrita atômica
-- junto da aprovação (sem tabela nova, sem segunda escrita pra falhar).
-- O painel lê o plano do último envelope do carro quando não há plano local.
--
-- Conteúdo esperado (mesmo objeto do localStorage):
--   { proposito, foco, ghost, voltas, paradas[], carroId, piloto, autodromo,
--     tipoPneu, vidaPneuFaixa, modo, aprovadoEm }
--
-- Acesso: a tabela está SEM trava de linha (RLS desligada — fotografia
-- POLICIES-VIVAS-2026-06-11.md), igual ao INSERT que a tela já faz hoje.
-- Nenhuma mudança de política necessária.
--
-- Envelopes antigos ficam com plano_stint NULL — o painel trata como
-- "sem plano" e roda padrão (nada quebra).
--
-- ROLLBACK (se precisar):
--   ALTER TABLE public.envelopes_seguranca_stint DROP COLUMN IF EXISTS plano_stint;
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.envelopes_seguranca_stint
  ADD COLUMN IF NOT EXISTS plano_stint JSONB;

COMMENT ON COLUMN public.envelopes_seguranca_stint.plano_stint IS
  'Plano do stint aprovado junto do envelope (propósito/foco/ghost/voltas/'
  'paradas + contexto carro/piloto/autódromo/pneu/modo). Mesmo objeto que a '
  'tela grava no localStorage p1fast-plano-stint-v1. O painel usa como '
  'fallback quando não há plano local (plano viaja com o envelope, 11/06/2026).';

-- Verificação (saída esperada: 1 linha com a coluna)
SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'envelopes_seguranca_stint'
    AND column_name = 'plano_stint';
