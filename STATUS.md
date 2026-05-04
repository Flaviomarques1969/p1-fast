# P1 Fast — STATUS

**Data deste checkpoint:** 2026-05-04 (após sessão massiva de port domain Swift)
**Estado:** Plano `docs/PLANO_FASE_1.md` em execução. **17 PRs mergeados nesta sessão (MS-0 a MS-9.1)**, 274 smoke tests verdes. Pipeline shift-light end-to-end + domínio canônico de trecho/erro/score/repeatability/decider em Swift.

> **Se você é Claude abrindo esta sessão pela primeira vez:**
> Leia este arquivo primeiro, depois `docs/PLANO_FASE_1.md` (doc mestre), depois `~/.claude/projects/-Users-imac/memory/MEMORY.md` (memória global) + `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/MEMORY.md` (memória do projeto).

---

## O que mudou em 2026-05-03 (decisão Flávio)

Audit honesto mostrou que "Phase 1A 100%" foi declarada por engano: cobria só Sprint 1A.1 + 1A.2 + parte da infra do 1A.3 do plano antigo. Faltavam ~22 tasks do plano mestre + tudo que estava marcado como "Fase 2" ou "dormente".

**Decisão:** não há mais Fase 2 — tudo entra em **Fase 1 única**. Detalhes em `docs/PLANO_FASE_1.md`.

---

## Sessão 2026-05-04 — 17 PRs mergeados

`swift run p1fast-smoke` final: **274 ok / 0 fail**.

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

## Estado por mini-sprint (em relação ao `docs/PLANO_FASE_1.md`)

| MS | Tema | Status |
|---|---|---|
| **MS-1.1-1.3** | Domínio canônico Swift port | ✅ feito (TrackSegment, ErrorClassifier, TrajectoryMonitor) |
| **MS-1.4** | Configurador visual de pista (UI) | ❌ não feito (precisa SwiftUI + simulator pra validar) |
| **MS-2** | LiveTelemetryRecorder | ❌ não feito (CoreMotion + GPS + Info.plist) |
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

## Próximos targets de domínio puro (estilo MS-6.x — pequenos PRs sequenciais)

Ainda em `src/domain/` há código puro (sem IO Dexie) que vale portar:
- `tire-wear.js` (113 linhas) — desgaste de pneu
- `data-quality.js` (164 linhas) — qualidade dos dados
- `stint-env.js` (77 linhas) — ambiente do stint
- `lesson-schema.js` (201 linhas) — schema de lições (parcial em Swift?)
- `fuel-calc.js` extensões (já tem base em Swift)
- `reference-line.js` — linha de referência (consumido pelo ghost map MS-14)
- `corredor.js` (em `src/telemetry/`) — corredor de pista
- `cross-validation.js` — já tem `CrossValidation.swift`, conferir paridade
- `pedagogical-plan.js` (133 linhas) — plano pedagógico (gerador de focos, alimenta MS-6.4)

Os com IO (Dexie) são port via GRDB no iOS — não são "port puro": session-master, advisor-suggestion, AdvisorSuggestions, Sessions, Laps repos.

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

## Próximo passo concreto pós-/compact

1. Ler `STATUS.md` (este arquivo) e `docs/PLANO_FASE_1.md` §6 MS-6 e MS-9
2. Continuar empilhando ports de domínio Swift (próximo: tire-wear, data-quality, ou pedagogical-plan)
3. Anunciar o PR + smoke count em cada commit
