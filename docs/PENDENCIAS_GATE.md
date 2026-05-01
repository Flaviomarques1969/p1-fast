# PENDENCIAS_GATE — Pendências P1 Fast

Lista viva. Cada item é decisão de produto não tomada ou tomada mas não executada.

Convenção:
- **P0** — bloqueia próxima rodada lógica
- **P1** — alto valor, próximas semanas
- **P2** — valor real, sem urgência
- **P3** — registrar para não perder

Cada item carrega: origem · escopo · critério de feito · bloqueios.

Não duplicar com:
- [`BLOCKERS.md`](../BLOCKERS.md) — bloqueios de hardware ou ação humana
- `TECH_DEBT_TRACKER.md` (FAM Racing legado, não usado em P1 Fast)

---

## Ativas

### P0 — Seed Brasília com cadastro completo de apex

**Origem:** AUDITORIA_INICIAL §"Ajustes prioritários" item 5.

**O que falta:** popular `apexReference`, `apexStrategy`, `cornerType`, `nextStraightLength` para os 8 trechos de Brasília em [`src/domain/seed-tracks.js`](../src/domain/seed-tracks.js). Schema já aceita os campos.

**Por que P0:** sem isso, `error-classifier.classifyApex()` retorna `null`, `apexSacrificouSaida()` não dispara, detector emite `apex_actual` sem ter contra o quê comparar.

**Escopo:** pequeno (8 trechos × 4 campos).

**Critério de feito:**
- 8 trechos com `apexReference: { x, y }` no viewBox 823×799
- 8 trechos com `apexStrategy` ('antecipado' | 'neutro' | 'tardio' | 'duplo')
- 8 trechos com `cornerType` ('lenta' | 'media' | 'rapida')
- Trechos antes de retas longas (>200 m) com `nextStraightLength` populado
- `TrackSegments.hasFullApexCadastro()` retorna `true`

**Bloqueios:** Flavio precisa marcar visualmente o apex de cada curva.

---

### P0 — Hierarquia de alertas determinística cadastrada

**Origem:** AUDITORIA_INICIAL §"Riscos técnicos" item 1.

**O que falta:** `CriticalRules.swift` (Swift) e `data-quality.js`/módulo equivalente (JS) têm engine + 3 regras CRÍTICAS + 3 manuais. Falta catálogo completo com **limites calibrados** por canal de telemetria do Celta.

**Por que P0:** quando E2 (T4000) entrar live, alertas de motor precisam disparar imediatamente. Sem regras prontas, falha mecânica iminente pode passar silenciosa.

**Escopo:** médio. Cada regra: canal + limite + nível + cooldown. Testes obrigatórios.

**Critério de feito:**
- Catálogo cadastrado: pressão óleo baixa, temp motor extrema, temp freio extrema, λ pobre prolongado, bateria baixa, falha de canal, bandeira vermelha (manual), bandeira amarela (manual)
- Cada regra com nível + limite + cooldown + teste
- Regras NUNCA silenciadas por OverloadFilter

**Bloqueios:** limites calibrados com Flavio (janela de cada métrica do Celta).

---

### P1 — Captura real do barramento CAN da T4000 para validar dúvidas residuais

**Origem:** [`docs/hardware/T4000_CAN_SPEC.md`](hardware/T4000_CAN_SPEC.md) §Dúvidas residuais + [`BLOCKERS.md`](../BLOCKERS.md) §E2.

**Contexto:** spec oficial Injepro recebida. Restam 3 dúvidas residuais que só captura real responde.

**Por que P1:** destrava a implementação do parser T4000 (P2 abaixo). Sem as 3 resolvidas, parser nasce frágil.

**Escopo:** pequeno-médio (hardware). Adaptador CAN/USB + 30–60 s de tráfego em condições variadas.

**Critério de feito:**
- Log binário ≥ 30 s de CAN 0x7FB capturado
- Documentado se pacotes chegam em ordem determinística
- Documentado conteúdo dos bytes 2–6 do pacote 5
- Range observado de EGT em condições reais
- `T4000_CAN_SPEC.md` atualizado

**Bloqueios:** Flavio precisa de adaptador CAN/USB e acesso físico ao carro com T4000 ligada.

---

### P1 — CrossValidationEngine V-003 a V-011

**Origem:** `CROSS_VALIDATION_RULES.md` (FAM Racing) + `src/telemetry/cross-validation.js` (P1 Fast).

**Estado atual:** V-001 (CAN×GNSS) e V-002 (IMU×derivada speed) implementadas em JS e Swift.

**O que falta:** V-003 a V-011 (TPS×MAP×accel, RPM×marcha×velocidade, λ sob carga, pressão óleo×RPM, etc.).

**Por que P1:** sem isso, divergências de canais T4000 silenciam. Risco de alimentar análise/decisão com dado inconsistente.

**Escopo:** médio. Catálogo + cooldown + severidade por validação.

**Critério de feito:**
- Cada validação com fixture (caso normal, divergência, transitório, recovery)
- Eventos alimentam motor de alertas
- Cooldown configurável

**Bloqueios:** parcialmente depende de E2 (T4000) para canais de motor.

---

### ~~P1 — Port pipeline JS → Swift (Frente 3)~~ — CONCLUÍDO 2026-05-01

Todos os 6 módulos da Frente 3 portados em sequência: FaseCurva → PathMapper → TrajectoryMonitor → BaselineVectors → FuelCalc → P1Coach (com CoachPhrases). Smoke Swift sustenta 97/0 (33 → 97 nesta sessão), Node 81/0, harness funcional 23/0, harness API 26/0. Tabela de paridade atualizada em [`ios/p1fast-core/README.md`](../ios/p1fast-core/README.md).

---

### P1 — TelemetryReplayEngine

**Origem:** AUDITORIA_INICIAL_TELEMETRIA §"Lacuna 5".

**O que falta:** módulo que lê samples de uma sessão e re-alimenta o detector para reproduzir análises offline.

**Por que P1:** habilita teste de regressão e auditoria. Útil também pra rodar pipeline contra CSVs do `P1FastIMUTest` (já temos um arquivado em `docs/hardware/baselines/`).

**Escopo:** pequeno (loop simples) — pipeline já é determinístico.

**Critério de feito:**
- `src/telemetry/replay.js`
- Aceita `sessionId` ou caminho de CSV
- Produz mesma sequência de eventos do detector original

**Bloqueios:** nenhum.

---

### P2 — T4000 parser + reader + provider

**Origem:** [`docs/hardware/T4000_CAN_SPEC.md`](hardware/T4000_CAN_SPEC.md) + [`BLOCKERS.md`](../BLOCKERS.md) §E2.

**O que falta:** `T4000CanReader`, `T4000PacketParser`, `T4000Provider`.

**Escopo:** médio (3 módulos + fixtures).

**Critério de feito:**
- Parser passa fixtures: exemplo canônico do PDF (`0x91` checksum), checksum inválido, gap, fora de ordem, duplicado, valor fora de range, ciclo incompleto, recovery, bitfield Erro ECU != 0
- Integração via `TelemetryTimebase` produz snapshots com `engine.*` populado
- Regras críticas calibradas

**Bloqueios:** depende de P1 captura real (acima) para resolver 3 dúvidas residuais.

---

### P3 — `error-classifier.classifyApex()` usa distância euclidiana 2D

**Origem:** Decision Log 2026-04-24.

**O que falta:** substituir distância euclidiana 2D no viewBox por projeção tangencial (lateral × longitudinal real) quando `TrackSegment` tiver tangente cadastrada.

**Por que P3:** heurística atual funciona para curvas perpendiculares ao eixo do viewBox. Para curvas com orientação arbitrária, separação interno/externo fica fraca.

**Escopo:** pequeno quando o cadastro tiver tangente.

**Critério de feito:** `TrackSegment` ganha `apexTangent: { dx, dy }`; `classifyApex()` projeta `(apexActual − apexReference)` em tangente (longitudinal) e normal (lateral).

**Bloqueios:** depende de P0 apex completo + decisão Flavio (cadastra tangente ou deriva do path).

---

### P3 — TelemetryTestFixtures (cenários de erro)

**Origem:** AUDITORIA_INICIAL_TELEMETRIA §"Lacuna 8".

**O que falta:** gerador de cenários sintéticos: perda de pacote, fora de ordem, checksum inválido, valor fora de range, gap GNSS, drift IMU, latência alta, divergência cruzada.

**Por que P3:** habilita teste rigoroso de comportamento sob falha. `MockProvider` atual gera caso feliz só.

**Critério de feito:**
- `src/telemetry/test-fixtures.js`
- API para gerar cada cenário sob demanda
- Cobertura: cada categoria de `data-quality.js` representada por ≥ 1 fixture

**Bloqueios:** nenhum.

---

### P3 — Adaptação Detector / FaseCurva / Corredor para snapshot

**Origem:** AUDITORIA_INICIAL_TELEMETRIA §"Ajustes prioritários" item 9.

**O que falta:** módulos atuais consomem `Sample`. Migrar para consumir `CarTelemetrySnapshot` (estrutura já existe em `src/telemetry/snapshot.js` e em `Snapshot.swift`).

**Por que P3:** consumir snapshot dá acesso a dados fundidos (`speed_fused`) e qualidade categorizada.

**Critério de feito:**
- Detector lê de `position.local_x`, `position.local_y`, `vehicle.speed_fused`
- FaseCurva lê de `dynamics.accel_longitudinal`, `vehicle.speed_fused`
- Corredor lê de `position.local_x`, `position.local_y`
- Fixtures de regressão: mesma sessão produz análise equivalente

**Bloqueios:** nenhum.

---

### P3 — 25 módulos não-avaliados em profundidade

**Origem:** AUDITORIA_INICIAL §"Não avaliados por falta de contexto".

**Escopo:** distribuído. Cada módulo passa pelo gate na primeira vez que for editado.

**Lista:** `reference-view.js`, `vectors-view.js`, `tire-view.js`, `cockpit-state.js`, `audio-cue.js`, `fatigue-estimator.js`, `global-state-machine.js`, `stint-env.js`, `baseline-vectors.js`, `reference-line.js`, `tire-wear.js`, `fuel-calc.js`, `benchmark.js`, `score.js`, `repeatability.js`, `pedagogical-plan.js`, `planned-vs-executed.js`, `session-master.js`, `provider.js`, `device-provider.js`, `projector.js`, `path-mapper.js`, `sample-store.js`, `session-recorder.js`, `corredor.js`.

**Bloqueios:** nenhum.

---

## Concluídas (mantidas para histórico — limpeza 2026-05-01)

- **P0 — TelemetryTimebase** (Spec → Implementação) — feito em JS (`src/telemetry/timebase.js`). Pendente paridade Swift (não está na Frente 3 — vira frente futura quando precisar).
- **P0 — TelemetrySnapshotBuilder** — feito em JS (`src/telemetry/snapshot.js`) e Swift (`Snapshot.swift`).
- **P1 — Migração 4 → 11 categorias de qualidade** — feito em JS (`src/domain/data-quality.js` exporta as 11) e Swift (`Quality.swift`).
- **V-001 e V-002 da CrossValidation** — feitas (V-003 a V-011 viram item P1 acima).
- **Frente 3 — Port pipeline JS → Swift** — concluída 2026-05-01. 6 módulos portados em sequência: FaseCurva, PathMapper, TrajectoryMonitor, BaselineVectors, FuelCalc, P1Coach (+ CoachPhrases). Suite Swift: 97/0 (subiu 33 → 97 nesta sessão).

---

## Arquivadas — herdadas do FAM Racing, não aplicáveis a P1 Fast (limpeza 2026-05-01)

P1 Fast é projeto isolado do FAM Racing. Os itens abaixo vieram do gate original e não correspondem ao escopo atual:

- **P1 — Pré-evento como módulo bloqueante** — fluxo `Event` + 7 etapas era do FAM Racing. P1 Fast tem `_design-reference/` próprio (padrão B). Pode reaparecer com escopo P1 Fast.
- **P1 — Menu principal V2** — migração V1→V2 era do FAM Racing. P1 Fast tem hub com mockups B canônicos (`p1-fast-padrao-b.md`).
- **P1 — `/api/post-event` + relatório de evento** — endpoint FAM Racing, fluxo "Box AÇÕES". Sem prod até autorização (`feedback_dev_sem_prod.md`).
- **P2 — Migração V1 → V2 das telas administrativas** — telas FAM Racing (Box, V1 fluxo). Não aplicável.
- **P2 — `box-view.js` interpretação visível** — componente FAM Racing (Box). UI P1 Fast segue padrão B, não Box.
- **P2 — RaceBox reader + provider** — RaceBox arquivado em 2026-05-01 (ver `BLOCKERS.md` §E4 e `p1-fast-racebox-rebaixado-2026-05-01.md`).
- **P3 — Revisão periódica da auditoria** — auditoria FAM Racing (`AUDITORIA_INICIAL_DIRETOR_TECNICO.md`) não é referência viva do P1 Fast.
- **P3 — Operacionalização do gate em PR/commit** — depende de hooks `.claude/settings.local.json` que pertencem a configuração FAM Racing original.

Qualquer item acima pode ser re-aberto se virar escopo real P1 Fast — basta criar entrada nova em "Ativas" com justificativa P1 Fast.

---

## Como atualizar este arquivo

Toda nova pendência derivada de auditoria ou validação visual entra em "Ativas". Itens completados vão para "Concluídas" (não removidos). Itens de FAM Racing legado vão para "Arquivadas" com one-liner.
