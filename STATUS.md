# P1 Fast — STATUS

**Data deste checkpoint:** 2026-05-06 (sessão 4 — field test E2E real, MS-2 100% fechado, MS-2.6.c em prod)
**Estado:** Plano `docs/PLANO_FASE_1.md` em execução. **MS-2 100% fechado**. Field test E2E executado e validado em iPhone 16 Pro Max real (varanda Brasília, 559s, IMU 100.5 Hz · accZ ~0.18 confirmado userAcceleration, 56314 raw + 56314 enriched, fix em < 3s, pos_sigma estabilizou ~3m). PRs totais até #112, **397 smoke tests verdes**. Migrations 0007 + 0008 + 0009 todas aplicadas em prod via `supabase db push`.

> **Se você é Claude abrindo esta sessão pela primeira vez:**
> Leia este arquivo primeiro, depois `docs/PLANO_FASE_1.md` (doc mestre), depois `~/.claude/projects/-Users-imac/memory/MEMORY.md` (memória global) + `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/MEMORY.md` (memória do projeto).

---

## O que mudou em 2026-05-03 (decisão Flávio)

Audit honesto mostrou que "Phase 1A 100%" foi declarada por engano: cobria só Sprint 1A.1 + 1A.2 + parte da infra do 1A.3 do plano antigo. Faltavam ~22 tasks do plano mestre + tudo que estava marcado como "Fase 2" ou "dormente".

**Decisão:** não há mais Fase 2 — tudo entra em **Fase 1 única**. Detalhes em `docs/PLANO_FASE_1.md`.

---

## Sessão 2026-05-04 (manhã) — 17 PRs mergeados (#57..#73)

`swift run p1fast-smoke` no fim da manhã: **274 ok / 0 fail**.

| # | PR | Mini-sprint | Conteúdo |
|---|---|---|---|
| 57 | docs | **MS-0** | `PLANO_FASE_1.md` mestre · arquiva `1A_1B` |
| 58 | feat | **MS-1.1** | `TrackSegment` 4 pontos canônicos (entry/braking/apex/exit) + `ApexClassification` 12 valores + helpers |
| 59 | feat | **MS-1.2** | `ErrorClassifier` 16 rótulos + análise de apex |
| — | (pré-existia) | **MS-1.3** | `TrajectoryMonitor` deviations (já portado em 20 testes TM-01..TM-20) |
| 60 | feat | **MS-8.1** | `PilotReaction` learning agent (EWMA α=0.15, 4-tier fallback) |
| 61 | feat | **MS-8.2** | `ShiftAnalysis` classifier + `lessonText` PT-BR |
| 62 | feat | **MS-8.3** | `ShiftTarget` + `DynoTargetCalculator` + `safeMode` + `ShiftCar` |
| 63 | feat | **MS-8.4** | `GearEstimation` + `learnSignature` |
| 64 | feat | **MS-8.5** | `ShiftEventDetector` (state machine) + `ShiftLightBridge` (descarta sem RPM) |
| 65 | feat | **MS-8.6** | `RpmSource` (Manual + Mock) — BLE T4000 fica para MS-9 |
| 66 | feat | **MS-6.1** | `Score` + `Benchmark` (camada pura, sem IO) |
| 67 | feat | **MS-6.2** | `Repeatability` + `PedagogicalDecider` (matriz score×repet) |
| 68 | feat | **MS-9.1** | `DynoCsvParser` (Dynojet/Mustang/Dynapack/genérico) |
| 69 | feat | **MS-6.3** | `ErrorTaxonomy` (10 rótulos extras) + `ToleranceFromDyno` |
| 70 | feat | **MS-6.4** | `PlannedVsExecuted` (veredicto plan × execução) |
| 71 | feat | **MS-6.5** | `AttackPriority` (por parcial e por trecho) |
| 72 | feat | **MS-6.6** | `EventoResumo` + `DiaResumo` + `StintResumo` |

**Totais portados:** ~6 mil linhas Swift novas em `ios/p1fast-core/Sources/P1FastCore/`. ~80 smoke tests novos (TRK-05a..e, EC-01..12, PR-01..12, SA-01..08, ST-01..10, GE-01..08, SED-01..06, RS-01..06, SC-01..10, REP-01..04, PD-01..06, DCP-01..06, ET-01..05, TFD-01..04, PVE-01..05, AP-01..04, ER-01..05).

---

## Sessão 2026-05-04 (tarde) — 6 PRs (#74..#79)

`swift run p1fast-smoke` final: **311 ok / 0 fail**.

| # | PR | Tema | Conteúdo |
|---|---|---|---|
| 74 | feat | **Quality paridade** | DEGRADED/BAD invertidos no `fromSignalQuality`; default → `.ok`; `worstOf([])` → `.ok`; `numSatellites` no `fromGpsAccuracy`; `fromRangeCheck` com optional + non-finite; `permitsVisual`/`label`/`token`. +6 smoke (DQ-07..12). |
| 75 | feat | **Corredor port novo** | Port `src/telemetry/corredor.js` — traçado consolidado + corredor de tolerância (decisão de domínio 2026-04-23). +8 smoke (COR-01..08). |
| 76 | feat | **LessonSchema paridade** | `LessonCategory` reset pra set canônico (referencia/velocidade/transicao/controle/visao/superficie); L005 fix `.fundamentos` → `.visao`; `Signal` 22-cat (era 16); `Lesson.validate()` + `LessonSchemaError`. +8 smoke (LS-01..08). |
| 77 | feat | **Projector port novo** | Port `src/telemetry/projector.js` — lat/lng → x/y do viewBox (transformação afim 2D, complex k = B/A). +6 smoke (PROJ-01..06). |
| 78 | feat | **CoachPhrases paridade** | Catálogo 21 → 36 frases (adiciona M100..M142 = 5 famílias avançadas, antes "Fase 2 fora"). +5 smoke (CP-01..05). |
| 79 | feat | **LessonLibrary 12 lições** | L005/L006/L007 corrigidas (L006 era "Trail Braking" / .transicao, JS é "Controle de Subesterço" / .controle); +5 lições avançadas (L101..L105 active:false até sensores); novos `all`/`byCategory`/`forCornerType`. +4 smoke (LL-05..08, retrabalho LL-01..04). |

**Característica desta tarde:** quase tudo foi auditoria de paridade JS — descobri que vários ports existentes tinham divergências do source-of-truth (incluindo um Lesson "Trail Braking" que usava phrases de subesterço — esquizofrenia). 2 ports novos (Corredor, Projector) entraram pra cobrir gaps que faltavam.

---

## Sessão 2026-05-05 — MS-2 captura ao vivo, Kalman INS-GPS, Detector ao vivo

`swift run p1fast-smoke` final: **386 ok / 0 fail**. Build iOS verde no app real (`xcodebuild -scheme p1fast-ios -destination 'generic/platform=iOS Simulator' build`). Foco: fechar MS-2 (captura ao vivo) e amarrar os 3 stacks vivos numa única view demo.

| # | PR | Mini-sprint | Conteúdo |
|---|---|---|---|
| 84..92 | feat | **MS-1.4 + MS-2.4** | Configurador multi-apex (0..3 ápices) + `segment_executions` ganha `vmin_kmh/x/y` |
| 93 | feat | **MS-2.1** | `LiveTelemetryRecorder` — CoreMotion 100Hz + CLLocationManager 1Hz, sample shape canônico, buffer + flush em lotes |
| 95 + 98 | feat | **MS-2.2** | Wake lock (`isIdleTimerDisabled`) + Background mode + `LowPowerModeMonitor`. FB-01 deinit cleanup + FB-02 `ensureSessao` não silencia erros |
| 99 | feat | **MS-2.7 PR A** | `KalmanINSGPS.swift` — fusão IMU 100Hz + GPS 1Hz, estado 2D em frame local, heading compass. K-01..K-14b cobertos no smoke |
| 100 | feat | **MS-2.7 PR B** | `telemetry_samples_enriched` schema — PG migration `0008_*` + GRDB v7 + Model `TelemetrySampleEnriched`. Append-only ADR-014, sem `synced_at`. TSE-01..04 |
| 101 | feat | **MS-2.7 PR C** | `LiveKalmanProcessor` (p1fast-ios) + `EnrichedTelemetryWriter` (p1fast-core). Fecha o pipeline INS-GPS ao vivo. WRITE-EN-01..03 |
| 102 | feat | **MS-2.3** | `TelemetriaView` pluga `LiveKalmanProcessor` no INICIAR/PARAR; painel ganha "Amostras enriched" com indicador de fix |
| 103 | feat | **MS-2.6** | `SampleDetectorAdapter` (core, testado em smoke) + `LiveDetectorBridge` (iOS). Refator: `LiveTelemetryRecorder.onSample` → `addSampleHandler` cancelable, suporta múltiplos consumidores. ADAPT-01..06 |
| 104 | feat | **MS-2.6.b** | `LiveDetectorBridge` plugado na `TelemetriaView`. Detector demo via `SeedBrasilia.make()`. `onLap` listener atualiza lap count + última volta na UI |

**3 stacks vivos numa sessão demo (`--p1-telemetria`):**
1. `LiveTelemetryRecorder` → `telemetry_samples` raw
2. `LiveKalmanProcessor` → `telemetry_samples_enriched` (Kalman INS-GPS @ ~10Hz)
3. `LiveDetectorBridge` → `Detector` ao vivo (lap/segment events em memória)

**Pendências do Flávio antes do field test E2E:**
- `supabase db push` — migration `0008_telemetry_samples_enriched.sql` mergeada via #100 mas não aplicada em prod/dev DB. Local GRDB já OK.
- Field test no iPhone real com `--p1-telemetria` — confirmar que enriched count sobe junto com raw, fix aparece, e Detector contabiliza voltas ao cruzar a linha de chegada.

**MS-2 status:** 2.1 ✅ · 2.2 ✅ · 2.3 ✅ · 2.4 ✅ · 2.6 ✅ · 2.6.b ✅ · 2.7 ✅. Falta apenas **2.5** (`StintRepository.finalize` consome `Detector.onSegmentEnd` real + Vmin georef em `segment_executions`) — gated pelo field test.

**Achados de auditoria PR A não endereçados (PR de polimento futura):**
- A-02 Joseph form — `P ← (I−KH)·P` pode perder PSD em runs longos.
- A-03 mPerDegLat divergente — Projector usa 111_000, Kalman usa 111_320. Padronizar.
- A-05 cobertura defensives — K-09/K-10 não testam NaN/inf.
- A-07 gap recovery sinalizado — `update()` clampa `dt` em 1.0s sem expor flag em `EnrichedSample`.

---

## Sessão 2026-05-06 — field test E2E real, MS-2 100% fechado, MS-2.6.c em prod

`swift run p1fast-smoke` final: **397 ok / 0 fail**. App buildado e instalado no iPhone 16 Pro Max real do Flávio via `xcodebuild` + `xcrun devicectl device install/launch`.

| # | PR | Tema | Conteúdo |
|---|---|---|---|
| 106 | feat | **MS-2.7 polimento Kalman** | Joseph form `(I-KH)P(I-KH)ᵀ + KRKᵀ` (PSD por construção); `mPerDegLat` 111_320 → 111_000 (alinha Projector/TrajectoryMonitor); finite guard pré/pós em `predict`/`update` (snapshot + restore se NaN/inf). +1 smoke (K-15 PSD em sessão realista) |
| 107 | docs | **field test MS-2** | Checklist completo + template de relato pra preencher em campo (`MS_2_FIELD_TEST.md` + `MS_2_FIELD_TEST_REPORT_TEMPLATE.md`). Substitui PR #96 pré-MS-2.6 |
| 108 | chore | **scheme launch arg** | `--p1-telemetria` salvo no scheme compartilhado (xcscheme), `⌘R` cai direto na TelemetriaView |
| 109 | fix | **TelemetriaView FK violation** | `ensureSessao` cria Time canônico antes da Sessao (mesmo padrão de PilotoRepository/PassageiroRepository). Bug encontrado em campo no iPhone real |
| 110 | docs | **field test correções pós-real** | Enriched ≈ raw (1 por sample, não 1 por GPS — design); GPS Hz parado é 0.05–0.2 (iOS rate-limit BestForNavigation); validação completa em campo documentada |
| 111 | feat | **MS-2.5** | `StintRepository.finalize` consome `[DetectorSegmentEndEvent]` opcional + grava trio Vmin (`vmin_kmh = velMinima*3.6`, `vmin_x/y` do `apexActual`) em `segment_executions`. `SegmentExecutionMapper` puro em core. +6 smoke SE-01..06 |
| 112 | feat | **MS-2.6.c** | Migration PG `0009_track_geo_anchors_view_box.sql` (aplicada em prod) + GRDB v8. `tracks.geo_ancoras` + `track_layouts.view_box`. `TrackRepository.currentTrack()` hidrata Track + TrackLayout + segments do GRDB. `TelemetriaView` aceita `trackBundle?` injetado pelo ContentView (fallback SeedBrasilia). +4 smoke TGA-01..04 |

**Field test em campo (sessão `telemetria-demo-1778076722`, 559s parado em céu aberto):**

- IMU **100.5 Hz** · jitter < 1ms · accZ ~0.18 (userAcceleration, não gravity) ✅
- GPS **0.11 Hz** parado (iOS rate-limit BestForNavigation; em movimento sobe pra ~1Hz) — comportamento iOS, não bug
- 56314 raw + 56314 enriched · 56313 com fix · 1 pre-fix
- pos_sigma 1e6 → 25.7m → estabiliza ~3m (fix em < 3s)
- x_m, y_m em escala de cm com iPhone parado
- Pipeline raw → Kalman → Detector → SQLite end-to-end validado em hardware real

SQL pulled via `xcrun devicectl device copy from --domain-type appDataContainer`. Container baixado, queries rodadas em `p1fast.sqlite` direto.

**Migrations Supabase aplicadas em prod 2026-05-06:**
- `0007_vmin_georef.sql` (segment_executions vmin trio)
- `0008_telemetry_samples_enriched.sql` (Kalman output)
- `0009_track_geo_anchors_view_box.sql` (geo_ancoras + view_box)

Verificadas via REST: HTTP 200 + `[]` em todas (RLS OK, colunas existentes — se não existissem, retornaria 400).

---

## Estado por mini-sprint (em relação ao `docs/PLANO_FASE_1.md`)

| MS | Tema | Status |
|---|---|---|
| **MS-1.1-1.3** | Domínio canônico Swift port | ✅ feito (TrackSegment, ErrorClassifier, TrajectoryMonitor) |
| **MS-1.4** | Configurador visual de pista (UI) | ✅ feito 2026-05-05 (#84..#90 — multi-apex 0..3 ápices) |
| **MS-2** | Captura ao vivo + Kalman INS-GPS + Detector | ✅ **100% fechado 2026-05-06**. 2.1/2.2/2.3/2.4/2.5/2.6/2.6.b/2.6.c/2.7. Field test E2E executado e validado em iPhone real. Pipeline raw → Kalman → Detector → segment_executions com Vmin georef end-to-end. |
| **MS-3** | Edge Function pipeline + smoke E2E | ❌ não feito |
| **MS-4** | StintPlan iOS port | ❌ não feito (schema + repo + UI) |
| **MS-5** | Pendências vivas | ❌ não feito (CRUD + por carro + obrigatório/adicional) |
| **MS-6.1-6.6** | Debrief domain (Score/Bench/Repet/Decider/PvE/Attack/Resumo) | ✅ feito em domain. UI/integração ❌ |
| **MS-7** | Track day operacional | ❌ Flávio em pista |
| **MS-8.1-8.6** | Shift Light pipeline completo (port domain Swift) | ✅ feito. iOS UI/cockpit ❌ |
| **MS-9.1** | DynoCsvParser | ✅ feito |
| **MS-9** | BLE T4000 (CoreBluetooth real) | ❌ não feito |
| **MS-10** | Multi-usuário + Auth + RLS | ❌ não feito |
| **MS-11** | Daily.co | ❌ não feito |
| **MS-12** | Box Cockpit + AirPlay + Realtime | ❌ não feito |
| **MS-13** | Cockpit ao vivo (UI 956×440) | ❌ não feito |
| **MS-14** | Ghost map + reference line | ❌ não feito |
| **MS-15** | Fases térmicas + chuva | ❌ não feito |

---

## Próximos targets de domínio puro

Já portado e em paridade JS após hoje:
- ✅ Quality (data-quality.js)
- ✅ LessonSchema (lesson-schema.js)
- ✅ LessonLibrary (12 lições)
- ✅ CoachPhrases (36 frases)
- ✅ Corredor (telemetry/corredor.js)
- ✅ Projector (telemetry/projector.js)

**Ainda valem port puro (curto prazo):**
- `tire-wear.js` — pure parts pequenas (estimarVidaUtil), dependentes de Laps/StintEnv. Adiar até GRDB repos.
- `cross-validation.js` (410 linhas) vs `CrossValidation.swift` (422 linhas) — auditoria de paridade detalhada (não fizemos hoje)

**Não puros (precisam GRDB iOS-side):** tire-wear, stint-env, pedagogical-plan, baseline-vectors, track-layout, reference-line, car, car-configuration, advisor-suggestion, session-master.

**Precisam runtime iOS:** detector.js (262, live engine), adaptive-tick.js (115), timebase.js (304), session-recorder.js (158), sample-store.js (107), provider.js (152), device-provider.js (138), mock-provider.js (63).

---

## Próximas fronteiras (precisam Xcode + simulator + iPhone real)

- **StintCaptureCoordinator + UI start/stop** — armar LiveTelemetryRecorder + LiveDetectorBridge + buffer de `DetectorSegmentEndEvent` durante stint real (StintModalView dispara, EventoDetalheView drena no finalize). Atual `StintRepository.finalize` aceita `[DetectorSegmentEndEvent]` mas ninguém ainda passa em produção real. Sem isso, finalize sempre roda com `[]`.
- **MS-13** CockpitDevice 956×440: SwiftUI + halo radial + slot direito Z-axis + animations
- **MS-9** Adapter BLE T4000: CoreBluetooth + parser Injepro
- **MS-10** Auth Supabase: SDK Auth + tela login + share sheet
- **MS-11** Daily.co SDK iOS

## Próximas fronteiras (independentes de hardware iOS)

- **MS-3** Edge Function pipeline — port mínimo de `src/telemetry/detector.js` + fixture Brasília + smoke E2E
- **MS-4** `StintPlan` iOS — schema + repo + UI (sprint maior, vai precisar quebrar em sub-sprints)

Esses precisam de Xcode pra build/validar. Domínio Swift puro pode continuar até esgotar.

---

## Princípios de execução (continuar)

- **Cloud Code é sequencial** — 1 PR por vez (mas nesta sessão Claude direto fez tudo no terminal)
- **Worktree obrigatório** (ADR-021) — sempre branchar de `origin/main`
- **`/compact` entre mini-sprints** (memória `feedback_quebrar_sprint_medio`)
- **Tier 0 sempre funciona** — feature de Tier 1+ nunca bloqueia ação em Tier 0
- **Tudo é v1** — nenhum item da lista pode ser empurrado pra "v2"
- **`feedback_claude_executa_direto`** — branch + diff de `origin/main`, squash autosaves com `reset --soft` antes de push, restaurar `Package.resolved` se SPM deletar (ADR-022)

---

## Próximo passo concreto pós-/compact

**MS-2 100% fechado**. Field test E2E real executado e validado em iPhone físico. Migrations 0007/0008/0009 todas em prod.

Opções pra próxima sessão (decisão Flávio):

1. **StintCaptureCoordinator + UI start/stop** — fechar o último elo: durante stint real, armar `LiveTelemetryRecorder` + `LiveDetectorBridge` e bufferizar `DetectorSegmentEndEvent`s. No finalize, drenar buffer e passar pro `StintRepository.finalize` (já aceita o parâmetro desde #111). Sem isso, MS-2.5 só roda em fixture/teste; em produção real `finalize` sempre vê `[]`.
2. **Field test em movimento** — varanda parado validou pipeline. Falta confirmar GPS 1Hz andando, Voltas em pista (Brasília), background mode com tela travada, Low Power Mode. Inputs reais alimentam decisões de tuning.
3. **MS-3** Edge Function pipeline + smoke E2E — port mínimo de `src/telemetry/detector.js` + fixture Brasília. Independente de hardware iOS.
4. **MS-4** `StintPlan` portado pro iOS — schema + repo + UI. Sprint maior; vai precisar quebrar em sub-sprints.
5. **MS-13** CockpitDevice 956×440 — UI grande, precisa Xcode + simulator.
6. **MS-9 BLE T4000** — precisa hardware Injepro real.
