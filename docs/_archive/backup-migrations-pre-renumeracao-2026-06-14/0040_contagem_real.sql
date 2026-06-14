-- 0040 — Contagem real: voltas de verdade, quilômetros e vida útil por peça.
-- Autorização literal Flávio 10/06/2026: "MIGRAR PARA PRODUÇÃO: contagem real".
-- TUDO ADITIVO. A permissão de escrita do painel NÃO entra aqui (card em aberto).
-- Rollback (se precisar):
--   alter table public.track_layouts drop column comprimento_m;
--   alter table public.voltas drop column origem;
--   alter table public.pneus drop column instalado_em;
--   alter table public.manutencoes drop column pneu_id, drop column peca_id;

alter table public.track_layouts
  add column if not exists comprimento_m numeric;
comment on column public.track_layouts.comprimento_m is
  'Extensão oficial do traçado em metros (Brasília completo = 5476). km = voltas reais × comprimento.';

update public.track_layouts set comprimento_m = 5476
  where id = '0dc85cfb-6236-567e-814c-eddf610b301f' and comprimento_m is null;

alter table public.voltas
  add column if not exists origem text not null default 'app';
comment on column public.voltas.origem is
  'app = gerada pelo aplicativo (provisória) · painel-ao-vivo = volta REAL da linha de chegada.';

alter table public.pneus
  add column if not exists instalado_em timestamptz;

alter table public.manutencoes
  add column if not exists pneu_id uuid references public.pneus(id) on delete set null;
alter table public.manutencoes
  add column if not exists peca_id uuid references public.pecas(id) on delete set null;
