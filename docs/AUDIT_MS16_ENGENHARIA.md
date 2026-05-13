# Auditoria MS-16 — Command Box Engenharia

**Data:** 2026-05-13
**Auditor:** Claude (sessão `claude/audit-engineering-module-Ael3m`)
**Escopo:** Estado em `origin/main` após PRs #194..#200 mergeados.
**Modo:** Read-only. Nenhuma alteração de código. Reporte de gaps + prioridade.

> Esta auditoria não reabre decisões fechadas (D1, D2, D3, D6, D14, D17, D18 — §11
> de `docs/COMMAND_BOX_ENGENHARIA.md`). Foca em **fidelidade de implementação
> versus spec**, **paridade JS↔Swift**, **cobertura de testes**, **observabilidade**,
> e **bugs sutis** que viraram dívida silenciosa.

---

## 1. Sumário executivo

**Veredito:** MS-16 está sólido em estrutura. ADR-008 respeitado em todas as
camadas (IA não decide alerta crítico). Smokes verdes (49 Swift + 21 Node = 70
casos novos). Migrations versionadas, RLS coerente com `is_member(time_id)`.

**Mas existem 3 dívidas reais que merecem fechamento antes da MS-16.5b (Views
SwiftUI) consumir o domain:**

| Prioridade | Gap | Impacto | Esforço |
|---|---|---|---|
| **P1** | IAT (Intake Air Temp) nunca é alimentado no `VehicleContextAggregator` | Rule `vmin-progressive-loss-segment` perde correlação chave (Vmin↓ × IAT↑) — o `evidenciaTexto` da regra prevê o campo, mas ele sempre sai vazio. Recomendação degrada em qualidade narrativa. | 0,5 d (1 PR, ~80 LOC) |
| **P2** | `WaterTempDriftNoCoolingRule` não filtra "carga alta" como o doc-spec exige | Falso positivo provável em subidas/longa reta sustentada — racional da regra fala de "padrão NÃO ligado a carga" mas o código só checa drift. | 0,5 d (mesma rule, +20 LOC + 2 smokes) |
| **P3** | `TelemetryTimebase.swift` não tem `onTick(rateHz, callback)` que existe em JS | Gap funcional pequeno (Swift idiomatic delega ao caller via Task/Timer), mas hub iOS captura precisa de tick consolidado pro detector ao vivo — vai aparecer no momento em que a captura iOS começar a consumir o Timebase. | 0,5 d (1 PR Swift + smoke) |

Mais 5 itens menores listados em §6 (defeitos sutis e code smells) — nenhum
bloqueia MS-16.5b, mas alguns merecem 1 linha de comentário para não virarem
arqueologia daqui a 3 meses.

---

## 2. Inventário consolidado (em `origin/main`)

### Camada 1 — Engine Core
| Arquivo | LOC |
|---|---|
| `ios/p1fast-core/Sources/P1FastCore/TelemetryTimebase.swift` | 349 |
| `src/telemetry/timebase.js` (source-of-truth JS) | 304 |

### Camada 2 — VehicleContext + Calibration
| Arquivo | LOC |
|---|---|
| `ios/p1fast-core/Sources/P1FastCore/VehicleContextAggregator.swift` | 483 |
| `EngineeringFinding.swift` (tipos) | 157 |
| `CalibrationEngine.swift` | 134 |
| `CalibrationRules/FuelLeanSustainedLoadRule.swift` | 126 |
| `CalibrationRules/WaterTempDriftNoCoolingRule.swift` | 134 |
| `CalibrationRules/VminProgressiveLossSegmentRule.swift` | 147 |

### Camada 3 — Senior Advisor
| Arquivo | LOC |
|---|---|
| `api/advisor.js` | 193 |
| `api/_lib/schemas.js` (validação findings[]) | 222 |

### UI domain (sem SwiftUI)
| Arquivo | LOC |
|---|---|
| `ios/p1fast-core/Sources/P1FastCore/EngControlModel.swift` | 231 |

### Persistência Supabase
| Arquivo | LOC |
|---|---|
| `supabase/migrations/0020_engineering_findings.sql` | 54 |
| `supabase/migrations/0021_engineering_recommendations.sql` | 70 |
| `tests/node-smoke-schema-parity.mjs` (cobre as 2 tabelas via `PG_ONLY_TABLES`) | 199 |

### Testes (smokes)
| Suite | Casos | Runner |
|---|---|---|
| TB-01..12 (TelemetryTimebase Swift) | 12 | `ios/.../P1FastSmoke/main.swift` |
| VCA-01..10 (VehicleContextAggregator) | 10 | idem |
| CE-01..15 (CalibrationEngine + 3 rules) | 15 | idem |
| ECM-01..12 (EngControlModel + DecisionPolicy) | 12 | idem |
| TPB-01..12 (Timebase parity JS↔Swift) | 12 | `tests/node-smoke-timebase-swift-parity.mjs` |
| AF-01..09 (advisor findings enrichment) | 9 | `tests/node-smoke-advisor-findings.mjs` |
| **Total novos MS-16** | **70** | — |

**Nota:** `STATUS.md` (sessão 2026-05-13) reporta "67 testes automáticos novos
verdes". Contagem real: **70**. Divergência leve, provavelmente o STATUS
foi escrito antes do AF-* fechar. Não-bloqueante.

---

## 3. Camada 1 — TelemetryTimebase: paridade JS↔Swift

**Veredito:** Paridade quase 1:1. Constantes idênticas (`BUFFER_MAX_AGE_MS=10_000`,
`LATENCY_WINDOW=32`, mesma tabela `DEFAULT_FRESHNESS_MS` por fonte). Lógica de
ingest, OUT_OF_ORDER, DUPLICATE, jitter, latency e GC bate.

### 3.1. Divergências catalogadas

**3.1.a — `onTick(rateHz, callback)` existe só em JS** (`timebase.js:242-265`).
Swift entrega `snapshotAt` + `snapshotNow` mas não tem tick consolidado interno.
Em iOS, esperado o caller usar `Timer.scheduledTimer` ou `Task` com `Task.sleep`.
**Gap funcional pequeno** — vai aparecer quando o detector ao vivo iOS precisar
consumir snapshots a taxa fixa (10 Hz).

**3.1.b — `snapshotAt()` semântica de fonte sem amostra.** JS retorna
`{ sample: null, quality: MISSING, ageMs: null }` para fontes registradas mas
sem amostra na janela (`timebase.js:218-221`). Swift omite essas fontes do dict
`sourcesData` (`TelemetryTimebase.swift:294-304`). Equivalente do ponto de vista
do `SnapshotBuilder` (ausência = MISSING), mas se algum consumidor iterar
`sourcesData.keys` esperando ver todas as fontes attached, vai diferir. **Não tem
teste cobrindo** essa diferença.

**3.1.c — Logger acoplado em JS, ausente em Swift.** `timebase.js` chama
`logger.warn` / `logger.info` / `logger.debug` em re-attach, source attached,
out-of-order. Swift não loga. Pode ser intencional (core puro determinístico
ADR-008), mas tira observabilidade em prod. Sugestão: injetar protocolo
`TimebaseLogger` opcional pro caller decidir.

### 3.2. Pontos fortes
- `Clock.nowMono` injection-able (testes determinísticos).
- `snapshotBuilder` injection-able (composição limpa).
- Stats expõem `discardedOutOfOrder`, `discardedDuplicate`, `jitter`,
  `latencyMedianMs`, `ratePerSec`, `ageMs`, `quality` — engenheiro consegue
  ver fonte fraca rapidamente.

### 3.3. Cobertura de testes
- TB-01..12 cobre attach, ingest, snapshot, OUT_OF_ORDER, DUPLICATE, GC,
  freshness LATE/MISSING, jitter, detach.
- TPB-01..12 (Node) executa o **mesmo conjunto contra o JS** — paridade
  enforced automaticamente em CI. Excelente.
- **NÃO cobertos:**
  - `snapshotAt` em fonte com 0 amostras (gap 3.1.b).
  - `onTick` (gap 3.1.a — não existe em Swift).

---

## 4. Camada 2 — VehicleContext + CalibrationEngine

### 4.1. Gap P1: IAT (Intake Air Temp) nunca é alimentado

**Localização:** `VehicleContextAggregator.swift:209-214`.

```swift
private var lapIatStart: Double?
private var lapIatEnd: Double?
private var lapIatSum: Double = 0
private var lapIatCount: Int = 0
```

Essas 4 variáveis são **lidas** (em `LapWindow` constructor, `currentContext()`,
`onLapEnd` retro-fill de `iatAvgC` em `vminBySegmentLap`) mas **nunca escritas**.
O comentário nas linhas 259-260 reconhece:

> IAT lives em snap.engine não tem campo dedicado — virá do T4000 mais tarde.
> Por enquanto deixamos vazio; caller pode estender. (Documentado em MS-16.3.)

**Impacto:** A `VminProgressiveLossSegmentRule` (CR3) usa `iatAvgC` no
`evidenciaTexto` (`VminProgressiveLossSegmentRule.swift:97-100`):

```swift
"v\(rec.lapNumero): Vmin \(...) km/h" +
(rec.iatAvgC.map { " · IAT \(...) °C" } ?? "")
```

Sem IAT, a evidência sempre sai sem o sufixo "· IAT X °C". A Camada 3 (advisor.js)
recebe finding sem essa correlação e perde a chance de distinguir
**degradação de pneu × térmica de admissão** — exatamente o que o `racional`
da recomendação promete fazer (linha 119-122).

**Recomendação:**
1. Adicionar campo `iatC` em `EngineFields` (Snapshot) com source T4000.
2. No `ingestSnapshot`, popular `lapIatStart` / `lapIatEnd` / `lapIatSum` / `lapIatCount`.
3. Adicionar smokes VCA específicos para IAT.
4. Smoke CE-* verificando que CR3 emite `iatAvgC` no evidenciaTexto quando dado disponível.

**Esforço:** ~80 LOC + 4 smokes. Meio dia.

### 4.2. Gap P2: `WaterTempDriftNoCoolingRule` não filtra carga

**Localização:** `WaterTempDriftNoCoolingRule.swift:38-92`.

O comentário no topo da regra (linhas 9-11) diz:

> Dispara quando: drift sustentado > 3°C/min na janela rolling 5 min
> **E motor não está em padrão de carga alta (RPM mid-range, MAP médio).**

Mas o `evaluate()` **não checa carga**. Só checa drift. Resultado: motor em
subida sustentada (TPS 100%, MAP alto, RPM alto) vai naturalmente esquentar a
água — e a regra vai disparar "Investigar arrefecimento" quando o sintoma é
USO normal, não falha mecânica.

**Recomendação:** Adicionar checagem cruzada com `context.lap.rpmMax` e
`leanLoadSamples` da volta atual. Se a volta acumulou > N samples em carga alta,
desconta do drift atribuível a problema. Alternativa mais simples: só disparar
se a fase térmica já é `.atTemp` ou `.overheat` (linha 53-54 já tem essa info,
mas usa só pra severidade — não pra gate).

**Esforço:** ~20 LOC + 2 smokes (positive + negative). Meio dia.

### 4.3. Outros pontos da Camada 2

**State machine térmica (`updateThermalPhase`):** funciona, mas tem uma sutileza
não testada. Se `windowMs < 30_000` em todas as iterações iniciais (chuva de
samples rápidos), nunca atualiza o marker `lastWaterTempSampleForCooling`. Numa
primeira run normal não dá problema (caller bombeia a 10 Hz, 30s = 300 samples).
**Sem teste cobrindo** — vale 1 smoke VCA cobrindo cooling detection.

**`bestLapMs` aceita lap=0:** `onLapEnd` linhas 300-306 — se a primeira
`event.tempoMs` vier 0, `bestLapMs` continua `nil` (correto). Mas se vier `Int.max`
ou número absurdo, é aceito como best. Não tem upper-bound validation. Não é
crítico — `tempoMs` é validado upstream.

**`vminBySegmentLap` sem upper-bound de segments:** se o circuito tiver 100
segments e 30 voltas, dict explode pra 3000 records. Em pista típica (12-15
segments × até 30 voltas = 450 records) é trivial. Mas considerar GC se a
spec mudar.

### 4.4. CalibrationEngine — análise do motor

**Cooldown por regra OK** (`CalibrationEngine.swift:69-73`).
**Confidence gating OK** (linhas 87-89 — só promove a recommendation se confiança ≥ threshold default `media`).
**`evaluate(context:now:)` é puro** — sem side effect além do cooldown
local em `lastFiredAt`. ADR-008 respeitado. Bom.

**Helper `newFindingId()` / `newRecommendationId()` usam UUID().** Não
determinístico — testes que comparam id exato não funcionariam. Os smokes
CE-* parecem comparar shape, não id literal. **OK.**

---

## 5. Camada 3 — advisor.js + governança IA

### 5.1. System prompt — análise

Bem estruturado. Cobre:
- **Governança Diretor Técnico** ("setup nunca antes de excluir pilotagem", fases da curva, "o que não mexer").
- **FINDINGS CODIFICADOS** (linhas 41-46) — define o contrato exato com a
  Camada 2: priorizar, explicar, validar, detectar conflito, reduzir confiança,
  não contradizer sem motivo.
- **Brevidade brutal** + JSON estrito.

**ADR-008 respeitado:** IA não decide. Recebe findings, ajuda a humano decidir.

### 5.2. Code smell: shadow de `parsed`

`advisor.js:149` declara `const parsed = advisorPayload.parse(...)`. `advisor.js:175`
declara `let parsed;` dentro do `try` block. JavaScript `let` é block-scoped, então
não é bug funcional, mas **leitura é confusa** — alguém vai assumir que `parsed`
do try refere ao mesmo objeto. Sugestão: renomear o segundo para `claudeResponse`
ou `aiOutput`. ~3 LOC change.

### 5.3. Schema validation `findings[]`

`api/_lib/schemas.js:163-173` valida:
- max 50 findings (DoS guard ✓)
- enums severidade / confianca / escopo ✓
- ids e títulos com limites de tamanho ✓

**Não valida** `evidencia` (numeric map) ou `evidenciaTexto` (string array).
Mas `buildUserPrompt` também não os passa pro LLM — só usa `titulo`, `severidade`,
`confianca`, `escopo`, `descricao`. Decisão deliberada de economia de tokens.
**OK,** mas amarrar isso com 1 comentário no schema seria útil.

### 5.4. Cobertura AF-01..09

Cobre: compat retro (sem findings), payload válido, severidade inválida,
confianca inválida, limit 50, governança no system prompt, campo no
`buildUserPrompt`, retrocompat com findings ausente. **Razoável.**

**Não cobertos:**
- Caller envia `findings` com `evidencia`/`evidenciaTexto` populado → schema
  silenciosamente descarta. Vale 1 smoke documentando esse comportamento.
- Anthropic upstream retorna JSON inválido → 500. Sem teste (mocks pra
  Anthropic complicam, fair enough).

---

## 6. EngControlModel + EngineeringDecisionPolicy

### 6.1. EngControlModel — sólido

- `clampAndSnap` aplicado tanto no construtor quanto em `tryChange` ✓.
- `value` é imutável, `withValue` retorna nova instância ✓ (Swift idiomatic).
- `canOperate` cobre as 5 papéis (chefe / engenheiro / mecanico / piloto / readonly).
- Factories (`fuelAdjustmentSlider`, `rpmTargetKnob`, `moduloEngenhariaToggle`)
  oferecem ranges sensatos pro Celta 1.4.

### 6.2. D17 fechada — verificação

> "Piloto edita/simula só com carro parado; chefe + engenheiro livres a qualquer
> momento" — STATUS.md sessão 2026-05-13.

Confirmado em `EngControlModel.swift:116-127` e `EngineeringDecisionPolicy.swift:179-201`:
- `chefe` + `engenheiro` → livres (linhas 118-119).
- `piloto` → só com `carroParado` (linha 123).
- `mecanico` → só com `carroParado` (linha 121). **Nota:** isso diverge
  ligeiramente da decisão D17 textualmente — D17 fala em "chefe + engenheiro
  livres", não cobre mecanico explicitamente. Implementação interpretou
  "mecanico = só parado" — sensato (mecânico no carro = parado por definição),
  mas merece consenso com Flávio.
- `readonly` → bloqueado.

### 6.3. D18 — switch automático

Comentado no doc (`§11 D18`) e em `EngControlPapel`. **NÃO existe** ainda um
arquivo `CockpitModeResolver.swift` (ou JS equivalente) que materializa a
heurística `(modulo_ativado AND carro_parado) → ENGENHARIA`. **Aceito** — é
problema de Views / Cockpit, fica pra MS-16.5b ou um sub-PR antes dela.

### 6.4. Cobertura ECM-01..12

Cobre: clamp/snap, range, permission gating por papel + carroParado,
transitions pendente→aprovada/editada/rejeitada, D8 bloqueio de duplo-decide,
piloto bloqueado em mudança quando rodando. **Adequado.**

---

## 7. Migrations 0020 + 0021 — análise

### 7.1. Coerência com o resto do schema

- `engineering_findings.id` é `text` (não uuid) — paridade com
  `"fin-{uuid8}"` gerado pelo `newFindingId()`. ✓
- `time_id` + `sessao_id` com FK ON DELETE CASCADE ✓ (limpa órfãos).
- RLS com `is_member(time_id)` paridade com `mensagens` / `segment_executions`.
- Index em `(sessao_id, criado_em desc)`, `rule_id`, `segment_id`, `time_id` ✓.
- `enum public.finding_severidade` / `finding_confianca` / `finding_escopo` ✓.
- `recommendations.finding_ids` é `text[]` — relacionamento M:N implícito sem
  tabela join. **Aceitável** porque cardinalidade é baixa (1 finding → 1 rec
  na maioria dos casos), mas se precisar buscar "todas as recommendations que
  referenciam este finding", vai ser sequential scan. Sugestão: adicionar
  index GIN em `finding_ids` se essa query aparecer.

### 7.2. RLS — análise

`engineering_findings` é insert-only (sem policy UPDATE/DELETE) → append-only
enforced. ✓ (ADR-014 padrão.)

`engineering_recommendations` tem UPDATE permitido pra qualquer membro do time.
**Refinamento D8 (chefe-only decide rejected)** está documentado em comentário
SQL (linha 59-60) como "PR futuro via `is_chefe_equipe()`". **Gap conhecido,
não-bloqueante.**

### 7.3. Pendente de aplicação

Migrations versionadas mas **NÃO aplicadas em prod** (`supabase db push`
manual do Flávio). Schema-parity test (`tests/node-smoke-schema-parity.mjs`) já
inclui as duas tabelas via `PG_ONLY_TABLES` (linhas 76-77) e GRDB não as espelha
— consistente com decisão "engineering tables são write-direct REST".

---

## 8. Cobertura de testes — verificado

Rodei nesta sessão (Node disponível, Swift indisponível neste sandbox):
- `node tests/node-smoke-timebase-swift-parity.mjs` → **12 ok / 0 fail**.
- `node tests/node-smoke-advisor-findings.mjs` → **9 ok / 0 fail**.
- `node tests/node-smoke-schema-parity.mjs` → **15 ok / 0 fail**.
- Swift smokes (TB / VCA / CE / ECM) não executados localmente (sem `swift`),
  mas CI macos-14 do PR #199 (HEAD `2ee12a3`) reporta verdes — registrado em
  `STATUS.md`.

Smokes totais MS-16: **70** (49 Swift + 21 Node), não 67 como STATUS.md indica.

---

## 9. Recomendações priorizadas — onde ganhar mais

| Prioridade | Item | Por quê é o melhor ROI |
|---|---|---|
| **P1** | Alimentar IAT no `VehicleContextAggregator` | Destrava narrativa "Vmin↓ × IAT↑" que CR3 já promete no texto, mas nunca entrega. Sem IAT, a recomendação da CR3 fica fraca — engenheiro não consegue distinguir pneu × térmica de admissão. ~80 LOC + 4 smokes. **Half-day, retorno alto.** |
| **P2** | `WaterTempDriftNoCoolingRule` checar carga | Evita falso positivo "investigar arrefecimento" em subida sustentada. Hoje a regra pode disparar e gerar ruído. ~20 LOC + 2 smokes. **Half-day.** |
| **P3** | `TelemetryTimebase.onTick(rateHz, callback)` em Swift | Destrava consumo pelo detector ao vivo iOS (precisa tick 10 Hz consolidado). Sem isso, MS-16.5b vai improvisar com Timer no Repository, mas o padrão JS ficou. ~60 LOC + 2 smokes. **Half-day.** |
| **P4** | Renomear `parsed` shadow em `advisor.js` | Code smell de leitura. 3 LOC. **15 min.** |
| **P5** | Smoke "snapshotAt em fonte sem amostra" (gap 3.1.b) | Documenta divergência semântica JS↔Swift propositalmente. 1 smoke TB + 1 TPB. **1 hora.** |
| **P6** | Smoke "cooling detection" no `VehicleContextAggregator` | Cobre branch da state machine térmica nunca exercitado. 1 smoke VCA. **1 hora.** |
| **P7** | Index GIN em `engineering_recommendations.finding_ids` | Só vale aplicar se aparecer query "recs por finding". Backlog. |
| **P8** | Refinamento D8 via `is_chefe_equipe()` no UPDATE da `decisao` | Bloqueia piloto/mecânico de aprovar a rejeitar via REST direto. Hoje confiamos em validação domain (`EngineeringDecisionPolicy`) — defesa em profundidade pediria também no SQL. ~30 LOC migration nova. **1 dia.** |

**Total de "P1+P2+P3" (1,5 dia de trabalho)** fecha as 3 dívidas reais do MS-16
antes de subir as Views em MS-16.5b. Faz sentido entrar como **MS-16.6**
(hardening da camada de domínio) — um único PR com os 3 itens + smokes.

---

## 10. Não-bloqueia, mas vale 1 linha de comentário no código

- `VehicleContextAggregator.swift:259-260` — comentário existente já explica
  IAT pendente. Manter até resolver gap P1.
- `WaterTempDriftNoCoolingRule.swift:9-11` — atualizar comentário do topo
  para refletir que filtro de carga **ainda não está implementado** (hoje
  promete e não cumpre).
- `advisor.js:175` — adicionar `// renomeio futuro: claudeResponse` ou
  simplesmente renomear na próxima edição do arquivo.

---

## 11. Decisões abertas (13) que tocam módulo de engenharia

Listadas em `docs/COMMAND_BOX_ENGENHARIA.md` §11. Nenhuma bloqueia MS-16.5b.
Defaults documentados. Recomendação: revisitar quando dor real aparecer (cada
uma vale fechar quando virar gargalo de UX, não antes).

---

## 12. Conclusão

MS-16 entregou o que prometeu na **forma**: 3 camadas bem separadas, ADR-008
respeitado, testes verdes, migrations versionadas, governança IA explícita
no system prompt. **Mas duas regras (CR3 sem IAT + CR2 sem filtro de carga)
têm dívida de fidelidade ao spec** que vai aparecer quando a Tab Engenharia
(MS-16.5b) começar a mostrar findings para o engenheiro e a evidência sair
"fraca" ou "ruidosa".

**Sugestão:** abrir mini-sprint **MS-16.6 — Hardening Camada 2** (1,5 dia, 1 PR)
com os itens P1+P2+P3 + smokes antes de partir pra MS-16.5b. Custa pouco e
fecha as 3 dívidas que conhecemos.

---

## Apêndice — comandos rodados nesta auditoria

```bash
node tests/node-smoke-advisor-findings.mjs          # 9 ok / 0 fail
node tests/node-smoke-timebase-swift-parity.mjs    # 12 ok / 0 fail
node tests/node-smoke-schema-parity.mjs            # 15 ok / 0 fail
```

Swift smokes (TB / VCA / CE / ECM) não executados — sem toolchain disponível
neste sandbox. CI macos-14 verde em todos os PRs MS-16 (#194..#199) é o
ground truth pra Swift.
