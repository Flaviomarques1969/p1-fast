# Sprint 1B — Cockpit ao vivo (design)

> Status: **proposta**, não implementado. Documento pré-prompt pra travar
> escopo antes do Sprint começar. Sucessor natural de Sprint 1A.3 (resto
> do hub) — entra quando hub estiver minimamente operacional pra um
> piloto cadastrar carro/evento/stint.

## O que é

O cockpit é a **tela ao vivo na pista** — display 956×440 (iPhone landscape
em berço) que o piloto olha durante o stint. Lê telemetria da própria
captura local (CoreMotion + CoreLocation a 10Hz) e renderiza:

- Delta vs referência (volta atual ou ghost de outra volta)
- Comando ativo (SOLTE FREIO, GIRE, ABRA, etc.)
- Mapa da curva atual com dots por fase
- Stint-bar de progresso
- Halos visuais (recorde stint, pior stint, best all-time)
- Faixas térmicas (chuva visual indicando aquecimento/cooldown)

Mockups canônicos: 3 variantes em `_design-reference/`:
- `mockup-cockpit-piloto.html` — base (970 linhas) — modo "stint normal"
- `mockup-cockpit-ghost.html` — variante (1424 linhas) — overlay de ghost
  de volta de referência + halos térmicos
- `mockup-cockpit-comparacao.html` — variante (407 linhas) — split-screen
  comparando duas voltas

## Por que separado do hub (Sprint 1A.x)

1. **Captura de telemetria** ao vivo — CoreMotion + CoreLocation a 10Hz
   exigem foreground mode + Wake Lock + power management. Hub não usa.
2. **Performance crítica** — qualquer jank visível na tela durante a
   pista = piloto perde info. Hub aceita 60fps com algum overshoot.
3. **Modo orientação landscape** — cockpit é fixo landscape, hub é
   portrait. Coexistência exige roteamento explícito por tela.
4. **Contrato visual mais rígido** — mockup B do hub é "site bonito";
   cockpit é "instrumento operacional" — qualquer alteração visual
   precisa de validação em luz solar direta + leitura periférica.

## Componentes a construir

### Captura (foreground)

`p1fast-core/Capture/` — port em Swift de `src/pipeline/mobile-telemetry.js`:

- `MotionCaptureSource` (CoreMotion) — IMU a 10Hz, sample shape canônico
  (`t`, `tMono`, `accLong`, `accLat`, `accVert`, `gyroX/Y/Z`)
- `LocationCaptureSource` (CoreLocation) — GPS a 1Hz com `desiredAccuracy =
  kCLLocationAccuracyBestForNavigation`
- `SampleMerger` — junta IMU + GPS num stream unificado, escreve em
  `telemetry_samples` (já existe TelemetryUploader pra subir batch)
- Wake lock via `UIApplication.shared.isIdleTimerDisabled = true`
- Background mode em Info.plist: `location` + `processing`
- `LowPowerModeMonitor` — detecta `ProcessInfo.isLowPowerModeEnabled`
  e ajusta sample rate (10 → 5Hz se baixo)

### Pipeline em tempo real

`p1fast-core/Cockpit/` — orquestração ao vivo:

- `CockpitState` (`@Observable`) — estado renderizável (volta atual,
  parcial atual, delta, comando, mapa segment, halo state)
- `LapDetector` — port de `src/telemetry/detector.js` — emite eventos
  `onSegmentEnd`, `onLapEnd`, `onTrechoEnter/Exit`
- `DeltaCalculator` — vs volta de referência (PB do dia, PB all-time,
  ghost selecionado pelo piloto)
- `CommandResolver` — Mapa lição focada → comando ativo (port de
  `src/domain/p1-coach.js` — já portado em `P1Coach.swift`)
- `HaloController` — gerencia transições recorde-stint / pior-stint /
  best-alltime com ease

### UI cockpit (SwiftUI landscape fixo)

`p1fast-ios/Sources/Cockpit/` — 3 telas:

- `CockpitPilotoView` — base. Layout 956×440 com:
  - Header 4 fases (entrada/freio/ápice/saída) com underline colorido
    por fase (decisão #4 da minha proposta `_design-reference/proposta-cockpit-ghost-revisao.html` que foi descartada — conferir se vale ressuscitar ou seguir mockup canônico literal)
  - Bloco central: delta + comando + ref ancorado
  - Mapa SVG da curva à direita com dots por fase
  - Stint-bar inferior 12 segments com cursor ativo
- `CockpitGhostView` — extensão com:
  - Halo radial (recorde/pior) animado
  - Chuva térmica overlay (warmup azul / cooldown vermelho)
  - Ghost line da volta de referência
- `CockpitComparacaoView` — split-screen 2 voltas

Tokens novos do cockpit (não estão em Theme.swift do hub):
- `--halo-recorde`, `--halo-pior`, `--halo-best-alltime`
- `--warmup-1/2/3`, `--cooldown-1/2/3` (gradient warmup/cooldown)
- `--rain-aquec`, `--rain-resfri`

Pré-extração: rodar `node tools/extract-hub-tokens.mjs` modificado pra
ler `mockup-cockpit-*.html` e gerar `docs/THEME_TOKENS_COCKPIT.md`
antes do Sprint começar (prep work pré-#1B).

### Áudio (opcional V1)

`p1fast-ios/Sources/Cockpit/Audio/` — reproduz cues:

- "click" no cruzamento de parcial
- TTS curto pra comando ativo (AVSpeechSynthesizer)
- Configurável on/off — pode atrapalhar piloto

## Fluxos

### Fluxo feliz — começa stint
```
1. Hub: piloto cria stint (Sprint 1A.3 #11)
2. Hub: tap "Iniciar stint" → push CockpitPilotoView (rotation lock landscape)
3. Captura starts:
   - Wake lock ON
   - MotionCaptureSource.start (10Hz)
   - LocationCaptureSource.start (1Hz, BestForNavigation)
   - SampleMerger escreve em telemetry_samples
4. LapDetector observa stream → emite eventos pra CockpitState
5. UI re-renderiza @ 60fps via @Observable
6. Stint-bar avança conforme parciais cruzam linha
```

### Fluxo finalização
```
1. Piloto entra no box → tap "Finalizar stint"
2. Captura para
3. Wake lock OFF
4. CockpitState.snapshot → grava sessao.dataFim + voltas no GRDB
5. Push pra PósStintView (Sprint 1A.3 #11) com voltas + tags
6. TelemetryUploader (background) drena samples pra Edge `ingest`
```

### Fluxo crash recovery
```
1. App crash durante stint
2. Reabertura: detecta sessao.status='ativa' sem dataFim
3. Mostra dialog "Stint anterior interrompido — finalizar agora?"
4. Yes → calcula voltas a partir do último sample, marca dataFim
5. No → marca status='abandonada'
```

## Decisões abertas

1. **Modal landscape forçado vs respeita orientação?** Mockup é fixo
   landscape mas iOS por padrão segue rotation lock do device.
   Sugestão: forçar landscape via `supportedInterfaceOrientations`
   override só na CockpitView.

2. **CarPlay?** Cockpit no display do carro via CarPlay seria
   killer mas exige aprovação Apple (CarPlay templates restritos —
   instruments não é categoria padrão). Provavelmente fora do V1.

3. **Apple Watch como segunda tela?** Mostrar delta + comando no
   pulso seria útil pra glance sem tirar olho da pista. Watch app
   separado, lê via WatchConnectivity.framework.

4. **Detector ao vivo vs replay?** Hoje `src/telemetry/detector.js`
   roda em batch (após sessão). Cockpit ao vivo precisa do detector
   processando streaming. Port preciso isolar effects/output stream.

5. **Pipeline JS reutilizado via JavaScriptCore?** ADR-018 deixou
   essa decisão aberta. P1FastCore tem implementação Swift de
   parte do pipeline (Lesson, P1Coach, TrajectoryMonitor). Decidir:
   continuar portando, ou embarcar JS via JavaScriptCore pra paridade
   total?

6. **Buffer de samples antes de UI render?** A 10Hz cada sample
   pode disparar re-render. Buffer de N samples (ex: 5 = 500ms)
   reduz pressure no SwiftUI runtime. Trade-off: latência visível
   no delta de 500ms.

7. **Modo offline puro?** Cockpit precisa de internet? GPS
   funciona offline; dados de referência (volta PB, ghosts) podem
   estar 100% locais. Sugestão: cockpit é zero-network. Sync
   acontece antes (pull) e depois (drainer + uploader).

## Escopo — quebra em prompts

8 prompts estimados:

| # | Tarefa | Tamanho | blockedBy |
|---|---|---|---|
| 1B-1 | Captura: MotionSource + LocationSource em p1fast-core + smoke | M | Sprint 1A.3 inteiro |
| 1B-2 | SampleMerger + write em telemetry_samples + smoke | S | 1B-1 |
| 1B-3 | LapDetector port — port de detector.js → Swift, smoke replay | L | 1B-2 |
| 1B-4 | CockpitState + DeltaCalculator + CommandResolver + smoke | M | 1B-3 |
| 1B-5 | CockpitPilotoView (base) + screenshot | M | 1B-4 |
| 1B-6 | CockpitGhostView (halos + chuva térmica) | M | 1B-5 |
| 1B-7 | CockpitComparacaoView (split-screen) | S | 1B-5 |
| 1B-8 | Crash recovery + finalização atomicidade + smoke E2E | M | 1B-4 |

Total ~8 prompts, ~2-3 sprints. Pode rodar em paralelo: 1B-6 e 1B-7
após 1B-5; 1B-8 após 1B-4.

## Pré-requisitos antes de começar 1B

- [ ] Sprint 1A.3 completo (stint criável + finalizável via hub)
- [ ] Decisões 1-7 acima resolvidas
- [ ] Pré-extração de tokens cockpit (`THEME_TOKENS_COCKPIT.md`)
- [ ] Decisão sobre JavaScriptCore vs port nativo do pipeline
- [ ] Background modes adicionados ao Info.plist
- [ ] Apple Developer account com capabilities corretas pra
      background location

## Métrica de sucesso 1B

App iOS no iPhone físico no berço do carro permite:
1. Iniciar stint via hub
2. Cockpit abre automaticamente em landscape
3. Captura GPS + IMU a 10Hz consistentes (medidos no smoke)
4. Detector emite eventos por parcial e por volta sem missed events
5. Delta vs referência atualizado < 200ms latency
6. UI sem jank visível em luz solar direta
7. Stint finaliza sem perda de samples (uploaded via TelemetryUploader)

## Não-objetivos 1B

- Análise pós-stint avançada (gráficos, comparações multi-volta) —
  Sprint 1C
- Telemetria via OBD-II (ECU do carro) — Sprint 2+
- Multi-piloto na mesma sessão — não previsto
- Coach ao vivo via voz (TTS pra correção em curva) — Sprint 1C
- Vídeo overlay (GoPro stream) — fora do escopo P1 Fast
