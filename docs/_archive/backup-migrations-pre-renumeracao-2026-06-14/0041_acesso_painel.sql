-- 0041 — Acesso do painel (opção A do card 20260610-191605, recomendada).
-- Autorização LITERAL Flávio 11/06/2026: "MIGRAR PARA PRODUÇÃO: acesso do painel
-- + fechamento dos 5 stints zumbis + envio dos 6 arquivos".
-- O painel (visitante) passa a: GRAVAR melhores passagens, padrão aprendido e
-- voltas reais; LER sessões, voltas, pneus e manutenções (vida útil + stint aberto).
-- Rollback: drop policy <nome> on <tabela>; pra cada uma abaixo.

drop policy if exists melhores_insert_anon on public.melhores_passagens_trecho;
create policy melhores_insert_anon on public.melhores_passagens_trecho
  for insert to anon with check (true);

drop policy if exists padroes_insert_anon on public.padroes_telemetria_por_volta;
create policy padroes_insert_anon on public.padroes_telemetria_por_volta
  for insert to anon with check (true);
drop policy if exists padroes_update_anon on public.padroes_telemetria_por_volta;
create policy padroes_update_anon on public.padroes_telemetria_por_volta
  for update to anon using (true) with check (true);

drop policy if exists sessoes_select_anon on public.sessoes;
create policy sessoes_select_anon on public.sessoes
  for select to anon using (true);
drop policy if exists voltas_select_anon on public.voltas;
create policy voltas_select_anon on public.voltas
  for select to anon using (true);
drop policy if exists voltas_insert_anon on public.voltas;
create policy voltas_insert_anon on public.voltas
  for insert to anon with check (true);
drop policy if exists pneus_select_anon on public.pneus;
create policy pneus_select_anon on public.pneus
  for select to anon using (true);
drop policy if exists manutencoes_select_anon on public.manutencoes;
create policy manutencoes_select_anon on public.manutencoes
  for select to anon using (true);
