# RACEBOX_INTEGRATION_SPEC — Especificação RaceBox Mini

> **STATUS: HIPÓTESE PARCIAL — DOCUMENTAÇÃO OFICIAL DISPONÍVEL SOB NDA LEVE**
>
> O fabricante (RaceBox) disponibiliza o protocolo BLE via formulário em `racebox.pro/products/mini-micro-protocol-documentation` (preencher email/nome/empresa). Antes de implementar, Flavio precisa preencher o formulário e repassar o PDF para que esta spec seja atualizada com os campos oficiais.
>
> Ver [`BLOCKERS.md`](../../BLOCKERS.md) §E4 + memória [`fam-racing-dominio.md`](../../../../.claude/projects/-Users-imac-Projetos-FAM-Racing/memory/fam-racing-dominio.md).

## Contexto

O RaceBox Mini é a fonte principal proposta para dinâmica veicular e posição. Hardware confirmado pela memória do projeto:

- GNSS 25 Hz rastreando GPS + GLONASS + Galileo + BeiDou simultaneamente
- Precisão até 10 cm (99,5% dentro de 1/100s)
- IMU: acelerômetro ±8g + giroscópio ±320°/s
- Bluetooth 5.2
- Bateria LiPo 1100 mAh (~20h)
- USB-C para carga

Decisão arquitetural (`fam-racing-hardware.md`): pareado com o **Mini PC** (não com iPhone). Mini PC fica sempre no carro; permite o iPhone sair sem perder telemetria inercial/GNSS.

## Arquitetura proposta

```
RaceBox Mini ── BLE 5.2 ──▶ Mini PC Windows ──▶ RaceBoxReader
                                                  ↓
                                              telemetrySamples (source: 'racebox')
                                                  ↓
                                              TelemetryTimebase
                                                  ↓
                                              CarTelemetrySnapshot
```

## Canais esperados

Lista derivada da capacidade declarada do hardware. Layout binário exato depende do PDF oficial.

### GNSS

| Canal | Unidade canônica | Range esperado | Taxa | Notas |
|---|---|---|---|---|
| `lat` | grau decimal (WGS84) | -90..90 | 25 Hz | resolução submétrica |
| `lng` | grau decimal (WGS84) | -180..180 | 25 Hz | |
| `alt` | metros | -500..6000 | 25 Hz | menos preciso que lat/lng |
| `speed` | m/s | 0..100 | 25 Hz | derivada do GNSS, validar vs CAN |
| `heading` | graus (0..360) | 0..360 | 25 Hz | indefinido a velocidades muito baixas |
| `gpsAccuracy` | metros | 0.1..50 | 25 Hz | fonte da `signalQuality` |
| `numSatellites` | inteiro | 0..40 | ≤25 Hz | < 6 → `DEGRADED`; < 4 → `BAD` |
| `pdop` | adimensional | 0..50 | ≤25 Hz | dilution of precision |
| `fixType` | enum | none / 2D / 3D / DGPS | ≤25 Hz | nenhum fix → `LOST` |

### IMU

| Canal | Unidade canônica | Range | Taxa | Notas |
|---|---|---|---|---|
| `accLong` | m/s² | ±8g (~±78 m/s²) | 100 Hz | |
| `accLat` | m/s² | ±8g | 100 Hz | |
| `accVert` | m/s² | ±8g | 100 Hz | inclui gravidade ou sem (a confirmar pelo PDF) |
| `gyroX` (roll rate) | °/s | ±320 | 100 Hz | |
| `gyroY` (pitch rate) | °/s | ±320 | 100 Hz | |
| `gyroZ` (yaw rate) | °/s | ±320 | 100 Hz | central para análise de curva |

### Tempo

| Canal | Unidade | Notas |
|---|---|---|
| `gnssTime` | timestamp UTC do receptor GNSS | precisão sub-µs após fix |
| `tMono` | `performance.now()` ms (canônico para deltas, ADR-015) | preenchido na recepção pelo Mini PC |
| `t` | `Date.now()` ms (auditorial) | idem |

## Categorias de uso

### Linha de corrida e mapa
`lat`, `lng`, `heading` — alimentam `Detector` (cruzamento de linha de chegada), `PathMapper` (snap), `Corredor` (traçado consolidado).

### Dinâmica de curva
`accLong`, `accLat`, `gyroZ` — alimentam `FaseCurva` (INICIO/MEIO/FIM), `apex_actual` (ponto de menor velocidade dentro do MEIO), inferência de subesterço/sobresterço.

### Inferência de frenagem
`accLong < limiar`, queda de `speed` — alimentam `DrivingEventDetector` (frenagem inferida — ver Regra 4 das `TELEMETRY_ENGINEERING_RULES.md`).

### Validação cruzada com T4000
- `speed (RaceBox)` vs `velocidade CAN (T4000)`
- `accLong` vs `derivada(speed)`
- `gyroZ` vs `heading rate`

Detalhe em `CROSS_VALIDATION_RULES.md`.

## Particularidades

1. **GNSS não funciona em túnel ou cobertura forte.** Queda de fix → `signalQuality: 'lost'`, marcar `MISSING` nos canais GNSS, manter IMU se disponível, alimentar análise como modo degradado.
2. **IMU tem drift.** Calibração antes do stint (carro parado em superfície plana). Ainda assim, drift acumula em sessão longa. Cross-check com GNSS quando ambos disponíveis.
3. **Bluetooth tem latência variável** (típico 20-100 ms, picos > 500 ms quando saturação). Marca `tMono` na recepção; latência > limiar vira `LATE`.
4. **Pacotes BLE podem chegar fora de ordem ou duplicados.** Reordenar por timestamp interno do RaceBox; descartar duplicados.

## Comportamento sob falha

- Conexão BLE perdida: `signalQuality: 'lost'`, evento auditável, UI mostra. Tentativa de reconexão automática a cada N segundos.
- Bateria < limiar: ATENÇÃO no Box.
- Discrepância entre `gnssTime` e `tMono` cresce monotonicamente: clock drift do Mini PC, não da RaceBox; manter `tMono` como canônico.
- Gap de fix GNSS > T segundos: degradar análise dependente de posição; manter IMU.

## Implementação proposta

Módulos novos:

- `src/telemetry/racebox-ble-reader.js` — driver BLE (Windows.Devices.Bluetooth ou Bleak Python; equivalente Node se for runtime JS no Mini PC)
- `src/telemetry/racebox-packet-parser.js` — decodifica pacotes BLE conforme PDF oficial (a obter)
- `src/telemetry/racebox-provider.js` — herda `TelemetryProvider`, `source: 'racebox'`

Spec de testes (Regra 9 das `TELEMETRY_ENGINEERING_RULES.md`):

- pacote BLE válido (caso feliz)
- pacote BLE com checksum/CRC inválido
- pacote duplicado (mesmo timestamp interno)
- pacote fora de ordem
- gap de fix GNSS (4+ segundos sem posição)
- IMU drift simulado
- BLE desconectado e reconectado
- bateria baixa reportada

## Validação contra implementação atual

**Estado em 2026-04-24:** o enum `source` em `src/telemetry/provider.js` lista `'racebox'`, mas nenhuma classe `RaceBoxProvider` existe. Zero código BLE.

`DeviceProvider` (`src/telemetry/device-provider.js`) é o substituto temporário: usa `navigator.geolocation` + `DeviceMotionEvent` no iPhone (Perna 1 da arquitetura). Quando `RaceBoxProvider` for implementado, ele vira fonte primária e `DeviceProvider` continua disponível como fallback ou para outros devices.

## Próximos passos

1. Flavio preenche formulário em `racebox.pro/products/mini-micro-protocol-documentation` e repassa PDF.
2. Atualizar este documento com layout binário oficial, marcar `STATUS: CONFIRMADO` por canal.
3. Implementar `racebox-ble-reader.js` + parser + provider, com testes obrigatórios.
4. Integrar via `TelemetryTimebase`.
5. Pareado com Mini PC: validar conexão BLE persistente em conditions de carro (vibração, EMI).
