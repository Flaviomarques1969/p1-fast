# Command Box Engenharia — Auditoria do Existente + Proposta de Arquitetura

**Data**: 2026-05-13
**Branch**: `claude/audit-engineering-module-Ael3m`
**Autor**: Claude (Opus 4.7), sob direção do Flávio
**Status**: PROPOSTA — nada implementado. Decisões de arquitetura/escopo aguardam aprovação do Flávio (CONTROL_CENTER.md).

> **Tratamento "você"** §9.2 do `PLANO_FASE_1.md`. Sem "tu/te/ti".
> Doc mestre que vence: `docs/PLANO_FASE_1.md`. Este documento NÃO o substitui — propõe um novo mini-sprint que deveria entrar como **MS-16 (Command Box Engenharia)**.

---

## 0 — Conclusão executiva (1 página)

O Command Box Engenharia **não é um app novo**. É uma **camada de produto** que falta no P1 Fast, mas que pode ser construída em cima de **70% de infra já pronta** em Swift e Postgres. O grande trabalho não é técnico — é organizar o que já existe num modelo coerente, fechar três gaps específicos, e construir as duas telas que faltam.

**O que já existe e serve direto:**

| Capacidade | Onde está | Status |
|---|---|---|
| Captura IMU 100 Hz + GPS 1 Hz (iPhone real, hardware-validada) | `ios/p1fast-ios/Sources/Telemetry/LiveTelemetryRecorder.swift` | ✅ MS-2 em prod |
| Parser CAN T4000 (5 pacotes, checksum 0x91 matematicamente validado) | `src/telemetry/t4000-packet-parser.js` + `windows/cockpit/.../T4000PacketParser.cs` | ✅ código pronto · ❌ captura real do barramento pendente (MS-9.1) |
| Detector ao vivo (laps, parciais, trechos, apex real, Vmin georef) | `ios/p1fast-core/Sources/P1FastCore/Detector.swift` (fonte da verdade, ADR-025) | ✅ |
| Snapshot canônico (engine + position + dynamics + vehicle + quality consolidada) | `Snapshot.swift` (Swift) e `src/telemetry/snapshot.js` (JS) | ✅ Swift · ✅ JS |
| Motor determinístico de alertas (pressão óleo, temp água, λ pobre sob carga, bateria) | `CriticalRules.swift` + `src/pipeline/critical-rules.js` | ✅ ADR-008 |
| Cross-validation V-001..V-011 (CAN×GNSS, RPM×marcha×vel, TPS×MAP, λ sob carga, alternador) | `CrossValidation.swift` | ✅ port completo |
| Classificador de erros 16 rótulos (incluindo 5 sub-classes de apex) | `ErrorClassifier.swift` | ✅ |
| Pedagogia (`P1Coach` lições + `CoachPhrases` 36 frases) | `P1Coach.swift` + `Lesson.swift` | ✅ |
| Endpoint Claude `/api/advisor` + `/api/post-stint` + `/api/post-event` | `api/advisor.js`, `api/post-stint.js` | ✅ |
| Persistência `AdvisorSuggestion` com decisão (aprovada/editada/rejeitada) | `src/domain/advisor-suggestion.js` | 🟡 web-legado (Dexie + syncQueue sem drainer) |
| Schema Supabase (sessões, voltas, segment_executions com Vmin georef, telemetry_samples_enriched com Kalman) | `supabase/migrations/0001..0019` | ✅ aplicado em prod |
| Doutrina escrita (matriz engenheiro/mecânico/piloto, regras de apex, cross-validation, data quality) | `docs/domain/` + `docs/telemetry/` | ✅ |

**Os três gaps reais:**

1. **TelemetryTimebase em Swift não existe** — só JS. O Snapshot canônico em Swift é construído manualmente a partir de `SourcePacket`s; não há o ingester multi-fonte com freshness/jitter/latência por canal que existe no JS (`src/telemetry/timebase.js`). Sem isso, a pista crítica "estado consolidado do carro a 10 Hz alimentando análises em paralelo" só roda no iPhone via construção pontual.
2. **Não existe Vehicle Context Model agregado** — o Snapshot é por-instante. Não há um agregador que mantenha "neste stint, no setor 2 de Brasília, o λ vem subindo 0.04 em 3 voltas, junto com IAT subindo 8°C, e Vmin caindo 1.1 km/h por volta". As ferramentas para construir isso existem (Score, Benchmark, Repeatability, AttackPriority, BaselineVectors, FaseCurva, Corredor, Detector com Vmin georef), mas nada consolida tudo num "estado contextual evolutivo do carro".
3. **Não existe persistência de "achados de engenharia" no schema Supabase** — só `AdvisorSuggestion` em Dexie (legado web). Sem isso, recomendações da camada de calibração não têm onde viver, e o feedback loop "engenheiro aceitou/editou/rejeitou" não atravessa dispositivos.

**O que falta de UI:**

- **Não existe nenhuma tela voltada ao engenheiro de pista** em nenhum lugar. Hub iOS tem Home/Eventos/Garagem/Pendências/PosStint (foco piloto/operação). Cockpit Windows é tela do piloto. O Command Box (TV 32") é uma janela do app na nuvem aberta no navegador do Fire TV Stick 4K Max _(atualizado 16/06/2026 — ver `docs/ARQUITETURA_DEFINITIVA.md`)_. O "lado direito" do Command Box que o Flávio descreveu **não existe** como produto.

---

## 1 — Como entram os dados no sistema (verificado)

### 1.1 Telemetria do carro (IMU + GPS)

**Captura**: `LiveTelemetryRecorder.swift:1-280` (iOS Swift nativo).
- `CMMotionManager.startDeviceMotionUpdates(using: .xMagneticNorthZVertical, to: queue, withHandler:)` a **100 Hz** (`deviceMotionUpdateInterval = 1/100`).
- `CLLocationManager` com `desiredAccuracy = kCLLocationAccuracyBestForNavigation` a **1 Hz** efetivo em movimento (validado em campo 2026-05-06, 7446 s na rua: 4 janelas medidas 100.9/105.6/93.7/101.5 Hz IMU e 0.94/1.01 Hz GPS em movimento).
- `Sample.swift:26-85` é a shape canônica (`t` epoch, `tMono` monotônico ADR-015, `source`, `signalQuality`, campos opcionais por fonte).

**Enriquecimento Kalman INS-GPS**: `KalmanINSGPS.swift` (610 linhas) + `LiveKalmanProcessor.swift`.
- Fusão 100 Hz IMU + 1 Hz GPS → estado 2D em frame local + heading compass + posSigma.
- Joseph form para preservar PSD em runs longos (#106).
- Gap recovery: reset de covariância se Δt > 5 s, com `gap_duration_ms` exposto no `EnrichedSample` e persistido em `telemetry_samples_enriched.gap_duration_ms` (migration 0010, em prod).

**Persistência local (iPhone)**: GRDB SQLite.
- `telemetry_samples` — raw 100 Hz por sample, **append-only** (ADR-014).
- `telemetry_samples_enriched` — Kalman output (`x_m`, `y_m`, `vx_mps`, `vy_mps`, `heading_deg`, `pos_sigma_m`, `source_kalman` flag, `gap_duration_ms`), **append-only**.

**Publish ao vivo (planejado)**: MS-2.8 — cabo USB primário (TCP `127.0.0.1:5050` via `iproxy`/`usbmuxd`, 5-15 ms) + Supabase Realtime fallback. Cabo agregado a 10 Hz (`{ tMono, x, y, accLong, accLat, speedKmh, heading, gapDurationMs }`). Heartbeat 1 Hz para healthcheck. **Não implementado ainda** (gate aberto até MS-9 fechar driver T4000 no Windows).

### 1.2 ECU (Injepro T4000)

**Spec do frame CAN**: `docs/hardware/T4000_CAN_SPEC.md` (264 linhas).
- CAN ID `0x7FB`, 1 Mbit/s, 5 pacotes × 8 bytes, big-endian uint16, intervalo 10 ms (= 20 Hz ciclo completo).
- Checksum validado matematicamente contra o exemplo do PDF (1937 mod 256 = 145 = 0x91).
- **3 dúvidas residuais** documentadas + diretriz "captura real do barramento resolve" (Flávio 2026-05-10).

**Parser**: `src/telemetry/t4000-packet-parser.js:1-247` (JS) e `windows/cockpit/P1Fast.Cockpit.Domain/T4000PacketParser.cs` (C#). Stateful feeder com ressync por sentinelas `0x1E 0xFC` (pacote 4) + `0xFB 0xFA` (pacote 5). Fixture canônica do PDF embutida (`T4000_PDF_FIXTURE`).

**Canais que a T4000 fornece** (confirmado, `T4000_CAN_SPEC.md:51-91`):

| Pacote | Canal | Unidade | Range esperado |
|---|---|---|---|
| 1 | RPM | rpm | 0..8000 (Celta 1.4) |
| 1 | Velocidade CAN | km/h | 0..280 |
| 1 | Pressão óleo | bar | 0..10 |
| 1 | Temp óleo | °C | 0..150 |
| 2 | Temp água | °C | 0..120 |
| 2 | Pressão combustível | bar | 0..10 |
| 2 | Tensão bateria | V | 0..15 |
| 2 | TPS | % | 0..100 |
| 3 | MAP | bar | -1.00 a +6.00 (turbo possível) |
| 3 | Temp ar (IAT) | °C | -20..100 |
| 3 | EGT | °C | 0..1500 (a confirmar máx) |
| 3 | Lambda | adimensional | 0.50..1.50 |
| 4 | Temp combustível | °C | 0..100 |
| 4 | Marcha | enum | 0..6 (0=N a confirmar) |
| 4 | Erro ECU | bitfield uint16 | bits |

**Canais que a T4000 NÃO fornece** (Regra 4 das `TELEMETRY_ENGINEERING_RULES.md`, `T4000_CAN_SPEC.md:121-138`):
- GPS / posição / acelerômetro / giroscópio / yaw rate
- Apex / trajetória / ponto de frenagem real
- Ângulo de volante / pressão de freio / força no pedal
- Temperatura real de pneu / pressão real de pneu / curso de suspensão / carga aerodinâmica

**Tudo isso vem do iPhone IMU + GPS via Kalman, ou de sensores externos não-instalados ainda.**

**Driver no Windows (estado real)**: `windows/cockpit/P1Fast.Cockpit.T4000Capture/Program.cs` existe como utilitário standalone; o `T4000Provider.cs` está pronto para receber pacotes mas **o reader USB CDC-ACM concreto ainda não foi escrito** (MS-9.3 do plano). Driver depende de Flávio fazer a captura real (MS-9.1).

### 1.3 Sensores externos / EMU

**Não existem na realidade do sistema hoje.** A spec menciona como categoria opcional, mas:
- Sem entrada para pressão de freio
- Sem ângulo de volante
- Sem temperatura de câmbio
- Sem pirômetro infravermelho de pneu em runtime (pirômetro 4 pontos é **manual**, preenchido pelo mecânico no `StintEnvironment` após o stint).

Qualquer recomendação do Command Box Engenharia que dependa de **um desses** canais precisa ou esperar instalação física, ou ser derivada por inferência IMU+GPS (com confidence reduzida).

### 1.4 Contexto de pista

**Modelado em 3 camadas no schema**:
- `tracks` (global, ex.: Brasília UUID `e8335412-…`, seed em migration 0012) com `geo_ancoras` JSON (`migrations/0009`).
- `track_layouts` (1:N por track, com `parciais` JSON, `svg_path`, `linha_chegada` JSON, `view_box` JSON).
- `track_segments` (1:N por layout, com `parcial_id`, `ordem`, `eh_trecho` bool, `geometria` JSON).

Mais:
- `marcos` (largada/chegada/pit-in/pit-out/sinalizacao/box).
- `retas_especiais` (ADR-019, tabela separada com `tempo_medio_ms`, `auto_detectada`, `time_id` nullable para global vs por-time).

**No domínio Swift**: `Track.swift:1-302` traz `TrackBundle` (Track + TrackLayout + segments hidratados de GRDB), com 4 pontos canônicos por segment (entry / braking / apex / exit) e classificação de apex.

**O que NÃO existe**: altitude/desnível por trecho, temperatura ambiente ao vivo (pista/ar), pressão atmosférica, densidade do ar. Tudo isso é **assumido cadastrado manualmente** em `StintEnvironment` (parcial — ver §1.5).

### 1.5 Stint environment + mapa atual

**`stint-env.js`** (77 linhas) é a entidade web-legada que carrega: pressões dianteira/traseira, pirômetro 4 pontos por eixo, composto, temp pista, temp ar, desgaste 0..3. **Não tem espelho Swift nem tabela Supabase própria** — campos individuais foram entrando em `sessoes` conforme demanda (`pneu_id`, `combustivel_id`, `qt_combustivel_litros` na migration 0006).

**Mapa atual da ECU**: nenhuma representação. O sistema **não lê** o mapa de injeção/ignição da T4000 — só os canais ao vivo. Para comparar "mapa atual × comportamento real" o engenheiro hoje precisa abrir o Injepro T Software à parte. **Esse é um gap de produto**, não de software disponível.

---

## 2 — Pipeline de IA já existente (auditado)

### 2.1 Camada determinística (Regra ADR-008: nada de IA em segurança)

**Já portada para Swift e em uso no iPhone real** (`CriticalRules.swift`, mas atenção — não vi grep confirmando que está plugada no `LiveTelemetryRecorder` em produção, ver §3 gaps):

| Regra | Disparo | Estado |
|---|---|---|
| Pressão óleo < 1.0 bar com RPM > 1000 | BOX_AGORA | precisa Quality.OK no canal T4000 |
| Temp água > 100/105/115 °C | ATENCAO/CRITICO/BOX_AGORA | dinâmico |
| Temp freio > 650 °C | CRITICO | canal não-instalado, dorme |
| Lambda > 1.0 sob carga (TPS>70, MAP>0.8, RPM>4000) por > 1/5 s | ATENCAO/CRITICO | dinâmico |
| Bateria < 10.5/11.5 V com RPM > 1500 | ATENCAO/CRITICO | dinâmico |
| `sync_quality` MISSING/LATE | ATENCAO/INFORMATIVO | infra |
| Manual: bandeira-vermelha/amarela, pista-molhada | BOX_AGORA/ATENCAO | botão |

**Cross-validation V-001..V-011** (`CrossValidation.swift`, 475 linhas):
- V-001: speed CAN vs GNSS (clutch slip / sensor)
- V-003: TPS vs MAP coerência
- V-004: RPM × marcha × velocidade (sanity de marcha)
- V-005: drift de temp água em 5 min
- V-006: pressão óleo por janela de RPM
- V-007: λ pobre sob carga
- V-008: tensão bateria sob carga (alternador)
- V-011: consistência de posição GPS

Cada evento tem `severity`, `message`, `channels`, `hypothesis`, `action`, `confianca` — exatamente o shape que o brief pede para uma recomendação de engenharia.

### 2.2 Camada de IA generativa

**Endpoints Claude**:
- `/api/advisor.js` — recebe `stint+env+objetivo+contexto`, retorna JSON estrito `{sugestao, racional, prioridade, ajustes[], nao_mexer[], como_validar, confianca, confianca_texto, evidencias}`. Modelo configurado: `claude-opus-4-7`.
- `/api/post-stint.js` — narrativa pós-stint com 5 listas (`funcionou`, `nao_funcionou`, `tentar`, `nao_mexer`, `destaque`).
- `/api/post-event.js` — pós-evento (não auditei profundamente, mesma família).

**System prompt do `advisor.js`** já documenta a governança correta:
> "Setup nunca é recomendado antes de excluir erro de pilotagem. Excluir nesta ordem: pilotagem → pneu → tráfego → degradação mecânica não-setup → só então setup."
> "Curva é avaliada pela sequência: entrada → frenagem → turn-in → apex → retomada → saída → reta seguinte. Nunca só por velocidade de entrada."

**Persistência de decisão**: `AdvisorSuggestion` em Dexie (`src/domain/advisor-suggestion.js`) com lifecycle `pendente/aprovada/editada/rejeitada` e `approvalRate()` para feedback loop. **Web-legado, não há porte Swift nem tabela Supabase.**

### 2.3 Pedagogia (P1 Coach)

`P1Coach.swift` (315 linhas) + `Lesson.swift` (425) implementam:
- 12 lições ativas + 5 dormentes (sem sensores).
- Seleção por `cornerType` + `focusPhase` + `canActivate(signals)` + `confidence`.
- Frases pedagógicas 36 códigos (`CoachPhrases.swift`).
- 1 lição por curva (regra de fluxo SPEC §23.3).
- `pause()` quando alerta crítico ativo (não compete com determinismo).

**Foco P1 Coach é piloto**, não engenheiro. Mas a infraestrutura de "selecionar lição apropriada baseada em sinais disponíveis" pode ser reaproveitada para **selecionar hipótese de calibração apropriada baseada em snapshots agregados** (ver §5).

---

## 3 — Gaps reais para o Command Box Engenharia

Tudo numerado para rastreio. Cada item indica se é **infra**, **domínio**, **persistência**, **UI** ou **doutrina**.

### G1 — TelemetryTimebase em Swift `[infra]`

`src/telemetry/timebase.js` (304 linhas) é o ingester multi-fonte que produz Snapshots a 10 Hz, com freshness/latência/jitter por canal e categoria Quality canônica. **Não tem porte Swift.** Hoje no iPhone:
- `LiveKalmanProcessor` constrói `EnrichedSample` direto do recorder, sem timebase.
- `SnapshotBuilder.build(tMono:sourcesData:)` em Swift existe como função pura, mas precisa que alguém preencha `sourcesData` — não há quem o faça em loop a 10 Hz no app real.

**Consequência**: `CriticalRulesEngine.consume(snap)` e `CrossValidationEngine.consume(...)` no Swift estão escritos mas **não recebem snapshots em produção**. Eles são consumidos por testes. Reuso = grande, integração = zero.

### G2 — Vehicle Context Model agregado `[domínio]`

Não existe. O Snapshot é por-instante; precisa-se de uma camada que mantenha "estado contextual evolutivo do carro" agregando ao longo de:
- volta (janela rolling 1 lap)
- stint (janela rolling N voltas)
- trecho × volta (Vmin/velEntrada/velSaida/apex actual)
- célula RPM×MAP (histograma de λ, EGT, accel observados)
- fase térmica (frio / aquecendo / pico / resfriando — derivado de água+óleo+IAT)

**Os ingredientes existem em Swift**: `Score.swift`, `Benchmark.swift` (puro), `Repeatability.swift` (puro), `AttackPriority.swift`, `BaselineVectors.swift`, `FaseCurva.swift`, `Corredor.swift`, `Detector.swift` (com Vmin georef em `apexActual.x/y`). **Falta o agregador que consolida tudo num único `VehicleContext`** consumível por análise.

### G3 — Calibration Hypothesis Engine `[domínio]`

A camada 2 do brief (engenharia codificada → hipóteses de calibração) **não existe**. O salto do sistema atual é direto: snapshot ao vivo → Claude generativo. O brief exige uma camada determinística no meio que faça `SE λ acima do alvo + TPS>85 + caiu accel longitudinal + repetido em ≥3 voltas → propor +X% combustível na célula (RPM Y..Z, MAP W)`.

**O que pode ser reaproveitado**: `CrossValidation` já tem o shape `{severity, hypothesis, action, channels, confianca}`. A `Lesson` schema já tem `requiredSignals`, `applicableCornerTypes`, `phaseWeights`, `preferredMessageCodes`. **Falta o equivalente para "calibração mecânica"** — uma `CalibrationRule` com `aplicaQuando`, `evidencia`, `hipotese`, `ajusteSugerido`, `risco`, `confianca`, `comoValidar`.

### G4 — Persistência Supabase de achados de engenharia `[persistência]`

`AdvisorSuggestion` é Dexie-only e ADR-009 diz "syncQueue não dreina até Fase 20". Para o Command Box Engenharia atravessar dispositivos (celular do engenheiro × notebook Windows × Command Box TV 32" via Fire TV Stick 4K Max), preciso de **tabela Supabase com RLS por time**. Não existe. _(atualizado 16/06/2026 — ver `docs/ARQUITETURA_DEFINITIVA.md`)_

Proposta de tabelas novas (NÃO criadas — só desenho):
- `engineering_findings` — cada finding (id, time_id, sessao_id, volta_id?, segment_id?, tipo enum, severidade enum, payload jsonb, evidencias jsonb, t timestamp, tmono).
- `engineering_recommendations` — recomendações com `finding_id`, `payload jsonb` (sugestao, racional, prioridade, ajustes[], nao_mexer[], como_validar, confianca, confianca_texto), `decisao enum`, `decisao_em`, `decisao_por`, `payload_editado jsonb`, `meta jsonb`.
- `engine_cells` — histograma agregado por (carro_id, sessao_id?, rpm_bin, map_bin) com counts + médias de λ, EGT, accel_long. **Opcional** — só se a análise de mapa for prioridade.

### G5 — Mapa atual da ECU `[doutrina + integração]`

O sistema **não tem acesso ao mapa de injeção/ignição da T4000**. Sem isso, recomendações como "+4% combustível na célula RPM 5200-6000, MAP 0.95" são abstratas. Para fechar o loop preciso ou:
- (a) Engenheiro exportar mapa via Injepro T Software e fazer upload (CSV ou foto) — Command Box Engenharia visualiza e ancora recomendações em células.
- (b) Long-term: pedir à Injepro spec de leitura/escrita do mapa via USB — fora do MVP.

**Decisão do Flávio**: qual caminho?

### G6 — UI engenheiro `[UI]`

**Nada existe.** Decisões em aberto:
- **Onde renderiza?** iOS hub (tab "Engenharia" ao lado de "Piloto")? Windows notebook em display 1 (enquanto display 2 mostra cockpit do piloto)? Command Box (TV 32" via Fire TV Stick 4K Max abrindo o app na nuvem no navegador) separado do piloto? Web? Cada uma tem implicação de stack. _(atualizado 16/06/2026 — ver `docs/ARQUITETURA_DEFINITIVA.md`)_
- **Quando é "live" e quando é "post"?** Recomendações ao vivo (alertas críticos + λ pobre detectado já) × recomendações pós-stint (análise consolidada com IA generativa).

### G7 — Sensores externos não-instalados `[hardware]`

Pressão de freio, ângulo de volante, temp câmbio, pirômetros de pneu em runtime: zero entrada. Toda recomendação que dependa **especificamente** desses canais fica dormente até instalação, igual ao `temp-freio-extrema` em `CriticalRules`. **Não é gap de software** — é restrição realista de hardware do Celta 1.4.

### G8 — Doutrina referenciada em código tem path stale `[doutrina]`

Vários comentários no código (`critical-rules.js`, `cross-validation.js`, `data-quality.js`) referenciam `docs/raceops/` mas os documentos vivem em `docs/telemetry/` e `docs/domain/`. Funcionalmente os docs existem; é só uma poluição de referência. **Trivial de consertar.**

---

## 4 — Modelo contextual proposto (Vehicle Context Model)

A peça central da arquitetura é um **VehicleContext** mantido em memória no consumidor (notebook Windows e/ou iPhone), atualizado a cada Snapshot, e periodicamente checkpointed para Supabase para audit/replay/feedback.

### 4.1 Shape conceitual

```
VehicleContext (instante T, refrescado a cada Snapshot 10 Hz)
├─ instant: Snapshot                      # já existe — Snapshot.swift
├─ lap: LapWindow                          # rolling 1 volta corrente
│   ├─ rpmHistogram, mapHistogram, lambdaSamples[]
│   ├─ tempEvolution { water, oil, fuel, iat, egt } (Δ por minuto)
│   ├─ accelEnvelope { long_min, long_max, lat_min, lat_max }
│   └─ ecuErrorFlags accumulated
├─ stint: StintWindow                      # rolling N voltas
│   ├─ lapTimes[], bestLap, avgLap, repeatability
│   ├─ thermalPhase: enum { COLD, WARMING, AT_TEMP, OVERHEAT, COOLING }
│   ├─ degradationHints { lapTimeDrift, vminDriftPerLap, lambdaDrift }
│   └─ activeFindings: EngineeringFinding[]
├─ segment: SegmentExecutionEvent          # já existe — Detector.swift
│   ├─ velEntrada, velMinima (Vmin), velSaida
│   ├─ apexActual (x,y) — Detector preenche
│   ├─ classification: ErroTipo            # ErrorClassifier.swift
│   └─ evidence per phase (entrada/frenagem/turn-in/apex/retomada/saída)
├─ cells: { (rpmBin, mapBin) → CellAggregate }  # histograma da sessão
│   ├─ samples count
│   ├─ lambda mean, p50, p90
│   ├─ accel_long mean (proxy de torque relativo)
│   ├─ temp_water mean
│   └─ flagged: bool (se algum critério disparou)
├─ track: TrackContext (estático + parcialmente live)
│   ├─ trackId, layoutId, segmentsById
│   ├─ ambient { tempPista?, tempAr?, pressaoAtm?, densidadeAr? }
│   └─ specialSegments (subida, descida, reta longa) ← derivar de svg_path
├─ quality: QualityState (já existe em Snapshot.quality)
└─ pilotState: PilotProfile (já existe via PilotReaction)
    ├─ reactionTime medio (por marcha × trecho)
    └─ consistency score
```

### 4.2 Mapeamento concreto código → modelo

| Campo do VehicleContext | Quem alimenta hoje | Onde |
|---|---|---|
| `instant` | `SnapshotBuilder` em Swift (consume `SourcePacket` map) | `Snapshot.swift:121-217` |
| `lap.histograms` | **NOVO** — pequeno agregador rolling window | falta criar |
| `lap.tempEvolution` | parcialmente — `V-005` detecta drift de temp | `CrossValidation.swift` |
| `stint.lapTimes` | `Detector.swift` emite `DetectorLapEvent.tempoMs` | OK |
| `stint.repeatability` | `Repeatability.swift` (mas não conectado ao stream) | OK como módulo, falta wiring |
| `stint.thermalPhase` | **NOVO** state machine simples | falta criar |
| `stint.degradationHints` | parcialmente — `BaselineVectors` mantém referências | parcial |
| `segment.*` | `Detector` + `ErrorClassifier` (já portados) | OK |
| `cells` | **NOVO** — não existe nenhum agregador RPM×MAP | falta criar |
| `track.ambient` | manual hoje via `StintEnvironment` web | precisa porte iOS |
| `quality` | OK | OK |
| `pilotState` | `PilotReaction.swift` (já portada) | OK |

**Conclusão de modelagem**: dos 9 ramos do VehicleContext, **6 ramos têm peça pronta para reusar**; **3 ramos precisam de código novo** (histograma rolling de canais T4000, state machine de fase térmica, agregador de células RPM×MAP). Trabalho de domínio puro, sem dependência de UI.

---

## 5 — Arquitetura proposta (compatível com a realidade)

### 5.1 Três camadas (espelhando o brief)

**Camada 1 — Engine Core (determinística, sem IA)**

Tudo já existe em Swift, falta apenas integração:

```
Inputs:
  - T4000Provider (Windows) → publica via Realtime canal live-stint-{id}
  - LiveTelemetryRecorder (iPhone) → IMU 100 Hz + GPS 1 Hz
  - LiveKalmanProcessor (iPhone) → enriched 10 Hz
  - Manual: StintEnvironment (pirômetro, pressões, temp ambiente)

TelemetryTimebase (porte Swift novo)  ← G1
       │
       ▼
SnapshotBuilder (já em Swift)
       │
       ▼
┌──────────────────────────────────────┐
│ CriticalRulesEngine  CrossValidationEngine │
│   (determinístico)     (V-001..V-011)      │
└──────────────────────────────────────┘
       │                       │
       ▼                       ▼
   Alerts                  ValidationEvents
       │                       │
       └───────────────┬───────┘
                       ▼
         VehicleContextAggregator  ← NOVO (G2)
         (mantém lap/stint/segment/cells/thermal)
```

**Camada 2 — Calibration Engine (engenharia codificada, sem IA)**

Novo. Catálogo de `CalibrationRule` no padrão de `CRITICAL_RULES`:

```swift
public struct CalibrationRule {
  let id: String                      // "fuel-lean-sustained-load"
  let scope: Scope                    // .cell(rpmBin, mapBin) | .stint | .segment
  let requiredSignals: Set<Signal>    // [rpm, map, lambda, accLong]
  let minSamples: Int                 // ex: 30 amostras na célula
  let minConsecutiveLaps: Int         // ex: 3 voltas
  let aplicaQuando: (VehicleContext) -> Bool
  let gerarHipotese: (VehicleContext) -> CalibrationHypothesis
}

public struct CalibrationHypothesis {
  let titulo: String                          // "+4% combustível RPM 5200-6000"
  let evidencia: [Evidencia]                  // já existe em ErrorClassifier
  let prioridade: String                      // trecho/célula
  let ajustes: [Ajuste]                       // [{campo, de, para, motivo, risco}]
  let naoMexer: [String]
  let comoValidar: String
  let confianca: ConfiancaTier                // alta / média / baixa
  let risco: RiscoTier                        // baixo / médio / alto
}
```

Catálogo mínimo proposto (cada um vira UMA `CalibrationRule`, com fixture de teste):

| ID | Quando dispara | Hipótese | Risco |
|---|---|---|---|
| `fuel-lean-sustained-load` | λ > 1.0 sob TPS>70 + MAP>0.8 + RPM>4000 sustentado ≥3 voltas em mesma célula | +X% combustível na célula (X dependendo da magnitude do desvio) | médio (detonação se atrasar muito) |
| `fuel-rich-light-load` | λ < 0.80 sob TPS<30 + MAP<0.5 (idle/cruise) sustentado | -Y% combustível na célula leve | baixo |
| `iat-creep-power-loss` | IAT subiu > 15°C em ≥2 voltas + accel_long_max caindo > 0.3 m/s² na mesma célula RPM | revisar admissão (filtro, intercooler) / aceitar penalidade térmica | baixo |
| `water-temp-drift-no-cooling` | V-005 drift sustentado > 3°C/min + RPM normal + sem padrão de carga | revisar ventoinha / radiador / bomba | médio |
| `oil-press-low-at-rpm` | Já é CRÍTICO via `CriticalRules`. Hipótese de engenharia secundária: viscosidade inadequada ou desgaste em bomba | revisar viscosidade do óleo / inspeção mecânica | alto |
| `fuel-press-drop-load` | `engine.fuel_pressure` cai > 0.5 bar quando TPS>80 | revisar bomba/filtro/válvula reguladora | médio |
| `lambda-vs-target-deviation` | (Se mapa carregado, G5) λ_real vs λ_alvo divergente em ≥X% das amostras da célula | revisar mapa de combustível especificamente na célula | médio |
| `vmin-progressive-loss-segment` | Vmin de um trecho cai progressivamente > 1 km/h por volta em ≥3 voltas, com IAT subindo | hipótese térmica + revisar pneu (composto) | baixo |
| `ignition-conservative-suspect` | Accel_long_max numa célula muito abaixo do esperado pela curva dyno (se carregada) + λ próximo do alvo + temp normal | hipótese: ignição conservadora — pedir mapa pra avaliar avanço | médio |
| `gear-fora-faixa-eficiente` | RPM passa > 30% do tempo de um trecho fora da janela eficiente da `dyno_curve` (já modelada em `DynoTargetCalculator.swift`) | revisar relação ou troca | baixo |

Cada uma escreve um `EngineeringFinding` em memória, e quando `confianca` ≥ threshold + cooldown OK, gera uma `EngineeringRecommendation` persistível.

**Camada 3 — Senior Advisor (IA contextual)**

Reaproveita `/api/advisor.js` e `/api/post-stint.js`, mas com **payload enriquecido** pelo VehicleContext + lista de findings da camada 2. Em vez de mandar pra Claude um stint cru, manda:

```json
{
  "vehicleContext": { ... },
  "findings": [
    { "id": "fuel-lean-sustained-load",
      "evidencia": [...],
      "hipotese_codificada": "+4% combustível na célula RPM 5200-6000, MAP 0.95",
      "confianca": "Alta" }
  ],
  "stint": { lapTimes, attackTrechos, ... },     // já manda hoje
  "env": { pirômetro, pressão, composto, ... },  // já manda hoje
  "objetivo": "..." 
}
```

O system prompt já mantém a governança correta. Adicionar instrução: **"As findings codificadas são hipóteses pré-validadas pela camada determinística. Sua tarefa é (a) priorizar, (b) explicar para o engenheiro, (c) sugerir como validar, (d) detectar conflito entre findings, (e) reduzir confiança se evidência for fraca. NÃO contradizer findings determinísticos sem motivo explícito."**

ADR-008 continua valendo: **alertas críticos NÃO passam pela IA**.

### 5.2 Onde cada camada roda — arquitetura de superfície revisada 2026-05-13

**Decisão Flávio 2026-05-13 (D2 + clarificação):** existem **duas telas físicas de saída simultâneas**, ambas mostrando informação ao mesmo tempo; **toda a operação é feita pelos iPhones** (o notebook **não é operado** — é só display + processador).

| Tela | Conteúdo | Driver |
|---|---|---|
| **Command Box** (TV 32") | Vista do engenheiro + chefe-de-equipe: live, findings, recommendations, simulações | App na nuvem aberto no navegador do Fire TV Stick 4K Max na TV 32" _(atualizado 16/06/2026 — ver `docs/ARQUITETURA_DEFINITIVA.md`; substitui a cadeia iPhone Box Mode → AirPlay → Apple TV de MS-12)_ |
| **Cockpit Pilot** (10,5" externa invertida no painel) | Conteúdo **dirigido pela atividade da engenharia**: quando engenharia inativa = cockpit canônico (mockup `mockup-cockpit-piloto.html`); quando engenharia ativada = informações que **a engenharia decide que são importantes** para quem estiver no carro **naquele momento** (piloto na pista, ou mecânico sentado no carro durante diagnóstico no box) | Notebook Windows WinUI 3 → display 2 invertido (já em produção via MS-13) |

**Clarificação Flávio 2026-05-13 (segunda):** o Cockpit Pilot 10,5" **não é fixo** no cockpit canônico. O que ele mostra depende de **dois eixos**:
- **Estado da engenharia**: inativa (stint normal) × ativada ("contexto de corrida" — engenheiro está analisando, simulando, propondo)
- **Quem está no carro**: piloto (mãos no volante) × mecânico (sentado no carro, motor parado ou em diagnóstico de box)

Quem decide **o que** aparece em cada combinação é a engenharia (canal `engineering-{stintId}` empurra o conteúdo). A 10,5" no painel é o **canal de retorno do Command Box pra dentro do carro** — não importa se quem está lá é piloto ou mecânico naquele momento.

**Operação:**

| Surface de entrada | Quem usa | O que controla |
|---|---|---|
| **Command Box** (TV 32" via Fire TV Stick 4K Max) + celular do box | Engenheiro / chefe-de-equipe | A TV 32" abre a sessão Tab Engenharia do app na nuvem no navegador do Fire TV Stick 4K Max; a operação (controles táteis — sliders, knobs — que editam parâmetros + disparam simulações; aprovar/editar/rejeitar findings) é feita no celular acessando o mesmo app na nuvem _(atualizado 16/06/2026 — ver `docs/ARQUITETURA_DEFINITIVA.md`)_ |
| **iPhone do time fora do Box Mode** (iOS hub) | Engenheiro / chefe-de-equipe / mecânico / **piloto** (cada um no SEU celular) | Tab Engenharia: cada papel pode **editar configurações** e **rodar simulações** com sliders + knobs (botões giratórios) no próprio iPhone. Histórico cross-stint, decisões offline (sincronizam por Realtime). |
| **iPhone do carro** | Piloto (mãos ocupadas durante stint) | Roda `LiveTelemetryRecorder` (captura IMU/GPS). Entre stints OU quando aceitar (ex.: passageiro/piloto reserva conferindo no box), opera Tab Engenharia normalmente. |
| **Notebook Windows** | Ninguém (kiosk) | Apenas roda o Cockpit Pilot em display 2 + processa T4000 + publica Realtime |

**Operação distribuída**: chefe-de-equipe, engenheiro e piloto podem trabalhar **em paralelo, cada um no seu celular**, editando configurações e rodando simulações via controles táteis (sliders lineares para %, knobs rotativos para varreduras de célula, dials para alvo RPM/marcha). Todos publicam no canal `engineering-{stintId}` — quem está na TV 32" e no Cockpit Pilot 10,5" vê os efeitos em tempo real. **Inclusive com carro andando** — simulação não fica restrita a carro parado; é projeção visual (Camada 2 determinística), não aplica mudança real no mapa.

**Tabela final de camadas × superfície:**

| Camada | Onde roda | Onde aparece |
|---|---|---|
| Engine Core (Timebase + Snapshot + CriticalRules + CrossValidation + VehicleContext) | iPhone do carro (IMU/GPS) + notebook Windows (T4000) | Não tem UI direta — alimenta as duas telas |
| Calibration Engine | Notebook Windows (consumidor que cruza T4000 + IMU/GPS) e/ou Edge Function Supabase (cobertura sem notebook) | Findings/recommendations vão pra Realtime, consumidos por Box Cockpit (32") e por iOS hub |
| Senior Advisor IA | Vercel Serverless (`/api/advisor`, `/api/post-stint`) | Mesma rota: findings enriquecidos chegam pelo Realtime |
| **Command Box Engenharia (live + post)** | App na nuvem | Renderiza na TV 32" pelo navegador do Fire TV Stick 4K Max _(atualizado 16/06/2026 — ver `docs/ARQUITETURA_DEFINITIVA.md`)_ |
| **Cockpit Pilot + modo simulação** | Notebook WinUI 3 | Renderiza no 10,5" invertido (mesmo MS-13 existente, ganha layer de simulação) |
| iOS hub Tab Engenharia (pós-stint mobile) | iPhones do time | iPhone/iPad nas mãos do engenheiro entre stints |
| Histórico / replay | Supabase + Edge Function `/functions/v1/detector` | Cross-stint, cross-evento |

**Implicação prática**: o esforço de UI nova para o Engenharia fica no **app na nuvem** (Tab Engenharia, acessada pelo celular e pela TV 32" do Command Box via navegador do Fire TV Stick 4K Max) _(atualizado 16/06/2026 — ver `docs/ARQUITETURA_DEFINITIVA.md`)_. O Cockpit Pilot existente recebe apenas um **modo simulação adicional** (overlay/painel sincronizado por Realtime quando carro parado). **Nada de janela nova no Windows.** Notebook fica intocado como produto.

### 5.3 Persistência (gap G4)

Proposta de **3 migrations novas** (SQL detalhado fica para PR de implementação, NÃO criar agora):

```
0020_engineering_findings.sql
  - findings (id uuid, time_id, sessao_id, volta_id?, segment_id?, tipo enum, severidade enum,
              payload jsonb, evidencias jsonb, t bigint, t_mono double, criado_em)
  - RLS por time
  - Append-only (insert-only policy, igual telemetry_samples)

0021_engineering_recommendations.sql
  - recommendations (id uuid, time_id, sessao_id, finding_ids uuid[], payload jsonb,
                     decisao enum 'pendente'|'aprovada'|'editada'|'rejeitada',
                     decisao_em, decisao_por, payload_editado jsonb, meta jsonb,
                     criado_em)
  - RLS por time, com permissão de UPDATE só de membros do time (campos decisao*)
  - mesma estrutura de AdvisorSuggestion porém em Postgres canônico

0022_engine_cells.sql (OPCIONAL — gate)
  - engine_cells (carro_id, sessao_id?, rpm_bin int, map_bin int, samples_count, 
                  lambda_mean, lambda_p50, lambda_p90, accel_long_mean, temp_water_mean,
                  flagged bool, criado_em)
  - Granularidade da bin = decisão do Flávio (proponho 250 RPM × 0.05 bar MAP)
  - Cell-level histogram pra análise de mapa
```

### 5.4 Pipeline ponta-a-ponta (proposto)

```
1) Coleta
   iPhone: LiveTelemetryRecorder → 100 Hz raw → SQLite (append-only)
   iPhone: LiveKalmanProcessor → 10 Hz enriched → SQLite
   Notebook: T4000Provider → 20 Hz raw cycles → T4000Sample{} em memória
   Manual: StintEnvironment (pirômetro, pressão, composto)

2) Sincronização temporal
   iPhone publish 10 Hz aggregated → Cabo USB (5-15ms) || Realtime (fallback)
   Notebook publish 10 Hz T4000 aggregated → Realtime canal live-stint-{id}
   Notebook subscribe iPhone canal (heartbeat 1Hz)
   TelemetryTimebase consolida em Snapshots 10 Hz

3) Segmentação
   Detector.swift no iPhone → laps + segments + apex actual + Vmin georef
   Mesmo Detector pode rodar em paralelo no notebook (sobre o stream Realtime)
   ADR-025: iPhone é fonte da verdade

4) Detecção de eventos
   CriticalRulesEngine no Snapshot → Alert (CRITICO/BOX_AGORA)
   CrossValidationEngine no Snapshot → ValidationEvent
   ErrorClassifier no SegmentEnd → ErroTipo (16 rótulos)

5) Correlação com contexto + mapa
   VehicleContextAggregator absorve Snapshot + Alert + ValidationEvent + SegmentExecution
   Atualiza lap/stint/segment/cells/thermal

6) Hipóteses determinísticas
   CalibrationEngine itera CalibrationRule × VehicleContext
   Emite EngineeringFinding (com confianca, evidencia, escopo)

7) Recomendações IA contextuais
   FindingsGate aguarda quórum (ex: ≥3 voltas + confianca ≥média)
   POST /api/advisor com payload enriquecido
   POST /api/post-stint ao final de cada stint
   Persiste EngineeringRecommendation em Supabase

8) Decisão humana
   UI Engenheiro lista findings + recommendations
   Engenheiro: aprovar / editar / rejeitar / adiar / testar em pista
   Patch UPDATE em engineering_recommendations.decisao
   Feedback loop → futura calibração de thresholds de CalibrationRule

9) Validação
   Próximo stint, mesmo carro, mesmo trecho → comparar com finding
   FindingResolutionTracker associa finding → outcome (resolveu / piorou / não-mudou)
   Métrica de "approvalRate" (já existe em AdvisorSuggestion) por tipo de rule
```

---

## 6 — MVP recomendado (3-4 sub-sprints)

Princípio: **rodar end-to-end em Tier 1 (com T4000) num único trecho de Brasília, num único stint, antes de generalizar**.

### MS-16.1 — TelemetryTimebase Swift port (1 PR)
Resolve G1. Port direto de `src/telemetry/timebase.js` para `ios/p1fast-core/Sources/P1FastCore/TelemetryTimebase.swift`. Plugado no `LiveKalmanProcessor` para emitir Snapshots a 10 Hz pelos consumidores existentes. Smoke de paridade JS↔Swift sobre fixture sintética. **Sem UI nova.**

### MS-16.2 — VehicleContextAggregator Swift (1-2 PRs)
Resolve G2 parcial. Implementa lap/stint/segment/thermal **sem células** (cells fica fora do MVP). Plugado no Snapshot stream + Detector events. Smoke de fixture canônica (sessão Brasília 2026-05-06 já temos no SQLite pull). **Sem UI nova.**

### MS-16.3 — CalibrationEngine + 3 rules + Supabase persistence (2-3 PRs)
Resolve G3 parcial + G4. Implementa o motor `CalibrationEngine` com **3 rules iniciais** (não 10):
- `fuel-lean-sustained-load`
- `water-temp-drift-no-cooling`
- `vmin-progressive-loss-segment`

Cada uma com fixture de teste sintética. Migrations `0020_engineering_findings.sql` + `0021_engineering_recommendations.sql` aplicadas em dev (Flávio aplica em prod manualmente). **Sem UI nova.** Smoke E2E: fixture → findings → recommendations persistidas via REST anon.

### MS-16.4 — Senior Advisor enrichment (1 PR)
Resolve camada 3. `/api/advisor.js` aceita campo opcional `findings[]` no payload. System prompt ganha §"Findings codificadas" explicando o contrato. Persiste decisão em `engineering_recommendations`. Smoke contra Claude API real (Flávio roda 1x manual).

### MS-16.5 — Tab Engenharia no iOS hub: pós-stint + controles táteis (3-4 PRs)
**Primeiro UI**. Tab "Engenharia" no hub iOS, **fora do Box Mode** (acesso por qualquer iPhone/iPad do time — chefe, engenheiro, mecânico, **piloto**). Lista de stints recentes → findings → recommendations com cards { sugestão, racional, evidência, ajustes, não-mexer, como-validar, confiança }.

**Controles táteis para edição e simulação** (núcleo da operação distribuída):
- **Sliders lineares** — ajustes percentuais (ex.: +X% combustível na célula), limites contínuos, snap em incrementos relevantes
- **Knobs rotativos (botões giratórios)** — varreduras de célula RPM × MAP, alvo de marcha, ângulo de avanço, threshold de regra
- **Toggles** — ativar/desativar regra; **toggle do "módulo engenharia"** (D20) que dispara o switch automático do Cockpit Pilot 10,5" (combinado com velocidade do carro — D18)

Ações sobre findings/recommendations: [Aprovar] [Editar via slider/knob] [Rejeitar] [Simular]. Todos publicam no canal Realtime `engineering-{stintId}`; outros dispositivos do time sincronizam em ~150 ms.

**Permissões (D17)**:
- **Chefe + engenheiro**: edição/simulação livre a qualquer momento (não dirigem)
- **Piloto**: edição/simulação **só quando carro parado** (`speed_fused < 5 km/h` por > 3 s). Em movimento, sliders/knobs ficam disabled na UI dele com mensagem "carro andando — operação bloqueada". Outros membros do time veem normal.
- **Mecânico**: acesso de leitura + execução de procedimentos `MECHANIC_DIAGNOSTIC` (decide D17 estendido se quiser)

Reaproveita `Components/BottomNav.swift`. Componente novo: `EngControl.swift` (slider/knob universais com animação tátil + haptic feedback + gating por papel × velocidade).

**Sem versão live nesta sprint** — toda a interação fica disponível, mas o stream live de samples a 10 Hz só chega no Box Mode (MS-16.6). Validação visual em simulator iOS.

### MS-16.6 — Command Box Engenharia: live na TV 32" (3-4 PRs)
**Segunda UI, ao vivo**. A vista Engenharia do app na nuvem é aberta no navegador do Fire TV Stick 4K Max na TV 32" _(atualizado 16/06/2026 — ver `docs/ARQUITETURA_DEFINITIVA.md`; substitui a cadeia iOS Box Mode → AirPlay → Apple TV de MS-12)_. Subscribe Supabase Realtime no canal `live-stint-{id}` para receber:
- Snapshots agregados a 10 Hz (T4000 + IMU/GPS — vindos do notebook Windows que cruza os dois fluxos)
- Stream de findings/recommendations em tempo real
- Stream de alertas determinísticos da Camada 1

Layout otimizado para 32" landscape (alta legibilidade, distância de visão 2-3 m). Operação por toque no iPhone do box (não na TV). **Não compete com cockpit do piloto** — produto totalmente separado, consumidor diferente da mesma fonte (Realtime). **Gate principal**: MS-9 (T4000 publica no Realtime) precisa estar fechado para o live ser real; sem ele, fica em mock data.

### MS-16.7 — Modo contextual no Cockpit Pilot 10,5" + switch automático (2-3 PRs)
**Aproveita o cockpit WinUI 3 existente** e adiciona uma camada de **conteúdo dirigido pela engenharia**. O 10,5" deixa de ser estritamente "vista do piloto cockpit canônico" e vira **canal de retorno do Command Box pra dentro do carro**, controlado por mensagens no canal Realtime `engineering-{stintId}`.

**Switch padrão piloto ↔ padrão engenharia = automático (D18)**. O Cockpit Pilot decide sozinho qual modo render usando duas entradas:
- **`modulo_engenharia_ativado`** — flag no estado do stint, controlado por toggle no iPhone do chefe/engenheiro (D20)
- **`vehicle.speed_fused`** — velocidade do carro, atualizada pelo stream Realtime

Regra (`cockpitModeResolver`):
```
SE !modulo_engenharia_ativado    → padrão PILOTO
SENÃO SE carro_andando            → padrão PILOTO  (auto-protect anti-distração)
SENÃO                             → padrão ENGENHARIA
```
- `carro_andando` = `speed_fused > 10 km/h` por > 2 s (debounce de saída)
- `carro_parado` = `speed_fused < 5 km/h` por > 3 s (debounce de entrada)
- Volta a andar **sempre** força padrão piloto imediatamente (sem debounce na transição out-of-engineering, segurança).

Conteúdos que o canal pode empurrar quando padrão = ENGENHARIA (catálogo inicial, expandível):
- `SIMULATION_INSTRUCTION { texto, rpmAlvo, marchaAlvo, mapaAlvo, lambdaAtual, lambdaProjetado }` — instrução de validação durante simulação. **Só renderiza com carro parado** (D17 + auto-protect)
- `MECHANIC_DIAGNOSTIC { passos[], canaisRelevantes[], estadoEsperado }` — mecânico sentado no carro em diagnóstico (ex.: "1. Pedal a 50% sustentado; 2. Aguarde RPM estável; 3. Confirme λ em 0.92 ± 0.03")
- `PILOT_FOCUS_PROMPT { trecho, foco }` — destaque pré-stint, visto pelo piloto ANTES de sair do box (carro parado, módulo ativado)
- `ALERTA_OPERACIONAL { texto, urgencia }` — comunicação fora dos alertas críticos da Camada 1

Implementação: `CockpitState` (já existente no domínio C#) ganha campo `engineeringOverlay: EngineeringOverlay?` + `cockpitMode: PILOTO | ENGENHARIA` (resolvido por `cockpitModeResolver`). Quando `engenharia` + overlay não-nulo, o renderer XAML mostra o painel. Quando `piloto`, renderização canônica do mockup — ignora overlays.

**Sem comando manual de switch** — engenharia toggla flag, sistema decide o modo. **Sem display switching no notebook** — display 1 fica área de trabalho normal sempre; só o conteúdo do 10,5" muda.

### MS-16.8 — Simulação de ajuste distribuída (TV 32" + qualquer iPhone do time) (3-4 PRs)
Funcionalidade nova baseada nas clarificações Flávio 2026-05-13. Permite a qualquer membro autorizado (chefe-de-equipe, engenheiro, piloto — D17) **previsualizar** o efeito de um ajuste antes de aprovar, **operando sliders e knobs no próprio iPhone**.

Fluxo:
1. Membro abre Tab Engenharia → seleciona finding → toca [Simular]
2. UI abre painel com **sliders e knobs interativos** (ex.: knob "Ajuste combustível" gira de -10% a +10% em incrementos de 0.5%; slider "Janela RPM" desliza de 4 000 a 7 500)
3. A cada gesto, sistema recalcula projeção determinística (extrapolação linear nos samples atuais da célula) e publica `SimulationProposal` no canal `engineering-{stintId}` (debounce 100 ms)
4. TV 32" (Box Mode) mostra projeção visual atualizada em tempo real
5. Cockpit Pilot 10,5" (se modo `engenharia` ativo) mostra `SIMULATION_INSTRUCTION` correspondente
6. Funciona com **carro andando** — simulação é projeção visual (Camada 2 determinística), não aplica mudança real no mapa. Piloto continua dirigindo; engenheiro/chefe vê comportamento projetado vs real lado a lado.
7. Decisão final: [Aprovar] (salva recommendation em `engineering_recommendations.decisao = 'aprovada'`) ou [Rejeitar] ou [Salvar como rascunho]

**Tier 1 inicial**: sem mudar mapa real (G5 fora do MVP). Evolução pra "aplicar agora via Injepro T Software" depende de G5 fechar. Componente novo: `SimulationCanvas.swift` (área de projeção sincronizada com o stream real para comparação visual contínua).

### MS-16.9 — Engine cells (RPM × MAP histogram) `[gate, OPCIONAL]`
Reabre só se análise de mapa for confirmada como prioridade (D5 do Flávio = pular no MVP). Migration `0022_engine_cells.sql` + agregador + 2 rules extras (`fuel-rich-light-load`, `lambda-vs-target-deviation` precisa do mapa carregado — G5).

**Tamanho total honesto**: 13-19 PRs em ~6-8 dias de Cloud Code sequencial. Dá pra fechar antes do próximo track day se priorizar A→B→C→D→E. MS-16.6/16.7/16.8/16.9 ficam pra fase 2 do MS-16, gate-by-gate.

---

## 7 — UX (proposto, com mockups verbais)

### 7.1 Engenheiro pós-stint (iOS hub, MS-16.5)

Lista cronológica de stints. Cada card mostra:

```
Brasília · 14:32 · Celta · Stint #4 · 8 voltas válidas
  ────────────────────────────────────────────────
  🟡  Mistura pobre sustentada na Curva 4 (Bruxa)
       Confiança: Alta · Risco do ajuste: Médio
       
       λ médio: 1.07 (alvo 0.88)
       3 voltas consecutivas, TPS>80%, MAP>0.9 bar
       Cai accel longitudinal em 0.4 m/s² na mesma janela
       
       Ajuste sugerido: +4% combustível
       Célula: RPM 5200-6000, MAP 0.90-1.00
       
       Não mexer: ignição (avanço está coerente com dyno)
       Como validar: λ no mesmo trecho deve cair pra 0.90-0.95
       
       [Aprovar] [Editar] [Rejeitar] [Discutir no chat]
  
  🟢  Boa frenagem repetida na Curva 1
       …
  
  🔴  V-006 disparou 2x: pressão óleo no limite acima de 6500 RPM
       Determinístico — não é hipótese, é fato.
       Ação: verificar viscosidade no próximo stint.
```

Cores:
- 🔴 vermelho = risco mecânico imediato (CriticalRule disparou)
- 🟡 amarelo = investigar/calibrar (CalibrationRule + IA)
- 🔵 azul = oportunidade pedagógica/performance (deltas grandes)
- 🟢 verde = consistente, manter (reforço positivo)

### 7.2 Engenheiro live no Box Cockpit (iOS Box Mode → AirPlay → TV 32", MS-16.6)

Layout otimizado para 32" landscape, distância de visão 2-3 m, **alta legibilidade** (font ≥ 32 pt, contraste forte). Operado pelo iPhone do box (Box Mode), navegação por toque no iPhone — TV é só projeção.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BRASÍLIA · STINT #4 · CELTA · 02:14 · v3 em curso                      │
├────────────────────┬─────────────────────────────────────────────────────┤
│  MOTOR             │  EVENTOS AO VIVO                                    │
│  RPM   5 840       │                                                     │
│  MAP   0.92 bar    │  [00:42] 🟡 V-007 λ pobre · v3 setor 2 · TPS 84%    │
│  λ     1.06        │  [00:38] 🔴 V-006 pressão óleo · 7 200 rpm           │
│  Hₐ    102 °C      │  [00:31] 🟡 IAT subiu 12 °C nesta volta             │
│  Hₒ    118 °C      │  [00:21] ⚪ apex tardio na Bruxa (v3)                │
│  IAT    54 °C      │                                                     │
│  EGT   780 °C      │                                                     │
│  Press comb 4.1bar │                                                     │
├────────────────────┴─────────────────────────────────────────────────────┤
│  TRECHO ATUAL: Bruxa (v3)                                                │
│  Vmin esperada 78 km/h · medida 76 km/h (Δ −2)                           │
│  Apex actual: 4 m antes da ref (antecipado)                              │
├──────────────────────────────────────────────────────────────────────────┤
│  FINDINGS PENDENTES (3)                          [Aprovar] [Simular]     │
│  • fuel-lean-sustained-load · Bruxa · confiança Alta · risco Médio       │
│  • water-temp-drift-no-cooling · sessão · confiança Média · risco Médio  │
│  • vmin-progressive-loss-segment · Bruxa · confiança Média · risco Baixo │
└──────────────────────────────────────────────────────────────────────────┘
```

**Não compete com cockpit do piloto** — produto separado, consumidor diferente do mesmo canal Realtime. O piloto vê a sua tela (display 2 invertida), o engenheiro/chefe-de-equipe vê a TV 32". Ambos a partir da mesma origem de dados.

### 7.3 Modo contextual no Cockpit Pilot 10,5" (MS-16.7)

O 10,5" é **canal de retorno do Command Box para dentro do carro**. Quem decide o que aparece é a engenharia, publicando no canal Realtime `engineering-{stintId}`. Render é binário: overlay nulo = cockpit canônico; overlay ativo = painel específico do tipo de mensagem.

**Exemplo 1 — simulação em andamento (mecânico ou piloto sentado no carro parado):**

```
┌─────────────────────────────────────────────────────────────┐
│ COCKPIT PILOT — modo SIMULATION_INSTRUCTION                 │
│                                                             │
│  Engenheiro propõe: +4% combustível RPM 5200-6000           │
│  Acelere até 5 800 rpm em 3ª pra validar a célula           │
│                                                             │
│  λ atual: 1.07         λ projetado: 0.92                    │
│  RPM atual: 1 280      RPM alvo: 5 800                      │
│                                                             │
│  [esperando célula-alvo · 4 segundos]                       │
└─────────────────────────────────────────────────────────────┘
```

**Exemplo 2 — diagnóstico mecânico (mecânico sentado, carro parado):**

```
┌─────────────────────────────────────────────────────────────┐
│ COCKPIT PILOT — modo MECHANIC_DIAGNOSTIC                    │
│                                                             │
│  Procedimento de teste de pressão de combustível            │
│                                                             │
│  1. ✅ Motor em marcha lenta (cumprido)                     │
│  2. ⏳ Pedal a 50% sustentado por 5 s (em andamento)         │
│  3. ⬜ Confirmar λ em 0.92 ± 0.03                            │
│                                                             │
│  Press. combustível atual: 4.1 bar                          │
└─────────────────────────────────────────────────────────────┘
```

**Exemplo 3 — foco pré-stint (piloto no carro, prestes a sair):**

```
┌─────────────────────────────────────────────────────────────┐
│ COCKPIT PILOT — modo PILOT_FOCUS_PROMPT                     │
│                                                             │
│  Foco deste stint:                                          │
│  Turn-in da Bruxa — entrar 5 km/h mais lento                │
│                                                             │
│  Lição praticada: L007 (Trail Braking)                      │
│  Como vou medir: Vmin georef + apex actual                  │
│                                                             │
│  [continuar pro cockpit padrão →]                           │
└─────────────────────────────────────────────────────────────┘
```

**Exemplo 4 — engenharia inativa (default):**

```
┌─────────────────────────────────────────────────────────────┐
│ COCKPIT PILOT — modo ENGINEERING_INACTIVE                   │
│ (cockpit canônico — mockup-cockpit-piloto.html)             │
│  Shift light · Apex 4 pontos · Halo · Stint bar · Notch     │
└─────────────────────────────────────────────────────────────┘
```

**Quem decide o tipo de overlay**: a engenharia, pelo canal Realtime. O Cockpit Pilot é **passivo** — obedece o canal, não decide sozinho. Cockpit canônico = default; overlay = exceção sob comando.

### 7.4 Operação (entrada) é só pelos iPhones

- **iPhone do box em Box Mode**: engenheiro toca cards na TV 32" via espelho no próprio iPhone (Box Mode = iPhone sendo "mouse" + AirPlay sendo "monitor"). Botões `[Aprovar]` `[Editar]` `[Rejeitar]` `[Simular]` ficam acessíveis no iPhone (mesmo na TV o foco visual está nos cards). Ergonomicamente igual ao box do MS-12 já planejado.
- **iPhone do time mobilidade**: iOS hub Tab Engenharia, fora do Box Mode. Engenheiro/chefe revisa histórico, decisões cross-stint, edição offline (sincroniza por Realtime).
- **Notebook**: zero operação. Só roda o cockpit pilot em display 2 (kiosk fullscreen) + driver T4000 + publisher Realtime. Nem teclado nem mouse no fluxo normal.

### 7.3 Rastreabilidade

Cada finding/recommendation visível arrasta a evidência. Tap/click expande:
- canais usados + janela temporal + Quality dos canais
- amostras (count, mean, p50, p90)
- voltas relevantes
- referência (PB do dia, PB all-time, ghost selecionado)
- link para sample no SQLite/Postgres para auditoria

**Princípio: nunca afirmar sem mostrar de onde veio.**

---

## 8 — Estratégia de testes

Reaproveita o smoke harness JS já existente (`tests/node-smoke-*.mjs`, 6.481 linhas). Adicionar:

| Smoke | Cobre | Fixture |
|---|---|---|
| `node-smoke-timebase-swift-parity.mjs` | Paridade Swift × JS do TelemetryTimebase | Stream sintético 10 Hz multi-fonte |
| `node-smoke-vehicle-context.mjs` | Aggregator lap/stint/segment/thermal | Sessão Brasília 2026-05-06 (pull SQLite) |
| `node-smoke-calibration-rule-fuel-lean.mjs` | Disparo do fuel-lean-sustained | Stint com λ travado em 1.05 por 3 voltas |
| `node-smoke-calibration-rule-water-drift.mjs` | Disparo do water-temp-drift | Stint com temp subindo 4°C/min |
| `node-smoke-calibration-rule-vmin-loss.mjs` | Disparo do vmin-progressive-loss | Stint com Vmin caindo 1.5 km/h/volta |
| `node-smoke-engineering-recommendations-roundtrip.mjs` | Persist + RLS Postgres | REST contra Supabase dev |
| `node-smoke-advisor-with-findings.mjs` | /api/advisor com findings enriched | Mock Claude (sem custo) |
| Casos negativos | Sensor ruidoso, lambda atrasada, GPS impreciso, falha parcial T4000, stint curto < 3 voltas, piloto inconsistente | Inject quality.SUSPECT/MISSING e validar que rules NÃO disparam |

**Falso positivo / falso negativo**:
- Cada `CalibrationRule` declara `minSamples`, `minConsecutiveLaps`, `requiredQuality` (similar a `Lesson.requiredSignals`).
- Smoke obrigatório: rodar a regra contra **fixture sintética conhecida** (deve disparar) e contra **fixture com 1 ciclo de ruído** (não deve disparar).
- Engenheiro pode ajustar thresholds por carro depois (feedback loop).

---

## 9 — Estratégia de segurança e governança

**Não-negociável (já valendo no projeto):**

1. **ADR-008 — IA não em segurança crítica.** Camada 1 determinística decide CRITICO/BOX_AGORA. Camada 2 (CalibrationEngine) é determinística mas opera em hipóteses NÃO-críticas. Camada 3 (IA) só explica, prioriza, contextualiza.
2. **Toda recomendação é PROPOSTA.** Sistema NUNCA altera mapa, NUNCA aplica setup. Sempre passa pela decisão de um humano. `engineering_recommendations.decisao` é o gate.
3. **Append-only para fatos.** `engineering_findings` é insert-only. O que mudou, mudou. Auditoria preservada.
4. **Dado insuficiente é resposta válida.** Cada finding carrega `confianca` + critério mínimo. Sem quórum, não dispara.
5. **"O que NÃO mexer" é campo obrigatório** — já está no system prompt do `/api/advisor.js`. Mantém.
6. **CRÍTICO precisa Quality.OK no canal** (DATA_QUALITY Regra 4). Sem isso, regra é silenciada (não emite). Idem para findings.
7. **Cooldown por regra** previne flood (igual `CRITICAL_RULES.cooldownMs` hoje).
8. **Mensagem ao mecânico pode ser longa e técnica** (MECHANIC_QUESTIONS_MATRIX). Mensagem ao piloto é curta. UI separa o público.

**Decisão pendente para o Flávio**: confiança mínima para auto-publicar uma recommendation no UI vs deixar como finding cru aguardando IA. Proponho: finding sempre publicado, recommendation só publicada se confianca ≥ Média.

---

## 10 — Plano de implementação por fases (atualizado 2026-05-13)

| Fase | Sprints | Saídas | Pré-req |
|---|---|---|---|
| **A — Infra Swift** | MS-16.1 | TelemetryTimebase + Snapshot 10 Hz wireado no app iOS | — |
| **B — Modelo contextual** | MS-16.2 | VehicleContextAggregator + smoke de fixture Brasília | A |
| **C — Engenharia codificada** | MS-16.3 | 3 CalibrationRule + persistência Supabase | B |
| **D — IA enriquecida** | MS-16.4 | `/api/advisor` aceita findings + decisão persistida | C |
| **E — UI engenheiro pós-stint mobile** | MS-16.5 | Tab Engenharia no iOS hub, lista + decisão | C |
| **F — Box Mode Engenharia (live TV 32")** | MS-16.6 | iOS Box Mode subscreve Realtime, renderiza na 32" | C + MS-9 + MS-12 fechados |
| **G — Modo simulação no Cockpit Pilot 10,5"** | MS-16.7 | Overlay XAML sincronizado pelo canal `engineering-{stintId}` | F |
| **H — Simulação de ajuste** | MS-16.8 | Projeção visual e validação interativa | F + G |
| **I — Engine cells (opcional)** | MS-16.9 | Histograma de células, 2 rules extras | C + decisão G5 |

**Ordem dura: A → B → C → (D + E em paralelo) → F → (G + H em paralelo) → I.** Cada fase é mergeavel sozinha; cada uma agrega valor sozinha. Fase F precisa de MS-12 (AirPlay → Apple TV → TV 32") já fechado em produção — ainda não está; é gate adicional ao MS-9.

---

## 11 — Decisões — 3 fechadas 2026-05-13, 9 abertas

| # | Decisão | Status | Resposta / default |
|---|---|---|---|
| **D1** | Aprovar "MS-16 — Command Box Engenharia" como novo mini-sprint | **✅ FECHADA 2026-05-13** | Aprovado. PR do doc + edit do `PLANO_FASE_1.md` §6 com bloco MS-16 |
| **D2 + D3** | Onde mora UI engenheiro (live + post)? | **✅ FECHADA 2026-05-13** | **Command Box Engenharia = iOS Box Mode → AirPlay → Apple TV → TV 32"** (engenheiro + chefe-de-equipe). **Cockpit Pilot = notebook WinUI 3 → display 2 10,5" invertida** (piloto, igual MS-13). **Operação só pelos iPhones** — notebook não é operado, fica kiosk. Quando carro parado, Cockpit Pilot ganha **overlay de simulação** sincronizado por Realtime com o que o engenheiro está propondo na TV 32" (sem display switching). |
| **D6** | Catálogo inicial de CalibrationRule | **✅ FECHADA 2026-05-13** | 3 rules MVP: `fuel-lean-sustained-load`, `water-temp-drift-no-cooling`, `vmin-progressive-loss-segment`. Generalização para 10 rules depois do primeiro track day |
| D4 | Granularidade de célula RPM × MAP (MS-16.9) | aberta | Default: 250 RPM × 0.05 bar |
| D5 | Mapa atual da ECU — upload Injepro T Software no MVP? | aberta | Default: pular no MVP. Reabrir após track day 1 |
| D7 | Confiança mínima para publicar recommendation | aberta | Default: recommendation se confianca ≥ Média; findings sempre |
| D8 | Permissão de aprovar/rejeitar recommendation | aberta | Default: admin + chefe_equipe |
| D9 | Sincronização da decisão entre dispositivos via Realtime? | aberta | Default: sim, canal `engineering-{stintId}` |
| D10 | Análise de pilotagem × mecânica no mesmo Command Box? | aberta | Default: mesmo (Tab Engenharia agrupa, mecânico filtra) |
| D11 | Mensagens da Camada 3 IA chegam ao piloto durante stint? | aberta | Default: não. Piloto só via P1 Coach. ADR-008 |
| D12 | Limites do Celta calibrados antes ou na track day? | aberta | Default: defaults conservadores + calibração em pista |
| **D13** | **(NOVA)** Simulação de ajuste (MS-16.8) sem mexer no mapa real — aceita? | aberta | Default: sim. Projeção por extrapolação linear na célula. Aplicar no mapa real só após G5 fechar |
| **D14** | **REVISADA 2026-05-13** Gatilho do overlay no Cockpit Pilot 10,5" — agora NÃO é mais velocidade do carro, e sim **mensagem explícita no canal `engineering-{stintId}`** publicada pela engenharia. Heurística de speed só serve como **hint adicional** pra UI (ex.: render variante). OK? | aberta | Default: gatilho = canal; speed só hint |
| **D15** | **(NOVA)** Catálogo inicial de tipos de overlay no Cockpit Pilot 10,5" — proponho 4 (`ENGINEERING_INACTIVE`, `SIMULATION_INSTRUCTION`, `MECHANIC_DIAGNOSTIC`, `PILOT_FOCUS_PROMPT`, `ALERTA_OPERACIONAL`). Cobrem o uso descrito? Faltam categorias? | aberta | Default: 4 + ALERTA_OPERACIONAL = 5 |
| **D16** | **(NOVA)** Quem **dispara** cada tipo de overlay (engenheiro pelo Box Mode? chefe-de-equipe pelo iOS hub? mecânico pelo iPad? automático por findings de severidade alta?) — define as permissões de publicação no canal `engineering-{stintId}` | aberta | Default: qualquer membro com papel admin/chefe_equipe; auto-publish só para alertas operacionais e fim do stint |
| **D17** | **✅ FECHADA 2026-05-13** Permissão de **editar configurações + rodar simulações** nos iPhones | **Piloto**: SÓ com carro parado (mesma heurística do D14: `speed_fused < 5 km/h` por > 3 s). **Chefe + engenheiro**: a qualquer momento (não estão dirigindo). |
| **D18** | **✅ FECHADA 2026-05-13** Switch padrão piloto ↔ padrão engenharia no Cockpit Pilot 10,5" | **Automático**, sem comando manual. Regra: `(modulo_engenharia_ativado) AND (carro_parado)` → padrão engenharia; qualquer outra combinação → padrão piloto. Carro voltando a andar **sempre** força padrão piloto (auto-protect anti-distração). |
| ~~D14~~ | ~~(NOVA) Heurística "carro no box"~~ | **✅ ABSORVIDA por D18** Heurística `speed_fused < 5 km/h` sustentado por > 3 s = "parado"; `speed > 10 km/h` por > 2 s = "andando". Usada também por D17 para gating do piloto. |
| **D19** | **(NOVA 2026-05-13)** Latência aceitável para o ciclo **slider/knob → projeção visual → canal Realtime → outros dispositivos verem** durante simulação distribuída? Proponho debounce 100 ms + propagação Realtime ~150 ms = ~250 ms ponta-a-ponta. | aberta | Default: 250 ms p99 |
| **D20** | **(NOVA 2026-05-13)** Como o **chefe/engenheiro ativa/desativa o "módulo engenharia"** (flag que D18 lê)? Toggle persistente por stint na Tab Engenharia? Ativação automática quando há finding pendente? | aberta | Default: toggle manual na Tab Engenharia (qualquer membro com papel chefe/engenheiro), persistido em `engineering_recommendations.modulo_ativo` ou em estado de stint |

---

## 12 — Contradições e dúvidas detectadas (relato honesto)

Coisas que **vi divergentes entre docs e código**. Reportando pra você decidir, não escolhi:

1. **`docs/raceops/` referenciado em comentários do código não existe nessa pasta** — os docs estão em `docs/telemetry/` (DATA_QUALITY, CROSS_VALIDATION, TELEMETRY_*) e `docs/domain/` (matrizes). Não muda comportamento; é só limpeza.
2. **Modelo `MAX_TOKENS` em `/api/advisor.js` está hardcoded `claude-opus-4-7`** — alinhado com o que CLAUDE.md instrui (default to latest Claude). Mas Claude Sonnet 4.6 e Haiku 4.5 estão disponíveis e seriam mais baratos para advisor de stint. Vale revisar tier por endpoint? **Decisão sua.**
3. **`AdvisorSuggestion` é Dexie-legado** (`src/domain/advisor-suggestion.js`). Não há porte iOS. ADR-009 trava drainer até "Fase 20" mas a tabela `engineering_recommendations` que proponho cria uma rota nova fora do `syncQueue` (mesmo padrão de `telemetry_samples` em ADR-014). Compatível com ADR-009. Só registrando que NÃO estou propondo abrir `syncQueue`.
4. **`StintEnvironment` (pirômetro, pressão, composto) não tem porte iOS Swift** — campos individuais migraram pra `sessoes` (migration 0006, 0014). Para o Command Box Engenharia ler temperatura ambiente, composto e pressões inicial, **tudo isso já está disponível** em `sessoes` via `EnduranceDetection`/`StintRepository` no iOS. **Não é gap.**
5. **Edge Function `/functions/v1/detector` derivada** (ADR-025) — para reprocessamento batch. Se a Camada 2 evoluir, esta Edge Function pode também receber CalibrationEngine para reprocessar sessões antigas. Fica como **possibilidade futura**, não MVP.
6. **`CrossValidation.swift` está completo (V-001..V-011)** mas **não consegui confirmar via grep que está conectado ao stream live no app iOS** — vi o módulo, vi testes, mas não vi o caller que injeta Snapshots nele em runtime. Pode estar dormente. **Vale conferir antes do MS-16.1.**
7. **`MS-12 Box Cockpit` no plano antigo** mistura "AirPlay de iOS Box Mode" com "mensagens Realtime". O Command Box Engenharia que você descreveu **NÃO é** o Box Cockpit do plano — é um produto novo. Vale separar nomes para não confundir.

---

## 13 — Próximo prompt de execução (se aprovado)

Se você aprovar este plano, o próximo prompt pro Cloud Code seria **MS-16.1** isolado:

```
Worktree: ../p1-fast-ms-16-1 feat/ms-16-1-telemetry-timebase-swift

Tarefa: portar src/telemetry/timebase.js para Swift em
ios/p1fast-core/Sources/P1FastCore/TelemetryTimebase.swift.

Contrato:
  - struct Source { source, expectedRateHz, freshness, channels,
                    buffer, latencyMedian, jitter, lastSample, ... }
  - class TelemetryTimebase { 
      attach(source:freshness:)
      ingest(source:sample:) 
      buildSnapshot(at:tMono) -> Snapshot 
      stats() -> TimebaseStats }
  - DEFAULT_FRESHNESS_MS paridade Swift (mapa estático)
  - LATENCY_WINDOW = 32, BUFFER_MAX_AGE_MS = 10_000

Smoke obrigatório:
  - tests/node-smoke-timebase-swift-parity.mjs
  - rodar stream sintético idêntico em ambos (JS e Swift via swift run)
  - assert snapshot a snapshot equivalente
  - cobrir: amostras out-of-order, duplicate, late, missing, multi-fonte

❌ NÃO autorizado: tocar Package.resolved
❌ NÃO autorizado: alterar production (Supabase, Vercel)
✅ Autorizado: novos arquivos em p1fast-core/, testes em tests/

Sucesso = swift run p1fast-smoke verde + node-smoke verde.
```

Se você preferir esperar para validar o caminho A→B→C antes de cada PR, posso emitir um por vez sob seu OK.

---

## 14 — O que NÃO está nesta proposta (delineamento explícito)

Pra não criar expectativa errada:

- **Não toquei produção** — nenhum SQL aplicado, nenhum endpoint deployed, nenhum código de runtime alterado.
- **Não criei tabela `engineering_findings` nem `engineering_recommendations`** — só desenhei o shape. Migrations precisam de PR + aprovação.
- **Não criei `CalibrationRule` em código** — só o catálogo proposto.
- **Não implementei `VehicleContextAggregator`** — descrito em prosa.
- **Não escrevi nenhum XAML/SwiftUI/HTML novo de UI** — descrito verbalmente.
- **Não chamei Claude API para validar** — system prompt proposto é evolução do existente.
- **Modifiquei `PLANO_FASE_1.md` §6** — adicionei bloco MS-16 (Command Box Engenharia) referenciando este doc. CLAUDE.md fica inalterado.

---

## 15 — Decisões registradas 2026-05-13 (sessão Flávio)

3 perguntas respondidas em formato cards; respostas reproduzidas literalmente para audit:

**D1 — Aprovar criação do MS-16?** → "Aprovar e abrir PR do doc (Recommended)"

**D2 + D3 — Onde mora UI engenheiro?** → resposta literal Flávio:
> "vai ser no command box que foca na tela de 32 polegadas operada por um iphone na nuvem. podendo também mudar a tela do notebook para o piloto quando estiver parado no box acompanhar as midanças e tambêm participar acelerando ou maniseando o carro enquanto o command box é usado pelo engenheiro, chefe de equipe para analisar o contexo, as oportunidades e fazer simulacoes."

**Clarificação Flávio 2026-05-13 (após primeira leitura):**
> "vc entendeu que mostramos as informaçoes no command box e também na tela de 10.5 do piloto que chamamos de cockpit pilot, mas operamos a partir sos celulares."

**Clarificação Flávio 2026-05-13 (segunda):**
> "na verdade o modo piloto no carro mostra as informacoes importante que definirmos para ele saber ou oara um mecanico que estiver sentado no csrro caso a atividade de contexto de corrida que é a engenharia esteja ativada."

**Clarificação Flávio 2026-05-13 (terceira):**
> "e nos celulares o chefe, engenheiro e piloto pode mexer nas configuracões e também fazer simulações em seus celulares deslizando botões ou girando botões. pode ser com o carro andando. a tela do piloto pode ou não ser alterada para o padrão engenharia ou para o padrão piloto."

**Clarificação Flávio 2026-05-13 (quarta — fecha D17 e D18):**
> "1. se estiver parado pode. 2. se estiver andando não entra no modo engenharia. mas se parar e o módulo engenharia estiver ativado entra automaticamente em modo de engenharia. se voltar a andar volta para o padrao piloto."

Interpretação consolidada aplicada ao doc (após 4 clarificações):
- **Duas telas físicas simultâneas de saída**: Command Box (TV 32") e Cockpit Pilot (10,5" externa invertida no painel, mesma de MS-13).
- **Operação distribuída pelos iPhones**: chefe + engenheiro **a qualquer momento**; piloto **só com carro parado** (D17 fechada). Cada um no seu celular, edita configurações e roda simulações com sliders e knobs. Notebook continua kiosk (não é operado).
- **Simulação rodada por chefe/engenheiro pode acontecer com carro andando** — projeção determinística (Camada 2); não muda mapa real. Simulação rodada pelo piloto é gated por velocidade (D17 — só com carro parado).
- **Cockpit Pilot 10,5" tem switch automático (D18)** — sem comando manual. Regra:
  - `modulo_engenharia_ativado = false` → padrão piloto sempre
  - `modulo_engenharia_ativado = true` + `carro parado` → entra padrão engenharia automaticamente
  - `modulo_engenharia_ativado = true` + `carro andando` → padrão piloto (auto-protect anti-distração)
  - Voltar a andar **sempre** força padrão piloto imediato, sem debounce (segurança)
- **Flag `modulo_engenharia_ativado`**: toggle no iPhone do chefe/engenheiro (D20 aberta — onde persistir). Default OFF; ON quando engenharia decide trabalhar contextualmente.
- **Quem está no carro** pode ser piloto (mãos no volante, durante stint) ou mecânico (sentado no carro em diagnóstico).
- **Sem display switching no notebook**. Display 1 = área de trabalho normal sempre. Display 2 = Cockpit Pilot 10,5", conteúdo decidido pelo `cockpitModeResolver`.
- Funcionalidades novas: MS-16.7 (modo contextual + switch automático), MS-16.8 (simulação distribuída por sliders/knobs), MS-16.5 ganha componente `EngControl.swift` com gating de velocidade pra piloto.

**D6 — Catálogo MVP de CalibrationRule?** → "3 rules MVP — fuel-lean, water-drift, vmin-loss (Recommended)"

---

**Próximo passo (aguarda OK do Flávio):**
- PR aberto na branch `claude/audit-engineering-module-Ael3m` com este doc + bloco MS-16 em `PLANO_FASE_1.md` §6.
- Depois do merge: emitir prompt MS-16.1 isolado para Cloud Code (port `TelemetryTimebase` Swift, sem UI, sem produção).
- Decisões D4, D5, D7..D14 ficam abertas mas **não bloqueiam** A→B→C→D→E. Podem ser respondidas no caminho.
