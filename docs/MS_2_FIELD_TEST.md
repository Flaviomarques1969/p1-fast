# Teste de campo — MS-2 (captura ao vivo completa)

**Quando usar:** depois que MS-2.1..2.6.b mergearam (PRs #93..#105 já em `main`) e antes de habilitar MS-2.5 (`StintRepository.finalize` consumindo Detector real). Esse teste valida o stack inteiro de captura ao vivo: raw → Kalman enriched → Detector vivo → linha de chegada.

**Onde:** iPhone real. Pra exercitar o Detector e ver "Voltas" subindo, precisa estar dentro do polígono de Brasília (o `SeedBrasilia.make()` está hardcoded na `TelemetriaView` até MS-2.6.c). Pra validar só captura raw + Kalman, qualquer lugar com céu aberto serve.

**Tempo:** ~15 min em céu aberto. Adicione +10 min se for ao circuito (pra fazer 2-3 voltas).

**Objetivo:** confirmar que CoreMotion + GPS + wake lock + background mode + Kalman + Detector funcionam juntos antes de empilhar mais código (MS-2.5 finalize).

> Build no simulador NÃO substitui esse teste — sensores são fakes, GPS é mockado, idle timer é ignorado, low power não existe, e o Detector não recebe lat/lng reais.

---

## 0. Pré-requisitos

- iPhone físico (16 Pro Max é o baseline da ADR-018, mas qualquer iOS 17+ deve dar conta).
- Cabo USB-C ou pareamento Wi-Fi com Mac.
- Xcode aberto no projeto `ios/p1fast-ios/p1fast-ios.xcodeproj`.
- `main` checked out e atualizado (`git pull origin main`).
- Migrations Supabase aplicadas (0007 + 0008 — confirmado em 2026-05-06).

---

## 1. Configurar launch arg `--p1-telemetria`

A `TelemetriaView` só aparece via launch arg. No Xcode:

1. Menu **Product → Scheme → Edit Scheme...** (ou `⌘<`).
2. Aba **Run** → **Arguments** → **Arguments Passed On Launch** → `+` → `--p1-telemetria`.
3. **Close**.

Da próxima vez que rodar (`⌘R`), o app abre direto na tela de telemetria.

> Pode deixar marcado/desmarcado entre runs. Quando quiser voltar à HomeView normal, só desmarcar.

---

## 2. Build no iPhone

1. Conectar iPhone, escolher como destino no header do Xcode (ao lado do nome do scheme).
2. **Product → Run** (`⌘R`).
3. Primeira vez: aceitar prompt de "Trust this developer" no iPhone (Ajustes → Geral → VPN e Gerenciamento de Dispositivos).

App abre na `TelemetriaView`.

---

## 3. Sequência de teste — fluxo principal

### 3.1. Permissões

Apertar **INICIAR** pela primeira vez:

- **Diálogo Motion** aparece com texto "P1 Fast usa o acelerômetro do iPhone..." → **Permitir**.
- **Diálogo Location** aparece com texto "P1 Fast usa GPS pra gravar a telemetria..." → **Permitir Quando em Uso**.

> Se algum diálogo NÃO aparecer, é bug de permissão (Info.plist sem a key, ou xcodegen apagou de novo). Reportar.

Linha "Permission status" deve mudar de `—` pra `GPS — em uso`.

### 3.2. Captura 30s parado em céu aberto

Com o iPhone parado em cima da mesa, com vista pro céu:

1. **INICIAR**.
2. Esperar 30s. Olhar os números na tela:

   | Métrica            | Esperado após 30s parado em céu aberto                                |
   |--------------------|------------------------------------------------------------------------|
   | **Amostras raw**   | ~3030 (3000 IMU + 30 GPS), subindo continuamente                       |
   | **Amostras enriched** | ~3030 (≈ raw). `LiveKalmanProcessor.process` empurra 1 enriched por sample raw (IMU + GPS), não só por GPS — pra ghost map vivo ter cadência 100Hz. Sufixo ` · fix` aparece após 1-3 GPS samples. |
   | **Detector**       | `~30 ok · ~3000 skip` (consome só GPS, ignora os 100 IMU/s)           |
   | **Voltas**         | `—` (sem cruzar linha de chegada)                                      |
   | **IMU**            | 99.5–100.5 Hz · jitter < 1 ms                                          |
   | **GPS**            | ~1 Hz andando · **0.05–0.2 Hz parado** (iOS rate-limita `kCLLocationAccuracyBestForNavigation` quando coordenada não muda) · jitter < 100 ms |

3. **PARAR**.
4. Linha "Última captura: X amostras raw · Y enriched" aparece no rodapé.

> **Sufixo `· fix` não apareceu nunca:** Kalman não pegou GPS nenhum. Provável que `processor.attach(to: recorder)` não rodou ou que GPS não emitiu sample com lat/lng finitos.
>
> **Detector com 0 ok:** `bridge.attach(to: recorder)` falhou OU nenhum GPS sample chegou. Ver coluna `skip` — se for 0 também, recorder está mudo.
>
> **Detector com `consumed > 0` mas `enriched · fix` ausente:** anomalia — Detector usa Sample bruto via Projector, Kalman usa Sample bruto via fusão. Se um pegou e o outro não, é bug.
>
> **IMU travado em 0 Hz:** motion não startou. Provável permissão Motion negada.
>
> **GPS travado em 0 Hz:** indoor sem fix. Ir pra varanda/janela.
>
> **IMU < 50 Hz com jitter > 5 ms:** Low Power Mode ativo (banner deve aparecer) ou device velho.

### 3.3. Verificar persistência no SQLite

Sair do app **sem** desinstalar. No terminal do Mac:

```bash
# Xcode → Window → Devices and Simulators → seleciona iPhone → Apps →
# p1fast-ios → engrenagem → Download Container...
# Salva como p1fast.xcappdata; click direito → Show Package Contents →
# AppData → Documents → p1fast.sqlite
```

Com o `p1fast.sqlite` em mãos:

```bash
sqlite3 p1fast.sqlite <<'EOF'
-- Volume bruto
SELECT 'telemetry_samples' AS tabela,
       COUNT(*) AS total,
       MIN(seq) AS seq_min,
       MAX(seq) AS seq_max
FROM telemetry_samples
WHERE sessao_id LIKE 'telemetria-demo-%';

-- Volume Kalman
SELECT 'telemetry_samples_enriched' AS tabela,
       COUNT(*) AS total,
       MIN(seq) AS seq_min,
       MAX(seq) AS seq_max,
       SUM(CASE WHEN source_kalman = 1 THEN 1 ELSE 0 END) AS com_fix,
       SUM(CASE WHEN source_kalman = 0 THEN 1 ELSE 0 END) AS pre_fix
FROM telemetry_samples_enriched
WHERE sessao_id LIKE 'telemetria-demo-%';

-- Sample IMU representativo (raw)
SELECT json_extract(payload,'$.source')      AS source,
       json_extract(payload,'$.accX')         AS accX,
       json_extract(payload,'$.accY')         AS accY,
       json_extract(payload,'$.accZ')         AS accZ,
       json_extract(payload,'$.gyroAlpha')    AS gyroAlpha
FROM telemetry_samples
WHERE sessao_id LIKE 'telemetria-demo-%'
  AND json_extract(payload,'$.source') = 'iphone-imu'
LIMIT 3;

-- Sample GPS representativo (raw)
SELECT json_extract(payload,'$.source')      AS source,
       json_extract(payload,'$.lat')          AS lat,
       json_extract(payload,'$.lng')          AS lng,
       json_extract(payload,'$.speed')        AS speed_ms,
       json_extract(payload,'$.kmh')          AS kmh,
       json_extract(payload,'$.acc')          AS acc_m
FROM telemetry_samples
WHERE sessao_id LIKE 'telemetria-demo-%'
  AND json_extract(payload,'$.source') = 'cockpit-mobile'
LIMIT 3;

-- Sample enriched representativo (Kalman)
SELECT seq, t_mono, x_m, y_m, vx_mps, vy_mps,
       heading_deg, pos_sigma_m, source_kalman
FROM telemetry_samples_enriched
WHERE sessao_id LIKE 'telemetria-demo-%'
  AND source_kalman = 1
ORDER BY seq
LIMIT 3;
EOF
```

**O que esperar:**

- `telemetry_samples`: `total` ~3030 (30s × 100 Hz IMU + 30 GPS). `seq` contíguo `0..total-1`.
- `telemetry_samples_enriched`: `total` ≈ `total` do raw (1 por sample IMU+GPS, não só GPS). `com_fix` ≥ `total - 3` (os 1-3 primeiros podem ser pré-fix). `seq` contíguo. Validado em campo 2026-05-06: 559s → 56314 raw + 56314 enriched, 56313 com_fix.
- IMU: `accX`, `accY` perto de 0 (parado). `accZ` perto de 0 também porque `userAcceleration` já tira gravidade. **Se `accZ` perto de -9.81 ou +9.81, é bug — quer dizer que tá pegando `gravity` em vez de `userAcceleration`.**
- GPS: `lat`/`lng` reais do local. `kmh ≈ speed × 3.6`. `acc < 10` em céu aberto.
- Enriched: `x_m`, `y_m` perto de 0 (origem é o primeiro fix). `vx_mps`, `vy_mps` perto de 0 (parado). `pos_sigma_m` < 10 após estabilizar.

> Se `total = 0` em raw: nada foi gravado. Possíveis causas: sessão não foi criada, FK quebrou, flush não rodou.
> Se `total > 0` em raw mas 0 em enriched: `LiveKalmanProcessor.attach()` não rodou ou writer falhou silencioso.
> Se `seq` tem buracos em qualquer das duas: race condition no flush. Reportar.
> Se `com_fix = 0`: Kalman não conseguiu inicializar (`hasFix` nunca virou `true`).

---

## 4. Sequência de teste — MS-2.2 (wake lock + background)

### 4.1. Tela não dorme

1. **INICIAR**.
2. Não tocar no iPhone por **1 minuto** (default lock screen é 30s).
3. Tela deve continuar acesa o tempo todo.
4. **PARAR**.
5. Esperar 30s sem tocar — agora a tela deve apagar normalmente.

> Se a tela apagar enquanto recording: `isIdleTimerDisabled` não tá sendo setado. Reportar.
> Se a tela ficar acesa pra sempre depois de parar: `stop()` não está revertendo. Reportar.

### 4.2. GPS em background

1. **INICIAR**.
2. Anotar contadores **Amostras raw**, **Amostras enriched** e **Detector ok**.
3. Apertar botão lateral do iPhone → **trava a tela** (não fecha o app, só lock).
4. Esperar **1 minuto** com iPhone trancado.
5. Destravar → voltar pra TelemetriaView.
6. Os 3 contadores devem estar **maiores** que antes:
   - **raw**: +60 GPS (e provavelmente 0 IMU porque CoreMotion pausa quando tela trava).
   - **enriched**: +60 (1 por GPS).
   - **Detector ok**: +60 (idem).
7. **PARAR**.

> Se contadores iguais: background location não tá funcionando. Verificar `UIBackgroundModes:[location]` no Info.plist E `allowsBackgroundLocationUpdates = true`.
> Se IMU continuar subindo com tela trancada: incomum mas não é bug — algumas configurações mantêm.
> Se raw subiu mas enriched/Detector não: pipeline de consumidores em background quebrou. Reportar.

### 4.3. Low Power Mode

1. Sair do app.
2. **Ajustes → Bateria → Modo de Baixo Consumo** → **ligar**.
3. Voltar pro app.
4. Banner amarelo deve aparecer imediatamente: "Low Power Mode ativo — IMU e GPS podem cair em frequência..."
5. **INICIAR** com Low Power ON.
6. IMU pode cair pra ~50 Hz, GPS pra ~0.5 Hz. Isso é a Apple decidindo. App não tem como forçar 100 Hz com LPM ativo.
7. **PARAR**, **Ajustes → Bateria → Modo de Baixo Consumo** → **desligar**.
8. Voltar pro app — banner some.

> Se banner não aparecer: `LowPowerModeMonitor` não tá observando a notification, ou `@StateObject` quebrou.
> Se banner ficar pra sempre depois de desligar LPM: `NSProcessInfoPowerStateDidChange` não chegou (raro).

---

## 5. Sequência de teste — MS-2.6 Detector + Voltas (opcional, em pista)

Esse passo só faz sentido **dentro do polígono de Brasília** (lat ~-15.77, lng ~-47.90). Em outro lugar o Detector consome samples mas não detecta linha de chegada porque a polyline `linhaChegada` é hardcoded em `SeedBrasilia.make()` até MS-2.6.c expor `TrackRepository.currentTrack`.

### 5.1. Volta dada a pé ou de carro lento

1. Estacionar fora do polígono (ou na largada parado).
2. **INICIAR**.
3. Andar/dirigir 1 volta cruzando a linha de chegada.
4. Olhar contador **Voltas** — deve incrementar de `—` pra `1 · última X.XXs` no momento que cruzar.
5. Continuar pra 2ª volta — incrementa pra `2 · última Y.YYs`.
6. **PARAR**.

> Se Voltas ficar em `—` mesmo cruzando: ou GPS está com lat/lng que cai fora do polígono (jitter pode atrapalhar perto da linha), ou Detector engoliu o sample como skip por outro motivo. Comparar com SQL `telemetry_samples_enriched` — se `total > 60` mas Voltas = 0, é o Detector.
> Se "última X.XXs" estiver absurdamente grande (>5min em volta de carro lento): Detector cruzou linha em uma direção e contou volta antes do tempo — provavelmente bug de orientação da `linhaChegada`.

> Voltas dadas a pé funcionam mas dão tempos altos (~5-10min) — não comparar com volta de pista.

---

## 6. Resumo de aceite

Critério mínimo pra desbloquear MS-2.5 (finalize com Vmin georef) com confiança:

**Bloco MS-2.1+2.2 (céu aberto, qualquer lugar):**

- [ ] Diálogos de permissão Motion + Location aparecem na primeira run.
- [ ] IMU 95-105 Hz / jitter < 1 ms parado.
- [ ] GPS ~1 Hz, lat/lng coerentes com local.
- [ ] Tela não dorme durante captura.
- [ ] GPS continua gravando com tela travada (~60 amostras raw a mais em 1 min).
- [ ] Banner Low Power Mode aparece e some na hora.
- [ ] SQL `telemetry_samples` retorna 100% das amostras esperadas, seq contíguo.
- [ ] `kmh = speed × 3.6` no payload.

**Bloco MS-2.6+2.7 novo (mesma sessão de céu aberto):**

- [ ] **Amostras enriched** sobe junto com **Amostras raw** (~1 enriched por sample raw, IMU+GPS — não só GPS).
- [ ] Sufixo `· fix` aparece após 1-3 GPS samples.
- [ ] **Detector** mostra `ok` próximo de número de GPS samples e `skip` próximo de número de IMU samples.
- [ ] SQL `telemetry_samples_enriched` retorna ~3030 rows em 30s, `source_kalman = 1` na maioria.
- [ ] `x_m`/`y_m` perto de 0 com filtro recém-fixado e iPhone parado.

**Bloco MS-2.6 voltas (opcional, só em Brasília):**

- [ ] Cruzar linha de chegada incrementa contador Voltas.
- [ ] Tempo da volta aparece e é coerente com a velocidade real.

Se 8/9 do bloco principal passarem com explicação razoável pro 1 que falhou, desbloqueia MS-2.5. Se < 8/9 ou algum falhou de jeito esquisito, abre issue antes de seguir.

---

## 7. Quando passar

1. Atualizar STATUS.md com data + outcome do field test (resumo das métricas observadas).
2. Atualizar `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/project_ms27_status.md` removendo "Field test E2E pendente".
3. Próxima frente: **MS-2.5** — `StintRepository.finalize` consome `Detector.onSegmentEnd` real e grava trio Vmin (`vmin_kmh/x/y`) em `segment_executions`. Migration 0007 já em prod desde 2026-05-06.

---

## 8. Quando NÃO passar

- Anotar qual teste falhou + sintoma exato (Hz observado, valor de contador, output do SQL).
- NÃO empilhar MS-2.5 em cima.
- Reportar e abrir fix antes de seguir. Backlog de itens a investigar:
  - Se enriched não sobe junto: olhar `LiveKalmanProcessor.attach()` e `EnrichedTelemetryWriter.appendBatch()`.
  - Se Detector skip > raw IMU count: bug de roteamento via `addSampleHandler`.
  - Se GPS background quebrou: revisitar `LowPowerModeMonitor` e `UIBackgroundModes`.
