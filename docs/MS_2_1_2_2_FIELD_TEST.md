# Teste de campo — MS-2.1 + MS-2.2

**Quando usar:** após mergear PR #93 (MS-2.1) + PR #95 (MS-2.2), antes de fazer MS-2.3.
**Onde:** iPhone real, qualquer lugar com céu aberto (varanda, quintal). Não precisa pista.
**Tempo:** ~10 min.
**Objetivo:** confirmar que CoreMotion + GPS + wake lock + background mode funcionam como esperado antes de empilhar mais código em cima.

Build no simulador não diz nada sobre nada disso — sensores são fakes, GPS é mockado, idle timer é ignorado, low power não existe.

---

## 0. Pré-requisitos

- iPhone físico (16 Pro Max é o baseline da ADR-018, mas qualquer iOS 17+ deve dar conta).
- Cabo USB-C ou pareamento Wi-Fi com Mac.
- Xcode aberto no projeto `ios/p1fast-ios/p1fast-ios.xcodeproj`.
- Branches `feat/ms-2-1-live-telemetry-recorder` e `feat/ms-2-2-wake-lock-background` mergeadas em `main` (ou checkout local de `feat/ms-2-2-wake-lock-background` se quiser testar antes do merge).

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

### 3.2. Captura 30s parado

Com o iPhone parado em cima da mesa, com vista pro céu:

1. **INICIAR**.
2. Esperar 30s. Olhar os números:
   - **IMU**: deve estabilizar em ~100 Hz (entre 99.5 e 100.5) com jitter < 1 ms (idealmente < 0.5 ms).
   - **GPS**: deve estabilizar em ~1 Hz com jitter < 100 ms (varia muito).
   - **Amostras gravadas** deve estar subindo continuamente (~3000 amostras IMU + ~30 GPS após 30s).
3. **PARAR**.
4. Linha "Última captura: X amostras gravadas em telemetry_samples" aparece.

> Se IMU ficar travado em 0 Hz: motion não startou. Provável que a permissão Motion não foi concedida.
> Se GPS ficar em 0 Hz: tá indoor sem fix. Ir pra varanda/janela.
> Se IMU der < 50 Hz com jitter > 5 ms: pode ser Low Power Mode ativo (banner deve aparecer) ou device velho.

### 3.3. Verificar persistência no SQLite

Sair do app **sem** desinstalar. No terminal do Mac:

```bash
# Achar o sandbox do app no simulador (se rodou pelo simulador)
# OU baixar o container do device físico:
xcrun devicectl device list-devices               # achar device id
xcrun devicectl device get app-container --device <DEVICE_ID> --bundle-id com.flaviomarques.p1fast --user-id <USER_ID>
# OU mais simples: Xcode → Window → Devices and Simulators → seleciona iPhone → Apps → p1fast-ios → engrenagem → Download Container...
# Salva como p1fast.xcappdata; click direito → Show Package Contents → AppData → Documents → p1fast.sqlite
```

Com o `p1fast.sqlite` em mãos:

```bash
sqlite3 p1fast.sqlite <<'EOF'
SELECT COUNT(*) AS total,
       MIN(seq) AS seq_min,
       MAX(seq) AS seq_max,
       MIN(t)/1000 AS t_inicio_unix,
       MAX(t)/1000 AS t_fim_unix
FROM telemetry_samples
WHERE sessao_id LIKE 'telemetria-demo-%';

-- Sample IMU representativo
SELECT json_extract(payload,'$.source')      AS source,
       json_extract(payload,'$.accX')         AS accX,
       json_extract(payload,'$.accY')         AS accY,
       json_extract(payload,'$.accZ')         AS accZ,
       json_extract(payload,'$.gyroAlpha')    AS gyroAlpha
FROM telemetry_samples
WHERE sessao_id LIKE 'telemetria-demo-%'
  AND json_extract(payload,'$.source') = 'iphone-imu'
LIMIT 3;

-- Sample GPS representativo
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
EOF
```

**O que esperar:**
- `total` ~3000 (30s × ~100 Hz IMU + ~30 GPS) — **bate** com o "Amostras gravadas" da tela?
- `seq_min = 0`, `seq_max = total - 1` (sequência contígua sem buracos).
- IMU: `accX`, `accY`, `accZ` perto de 0 (parado). `accZ` pode estar perto de 0 também porque `userAcceleration` já tira gravidade. **Se `accZ` perto de -9.81, é bug — quer dizer que tá pegando `gravity` em vez de `userAcceleration`.**
- GPS: `lat`/`lng` reais do local. `kmh ≈ speed × 3.6`. `acc < 10` em céu aberto.

> Se total = 0: nada foi gravado. Possíveis causas: sessão não foi criada, FK quebrou, flush não rodou.
> Se seq tem buracos: corrida de race condition no flush. Reportar.

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
2. Anotar contador "Amostras gravadas".
3. Apertar botão lateral do iPhone → **trava a tela** (não fecha o app, só lock).
4. Esperar **1 minuto** com iPhone trancado.
5. Destravar → voltar pra TelemetriaView.
6. Contador deve estar **maior** que antes (~60 GPS samples a mais = 60s × ~1 Hz, e provavelmente 0 IMU porque CoreMotion pausa quando tela trava — isso é normal e esperado).
7. **PARAR**.

> Se contador igual: background location não tá funcionando. Verificar `UIBackgroundModes:[location]` no Info.plist E `allowsBackgroundLocationUpdates = true`.
> Se IMU continuar subindo com tela trancada: incomum mas não é bug — algumas configurações mantêm.

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

## 5. Resumo de aceite

Critério mínimo pra mergear #93 + #95 com confiança:

- [ ] Diálogos de permissão Motion + Location aparecem na primeira run.
- [ ] IMU 95-105 Hz / jitter < 1 ms parado.
- [ ] GPS ~1 Hz, lat/lng coerentes com local.
- [ ] Tela não dorme durante captura.
- [ ] GPS continua gravando com tela travada (~60 amostras a mais em 1 min).
- [ ] Banner Low Power Mode aparece e some na hora.
- [ ] SQL retorna 100% das amostras esperadas, seq contíguo.
- [ ] `kmh = speed × 3.6` no payload.

Se 7/8 passarem com explicação razoável pro 1 que falhou, mergeia.
Se < 7/8 ou algum falhou de jeito esquisito, abre issue antes de seguir.

---

## 6. Quando passar

1. Mergear #93 (squash ou merge) → `main`.
2. PR #95 vira automaticamente baseada em `main` (GitHub atualiza). Mergear.
3. Próximo: **MS-2.3 (você)** — botão no `StintModalView` que dispara `LiveTelemetryRecorder` no início do stint real e finaliza no encerramento.
4. Depois MS-2.6 (wire Detector) → MS-2.5 (StintRepository.finalize consome eventos).

---

## 7. Quando NÃO passar

- Anotar qual teste falhou + sintoma exato (Hz observado, mensagem de erro, output do SQL).
- NÃO mergear.
- NÃO empilhar mais código em cima.
- Reportar e a gente abre fix antes do merge.
