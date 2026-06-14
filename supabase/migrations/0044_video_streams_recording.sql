-- ═══════════════════════════════════════════════════════════
-- 0025_video_streams_recording — registra gravação Daily.co pronta
-- ═══════════════════════════════════════════════════════════
-- Adiciona colunas em `video_streams` que recebem o aviso (webhook)
-- da Daily.co quando uma gravação termina (evento `recording.ready-to-download`).
--
-- A Daily.co NÃO manda a URL de download direta no webhook — ela manda
-- o `recording_id` e o `s3_key`. Pra obter a URL real (temporária, 1h),
-- a aplicação chama on-demand `GET /v1/recordings/:id/access-link` na API
-- Daily.co. Por isso só guardamos a referência, não a URL.
--
-- Pra o que serve: a tela `TriagemVideoView` consulta `video_streams.recording_id`
-- pra saber se a gravação está disponível; quando precisa reproduzir,
-- chama uma rota do servidor que gera URL temporária a partir do recording_id.

-- RENUMERADA de 0025 -> 0044 em 14/06/2026 (a versão 0025 ja estava em uso na nuvem
-- por padroes_telemetria_por_volta). O efeito abaixo JA esta em producao; por isso o
-- ADD COLUMN agora e idempotente (IF NOT EXISTS) e re-aplicar e no-op seguro.
alter table public.video_streams
  add column if not exists recording_id              text,
  add column if not exists recording_s3_key          text,
  add column if not exists recording_duration_s      integer
    check (recording_duration_s is null or recording_duration_s >= 0),
  add column if not exists recording_max_participants integer
    check (recording_max_participants is null or recording_max_participants >= 0),
  add column if not exists recording_started_at      timestamptz,
  add column if not exists recording_ready_at        timestamptz;

-- Índice pra busca por recording_id (a Edge Function precisa achar o
-- stream pelo recording_id ou pelo room_name)
create unique index if not exists idx_video_streams_recording_id
  on public.video_streams (recording_id)
  where recording_id is not null;
