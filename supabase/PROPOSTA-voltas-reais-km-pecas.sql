-- PROPOSTA (NÃO APLICADA) — estrutura pra voltas reais, quilômetros e vida útil
-- por peça. Autorização de construção: Flávio 10/06/2026 ("eu já te disse que
-- quero"). Aplicação no banco vivo: junto com a decisão do card de acesso
-- (20260610-191605) num único "MIGRAR PARA PRODUÇÃO: contagem real".
-- TUDO ADITIVO — nenhuma coluna/tabela/linha existente é alterada ou removida.

-- 1. Quilômetros: comprimento oficial do traçado → km = voltas × comprimento.
alter table public.track_layouts
  add column if not exists comprimento_m numeric;
comment on column public.track_layouts.comprimento_m is
  'Extensão oficial do traçado em metros (Brasília completo = 5476). km da sessão = voltas reais × comprimento.';
-- Brasília completo (mesmo valor que travou a escala do mapa oficial, 10/06):
update public.track_layouts set comprimento_m = 5476
  where id = '0dc85cfb-6236-567e-814c-eddf610b301f' and comprimento_m is null;

-- 2. Origem da volta: separa a contagem real (painel na pista) das provisórias
--    antigas do app — a vida útil conta só as reais a partir do corte.
alter table public.voltas
  add column if not exists origem text not null default 'app';
comment on column public.voltas.origem is
  'app = gerada pelo aplicativo (provisória, era o mock) · painel-ao-vivo = volta REAL detectada na linha de chegada.';

-- 3. Vida útil por peça física: data de instalação no pneu e vínculo da
--    manutenção com a unidade trocada (qual jogo de pneu / qual peça).
alter table public.pneus
  add column if not exists instalado_em timestamptz;
alter table public.manutencoes
  add column if not exists pneu_id uuid references public.pneus(id) on delete set null;
alter table public.manutencoes
  add column if not exists peca_id uuid references public.pecas(id) on delete set null;

-- 4. Permissão de escrita do painel na tabela voltas — segue a MESMA escolha
--    do card de acesso (se Opção A/C: liberar insert anônimo como abaixo).
-- drop policy if exists voltas_insert_anon on public.voltas;
-- create policy voltas_insert_anon on public.voltas
--   for insert to anon with check (true);
