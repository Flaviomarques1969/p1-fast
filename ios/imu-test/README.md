# P1 Fast · IMU Test (Swift mini-app)

Mini-app descartável pra validar a premissa que motivou a [ADR-018](../../ARCHITECTURE_DECISIONS.md):
**CoreMotion + CoreLocation no iPhone real entregam 10 Hz consistentes
sob condições reais (Wi-Fi calmo, carro, sol, vibração)?**

Sem isso provado, qualquer trabalho de UI Swift está sendo feito em cima de areia.

## O que o app mostra

- 4 KPIs ao vivo: **IMU Hz** · **IMU jitter ms** · **GPS Hz** · **GPS jitter ms**
- Leituras cruas: accLong / accLat / accVert (m/s²) + lat / lng / speed / gpsAcc
- Contador de amostras
- Botões `INICIAR` · `PARAR` · `EXPORTAR CSV` (Share Sheet → AirDrop / iCloud / Mail)

Critérios verdes:
- IMU Hz ≥ 50 (pedimos 100, aceitável ≥ 50)
- IMU jitter < 5 ms
- GPS Hz ≥ 1
- GPS jitter < 200 ms

Se todos verdes em movimento, ADR-018 confirmada.

## Pré-requisitos

- macOS com **Xcode.app instalado** (não basta Command Line Tools).
  Verificar: `xcode-select -p` deve apontar pra `/Applications/Xcode.app/...`
  Hoje aponta pra `/Library/Developer/CommandLineTools` — instalar Xcode primeiro
  na App Store (~10 GB, demora). Após instalar, rodar:
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- iPhone físico (simulator não tem CoreMotion real)
- Apple ID grátis basta pra testar via cabo (assinatura paga só pra App Store)

## Setup do projeto Xcode

1. Abrir Xcode → **File** → **New** → **Project**
2. iOS → **App** → Next
3. Preencher:
   - Product Name: `P1FastIMUTest`
   - Team: seu Apple ID
   - Organization Identifier: `com.flaviomarques.p1fast`
   - Interface: **SwiftUI**
   - Language: **Swift**
4. Save em uma pasta qualquer (não precisa ser dentro do repo P1 Fast).
5. No projeto criado, **substituir** os arquivos default pelos 3 daqui:
   - `P1FastIMUTestApp.swift` (sobrescreve o `<NomeDoApp>App.swift`)
   - `ContentView.swift` (sobrescreve o que veio)
   - `CaptureService.swift` (arquivo novo)
6. Adicionar as 2 chaves de privacidade do `Info.plist.fragment.txt` no
   target → **Info** → Custom iOS Target Properties (botão **+** pra cada).
7. Plugar o iPhone via USB. Confirmar "confiar neste computador".
8. No Xcode, selecionar seu iPhone como destino (canto superior).
9. Apertar **Run** (▶).
10. Na primeira vez o iPhone vai reclamar de "developer não verificado":
    iPhone → Configurações → Geral → VPN e Gerenciamento de Dispositivo →
    confiar no certificado do seu Apple ID.

## Roteiro de teste

| Cenário | Onde | Ação | Esperado |
|---|---|---|---|
| Baseline (parado) | Mesa, Wi-Fi | INICIAR · 60s · PARAR · EXPORT | IMU ≥ 80 Hz, GPS ≥ 1 Hz, jitter baixo |
| Tela apagada | Mesa, bloquear tela 30s | INICIAR · bloquear · desbloquear · PARAR | Confirmar se Hz cai (esperado: cai porque sem wakelock) |
| Carro parado, sol | No carro, sob sol direto | INICIAR · 60s · PARAR | Confirmar throttling térmico — Hz pode cair se iPhone esquentar |
| Trajeto curto | Volta de quarteirão a 40 km/h | INICIAR · 5 min · PARAR | Hz constante, jitter < 10 ms IMU |
| Track day (futuro) | Brasília, stint 20 min | INICIAR · stint inteiro · PARAR | Validação final |

Para cada cenário, exportar o CSV e guardar com nome descritivo
(`baseline-mesa.csv`, `carro-parado-sol.csv`, etc).

## Análise dos CSVs

CSV tem 10 colunas: `ts_iso, tMono_s, kind, accLong_ms2, accLat_ms2, accVert_ms2, lat, lng, speed_ms, gpsAcc_m`.

Análise rápida pra calcular Hz real:
```bash
# IMU Hz médio
awk -F, '$3=="imu"' arquivo.csv | wc -l    # total amostras IMU
awk -F, '$3=="imu" {print $2}' arquivo.csv | head -1   # tMono primeiro
awk -F, '$3=="imu" {print $2}' arquivo.csv | tail -1   # tMono último
# Hz = (total - 1) / (último - primeiro)
```

## Status

- Código Swift escrito e revisado: ✓
- Privacy Info.plist documentado: ✓
- Xcode.app instalado no Mac: ✗ (pendente — instalar pela App Store)
- Projeto Xcode criado: ✗ (pendente)
- Build no iPhone: ✗ (pendente)
- Cenários de teste rodados: ✗ (pendente)

## Próximo passo (depois deste teste)

Se passar (ADR-018 confirmada): partir pro app real Swift seguindo `_design-reference/`.

Se falhar (Hz < 10 consistente em algum cenário real): dado novo, volta na ADR-018.
Mas a prova precisa ser DURA — não rejeitar nativo por causa de um cenário marginal.
