-- ═══════════════════════════════════════════════════════════════════════════
-- 0045_seguranca_rls_painel — CAMADA 1 (higiene de acesso) da correção de segurança
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Origem: auditoria 14/06/2026 (achados SEG-01 e SEG-05).
-- Autorização para APLICAR EM PRODUÇÃO: AINDA NÃO RECEBIDA — este arquivo está
-- PREPARADO em desenvolvimento. Só rodar na nuvem com a frase literal do Flávio.
--
-- O QUE ESTA MIGRATION FAZ (sem mudar o comportamento do painel):
--   1. Liga a trava de acesso (RLS) nas 3 tabelas que estavam SEM trava:
--      pontos_troca_aprendidos, envelopes_seguranca_stint, qualidade_troca_marcha.
--   2. Cria políticas EXPLÍCITAS espelhando exatamente o que o painel anônimo já
--      faz hoje (confirmado lendo os consumidores em web/cockpit/):
--        - pontos_troca_aprendidos: SELECT + INSERT + UPDATE  (pontos-troca-persister.js)
--        - envelopes_seguranca_stint: SELECT + INSERT          (configuracao-stint.js)
--        - qualidade_troca_marcha:  SELECT + INSERT (preparado; ninguém usa ainda — aguarda sensor)
--   3. Reduz superfície de risco:
--        - perfis_reacao_piloto: troca a política "FOR ALL" (que deixava QUALQUER UM
--          APAGAR) por SELECT+INSERT+UPDATE — tira o poder de exclusão anônima.
--        - filas órfãs do T4000 (t4000_live_commands / t4000_live_events): remove o
--          acesso anônimo (confirmado: NINGUÉM consome essas tabelas no código).
--
-- O QUE ESTA MIGRATION *NÃO* FAZ:
--   - NÃO fecha o vetor principal: enquanto o painel for anônimo (chave pública no
--     navegador), qualquer um com a chave ainda pode INSERIR/ATUALIZAR dados de
--     aprendizado. O fechamento real exige LOGIN (Camada 2 — decisão à parte).
--   - NÃO afeta a operação do carro: o shift light usa limites fixos no código,
--     não os do banco (achado SEG-06).
--
-- Idempotente: enable RLS é seguro repetir; toda policy usa drop-if-exists antes.
-- Reversível: ver bloco ROLLBACK no fim.

BEGIN;

-- ── 1. pontos_troca_aprendidos (estava SEM trava) ──────────────────────────
alter table public.pontos_troca_aprendidos enable row level security;

drop policy if exists pontos_troca_select_anon on public.pontos_troca_aprendidos;
create policy pontos_troca_select_anon on public.pontos_troca_aprendidos
  for select to anon using (true);

drop policy if exists pontos_troca_insert_anon on public.pontos_troca_aprendidos;
create policy pontos_troca_insert_anon on public.pontos_troca_aprendidos
  for insert to anon with check (true);

drop policy if exists pontos_troca_update_anon on public.pontos_troca_aprendidos;
create policy pontos_troca_update_anon on public.pontos_troca_aprendidos
  for update to anon using (true) with check (true);

-- ── 2. envelopes_seguranca_stint (estava SEM trava) ───────────────────────
alter table public.envelopes_seguranca_stint enable row level security;

drop policy if exists envelopes_select_anon on public.envelopes_seguranca_stint;
create policy envelopes_select_anon on public.envelopes_seguranca_stint
  for select to anon using (true);

drop policy if exists envelopes_insert_anon on public.envelopes_seguranca_stint;
create policy envelopes_insert_anon on public.envelopes_seguranca_stint
  for insert to anon with check (true);

-- ── 3. qualidade_troca_marcha (estava SEM trava; ninguém usa ainda) ────────
alter table public.qualidade_troca_marcha enable row level security;

drop policy if exists qualidade_select_anon on public.qualidade_troca_marcha;
create policy qualidade_select_anon on public.qualidade_troca_marcha
  for select to anon using (true);

drop policy if exists qualidade_insert_anon on public.qualidade_troca_marcha;
create policy qualidade_insert_anon on public.qualidade_troca_marcha
  for insert to anon with check (true);

-- ── 4. perfis_reacao_piloto (trava já ligada; tira o poder de APAGAR) ──────
drop policy if exists perfis_reacao_all on public.perfis_reacao_piloto;

drop policy if exists perfis_select_anon on public.perfis_reacao_piloto;
create policy perfis_select_anon on public.perfis_reacao_piloto
  for select to anon using (true);

drop policy if exists perfis_insert_anon on public.perfis_reacao_piloto;
create policy perfis_insert_anon on public.perfis_reacao_piloto
  for insert to anon with check (true);

drop policy if exists perfis_update_anon on public.perfis_reacao_piloto;
create policy perfis_update_anon on public.perfis_reacao_piloto
  for update to anon using (true) with check (true);

-- ── 5. Filas órfãs do T4000 (ninguém consome — fecha o acesso anônimo) ─────
--    Tabelas preservadas (NÃO dropadas); só o acesso anônimo é revogado.
--    RLS continua ligada; sem política = nenhum anônimo lê/escreve.
drop policy if exists t4000_commands_anon_all on public.t4000_live_commands;
drop policy if exists t4000_events_anon_all on public.t4000_live_events;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (reverter ao estado anterior, se necessário):
--   begin;
--     drop policy if exists perfis_select_anon  on public.perfis_reacao_piloto;
--     drop policy if exists perfis_insert_anon  on public.perfis_reacao_piloto;
--     drop policy if exists perfis_update_anon  on public.perfis_reacao_piloto;
--     create policy perfis_reacao_all on public.perfis_reacao_piloto for all using (true) with check (true);
--     create policy t4000_commands_anon_all on public.t4000_live_commands for all to anon using (true) with check (true);
--     create policy t4000_events_anon_all   on public.t4000_live_events   for all to anon using (true) with check (true);
--     alter table public.pontos_troca_aprendidos   disable row level security;
--     alter table public.envelopes_seguranca_stint disable row level security;
--     alter table public.qualidade_troca_marcha    disable row level security;
--   commit;
-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO (rodar depois de aplicar):
--   select tablename, policyname, cmd, roles from pg_policies
--    where tablename in ('pontos_troca_aprendidos','envelopes_seguranca_stint',
--                        'qualidade_troca_marcha','perfis_reacao_piloto',
--                        't4000_live_commands','t4000_live_events')
--    order by tablename, cmd;
-- ═══════════════════════════════════════════════════════════════════════════
