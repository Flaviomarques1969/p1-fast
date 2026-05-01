# Smart Shift Light Premium — Plano de Implementação

**Documento operacional. Lido pelo Claude após `/clear` pra retomar execução do bloco corrente.**

Decisões de produto: `docs/SHIFT_LIGHT_DECISIONS.md`
Progresso: `docs/SHIFT_LIGHT_PROGRESS.md`
Auditor: `.claude/agents/shift-light-auditor.md`

Mockup canônico: `_design-reference/mockup-cockpit-piloto.html` (já implementado)

---

## Regras de execução

1. **Mockup primeiro.** Blocos com componente visual novo escrevem mockup em `_design-reference/` antes de código em `src/`.
2. **Um bloco por vez.** Não começar Bloco N+1 sem auditor ✅ no Bloco N.
3. **Auditor após cada bloco.** Invocar `Agent(subagent_type="shift-light-auditor", prompt="Audite Bloco N")`. Corrigir tudo até passar.
4. **Sem deploy, sem push, sem trocar branch.** Regras de memória inegociáveis.
5. **Commits pequenos.** Cada bloco pode gerar múltiplos commits. Mensagem do último commit do bloco: `feat(shift-light): bloco N — <título>`.
6. **Atualizar `SHIFT_LIGHT_PROGRESS.md`** ao concluir cada critério de aceite.
7. **Não fabricar dados.** Quando não há referência, retornar null/unknown explicitamente.
8. **Testes:** se o projeto já tem runner (vitest/jest/mocha) usar. Senão, criar harness mínimo em `tests/run-tests.html` (browser) ou `tests/run-tests.mjs` (Node 22 com test runner nativo). Decisão fica pra execução do Bloco 1.

---

## Estrutura de pastas (a ser criada)

```
src/
  domain/
    gear-estimation.js          [Bloco 1]
    gear-signatures.js          [Bloco 1]
    gear-shift-detector.js      [Bloco 1]
    shift-target.js             [Bloco 2, ext. Blocos 5,6]
    safe-mode.js                [Bloco 2]
    shift-analysis.js           [Bloco 4]
    pilot-reaction.js           [Bloco 5]
    dyno-csv-parser.js          [Bloco 6]
    dyno-target-calculator.js   [Bloco 6]
    tolerance-from-dyno.js      [Bloco 6]
  data/
    cars.js                     [Bloco 2, ext. Bloco 6]
    shift-events.js             [Bloco 3]
    trecho-resolver.js          [Bloco 3]
    reaction-profiles.js        [Bloco 5]
  pipeline/
    shift-event-detector.js     [Bloco 3]
  ui/
    shift-cards-view.js         [Bloco 4]
tests/
  domain/
    gear-estimation.spec.js     [Bloco 1]
    shift-analysis.spec.js      [Bloco 4]
    dyno-target-calculator.spec.js [Bloco 6]
  pipeline/
    shift-event-detector.spec.js [Bloco 3]
_design-reference/
  mockup-shift-cards.html       [Bloco 4]
  mockup-carro-novo.html        [estendido no Bloco 6 com aba dyno]
```

---

## BLOCO 1 — Estimativa de marcha + confiança

### Objetivo
Dado um stream de samples de telemetria, retornar a marcha estimada com nível de confiança e método usado.

### Saída obrigatória da função
```js
{
  gear: 1..N | null,           // null = não foi possível estimar
  confidence: 0.0..1.0,
  method: 'rpm_speed' | 'rpm_speed_history' | 'rpm_speed_history_accel' | 'fallback',
  reason: string | null         // se confidence baixa, motivo legível
}
```

### Inputs
- `sample = { rpm, speed, tps, accel: {x,y,z}, timestamp }`
- `history = [...últimos N samples]`
- `carCalibration = { gear_signatures: { 1: {rpm_speed_ratio, ...}, 2: {...}, ... } }`

### Arquivos
- `src/domain/gear-estimation.js` — `estimateGear(sample, history, carCalibration)`
- `src/domain/gear-signatures.js` — `loadSignatures(carId)`, `learnSignature(carId, gear, samples)`
- `src/domain/gear-shift-detector.js` — `detectShiftEvent(history)` retorna `{type:'up'|'down'|null, atIndex}`
- `tests/domain/gear-estimation.spec.js`

### Critérios de aceite
- [ ] Stream sintético de aceleração 1→2→3 → função identifica cada marcha em ≤100ms da troca
- [ ] Velocidade ruidosa (±5%) → confidence cai mas gear continua razoável
- [ ] Sem assinatura calibrada → retorna `{gear:null, confidence:0, method:'fallback', reason:'no calibration'}`
- [ ] TPS=0 + acelerômetro indica desaceleração → reduz confidence (carro provavelmente em neutro / embreagem)
- [ ] Teste cobre: troca pra cima, redução, neutro, patinação (RPM sobe sem accel)
- [ ] Função é pura (sem side-effects, sem IO)

### Não fazer neste bloco
- Não persistir nada. Função retorna valor; quem chama decide o que fazer.
- Não tocar UI.
- Não calcular alvo de troca (Bloco 2).

---

## BLOCO 2 — Modo seguro + alvo conservador

### Objetivo
Computar `shift_optimal_rpm` para a marcha atual; cair em alvo seguro quando confiança ou dados forem insuficientes.

### Saída obrigatória
```js
{
  optimalRpm: number,
  source: 'dyno' | 'learned' | 'safe' | 'unavailable',
  reason: string | null
}
```

### Arquivos
- `src/domain/shift-target.js` — `computeShiftTarget({car, gear, gearConfidence, mode, learnedTargets})`
- `src/domain/safe-mode.js` — `safeTarget(car) = car.redline_rpm - car.safety_margin_rpm`
- `src/data/cars.js` — extende schema do carro:
  - `redline_rpm` (number, obrigatório)
  - `safety_margin_rpm` (number, default 300)
  - `tolerance_rpm` (number, default 150)
  - `dyno_curve` (null no Bloco 2; preenchido no Bloco 6)

### Regras
- `gearConfidence < 0.7` → `source: 'safe'`, alvo = `safeTarget(car)`
- `gearConfidence >= 0.7` E sem dyno E sem learned → `source: 'safe'`
- `gearConfidence >= 0.7` E learned target existe → `source: 'learned'`, alvo específico da marcha
- `gearConfidence >= 0.7` E dyno → `source: 'dyno'` (lógica completa só no Bloco 6; aqui apenas placeholder que retorna safe)

### Critérios de aceite
- [ ] Carro sem dyno + confiança 0.9 → safe target
- [ ] Carro sem dyno + confiança 0.5 → safe target
- [ ] Carro com learned target marcha 3 + confiança 0.9 + gear=3 → learned
- [ ] `redline_rpm` ausente → erro explícito (não usar default mágico)
- [ ] Função é pura

---

## BLOCO 3 — Detecção de evento de troca + persistência

### Objetivo
Pipeline streaming detecta trocas e persiste eventos com todos os 25 campos da spec seção 14, ancorados em `trecho_id`.

### Schema do evento (Dexie store `shift_events`)
```js
{
  id: auto,
  piloto_id: string,
  carro_id: string,
  sessao_id: string,
  volta_id: string | null,
  trecho_id: string | null,
  timestamp: number,
  rpm_before: number,
  rpm_at_shift: number,
  rpm_after: number,
  speed_kmh: number,
  tps: number,
  gear_before: number | null,
  gear_after: number | null,
  gear_confidence: number,
  accel_long_before: number,
  accel_long_during: number,
  accel_long_after: number,
  target_optimal_rpm: number | null,
  target_visual_rpm: number | null,
  delta_rpm: number | null,         // rpm_at_shift - target_optimal_rpm
  status: 'green' | 'red' | 'unknown',
  mode_used: 'DYNO_CALIBRATED' | 'TELEMETRY_LEARNED' | 'SAFE_MODE',
  overrev_flag: boolean,
  data_inconsistent_flag: boolean,
  lesson_text: string | null        // preenchido no Bloco 4
}
```

### Arquivos
- `src/pipeline/shift-event-detector.js` — `createDetector(callbacks)` retorna função `pushSample(sample)`
- `src/data/shift-events.js` — Dexie store + `saveEvent(event)`, `listEventsBySession(sessionId)`
- `src/data/trecho-resolver.js` — `resolveTrechoId({lat, lon, timestamp})` integra com sistema existente do P1 Fast
- `tests/pipeline/shift-event-detector.spec.js`

### Critérios de aceite
- [ ] Stream sintético com N trocas conhecidas → produz N eventos
- [ ] Cada evento tem todos os 25 campos preenchidos OU null com `data_inconsistent_flag=true` e razão
- [ ] `trecho_id` preenchido quando GPS válido E sistema de trecho responde; null caso contrário
- [ ] `lesson_text` é null neste bloco (preenchido no Bloco 4)
- [ ] Detector ignora eventos com TPS<10 (provável neutro/embreagem)
- [ ] Persistência é idempotente (mesmo evento não duplica)

### Integração com sistema de trecho
- `trecho-resolver.js` é o único ponto que chama o sistema de trecho existente. Implementar como adapter — se sistema mudar de API, só esse arquivo muda.
- Se sistema de trecho não estiver disponível em tempo de execução, retornar `null` (não falhar).

---

## BLOCO 4 — Cards pós-sessão (Fast Coach)

### Objetivo
Ao final da sessão, renderizar cards de análise por troca: trecho, marcha, RPM ideal vs real, delta, status verde/vermelho, lição objetiva.

### Mockup primeiro
- `_design-reference/mockup-shift-cards.html` — usa paleta oklch e padrões existentes do projeto.
- Layout: lista vertical de cards. Cada card mostra:
  - Header: "Troca 3→4 — Reta principal" (marcha + trecho)
  - RPM ideal · RPM real · Delta (com cor)
  - Status: verde ou vermelho
  - Frase: "Você trocou cedo. Motor caiu fora da faixa forte. Próxima vez, segure mais."
  - Footer: confiança da marcha (com aviso se baixa) + modo usado

### Arquivos
- `_design-reference/mockup-shift-cards.html`
- `src/domain/shift-analysis.js` — `analyzeEvent(event, car) → { classification, lessonText }`
- `src/ui/shift-cards-view.js` — `renderShiftCards(sessionId, container)`
- `tests/domain/shift-analysis.spec.js`

### Classificação (4 estados)
- `correct` (verde): `|delta| <= tolerance`
- `early` (vermelho): `delta < -tolerance` (trocou cedo)
- `late` (vermelho): `delta > tolerance` (trocou tarde)
- `insufficient_data` (cinza): `gear_confidence < 0.7` ou `data_inconsistent_flag=true`

### Lições (frases pedagógicas, em PT-BR)
- `correct`: "Boa troca. Motor permaneceu na faixa útil e a retomada foi consistente."
- `early`: "Você trocou cedo demais. Motor caiu fora da faixa forte e a aceleração demorou a recuperar. Próxima sessão, segure mais a marcha em <trecho>."
- `late`: "Você passou do ponto ideal. Aceleração já estava perdendo eficiência antes da troca. Próxima sessão, antecipe a troca em <trecho>."
- `insufficient_data`: "Marcha estimada com pouca confiança. Sistema usou modo seguro. Mais voltas vão melhorar a precisão."

### Critérios de aceite
- [ ] Sessão de N trocas → N cards
- [ ] Cor do delta correta (verde dentro de tolerance, vermelho fora)
- [ ] Tolerância usada vem do carro (`tolerance_rpm`) — Bloco 6 sobrescreve com auto-calc do dyno
- [ ] Frase contém nome do trecho quando disponível
- [ ] Cards aparecem só após `session.status === 'finished'`
- [ ] Mockup `mockup-shift-cards.html` reflete o componente final
- [ ] Renderização funcional no browser (testar abrindo o HTML, não só código)

---

## BLOCO 5 — Pilot Reaction Learning Agent

### Objetivo
Aprender o tempo de reação do piloto (por piloto/carro/marcha/trecho) e antecipar `shift_visual_rpm` pra que a troca real aconteça em `shift_optimal_rpm`.

### Modelo
```
shift_visual_rpm = shift_optimal_rpm - reaction_compensation
reaction_compensation = reaction_time_ms * rpm_rise_rate / 1000
```

`reaction_time_ms` é aprendido por tupla `(piloto_id, carro_id, gear, trecho_id)` com fallback hierárquico:
1. Tupla exata
2. Sem trecho: `(piloto, carro, gear)`
3. Sem marcha: `(piloto, carro)`
4. Default global: 250ms

### Arquivos
- `src/domain/pilot-reaction.js` — `learnFromEvent(event)`, `computeCompensation({piloto, carro, gear, trecho, rpmRiseRate})`
- `src/data/reaction-profiles.js` — Dexie store

### Schema `reaction_profiles`
```js
{
  id: auto,
  key: 'piloto:carro:gear:trecho',  // composite key
  reaction_time_ms: number,
  sample_count: number,
  last_updated: timestamp
}
```

### Regras de aprendizado
- Apenas eventos com `gear_confidence >= 0.8` E `data_inconsistent_flag === false` E `status === 'correct'` ou `late` (não aprender com `early` — pode ser piloto cauteloso)
- Ajuste suave: `new_rt = old_rt * (1 - alpha) + observed_rt * alpha`, com `alpha = 0.15`
- Mínimo 10 samples antes de aplicar `reaction_compensation` na tupla específica
- Compensação clampeada: `max 400ms`, `min 50ms`

### Integração com `shift-target.js`
- Quando piloto está em **modo assistido** + tupla tem ≥10 samples → aplica compensação
- Caso contrário → usa `shift_optimal_rpm` puro como `shift_visual_rpm`

### Critérios de aceite
- [ ] Após 10 eventos correctos numa tupla, `reaction_time_ms` da tupla é aprendido
- [ ] Compensação aplicada → `visual_rpm < optimal_rpm`
- [ ] Mudança de `reaction_time_ms` entre eventos consecutivos ≤ 50rpm equivalentes
- [ ] Eventos com gear_confidence baixa NÃO afetam aprendizado
- [ ] Fallback hierárquico funciona quando tupla mais específica não tem dados

---

## BLOCO 6 — DYNO_CALIBRATED + UI cadastro

### Objetivo
Parsing de CSV de dinamômetro, cálculo de alvo por marcha pela curva real (não pico de torque), tolerância auto-calculada.

### Mockup primeiro
- Estender `_design-reference/mockup-carro-novo.html` com aba "Dinamômetro":
  - Botão "Carregar CSV" (Dynojet/Mustang/Dynapack auto-detectado)
  - Preview da curva renderizada (canvas ou SVG simples)
  - Lista editável de pontos (RPM, torque, potência) — fallback manual
  - Campo `redline_rpm` (auto-detectado da curva, editável)
  - Campo `tolerance_rpm` (auto-calculado da janela útil, editável)

### Arquivos
- `src/domain/dyno-csv-parser.js` — `parseDynoCsv(text) → { format, points: [{rpm, torque_nm, power_kw}] }`
- `src/domain/dyno-target-calculator.js` — `computeOptimalRpmPerGear({curve, gear_ratios, final_drive})`
- `src/domain/tolerance-from-dyno.js` — `computeTolerance(curve, percent=5)`
- `src/data/cars.js` — adicionar campo `dyno_curve` (array de pontos)
- `tests/domain/dyno-target-calculator.spec.js`

### Lógica do alvo (NÃO é pico de torque)
A troca ideal não é no pico de torque. É no ponto onde **continuar na marcha atual passa a ser pior do que trocar pra próxima**.

Algoritmo (simplificado para o MVP):
1. Calcular potência efetiva nas rodas em cada RPM da marcha N: `power_at_wheel(rpm, N)`
2. Para a marcha N+1, dado o mesmo RPM físico do motor, qual seria o RPM na marcha N+1 após a troca? `rpm_after = rpm * gear_N+1 / gear_N`
3. Comparar `power(rpm, N)` vs `power(rpm_after, N+1)`
4. Alvo = primeiro RPM onde `power(rpm_after, N+1) > power(rpm, N)`

Requer cadastro de `gear_ratios` no carro. Se ausente, fallback = 90% do redline.

### Tolerância auto-calculada
Janela útil = faixa de RPM onde potência ≥ 95% do pico.
`tolerance_rpm = janela_util_largura * 0.05` (mínimo 80, máximo 250).

### Critérios de aceite
- [ ] CSV de exemplo (Dynojet format) → parseia corretamente
- [ ] CSV de exemplo (Mustang format) → parseia corretamente
- [ ] CSV inválido → erro legível, não trava
- [ ] Curva com 5 pontos manuais → cálculo de alvo funciona com interpolação
- [ ] Sem `gear_ratios` → fallback documentado em `reason`
- [ ] Tolerância auto = 5% da janela útil, com clamp [80, 250]
- [ ] `shift-target.js` agora retorna `source: 'dyno'` quando dados completos
- [ ] Mockup do cadastro de carro tem aba dyno funcional

---

## Definição de "concluído"

Plano todo está concluído quando:
- Os 6 blocos têm todos os critérios de aceite ✅ no `SHIFT_LIGHT_PROGRESS.md`
- Auditor passa em todos os 6 blocos
- `git log` mostra commits ordenados por bloco
- Não há regressão visível no `mockup-cockpit-piloto.html` (auto-cycle continua funcionando)
- `STATUS.md` ou similar do projeto referencia este plano e seu status final
