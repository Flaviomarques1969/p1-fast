# Smart Shift Light Premium — Progresso

**Arquivo operacional. Atualizado pelo Claude conforme cada critério é cumprido.**
**Lido pelo auditor pra saber o estado oficial dos blocos.**

Plano: `docs/SHIFT_LIGHT_IMPLEMENTATION_PLAN.md`
Decisões: `docs/SHIFT_LIGHT_DECISIONS.md`

Convenção:
- `[ ]` = pendente
- `[~]` = em andamento
- `[x]` = concluído
- `[!]` = bloqueado (com nota)

---

## Status global

| Bloco | Estado | Auditor | Commit final |
|-------|--------|---------|--------------|
| 1 — Estimativa de marcha + confiança | `[x]` concluído | ✅ aprovado c/ ressalvas | — |
| 2 — Modo seguro + alvo conservador | `[x]` concluído | ✅ aprovado | — |
| 3 — Detecção de evento + persistência | `[x]` concluído | ✅ aprovado | — |
| 4 — Cards pós-sessão (Fast Coach) | `[x]` concluído | ✅ aprovado | — |
| 5 — Pilot Reaction Learning | `[x]` concluído | ✅ aprovado | — |
| 6 — DYNO_CALIBRATED + UI cadastro | `[x]` concluído | ✅ aprovado | — |

---

## Bloco 1 — Estimativa de marcha + confiança

### Arquivos
- [x] `src/domain/gear-estimation.js`
- [x] `src/domain/gear-signatures.js`
- [x] `src/domain/gear-shift-detector.js`
- [x] `tests/domain/gear-estimation.spec.js`

### Critérios de aceite
- [x] Stream sintético 1→2→3 → identifica cada marcha em ≤100ms
- [x] Velocidade ruidosa (±5%) → confidence cai mas gear continua razoável
- [x] Sem assinatura calibrada → retorna `{gear:null, confidence:0, method:'fallback'}`
- [x] TPS=0 + accel desaceleração → reduz confidence
- [x] Teste cobre: troca pra cima, redução, neutro, patinação
- [x] Função pura (sem side-effects)

### Auditor
- [x] `Agent(shift-light-auditor, "Audite Bloco 1")` → ✅ APROVADO COM RESSALVAS

### Notas do auditor
- 18/18 testes passaram (`node tests/domain/gear-estimation.spec.js`)
- Nenhum scope creep, nenhum princípio violado
- Ressalva: package.json sem script "test" — adicionado `test:shift-light` neste bloco

---

## Bloco 2 — Modo seguro + alvo conservador

### Arquivos
- [x] `src/domain/shift-target.js`
- [x] `src/domain/safe-mode.js`
- [x] `src/data/cars.js` (extensão de schema)
- [x] `tests/domain/shift-target.spec.js` (extra: cobre critérios)

### Critérios de aceite
- [x] Sem dyno + confiança 0.9 → safe target
- [x] Sem dyno + confiança 0.5 → safe target
- [x] Com learned target marcha 3 + confiança 0.9 + gear=3 → learned
- [x] `redline_rpm` ausente → erro explícito
- [x] Função pura

### Auditor
- [x] `Agent(shift-light-auditor, "Audite Bloco 2")` → ✅ APROVADO (34 testes passando)

---

## Bloco 3 — Detecção de evento + persistência

### Arquivos
- [x] `src/pipeline/shift-event-detector.js`
- [x] `src/data/shift-events.js`
- [x] `src/data/trecho-resolver.js`
- [x] `tests/pipeline/shift-event-detector.spec.js`
- [x] `src/core/db.js` v11 com store `shift_events`

### Critérios de aceite
- [x] Stream com N trocas conhecidas → produz N eventos
- [x] Cada evento tem 25 campos populados ou null com flag de inconsistência
- [x] `trecho_id` preenchido com GPS válido + sistema responde; null caso contrário
- [x] `lesson_text` é null neste bloco
- [x] Detector ignora TPS<10
- [x] Persistência idempotente

### Auditor
- [x] `Agent(shift-light-auditor, "Audite Bloco 3")` → ✅ APROVADO (47 testes do shift-light + 20 smoke geral, sem regressão)

---

## Bloco 4 — Cards pós-sessão (Fast Coach)

### Arquivos
- [x] `_design-reference/mockup-shift-cards.html`
- [x] `src/domain/shift-analysis.js`
- [x] `src/ui/shift-cards-view.js`
- [x] `tests/domain/shift-analysis.spec.js`

### Critérios de aceite
- [x] Sessão de N trocas → N cards (buildShiftCardsListHTML, teste cobre)
- [x] Cor do delta correta (verde dentro tolerance, vermelho fora)
- [x] Tolerância vem do carro (`tolerance_rpm`)
- [x] Frase contém nome do trecho quando disponível (com `<strong>`)
- [x] Cards aparecem só após `session.status === 'finished'`
- [x] Mockup `mockup-shift-cards.html` reflete componente final (mesmas classes)
- [x] Renderização funcional no browser (mockup HTML5 standalone, paleta oklch, 4 cards de exemplo cobrindo os 4 estados)

### Auditor
- [x] `Agent(shift-light-auditor, "Audite Bloco 4")` → ✅ APROVADO (71 testes do shift-light)

---

## Bloco 5 — Pilot Reaction Learning

### Arquivos
- [x] `src/domain/pilot-reaction.js`
- [x] `src/data/reaction-profiles.js`
- [x] Hook em `src/domain/shift-target.js` (visualRpm + reactionCtx)
- [x] `tests/domain/pilot-reaction.spec.js`
- [x] `src/core/db.js` v12 com store `reaction_profiles`

### Critérios de aceite
- [x] Após 10 eventos numa tupla → `reaction_time_ms` aprendido (sample_count, alpha=0.15)
- [x] Compensação aplicada → `visualRpm < optimalRpm` (verificado no teste do hook)
- [x] Mudança bounded entre eventos consecutivos (alpha suaviza; teste valida ≤50 rpm em rates típicos)
- [x] Eventos com `gear_confidence < 0.8` ou `data_inconsistent_flag=true` não afetam aprendizado
- [x] Fallback hierárquico: exata → piloto-carro-gear → piloto-carro → default

### Auditor
- [x] `Agent(shift-light-auditor, "Audite Bloco 5")` → ✅ APROVADO (88 testes do shift-light, smoke geral verde)

---

## Bloco 6 — DYNO_CALIBRATED + UI cadastro

### Arquivos
- [x] `_design-reference/mockup-carro-novo.html` (estendido com aba Dinamômetro via radio-tabs)
- [x] `src/domain/dyno-csv-parser.js`
- [x] `src/domain/dyno-target-calculator.js`
- [x] `src/domain/tolerance-from-dyno.js`
- [x] `src/data/cars.js` (campo `dyno_curve` já no Bloco 2)
- [x] `tests/domain/dyno-target-calculator.spec.js`

### Critérios de aceite
- [x] CSV Dynojet → parseia (preâmbulo "Dynojet Run File" + lb-ft → Nm + hp → kW)
- [x] CSV Mustang → parseia (separador `;`, unidades Nm/kW)
- [x] CSV inválido → erro legível
- [x] 5 pontos manuais → cálculo com interpolação funciona
- [x] Sem `gear_ratios` → fallback 90% redline, `reason` explícita
- [x] Tolerância auto = 5% da janela útil (P ≥ 95% pico), clamp [80, 250]
- [x] `shift-target.js` retorna `source: 'dyno'` com dados completos
- [x] Mockup tem aba Dinamômetro funcional (CSS-only radio tabs, preview SVG, lista de pontos editável, redline e tolerância auto)

### Auditor
- [x] `Agent(shift-light-auditor, "Audite Bloco 6")` → ✅ APROVADO (104 testes shift-light, smoke geral verde, sem regressão)

---

## Notas de execução

Plano executado em 2026-05-01 do bloco 1 ao bloco 6 com auditor passando em todos.

- **Bloco 1.** Função `estimateGear` opera sobre buffer + assinaturas; método rola entre `rpm_speed`, `rpm_speed_history`, `rpm_speed_history_accel` conforme dados disponíveis.
- **Bloco 2.** Schema do carro (`src/data/cars.js`) reservou desde já os campos do shift-light (gear_signatures, learned_targets, gear_ratios, dyno_curve) com defaults. Placeholder de dyno cai em safe com reason explícita.
- **Bloco 3.** Schema Dexie bumpou para v11 com store `shift_events`. Idempotência via campo `&dedup_key` (índice único). Detector mantém buffer in-memory; persistência é o único IO.
- **Bloco 4.** Mockup HTML standalone, mesmas classes geradas pelo `shift-cards-view.js`. HTML escapado em campos hostis. `renderShiftCards` aceita `eventsLoader` injetado pra teste.
- **Bloco 5.** Schema Dexie v12 com `reaction_profiles` (`&key` único). Hook em `shift-target.js` adicionou campos `visualRpm` e `reactionSource`. Aprendizado descarta eventos com `gear_confidence < 0.8`, inconsistentes ou `early`.
- **Bloco 6.** Parser CSV detecta separador, formato (Dynojet/Mustang/genérico) e converte unidades; cobre headers com preâmbulo de metadata. Mockup ganhou aba Dinamômetro via radio-tabs CSS-only. `shift-target.js` deixou de ter placeholder e passa a chamar `computeOptimalRpmPerGear` com try/catch tolerante.

Total de testes: **104** (`npm run test:shift-light`). Smoke geral do projeto continua verde — sem regressão.

Pendências fora do plano (não bloqueiam):
- `trecho-resolver.resolveTrechoId` é async, mas o detector consulta `resolveTrecho` sincronamente no `buildEvent`. Quando o adapter real do P1 Fast for ligado, decidir se a resolução vira async no detector ou se o adapter expõe um lookup síncrono em cache.
- Branch atual `main`, conforme regra; nada commitado/pushado.
