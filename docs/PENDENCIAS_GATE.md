# PENDENCIAS_GATE — Pendências do Diretor Técnico

Lista viva das pendências derivadas da auditoria, do Decision Log e da validação visual. Cada item é uma decisão de produto ainda não tomada (ou tomada mas não executada). Não confundir com `TECH_DEBT_TRACKER.md` (dívidas técnicas internas) nem com `BLOCKERS.md` (bloqueios de hardware).

Convenção:
- **P0** — bloqueia a próxima rodada lógica do gate
- **P1** — alto valor, próximas semanas
- **P2** — valor real, sem urgência
- **P3** — registrar para não perder, decidir depois

Cada item carrega:
- Origem (de onde a pendência nasceu)
- Escopo estimado
- Critério de "feito"
- Bloqueios / dependências

---

## P0 — Seed Brasília com cadastro completo de apex

**Origem:** Decision Log 2026-04-24 (ajuste 1) + AUDITORIA_INICIAL §"Ajustes prioritários" item 5.

**O que falta:** popular `apexReference`, `apexStrategy`, `cornerType` e `nextStraightLength` para os 8 trechos cadastrados de Brasília em [`src/domain/seed-tracks.js`](../../src/domain/seed-tracks.js). O schema já aceita os campos (gate aplicado em `track-segment.js`), mas o seed atual cria os trechos sem eles.

**Por que P0:** sem os valores cadastrados, `error-classifier.classifyApex()` retorna `null`, `apexSacrificouSaida()` não dispara, e o detector continua emitindo `apex_actual` sem ter contra o quê comparar. Toda a infraestrutura de apex que adicionamos fica em modo degradado.

**Escopo:** pequeno. 8 trechos × 4 campos = 32 valores. Requer referência visual (screenshot do mapa de Brasília com o apex marcado por curva) e estimativa de comprimento das retas seguintes.

**Critério de feito:**
- 8 trechos com `apexReference: { x, y }` no viewBox 823×799 do mapa de Brasília
- 8 trechos com `apexStrategy` ('antecipado' | 'neutro' | 'tardio' | 'duplo')
- 8 trechos com `cornerType` ('lenta' | 'media' | 'rapida')
- Trechos antes de retas longas (>200m) com `nextStraightLength` populado
- `TrackSegments.hasFullApexCadastro()` retorna `true` para todos
- Validação visual no Box: marcar o apex no mapa engenharia confirma posição

**Bloqueios:** Flavio precisa marcar visualmente o apex de cada curva (referência humana — não derivamos do GPS).

---

## P0 — Hierarquia de alertas determinística cadastrada

**Origem:** AUDITORIA_INICIAL §"Riscos técnicos" item 1 + `ALERT_HIERARCHY.md`.

**O que falta:** o `MessageBroker` tem prioridade (CRITICAL/BOX_MANUAL/PEDAGOGICAL/CONFIRMATION) mas não há regras determinísticas cadastradas para CRÍTICO e BOX AGORA por canal de telemetria (pressão óleo, temp motor, λ, bateria, falha de canal, etc.).

**Por que P0:** quando E2 (Injepro) entrar live, alertas críticos de motor precisam disparar imediatamente. Sem regras prontas, o sistema pode silenciar uma falha mecânica iminente — quebra ADR-008 e a Regra 11 do `PRODUCT_FOCUS_RULES.md`.

**Escopo:** médio. Criar módulo novo `src/cockpit/critical-rules.js` ou similar. Cada regra: canal + limite + nível + cooldown. Testes unitários obrigatórios (Regra 4 do `ALERT_HIERARCHY.md`).

**Critério de feito:**
- Catálogo mínimo cadastrado em código: pressão óleo baixa, temp motor extrema, temp freio extrema, λ pobre prolongado, bateria baixa, falha de canal, bandeira vermelha (manual), bandeira amarela (manual)
- Cada regra com nível + limite + cooldown + teste automatizado
- BOX AGORA dispara via botão dedicado no Box (manual) e via regra automática
- Regras NUNCA são silenciadas por OverloadFilter

**Bloqueios:** limites por canal precisam ser calibrados com Flavio (janela de cada métrica do Celta).

---

## P1 — Pré-evento como módulo bloqueante

**Origem:** AUDITORIA_INICIAL §"Riscos de produto" item 3 + `PRE_EVENT_CHECKLIST.md`.

**O que falta:** módulo na aplicação que implemente o `PRE_EVENT_CHECKLIST.md` como tela bloqueante. Hoje só existe o planejamento de stint (`stint-planner.js`). Criar evento sem objetivo declarado é possível.

**Por que P1:** o gate diz "sem objetivo declarado, o evento não começa". O sistema precisa enforçar.

**Escopo:** grande. UI nova + entidade `Event` com objetivos + critérios de sucesso/abortar + checklist de carro + plano de stints encadeado.

**Critério de feito:**
- Tela "Novo evento" com 7 etapas do `PRE_EVENT_CHECKLIST.md`
- Sistema bloqueia stint sem evento ativo
- Sistema bloqueia stint sem objetivo declarado
- Visível no Box (chip "Objetivo do dia") + no menu principal V2

**Bloqueios:** depende do menu principal V2 estar pronto (item P1 abaixo).

---

## P1 — Menu principal V2 (entrada do usuário)

**Origem:** AUDITORIA_INICIAL §"Riscos de usabilidade" item 1 + V1 → V2 pendente.

**O que falta:** tela inicial da aplicação V2. Hoje `/index.html` é stub de dev. Usuário não tem ponto único de entrada.

**Por que P1:** sem entrada, usuário cai em telas isoladas (`/box`, `/cockpit`). V1 tinha menu com EVENTOS, GARAGEM, PENDÊNCIAS — V2 não tem.

**Escopo:** médio. SPA shell + roteamento + menu lateral sem ícones (regra do projeto).

**Critério de feito:**
- Rota `/` com menu textual (EVENTOS / GARAGEM / PENDÊNCIAS / PLANEJAMENTO / BOX / COCKPIT)
- Cada item leva à tela respectiva (algumas ainda pendentes — ver itens abaixo)
- Sem ícones (regra do projeto)
- Tela inicial = primeira função, scroll no topo

**Bloqueios:** nenhum técnico.

---

## P1 — `/api/post-event` + relatório de evento

**Origem:** AUDITORIA_INICIAL §"Riscos técnicos" item 2 + `POST_EVENT_REVIEW_TEMPLATE.md`.

**O que falta:** endpoint serverless para gerar o relatório consolidado de evento + UI no Box equivalente ao "Análise pós-stint" mas com escopo de evento inteiro.

**Por que P1:** sem isto, não há fechamento do dia. Engenheiro/Flavio leva conhecimento do evento na cabeça em vez de relatório auditável.

**Escopo:** médio. Análogo a `/api/post-stint` + cliente equivalente.

**Critério de feito:**
- Endpoint `/api/post-event.js` com prompt curado, 20 seções do `POST_EVENT_REVIEW_TEMPLATE.md`
- "nao_mexer" obrigatório no output
- Modal "Relatório do Evento" no menu ≡ AÇÕES do Box
- Salva em `advisorSuggestions` com `tipo='posevento'`
- APROVAR / EDITAR / REJEITAR igual ao post-stint

**Bloqueios:** nenhum técnico.

---

## P2 — Migração V1 → V2 das telas administrativas

**Origem:** AUDITORIA_INICIAL §"Telas que NÃO existem em V2".

**O que falta:**
- Eventos (cadastro de track day) — V1 tem, V2 não
- Dias de evento + checked/concluido — V1 tem, V2 não
- Garagem (UI de carros + configurações) — domínio existe (Cars/CarConfigurations), UI não
- Pendências — V1 tem, V2 não
- Pista visual replay (carrinho top-down + 32 frames) — V1 tem, V2 não tem replay (tem cockpit que é HUD piloto)
- Checklist na hora da corrida — spec em `PRE_EVENT_CHECKLIST.md`, sem código

**Por que P2:** Flavio confirmou na sessão 2026-04-24 que essas funções fazem parte do produto. Sem elas, V2 fica reduzida a "produto técnico" e perde o V1 vivo.

**Escopo:** grande (cada tela é trabalho individual).

**Critério de feito por tela:** ver `FEATURE_ACCEPTANCE_CRITERIA.md` (14 campos por feature).

**Bloqueios:** depende do menu principal V2 (P1 acima). Cada tela passa pelo gate antes de ser declarada concluída.

---

## P2 — `box-view.js` — interpretação visível ao lado de toda métrica

**Origem:** AUDITORIA_INICIAL §"Aprovados com ajustes" + Regra 1 do `PRODUCT_FOCUS_RULES.md`.

**O que falta:** revisar cada métrica numérica do painel do Box e garantir que toda métrica venha rotulada com sua interpretação. Hoje há números soltos em vários cantos.

**Por que P2:** ajuste conceitual amplo, não cabe em single Edit. Deve ser aplicado por componente conforme houver mudança em cada métrica. Diretriz registrada no Decision Log.

**Escopo:** distribuído (cada métrica é mini-ajuste).

**Critério de feito:** revisão por componente do `box-view.js`; cada métrica numérica acompanhada por (a) unidade, (b) referência (vs melhor / vs ideal / vs ref), (c) cor semântica, (d) interpretação curta quando aplicável.

**Bloqueios:** nenhum.

---

## P3 — `error-classifier.classifyApex()` usa distância euclidiana 2D

**Origem:** Decision Log 2026-04-24 (Riscos identificados, item 1).

**O que falta:** substituir distância euclidiana 2D no viewBox por projeção tangencial (lateral vs longitudinal real) quando o `TrackSegment` tiver tangente/normal cadastradas.

**Por que P3:** heurística atual funciona para curvas aproximadamente perpendiculares ao eixo do viewBox. Para curvas com orientação arbitrária, a separação entre "delta lateral" e "delta longitudinal" é imprecisa. Não compromete classificação básica (apex perdido vs apex próximo), mas distinção interno/externo fica fraca.

**Escopo:** pequeno quando o cadastro tiver tangente.

**Critério de feito:** `TrackSegment` ganha `apexTangent: { dx, dy }` no cadastro; `classifyApex()` projeta o vetor `(apexActual − apexReference)` em tangente (longitudinal) e normal (lateral).

**Bloqueios:** depende de cadastro completo do apex (P0 acima) e de Flavio decidir se cadastra a tangente ou se deriva do path consolidado.

---

## P3 — 25 módulos não-avaliados em profundidade

**Origem:** AUDITORIA_INICIAL §"Não avaliados por falta de contexto".

**O que falta:** auditar cada um dos 25 módulos listados quando forem tocados em sessão futura. Lista: `reference-view.js`, `vectors-view.js`, `tire-view.js`, `cockpit-state.js`, `audio-cue.js`, `fatigue-estimator.js`, `global-state-machine.js`, `stint-env.js`, `baseline-vectors.js`, `reference-line.js`, `tire-wear.js`, `fuel-calc.js`, `benchmark.js`, `score.js`, `repeatability.js`, `pedagogical-plan.js`, `planned-vs-executed.js`, `session-master.js`, `provider.js`, `device-provider.js`, `projector.js`, `path-mapper.js`, `sample-store.js`, `session-recorder.js`, `corredor.js`.

**Por que P3:** rotina de manutenção. Cada módulo passa pelo gate na primeira vez que for editado.

**Escopo:** distribuído (caso a caso).

**Critério de feito:** módulo aparece em "Aprovados" ou "Aprovados com ajustes" da próxima revisão da auditoria.

**Bloqueios:** nenhum.

---

## P3 — Revisão periódica da auditoria

**Origem:** AUDITORIA_INICIAL §"Próximos passos obrigatórios" item 6 + §"Riscos de perda de foco" item 2.

**O que fazer:** revisar `AUDITORIA_INICIAL_DIRETOR_TECNICO.md` a cada 2-4 semanas ou após cada lote grande de mudanças. Atualizar status de módulos, adicionar novos, registrar entradas no Decision Log.

**Próxima revisão sugerida:** 2026-05-15 (3 semanas após criação).

**Bloqueios:** nenhum.

---

## P0 — TelemetryTimebase (Spec → Implementação)

**Origem:** AUDITORIA_INICIAL_TELEMETRIA §"Lacuna mais grave" + `TELEMETRY_TIMEBASE_SPEC.md`.

**O que falta:** componente `TelemetryTimebase` que consume providers, alinha por `tMono`, produz `CarTelemetrySnapshot` por instante. Hoje cada provider escreve no `sampleStore` independente; análises consomem de uma fonte só.

**Por que P0:** pré-requisito para tudo que envolve mais de uma fonte. Crítico antes de T4000 ou RaceBox entrarem live — sem timebase, snapshots multi-fonte serão inconsistentes.

**Escopo:** médio. Arquivo `src/telemetry/timebase.js` + adaptação incremental do Detector. Backwards-compatible enquanto migra.

**Critério de feito:**
- `TelemetryTimebase` aceita registros de N fontes
- Produz snapshots por instante via `snapshotAt(tMono)` / `snapshotNow()` / `onTick(rateHz)`
- Marca canais com `INTERPOLATED` / `LATE` / `MISSING` conforme regras
- Estima latência por fonte + jitter + categoriza qualidade
- Testes obrigatórios (Regra 9 das `TELEMETRY_ENGINEERING_RULES.md`): 2 fontes em fase, 1 caída, latência alta, fora de ordem, duplicado, gap longo, replay determinístico

**Bloqueios:** nenhum técnico. Pode ser construído com mock + DeviceProvider antes de hardware real entrar.

---

## P0 — TelemetrySnapshotBuilder (`CarTelemetrySnapshot`)

**Origem:** AUDITORIA_INICIAL_TELEMETRIA + `TELEMETRY_SNAPSHOT_SPEC.md`.

**O que falta:** estrutura conceitual `CarTelemetrySnapshot` implementada como módulo, construída pelo `TelemetryTimebase`. Define a forma canônica de "estado do carro num instante T".

**Por que P0:** vai junto com timebase. Análises (Detector, FaseCurva, Corredor) precisam migrar para consumir snapshot em vez de Sample direto.

**Escopo:** pequeno (estrutura + testes), mas migração das análises é incremental.

**Critério de feito:**
- Estrutura conforme `TELEMETRY_SNAPSHOT_SPEC.md` §estrutura
- `quality.*` reflete pior categoria por fonte
- Campos não-disponíveis = `null` (nunca 0, nunca '-', nunca 'N/A')
- Imutável (Object.freeze ou equivalente)
- Replay produz mesma sequência de snapshots

**Bloqueios:** depende de `TelemetryTimebase`.

---

## P1 — Migração 4 → 11 categorias de qualidade

**Origem:** AUDITORIA_INICIAL_TELEMETRIA + `DATA_QUALITY_RULES.md`.

**O que falta:** atualmente `provider.js` usa `SignalQuality` com 4 categorias (good/degraded/bad/lost). Faltam 7: `INTERPOLATED`, `ESTIMATED`, `OUT_OF_ORDER`, `DUPLICATE`, `INVALID_CHECKSUM`, `LATE`, `OUT_OF_RANGE`.

**Por que P1:** UI hoje não distingue dado fresco de interpolado. Quando T4000 + RaceBox entrarem, usuário não saberá qual número é confiável.

**Escopo:** médio. Manter `SignalQuality` (estado da fonte) + adicionar `quality` por amostra (categoria detalhada). UI atualiza para indicadores correspondentes.

**Critério de feito:**
- `quality` por amostra com 11 categorias
- Default por fonte declarado em `DATA_QUALITY_RULES.md` §Regra 1 implementado
- Categoria pode mudar no pipeline (provider OK → timebase LATE → detector OUT_OF_ORDER)
- UI Box / Cockpit mostra indicadores quando ≠ OK
- Crítico de segurança só dispara com dado OK (Regra 4)

**Bloqueios:** depende parcialmente de `TelemetryTimebase` (para INTERPOLATED, ESTIMATED, LATE, OUT_OF_ORDER).

---

## P1 — CrossValidationEngine (V-001 a V-011)

**Origem:** `CROSS_VALIDATION_RULES.md`.

**O que falta:** módulo que consume snapshots, aplica catálogo V-001 a V-011, emite eventos quando divergência detectada, marca canais envolvidos como `SUSPECT`.

**Por que P1:** sem isso, divergência CAN vs GNSS, RPM × marcha × velocidade, λ sob carga, pressão óleo, etc. silenciam. Risco de alimentar análise/decisão com dado inconsistente.

**Escopo:** médio. Catálogo de 11 validações + cooldown + severidade.

**Critério de feito:**
- `src/telemetry/cross-validation.js` ou `src/domain/cross-validation.js`
- Cada validação tem fixture de teste (caso normal, divergência, transitório, recovery)
- Eventos alimentam `MessageBroker` (no Box) ou store auditável
- Cooldown configurável

**Bloqueios:** depende de `TelemetrySnapshotBuilder` (consume snapshot, não sample).

---

## P1 — Captura real do barramento CAN da T4000 para validar dúvidas residuais

**Origem:** [`T4000_CAN_SPEC.md`](T4000_CAN_SPEC.md) §Dúvidas residuais + `TELEMETRY_ENGINEERING_DECISION_LOG.md` 2026-04-24 + BLOCKERS.md §E2.

**Contexto:** Spec oficial da Injepro recebida e arquivada em `refs/INJEPRO_T4000_CAN_PROTOCOL_2026-04-24.pdf`. Checksum validado matematicamente (1937 mod 256 = 0x91). Restam **3 dúvidas residuais** que só captura real do barramento responde:

1. **Diferenciação dos 5 pacotes** — todos usam CAN ID `0x7FB`. Confirmar se distinção é por ordem temporal (10 ms entre) + sentinelas fixas (`0x1E 0xFC` no fim do pacote 4, `0xFB 0xFA` no início do pacote 5), ou se há MUX byte não-documentado.
2. **Bytes 2-6 do pacote 5** — 5 bytes não documentados num pacote de 8. Hipótese mais provável: zero-padding (checksum só fecha se somam zero). Confirmar via captura.
3. **Range físico máximo do EGT** — `÷1` em uint16 daria 0..65535 °C. Range real provável 0..1500 °C. Confirmar para calibrar `OUT_OF_RANGE`.

**Dúvidas menores (resolver junto quando possível):**
- Versão do firmware T4000 instalada + política de compatibilidade com updates
- Comportamento do EGT sem sensor EGT-4 instalado (byte zero ou canal omitido?)
- Semântica do bitfield "Error ECU" (tabela de bits → falhas)
- Confirmação de que marcha=0 significa neutro

**Por que P1:** destrava a implementação do parser T4000 (item P2 abaixo). Sem as 3 dúvidas resolvidas, parser nasce com fragilidade em detecção de desalinhamento e em flag de OUT_OF_RANGE do EGT.

**Escopo:** pequeno-médio (hardware). Requer adaptador CAN/USB conectado ao barramento da T4000 + captura de 30-60 s de ciclos em condições variadas (idle, alta rotação, diferentes marchas). Análise dos bytes capturados responde as 3 dúvidas.

**Critério de feito:**
- Log binário de ≥ 30 s de tráfego CAN 0x7FB capturado.
- Documentado se pacotes chegam em ordem determinística (Dúvida #1 resolvida).
- Documentado o conteúdo dos bytes 2-6 do pacote 5 (Dúvida #2 resolvida — padding ou canais novos).
- Range observado de EGT em condições reais (Dúvida #3 resolvida).
- `T4000_CAN_SPEC.md` atualizado com dúvidas residuais resolvidas.

**Bloqueios:** Flavio precisa do adaptador CAN/USB e acesso físico ao carro com a T4000 ligada. Se adaptador não disponível, alternativa é pedir à Injepro um dump/log de referência.

**Dependência:** destrava P2 "T4000 parser + reader + provider" (abaixo).

---

## P1 — TelemetryReplayEngine

**Origem:** AUDITORIA_INICIAL_TELEMETRIA §"Lacuna 5".

**O que falta:** módulo que lê samples de uma sessão (`sampleStore.getBySession()`) e re-alimenta o detector (ou pipeline timebase + análise) para reproduzir análises offline.

**Por que P1:** habilita teste de regressão ("mesma sessão produz mesma análise após mudança de algoritmo") e auditoria.

**Escopo:** pequeno (loop simples) — desde que o pipeline seja determinístico.

**Critério de feito:**
- `src/telemetry/replay.js`
- Aceita `sessionId` + opções (taxa, fonte filtrada)
- Produz mesma sequência de eventos do Detector original
- Teste de regressão: comparar análise replay vs salva

**Bloqueios:** nenhum hard. Beneficia-se de timebase mas pode existir antes (replay direto pra Detector como hoje).

---

## P2 — T4000 parser + reader + provider

**Origem:** AUDITORIA_INICIAL_TELEMETRIA + `T4000_CAN_SPEC.md` (SPEC CONFIRMADA 2026-04-24) + BLOCKERS.md E2.

**O que falta:** `T4000CanReader`, `T4000PacketParser`, `T4000Provider` (3 módulos novos).

**Por que P2:** alimenta `MECHANIC_QUESTIONS_MATRIX.md` e validação cruzada V-001 a V-008. Spec oficial Injepro recebida em 2026-04-24 (PDF arquivado em `refs/INJEPRO_T4000_CAN_PROTOCOL_2026-04-24.pdf`), checksum validado matematicamente, encoding big-endian confirmado, fatores de conversão por canal confirmados. Implementação liberada após P1 acima (captura real resolver as 3 dúvidas residuais).

**Escopo:** médio (3 módulos + fixtures de teste).

**Critério de feito:**
- ~~Spec validada~~ — SPEC RECEBIDA 2026-04-24 (seguir T4000_CAN_SPEC.md)
- Captura real do barramento concluída (P1 acima resolvido)
- Parser passa fixtures: exemplo canônico do PDF (`0x91` checksum deve bater), checksum inválido, gap, fora de ordem, duplicado, valor fora de range, ciclo incompleto, recovery, bitfield de Erro ECU != 0
- Integração via `TelemetryTimebase` produz snapshots com `engine.*` populado
- Regras críticas em `ALERT_HIERARCHY.md` cadastradas com limites calibrados

**Bloqueios:** depende de P1 acima (captura real) para resolver 3 dúvidas residuais antes de implementar. BLOCKERS.md E2 foi atualizado para "SPEC RECEBIDA — aguardando captura real".

---

## P2 — RaceBox reader + provider

**Origem:** AUDITORIA_INICIAL_TELEMETRIA + `RACEBOX_INTEGRATION_SPEC.md` + BLOCKERS.md E4.

**O que falta:** `RaceBoxBleReader`, `RaceBoxPacketParser`, `RaceBoxProvider`.

**Por que P2:** fonte primária para `position.*` e `dynamics.*`. Substitui DeviceProvider (iPhone) em qualidade GNSS (10cm vs 5m) e IMU (100Hz vs 50Hz).

**Escopo:** médio (3 módulos + fixtures + driver BLE Windows).

**Critério de feito:**
- PDF oficial obtido (formulário racebox.pro)
- Parser passa fixtures de pacote válido, checksum inválido, duplicado, fora de ordem, gap GNSS, IMU drift, BLE reconectado, bateria baixa
- Integração via `TelemetryTimebase` produz snapshots com `position.*` + `dynamics.*` populados
- Validação cruzada V-001 (speed CAN vs GNSS) ativa

**Bloqueios:** BLOCKERS.md E4 (PDF formulário racebox.pro).

---

## P3 — Adaptação Detector / FaseCurva / Corredor para snapshot

**Origem:** AUDITORIA_INICIAL_TELEMETRIA §"Ajustes prioritários" item 9.

**O que falta:** módulos atuais consomem `Sample`. Quando `CarTelemetrySnapshot` existir, migrar para consumir snapshot. Migração incremental.

**Por que P3:** otimização — consumir snapshot dá acesso a dados fundidos (`speed_fused`) e qualidade categorizada. Pode ficar para depois de timebase + snapshot estarem estáveis.

**Escopo:** distribuído (3 módulos).

**Critério de feito:**
- Detector lê de `position.local_x`, `position.local_y`, `vehicle.speed_fused`
- FaseCurva lê de `dynamics.accel_longitudinal`, `vehicle.speed_fused`
- Corredor lê de `position.local_x`, `position.local_y`
- Fixtures de regressão: mesma sessão produz análise equivalente

**Bloqueios:** depende de TelemetryTimebase + TelemetrySnapshotBuilder.

---

## P3 — TelemetryTestFixtures (cenários de erro)

**Origem:** AUDITORIA_INICIAL_TELEMETRIA §"Lacuna 8".

**O que falta:** gerador de cenários sintéticos de erro: perda de pacote, fora de ordem, checksum inválido, valor fora de range, gap de GNSS, drift de IMU, latência alta, divergência cruzada.

**Por que P3:** habilita teste rigoroso de comportamento sob falha. `MockProvider` atual gera caso feliz só.

**Escopo:** pequeno-médio.

**Critério de feito:**
- `src/telemetry/test-fixtures.js` ou `tests/telemetry-fixtures.js`
- API para gerar cada cenário sob demanda
- Testes de timebase, parser, validação cruzada usam fixtures correspondentes
- Cobertura mínima: cada categoria de `DATA_QUALITY_RULES.md` representada por pelo menos 1 fixture

**Bloqueios:** nenhum.

---

## P3 — Operacionalização do gate em PR/commit

**Origem:** AUDITORIA_INICIAL §"Riscos de perda de foco" item 1.

**O que fazer:** integrar a checagem do gate ao fluxo de cada commit/PR. Hoje a regra "toda entrega passa pelo gate antes de ser concluída" depende de disciplina manual. Pode evoluir para hook no `.claude/settings.local.json` (já existe `Stop` hook) que injete reminder do checklist.

**Escopo:** pequeno. Editar `stop-sanity.sh`.

**Critério de feito:** ao final de cada turno onde houve `Edit`/`Write` em código de produto, hook injeta o `DELIVERY_REVIEW_CHECKLIST.md` resumido.

**Bloqueios:** nenhum.

---

## Como atualizar este arquivo

Toda nova pendência derivada de auditoria, Decision Log ou validação visual entra aqui. Itens completados são RISCADOS e movidos para uma seção "Concluídos" no fim do arquivo (ou removidos se anteriormente registrados no Decision Log).

Não duplicar com:
- `TECH_DEBT_TRACKER.md` — dívida técnica interna (drainer, ícones, ESLint, etc.)
- `BLOCKERS.md` — bloqueios de hardware (Injepro USB, app iOS, RaceBox, vídeo Insta360)
- `docs/PLANO_EXECUCAO.md` — blocos A-G originais do roadmap
