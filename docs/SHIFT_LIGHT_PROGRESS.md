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
| 2 — Modo seguro + alvo conservador | `[ ]` pendente | — | — |
| 3 — Detecção de evento + persistência | `[ ]` pendente | — | — |
| 4 — Cards pós-sessão (Fast Coach) | `[ ]` pendente | — | — |
| 5 — Pilot Reaction Learning | `[ ]` pendente | — | — |
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
- [ ] `src/domain/shift-target.js`
- [ ] `src/domain/safe-mode.js`
- [ ] `src/data/cars.js` (extensão de schema)

### Critérios de aceite
- [ ] Sem dyno + confiança 0.9 → safe target
- [ ] Sem dyno + confiança 0.5 → safe target
- [ ] Com learned target marcha 3 + confiança 0.9 + gear=3 → learned
- [ ] `redline_rpm` ausente → erro explícito
- [ ] Função pura

### Auditor
- [ ] `Agent(shift-light-auditor, "Audite Bloco 2")` → ✅

---

## Bloco 3 — Detecção de evento + persistência

### Arquivos
- [ ] `src/pipeline/shift-event-detector.js`
- [ ] `src/data/shift-events.js`
- [ ] `src/data/trecho-resolver.js`
- [ ] `tests/pipeline/shift-event-detector.spec.js`

### Critérios de aceite
- [ ] Stream com N trocas conhecidas → produz N eventos
- [ ] Cada evento tem 25 campos populados ou null com flag de inconsistência
- [ ] `trecho_id` preenchido com GPS válido + sistema responde; null caso contrário
- [ ] `lesson_text` é null neste bloco
- [ ] Detector ignora TPS<10
- [ ] Persistência idempotente

### Auditor
- [ ] `Agent(shift-light-auditor, "Audite Bloco 3")` → ✅

---

## Bloco 4 — Cards pós-sessão (Fast Coach)

### Arquivos
- [ ] `_design-reference/mockup-shift-cards.html`
- [ ] `src/domain/shift-analysis.js`
- [ ] `src/ui/shift-cards-view.js`
- [ ] `tests/domain/shift-analysis.spec.js`

### Critérios de aceite
- [ ] Sessão de N trocas → N cards
- [ ] Cor do delta correta (verde dentro tolerance, vermelho fora)
- [ ] Tolerância vem do carro (`tolerance_rpm`)
- [ ] Frase contém nome do trecho quando disponível
- [ ] Cards aparecem só após `session.status === 'finished'`
- [ ] Mockup `mockup-shift-cards.html` reflete componente final
- [ ] Renderização funcional no browser (testado abrindo HTML)

### Auditor
- [ ] `Agent(shift-light-auditor, "Audite Bloco 4")` → ✅

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
