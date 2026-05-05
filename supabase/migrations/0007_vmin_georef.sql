-- ═══════════════════════════════════════════════════════════
-- 0007_vmin_georef — MS-2.4 (PLANO_FASE_1)
-- ═══════════════════════════════════════════════════════════
-- Espelho Postgres do GRDB `v6_vmin_georef` (ios/p1fast-core/Sources/
-- P1FastCore/Persistence/Migrations.swift).
--
-- Delta:
--   • segment_executions: +vmin_kmh, +vmin_x, +vmin_y — ponto georef
--     onde a velocidade mínima da execução aconteceu. Detector já
--     calcula em DetectorSegmentEndEvent.velMinima + apexActual; a
--     persistência entra em MS-2.5 (StintRepository.finalize consome
--     Detector.onSegmentEnd real).
--
-- Decisão Flávio 2026-05-04: Apex ≠ Vmin. Apex é referência de tangência
-- (linha de corrida); Vmin é dado dinâmico em runtime. Persistir o trio
-- por execução habilita o widget Vmin no cockpit (MS-13.6) e a Command
-- Box futura (MS-12) sem recomputar a partir de telemetry_samples.
--
-- Todas as colunas NULL — execuções legadas (pré-MS-2.5) continuam
-- válidas sem o Vmin georef.
--
-- ATENÇÃO: este arquivo está versionado mas NÃO foi aplicado em prod.
-- O Flávio roda `supabase db push` manualmente após o merge do PR.

alter table public.segment_executions add column vmin_kmh numeric;
alter table public.segment_executions add column vmin_x   numeric;
alter table public.segment_executions add column vmin_y   numeric;
