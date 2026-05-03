# P1 Fast — Cobertura mockup canônico vs implementação

> Snapshot: **2026-05-02 noite**, após Sprint 1A.3 (#11 mergeado, PRs #33/#34/#14
> em flight) e Sprint 1A.4 baked (#16/#17/#18 em `SPRINT_1A4_DESIGN.md`).
>
> Atualizar este doc após cada merge em main.

## Sumário

- **27 mockups canônicos** em `_design-reference/` + 7 variantes históricas em `historico-evento/`
- **17 SwiftUI views** em `ios/p1fast-ios/Sources/Views/`
- **7 Repositories** em `ios/p1fast-ios/Sources/Persistence/`
- **21 tabelas** no schema GRDB (`Migrations.swift` v1)

| Status | Count | % |
|---|---|---|
| ✅ Done | 8 | 30% |
| 🟡 Parcial | 8 | 30% |
| ❌ Não portado | 11 | 40% |

---

## Matriz de cobertura

| # | Mockup | View Swift | Repo | Tabela(s) | Status | Débito |
|---|---|---|---|---|---|---|
| 1 | `mockup-home-cheio.html` | `HomeView` | (mocks) | — | ✅ | — |
| 2 | `mockup-home-vazio.html` | `HomeView` | (mocks) | — | ✅ | — |
| 3 | `mockup-garagem.html` | `GaragemView` | `CarroRepository` | `carros` | ✅ | — |
| 4 | `mockup-carro.html` | `CarroModalView` | `CarroRepository` + `CarroSetupOverrides` | `carros`, `configuracoes` | 🟡 | Seção "Pneus cadastrados" é stub (`EmptyTireHint`+`AddTireButton` no-op). Fix: PR #14 em flight. |
| 5 | `mockup-carro-novo.html` | `CarroNovoFormView` | `CarroRepository` | `carros` | ✅ | — |
| 6 | `mockup-eventos-lista.html` | `EventosListaView` + `EventoNovoFormView` | `EventoRepository` | `eventos` | ✅ | — |
| 7 | `mockup-evento.html` | `EventoNovoFormView` | `EventoRepository` | `eventos` | ✅ | (form de criar evento, mesmo arquivo do #6) |
| 8 | `mockup-evento-detalhe.html` | `EventoDetalheView` | `EventoRepository` + `EventoMockSummary` | `eventos`, `sessoes` | ✅ | — |
| 9 | `mockup-stint.html` | `StintModalView` | `StintRepository` | `sessoes` | 🟡 | Selectors "Combustível abastecido" e "Pneu montado" (linhas 303-323 do mockup) NÃO implementados. Fix: PR #17 baked. |
| 10 | `mockup-pos-stint.html` | `PosStintView` | `StintRepository` | `sessoes`, `voltas` | ✅ | — |
| 11 | `mockup-piloto-lista.html` | `PessoasView` (sub-tab Pilotos) | `PilotoRepository` | `pilotos` | 🟡 | Sem tap-to-edit + swipe-to-delete na UI. Fix: prompt CRUD-affordances baked. |
| 12 | `mockup-piloto-cadastro.html` | `PilotoCadastroView` | `PilotoRepository` | `pilotos` | 🟡 | Form mínimo (só nome). Falta altura/peso/idade do mockup. Fix: PR #18 baked. |
| 13 | `mockup-passageiro-lista.html` | `PessoasView` (sub-tab Passageiros) | `PassageiroRepository` | `passageiros` | 🟡 | Mesmo gap do #11 (sem edit/delete UI). |
| 14 | `mockup-passageiro-cadastro.html` | `PassageiroCadastroView` | `PassageiroRepository` | `passageiros` | 🟡 | Mesmo gap do #12 (form mínimo). |
| 15 | `mockup-pneu-lista.html` | (não portado) | (vem em #14) | `pneus` | ❌ | Mockup é stint-selector. Fix: PR #17 (selector real no StintModal). |
| 16 | `mockup-pneu-cadastro.html` | `PneuCadastroView` + `CarroModalView.sectionPneusCadastrados` | `PneuRepository` | `pneus` | 🟡 | PR #35 mergeable. Composto modelado como enum tipado. Falta delete affordance (mesmo gap dos #11/#13/#17 — fix CRUD-affordances). |
| 17 | `mockup-combustivel-lista.html` | `CombustivelListaView` | `CombustivelRepository` | `combustiveis` | 🟡 | PR #34 — sem edit/delete UI (mesmo gap dos #11/#13). Fix: prompt CRUD-affordances. |
| 18 | `mockup-combustivel-cadastro.html` | `CombustivelCadastroView` | `CombustivelRepository` | `combustiveis` | ✅ | PR #34 mergeable — só falta review. |
| 19 | `mockup-licao-lista.html` | (não portado) | — | (sem tabela ainda) | ❌ | Sprint 1A.5+ — catálogo pedagógico. Schema novo necessário. |
| 20 | `mockup-pendencias-cascata.html` | (não portado) | — | (`SEED_PEND_TIPOS` em src/data/schemas.js — JS) | ❌ | Sprint 1A.5+ — falta porte pra Swift + tabela `pendencias`. |
| 21 | `mockup-trecho-lista.html` | (não portado) | — | `tracks`, `track_segments` (schema OK) | ❌ | Sprint 1A.5+ — UI de curvas com apex defaults. |
| 22 | `mockup-setup-avancado.html` | parcial em `CarroModalView` | `CarroSetupOverrides` | `configuracoes.overrides` (JSON) | 🟡 | 14 overrides já no Carro Modal. Tela "avançada" dedicada (visualização agrupada por sistema) não existe. |
| 23 | `mockup-reacoes-aprendidas.html` | (não portado) | — | (sem tabela; schema Dexie v12 no JS) | ❌ | Pilot reaction profiles — depende de telemetria real. Sprint 1B+. |
| 24 | `mockup-shift-cards.html` | (não portado) | — | (Dexie v11 no JS) | ❌ | Smart shift light — Fase 2 (memória diz Fase 1 só visual idle). |
| 25 | `mockup-cockpit-piloto.html` | (não portado) | — | `telemetry_samples` (schema OK) | ❌ | **Sprint 1B** — cockpit ao vivo na pista. Visual fundamental do produto. |
| 26 | `mockup-cockpit-ghost.html` | (não portado) | — | (sem tabela ghost map) | ❌ | **Sprint 1B** — 22 decisões UX em memória, mockup canônico, 0% implementado. |
| 27 | `mockup-cockpit-comparacao.html` | (não portado) | — | (deriva de telemetry_samples + sessoes) | ❌ | **Sprint 1B** — comparação de stints. |

### Variantes históricas (`historico-evento/`)

7 explorações visuais do detalhe de evento (A-G + comparação). **Padrão B canonizado** em Prompt #7 (Theme.swift + componentes). Outras viraram referência de design exploration. Status: ✅ baseline aplicada.

---

## Tabelas sem UI

Tabelas no schema sem view correspondente:

| Tabela | Para quê | Bloqueio |
|---|---|---|
| `tracks` + `track_layouts` + `track_segments` | mockup-trecho-lista | UI Sprint 1A.5+ |
| `marcos` | pit-in/pit-out + curvas chave | UI Sprint 1B (cockpit) |
| `retas_especiais` | retas de aceleração detectadas auto | UI Sprint 1B |
| `mensagens` | mensagens box→piloto | UI Sprint 1B |
| `trofeus_ganhos` | gamificação ghost map | UI Sprint 1B (decisão #21) |
| `telemetry_samples` | append-only telemetria | Cockpit ao vivo Sprint 1B |
| `voltas` (parcial) | só agregada em PosStint, sem detalhe | UI dedicada Sprint 1B |
| `segment_executions` | execução por trecho (apex etc) | Cockpit ao vivo Sprint 1B |

---

## Débito consolidado (priorizado)

### ✅ Sprint 1A.3 fechado (2026-05-03 noite)
1. **#33 Pessoas** → mergeado `66bc968`
2. **#37 Combustíveis** (re-aberto após bug de base no #34) → mergeado `bf8ecfa`
3. **#38 Docs recovery** (autosave commits salvos via reflog) → mergeado `ef253d1`
4. **#35 Pneus** → mergeado `56d24b9`
5. ⏳ **CRUD affordances v2** — prompt baked em `POST_1A3_PLAYBOOK.md`, em flight pelo Cloud Code (delete em 4 listas: Combustível + Piloto + Passageiro + Pneu).

### 🟡 Sprint 1A.4 (já baked em `SPRINT_1A4_DESIGN.md`)
5. **#16 Schema migration v2** — adiciona FKs `sessoes.pneu_id` + `sessoes.combustivel_id` + `sessoes.qt_combustivel_litros`. Adiciona `altura_cm`/`peso_kg`/`nascimento` em `pilotos` e `passageiros`. Remove aliases `StintRepository.pilotoFlavioId/pilotoBrunoId`.
6. **#17 Stint Selectors** — porta `mockup-pneu-lista.html` e `mockup-combustivel-lista.html` AGORA como selectors reais (radio + footer). Auto-incrementa `pneus.ciclos` quando stint termina.
7. **#18 Pessoas Schema v2** — UI pra altura/peso/nascimento que ficou de fora em #12+#13.

### 🟢 Sprint 1A.5+ (não baked, próximo design)
8. **Trechos da pista** (`mockup-trecho-lista.html`) — UI de curvas com apex defaults. Schema `tracks/track_segments` pronto.
9. **Catálogo de lições** (`mockup-licao-lista.html`) — schema novo necessário (`licoes`).
10. **Pendências cascata** (`mockup-pendencias-cascata.html`) — porte do JS (`SEED_PEND_TIPOS`) + tabela `pendencias`.
11. **Setup avançado dedicado** (`mockup-setup-avancado.html`) — visualização agrupada dos 14 overrides já existentes.

### ⚪ Sprint 1B (visual fundamental)
12. **Cockpit ao vivo** (`mockup-cockpit-piloto.html`) — 956×440 com apex+info-bloco+stint-bar. Smart Shift Light Premium (12 LEDs, 4 estados, FIRE).
13. **Ghost map** (`mockup-cockpit-ghost.html`) — 22 decisões UX em memória, 0% implementado.
14. **Cockpit comparação** (`mockup-cockpit-comparacao.html`) — comparação de stints.

### Long-tail
15. **Reações aprendidas** (`mockup-reacoes-aprendidas.html`) — depende de telemetria real (Sprint 1B+).
16. **Shift cards** (`mockup-shift-cards.html`) — Fase 2 do shift light (precisa RPM real, ECU Injepro pareada).

### ⚪ Sprint 1A.6 — Sync (5 de 7 já entregues, 2 baked)
- ✅ Edge Function `sync` (já em prod)
- ✅ `SyncDrainer.swift` core (em p1fast-core)
- ✅ `PullExecutor.swift` core
- ✅ `BackoffPolicy.swift`
- ✅ `TelemetryUploader.swift` core
- ⏳ **Sub-prompt C** (HTTP transport + Reachability + injection) — baked em `SPRINT_1A6_FINISH_PROMPTS.md`
- ⏳ **Sub-prompt D** (UI Sincronização + status badge) — baked em `SPRINT_1A6_FINISH_PROMPTS.md`
- 🔴 **Pré-requisito tua**: criar projeto Supabase real + aplicar migrations + .env.xcconfig

Quando #23 + #24 mergearem → **Phase 1A 100% completa** → Sprint 1B (cockpit ao vivo).

---

## Launch args registry (16 atualmente)

```
--p1-empty                 → HomeView estado vazio
--p1-showcase              → ThemeShowcaseView
--p1-garagem               → GaragemView (lista)
--p1-garagem-novo          → GaragemView com sheet "Novo carro" aberta
--p1-garagem-carro         → GaragemView com sheet "Editar carro"
--p1-eventos               → EventosListaView
--p1-eventos-novo          → EventosListaView com sheet "Novo evento"
--p1-evento-detalhe        → EventosListaView com detalhe do 1º evento
--p1-stint-novo            → cria evento demo + abre stint modal
--p1-pos-stint             → cria stint, finaliza, mostra PosStintView
--p1-pessoas               → PessoasView aba Pilotos
--p1-pessoas-passageiros   → PessoasView aba Passageiros
--p1-piloto-novo           → PessoasView com sheet "Novo piloto"
--p1-passageiro-novo       → PessoasView com sheet "Novo passageiro"
--p1-combustiveis          → PessoasView aba Combustíveis (Cadastros)
--p1-combustivel-novo      → PessoasView com sheet "Novo combustível"
```

A adicionar quando #14 mergear: `--p1-pneu-novo`.

---

## Ordem ótima de execução restante (Sprint 1A.3 + 1A.4)

```
Agora                     → Cloud Code rodando #14 Pneus (worktree)
Quando #34 CI verde       → review + merge #33 (rebase)
                          → review + merge #34
Quando #14 voltar         → review + merge #14
                          → disparar prompt CRUD-affordances
Quando affordances mergear → Sprint 1A.3 fechado
                          → disparar #16 (worktree)
Quando #16 mergear        → disparar #17 e #18 em paralelo (2 worktrees)
Quando ambos mergearem    → Sprint 1A.4 fechado → pronto pra Sprint 1A.5+
```

Estimativa: ~5-6 PRs daqui pra fechar 1A.3 + 1A.4 (já contando o que está em flight).
