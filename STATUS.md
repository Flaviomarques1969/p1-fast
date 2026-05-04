# P1 Fast — STATUS

**Data deste checkpoint:** 2026-05-03 (após audit honesto + reescrita do plano)
**Estado:** Plano consolidado em `docs/PLANO_FASE_1.md` (mestre vigente). Antigo `PLANO_FASE_1A_1B.md` arquivado em `docs/_archive/`. Próximo passo: **MS-1 (Domínio canônico Swift port)**.

> **Se você é Claude abrindo esta sessão pela primeira vez:**
> Leia este arquivo primeiro, depois `docs/PLANO_FASE_1.md` (doc mestre), depois `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/MEMORY.md`.

---

## O que mudou em 2026-05-03 (decisão Flávio)

Audit honesto mostrou que "Phase 1A 100%" foi declarada por engano: cobria só Sprint 1A.1 + 1A.2 + parte da infra do 1A.3 do plano antigo. Faltavam ~22 tasks do plano mestre + tudo que estava marcado como "Fase 2" ou "dormente" (Shift Light Premium, T4000, fases térmicas, ghost map, multi-usuário, Daily.co, box, cockpit ao vivo).

**Decisão:** não há mais Fase 2 — tudo entra em **Fase 1 única**. v1 do P1 Fast é o app completo. Detalhes em `docs/PLANO_FASE_1.md`.

---

## O que está em `origin/main` (factual)

### Fundação ✅
- Migrations Supabase `0001-0006` aplicadas em prod (project ref `fvhwltzhytpnhlqbttmd`)
- GRDB schema iOS (`p1fast-ios/Sources/App/{AppDatabase,Configuration}.swift` + `p1fast-core/Sources/P1FastCore/Persistence/`)
- Xcode `p1fast-ios` com SPM (GRDB, Supabase Swift)
- Edge Functions: `ingest`, `health`, `pull`, `sync`

### Hub iOS ✅
- Theme + componentes: `EyebrowHeader`, `SummaryStats`, `Card`, `Chip`, `BottomNav`, `FAB`
- Telas: Home, Garagem, Modal Carro, CarroNovo, Eventos lista+detalhe, StintModal, PosStint, SetupAvancado, Pendências (readonly por evento)
- Forms cadastro: piloto, passageiro, combustível, pneu (todos com altura/peso/nascimento onde aplica)
- Repositories: Carro, Evento, Piloto, Passageiro, Combustível, Pneu, Stint, Track, Licao, Pendencia

### Infra de sync ✅ (parcial — sem captura ao vivo)
- `TelemetryUploader.swift` + `BackoffPolicy.swift`
- `SyncQueue` + `SyncDrainer` + `PullCursor` + `PullExecutor`
- `SyncCoordinator` + `URLSessionTransports` + `Reachability`
- `SincronizacaoView` + `SyncStatusBadge`

### Seeds e catálogos ✅
- Brasília: 8 trechos + parciais (via `SeedBrasilia.make()`)
- Lições: 12 (7 ativas, 5 marcadas Fase 2 — agora reabertas pra Fase 1)
- Pendências: 45 templates em 6 grupos (mas readonly e sem vinculação por carro — refatorado em MS-5)

---

## O que NÃO está em `origin/main` (escopo da Fase 1 expandida)

Resumo — detalhes em `docs/PLANO_FASE_1.md` §6:

| Mini-sprint | Resumo | PRs estimados |
|---|---|---|
| **MS-1** | Domínio canônico Swift port (4 pontos do trecho, 12 classificações apex, deviations) | 3-4 |
| **MS-2** | LiveTelemetryRecorder (CoreMotion 100Hz + GPS 1Hz + wake lock + low-power) | 3 |
| **MS-3** | Edge Function pipeline + smoke E2E | 2-3 |
| **MS-4** | StintPlan iOS port (meta + abordagem + trechos foco + lição foco + pendências por stint) | 3-4 |
| **MS-5** | Pendências vivas (obrigatório × adicional, CRUD por time, vinculação por carro) | 2 |
| **MS-6** | Debrief pós-stint real (4 troféus calculados, PosStintView com dados, decider) | 3-4 |
| **MS-7** | Track day 1 (Flávio em pista, sem PRs) | 0 |
| **MS-8** | Shift Light Premium Swift port (reaction learning, 12 LEDs, FIRE/OVERREV) | 4-5 |
| **MS-9** | Tier 1 — adapter BLE T4000 (RPM/marcha/temp real) | 3-4 |
| **MS-10** | Multi-usuário + RLS time + convites | 3-4 |
| **MS-11** | Daily.co 2 câmeras simultâneas | 2-3 |
| **MS-12** | Box Cockpit + AirPlay + mensagens Realtime | 3-4 |
| **MS-13** | Cockpit ao vivo (CockpitDevice 956×440, halo, slot direito Z-axis) | 4-5 |
| **MS-14** | Vista de volta + ghost map de trecho + reference line | 4-5 |
| **MS-15** | Fases térmicas + chuva + vista resfriamento | 2-3 |

**Total estimado:** ~35-50 PRs em 14 mini-sprints técnicos + 1 operacional (MS-7).

---

## Princípios de execução

- **Cloud Code é sequencial** — 1 PR por vez, esperar mergear (memória `feedback_cloud_code_sequencial`).
- **Worktree obrigatório** (ADR-021) — sempre branchar de `origin/main`.
- **`/compact` entre mini-sprints** (memória `feedback_quebrar_sprint_medio`).
- **Tier 0 sempre funciona** — feature de Tier 1+ nunca bloqueia ação em Tier 0.
- **Tudo é v1** — nenhum item da lista pode ser empurrado pra "v2".

---

## Pipeline de prompts antigo (referência histórica)

Arquivos `docs/SPRINT_1A4_DESIGN.md`, `SPRINT_1A5_DESIGN.md`, `SPRINT_1A6_FINISH_PROMPTS.md` cobrem trabalho **já mergeado** (PRs #47-#56). Mantidos por histórico — não confundir com mini-sprints novos do plano expandido.

`docs/SPRINT_1B_COCKPIT_DESIGN.md` e `docs/SPRINT_1B_DECISOES_RECOMENDACOES.md` contêm decisões de UX do cockpit ao vivo — relevantes pros MS-13, MS-14, MS-15. Manter como referência.

---

## Próximo passo concreto

1. Mergear este PR (docs unificada — MS-0).
2. `/compact`
3. Disparar **MS-1.1**: port `track-segment.js` 4 pontos pro Swift.
