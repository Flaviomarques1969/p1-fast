# Session handoff — 2026-05-13 (pré-`/clear` MS-16)

> **Se você é Claude abrindo após o Flávio digitar "voltei":**
> Este doc é o ponto de retomada. Leia inteiro antes de qualquer ação.
> Tudo o que está descrito aqui já foi entregue e está em `main`.

---

## Contexto da sessão

Sessão 2026-05-13 entregou o **mini-sprint MS-16 (Command Box Engenharia)** ponta-a-ponta na **camada de domain pura** (sem SwiftUI/UIKit). 6 PRs squash-merged em sequência:

| PR | Sub-sprint | SHA squash | Conteúdo |
|---|---|---|---|
| #194 | MS-16.0 | `0bdafd9` | Auditoria + arquitetura `docs/COMMAND_BOX_ENGENHARIA.md` + bloco MS-16 no `PLANO_FASE_1.md` §6 |
| #195 | MS-16.1 | `b84a2a9` | `TelemetryTimebase.swift` + TB-01..12 + TPB-01..12 |
| #196 | MS-16.2 | `639ec1e` | `VehicleContextAggregator.swift` + VCA-01..10 |
| #197 | MS-16.3 | `57c552a` | `CalibrationEngine` + 3 rules MVP + migrations 0020/0021 + CE-01..15 |
| #198 | MS-16.4 | `430d151` | `/api/advisor.js` aceita `findings[]` + AF-01..09 |
| #199 | MS-16.5a | `2ee12a3` | `EngControlModel` + `EngineeringDecisionPolicy` + ECM-01..12 |

Total: ~4.600 linhas + 67 testes automáticos novos verdes em CI macos-14 + ubuntu-latest.

---

## O que está em `main`

### Camada 1 — Engine Core (determinística, ADR-008)

- `ios/p1fast-core/Sources/P1FastCore/TelemetryTimebase.swift` — sincronização multi-fonte 10 Hz, freshness por fonte, LATE/MISSING, OUT_OF_ORDER, DUPLICATE, jitter/latency stats
- `Snapshot.swift` (já existia) — consolidado por instante, alimentado pelo Timebase
- `CriticalRules.swift` (já existia) — 6 regras determinísticas
- `CrossValidation.swift` (já existia) — V-001..V-011

### Camada 2 — VehicleContext + Calibration

- `ios/p1fast-core/Sources/P1FastCore/VehicleContextAggregator.swift` — lap window + stint history + thermal phase + Vmin trend
- `EngineeringFinding.swift` — tipos Finding + Recommendation + Ajuste + enums
- `CalibrationEngine.swift` — motor com cooldown + gating por confiança
- `CalibrationRules/FuelLeanSustainedLoadRule.swift`
- `CalibrationRules/WaterTempDriftNoCoolingRule.swift`
- `CalibrationRules/VminProgressiveLossSegmentRule.swift`

### Camada 3 — Senior Advisor IA

- `api/advisor.js` aceita `findings[]` opcional. System prompt define governança (priorizar, explicar, validar, não contradizer findings determinísticos).
- `api/_lib/schemas.js` valida shape do `findings[]` (max 50, severidade/confianca enums)

### UI Tab Engenharia (domain only)

- `ios/p1fast-core/Sources/P1FastCore/EngControlModel.swift`
  - `EngControlKind` slider/knob/toggle
  - `EngControlPapel` chefe/engenheiro/mecanico/piloto/readonly
  - `tryChange(to:papel:carroParado:)` com gating D17 fechada
  - Factories: `fuelAdjustmentSlider`, `rpmTargetKnob`, `moduloEngenhariaToggle`
- `EngineeringDecisionPolicy` — `canDecide`, `transitionAllowed`, `authorize`

### Persistência Supabase (migrations não aplicadas)

- `supabase/migrations/0020_engineering_findings.sql` — append-only, RLS por time
- `supabase/migrations/0021_engineering_recommendations.sql` — insert + update por membro

---

## Decisões fechadas nesta sessão (7)

| # | Decisão |
|---|---|
| D1 | Criar MS-16 — Command Box Engenharia |
| D2+D3 | UI = iOS Box Mode → TV 32" + Cockpit Pilot 10,5" como canal contextual; notebook kiosk; operação distribuída pelos iPhones |
| D6 | 3 rules MVP: fuel-lean, water-drift, vmin-loss |
| D14 | Heurística carro parado/andando absorvida por D18 |
| D17 | Piloto edita/simula só com carro parado; chefe + engenheiro livres |
| D18 | Switch automático `(modulo_ativado AND carro_parado) → ENGENHARIA`, senão PILOTO; voltar a andar força PILOTO imediato |

---

## Decisões abertas (13) — nenhuma bloqueia

D4, D5, D7..D13, D15, D16, D19, D20. Listadas em §11 do `docs/COMMAND_BOX_ENGENHARIA.md`. Cada uma destrava nuance de UX ou wiring posterior. Default proposto no doc — Flávio decide quando relevante.

---

## Pendências do Flávio (fora do escopo Claude)

1. **Aplicar migrations 0020 + 0021 em prod via `supabase db push`** — versionadas em main mas NÃO aplicadas. Mesmo padrão das outras migrations.
2. **MS-16.5b — SwiftUI Views da Tab Engenharia** quando Xcode aberto. Lista do que falta abaixo.

---

## Próximo passo natural — MS-16.5b (SwiftUI Views)

Toda a lógica de domain já está em main + smoke-tested. Falta apenas SwiftUI consumindo. Arquivos a criar:

| Arquivo | Onde | Consome do core |
|---|---|---|
| `EngenhariaView.swift` | `ios/p1fast-ios/Sources/Views/` | `EngineeringRepository.list()`, `BottomNav` |
| `FindingCardView.swift` | idem | `EngineeringFinding` |
| `RecommendationCardView.swift` | idem | `EngineeringRecommendation` + `EngineeringDecisionPolicy.authorize` |
| `EngControlSlider.swift` | idem | `EngControlModel.tryChange` + `DragGesture` + `UIImpactFeedbackGenerator` |
| `EngControlKnob.swift` | idem | `EngControlModel.tryChange` + `RotationGesture` |
| `EngenhariaRepository.swift` | `ios/p1fast-ios/Sources/Persistence/` | Supabase REST → `engineering_findings` + `engineering_recommendations` (migrations 0020/0021) |
| `BottomNav.swift` (editar) | idem | Adicionar tab "Engenharia" ao lado de "Piloto" |

**Roteiro sugerido pra MS-16.5b:**

1. Criar branch `feat/ms-16-5b-engenharia-views` de `origin/main`.
2. Implementar `EngenhariaRepository` primeiro (Supabase REST + GRDB cache opcional).
3. Implementar Cards (Finding + Recommendation) lendo do Repository.
4. Implementar `EngControlSlider` + `EngControlKnob` (SwiftUI Views consumindo `EngControlModel`).
5. Atualizar `BottomNav` com tab Engenharia.
6. Validar visualmente em simulator iOS (precisa Xcode + iPhone Simulator).
7. PR único; smoke iOS quando possível.

**Constraints:**
- Não tocar `Package.resolved` (ADR-022).
- Não aplicar migrations em prod sem ordem do Flávio.
- Tratamento "você" (CLAUDE.md §9.2 do plano).

---

## Comando pra Claude pós-`/clear`

Quando o Flávio digitar **"voltei"**:

1. Ler `STATUS.md` (overview)
2. Ler **este doc** (handoff específico)
3. Ler `docs/COMMAND_BOX_ENGENHARIA.md` (auditoria + arquitetura do MS-16)
4. Confirmar com o Flávio se a próxima frente é MS-16.5b (SwiftUI Views) ou outra direção (ex: outro mini-sprint MS-X)
5. Se MS-16.5b autorizado: criar branch `feat/ms-16-5b-engenharia-views` de `origin/main` e seguir o roteiro acima
6. Se outra direção: abrir conversa com o Flávio sobre escopo

---

## Estado dos testes (snapshot 2026-05-13)

- `swift run p1fast-smoke` (CI macos-14): verde em todos os 6 PRs merged
  - TB-01..12 (TelemetryTimebase)
  - VCA-01..10 (VehicleContextAggregator)
  - CE-01..15 (CalibrationEngine + 3 rules)
  - ECM-01..12 (EngControlModel + DecisionPolicy)
- `npm run smoke` (CI ubuntu-latest): verde
  - TPB-01..12 (Timebase paridade Swift × JS)
  - AF-01..09 (Advisor findings enrichment)
  - Schema-parity atualizado pra 30 tabelas PG com `PG_ONLY_TABLES` excluindo as 2 novas
  - Todos os smokes pré-existentes preservados (sem regressão)

---

## Não-revisitar

Decisões D1, D2, D3, D6, D14, D17, D18 estão fechadas e implementadas. Reabrir só com ordem direta do Flávio (mesma regra de ADR-018, ADR-023, etc).

A arquitetura Camada 1 → Camada 2 → Camada 3 do Command Box Engenharia foi aprovada e ADR-008 ainda vale: **IA NÃO em segurança crítica**. Camada 2 é 100% determinística; Camada 3 (IA) só prioriza/explica/valida, nunca decide alerta crítico.
