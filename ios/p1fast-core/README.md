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
    │   └── CrossValidation.swift  ← V-001 (CAN×GNSS) + V-002 (IMU×derivada speed)
    └── P1FastSmoke/             ← executável de teste (não usa XCTest)
        └── main.swift             ← 24 asserts paridade com pipeline JS
```

## Por que executável smoke em vez de XCTest

CommandLineTools não inclui `XCTest` nem `Swift Testing` (`Testing` module). Esses só vêm com Xcode.app instalado.

Solução: o `P1FastSmoke` é um executável Swift comum que roda asserts manuais e reporta `N ok / N fail`. Mesmo padrão dos smokes JS Node (`tests/node-smoke-*.mjs`). Quando Xcode entrar, dá pra adicionar testes XCTest paralelos sem remover o smoke.

## Como rodar

```bash
cd ios/p1fast-core
swift build                # compila a lib
swift run p1fast-smoke     # roda 14 asserts
```

Saída esperada:
```
✓ DQ-01: 11 categorias canônicas
✓ DQ-02: fromSignalQuality 4-cat → 11-cat
... (14 linhas)
═══ RESULTADO ═══
14 ok / 0 fail
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
| CLOCK-01 | (novo) | Clock.now retorna epoch ms positivo |
| CLOCK-02 | ADR-015 (espelhado) | Clock.nowMono é monotonic crescente |

Quando portarmos `cross-validation.js` ou `critical-rules.js`, novos asserts entram aqui replicando os smokes JS correspondentes.

## Como contribuir um novo módulo portado

1. Adicionar arquivo Swift em `Sources/P1FastCore/<Nome>.swift`. Manter API e shape próximos do JS original.
2. Adicionar bloco `step("X-NN: ...", ...)` no `Sources/P1FastSmoke/main.swift` espelhando o smoke JS equivalente.
3. `swift run p1fast-smoke` deve continuar `N ok / 0 fail`.
4. Documentar no README de `ios/` qual frente avançou.

## Não faz parte do escopo

- `CoreMotion` / `CoreLocation` — esses precisam iOS SDK. Vivem em `imu-test/` (mini-app) e no app real iOS futuro, não aqui.
- `SwiftUI` — UI também vive nos targets que importam P1FastCore como dependência.
- Persistência (Dexie equivalente) — decisão pendente entre SwiftData / CoreData / GRDB. Quando resolvido, persistência ganha módulo separado.
