-- ═══════════════════════════════════════════════════════════
-- 0009_track_geo_anchors_view_box — MS-2.6.c (PLANO_FASE_1)
-- ═══════════════════════════════════════════════════════════
-- Espelha geo_ancoras + viewBox do domínio Swift (SeedBrasilia) no PG.
-- Hoje esses dois objetos só vivem hardcoded em SeedBrasilia.swift; com
-- isso TelemetriaView depende de SeedBrasilia.make() em vez de
-- TrackRepository.currentTrack(). Persistir aqui é pré-requisito pra
-- multi-track (cadastro de pista pelo usuário) e pra remover o
-- hardcode da view ao vivo.
--
-- Decisões:
--   • geo_ancoras vai em `tracks` — é fixo da pista física, não muda
--     entre layouts. Array de {lat, lng, x, y}, mesmo formato do
--     domínio Swift (codable).
--   • view_box vai em `track_layouts` — casa com `svg_path` que já
--     mora ali. {w, h} em Double.
--
-- NULLable: tracks/layouts existentes continuam válidos sem essas
-- colunas até serem hidratados (migration data segue em código no
-- TrackRepository.seedBrasiliaIfMissing).
--
-- ATENÇÃO: arquivo versionado mas NÃO aplicado em prod automaticamente.
-- O Flávio (ou Claude com autorização) roda `supabase db push` após o
-- merge.

alter table public.tracks         add column geo_ancoras jsonb;
alter table public.track_layouts  add column view_box    jsonb;
