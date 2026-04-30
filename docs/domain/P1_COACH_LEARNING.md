# P1 Coach — Track Learning

Sistema pedagógico do P1 Fast. **Apenas comportamento do piloto dentro
do carro** — nada de setup, box, racecraft agressivo ou ajustes mecânicos.

Implementado em 2026-04-30 (ajuste de base — P1 Track Learning).

---

## 1. Princípio

O piloto roda um stint normal. Em qualquer momento ele pode escolher,
no painel do cockpit, a opção:

> **Aprendizado com IA**

Ao entrar nesse modo, o piloto seleciona uma **área de foco**:

- `entrada` — o que faço chegando na curva (ponto de freio, vista,
  estabilidade da freada)
- `apex` — o que faço no meio (V-min, corda, controle)
- `saida` — o que faço saindo (acelerador progressivo, traçado de
  saída, tração)

Opcionalmente trava em **uma lição específica** (ex: "só V-Min nesse
stint"). Opcionalmente trava em **um trecho específico** (ex: "só no S
do Senna").

A partir daí o **P1 Coach** vai pedagogicamente liberando mensagens
curtas (≤ 3 palavras) por curva enquanto o piloto está em movimento.

---

## 2. Arquitetura

```
┌──────────────┐                ┌──────────────────────────┐
│ MobileTele-  │   sample bus   │ Detector / fase-curva    │
│ metry (GPS+  │ ─────────────▶ │ (já existente — entrega  │
│ IMU iPhone)  │                │  fase INICIO/MEIO/FIM    │
└──────────────┘                │  + velMinima/apex etc)   │
                                └──────────────┬───────────┘
                                               │ snapshot + faseStats
                                               ▼
                                ┌──────────────────────────┐
                                │      P1 Coach            │  ← nasceu aqui
                                │  (src/domain/p1-coach.js)│
                                │                          │
                                │  • Biblioteca de Lições  │
                                │  • Gating por sinais     │
                                │  • Eleição por curva     │
                                │  • Cooldown / 1-por-curva│
                                └──────────────┬───────────┘
                                               │ CoachMessage
                                               ▼
                                          UI cockpit
```

Camadas novas (autocontidas, não tocam nada do pipeline atual):

| arquivo | papel |
|---|---|
| `src/domain/lesson-schema.js` | Tipos canônicos `P1TrackLesson` + `validateLesson` + `canActivate`. Catálogo de `Signal`. |
| `src/data/lesson-library.js` | 12 lições — 7 MVP (`active: true`) + 5 Fase 2 (`active: false`). |
| `src/data/coach-phrases.js` | Catálogo `M### → texto 2..3 palavras`. SEPARADO de `pipeline/phrases.js`. |
| `src/domain/p1-coach.js` | Engine: ciclo `startLearningSession → onSegmentEnter → consume → onSegmentExit → onLapEnd`. |
| `src/domain/trajectory-monitor.js` | Avalia desvios em metros (ponto de freio, giro, tração, entrada, apex) vs volta-ref. Fecha o loop de successCriteria de L001/L007. |
| `tests/node-smoke-p1-coach.mjs` | 28 asserts (schema, blacklist, gating, cooldown, foco, BAIXA confidence, E2E). |
| `tests/node-smoke-trajectory-monitor.mjs` | 20 asserts (detecção de eventos, distância em metros, fallback sem IMU, successCriteria). |

---

## 3. Schema `P1TrackLesson`

```js
{
  id: 'L002-v-min',                 // L### + slug-kebab
  title: 'V-Min',
  category: 'velocidade',           // referencia|velocidade|transicao|
                                    // controle|visao|superficie
  level: 'intro',                   // intro|padrao|avancado
  shortDescription: 'Manter velocidade mínima alta e consistente no apex.',
  objective: 'Elevar velMinima média e reduzir desvio entre voltas válidas.',
  phaseWeights: { apex: 1.0 },      // soma deve dar 1.0
  requiredSignals: ['kmh','velMinima','phase'],   // gating absoluto
  optionalSignals: ['apexKmh'],
  applicableCornerTypes: ['lenta','media'],
  preferredMessageCodes: ['M010','M011','M012'],
  successCriteria: {
    metric: 'velMinima média + desvio < 1.5km/h em 3 voltas',
    confidence: 'alta',             // alta|media|baixa
  },
  active: true,
}
```

Validação eager na carga (`validateLesson()`): qualquer lição malformada
quebra o build do projeto. Critérios duros:

- `id` no formato `L### + slug-kebab`
- `phaseWeights` soma exatamente 1.0
- `requiredSignals` não-vazio, todos pertencem ao catálogo `Signal`
- `applicableCornerTypes` ⊆ `lenta|media|rapida`
- `preferredMessageCodes` no formato `M###`, todos com frase no
  `coach-phrases.js`
- `successCriteria.metric` obrigatório (texto livre, mas presente)

---

## 4. Biblioteca canônica (12 lições)

### MVP — ativam imediatamente (iPhone-only basta)

| ID | Título | Fase principal | Confidence | Sinais críticos |
|---|---|---|---|---|
| L001 | Referência Fixa | entrada (0.6) | alta | lat, lng, kmh, trajetoria |
| L002 | V-Min | apex (1.0) | alta | kmh, velMinima, phase |
| L003 | Transição Freio-Acelerador | apex (0.4) | media | accLong, kmh, phase |
| L004 | Acelerador Progressivo | saida (1.0) | media | accLong, kmh, phase |
| L005 | Linha de Visão | entrada (0.7) | baixa | heading, gyroAlpha, phase |
| L006 | Controle de Subesterço | apex/saida (0.5/0.5) | media | accLat, kmh, gyroAlpha, phase |
| L007 | Curva Cega | entrada (1.0) | alta | lat, lng, kmh, trajetoria |

### Fase 2 — ativam quando sensores entrarem

| ID | Título | Bloqueada por |
|---|---|---|
| L101 | Volante Contínuo | `steering.angle` (CAN volante) |
| L102 | Círculo de Grip | `accLat+accLong` precisos (RaceBox) |
| L103 | Pneu Arrastando | `slip.ratio` (sensor de roda) |
| L104 | Controle de Sobresterço | `steering.angle` + IMU |
| L105 | Uso Seguro de Zebra | GPS 10cm (RaceBox) + IMU vertical |

### Fora da base — não viraram lição (excluídas explicitamente)

Brake Bias Frontal/Traseiro, Drag Braking, Engine Braking agressivo,
Configuração FFB, Ajuste de Diferencial, Aerodinâmica, Pressão PSI no
box, Side Drafting, Vortex of Danger, Defesa de Posição, Manobra Fake,
Slipstream, Sobrevivência na Volta 1.

O smoke `node-smoke-p1-coach.mjs` tem um teste de blacklist que falha
o build se algum desses temas voltar a aparecer.

---

## 5. Frases (≤ 3 palavras)

Catálogo em `src/data/coach-phrases.js`. **Validação eager em runtime**:
toda frase precisa ter 2 ou 3 palavras, senão o módulo lança erro na
importação.

Exemplos:

```
M010 Mais V-min       (L002)
M020 Sem coast        (L003)
M030 Mais suave       (L004)
M040 Olha saída       (L005)
M050 Alivia gira      (L006)
```

A escolha de qual `M###` emitir dentro da lição é determinada pela
fase corrente (`entrada → idx 0`, `apex → idx 1`, `saida → idx 2`).

**Nada se mistura com `src/pipeline/phrases.js`.** Aquele arquivo é a
biblioteca canônica de pista (FrasesAcao, FrasesConfirmacao etc). O
P1 Coach tem catálogo próprio para não vazar mensagens pedagógicas em
contexto de alerta determinístico.

---

## 6. Engine (`P1Coach`)

### Ciclo de vida

```js
import { p1Coach } from './src/domain/p1-coach.js';

p1Coach.onMessage = (msg) => box.show(msg.text);

// ── piloto entrou no modo "Aprendizado com IA" ──
p1Coach.startLearningSession({
  focusPhase: 'saida',           // opcional, mas recomendado
  focusLessonId: null,            // opcional — trava em 1 lição
  segmentId: null,                // opcional — trava em 1 trecho
});

// ── caller liga aos eventos do detector ──
detector.onSegmentStart = (seg, snap) => {
  const signals = P1Coach.signalsFromSnapshot(snap, faseStats);
  p1Coach.onSegmentEnter(seg, signals);
};

timebase.onTick(10, (snap, faseStats) => {
  p1Coach.consume({
    faseCurva: faseStats.faseAtual,           // 'inicio'|'meio'|'fim'
    snapshot: snap,
    signals: P1Coach.signalsFromSnapshot(snap, faseStats),
  });
});

detector.onSegmentEnd = () => p1Coach.onSegmentExit();
detector.onLapEnd     = () => p1Coach.onLapEnd();

// ── piloto saiu do modo ──
p1Coach.endLearningSession();
```

### Regras invioláveis

1. **Gating duro por sinais** — se `requiredSignals` não estão TODOS
   presentes no snapshot atual, lição não ativa.
2. **1 lição ativa por curva** — `_activeLessonForCorner` é eleita em
   `onSegmentEnter`, não muda no meio da curva.
3. **`maxPerCorner` = 1** — máximo 1 mensagem por curva.
4. **Cooldown global = 3500 ms** — entre mensagens de curvas diferentes.
5. **BAIXA confidence só dispara se piloto declarou foco** — evita
   chutar instrução baseada em proxy ruim quando o piloto está só
   girando livre.
6. **CRÍTICO/BOX_AGORA tem prioridade** — caller precisa dar
   `p1Coach.pause()` durante alertas de `CriticalRulesEngine` (ADR-008).
7. **Retas ignoradas** — `ehTrecho === false` zera o estado do coach.

### Eleição de lição (em `onSegmentEnter`)

1. Se piloto travou `focusLessonId`: usa essa, se compatível
   (cornerType + sinais).
2. Senão: filtra `activeLessons()` por `cornerType` aplicável e
   `canActivate(signals)`.
3. Se piloto não declarou foco e não escolheu lição: remove BAIXA
   confidence do pool.
4. Se piloto declarou `focusPhase`: prioriza lições com peso ≥ 0.5
   nessa fase.
5. Empate: maior peso na fase, depois ordem de id.

---

## 7. Fluxo na UI (proposto)

```
┌────────────────────────────────┐
│ STINT EM ANDAMENTO              │
│                                 │
│ [● Aprendizado com IA]          │  ← piloto toca
└──────────────┬──────────────────┘
               ▼
┌────────────────────────────────┐
│ ESCOLHA UMA ÁREA DE FOCO        │
│                                 │
│ [ ENTRADA ]  [ APEX ]  [ SAÍDA ]│
│                                 │
│ [ ▾ Lição específica (opcional)]│
│ [ ▾ Trecho específico (opcional)]│
└──────────────┬──────────────────┘
               ▼
┌────────────────────────────────┐
│ Em pista — coach ativo          │
│                                 │
│       MAIS V-MIN                │  ← M010 (L002 apex)
│                                 │
│ Foco: APEX • Lição: V-Min       │
│ [ ENCERRAR APRENDIZADO ]         │
└────────────────────────────────┘
```

Modal "Lição específica" lista as 7 ativas. Modal "Trecho específico"
lista os trechos com `ehTrecho === true` da pista atual.

---

## 8. Roadmap

### MVP — pronto agora
- [x] Schema validado
- [x] 7 lições ativas (comportamento dentro do carro)
- [x] 5 lições inativas pré-cadastradas (Fase 2)
- [x] Catálogo de frases ≤ 3 palavras
- [x] Engine com gating, foco, cooldown, BAIXA confidence
- [x] Smoke 22/22

### Fase 1.1 — integração com cockpit (UI separada do pacote)
- [x] Exemplo de wire-up em `examples/p1-coach-wireup.js`
      (Detector + sample-bus + state-machine de fase live)
- [ ] Botão "Aprendizado com IA" no painel do stint
- [ ] Modal de seleção de área (entrada/apex/saida)
- [ ] Renderização da `CoachMessage.text` no cockpit
- [ ] Suspensão automática quando `CriticalRulesEngine` emitir CRÍTICO+

### Fase 2 — sensores adicionais
- [ ] T4000 live → `tps`, `rpm`, `map`, `lambda` no snapshot
  (BLOCKERS E2)
- [ ] Sensor de volante → `steering.angle` (libera L101, L104)
- [ ] RaceBox 25Hz → `accLat/accLong` precisos (libera L102)
- [ ] Sensor de roda/slip → `slip.ratio` (libera L103)
- [ ] GPS 10cm + IMU vertical → libera L105 (zebras)

### Fase 3 — pós-stint
- [ ] Avaliar `successCriteria.metric` por lição treinada
- [ ] Persistir histórico de "lição treinada × resultado" para
  alimentar `pedagogical-decider.js` no debrief

---

## 9. Testes

`tests/node-smoke-p1-coach.mjs` — 22 asserts cobrindo:

- contagem da biblioteca (7 + 5)
- `active=true/false` corretos
- `validateLesson` em todas
- `phaseWeights` somam 1.0
- **blacklist semântica** — falha se brake bias / FFB / slipstream /
  vortex / etc reaparecerem em title/shortDescription/objective
- presença dos 7 títulos MVP e 5 Fase 2 esperados
- frases todas com 2..3 palavras
- todo `preferredMessageCode` mapeia para frase existente
- gating: `canActivate` bloqueia sem sinais; libera com sinais
- engine: emite no foco / não emite fora do foco / 1 por curva /
  cooldown / pause-resume / focusLessonId / sem learningSession /
  BAIXA bloqueada sem foco / BAIXA liberada com foco
- `signalsFromSnapshot` deriva corretamente

Roda com `node tests/node-smoke-p1-coach.mjs`.

---

## 10. Decisões travadas

- **Biblioteca em arquivo de dados (`src/data/`), não em DB.** A
  biblioteca é parte do produto, não conteúdo de usuário. Mudar uma
  lição = PR.
- **Frases canônicas em catálogo separado de `pipeline/phrases.js`.**
  Pedagógico (P1 Coach) não pode contaminar o broker de pista.
- **Validação eager.** Fail-fast na importação se algo na biblioteca
  está malformado.
- **`active: false` em Fase 2 não é "esconder" — é gating duro.**
  Mesmo se o engine quiser emitir, lição inativa nunca entra no pool.
- **`requiredSignals` é a única fonte de verdade do gating.** Sem ele,
  não dá pra emitir mensagem do P1 Coach.
- **BAIXA confidence ≠ proibida — é guardada por intenção do piloto.**
  Quando o piloto pede "foco em linha de visão", aceita o risco do
  proxy.
- **`trajetoria` é optional, não required (auditoria 2026-04-30).**
  Inicialmente L001/L007 listavam `trajetoria` como required, mas
  nenhum módulo do pipeline emite esse sinal pronto. Voltou para
  `optionalSignals` — a comparação com a volta de referência é
  responsabilidade da camada de cima (`reference-line.js` ou um
  `trajectory-monitor` futuro). O coach só decide QUANDO emitir.
- **Fase 2 é gated por `active: false`, não por sinais.**
  Algumas Fase 2 (L102 círculo de grip, L105 zebra) têm
  `requiredSignals` que o iPhone produz. O bloqueio efetivo vem do
  flag `active` — `activeLessons()` filtra antes do gating de sinais.
  Quando o sensor real entrar (RaceBox p/ L105), basta virar
  `active: true`.
