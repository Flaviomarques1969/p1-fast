# Manual de referência — sensores do iPhone (P1 Fast)

> **Status: BASELINE OFICIAL (2026-05-01)** — confirmado em 2 capturas independentes no iPhone 16 Pro Max do Flavio. Fonte primária da ADR-018.
>
> Use este documento como referência ao decidir o que pode ou não ser feito com IMU/GPS do iPhone, e como esses números se combinam com a ECU Injepro T4000 e (futuramente) o RaceBox.

## Tabela executiva — o que confiar

| Recurso | Valor confirmado | Meta ADR-018 | Margem | Veredicto |
|---|---|---|---|---|
| IMU sample rate | **100.6 Hz** | ≥ 80 Hz | +25% | OK |
| IMU jitter (stddev) | **0.30 ms** | < 3 ms | 10× melhor | OK |
| IMU jitter (max gap) | **12.36 ms** | < 30 ms | 2.4× melhor | OK |
| GPS sample rate | **0.98 Hz** | 1 Hz CoreLocation | esperado | OK |
| GPS accuracy (em movimento) | **2.31 – 5 m** | ≤ 10 m | OK | OK |
| GPS accuracy (cold start) | **13.9 m** (1º fix) | < 20 m | OK | OK |
| Range accLong testado | −1.08 g a +0.63 g | sensor aguenta ±8 g | margem 7× | sem saturação |
| Range accLat testado | −0.25 g a +0.36 g | sensor aguenta ±8 g | margem 22× | sem saturação |
| Range accVert testado | −0.93 g a +0.48 g | sensor aguenta ±8 g | margem 8× | sem saturação |

**Conclusão técnica:** o iPhone 16 Pro Max entrega IMU em frequência e estabilidade temporal **suficientes para uso em pista**. A combinação 100 Hz + jitter 0.30 ms torna viável a cross-validation V-002 (IMU × derivada de velocidade) com confiança.

## Capturas que sustentam estes números

### Captura 1 — `2026-05-01-indoor-57s`
- Hardware: iPhone 16 Pro Max, app `P1FastIMUTest`
- Duração: 57 s (indoor, parado)
- Amostras: 5 673
- IMU: **100.3 Hz**, jitter stddev **0.2 ms**
- GPS: degradado (indoor), conforme esperado
- Propósito: confirmar piso de frequência IMU em ambiente sem GPS

### Captura 2 — `2026-05-01-walking-31s`
- Hardware: iPhone 16 Pro Max, app `P1FastIMUTest`
- Duração: 31.79 s (caminhando, ambiente externo)
- Amostras: 3 228 (3 197 IMU + 31 GPS)
- IMU: **100.6 Hz**, jitter média **9.95 ms**, stddev **0.30 ms**, max gap **12.36 ms**
- GPS: **0.98 Hz**, accuracy **2.31 m → 13.90 m → 4.92 m média**
- Velocidade GPS observada: 0.85 a 1.54 m/s (5.5 km/h)
- Arquivo arquivado: [`baselines/iphone16promax-2026-05-01-walking-31s.csv`](baselines/iphone16promax-2026-05-01-walking-31s.csv)
- Propósito: confirmar IMU em movimento + comportamento real do GPS CoreLocation com primeiro fix

Ambas as capturas confirmam o número `≥80 Hz` exigido pela ADR-018 com folga estrutural.

## O que isso significa em pista

### Resolução temporal a velocidade típica de track day

| Velocidade | Distância por amostra IMU (10 ms) | Distância por amostra GPS (1 s) |
|---|---|---|
| 60 km/h | 0.17 m | 16.7 m |
| 120 km/h | 0.33 m | 33.3 m |
| 180 km/h | 0.50 m | 50.0 m |
| 220 km/h | 0.61 m | 61.1 m |

**Implicação:** em frenagem (mesmo a 220 km/h), o IMU captura cada 60 cm. Essa resolução é suficiente para detectar:
- início e fim da frenagem com precisão sub-metro
- transição de fase (freio → ápice → tração) em janelas <100 ms
- pequenas variações de tração e contra-esterço

GPS sozinho **não serve** para essas tarefas — só serve como âncora absoluta de posição (entrada de curva, distância pelo traçado).

### Acelerações típicas em pista vs. range testado

| Evento | g típico em pista | Range já validado no iPhone |
|---|---|---|
| Frenagem dianteira de competição | −1.2 a −1.8 g | até −1.08 g (caminhando) |
| Aceleração linear forte | +0.4 a +0.8 g | até +0.63 g (caminhando) |
| Apex em curva rápida | ±1.5 a ±2.5 g lateral | até ±0.36 g (caminhando) |

**Risco residual:** ainda não testamos o range completo de pista. O sensor (ICM-42688 do iPhone 16 Pro Max) aguenta ±8 g sem saturar, então a margem é grande. Mas a **calibração de filtros** (passa-baixa contra vibração de motor) só vai ser sintonizada com dado de pista real.

## Como combina com a Injepro T4000

A T4000 entrega via CAN bus a **100 Hz por canal** (5 pacotes × 8 bytes a cada 10 ms — ver [`T4000_CAN_SPEC.md`](T4000_CAN_SPEC.md)). Coincidência feliz: **mesma frequência do IMU do iPhone**.

### Divisão canônica de responsabilidade

| Sinal | Fonte primária | Fonte de cross-validation | Cadência efetiva |
|---|---|---|---|
| RPM | T4000 (CAN) | gear × velocidade | 100 Hz |
| Velocidade do veículo | T4000 (CAN) | GPS Doppler / IMU integrado | 100 Hz |
| TPS, MAP, λ, EGT | T4000 (CAN) | sem cross — confiar | 100 Hz |
| Pressão óleo, temp óleo, temp água | T4000 (CAN) | tendência por stint | 100 Hz |
| accLong, accLat, accVert | iPhone IMU | derivada da velocidade T4000 (V-002) | 100 Hz |
| Posição absoluta (lat/lng) | iPhone GPS | RaceBox GNSS (futuro) | 1 Hz |
| Heading / yaw rate | iPhone IMU integrado | mudança de heading GPS (>5 m/s) | 100 Hz IMU / 1 Hz GPS |

**Princípio:** cada amostra carrega `source` (`device | racebox | t4000-can | mock | replay`). Snapshot cruzado é construído pelo `TelemetryTimebase` (P0 da gate de telemetria).

### Cross-validations que ficam destravadas com este baseline

- **V-001 (velocidade T4000 vs GNSS)** — precisa GNSS de pelo menos 1 Hz com accuracy <10 m. iPhone entrega isso → V-001 viável só com iPhone, sem RaceBox no MVP.
- **V-002 (accLong IMU vs derivada da velocidade T4000)** — precisa IMU ≥50 Hz com jitter <5 ms. iPhone entrega 100 Hz / 0.30 ms → V-002 viável.
- **V-006, V-007, V-008** (validações internas T4000) — não dependem do iPhone.

### O que ainda precisa do RaceBox

- GNSS de alta cadência (10 Hz + RTK) para distância de traçado sub-metro
- Posicionamento absoluto consistente em traçados curtos onde 1 Hz não basta

Em outras palavras: **MVP pode rodar com iPhone + T4000**, RaceBox vira upgrade quando o produto exigir traçado fino.

## Limites — onde NÃO confiar no iPhone

1. **Vibração mecânica do motor + suspensão** — pode contaminar accLong/accLat. O `data-quality.js` tem passa-baixa, mas o limiar precisa ser sintonizado com dado de pista real. Antes disso, considerar V-002 com tolerância dobrada.
2. **Calor em carro fechado** — iPhone faz thermal throttling antes do CoreMotion cair. Se o aparelho passar de ~40 °C de superfície, taxa pode degradar para 50–80 Hz e GPS pode perder fix. Mitigação: ventilação forçada, evitar exposição direta ao sol pelo para-brisa.
3. **Fixação rígida ao chassi** — qualquer balanço do berço transforma accLat em ruído. Não é negociável: suporte tipo RAM Mount ou equivalente, parafusado.
4. **Bateria** — captura contínua a 100 Hz IMU + GPS + tela ligada drena ~30%/h. Stint de 30 min sem carregador não fecha com folga. Mitigação: carregador MagSafe ou cabo direto na alimentação do carro.
5. **GPS em túnel / paddock coberto / box** — fix cai. Não é problema de pista (sempre céu aberto), mas no in-lap pelo box o dado pode ser interpolado.
6. **Heading absoluto sem movimento** — abaixo de ~3 m/s o GPS não tem heading confiável (sem Doppler). IMU integrado deriva. Não usar heading parado.

## Como reproduzir o teste

```bash
# Instalar app no iPhone (certificado Personal Team expira a cada 7 dias)
cd "/Users/imac/Projetos/P1 Fast/ios/imu-test"
xcodegen generate
xcodebuild -project P1FastIMUTest.xcodeproj -scheme P1FastIMUTest \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates build

DEV="2D6E7A3B-1449-5BE6-8D82-18F969ED0CCB"
APP="/Users/imac/Library/Developer/Xcode/DerivedData/P1FastIMUTest-bajmlqoubxvnjbcgofaqlziimuhv/Build/Products/Debug-iphoneos/P1FastIMUTest.app"
xcrun devicectl device install app --device "$DEV" "$APP"
```

No iPhone: abrir `P1FastIMUTest`, iniciar captura, aguardar a duração desejada, parar, exportar CSV via Files/AirDrop.

### Análise do CSV (one-liner)

```bash
awk -F',' 'NR==1{next} $3=="imu"{imu++} $3=="gps"{gps++}
NR==2{t0=$2} {tlast=$2}
END {dur=tlast-t0;
  printf "Dur=%.1fs  IMU=%dHz  GPS=%.2fHz\n", dur, imu/dur, gps/dur}' \
  CAMINHO_DO_CSV.csv
```

### Critérios de aceitação para qualquer captura nova ser considerada baseline válida

- IMU Hz ≥ 80
- IMU jitter stddev < 3 ms
- IMU jitter max < 30 ms
- GPS Hz ≥ 0.9
- GPS accuracy média (após 5 s de warmup) < 10 m
- 0 amostras com `accLong/Lat/Vert` saturados em ±8 g (= ±78.4 m/s²)
- 0 amostras descartadas por NaN ou timestamp não-monotônico

Se algum critério falhar, **não promover** o CSV a baseline e investigar.

## Próximos testes recomendados (em ordem)

1. **Captura em deslocamento de carro urbano (10 min)** — valida GPS Hz com Doppler real, expõe acelerações de freio/acelerador típicas, sem riscos.
2. **Captura em pista rolando devagar (out lap)** — valida fixação no berço sob vibração baixa, primeira leitura honesta de accLat.
3. **Stint completo de track day (≥ 20 min)** — sintoniza filtros passa-baixa contra vibração real, valida bateria + térmica + GPS sob velocidade.
4. **Cross-check IMU iPhone × accLong T4000** — depois que parser CAN T4000 estiver implementado (`TelemetryProvider` source `t4000-can`), comparar accLong derivado da velocidade T4000 com accLong IMU. Tolerância V-002 a definir aqui.

## Histórico de revisões

| Data | Revisão | Motivo |
|---|---|---|
| 2026-05-01 | v1.0 | Documento criado a partir das 2 capturas iPhone 16 Pro Max (indoor 57s + caminhando 31.8s). Baseline oficial. |

## Referências cruzadas

- [`ARCHITECTURE_DECISIONS.md`](../../ARCHITECTURE_DECISIONS.md) — ADR-018 (decisão por iOS nativo Swift)
- [`T4000_CAN_SPEC.md`](T4000_CAN_SPEC.md) — spec do CAN bus da Injepro T4000
- [`RACEBOX_INTEGRATION_SPEC.md`](RACEBOX_INTEGRATION_SPEC.md) — spec do RaceBox (upgrade GNSS futuro)
- [`../CHIEF_TELEMETRY_ENGINEER_GATE.md`](../CHIEF_TELEMETRY_ENGINEER_GATE.md) — modelo `TelemetryProvider` + sources
- [`../../BLOCKERS.md`](../../BLOCKERS.md) §E2 — pendências hardware T4000
- [`baselines/iphone16promax-2026-05-01-walking-31s.csv`](baselines/iphone16promax-2026-05-01-walking-31s.csv) — CSV bruto que sustenta os números v1.0
