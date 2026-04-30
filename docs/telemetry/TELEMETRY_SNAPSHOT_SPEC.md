# TELEMETRY_SNAPSHOT_SPEC — Snapshot unificado do carro

> **STATUS: ESTRUTURA PROPOSTA — IMPLEMENTAÇÃO PENDENTE**
>
> Construído por `TelemetryTimebase` (ver `TELEMETRY_TIMEBASE_SPEC.md`). Define a forma canônica do "estado do carro num instante T".

## Princípio

Snapshot **não é insight**. Snapshot é dado consolidado pronto para análise.

Insight (curva, frenagem, apex, alerta) é gerado por análises que CONSOMEM snapshots, não pelo snapshot em si.

## Estrutura `CarTelemetrySnapshot`

```js
{
  // Tempo
  t: 1735000000123,          // Date.now() ms — auditorial (ADR-015)
  tMono: 12345.678,          // performance.now() ms — canônico para deltas
  source_quality: 'good',    // pior qualidade entre fontes participantes
  synchronization_status: 'synced',  // 'synced' | 'partial' | 'degraded' | 'lost'

  // Motor (T4000)
  engine: {
    rpm: 6500,                  // rpm
    tps: 78,                    // %
    map: 0.95,                  // bar
    lambda: 0.92,               // adimensional
    oil_pressure: 4.2,          // bar
    oil_temp: 105,              // °C
    water_temp: 92,             // °C
    fuel_pressure: 3.5,         // bar
    fuel_temp: 35,              // °C
    battery_voltage: 13.8,      // V
    gear: 4,                    // enum 0..6
    egt: 750,                   // °C (se EGT-4 instalado)
    ecu_error: 0x0000,          // bitfield
  },

  // Veículo (fundido)
  vehicle: {
    speed_can: 38.2,            // m/s — fonte T4000
    speed_gnss: 38.5,           // m/s — fonte RaceBox/iPhone
    speed_fused: 38.4,          // m/s — média ponderada por confiança
  },

  // Posição (RaceBox primary, iPhone fallback)
  position: {
    lat: -15.7720,              // grau decimal WGS84
    lon: -47.8957,
    alt: 1095,                  // metros
    local_x: 412.3,             // viewBox (projetado por Projector)
    local_y: 387.1,
    heading: 87.4,              // graus (0..360)
    distance_from_start: 1234,  // metros desde linha de chegada
    gps_accuracy: 0.5,          // metros
    fix_type: '3D',             // none / 2D / 3D / DGPS
    num_satellites: 12,
  },

  // Dinâmica (RaceBox IMU primary, iPhone CoreMotion fallback)
  dynamics: {
    accel_longitudinal: -8.5,   // m/s² (negativo = freando)
    accel_lateral: 12.1,        // m/s² (positivo = curva direita)
    accel_vertical: -9.8,       // m/s² (incluindo gravidade — confirmar pelo PDF RaceBox)
    yaw_rate: 45,               // °/s
    gyro_x: 2.1,                // °/s (roll)
    gyro_y: -0.5,               // °/s (pitch)
    gyro_z: 45,                 // °/s (yaw — alias de yaw_rate)
  },

  // Lap (Detector)
  lap: {
    event_id: 'evt_xxx',
    session_id: 'sess_xxx',
    stint_id: 'stnt_xxx',
    lap_number: 7,
    sector: 'P2',               // parcialId
    segment: 'CURVA_BRUXA',     // trechoId/nome
    lap_time: null,             // ms — preenchido apenas no fim da volta
    delta_best: -120,            // ms vs PB (negativo = melhor)
    delta_ideal: 380,            // ms vs volta ideal (sempre positivo)
  },

  // Qualidade
  quality: {
    t4000_quality: 'good',
    racebox_quality: 'good',
    iphone_quality: null,       // null = fonte não conectada
    sync_quality: 'good',
    confidence: 'Alta',         // Alta / Média / Baixa
    interpolated_channels: [],  // lista de canais marcados INTERPOLATED
    missing_channels: [],       // lista de canais marcados MISSING
  },
}
```

## Regras de construção

### Regra 1 — Channel não-disponível é `null`

Nunca `0`, nunca `'-'`, nunca `'N/A'`. `null` é semanticamente "não tenho esse canal agora". UI converte `null` para o que for adequado visualmente.

### Regra 2 — Origem é rastreável

Para cada canal, é possível responder "de qual fonte veio". O snapshot guarda isso em `quality.*_quality` por fonte; análise mais profunda pode consultar o `sampleStore` para ver a amostra exata que produziu o valor.

### Regra 3 — Fusão é declarada

`speed_fused` é o resultado de combinar `speed_can` + `speed_gnss`. Algoritmo:

- ambos OK: média ponderada por confiança (CAN tipicamente mais reativo, GNSS mais absoluto)
- só um OK: usa o que está OK, marca `confidence: 'Média'` no snapshot
- nenhum OK: `null`

Fusão é determinística e replicável. Algoritmo documentado por canal fundido.

### Regra 4 — Quality reflete o pior

`source_quality` global do snapshot = pior qualidade entre canais que o snapshot tem. Permite filtrar rápido: "só quero snapshots `OK`".

### Regra 5 — Não inventar campo

Se o canal não existe na fonte, NÃO inventar valor. Ex: T4000 não fornece pressão de freio — campo `engine.brake_pressure` simplesmente não existe nesta spec; não criar como `null`. Manter o catálogo por fonte (`T4000_CAN_SPEC.md`, `RACEBOX_INTEGRATION_SPEC.md`) como verdade do que cada uma entrega.

### Regra 6 — Snapshot é imutável

Uma vez construído, snapshot não muda. Análises podem produzir derivações (`CornerAnalysis`, etc.) que carregam referência ao snapshot original via `tMono`.

### Regra 7 — Consumidor escolhe a taxa

Box pede `onTick(10)` para 10 Hz. Cockpit pede `onTick(30)` para 30 Hz. Análise pós-stint itera por todos os snapshots da sessão na taxa que precisa.

## Catálogo de campos opcionais (futuros)

Quando sensores adicionais entrarem, estender o snapshot:

- `tires.{fl,fr,rl,rr}_temp_pyrometer` — pirômetro 4 pontos (manual hoje, alimentado pelo `StintEnvironment` — não vem por canal live)
- `brakes.{fl,fr,rl,rr}_temp` — quando sensor de freio entrar
- `suspension.{fl,fr,rl,rr}_travel` — quando sensor de suspensão entrar
- `steering_angle` — quando sensor de volante entrar
- `brake_pressure` — quando sensor de freio entrar

Cada extensão vira PR separado, com spec atualizada e `confidence` declarada.

## Validação contra implementação atual

**Estado em 2026-04-24:** zero código de snapshot existe. `Detector` e `FaseCurva` consomem `Sample` (ver `src/telemetry/provider.js`) — estrutura mais simples, uma fonte só.

Quando snapshot for implementado:

1. `TelemetryTimebase` produz snapshots.
2. `Detector` é adaptado para consumir snapshot (campos `position.local_x`, `position.local_y`, `vehicle.speed_fused` em vez de `sample.x`, `sample.y`, `sample.speed`).
3. `FaseCurva` consome snapshots da janela do segment para classificação.
4. UI do Box pode subscrever a `onTick(10)` para receber snapshot atualizado.

Migração é incremental — providers continuam emitindo `Sample`, `TelemetryTimebase` ingere e gera snapshots, análises antigas continuam funcionando enquanto novas são portadas.

## Testes obrigatórios

- snapshot construído com 2 fontes em fase → todos canais OK
- snapshot construído com 1 fonte caída → canais dela `null` + `MISSING`, snapshot ainda emitido
- snapshot construído com latência alta em uma fonte → canais dela `LATE` ou `INTERPOLATED`
- replay de samples produz mesma sequência de snapshots (timing relativo)
- snapshot imutável: tentar mutar campo após construção → erro ou silenciosamente ignorado (objeto congelado)
