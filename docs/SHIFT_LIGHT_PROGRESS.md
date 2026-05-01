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
| 5 — Pilot Reaction Learning | `[~]` em andamento | — | — |
| 6 — DYNO_CALIBRATED + UI cadastro | `[ ]` pendente | — | — |

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
- [ ] `src/domain/pilot-reaction.js`
- [ ] `src/data/reaction-profiles.js`
- [ ] Hook em `src/domain/shift-target.js`

### Critérios de aceite
- [ ] Após 10 eventos correctos numa tupla → `reaction_time_ms` aprendido
- [ ] Compensação aplicada → `visual_rpm < optimal_rpm`
- [ ] Mudança entre eventos consecutivos ≤ 50rpm equivalentes
- [ ] Eventos com gear_confidence baixa não afetam aprendizado
- [ ] Fallback hierárquico funciona

### Auditor
- [ ] `Agent(shift-light-auditor, "Audite Bloco 5")` → ✅

---

## Bloco 6 — DYNO_CALIBRATED + UI cadastro

### Arquivos
- [ ] `_design-reference/mockup-carro-novo.html` (extensão com aba Dyno)
- [ ] `src/domain/dyno-csv-parser.js`
- [ ] `src/domain/dyno-target-calculator.js`
- [ ] `src/domain/tolerance-from-dyno.js`
- [ ] `src/data/cars.js` (campo `dyno_curve`)
- [ ] `tests/domain/dyno-target-calculator.spec.js`

### Critérios de aceite
- [ ] CSV Dynojet → parseia
- [ ] CSV Mustang → parseia
- [ ] CSV inválido → erro legível
- [ ] 5 pontos manuais → cálculo com interpolação funciona
- [ ] Sem `gear_ratios` → fallback documentado em `reason`
- [ ] Tolerância auto = 5% da janela útil, clamp [80, 250]
- [ ] `shift-target.js` retorna `source: 'dyno'` com dados completos
- [ ] Mockup tem aba dyno funcional

### Auditor
- [ ] `Agent(shift-light-auditor, "Audite Bloco 6")` → ✅

---

## Notas de execução

(Esta seção é preenchida pelo Claude durante a execução: bloqueios, decisões on-the-fly, gambiarras temporárias com TODO, etc.)

_(vazio até início da execução)_
