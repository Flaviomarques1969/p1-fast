-- PROPOSTA (NÃO APLICADA) — escrita do painel anônimo nas tabelas de telemetria.
-- Contexto 10/06/2026: o painel do piloto escreve como visitante (anon) e o banco
-- recusa em melhores_passagens_trecho (mig 0026) e padroes_telemetria_por_volta
-- (mig 0025) — política "escrita só do time". Resultado: melhores passagens reais
-- e padrão aprendido NUNCA persistem a partir do painel; envelopes_seguranca_stint
-- (mig 0034) ficou SEM trava nenhuma — postura inconsistente.
--
-- DECISÃO DO FLÁVIO PENDENTE (segurança):
--   Opção A — liberar escrita anônima nas 2 tabelas (este arquivo). Simples, painel
--             volta a aprender sozinho. Risco: qualquer pessoa com a chave pública
--             do projeto pode escrever nessas tabelas (dados de telemetria, sem
--             dado pessoal; risco baixo num projeto de uso próprio).
--   Opção B — painel autenticado (login de serviço no notebook de pista). Mais
--             seguro e consistente; mais atrito operacional e mexe na arquitetura.
--   Opção C — A agora + B depois, e ligar trava também nos envelopes na hora do B.
--
-- Se aprovada a Opção A, aplicar com autorização "MIGRAR PARA PRODUÇÃO: políticas
-- de escrita do painel" (vira migração numerada na hora de aplicar):

-- melhores passagens: visitante pode INSERIR (apagar/alterar segue só-time)
drop policy if exists melhores_insert_anon on public.melhores_passagens_trecho;
create policy melhores_insert_anon on public.melhores_passagens_trecho
  for insert to anon with check (true);

-- padrão aprendido: visitante pode INSERIR e ATUALIZAR a própria combinação
drop policy if exists padroes_insert_anon on public.padroes_telemetria_por_volta;
create policy padroes_insert_anon on public.padroes_telemetria_por_volta
  for insert to anon with check (true);
drop policy if exists padroes_update_anon on public.padroes_telemetria_por_volta;
create policy padroes_update_anon on public.padroes_telemetria_por_volta
  for update to anon using (true) with check (true);

-- ADENDO 10/06 (descoberto na migração 0040): a trava também BLOQUEIA A LEITURA
-- dessas tabelas pro painel — sem liberar, o painel não enxerga o stint aberto
-- (sessoes), não conta voltas nem lê trocas/pneus pra vida útil. Se Opção A:
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
