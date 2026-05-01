# `ios/` — código Swift do P1 Fast

Tudo que vai pro celular vive aqui. Conforme [ADR-018](../ARCHITECTURE_DECISIONS.md), o app do celular é **iOS nativo Swift, sem PWA**, e o motivo central é captura IMU @ 10 Hz consistentes (impossível garantir no Safari).

## Subpastas

### `imu-test/`
**Mini-app descartável de validação ADR-018.** Uma tela só (KPIs Hz/jitter + leituras vivas + EXPORT CSV) que você roda no iPhone real pra provar que CoreMotion + CoreLocation entregam ≥ 10 Hz consistentes em condições reais.

Bloqueado em **instalar Xcode.app** (CommandLineTools sozinho não basta). Quando estiver no Mac, ler [imu-test/README.md](imu-test/README.md) — passos detalhados de Xcode → criar projeto → colar arquivos → run no iPhone.

Roteiro de teste: 5 cenários (mesa baseline, tela apagada, carro parado sob sol, trajeto curto, track day).

### `p1fast-core/`
**Swift Package puro do pipeline central.** Compila com `swift build` no Mac (sem Xcode.app, só CommandLineTools). Será dependência do app real quando ele nascer.

Hoje tem `Quality`, `Sample`, `Snapshot`, `Clock` — port direto do JS de:
- `src/domain/data-quality.js` → `Quality.swift`
- `src/pipeline/mobile-telemetry.js` (Sample shape) → `Sample.swift`
- `src/telemetry/snapshot.js` (buildSnapshot) → `Snapshot.swift`

Validação **automatizada**: `swift run p1fast-smoke` roda 14 asserts manuais que espelham os smokes JS (DQ-01..06, SNAP-01..06, CLOCK-01..02). Atualmente **14 ok / 0 fail**.

```bash
cd ios/p1fast-core
swift build               # módulo lib
swift run p1fast-smoke    # paridade com pipeline JS
```

> Não usamos XCTest nem Swift Testing aqui porque CommandLineTools não inclui esses módulos. Smoke executável dá o mesmo valor que XCTest — saída `N ok / N fail` legível, exit code 0/1.

## Próximas pedras

| Frente | Status | Bloqueio |
|---|---|---|
| Validar 10 Hz CoreMotion no iPhone real | escrito, não rodado | Xcode.app não instalado |
| Port `cross-validation.js` (V-001..V-011) pra Swift | pendente | — |
| Port `critical-rules.js` (BOX_AGORA, CRÍTICO, ATENÇÃO) pra Swift | pendente | — |
| Port `p1-coach.js` + `lesson-library.js` pra Swift | pendente | — |
| Port `track-segment.js` + `seed-tracks.js` pra Swift | pendente | decidir SwiftData / CoreData / GRDB primeiro |
| Decidir runtime do pipeline: porte completo Swift vs JavaScriptCore embarcado | pendente | discussão arquitetural |
| Skeleton SwiftUI app real | pendente | depende de Xcode + decisão de persistência |

Cada porte novo segue o mesmo padrão: arquivo Swift em `Sources/P1FastCore/` + asserts no `Sources/P1FastSmoke/main.swift` espelhando o smoke JS equivalente. Paridade saída por saída.
