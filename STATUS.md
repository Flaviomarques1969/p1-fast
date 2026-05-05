# P1 Fast — STATUS

**Data deste checkpoint:** 2026-05-05 (sessão pivot pra captura ao vivo + arquivamento P1 Coach Vision)
**Estado:** Plano `docs/PLANO_FASE_1.md` em execução. Total 30 PRs mergeados (#57..#92), 358 smoke tests verdes. **4 PRs abertas** (#93/#94/#95/#96) aguardando teste em campo no iPhone real antes de mergear. Pivot importante: MS-2.5 desbloqueada só após MS-2.1/2.2/2.3.

## Sessão 2026-05-05 — pivot e PRs abertas

| PR | Estado | Tema |
|---|---|---|
| #84..#90 | mergeado | MS-1.4 (configurador multi-apex) + multi-apex schema/UI 0..3 ápices |
| #91 | mergeado | CI paths-filter + concurrency + tira `push:main` (resolve estouro Actions) |
| #92 | mergeado | **MS-2.4** — `segment_executions` ganha `vmin_kmh/x/y` (schema-only) |
| **#93** | aberto | **MS-2.1** — LiveTelemetryRecorder (CoreMotion 100Hz + GPS 1Hz no app real) |
| **#94** | aberto | docs: P1 Coach Vision arquivada (renomeado de Fast Coach) |
| **#95** | aberto | **MS-2.2** — wake lock + GPS background + LowPowerModeMonitor (stacked em #93) |
| **#96** | aberto | docs: checklist de teste em campo MS-2.1+2.2 |

Auto-review pré-teste em `docs/FIX_BACKLOG_MS_2_1_2_2.md` — 11 itens (2🔴 alta, 4🟡 média, 5🟢 polish). FB-01 (deinit não para captura → wake lock leak) e FB-02 (ensureSessao silencia erros) valem fixar antes de mergear.

**Pivot reconhecido:** o checkpoint anterior dizia "MS-2.5 a fazer agora". Auto-revisão mostrou que MS-2.5 (`StintRepository.finalize` consumindo Detector) é exercício acadêmico sem MS-2.1/2.2/2.3 prontas + telemetria viva no app. MS-2.5 fica gated em MS-2.1/2.2/2.3 + 1-2 sessões reais com Vmin gravado.

**P1 Coach Vision:** spec gigante de Fast Coach virou doc de visão `docs/P1_COACH_VISION.md` (renomeado pra consolidar com `P1Coach.swift` existente). NÃO implementar até pré-requisitos: telemetria viva + volta de referência + heading confiável + linha de corrida cadastrada.

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

## Estado por mini-sprint (em relação ao `docs/PLANO_FASE_1.md`)

| MS | Tema | Status |
|---|---|---|
| **MS-1.1-1.3** | Domínio canônico Swift port | ✅ feito (TrackSegment, ErrorClassifier, TrajectoryMonitor) |
| **MS-1.4** | Configurador visual de pista (UI) | ✅ feito (PRs #84..#88, multi-apex 0..3 ápices) |
| **MS-2.1** | LiveTelemetryRecorder | 🟡 PR #93 aberta (build verde, aguarda teste iPhone) |
| **MS-2.2** | Wake lock + background mode | 🟡 PR #95 aberta (stacked em #93) |
| **MS-2.3** | Botão amarra captura ao stint (Aqui — Flávio) | ❌ não feito |
| **MS-2.4** | `segment_executions.vmin_kmh/x/y` | ✅ mergeado (#92) |
| **MS-2.5** | `StintRepository.finalize` consome Detector real | ⏸️ gated em 2.1/2.2/2.3 + sessões reais |
| **MS-2.6** | Wire Detector ↔ telemetry pipeline | ⏸️ gated em 2.1/2.2/2.3 |
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

## Próximas fronteiras (precisam Xcode + simulator do Flávio)

- **MS-1.4** Configurador visual: drag dos 4 pontos no mapa (SwiftUI + Path/Canvas)
- **MS-2** LiveTelemetryRecorder: CoreMotion 100Hz + CLLocationManager 1Hz + Wake Lock + Info.plist permissions + Background mode
- **MS-13** CockpitDevice 956×440: SwiftUI + halo radial + slot direito Z-axis + animations
- **MS-9** Adapter BLE T4000: CoreBluetooth + parser Injepro
- **MS-10** Auth Supabase: SDK Auth + tela login + share sheet
- **MS-11** Daily.co SDK iOS

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

## Próximo passo concreto

1. **Flávio testa #93 + #95 no iPhone real** seguindo `docs/MS_2_1_2_2_FIELD_TEST.md`. ~10 min, qualquer lugar com céu aberto.
2. Se 7/8 passarem → mergear #93 → #95 (#95 vira automaticamente baseada em main).
3. **MS-2.3 (Aqui — Flávio)**: botão no `StintModalView` que dispara `LiveTelemetryRecorder` no início do stint real e finaliza no encerramento.
4. Ao menos 1 sessão real com Vmin gravado → desbloqueia MS-2.6 (wire Detector) → MS-2.5 (StintRepository.finalize consome eventos).

Antes de mergear #93 + #95, considerar fix de FB-01 + FB-02 (`docs/FIX_BACKLOG_MS_2_1_2_2.md`). 10 min, baixo risco.

Outras frentes paralelas (sem depender de teste em campo):
- **Detector live engine port** — 262 linhas JS → Swift. Já existe `Detector.swift` em core; auditoria de paridade vale.
- **Auditoria CrossValidation paridade** — 410 linhas JS vs 422 Swift, achar divergências.
- **MS-13** Cockpit ao vivo 956×440 (precisa Xcode + simulator).
- **MS-9** Adapter BLE T4000 (precisa hardware Injepro).
