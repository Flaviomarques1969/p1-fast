-- ═══════════════════════════════════════════════════════════
-- 0010_kalman_gap_duration — A-07 (MS-2.7 polimento)
-- ═══════════════════════════════════════════════════════════
-- Espelho Postgres do GRDB `v9_telemetry_enriched_gap_duration`.
--
-- Adiciona `gap_duration_ms` em telemetry_samples_enriched. Setado
-- apenas no sample que disparou reset de covariância (gap > 5s
-- desde último GPS update). NULL em todas as outras amostras.
--
-- Field test 2026-05-06 (iPhone andando na rua) revelou que app é
-- morto pelo iOS em background depois de ~10min mesmo com
-- UIBackgroundModes.location, gerando 4 janelas de captura
-- separadas por gaps de >1h. Sem reset, pos_sigma divergiu pra
-- 2.98e+55. Reset implementado em #117 (PR A-07).
--
-- Esta coluna existe pra:
--   - Observabilidade post-mortem ("essa volta tinha gaps?")
--   - UI mostrar aviso pro piloto: "captura interrompida X s,
--     posição re-ancorada"
--   - Análises de qualidade do dataset (debrief filtra runs com
--     gaps acima de threshold)
--
-- Default NULL — execuções legadas (samples antes da migration)
-- continuam válidas sem o campo. Coluna nullable porque a
-- esmagadora maioria das amostras não dispara reset.
--
-- ATENÇÃO: este arquivo está versionado mas NÃO foi aplicado em
-- prod. O Flávio roda `supabase db push` manualmente após o merge.

alter table public.telemetry_samples_enriched
  add column gap_duration_ms double precision;

-- Sem index — coluna é diagnóstica e quase sempre NULL. Filtros
-- por gap_duration_ms not null são raros (UI lê o sample inteiro).
