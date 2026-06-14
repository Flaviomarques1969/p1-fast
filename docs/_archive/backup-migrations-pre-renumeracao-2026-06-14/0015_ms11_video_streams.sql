-- ═══════════════════════════════════════════════════════════
-- 0015_ms11_video_streams — vídeo ao vivo dos stints
-- ═══════════════════════════════════════════════════════════
-- MS-11 etapa 1. Tabela `video_streams` registra cada transmissão
-- de vídeo de um stint (1:1 com sessoes). Daily.co room URL fica
-- pública (qualquer pessoa com a URL consegue ver) — segurança vem
-- de token único + expirar ao fim do stint.
--
-- Decisões registradas (rodada 1+2 de 2026-05-11):
--   Q11: início automático ao começar stint
--   Q12+Q2.4: box + pessoas do aplicativo + link público do evento
--   Q13: qualidade adaptativa (Daily.co decide)
--   Q14: SEM áudio (privacidade + bateria)
--   Q15: heartbeat a cada 5s
--   Q16: última imagem congelada em falha de internet
--   Q18+Q2.5: gravação cobre todo stream; triagem volta-a-volta = F4
--   Q25: teto Daily.co = US$ 50/mês
--   Q26: aviso bateria 20%, desliga 10%
--   Q27: NÃO pausa durante box (continua transmitindo)
--
-- ADR-024: Daily.co é o serviço escolhido (não LiveKit, não Cloudflare).

create table public.video_streams (
  id                  uuid primary key default gen_random_uuid(),
  time_id             uuid not null references public.times(id) on delete cascade,
  sessao_id           uuid not null references public.sessoes(id) on delete cascade,
  -- Daily.co metadata
  daily_room_url      text not null,
  daily_room_name     text not null,
  -- Estado da transmissão
  status              text not null default 'iniciando'
                      check (status in ('iniciando','ao_vivo','sem_sinal','encerrado','falha')),
  started_at          timestamptz,
  ended_at            timestamptz,
  ultima_heartbeat    timestamptz,
  -- Bateria (Q26)
  bateria_inicio      integer check (bateria_inicio is null or (bateria_inicio between 0 and 100)),
  bateria_fim         integer check (bateria_fim is null or (bateria_fim between 0 and 100)),
  -- Motivo do encerramento (manual, bateria, sem_internet, etc.)
  motivo_encerramento text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_video_streams_upd before update on public.video_streams
  for each row execute function public.set_updated_at();
-- 1 stream por sessao (Q11: começa automático com stint, não duplica)
create unique index idx_video_streams_sessao on public.video_streams (sessao_id);
create index idx_video_streams_time_started on public.video_streams (time_id, started_at desc);

-- ─── Link público do evento (Q2.4) ─────────────────────────
-- Token único gerado por evento. Vale o dia inteiro. Quem tem o link
-- vê todos os streams do evento (públicos via Daily.co room URLs).
-- Patrocinador/família/concorrente curioso pode assistir sem login.
alter table public.eventos
  add column link_publico_video_token text;

create index idx_eventos_link_publico on public.eventos (link_publico_video_token)
  where link_publico_video_token is not null;

-- ─── RLS ──────────────────────────────────────────────────
alter table public.video_streams enable row level security;

-- Membros do time veem todos os streams do time
create policy video_streams_select_member on public.video_streams
  for select using (public.is_member(time_id));

-- Só admins/chefes podem mutar manualmente
create policy video_streams_admin_write on public.video_streams
  for all using (public.is_admin(time_id) or public.is_chefe_equipe(time_id))
            with check (public.is_admin(time_id) or public.is_chefe_equipe(time_id));

-- Service role (Edge Function) bypass — feito automaticamente pelo
-- supabase (auth.uid() = null em service-key contexts). Edge Function
-- stream-start/end/heartbeat usa service key pra atualizar campos.
