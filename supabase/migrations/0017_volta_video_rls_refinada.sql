-- ═══════════════════════════════════════════════════════════
-- 0017_volta_video_rls_refinada — restringe triagem a piloto + chefe
-- ═══════════════════════════════════════════════════════════
-- F4 etapa 6. A migration 0016 deixou volta_video aberta pra todos
-- os members do time (insert/update). Refinamento: triagem (UPDATE
-- de triagem_status) só pode ser feita por:
--   - piloto da sessão referida pelo video_stream da volta
--   - chefe da equipe (papel chefe_equipe em usuarios_time)
--   - admin do time (sempre pode)
--
-- Decisão de produto (Flávio 2026-05-11, Q2.5 da rodada 2):
--   "O sistema exige automaticamente depois de iniciar o outro Stint,
--   mas até lá, o chefe de equipe ou piloto também pode entrar no
--   Stint e escolher quais voltas ele quer guardar."
--
-- INSERT continua aberto pros members (indexador da F4.3 precisa
-- criar rows quando o Detector emite onLap durante o stream).
-- SELECT continua aberto pros members (qualquer um do time visualiza).
-- DELETE fica só pra admin/chefe (protege histórico).

-- Drop da policy genérica de write da 0016
drop policy if exists volta_video_write_member on public.volta_video;

-- Read continua igual (membros do time)
-- (policy volta_video_select_member da 0016 permanece)

-- INSERT: members do time podem criar rows (indexador F4.3)
create policy volta_video_insert_member on public.volta_video
  for insert with check (public.is_member(time_id));

-- UPDATE: piloto da sessão OU chefe OU admin
create policy volta_video_update_triagem on public.volta_video
  for update using (
    public.is_admin(time_id)
    or public.is_chefe_equipe(time_id)
    or exists (
      select 1
      from public.video_streams vs
      join public.sessoes s on s.id = vs.sessao_id
      join public.pilotos p on p.id = s.piloto_id
      where vs.id = volta_video.video_stream_id
        and p.user_id = auth.uid()
    )
  ) with check (
    public.is_admin(time_id)
    or public.is_chefe_equipe(time_id)
    or exists (
      select 1
      from public.video_streams vs
      join public.sessoes s on s.id = vs.sessao_id
      join public.pilotos p on p.id = s.piloto_id
      where vs.id = volta_video.video_stream_id
        and p.user_id = auth.uid()
    )
  );

-- DELETE: só admin/chefe (protege histórico — auto-descarte da F4.5
-- usa UPDATE, não DELETE)
create policy volta_video_delete_admin on public.volta_video
  for delete using (
    public.is_admin(time_id) or public.is_chefe_equipe(time_id)
  );
