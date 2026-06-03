# Última tarefa — 3 entregas: 6 indicadores por trecho + IA por trecho

## Pedido original

Flávio escreveu `vai` em 2026-05-24 noite. O gatilho pré-aprovado [[p1-fast-comando-go-3-entregas-trecho-ia-2026-05-24]] orientou execução das 3 entregas sem pedir confirmação:

1. Cálculo dos 5 indicadores faltantes durante o stint
2. Mostrar os 6 indicadores no aplicativo
3. IA por trecho (1 conselho curto)

## TASK_INIT

- Protocolo carregado: sim
- Padrões carregados: sim
- Ambiente alvo: desenvolvimento (ambiente isolado `infallible-liskov-7a1b15`)
- Produção protegida: sim
- Autorização para produção: não (proibido — só ambiente isolado)
- Pedido entendido: executar as 3 entregas do comando GO sem pedir confirmação
- Critério de conclusão: testes verdes + app instalado no iPhone + relatório HTML aberto

## TASK_DONE

- Pedido original conferido: sim — todas as 3 entregas atacadas
- Ambiente trabalhado: desenvolvimento (`infallible-liskov-7a1b15`)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim — 436 swift smokes + suite completa de Node smokes + build iOS Simulator + iPhone Device
- Resultado: concluído (com 2 limitações honestas reportadas)
- Pendências reais:
  - Captura de tela do iPhone bloqueada por limitação do `idevicescreenshot` (não acha o device no pareamento atual)
  - Aba "Desempenho" na `AutodromoDetalheView` não foi criada — tela não existe no app hoje, fica pra rodada futura
  - Migração das 7 colunas pro Supabase precisa de autorização explícita

## Arquivos alterados / criados

### Domínio canônico (JS)
- `src/telemetry/detector.js` — buffer rolling, evento `onSegmentPostBurst`, 5 campos novos
- `src/domain/trecho-advisor.js` — NOVO

### Domínio canônico (Swift)
- `ios/p1fast-core/Sources/P1FastCore/Detector.swift` — espelho 1:1 do JS
- `ios/p1fast-core/Sources/P1FastCore/SegmentExecutionMapper.swift` — aceita post-burst + `mergePostBursts`
- `ios/p1fast-core/Sources/P1FastCore/TrechoAdvisor.swift` — NOVO

### Persistência
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift` — migration v15
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — 7 campos em `SegmentExecution`

### App iOS
- `ios/p1fast-ios/Sources/Components/SeisIndicadoresTrecho.swift` — NOVO componente
- `ios/p1fast-ios/Sources/Views/PosStintView.swift` — seção nova "Trechos · 6 indicadores"
- `ios/p1fast-ios/Sources/Persistence/StintRepository.swift` — `segmentExecutions(stintId:)` + `finalize` com post-burst
- `ios/p1fast-ios/Sources/Telemetry/StintCaptureCoordinator.swift` — coleta post-bursts
- `ios/p1fast-ios/Sources/Views/StintCaptureView.swift` — propaga pro finalize

### Testes
- `tests/node-smoke-segment-six-indicators.mjs` — NOVO (6 testes verdes)
- `tests/node-smoke-trecho-advisor.mjs` — NOVO (6 testes verdes)
- `ios/p1fast-core/Sources/P1FastSmoke/main.swift` — SE6-01..06 + TA-01..06 adicionados
- `package.json` — script `smoke` agora roda os 2 novos

### Relatório
- `relatorios/EXECUCAO-3-ENTREGAS-TRECHO-IA-2026-05-24.html` — NOVO

## O que foi preservado

- Toda a API atual do Detector (segmentEnd não mudou de assinatura — novos campos são opcionais)
- Smokes antigos (3 detector + 15 detector-snapshot) verdes sem regressão
- 424 smokes Swift originais verdes sem regressão
- Curva oficial do motor (Celta Bubi 18/05) intocada
- Pista oficial de Brasília intocada — selo DEFINITIVO respeitado
- Voltas sintéticas continuam ZERO

## O que foi acrescentado

- 12 testes Swift novos (SE6-01..06 + TA-01..06)
- 12 testes JS novos
- 7 colunas em `segment_executions` (espelho local)
- 1 evento novo no Detector (`onSegmentPostBurst`)
- 1 componente SwiftUI reutilizável com 3 previews
- 1 função pura no advisor (JS + Swift)

## Validação executada

- `cd ios/p1fast-core && swift build` → BUILD SUCCESS
- `cd ios/p1fast-core && swift run p1fast-smoke` → **436 ok / 0 fail**
- `node tests/node-smoke-segment-six-indicators.mjs` → **6 ok / 0 fail**
- `node tests/node-smoke-trecho-advisor.mjs` → **6 ok / 0 fail**
- `node tests/node-smoke-detector.mjs` → 3 ok / 0 fail
- `node tests/node-smoke-detector-snapshot.mjs` → 15 ok / 0 fail
- `npm run smoke` → centenas de testes verdes, zero falhas
- `xcodebuild ... -sdk iphonesimulator` → BUILD SUCCEEDED
- `xcodebuild ... -sdk iphoneos` → BUILD SUCCEEDED
- `xcrun devicectl device install` → instalou em `com.flaviomarques.p1fast` no iPhone 16 Pro Max (`2D6E7A3B-...`)

## Checagem contra o pedido original

| Item do plano | Status |
|---|---|
| 5 indicadores faltantes calculados durante stint | concluído |
| Persistidos no banco local | concluído |
| Smokes Node + Swift | concluído |
| Tela pós-stint mostra os 6 indicadores | concluído |
| Aba "Desempenho" no detalhe da pista | NÃO — tela inexistente, adiada |
| IA por trecho (1 conselho) | concluído |
| Pós-stint apenas (não ao vivo) | concluído |
| Smokes 5 cenários | concluído (6 cenários cada) |
| App empacotado e instalado | concluído |
| Captura de tela do iPhone | NÃO — idevicescreenshot bloqueado |
| Relatório HTML único | concluído (aberto no navegador) |
| Memória atualizada | concluído |

## Pendências ou riscos

- `idevicescreenshot` bloqueado — sem screenshot do iPhone real
- Servidor Supabase não conhece as 7 colunas — migration paralela aguarda autorização ("MIGRAR PARA PRODUÇÃO")
- Aba "Desempenho" no detalhe da pista — pendência consciente

Status final: **concluído** com 2 limitações honestamente declaradas.
