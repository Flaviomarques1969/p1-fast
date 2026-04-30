# ARCHITECTURE DECISIONS

Cada ADR = uma decisão travada. Não se reabre sem upgrade formal.

---

## ADR-001 — Stack sem bundler
**Decisão**: ES Modules nativos, sem Vite/Webpack.
**Motivo**: simplicidade, zero build step, funciona direto no browser, debuggable.
**Trade-off**: sem tree-shaking. Aceitável no escopo pessoal.

## ADR-002 — Dexie como wrapper IndexedDB
**Decisão**: Dexie 4 via `vendor/dexie.min.js` local (não CDN em runtime).
**Motivo**: API ergonômica, offline garantido, schema versionado.
**Alternativas descartadas**: IndexedDB nativo (verboso), localStorage (insuficiente).

## ADR-003 — Source of truth local durante sessão
**Decisão**: IndexedDB no dispositivo mestre é canonical durante sessão ao vivo. Nuvem é backend pós-sync.
**Motivo**: rede na pista é instável. Não pode travar aquisição de telemetria.
**Consequência**: toda mutation passa por `syncQueue`. Drainer consome depois.

## ADR-004 — Telemetria append-only
**Decisão**: amostras de telemetria nunca são editáveis. Só corrigíveis via "metadados" separados (invalidação, anotação).
**Motivo**: integridade dos dados brutos. Auditoria confiável.

## ADR-005 — Unidade primária = trecho/curva (não volta)
**Decisão**: o domínio analítico é construído sobre SegmentExecution, não Lap.
**Motivo**: pedagogia precisa granularidade. Lap é agregação.

## ADR-006 — Pista em 2 camadas
**Decisão**: layout (linha de chegada + 3 setores macro) é camada 1; trechos/curvas com nomes editáveis é camada 2.
**Motivo**: setores são para timing/estatística; trechos são para análise pedagógica.

## ADR-007 — Device master único por sessão
**Decisão**: 1 device = 1 fonte de telemetria por sessão. Sem merge entre devices.
**Motivo**: merge é não determinístico e frágil. Fallback = trocar master manualmente.

## ADR-008 — IA NÃO em segurança crítica
**Decisão**: alertas críticos são determinísticos (regras fixas). IA só fala de desempenho/pedagogia.
**Motivo**: previsibilidade em situações de risco.

## ADR-009 — SyncQueue só acumula (sem drainer) até Fase 20
**Decisão**: toda mutation enfileira, mas nenhum worker drena a fila ainda. Drainer = Fase 20.
**Motivo**: preserva operação local-first; backend é feature posterior.

## ADR-014 — Telemetria append-only NÃO passa por syncQueue
**Decisão**: `telemetrySamples` é a única store local-first que NÃO enfileira cada row em `syncQueue`. Sincronização remota, quando existir, será por batch/arquivo consolidado — não por row.
**Motivo**: volume proibitivo (10Hz × 1h = 36 000 rows/sessão) tornaria `syncQueue` inviável tanto para escrita local quanto para o futuro drainer. Telemetria é reconstituível a partir de laps+segmentExecutions agregados (que SIM passam por `syncQueue`).
**Trade-off**: replay remoto fino de uma sessão exigirá drainer-de-batch específico no futuro (item registrado em TECH_DEBT_TRACKER). Até lá, o usuário principal é local-first puro.
**Resolve contradição ADR-004 × ADR-009**: ADR-004 garante imutabilidade de amostras; ADR-009 diz "toda mutação enfileira"; ADR-014 declara explicitamente que `telemetrySamples` é a EXCEÇÃO formal a ADR-009, mantendo ADR-004.
**Aplica-se a**: `src/telemetry/sample-store.js` e todas as futuras stores de telemetria de alta frequência (IMU, CAN bus, etc.).

## ADR-015 — Deltas de tempo usam relógio monotônico
**Decisão**: qualquer cálculo de duração (`tempoMs`, `tempoS1Ms`, segmentTempoMs) usa `sample.tMono` (`performance.now()`). `sample.t` (`Date.now()`) é preservado apenas como timestamp auditorial.
**Motivo**: sincronização NTP do dispositivo pode fazer `Date.now()` saltar para trás, gerando deltas negativos impossíveis. `performance.now()` é monotônico por contrato.
**Aplica-se a**: `src/telemetry/detector.js` (tempos de volta e setor), `src/telemetry/session-recorder.js`, qualquer derivada de duração.
**Consequência**: testes usando `Date.now()` mock precisam mockar também `performance.now()` pra simular deltas.

## ADR-016 — Toda interpolação em innerHTML passa por escape
**Decisão**: qualquer string de usuário injetada em `innerHTML` deve passar por `esc()` (`src/core/escape.js`) ou ser inserida via DOM API (`textContent`, `createElement`). Templates com `${variavel}` bruto são proibidos em views.
**Motivo**: box-view e dev-panel interpolavam campos editáveis (nome, motivoInvalidacao, notas) sem sanitização, permitindo XSS local (A-031, A-032, A-035).
**Consequência**: qualquer PR que introduza `innerHTML = \`...${x}...\`` sem `esc(x)` é rejeitado em review. Eventos de clique usam delegação por data-attribute, nunca `onclick="fn('${id}')"`.
**Exceções**: SVG paths pré-definidos (constantes do código), URLs internas fixas. Qualquer input vindo de IndexedDB/localStorage/forms passa por esc.

## ADR-017 — window.FAM restrito em produção
**Decisão**: `window.FAM` é dividido em `FAM_PUBLIC` (versão, status, screenshot — read-only) e `FAM_DEV` (API completa, inclusive mutativa). Em localhost ou `?dev=1`, expõe ambos. Em prod, só `FAM_PUBLIC`.
**Motivo**: XSS local pode chamar `window.FAM.Laps.invalidar(...)` ou `Sessions.destroy(...)`. Reduzir superfície limita blast radius.
**Consequência**: dev console perde conveniência em prod (aceitável — prod é piloto usando, não debug). Integrações futuras precisam feature-flag explícito.

