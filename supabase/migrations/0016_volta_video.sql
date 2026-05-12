-- ═══════════════════════════════════════════════════════════
-- 0016_volta_video — triagem volta-por-volta da gravação Daily.co
-- ═══════════════════════════════════════════════════════════
-- F4 etapa 2 (registro em `docs/FRENTES_POS_MS4.md`). Tabela `volta_video`
-- indexa cada volta dentro da gravação contínua do Daily.co (1 stream
-- por sessão, gravação é uma só). Cada row marca onde a volta começa
-- e termina dentro do vídeo + status de triagem (pendente / mantida /
-- descartada).
--
-- Decisões registradas (rodada 1+2 de 2026-05-11):
--   Q18+Q2.5: gravação cobre todo stream; triagem volta-a-volta = F4
--   Q2.5: triagem por piloto + chefe da equipe (refinada em F4.6)
--
-- Semântica em Tier 0: a gravação Daily.co inteira fica preservada
-- até o teto US$ 50/mês. Voltas mantidas geram nada — só ficam indexadas
-- (cliente reproduz pulando direto pro t_inicio_ms). Voltas descartadas
-- também não geram nada — só marcam intenção. Quando o teto for atingido,
-- política de retenção será revisitada (mantidas têm prioridade).

create table public.volta_video (
  id                uuid primary key default gen_random_uuid(),
  time_id           uuid not null references public.times(id) on delete cascade,
  -- 1 gravação por stream (1 stream por sessão)
  video_stream_id   uuid not null references public.video_streams(id) on delete cascade,
  -- Volta correspondente — UNIQUE garante 1:1
  volta_id          uuid not null references public.voltas(id) on delete cascade,
  -- Offset dentro da gravação (ms desde started_at do stream)
  t_inicio_ms       integer not null check (t_inicio_ms >= 0),
  t_fim_ms          integer not null check (t_fim_ms > t_inicio_ms),
  -- Status da triagem
  triagem_status    text not null default 'pendente'
                    check (triagem_status in ('pendente','mantida','descartada')),
  triada_por        uuid references auth.users(id) on delete set null,
  triada_em         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_volta_video_upd before update on public.volta_video
  for each row execute function public.set_updated_at();

-- 1 row por volta (1:1)
create unique index idx_volta_video_volta on public.volta_video (volta_id);
create index idx_volta_video_stream on public.volta_video (video_stream_id);
create index idx_volta_video_time_status on public.volta_video (time_id, triagem_status);

-- ─── RLS ──────────────────────────────────────────────────
-- Política inicial: membros do time leem; membros do time escrevem
-- (incluindo mudança de triagem_status). Refinamento "só piloto da
-- sessão + chefe_equipe" vem em F4.6.
alter table public.volta_video enable row level security;

create policy volta_video_select_member on public.volta_video
  for select using (public.is_member(time_id));

create policy volta_video_write_member on public.volta_video
  for all using (public.is_member(time_id))
        with check (public.is_member(time_id));
