# P1FastCore — Swift Package puro do pipeline

Port em Swift do **núcleo de telemetria** do P1 Fast. Sem deps iOS — compila com `swift build` no Mac, só CommandLineTools.

## Conteúdo

```
p1fast-core/
├── Package.swift
└── Sources/
    ├── P1FastCore/             ← lib (importável)
    │   ├── Quality.swift          ← 11 categorias canônicas + worstOf + helpers
    │   ├── Sample.swift           ← amostra multi-fonte + SourceTags + Clock
    │   ├── Snapshot.swift         ← CarTelemetrySnapshot + SnapshotBuilder
    │   ├── CriticalRules.swift    ← AlertLevel + Engine + 3 regras CRÍTICAS + 3 manuais
    │   ├── CrossValidation.swift  ← V-001 (CAN×GNSS) + V-002 (IMU×derivada speed)
    │   ├── FaseCurva.swift        ← classificação INICIO/MEIO/FIM por accLong
    │   ├── PathMapper.swift       ← parsePath/buildLookup/snap/parcialFromOffset
    │   ├── TrajectoryMonitor.swift ← desvio em metros vs volta de referência (L001/L007)
    │   ├── BaselineVectors.swift  ← vetores configuráveis + filterForBaseline
    │   ├── FuelCalc.swift         ← combustível em voltas + progressoStint
    │   ├── CoachPhrases.swift     ← catálogo MVP (M001..M062, 2..3 palavras)
    │   ├── P1Coach.swift          ← motor pedagógico completo (electLesson + consume + signalsFromSnapshot)
    │   └── Persistence/           ← SQLite local via GRDB (espelho do Postgres Supabase)
    │       ├── DB.swift              ← DatabaseQueue factory + makeMemoryQueue
    │       ├── Migrations.swift      ← v1: 20 tabelas + sync_queue local
    │       ├── Models.swift          ← Codable + FetchableRecord + PersistableRecord
    │       └── SyncQueue.swift       ← markSynced / listPending / enqueue / drain
    └── P1FastSmoke/             ← executável de teste (não usa XCTest)
        └── main.swift             ← 129 asserts paridade com pipeline JS + persistência
```

## Por que executável smoke em vez de XCTest

CommandLineTools não inclui `XCTest` nem `Swift Testing` (`Testing` module). Esses só vêm com Xcode.app instalado.

Solução: o `P1FastSmoke` é um executável Swift comum que roda asserts manuais e reporta `N ok / N fail`. Mesmo padrão dos smokes JS Node (`tests/node-smoke-*.mjs`). Quando Xcode entrar, dá pra adicionar testes XCTest paralelos sem remover o smoke.

## Como rodar

```bash
cd ios/p1fast-core
swift build                # compila a lib (puxa GRDB.swift via SPM)
swift run p1fast-smoke     # roda 129 asserts
```

Saída esperada:
```
✓ DQ-01: 11 categorias canônicas
✓ DQ-02: fromSignalQuality 4-cat → 11-cat
... (129 linhas)
═══ RESULTADO ═══
129 ok / 0 fail
```

Exit code 0 se passou, 1 se falhou.

## Paridade com pipeline JS

Cada teste Swift mapeia 1:1 pra um teste do `tests/node-smoke-telemetry-p0.mjs` (smoke oficial JS):

| Smoke Swift | Smoke JS equivalente | O que valida |
|---|---|---|
| DQ-01 | T-CR-01 (telemetry-p0) | 11 categorias canônicas em Quality |
| DQ-02 | DQ-02 | fromSignalQuality (4-cat antiga → 11-cat nova) |
| DQ-03 | DQ-03 | thresholds GPS accuracy 5/20/50 |
| DQ-04 | DQ-04 | fromRangeCheck rotula OUT_OF_RANGE |
| DQ-05 | DQ-05 | worstOf devolve pior por severidade |
| DQ-06 | DQ-06 | isOk + permitsCritical (Regra 4 ALERT_HIERARCHY) |
| SNAP-01 | IMU-01 (node-harness-funcional) | snapshot consome accLong/accLat do iphone-imu |
| SNAP-02 | IMU-02 | 4 fases distintas (reta/freio/curva/acel) coerentes |
| SNAP-03 | SB-03 | speedFused = CAN×0.55 + GNSS×0.45 |
| SNAP-04 | (extra) | pickEngine extrai rpm/oilPressure/waterTemp |
| SNAP-05 | SB-04 (parcial) | Empty input → MISSING + Baixa |
| SNAP-06 | SB-04 | quality.sync = pior das fontes ativas |
| CR-01 | CR-01 | Catálogo tem regras canônicas obrigatórias |
| CR-02 | CR-02 | Pressão óleo < 1.0 bar com RPM > 1000 → BOX_AGORA |
| CR-03 | CR-03 | Temp motor escala ATENCAO → CRITICO → BOX_AGORA |
| CR-04 | CR-04 | Cooldown bloqueia repetição imediata |
| CR-05 | CR-05 | Regra ignora canal sem Quality.OK (Regra 4) |
| CR-06 | CR-06 | fireManual dispara bandeira vermelha BOX_AGORA |
| CR-07 | CR-07 | Regras manuais ≥ 3 (vermelha, amarela, pista molhada) |
| XV-V001 (sustentada) | XV-V001 | divergência CAN×GNSS > 5 km/h por 2s+ → V-001 |
| XV-V001 (não emite) | (novo) | divergência < 5 km/h não dispara |
| XV-V001 (cooldown) | XV-cooldown | cooldown 30s bloqueia 2ª emissão |
| CLOCK-01 | (novo) | Clock.now retorna epoch ms positivo |
| CLOCK-02 | ADR-015 (espelhado) | Clock.nowMono é monotonic crescente |
| FC-01 | fase-curva.js (paridade direta) | classificar([]) retorna nil |
| FC-02 | fase-curva.js | sem accLong → fallback 1/3 1/3 1/3 por tempo |
| FC-03 | fase-curva.js | com accLong → c1 cruza -0.35g, c2 cruza +0.25g |
| FC-04 | fase-curva.js | apex = ponto de menor velocidade dentro do MEIO |
| FC-05 | fase-curva.js | velEntrada/velSaida = primeira/última kmh do bloco |
| FC-06 | fase-curva.js | accLongPeak preserva sinal do maior em magnitude |
| FC-07 | fase-curva.js | total.duracaoMs = t_last - t_first |
| FC-08 | fase-curva.js | sample com kmh ou accLong nil não quebra |
| PM-01..PM-08 | path-mapper.js | parsePath M/L/Z, pathLength, buildLookup, snap incremental, parcialFromOffset, segmentsIntersect |
| TM-01..TM-20 | node-smoke-trajectory-monitor.mjs (1:1) | distanceMetersGeo, find{Apex,Braking,TurnIn,Throttle}Index, evaluateSegmentTrajectory, evaluate{ReferenciaFixa,CurvaCega}, TrajectoryMonitor instance |
| BV-01..BV-07 | baseline-vectors.js | filterForBaseline com pneu/ambiente/piloto/dia + ordenação por tempoMs |
| FU-01..FU-07 | fuel-calc.js | calcular (3 estados Disponivel) + calcularProgressoStint |
| PC-01..PC-14 | node-smoke-p1-coach.mjs (subset MVP) | start/endLearningSession, electLesson com focus, cooldown, maxPerCorner, pause/resume, BAIXA gating, signalsFromSnapshot, AUDIT 7 MVP, E2E 3 voltas, focusLessonId scope |
| PERSIST-01..PERSIST-16 | (sem equivalente JS — Dexie é runtime web; aqui é GRDB local) | Schema v1 cria 20 tabelas + sync_queue, telemetry_samples sem synced_at (ADR-014), CHECK constraints (voltas_planejadas≥1, marco.tipo, fonte_temperatura), FK habilitadas, SyncQueue.markSynced/listPending/enqueue/drain/incrementAttempts, migrator idempotente |
| K-01..K-14 | (sem JS — primeira impl. nativa) | KalmanINSGPS — fusão IMU 100Hz + GPS ~1Hz CV-2D, projeção flat-earth privada, heading via course/gyroAlpha, smoke cobre drift, bound, convergência, sinal leste/norte, integração cinemática |

A próxima frente — quando vier — adiciona V-003..V-011, sample-store, e providers (mock/device/t4000).

## Persistence — espelho do Postgres no SQLite local

`Sources/P1FastCore/Persistence/` é a camada de SQLite local via [GRDB.swift](https://github.com/groue/GRDB.swift). O schema v1 (em `Migrations.swift`) é 1:1 com `supabase/migrations/0001_initial.sql` — mesmas tabelas, mesmas colunas, tipos compatíveis.

**Convenções:**

- **IDs UUID** ficam como `TEXT` (não há tipo nativo no SQLite)
- **Timestamps** são `INTEGER` (epoch ms) — uniformiza com `t`/`uploaded_at` da telemetria
- **JSONB** vira `TEXT` (caller serializa/deserializa via `JSONSerialization`/`JSONEncoder`)
- **Booleans** são `INTEGER` (0/1) — GRDB converte automático
- Toda tabela ganha `synced_at INTEGER NULL` **exceto `telemetry_samples`** (ADR-014: append-only, sync por batch consolidado, não row-a-row)

**Tipos persistíveis** (Codable + FetchableRecord + PersistableRecord):

| Swift | Tabela Postgres |
|---|---|
| `Time` | `times` |
| `TrackRow` / `TrackLayoutRow` / `TrackSegmentRow` | `tracks` / `track_layouts` / `track_segments` (`Row` suffix evita colisão com domain types `Track`, `TrackLayout`, `TrackSegment`) |
| `Marco` (com `Tipo` enum: largada/chegada/pit-in/pit-out/sinalizacao/box) | `marcos` |
| `RetaEspecial` | `retas_especiais` |
| `Carro` (com `FonteTemperatura` enum: motor/pneu/ambos) | `carros` |
| `Configuracao` | `configuracoes` |
| `Piloto` | `pilotos` |
| `Evento` | `eventos` |
| `Sessao` (com `voltasPlanejadas` ghost-map) | `sessoes` |
| `Volta` | `voltas` |
| `SegmentExecution` | `segment_executions` |
| `TelemetrySample` (sem `syncedAt`, ADR-014) | `telemetry_samples` |
| `SyncQueueItem` (com `SyncOp` enum) | `sync_queue` (LOCAL — não existe no Postgres) |

Tabelas com schema mas sem struct ainda: `usuarios_time`, `passageiros`, `pneus`, `combustiveis`, `mensagens`, `trofeus_ganhos`. Adicionar conforme demanda.

**Helpers (`SyncQueue`):**

```swift
let queue = try DB.makeQueue(path: ".../app.sqlite")
try queue.write { db in
    var carro = Carro(id: "c-1", timeId: "t-1", apelido: "Civic")
    try carro.insert(db)
    try SyncQueue.enqueue(db, tableName: "carros", rowId: "c-1", op: .insert)
}
// ... mais tarde, após sucesso no Supabase:
try queue.write { db in
    try SyncQueue.markSynced(db, tableName: "carros", rowId: "c-1")
}
```

**Sync drainer** (worker que consome `sync_queue` e replica pro Supabase) **não está aqui** — Sprint 1A.6.

## Como contribuir um novo módulo portado

1. Adicionar arquivo Swift em `Sources/P1FastCore/<Nome>.swift`. Manter API e shape próximos do JS original.
2. Adicionar bloco `step("X-NN: ...", ...)` no `Sources/P1FastSmoke/main.swift` espelhando o smoke JS equivalente.
3. `swift run p1fast-smoke` deve continuar `N ok / 0 fail`.
4. Documentar no README de `ios/` qual frente avançou.

## Não faz parte do escopo

- `CoreMotion` / `CoreLocation` — esses precisam iOS SDK. Vivem em `imu-test/` (mini-app) e no app real iOS futuro, não aqui.
- `SwiftUI` — UI também vive nos targets que importam P1FastCore como dependência.
- Sync drainer (Sprint 1A.6) — worker que consome `sync_queue` e replica pro Supabase. Aqui só schema + helpers de marcação.
