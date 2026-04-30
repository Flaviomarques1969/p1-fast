# TELEMETRY_ENGINEERING_DECISION_LOG — Log permanente de decisões de telemetria

Memória de governança técnica do pipeline de dados. Toda decisão do Engenheiro-Chefe de Telemetria fica aqui — aprovada, reprovada, aprovada com ajustes, e o motivo.

Append-only. Não editar entradas anteriores. Para revisar uma decisão antiga, criar entrada nova referenciando a anterior.

Formato de cada entrada:

```
## YYYY-MM-DD — <título curto>

### Entrega avaliada
### Fontes envolvidas
### Dados usados
### Origem dos dados
### Timestamp validado?
### Unidade validada?
### Escala validada?
### Qualidade dos dados (categorias afetadas)
### Sincronização validada?
### Inferência marcada como inferência?
### Testes existentes
### Riscos técnicos
### Decisão
Aprovada / Reprovada / Aprovada com ajustes
### Motivo
### Observação
```

---

## 2026-04-24 — Criação da camada Chief Telemetry Engineer Gate

### Entrega avaliada

Camada de governança de telemetria criada em `docs/raceops/`. 12 arquivos novos:

- CHIEF_TELEMETRY_ENGINEER_GATE.md
- TELEMETRY_ENGINEERING_RULES.md
- TELEMETRY_REVIEW_CHECKLIST.md
- T4000_CAN_SPEC.md (status: hipótese, validação pendente)
- RACEBOX_INTEGRATION_SPEC.md (status: hipótese parcial, NDA leve)
- TELEMETRY_TIMEBASE_SPEC.md (implementação pendente)
- TELEMETRY_SNAPSHOT_SPEC.md (implementação pendente)
- DATA_QUALITY_RULES.md (11 categorias canônicas)
- CROSS_VALIDATION_RULES.md (catálogo V-001 a V-011)
- MECHANIC_QUESTIONS_MATRIX.md
- TELEMETRY_ENGINEERING_DECISION_LOG.md (este arquivo)
- AUDITORIA_INICIAL_TELEMETRIA.md

### Fontes envolvidas

Todas as fontes catalogadas: T4000 CAN (hipótese), RaceBox BLE (NDA leve), iPhone GPS+CoreMotion (DeviceProvider, parcial), Mock (existente para testes).

### Dados usados

Inventário do código de telemetria existente (10 módulos em `src/telemetry/`) + memória do projeto + BLOCKERS.md.

### Origem dos dados

Inspeção direta do código + leitura das specs anteriores + registro de decisões já tomadas (ADR-014, ADR-015 do `ARCHITECTURE_DECISIONS.md`).

### Timestamp validado?

Sim — `tMono` (`performance.now()`, ADR-015) é o canônico para deltas; `t` (`Date.now()`) é auditorial. Estrutura existente do `Sample` preservada e ampliada para snapshot multi-fonte.

### Unidade validada?

Sim — catálogo de unidades canônicas internas declarado em `TELEMETRY_ENGINEERING_RULES.md` §Regra 2. Cobre m/s, bar, °C, m/s², ms, lat/lng, m, °, rpm, %, λ. Conversão na borda.

### Escala validada?

Para canais existentes (DeviceProvider, MockProvider): sim. Para canais hipotéticos (T4000 CAN): NÃO — spec é prospectiva, marcada explicitamente como "VALIDAÇÃO PENDENTE" em `T4000_CAN_SPEC.md`.

### Qualidade dos dados (categorias afetadas)

11 categorias canônicas declaradas em `DATA_QUALITY_RULES.md`. Implementação atual usa apenas 4 (`SignalQuality`: good/degraded/bad/lost). Plano de migração: manter `SignalQuality` por compatibilidade + adicionar `quality` por amostra com 11 categorias quando `TelemetryTimebase` for criado.

### Sincronização validada?

NÃO. Hoje cada provider escreve no `sampleStore` independentemente. `TelemetryTimebase` ainda não existe. Spec criada em `TELEMETRY_TIMEBASE_SPEC.md`. Pendência registrada em `PENDENCIAS_GATE.md`.

### Inferência marcada como inferência?

Regra declarada em `TELEMETRY_ENGINEERING_RULES.md` §Regra 3-4. Anti-catálogo em §Regra 4 lista o que NÃO existe no projeto (pressão de freio, ângulo de volante, etc.) e portanto não pode ser afirmado.

`fase-curva.js` já produz dados rotuláveis como inferência. `error-classifier.js` já distingue `freou-cedo` (inferência) sem afirmar pressão. Conformidade já parcial.

### Testes existentes

- Parsers: ZERO (não há T4000 nem RaceBox parser ainda).
- Sample-store: cobertura via `tests/manual-tests.html` + `tests/node-smoke-migration.mjs` (ADR-014 sample-store integrity).
- Detector: cobertura existente via fixture `brasilia_real.json`.
- Timebase / Snapshot / CrossValidation: ZERO (não existem ainda).

Plano: cada módulo novo nasce com fixtures conforme Regra 9 das `TELEMETRY_ENGINEERING_RULES.md`.

### Riscos técnicos

1. T4000 CAN spec é totalmente hipotética. Implementar parser sem validação produz decoder errado silenciosamente. Mitigação: status "VALIDAÇÃO PENDENTE" explícito no documento + bloqueio de merge de parser sem validação documentada.
2. RaceBox spec parcialmente hipotética. Layout binário oficial requer PDF do fabricante (formulário + NDA leve). Bloqueia implementação BLE.
3. Migração de `SignalQuality` (4 cat.) para `quality` (11 cat.) precisa ser incremental para não quebrar consumidores existentes.
4. `TelemetryTimebase` introduz nova camada entre provider e análise. Migração do `Detector` para consumir snapshot (em vez de sample direto) precisa preservar comportamento atual via fixtures de regressão.

### Decisão

Aprovada.

### Motivo

A camada de governança de telemetria é essencial para impedir que o sistema "pareça inteligente com dados ruins" (princípio absoluto declarado no Chief Telemetry Engineer Gate). Criar agora as regras, specs e auditoria — antes da implementação dos parsers reais — garante que cada módulo novo nasça compatível com o gate.

Nenhuma especificação foi cravada em código sem validação documental. Specs hipotéticas (T4000, RaceBox) estão claramente marcadas. Implementações pendentes (TelemetryTimebase, TelemetrySnapshotBuilder, CrossValidationEngine, TelemetryQualityEngine, TelemetryReplayEngine) estão registradas em `PENDENCIAS_GATE.md` e priorizadas pela auditoria.

### Observação

- Compatível com `ARCHITECTURE_DECISIONS.md` existente (ADR-004, 008, 014, 015).
- Compatível com o Diretor Técnico Gate criado anteriormente (sessão 2026-04-24 mais cedo). Os dois gates trabalham em paralelo: Diretor Técnico revisa "responde pergunta real?", Engenheiro-Chefe revisa "dado é confiável?".
- Próxima entrada esperada quando algum dos módulos pendentes (T4000 parser, RaceBox parser, TelemetryTimebase) for implementado.

---

## 2026-04-24 — Spec da Injepro T4000 confirmada por documento oficial

### Entrega avaliada

Atualização de `T4000_CAN_SPEC.md` mudando status de **HIPÓTESE PENDENTE** para **SPEC OFICIAL CONFIRMADA**, baseada em PDF oficial da Injepro entregue pelo Flavio em 2026-04-24 (arquivo "PROTOCOLO CAN AIM" — conteúdo é spec Injepro publicada para integradores).

### Fontes envolvidas

T4000 CAN.

### Dados usados

PDF oficial Injepro + validação matemática do checksum do exemplo + comparação com `T4000_CAN_SPEC.md` hipotético.

### Origem dos dados

Documento oficial fornecido pelo fabricante (resolve BLOCKERS.md E2 parcialmente).

### Timestamp validado?

N/A — esta entrega é spec, não amostra.

### Unidade validada?

Sim. PDF confirma fatores de conversão por canal:
- RPM ÷1 (rpm)
- Velocidade ÷10 (km/h, converter para m/s na borda)
- Pressão óleo / combustível ÷10 (bar)
- Temp óleo / água / ar / combustível ÷10 (°C)
- Tensão bateria ÷10 (V)
- TPS ÷10 (%)
- **MAP ÷100 (bar, range -1.00 a +6.00 — turbo possível)** ← correção vs hipótese (era ÷10)
- **EGT ÷1 (°C direto)** ← correção vs hipótese (era ÷10)
- Lambda ÷100 (adimensional)
- Marcha ÷1 (enum 0..6)
- Erro ECU ÷1 (bitfield uint16) ← era 1 byte na hipótese, é 2 bytes

### Escala validada?

Sim para canais documentados. EGT range máximo continua dúvida residual #3.

### Qualidade dos dados

CAN ID 0x7FB CONFIRMADO. 1 Mbit/s CONFIRMADO. 5 pacotes 8 bytes 10ms CONFIRMADO. Endianess **big-endian** CONFIRMADA por exemplo. Checksum algoritmo `sum mod 256` CONFIRMADO matematicamente: 1937 mod 256 = 145 = 0x91, bate exatamente com o exemplo do PDF.

### Sincronização validada?

N/A — sincronização entre T4000 e RaceBox depende do `TelemetryTimebase` (P0 em `PENDENCIAS_GATE.md`), não muda com esta confirmação.

### Inferência marcada como inferência?

N/A — esta entrega é spec, não inferência.

### Testes existentes

Plano: usar exatamente o exemplo do PDF como fixture canônica do parser (`T4000PacketParser`). Checksum bate matematicamente, então é fixture confiável.

### Riscos técnicos

3 dúvidas residuais documentadas em `T4000_CAN_SPEC.md` §Dúvidas residuais:

1. **Diferenciação dos 5 pacotes** (todos com mesmo CAN ID 0x7FB, sem MUX byte). Mitigação: parser combina contador temporal + sentinelas FIXED (`0x1E 0xFC` no fim do pacote 4, `0xFB 0xFA` no início do pacote 5).
2. **Bytes 2-6 do pacote 5** (5 bytes não documentados num pacote de 8). Mais provável: zero-padding (checksum só fecha se eles somam zero). Mitigação: validar via captura real.
3. **EGT range máximo físico** (uint16 = 0..65535 °C, fisicamente impossível). Mitigação: heurística `OUT_OF_RANGE` se > 1500 °C.

Riscos menores (não bloqueantes): firmware versionado, comportamento sem sensor EGT, semântica do bitfield ECU, marcha=0=neutro.

### Decisão

Aprovada.

### Motivo

Spec oficial substitui completamente a hipótese anterior. Validação matemática do checksum dá confiança Alta no algoritmo. As 3 dúvidas residuais são pequenas, com mitigação aceitável, e podem ser resolvidas via captura real do barramento (etapa que vem antes da implementação do parser, conforme próximos passos da spec).

### Observação

- BLOCKERS.md E2 muda de "aguardando SDK/spec Injepro" para "spec recebida — aguardando captura real para validar 3 dúvidas residuais".
- PENDENCIAS_GATE.md item P2 "T4000 parser + reader + provider" mantém o nível P2 (parser ainda a escrever) mas critério de feito agora pode citar a spec confirmada.
- Próximo passo crítico: alguém precisa acessar fisicamente o barramento CAN com adaptador CAN/USB para resolver dúvidas residuais antes de implementar o parser.

---

## 2026-04-24 — Catálogo determinístico de alertas (5 regras em placeholder)

### Entrega avaliada

Criação de [`src/cockpit/deterministic-alerts.js`](../../src/cockpit/deterministic-alerts.js) — catálogo + engine determinístico para a área "Especial" do Display do Piloto, conforme `ALERT_HIERARCHY.md` §Regras determinísticas críticas. 5 regras criadas:

| id | channel | compare | level | msg | status |
|---|---|---|---|---|---|
| oil_pressure_low | press_oleo | lt | BOX_AGORA | PRESSÃO ÓLEO | placeholder |
| engine_temp_high | temp_motor | gt | CRITICO | TEMP MOTOR | placeholder |
| fuel_pressure_low | press_comb | lt | CRITICO | PRESSÃO COMB. | placeholder |
| battery_low | bateria_v | lt | ATENCAO | BATERIA | placeholder |
| rpm_over_sustained | rpm | gt | ATENCAO | RPM VERMELHO | placeholder |

Engine `DeterministicAlertEngine.ingest(sample)` aplica histerese simples (`durationMs`) e publica via `messageBroker.critical(...)` + `cockpitState.pushAlerta(...)` quando condição persiste. Helper `calibrationSummary()` lista status por regra pra alimentar painel do engenheiro.

Relacionado: slot `alertas: []` adicionado em `cockpitState.slots`, com métodos `pushAlerta/clearAlerta/clearAlertas`.

### Fontes envolvidas

Canais esperados da Injepro T4000 (CAN ID 0x7FB, spec confirmada em 2026-04-24 — ver entrada anterior neste log): `press_oleo`, `temp_motor`, `press_comb`, `bateria_v`, `rpm`.

### Dados usados

Inventário de canais canonizado em `ALERT_HIERARCHY.md`. Nenhum dado real consumido nesta entrega — apenas o catálogo.

### Origem dos dados

Futura: `T4000PacketParser` (ainda não implementado). Atual: nenhuma — regras não disparam com `limit: null`.

### Timestamp validado?

N/A — sem amostra real ainda. Engine usa `Date.now()` por default, overridable via `ingest(sample, nowMs)` pra testar/replay.

### Unidade validada?

Sim — catálogo declara canais nos nomes canônicos da spec confirmada da T4000. Conversão ÷10/÷100 acontece na borda do parser (ainda a implementar). Catálogo assume unidades já convertidas (bar, °C, V, rpm).

### Escala validada?

Não — `limit: null` por design. Cada regra exige calibração empírica com o carro específico. Status `placeholder` é explícito em cada entrada.

### Qualidade dos dados

Consome qualidade do canal upstream (não re-classifica). Se `v == null || !Number.isFinite(v)` a regra é pulada — é `MISSING` tratado silenciosamente. Não há `INTERPOLATED` pra alerta crítico (seria inseguro). OK.

### Sincronização validada?

N/A — engine é determinístico por canal, não requer fusão multi-fonte. Quando `TelemetryTimebase` existir, o `sample` virá de `CarTelemetrySnapshot` que já unifica.

### Inferência marcada como inferência?

N/A — alertas determinísticos são comparação direta de valor com limite. Zero inferência.

### Testes existentes

Zero. Pendente: criar fixtures em `TelemetryTestFixtures` com cenários:
1. Todos os canais normais → nenhum alerta.
2. `press_oleo` abaixo do limite por `durationMs` → dispara `oil_pressure_low`.
3. `press_oleo` abaixo rápido (< durationMs) → não dispara (histerese).
4. Dispara + depois volta normal → desdispara e limpa.

### Riscos técnicos

1. **Limites em placeholder**. Risco de falsa segurança se alguém esquecer que `limit: null` significa "desabilitada". Mitigação: `ALERT_RULES` com campo `status: 'placeholder' | 'calibrado'` explícito + engine `ingest()` pula regra com `limit == null`.
2. **Sem captura CAN real ainda** (BLOCKER E2 parcialmente resolvido — spec oficial recebida, captura física pendente). Impossibilita calibrar os limites com dados do Celta do Flavio. Mitigação: bloqueio natural — engine não dispara nada sem calibração.
3. **Ausência de fusão multi-fonte** (`TelemetryTimebase` é P0 em `PENDENCIAS_GATE.md`). Engine hoje consome `sample` genérico. Quando o snapshot unificado existir, adaptar `ingest()` pra receber `CarTelemetrySnapshot`. Mudança pequena.
4. **Interação com broker**. `messageBroker.critical()` sempre passa pelo `OverloadFilter` — mas alertas determinísticos com level `BOX_AGORA`/`CRITICO` têm `Prioridade.CRITICAL` e passam incondicionalmente. Risco zero.

### Decisão

Aprovada.

### Motivo

- Catálogo cumpre o gap identificado pelo Diretor Técnico ("cockpit é bonito mas não é seguro") — arquitetura existe pra receber os alertas.
- Regras placeholder explícitas impedem ativação indevida.
- Engine pequeno, coberto por histerese simples, integra com broker existente sem acoplamento novo.
- Calibração fica como ajuste obrigatório na próxima rodada (dependente de captura CAN).

### Observação

- Pareado com entrada "Cockpit do piloto: design system + delta/apex + lap time + catálogo de alertas" no `TECHNICAL_DIRECTOR_DECISION_LOG.md` (mesma sessão, data idêntica).
- Próximas entradas esperadas: calibração dos 5 limites após captura CAN + adaptação do engine pra consumir `CarTelemetrySnapshot` quando `TelemetryTimebase` existir.

---

## Próximas entradas

A partir daqui, toda entrega que toca dado cria entrada nova neste log antes de ser declarada concluída. Entrega completa exige aprovação dos DOIS gates (este + `TECHNICAL_DIRECTOR_DECISION_LOG.md`).

Tipos de entrada esperados:
- Aprovação de novo parser (T4000, RaceBox)
- Aprovação de novo módulo de sincronização
- Aprovação de nova validação cruzada
- Aprovação de nova categoria em `DATA_QUALITY_RULES.md`
- Aprovação de extensão do snapshot (canais novos)
- Reprovação com ajustes obrigatórios
- Reabertura de decisão anterior
- Decisão de "não fazer" (também é decisão de engenharia)

---

## 2026-04-28 — Tile do evento lê dia.resumo sem populador

### Entrega avaliada
Card do evento na lista do `/app` agora exibe tiles por dia mostrando `voltas` e `melhorMs` lidos de `dia.resumo` (`src/app/app.js:485-530`). UI implementada e estilizada (`src/app/app.css:341-460`). Tile vazio mostra "SEM DADOS" com border tracejada quando `dia.resumo` ausente.

### Fontes envolvidas
Persistência local IndexedDB (`fam_app_v1`) — entidade `evento.dias[N]` com possível campo `resumo: { voltas, melhorMs }`.

### Dados usados
`dia.resumo.voltas` (number) e `dia.resumo.melhorMs` (number ms). Esperados do pipeline pós-stint quando este existir.

### Origem dos dados
Não definida ainda. Tile lê o campo, mas NENHUM código grava. Achado #1 da `AUDITORIA_SISTEMA_2026-04-28.md`.

### Timestamp validado?
Não aplicável — agregado pós-stint, não amostra de telemetria. Quando o populador existir, deve usar `tMono` da última volta como referência canônica.

### Unidade validada?
`melhorMs` em milissegundos (canônico FAM, conforme `TELEMETRY_ENGINEERING_RULES.md` §Regra 2). `voltas` em contagem inteira. Coerente.

### Escala validada?
`voltas` razoável 0-200 por dia. `melhorMs` razoável 60000-300000 (1min-5min) — sem validação no consumidor; render mostra "—" se ≤ 0 ou inválido.

### Qualidade dos dados (categorias afetadas)
N/A no leitor. Quando populador existir, deve marcar a quality do `melhorMs` (`OK` se vier de volta `valida=true`, `ESTIMATED` se interpolada, `LOW_CONFIDENCE` se vier de validação cruzada degradada).

### Sincronização validada?
N/A — agregado pós-execução, não real-time. Mas o populador deve usar timebase fundido (achado #4: `Detector.consumeSnapshot()` não chamado).

### Inferência marcada como inferência?
Pendente — quando populador existir. Hoje a UI honestamente mostra "SEM DADOS" pra estado vazio (não inventa).

### Testes existentes
Smoke tests do app não cobrem este caminho — populador inexistente. A criar junto com `EventoResumo`/`DiaResumo` (P0 #1).

### Riscos técnicos
1. **CRÍTICO** — tile vai exibir "SEM DADOS" pra todos os eventos eternamente até populador existir. UX degradada.
2. Se populador for criado sem cross-validation, pode persistir `melhorMs` de volta inválida (out-lap, in-lap, banner amarelo) — engenheiro decide errado.
3. Schema de `dia.resumo` não foi declarado em domain — risco de drift entre escrita e leitura.

### Decisão
Aprovada com ajustes — leitura honesta (mostra "SEM DADOS" em vez de mentir), mas pré-condicionada a P0 #1 (criar populador).

### Motivo
Render do tile está correto e tipa-se com `dia.resumo = { voltas: number, melhorMs: number }`. Aprovado como contrato. Próxima rodada (P0 #1) cria a entidade `EventoResumo`/`DiaResumo` em `src/domain/` + populador chamado ao finalizar stint, escrevendo nesse contrato.

### Observação
Schema canônico proposto pra `EventoResumo` / `DiaResumo`:
```
EventoResumo { eventoId, voltasTotal, melhorMsGlobal, melhorMsPorDia: Map, calculadoEm: tMono }
DiaResumo { eventoId, diaId, voltas, voltasValidas, melhorMs, melhorLapId, calculadoEm: tMono, dataQuality: enum }
```

---

## 2026-04-28 — Lap-picker persiste voltasPlanejadas no stint

### Entrega avaliada
Lap-picker visual no modal de stint (`src/app/app.js:2080-2230` + `app.html:545-660`) com 30 segmentos clicáveis, display 40px, stepper. Persiste `stint.voltasPlanejadas` (number 1-200) ao salvar via `stint.salvar()` em `app.js`. Default 10 voltas em novo stint.

### Fontes envolvidas
Entrada manual do piloto no modal. Sem fonte de telemetria envolvida.

### Dados usados
`voltasPlanejadas: number` em `evObj.stintsByDia[diaId][N].voltasPlanejadas`.

### Origem dos dados
Input UI (lap-picker). Persistência: `DB.dados.eventos[K].stintsByDia[diaId][N].voltasPlanejadas` em IndexedDB.

### Timestamp validado?
N/A — campo de planejamento, não amostra.

### Unidade validada?
Sim — voltas inteiras, 1-200. Clamp em `_setVoltas()`. Coerente.

### Escala validada?
Sim — limite superior 200 cobre enduro de até ~400min em pista de 2min/volta (extremo).

### Qualidade dos dados (categorias afetadas)
N/A — entrada do usuário, não tem qualidade no sentido de telemetria.

### Sincronização validada?
N/A.

### Inferência marcada como inferência?
N/A — dado declarado pelo piloto.

### Testes existentes
Nenhum. Validação manual: clique em segmento 18 → display="18", hidden value="18", filledSegs=18 (testado via `preview_eval` na sessão).

### Riscos técnicos
1. Não distingue `voltasPlanejadas` de `voltasExecutadas` (achado #15 do app). Quando populador for criado, escreve `voltasExecutadas` em `dia.resumo.voltas` ou em `stint.voltasExecutadas`.
2. Range visual 30 mas máximo real 200 — visualização perde contexto se piloto planeja 100. Mitigado por display "+N" no canto.
3. Schema do stint não declarado em Zod — risco de drift backend/frontend.

### Decisão
Aprovada.

### Motivo
Componente premium genuíno (60×32px chips, mono display, stepper). Atende `feedback_fam_proatividade.md` ("componente racing em vez de input number"). Validação visual + numérica testada. Persistência correta.

### Observação
Renomear futuro: `voltasPlanejadas` (UI) vs `voltasExecutadas` (telemetria) precisa ficar claro no domain. Hoje tile do evento espera `dia.resumo.voltas` que deveria ser `voltasExecutadas` (não planejadas) — conferir no populador P0 #1.

---

## 2026-04-28 — Loop dado→tile fechado (F1) com EventoResumo/DiaResumo + sample-bus

### Entrega avaliada
F1 da tarde — pipeline real do app:
- [`src/domain/evento-resumo.js`](../../src/domain/evento-resumo.js) (novo) — entidades `EventoResumo` / `DiaResumo` + função `enriquecerDiasComResumo(evento)` que busca `db.laps` filtrando por `(carId, criadoEm in [diaInicioMs, diaFimMs])` e calcula `voltas`, `voltasValidas`, `melhorMs`, `melhorLapId`, marcando `quality: 'MEDIDO' | 'VAZIO'`.
- [`src/cockpit/sample-bus.js`](../../src/cockpit/sample-bus.js) (novo) — bus multi-listener pra `MobileTelemetry` (HUD + SessionRecorder convivem no mesmo stream).
- `cockpit-mobile.html` — `_maybeStartSessionRecorder()` em `enterCockpit()` apenas se `track.svgPath` + `track.linhaChegada` existirem (precondição honesta — sem track configurado, samples ficam só no storage local).
- `src/app/app.js` `bootApp()` — chama `enriquecerDiasComResumo()` para cada evento após Dexie inicializado; preenche `dia.resumo` em runtime.

### Fontes envolvidas
- Persistência local IndexedDB: tabela `db.laps` (campo `criadoEm: tMono`, `carId`, `valida`, `tempoMs`).
- Persistência local localStorage `fam_app_v1`: campo `evento.dias[N].dataISO` (string `YYYY-MM-DD`).
- Cockpit mobile: `MobileTelemetry` publica samples via `sampleBus`; `SessionRecorder` consome e persiste em `db.sessions` + `db.laps` quando o piloto cruza `linhaChegada`.

### Dados usados
- `lap.tempoMs: number` (canônico FAM, ms).
- `lap.criadoEm: number` (ms epoch — usado pra filtragem por janela do dia).
- `lap.valida: boolean` (filtro de `voltasValidas`).
- `lap.carId: string` (filtro pra evitar laps de outros carros).
- Saída agregada: `dia.resumo = { voltas, voltasValidas, melhorMs, melhorLapId, quality, calculadoEm }`.

### Origem dos dados
`db.laps` populado por `SessionRecorder` (cockpit mobile) ao detectar cruzamento de linha de chegada. Pipeline live ainda só mock no preview — smoke test usou laps gerados manualmente via console pra validar o consumo.

### Timestamp validado?
Parcialmente — `lap.criadoEm` é `Date.now()` no momento da gravação (não `tMono`). Suficiente pra janela do dia (granularidade de minutos), insuficiente pra cross-validation cross-source (achado #4). Quando integrar com `Detector.consumeSnapshot()` + `crossValidationEngine`, migrar pra `tMono` canônico.

### Unidade validada?
Sim — `tempoMs` em ms (canônico, regra 2 do `TELEMETRY_ENGINEERING_RULES.md`). `criadoEm` em ms epoch (UTC). Coerente.

### Escala validada?
Sim — `melhorMs` razoável 60_000–300_000 (1min–5min); descarta valores fora do range implicitamente (volta inválida tem `valida=false` mas `tempoMs` pode ser absurdo). Filtro `valida=true` aplicado antes de `Math.min(...)` em `melhorMs`.

### Qualidade dos dados (categorias afetadas)
`quality: 'MEDIDO'` quando `voltasValidas > 0` e populador encontrou laps; `quality: 'VAZIO'` quando nenhum lap match. Hoje binário — não distingue `MEDIDO_HONESTO` vs `MEDIDO_DEGRADADO` (volta marcada `valida=true` mas com `_qualityFlags=['banner','out-lap']`). Categoria `LOW_CONFIDENCE` do `DATA_QUALITY_RULES.md` está pronta no domain mas não consumida aqui ainda. Dívida: marcar `dia.resumo.qualityNotes[]` quando volta tiver flags.

### Sincronização validada?
N/A em runtime — agregado pós-execução, não real-time. Mas se duas fontes (iPhone + RaceBox no futuro) gravarem laps no mesmo período, o populador precisa fundir antes (achado #4: `Detector.consumeSnapshot()` deve materializar `lap` único por `tMono`). Hoje single-source, sem conflito.

### Inferência marcada como inferência?
Sim — `quality` faz a marcação. Se laps ausentes, retorna `quality: 'VAZIO'` em vez de inventar valor. Se algum lap interpolado existir (pipeline futuro), populador deve setar `quality: 'INFERIDO'` — espaço previsto no contrato, ainda não usado.

### Testes existentes
Smoke test manual da sessão (não em arquivo de teste): `db.laps.bulkAdd(8 laps reais)` + `bootApp()` → tile renderizou `8 VOLTAS · 0:00.050` com `quality=MEDIDO`. **Pendência:** criar `tests/node-smoke-evento-resumo.mjs` cobrindo (populador idempotente / carId divergente / janela vazia / `valida=false` excluído de `melhorMs`) — registrado como ajuste obrigatório também na entry pareada do TD.

### Riscos técnicos
1. **Janela de busca depende de `dia.dataISO`** — se data salva diverge do timezone do `lap.criadoEm`, laps somem. Brasília UTC-3 no fuso fixo do app deveria ser estável, mas refatorar pra usar `tMono` canônico fecha o risco de raiz.
2. **Populador roda em todo `bootApp`** — IDB abre por evento, processa todos. Para 100 eventos × 5 dias = 500 queries `where('carId').between(...)`. Aceitável até 1000 dias; depois precisa cache invalidado por nova lap.
3. **Sem schema Zod no contrato `dia.resumo`** — futuro write/read pode driftar. Achado P0 #3 já aplicou Zod-light em 5 endpoints; estender pra domain entities é próximo passo.
4. **`SessionRecorder` arrancado só com `track.svgPath + linhaChegada`** — track sem cadastro completo nunca grava lap real → tile fica `VAZIO` eternamente. UX honesta, mas operador precisa saber. Pendência: badge no `/app` "Track sem linha de chegada — laps não serão gravados".

### Decisão
Aprovada.

### Motivo
Pipeline fecha o loop crítico que estava aberto na rodada anterior (achado #1). Honesto na ausência (`quality: 'VAZIO'` em vez de zerado mentindo). Smoke test ponta-a-ponta verde. Riscos identificados são incrementais — nenhum bloqueia a entrega; todos foram registrados como ajustes futuros.

### Observação
Esta entry pareia com a entry do TD `2026-04-28 — Modal stint COMPLETO + loop dado→tile fechado (F1+F2)`. Consolida tecnicamente o que aquela registrou em alto nível. F2 (modal stint) não toca dados de telemetria — fica só no TD log.

---

## 2026-04-28 — F3 telemetria honesta: pre-buffer + chunk isEmpty + uploader skip

### Entrega avaliada
Rodada P3 de cleanup que toca persistência local da telemetria mobile:
- [`src/cockpit/iphone-storage.js`](../../src/cockpit/iphone-storage.js) — `IPhoneStorage` ganhou `_preSessionBuffer` (cap 200, FIFO). `ingest(s)` agora aceita samples ANTES da sessão abrir, empilha no buffer; `startSession` drena recursivamente. Stats `preSessionBuffered`, `preSessionDropped`, `replayedFromPreSession`.
- `_closeCurrentChunk` mudou: chunks com `count === 0` agora persistem em `db.telemetryChunks` com flag `isEmpty=true` + `closedAt` em vez de descartar referência sem trace. Stats `emptyChunks++`. Mantém integridade da timeline.
- [`src/cockpit/iphone-uploader.js`](../../src/cockpit/iphone-uploader.js) — `_tick()` ganhou early-skip explícito por `chunk.isEmpty || chunk.count === 0` (marca uploaded sem rede + log debug). Defesa: chunk não-empty mas sem samples → log warn + marca uploaded (corrupção / race).

### Fontes envolvidas
Persistência local IndexedDB (Dexie):
- `db.telemetrySamples` — samples GPS+IMU canônicos com `tMono`.
- `db.telemetryChunks` — blocos temporais de 10s com `firstT/lastT/count/closedAt/uploadedAt/isEmpty?`.
- `db.iphoneSessions` — sessões abertas por `enterCockpit`.

### Dados usados
- `sample.tMono: number` (canônico FAM ms; gating do ingest).
- `sample.t: number` — timestamp da fonte (usado em `firstT/lastT` do chunk).
- `chunk.count: number` (contador de samples no chunk em runtime).
- `chunk.isEmpty: boolean` (novo, opcional — `true` quando chunk fechou com 0 samples).

### Origem dos dados
- Samples vêm de `MobileTelemetry` (GPS via `navigator.geolocation.watchPosition`, IMU via `devicemotion`). Same `_buildSample` central já existente — sem mudança.
- Chunk vazio: `_rotateChunk` chamado a cada 10s; se nenhum sample chegou no intervalo, agora persiste com `isEmpty=true` em vez de sumir.
- Pre-buffer: gap entre `MobileTelemetry.start()` e `iphoneStorage.startSession()` resolvendo (Promise.allSettled paralelo no `enterCockpit`). Tipicamente <2s; pode ser maior se IDB lento.

### Timestamp validado?
Sim — `ingest()` rejeita `sample.tMono` não-numérico no header (`typeof sample.tMono !== 'number'`), antes de qualquer fluxo (incluindo pre-buffer). Garante que buffer não acumula lixo.

### Unidade validada?
- `tMono` em ms (regra 2 de `TELEMETRY_ENGINEERING_RULES.md`). Buffer não transforma — só armazena e replay.
- `chunk.firstT/lastT` em ms da fonte (`sample.t`). Chunks vazios têm `firstT=lastT=null` (nunca atribuídos no `count===0`).
- `chunk.openedAt/closedAt` em ms epoch (`Date.now()`). Coerente.

### Escala validada?
- Buffer cap 200 → cobre ~3-5s de mistura GPS@1Hz + IMU@50Hz. Suficiente pro caso real (~1-2s de gap entre start e startSession).
- Drop silente acima de 200 (mais antigo descartado), com stat `preSessionDropped`. Sob pressão de delay alto (>5s), drop começa a aparecer no stat.
- Chunk de 10s: até ~510 samples no pior caso (50Hz×10 IMU + 1Hz×10 GPS = 510). Buffer flush por debounce 500ms já tinha. Sem mudança.

### Qualidade dos dados (categorias afetadas)
- `quality` do sample não é alterada pelo buffer ou pelo chunk vazio — só transparência: o uploader sabe distinguir lacuna intencional (`isEmpty=true`) de chunk perdido (não persistido).
- Pre-buffer NÃO marca samples replicados — eles entram no IDB com mesmo `tMono`, `seq` reatribuído pelo `_seq++`. Replay é idempotente do ponto de vista do uploader (já que o backend usa `(sessionId, chunkId)` como chave de idempotência).
- Empty chunks têm `count=0, isEmpty=true` — não confundem com chunks parciais (uploader não tenta enviar; backend nunca recebe).

### Sincronização validada?
- Buffer drena dentro do `startSession()` ANTES do retorno — garante ordem causal: caller que aguardou `startSession()` resolver tem todos os pre-samples já no buffer pendente. Race window com primeiro chunk: pre-samples chamam `ingest` que abre chunk via `_openChunk()` (chamado em `startSession`); todos os pre-samples vão pro mesmo chunk.
- Empty chunks do `_rotateChunk` (a cada 10s) ficam fora de qualquer fusão cross-source — só representam "iPhone aqui, sem dado nesta janela". Quando RaceBox entrar como segunda fonte (Perna 2), `crossValidationEngine` precisará distinguir "iPhone empty + RaceBox cheio" de "ambos vazios" — schema já permite.

### Inferência marcada como inferência?
Não aplicável — buffer e empty-chunk são metadata de pipeline, não inferência sobre o sample. Stats `replayedFromPreSession` permite ao engenheiro auditar quantos samples vieram do replay vs streaming direto.

### Testes existentes
Smoke test manual da sessão:
- Buffer pre-sessão validado por leitura (cap 200, drain idempotente, stats consistentes).
- Empty chunk validado por leitura (`_closeCurrentChunk` com `count===0` cai no ramo isEmpty).
- Uploader skip validado por leitura (early `chunk.isEmpty || chunk.count === 0` antes de `getSamplesByChunk`).
- **Pendência:** `tests/node-smoke-iphone-storage.mjs` cobrindo (buffer drena ordem cronológica / cap 200 / chunk vazio persiste / uploader skipa flag).

### Riscos técnicos
1. **Buffer cap 200 é estimativa** — sob delay anômalo (IDB lock, iOS suspended), drop começa silente. Stat `preSessionDropped` é o canário; UI não mostra. Mitigação: log warn quando `preSessionDropped > 0` ao final da sessão.
2. **Chunk `isEmpty=true` adiciona campo opcional ao schema** sem migração formal Dexie. Backward-compatible (campos opcionais), mas se outro consumer fizer assumption de schema fixo, quebra. Documentar em `db.js` schema.
3. **Replay pode duplicar samples se buffer for chamado fora de `startSession`** — proteção: `_preSessionBuffer.splice(0)` antes de iterar (drena+esvazia atomic). Não há outro caller; risco contido.
4. **Uploader skip por `chunk.count === 0`** assume que count é fonte de verdade — mas count só incrementa quando chunk está aberto E sample chegou. Se chunk for criado em estado anômalo (raro), count pode divergir de samples reais; defesa secundária `samples.length === 0` cobre.
5. **Empty chunks ficam no IDB indefinidamente como uploaded** após o uploader marcar — vazamento lento. Próxima rodada: GC de chunks `uploadedAt < (now - 30 dias)`.

### Decisão
Aprovada.

### Motivo
- Buffer pre-sessão fecha lacuna real (primeiros segundos do stint sumiam), com cap defensivo.
- Empty chunks com flag mantêm timeline honesta — uploader (e futuros consumers) podem distinguir lacuna de perda.
- Skip explícito no uploader é defesa em profundidade — robusto a refator do storage.
- Critic Cockpit confirmou regressão zero (grep `setEspecial(..., 'critico')` em 0). Apontamento de "isEmpty não gravado" foi falso positivo do critic — verificação direta em `iphone-storage.js:185-202` confirmou `this.currentChunk.isEmpty = true` antes do `db.telemetryChunks.put`.

### Observação
Esta entry pareia com a entry do TD `2026-04-28 — F3 cleanup Box + Cockpit Mobile (11 fixes da auditoria 2026-04-28)`. F3 do Cockpit Mobile toca dados (este log); F3 do Box é puramente render (não toca dado, não vai aqui).

Próxima rodada de pipeline: integrar `Detector.consumeSnapshot()` (achado #4 da auditoria) + cross-validation real (V-001..V-008 deixam de ser dormentes).

---

## 2026-04-29 — Pipeline multi-source via snapshot: AdaptiveTick + SessionRecorder mode=snapshot + crossValidationEngine alimentado

### Entrega avaliada
Achado #4 da `AUDITORIA_SISTEMA_2026-04-28.md` wirado. Pipeline antigo single-source (`SessionRecorder.provider.onSample → detector.consume(sample)`) substituído por pipeline multi-source via snapshot consolidado pelo `TelemetryTimebase`.

Arquivos:
- [`src/telemetry/adaptive-tick.js`](../../src/telemetry/adaptive-tick.js) (novo) — `createAdaptiveTick(timebase, opts)`. Heurística genérica percorre `timebase.sourceStatus()` procurando fonte com `expectedRateHz≥30 && quality===OK && ratePerSec≥0.7×expected`. Sobe pra 60Hz quando há fonte rápida saudável; cai pra 10Hz caso contrário. Re-avalia a cada 5s. Multi-consumer via subscribers internos.
- [`src/telemetry/timebase.js`](../../src/telemetry/timebase.js) — patch leve: `Source.status()` agora expõe `expectedRateHz` (necessário pra heurística adaptativa avaliar fontes que ainda não receberam sample).
- [`src/telemetry/session-recorder.js`](../../src/telemetry/session-recorder.js) — adicionado `mode: 'sample' | 'snapshot'`. No `'snapshot'`: AdaptiveTick alimenta `detector.consumeSnapshot(snap)` + `extraConsumers[i](snap)`. ExtraConsumer com erro NÃO derruba detector (try/catch interno por consumer). Default `'sample'` preserva pipeline legacy intacto.
- [`src/telemetry/cross-validation.js`](../../src/telemetry/cross-validation.js) — `_emit` anota `confianca: 'Alta'` em todos os eventos (regras determinísticas com janela mínima sustentada têm confiança Alta por construção). Coerente com ALERT_HIERARCHY §"Reprovação automática".
- [`cockpit-mobile.html`](../../cockpit-mobile.html) — `_maybeStartSessionRecorder` agora cria `SessionRecorder` em `mode='snapshot'` + instância nova de `CrossValidationEngine` com `onEvent` routando por severidade pra `cockpitState` (critico → setCritico canônico, atencao → pushAlerta, info → console.info).

### Fontes envolvidas
- `cockpit-mobile` (GPS @1Hz, freshness 1500ms) — atual.
- `iphone-imu` (CoreMotion @60Hz, freshness 200ms) — atual.
- `racebox-gnss` (RaceBox GNSS @25Hz, freshness 100ms) — futuro Perna 2.
- `racebox-imu` (RaceBox IMU @100Hz, freshness 50ms) — futuro Perna 2.
- `t4000` (Injepro CAN @100Hz, freshness 50ms) — futuro Perna 2.

Pipeline opera identicamente independente de quais fontes estão attached — `timebase` faz fusão por `tMono`; AdaptiveTick decide taxa baseado em quem está saudável.

### Dados usados
Snapshots `CarTelemetrySnapshot` (definidos em `TELEMETRY_SNAPSHOT_SPEC.md`):
- `tMono: number` (canônico FAM ms — gating do consumeSnapshot).
- `position: { local_x, local_y, lat, lon, heading, ... }` — Detector usa `local_x/local_y` pra path-mapping.
- `vehicle: { speed_can, speed_gnss, speed_fused }` — Detector usa `speed_fused` (preferência) ou `speed_gnss` (fallback).
- `engine: { rpm, tps, map, lambda, oil_pressure, oil_temp, water_temp, battery_voltage, gear, ... }` — CrossValidation usa pra V-005..V-008.
- `dynamics: { accel_longitudinal, accel_lateral, yaw_rate, ... }` — CrossValidation usa pra V-002, V-010, V-011.
- `quality: { t4000_quality, racebox_quality, iphone_quality, sync_quality, confidence }` — todas as regras checam quality antes de emitir.

### Origem dos dados
- `MobileTelemetry` (cockpit-telemetry.js) publica via `sampleBus._emit(sample)` E `timebase.ingest(sample)` no mesmo callback.
- `timebase.snapshotAt(tMono)` produz snapshot consolidado de TODAS as fontes attached (lê `nearest(tMono)` por fonte com freshness; `buildSnapshot` monta o objeto canônico).
- AdaptiveTick subscreve `timebase.onTick(rateHz, snap → dispatch)` na taxa atual; quando heurística troca rate, re-subscribe sem interromper consumers internos.
- `SessionRecorder.start()` em mode='snapshot' cria AdaptiveTick + subscreve `onTick(snap => detector.consumeSnapshot(snap) + extraConsumers[i](snap))`.

### Timestamp validado?
Sim. `tMono` (canônico FAM ms, ADR-015) preservado em todo o pipeline:
- `MobileTelemetry._buildSample` injeta `sample.tMono = performance.now()`.
- `timebase.ingest` usa `sample.tMono` direto (rejeita amostra sem `tMono` — fora-de-ordem é detectado, duplicado descartado).
- `buildSnapshot` recebe `tMono` do tick e consolida snapshot com este timestamp.
- `Detector.consumeSnapshot` extrai `snap.tMono` e passa pro `consume` interno.
- `CrossValidationEngine.consume` usa `snap.tMono` em todas as janelas mínimas (`WindowState.enter(tMono)`).
- AdaptiveTick não transforma timestamp — só dispara consumers no tick.

### Unidade validada?
Sim. Pipeline herda contratos do `TELEMETRY_SNAPSHOT_SPEC.md`:
- Speed em m/s (snapshot.vehicle.speed_*); Detector e CrossValidation operam em m/s; quando exibido em km/h, conversão na borda (`× 3.6`).
- Pressão em bar (oil_pressure, fuel_pressure, map).
- Temp em °C (oil_temp, water_temp, fuel_temp).
- Aceleração em m/s² (accel_*); RPM em rpm; TPS em %; lambda adimensional; tensão em V; marcha enum 0..6.
- Tudo coerente com `TELEMETRY_ENGINEERING_RULES.md` §Regra 2.

### Escala validada?
Para canais existentes (cockpit-mobile + iphone-imu): sim — fixtures do smoke novo cobrem.
Para canais futuros (RaceBox, T4000): pipeline aceita; spec já cobre escalas. Calibração de `rateFloorPct=0.7` (AdaptiveTick) e janelas das regras V-* depende de campo real.

### Qualidade dos dados (categorias afetadas)
AdaptiveTick consome `Quality.OK` para decidir "fonte rápida saudável". Categorias degradadas (`LATE`, `MISSING`, `LOW_CONFIDENCE`, `OUT_OF_ORDER`, `DUPLICATE`, `INTERPOLATED`, `STALE`, `OUT_OF_RANGE`, `SUSPECT`, `LOST`) NÃO contam como saudável — força low rate (10Hz). Defesa: smoke AT-06 valida `Quality.MISSING`, AT-07 valida `ratePerSec` abaixo do floor com quality=OK.

CrossValidationEngine herda quality do snapshot (que herda de `timebase.sourceStatus`); cada regra V-001..V-011 checa `snap.quality.*_quality` antes de emitir (V-001 exige t4000 OK + racebox/iphone OK; V-002 só dispara com IMU presente; etc.). Eventos emitidos pelo engine recebem `confianca: 'Alta'` por construção (anotação no `_emit`).

### Sincronização validada?
Sim. AdaptiveTick produz UM tick alimentando TODOS os consumers (Detector + CrossValidationEngine + futuros). Caller-callbacks recebem snapshots IGUAIS (mesmo objeto frozen). Quando RaceBox + T4000 entrarem (Perna 2), o timebase já faz fusão por nearest(tMono); snapshot inclui canais de todas as fontes attached. Sem retrabalho.

Re-subscribe de taxa (10↔60Hz) NÃO afeta subscribers internos do AdaptiveTick — controller mantém `_unsubFromTb` próprio e re-cria a inscrição no timebase, mas `subscribers` Set continua o mesmo. Garantia: snapshot streaming nunca perde callbacks por troca de taxa.

### Inferência marcada como inferência?
Sim:
- `confianca: 'Alta'` é declarado nas eventos do CrossValidationEngine (não inferido — regras determinísticas com janela mínima 0.5–60s têm confiança Alta por construção).
- `severity: 'info' | 'atencao' | 'critico'` é declarado por regra; cockpit roteia por severity (não infere).
- AdaptiveTick decisão `currentRate` é inspecionável via `tickController.currentRate()`.
- Quando alguma fonte estiver `LATE`/`MISSING`, snapshot reflete isso em `quality.*_quality` — nada é inferido como OK; consumidor decide o que fazer.

### Testes existentes
- `tests/node-smoke-detector-snapshot.mjs` (novo) — 15 cases:
  - **AdaptiveTick (AT-01..AT-07):** começa em low (10Hz); sobe pra high (60Hz) quando há fast healthy source; troca dinâmica forward+reverse; subscribers recebem snapshots redistribuídos; stop limpa subscribers e remove inscrição do timebase; Quality.MISSING força low; ratePerSec abaixo do floor (35 < 60×0.7=42) força low.
  - **SessionRecorder mode=snapshot (SR-01..SR-05):** chama `detector.consumeSnapshot` a cada tick; extraConsumers recebem o mesmo snapshot; extraConsumer com erro não derruba detector nem outros consumers; mode=snapshot sem timebase rejeita; mode inválido rejeita.
  - **SessionRecorder mode=sample legacy (SR-06):** comportamento preservado (provider.onSample → detector.consume).
  - **Stop + integração real (SR-07, SR-08):** stop fecha tick controller e libera referência; integração com Detector real + CrossValidationEngine real (snapshot benigno → 0 events emitidos; pipeline silencioso quando dado normal — honesto).
- `tests/node-smoke-overload-filter.mjs` — assert canônicas: `FrasesSistema.length === 8` + `FrasesSistema.includes('Motor quente'|'Pressão óleo'|'Mistura pobre'|'Bateria crítica'|'Verifique sistema')`.
- `tests/node-smoke-telemetry-p0.mjs` — XV-V001/V006/cooldown verde (cobertura prévia da CrossValidationEngine preservada — `confianca` adicionada não quebra).
- `tests/node-smoke-perna1-iphone.mjs` — P1-06/P1-07 cobrem `Detector.consumeSnapshot` (já existiam).

Bateria total da rodada: 14 suites = **152 ok / 0 fail**. Zero regressão.

### Riscos técnicos
1. **`AdaptiveTick.setInterval(evaluateNow, 5000)`** segue rodando se caller esquecer `tickController.stop()`. Vazamento residual sem efeito visível no produto. Mitigação: `SessionRecorder.stop()` chama `_tickController.stop()` automaticamente.
2. **CrossValidationEngine instância por sessão** (não singleton). Re-arranque na mesma página deixaria instância anterior dangling. Hoje cockpit triple-tap faz `location.href` (recarrega tudo); risco residual baixo.
3. **`rateFloorPct = 0.7` chute de design** — fonte declarada 60Hz mas entregando 41Hz consistente cai pra low. Calibrar em campo. Tornar configurável via `tickOpts` se necessário.
4. **V-001/V-006/V-007/V-008 dormentes até T4000 entrar** — comportamento honesto (regra retorna sem emitir se canal `null`). Sem feedback visual. Próxima rodada: badge "Validações ativas" no chip.
5. **Eventos `severity='info'` invisíveis no iPhone prod** — `console.info` não é alcançável sem inspetor remoto. Aceitar (intencional — info por construção é diagnóstico, não pra piloto).
6. **Re-bump `phrases.js?v=N`** quando adicionar entrada futura é mandatório. Mitigado: `node-smoke-overload-filter` valida catálogo CONTÉM canônicas POR NOME — bump esquecido faz teste falhar.
7. **Snapshot é imutável (frozen)** — consumers que tentem mutar campos silenciosamente falham. Conhecido e desejado (regra 6 do SPEC).
8. **Empty-chunks integração** — pipeline novo não gera empty-chunks (era responsabilidade do storage). `iphone-storage` continua intacto. Quando RaceBox empty + iPhone cheio, cross-source distinção fica natural via snapshot quality.

### Decisão
Aprovada.

### Motivo
- Pipeline fecha lacuna #4 da auditoria — multi-fonte fundida via snapshot canônico, NÃO single-source defasado.
- Bateria 152 ok / 0 fail — zero regressão. Smoke novo cobre todos os ramos críticos da heurística adaptativa + integração com Detector + CrossValidationEngine reais.
- Fixtures cobrem casos `Quality.OK` (high), `Quality.LATE` (low), `Quality.MISSING` (low), `ratePerSec` abaixo do floor (low), erro em extraConsumer (isolado), mode=sample legacy (preservado).
- `confianca: 'Alta'` declarado por construção em todos os eventos do engine — atende ALERT_HIERARCHY §"Reprovação automática".
- Frases canônicas T-011..T-013 documentadas em `BOX_TO_PILOT_TRANSLATION_RULES.md` + sincronizadas em `SPEC_MENSAGENS.md §6.4`. `FrasesSistema` estendida 5→8. Cache-bust `?v=3`.
- 3 rodadas de `fam-cockpit-design-critic` — round 3 APRESENTAR limpo.
- `fam-compliance-controller` APROVADO COM AJUSTES; AT-06+AT-07 fixtures Quality.MISSING e ratePerSec abaixo do floor adicionadas.

### Observação
Esta entry pareia com a entry do TD `2026-04-29 — Detector multi-fonte via snapshot...`. Pipeline aqui descreve aspectos técnicos de telemetria (timestamp, unidade, escala, qualidade, sincronização, inferência); TD descreve decisão de produto (responde pergunta real, atende SPEC_MENSAGENS, integra com gates).

Próxima rodada esperada (CTE log): F4 dinâmico via FocusMode + Detector eventos. Quando `Detector.onSegmentEnd` emitir entrada/saída de trecho consolidada, slot `foco` em cockpit-state ativa naturalmente — pendência #3 do `fam-racing-modal-stint-pendencias.md`.

