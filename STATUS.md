# P1 Fast — STATUS

**Data deste checkpoint:** 2026-05-13 (sessão MS-16 — Command Box Engenharia entregue ponta-a-ponta em domain layer)
**Estado:** Plano `docs/PLANO_FASE_1.md` em execução. **MS-2 + MS-3 + MS-16.1..16.5a fechados em main.** Mini-sprint novo **MS-16 (Command Box Engenharia)** entregue em 6 PRs (#194..#199): auditoria + 3 camadas (Engine Core + Calibration Engine + Senior Advisor IA) + Tab Engenharia domain (gating D17/D18 fechadas). **UI SwiftUI fica pra MS-16.5b** quando Xcode pegar (camada domain pura toda em main, smoke verde). Detalhes em `docs/COMMAND_BOX_ENGENHARIA.md` + `docs/SESSION_HANDOFF_2026-05-13_pre-clear.md`.

> **Se você é Claude abrindo esta sessão pela primeira vez:**
> Leia este arquivo primeiro, depois `docs/PLANO_FASE_1.md` (doc mestre), depois `docs/SESSION_HANDOFF_2026-05-13_pre-clear.md` se vier do "voltei" do Flávio, depois `~/.claude/projects/-Users-imac/memory/MEMORY.md` (memória global) + `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/MEMORY.md` (memória do projeto).

---

## Sessão 2026-05-13 — MS-16 Command Box Engenharia (auditoria + Camadas 1/2/3 + UI domain)

`swift run p1fast-smoke` em CI macos-14 verde em todos os PRs. Tab Engenharia domain pronto pra Views SwiftUI consumirem.

| # | PR | Sub-sprint | Conteúdo |
|---|---|---|---|
| 194 | docs | **MS-16.0** | `docs/COMMAND_BOX_ENGENHARIA.md` (~970 linhas) — auditoria profunda do sistema existente + arquitetura aprovada em 3 camadas. Refinada por 4 clarificações do Flávio. 7 decisões fechadas (D1, D2+D3, D6, D14, D17, D18). Bloco MS-16 em `PLANO_FASE_1.md` §6. |
| 195 | feat | **MS-16.1** | `TelemetryTimebase.swift` (porte 1:1 de `timebase.js`) — sincronização multi-fonte, freshness, LATE/MISSING. Smokes TB-01..12 (Swift) + TPB-01..12 (Node parity). Resolve gap G1. |
| 196 | feat | **MS-16.2** | `VehicleContextAggregator.swift` — modelo contextual evolutivo (lap window + stint history + thermal phase + Vmin trend). Helpers `waterTempDriftPerMinute()` + `vminTrend()`. Smokes VCA-01..10. Resolve gap G2. Fix lateral: `public init` em `DetectorLapEvent` + `DetectorSegmentStartEvent`. |
| 197 | feat | **MS-16.3** | `CalibrationEngine` + 3 rules MVP (`fuel-lean-sustained-load`, `water-temp-drift-no-cooling`, `vmin-progressive-loss-segment`) + tipos `EngineeringFinding`/`EngineeringRecommendation` + migrations 0020/0021 Supabase (RLS por time, insert-only findings). Smokes CE-01..15. Resolve gaps G3 + G4. |
| 198 | feat | **MS-16.4** | `/api/advisor.js` aceita `findings[]` opcional. System prompt ganha §"FINDINGS CODIFICADOS" (governança IA: priorizar, explicar, validar, não contradizer). Smokes node AF-01..09. Schema-parity atualizado pra 30 tabelas PG com `PG_ONLY_TABLES` set excluindo as 2 novas da cobertura GRDB. |
| 199 | feat | **MS-16.5a** | `EngControlModel` + `EngineeringDecisionPolicy` (domain puro, sem UIKit). Slider/knob/toggle com clamp + snap + permission gating (D17 fechada). Transitions pendente→aprovada/editada/rejeitada com regras D8. Smokes ECM-01..12. **Views SwiftUI ficam pra MS-16.5b** (precisa Xcode). |

**Totais nesta sessão:** ~4.600 linhas Swift + JS novas. 67 testes automáticos novos verdes. 6 PRs (1 docs + 5 código), todos squash-merged em sequência (#194 → 0bdafd9, #195 → b84a2a9, #196 → 639ec1e, #197 → 57c552a, #198 → 430d151, #199 → 2ee12a3).

**Decisões fechadas 2026-05-13 (7):**
- **D1** — Aprovar MS-16 como novo mini-sprint
- **D2+D3** — UI = iOS Box Mode → AirPlay → Apple TV → TV 32" + Cockpit Pilot 10,5" como canal contextual. Notebook fica kiosk; operação só pelos iPhones (chefe + engenheiro + piloto, cada um no seu)
- **D6** — Catálogo MVP = 3 rules (fuel-lean, water-drift, vmin-loss)
- **D14** — Heurística carro parado/andando absorvida por D18
- **D17** — Piloto edita/simula no celular só com carro parado; chefe + engenheiro livres a qualquer momento
- **D18** — Switch padrão piloto ↔ engenharia no Cockpit Pilot é **automático** via `cockpitModeResolver`: `(modulo_engenharia_ativado) AND (carro_parado)` → padrão ENGENHARIA; resto → padrão PILOTO; voltar a andar força PILOTO imediato

**Decisões abertas (13):** D4 (granularidade célula), D5 (mapa ECU upload — pular no MVP), D7 (confiança mínima recommendation — default `Média` no código), D8 (RLS UPDATE refinado por papel), D9 (Realtime cross-device decisão), D10 (pilotagem×mecânica), D11 (IA→piloto), D12 (calibração Celta), D13 (simulação sem mapa real), D15 (catálogo overlays Cockpit Pilot), D16 (publishers canal), D19 (latência ~250ms slider→propagação), D20 (onde persistir flag módulo engenharia). Nenhuma bloqueia o caminho.

**Pendências do Flávio (fora do escopo do Claude):**
- Aplicar migrations `0020_engineering_findings.sql` + `0021_engineering_recommendations.sql` em prod via `supabase db push`. Versionadas em main mas NÃO aplicadas.
- MS-16.5b (Views SwiftUI) quando Xcode aberto — toda lógica de domain já em main.

**Próximo passo concreto (pós-/clear):** Ver `docs/SESSION_HANDOFF_2026-05-13_pre-clear.md`.

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

**Estado consolidado das migrations em prod (auditoria 2026-05-12):** todas as 15 migrations (0001 a 0015) estão aplicadas em produção. Conferência via REST anon contra `fvhwltzhytpnhlqbttmd.supabase.co`:
- `0006_v2_schema_columns.sql` — `sessoes.pneu_id`, `sessoes.combustivel_id`, `pilotos.altura_cm` retornam 200.
- `0007_vmin_georef.sql` — `segment_executions.vmin_kmh` retorna 200.
- `0008_telemetry_samples_enriched.sql` — tabela `telemetry_samples_enriched` retorna 200.
- `0009_track_geo_anchors_view_box.sql` — `tracks.geo_ancoras` + `track_layouts.view_box` retornam 200.
- `0010_kalman_gap_duration.sql` — `telemetry_samples_enriched.gap_duration_ms` retorna 200.
- `0011_ensure_personal_team.sql` — RPC retorna 401 com mensagem "requires authenticated user" (função existe; se não existisse, retornaria 404).
- `0012_seed_brasilia.sql` — row tracks com UUID `e8335412-…` retorna 200.
- `0013_set_updated_at_respects_client.sql` — implícito (0015 depende e está aplicada).
- `0014_ms4_sessoes_extensions.sql` — `sessoes.paradas_box`, `ia_ligada`, `licao_id`, `cancelado_em` retornam 200.
- `0015_ms11_video_streams.sql` — tabela `video_streams` + `eventos.link_publico_video_token` retornam 200.

A nota "aplicar manualmente após merge" que aparece em algumas migrations e em PENDENCIAS_GATE.md está desatualizada: o ciclo manual já foi feito. Não há migrations pendentes de aplicação em produção a partir de 2026-05-12.

---

## Sessão 2026-05-09 — virada arquitetural cockpit pra Windows (ADR-023)

Sem código nesta sessão — só docs. Flávio decidiu que o cockpit-display ao vivo do piloto migra do iPhone (SwiftUI, MS-13 antigo) pra um **notebook Windows 10,5"** montado no painel do carro. Motivo é de produto: tela maior melhor posicionada, mais legível na pista que o iPhone preso em suporte.

**Papéis na nova arquitetura:**

| Aparelho | Função |
|---|---|
| Notebook Windows 10,5" | Cockpit-display ao vivo (web app), driver T4000 (USB/CAN), processamento ao vivo. |
| iPhone 16 Pro Max | Captura IMU 100Hz + GPS 1Hz, câmera onboard frontal (Daily.co), agregador, uploader pra Supabase. **Sem cockpit-display ativo durante a pilotagem.** |
| Apple TV (Box Cockpit) | Inalterado. |

**Transporte iPhone↔Windows:** **redundante (decisão 2 — 2026-05-09)**: cabo USB primário (TCP-over-USB via `iproxy`/`usbmuxd`, latência 5-15 ms) + Supabase Realtime fallback automático. Notebook escolhe via `TransportSelector` (heartbeat 1 Hz, switch em 3 s de silêncio, recovery com debounce 1 s). Cabo USB iPhone↔notebook agora carrega **dado + carga** (não só carga).

**Mudanças no plano:**
- **ADR-023 nova** — Windows como plataforma de cockpit-display + driver T4000.
- **ADR-023 amendment 2** — transporte iPhone↔Windows passa pra **redundante: cabo USB primário (TCP-over-USB via `iproxy`/`usbmuxd`, 5-15 ms) + Supabase Realtime fallback** (decisão 2 do Flávio em 2026-05-09).
- **ADR-018 amendment** — captura iOS continua mandatória; cockpit-display saiu pra Windows.
- **MS-9 reescrito** — deixa de ser BLE iOS, vira driver T4000 USB/CAN no Windows + publish Realtime. Move pra antes de MS-13.
- **MS-13 reescrito** — deixa de ser SwiftUI 956×440, vira web app no Windows 10,5" baseado no `mockup-cockpit-piloto.html`.
- **MS-2.8 reescrito** — publish IMU/GPS agregado a 10 Hz em **dois canais simultâneos** (TCP socket local `127.0.0.1:5050` via cabo + Supabase Realtime). Heartbeat 1 Hz em ambos pra healthcheck.
- **MS-13.4 reescrito** — `LiveDataBridge` usa `TransportSelector` pra escolher cabo↔Realtime.
- **MS-12 Box Cockpit** — inalterado.
- **MS-11 Daily.co** — papel da câmera onboard fica explícito (frente do carro).

**Entregue nesta sessão (PR #148, branch `claude/develop-pilot-cockpit-ZxMLY`):**
- Docs: ADR-023 + amendments 2 e 3; PLANO §2/§6/§10; STATUS; CLAUDE.md.
- MS-9.2 — `src/telemetry/t4000-packet-parser.js` (parser CAN canônico, fixture `0x91`) + 27 smokes.
- MS-9.4 — `src/telemetry/t4000-provider.js` (adapter standalone) coberto pelos mesmos 27 smokes.
- MS-13.2 — `web/cockpit/{index.html, cockpit.css, cockpit.js}` extraídos byte-for-byte do mockup canônico + 16 smokes de paridade.
- MS-13.3 — `web/cockpit/cockpit-state.js` (modelo puro JS) + 24 smokes.
- MS-13.4 parte 1 — `web/cockpit/transport.js` (TransportSelector com healthcheck + failover) + 17 smokes.
- MS-13.4 parte 2 — `web/cockpit/live-data-bridge.js` (T4000 → CockpitState com regras RPM→shift e alertas críticos) + 26 smokes.
- MS-13.4 parte 3 — `web/cockpit/cockpit-renderer.js` (observer CockpitState→DOM canônico) + 17 smokes.
- MS-13.4 parte 4 — `web/cockpit/main.js` + `web/cockpit/index-live.html` (bootstrap + entry point com mock data) + 7 smokes.
- **134 smokes novos** verdes em cima de 404 → **538 verdes** total.

**ADR-023 amendment 3 (Flávio 2026-05-09):** **produto final do cockpit Windows e do hub iPhone é NATIVO** (não web/PWA). O conteúdo de `web/cockpit/` é referência executável + protótipo: serve pra demonstrar visualmente o mockup hoje, provar a lógica de domínio com smokes verdes, e ser portado pra app nativo Windows quando ele for construído.

**ADR-023 amendment 4 (Flávio 2026-05-09):** stack Windows nativa = **WinUI 3 + C# (.NET 8)**. Decisão final. Atende 100% do mockup canônico (OKlch, 8 keyframes, blend modes, perspective 3D, blur), latência estado→pixel ~16-17 ms, zero licença, sem restrição comercial em stores. Próximo passo prático: criar `windows/cockpit/` solution C# e portar `CockpitState` JS → C# com xUnit equivalente aos smokes JS.

**Gates pra próxima etapa:**
- **MS-9.0** — decisão container Windows (browser+WebSerial vs Electron). Sua decisão.
- **MS-9.1** — captura real do barramento T4000. Você mencionou que faz hoje.
- **MS-13.4 (parte 2)** — `LiveDataBridge` pluga TransportSelector + T4000Provider no CockpitState. Faz a seguir.
- **CockpitRenderer** — observa CockpitState, escreve nos data-attrs do `web/cockpit/index.html`. Próximo passo natural.
- **MockSource** — alimenta o cockpit em desenvolvimento. Espera a base de 3 voltas que você mencionou.

**Spec do T4000 já estava pronta:** `docs/hardware/T4000_CAN_SPEC.md` (264 linhas) confirmou frame 5 pacotes, big-endian, 1 Mbit/s, checksum validado matematicamente. T4000 do Celta tem USB traseiro nativo + CAN bus + Bluetooth. 3 dúvidas residuais não-bloqueantes (diferenciação dos 5 pacotes, bytes 2-6 do pacote 5, range max EGT) ficam pra captura real.

**Tarefa do Flávio aberta nesta sessão:** integração T4000↔Windows hoje. Captura real do barramento resolve as 3 dúvidas residuais.

**Próximo passo concreto:** decidir container Windows (browser puro com WebSerial vs Electron) — MS-9.0. Depende de captura real (9.1) pra fechar o parser (9.2-9.4).

---

## Sessão 2026-05-06 (tarde) — field test em movimento, A-05/A-07, Edge Function

`swift run p1fast-smoke` final: **404 ok / 0 fail**. 7 PRs entregues, todos mergeados em main.

| # | PR | Tema | Conteúdo |
|---|---|---|---|
| 114 | feat | **MS-2.5 Coordinator** | `StintCaptureCoordinator` + `StintCaptureView` UI start/stop. Caller real do `StintRepository.finalize(stintId:, segmentEvents:)` — antes ninguém passava em produção. Tier 0 graceful: `trackBundle` opcional. |
| 115 | feat | **MS-3** | Edge Function `supabase/functions/detector/` — port `path-mapper.ts` + `detector.ts` + `pipeline.ts` puros + `index.ts` Edge Runtime + `detector_test.ts` (Deno, 6/6 fixture sintética). |
| 116 | test | **A-05** | K-16/17/18 cobertura defensives Kalman (NaN/inf em accX/accY/lat). Finite guard pré/pós existia desde #106 mas sem smoke do caminho de rejeição. |
| 117 | feat | **A-07 lógica** | Kalman gap recovery: `lastUpdateTMono`, `gapResetThresholdMs = 5_000`, `resetCovarianceForGap()` em update e early-return em predict. `EnrichedSample.gapDurationMs: Double?` exposto. K-19/20/21 novos. |
| 118 | feat | **A-07 persistência** | Migration 0010 PG + GRDB v9 + `TelemetrySampleEnriched.gapDurationMs` + writer mapeia coluna + `LiveKalmanProcessor.lastGapDurationMs` + `StintCaptureView.gapBanner` ("captura interrompida X s · ok"). TSE-05 round-trip. |
| 119 | feat | **MS-2.x bg visibility** | `NSLocationAlwaysAndWhenInUseUsageDescription` + `requestAlwaysAuthorization()`. `LiveTelemetryRecorder` ganha 3 @Published (`backgroundTransitionCount`, `lastBackgroundDurationMs`, `isInBackground`) populados via UIApplication notifications. `TelemetriaView` mostra row "Background". |
| 120 | fix | **CrossValidation paridade** | `ValidationEvent.confianca: String?` + emit anota "Alta" (paridade JS L106-115). `mPerDeg = 111_320 → 111_000` em raio circunscrito (alinha A-03 que ficou solta em #106). |

**Field test 2026-05-06 (sessão telemetria-demo-1778076722, 2h andando na rua):**

Pull do container via `xcrun devicectl device copy from`. SQLite mostrou:

| Janela | Duração | IMU Hz | GPS Hz | Avaliação |
|---|---|---|---|---|
| 1 | 71s | 100.9 ✅ | 0.30 | parado/início |
| 2 | 465s | 105.6 ✅ | 0.09 | parado |
| 3 | 408s | 93.7 ✅ | **0.94 ✅** | **andando** |
| 4 | 100s | 101.5 ✅ | **1.01 ✅** | **andando** |

- **GPS 1 Hz andando confirmado** — última peça que faltava do field test parado.
- **IMU 100 Hz dentro de cada janela** — pipeline raw OK.
- **4 janelas em 7446s** — 87% do tempo o IMU não capturou. iOS pausou CoreMotion em background (UIBackgroundModes.location não cobre IMU).
- **`pos_sigma_max = 2.98e+55`** — Kalman explodiu nos gaps. Fix em #117.

**Migration aplicada em prod 2026-05-06:** `0010_kalman_gap_duration.sql` (`ALTER TABLE telemetry_samples_enriched ADD COLUMN gap_duration_ms`). Verificada via REST: HTTP 200 + `[]`.

**Edge Function `detector` deployed:** `https://fvhwltzhytpnhlqbttmd.supabase.co/functions/v1/detector`. Smoke contra endpoint real (anon JWT) retorna `{"error":"invalid-jwt","detail":"invalid claim: missing sub claim"}` — confirma routing + runtime + lógica de auth do `index.ts`. Pra teste full precisaria user-token bound.

---

## Estado por mini-sprint (em relação ao `docs/PLANO_FASE_1.md`)

| MS | Tema | Status |
|---|---|---|
| **MS-1.1-1.3** | Domínio canônico Swift port | ✅ feito (TrackSegment, ErrorClassifier, TrajectoryMonitor) |
| **MS-1.4** | Configurador visual de pista (UI) | ✅ feito 2026-05-05 (#84..#90 — multi-apex 0..3 ápices) |
| **MS-2** | Captura ao vivo + Kalman INS-GPS + Detector | ✅ **100% fechado 2026-05-06**. + #114 Coordinator, #117/#118 A-07 gap recovery (lógica + persistência), #119 background visibility. Field test em movimento confirmou GPS 1 Hz e expôs iOS-bg-kill — mitigado e visível. |
| **MS-3** | Edge Function pipeline + smoke E2E | ✅ feito #115 + deployed em prod 2026-05-06 (`fvhwltzhytpnhlqbttmd/functions/v1/detector`). Smoke Deno 6/6. |
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
- ~~`cross-validation.js` paridade detalhada~~ — feito 2026-05-06 #120. JS aposentado mantido como referência; achados (confianca anotada, mPerDeg 111_000) corrigidos no Swift.

**Não puros (precisam GRDB iOS-side):** tire-wear, stint-env, pedagogical-plan, baseline-vectors, track-layout, reference-line, car, car-configuration, advisor-suggestion, session-master.

**Precisam runtime iOS:** detector.js (262, live engine), adaptive-tick.js (115), timebase.js (304), session-recorder.js (158), sample-store.js (107), provider.js (152), device-provider.js (138), mock-provider.js (63).

---

## Próximas fronteiras (precisam Xcode + simulator + iPhone real)

- ~~**StintCaptureCoordinator + UI start/stop**~~ — feito #114. Falta Flávio refazer field test com fluxo de stint real (criar evento → "Novo stint" → andar → ENCERRAR) pra exercitar o caminho.
- **Field test refazer** — pendência aberta. Flávio reinstala build com #114-#120 + 0010 em prod, anda na rua, manda app pro background pra ver se row "Background" + `gap_duration_ms` capturam corretamente. Sem novo field test, A-07 e bg-visibility não estão validadas em hardware real.
- **MS-13** CockpitDevice 956×440: SwiftUI + halo radial + slot direito Z-axis + animations
- **MS-9** Adapter BLE T4000: CoreBluetooth + parser Injepro
- **MS-10** Auth Supabase: SDK Auth + tela login + share sheet
- **MS-11** Daily.co SDK iOS

## Próximas fronteiras (independentes de hardware iOS)

- ~~**MS-3** Edge Function pipeline~~ — feito #115 + deployed.
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

**Próximo passo concreto pós-/clear (atualizado 2026-05-10):**

**Port C# da camada Domain do cockpit Windows ENTREGUE em 2026-05-10** (PR #148, branch `claude/develop-pilot-cockpit-ZxMLY`). Os 5 módulos do `SESSION_HANDOFF_2026-05-09_pre-clear.md` estão fechados, com **94 testes automáticos verdes** rodando em CI nova `windows-cockpit.yml` (ubuntu-latest, .NET 8 puro):

| Módulo | Arquivo C# | Equivalente JS | Testes verdes |
|---|---|---|---|
| 1 | `CockpitState` + records | `web/cockpit/cockpit-state.js` | 24 (CST-01..24) |
| 2 | `T4000PacketParser` + `T4000PacketFeeder` | `src/telemetry/t4000-packet-parser.js` | 23 (T4K-01..23) |
| 3 | `T4000Provider` | `src/telemetry/t4000-provider.js` | 4 (T4K-24..27) |
| 4 | `TransportSelector` + `MockTransport` + `ITransport` | `web/cockpit/transport.js` | 17 (TRP-01..17) |
| 5 | `LiveDataBridge` (RpmToShift, CheckCriticalAlerts) | `web/cockpit/live-data-bridge.js` | 26 (LDB-01..26) |

Próxima fase do cockpit Windows = camada XAML/WinUI 3 (consome o Domain via observer do `CockpitState`). Quando entrar, a CI passa a precisar de runner `windows-latest`.

**Sessão 2026-05-10 (tarde) — logo + rotação:**

- **PR #167 merged** (logo P1 Fast no `.exe`, Caminho A do diagnóstico): `Assets/P1Fast.ico` multi-resolução (256→16 px) gerado de `ios/p1fast-ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png` via ImageMagick + `<ApplicationIcon>` no `.csproj`. Mantém `WindowsPackageType=None` (sem MSIX). Caminho B (MSIX completo, item 5 do roadmap) fica pra outro PR.
- **PR #166 aberta — rotação 180° controlada pelo app (ADR-023 amendment 6):** `RotateTransform` na raiz do XAML + Ctrl+R toggle, persiste por display em `%LOCALAPPDATA%\P1Fast.Cockpit\rotation.json`. CI `ui-build` vermelho — 3 tentativas às cegas falharam. **Bloqueada aguardando `/ultrareview 166` rodado da sessão local do Mac** (não roda na web do Claude Code) pra ver o erro real do compilador.

**Pendências externas aguardando Flávio:**
- Captura real do barramento T4000 (resolve as 3 dúvidas residuais do `T4000_CAN_SPEC.md`).
- Base de 3 voltas (path enviado é worktree local; precisa push ou outra entrega).

---

## Próximo passo concreto pós-/compact (atualizado 2026-05-09)

**Virada arquitetural 2026-05-09 (ADR-023):** cockpit migra pra Windows. MS-9 reescrito (Windows USB/CAN), MS-13 reescrito (web app), MS-2.8 nova (publish Realtime).

**Caminho crítico:**

1. **Captura real do barramento T4000 no notebook Windows** (Flávio, MS-9.1) — destrava as 3 dúvidas residuais do `T4000_CAN_SPEC.md` e libera o parser. Flávio mencionou que faz hoje.
2. **Decisão container Windows** (MS-9.0) — browser puro com WebSerial vs Electron. Critérios: facilidade de empacotamento, reuso do JS de domínio, distribuição.
3. **MS-9.2-9.5 sequencial no Cloud Code** — parser, reader, provider, publisher Supabase Realtime.
4. **MS-13.1 medir notebook real** (Flávio, físico) — resolução nativa, DPR, área útil descontando barra de tarefas. Define dimensão alvo do cockpit.
5. **MS-13.2-13.7 cockpit web app no Windows** — adapta o mockup canônico pro produto.
6. **MS-2.8 publish IMU/GPS Realtime** — pode entrar em paralelo com MS-9, depende só do canal Realtime estar configurado no Supabase.

**Pendência iOS aberta de antes (não bloqueia o cockpit Windows):** refazer field test com build da main pós-#119 — validar `pos_sigma` bounded, `gap_duration_ms`, row Background, banner "captura interrompida". Vira gate só pra mexer em `LiveTelemetryRecorder`/`LiveKalmanProcessor` de novo.
