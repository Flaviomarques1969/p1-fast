# TELEMETRY_TIMEBASE_SPEC — Sincronização multi-fonte

> **STATUS: ESPECIFICAÇÃO PROPOSTA — IMPLEMENTAÇÃO PENDENTE**
>
> Hoje cada provider escreve no `sampleStore` independentemente. Não há camada que alinhe T4000, RaceBox e iPhone numa timeline única. Esta spec define o componente `TelemetryTimebase` a ser criado.

## Problema

Três fontes principais com taxas e latências diferentes:

| Fonte | Taxa | Latência típica | Timestamp interno? |
|---|---|---|---|
| iPhone GPS | ~1 Hz | sistema operacional, ms | sim (GNSS) |
| iPhone CoreMotion | 50-100 Hz | baixa | sim |
| RaceBox GNSS | 25 Hz | BLE 20-100 ms | sim (`gnssTime`) |
| RaceBox IMU | 100 Hz | BLE 20-100 ms | sim |
| T4000 CAN | ~100 Hz por canal | USB 1-10 ms | a confirmar |
| Mock | configurável | zero | sintético |

Sem alinhamento, snapshot do carro misturando esses canais é inconsistente — RPM de 50 ms atrás, posição de 200 ms atrás, IMU de 10 ms atrás.

## Princípio

`TelemetryTimebase` é a **única** autoridade para responder "qual é o estado do carro no instante T?". Consome todos os providers, alinha por `tMono` (`performance.now()` na recepção, ADR-015), e produz snapshots interpolados ou marcados conforme `DATA_QUALITY_RULES.md`.

## Contrato

```js
class TelemetryTimebase {
  // Registrar uma fonte (chamado uma vez por provider)
  attachSource({ source, expectedRateHz, freshness, channels })

  // Empurrar uma amostra recebida (chamado por cada provider)
  ingest(sample)

  // Pedir snapshot consolidado em um instante
  snapshotAt(tMono): CarTelemetrySnapshot

  // Pedir snapshot "agora"
  snapshotNow(): CarTelemetrySnapshot

  // Subscrever em ticks consolidados (taxa do consumidor — Box ou Cockpit)
  onTick(rateHz, callback)

  // Status de cada fonte
  sourceStatus(): { [source]: { lastSampleAt, ratePerSec, quality, drift, latencyEst } }
}
```

## Algoritmo

### 1. Buffer por fonte

Cada fonte tem buffer circular dos últimos N segundos de amostras (default N=10s, configurável). Amostras chegam, são marcadas com `tMono` da recepção, indexadas.

### 2. Estimativa de latência por fonte

Para cada fonte com timestamp interno (`gnssTime`, timestamp T4000):

- `latency = tMono_recepção - tFonte`
- janela móvel (últimas K amostras) → mediana de latência
- snapshot considera `tFonte_estimado = tMono_recepção - latency_mediana`

Para fonte sem timestamp interno (mock simples):

- assume `tFonte = tMono_recepção`

### 3. Estimativa de jitter

`jitter = stddev(intervalos entre amostras consecutivas)`. Alto jitter → marca canais como `LOW_CONFIDENCE` para esse intervalo.

### 4. Snapshot em instante T

Para cada canal:

- localizar amostra mais próxima de T (antes/depois) na fonte primária do canal
- se a amostra mais próxima está dentro de `freshness` (declarado por fonte): usar valor direto, qualidade `OK`
- se está fora de `freshness`: interpolar entre antes/depois → qualidade `INTERPOLATED`
- se não há amostra antes ou depois (gap): valor `null`, qualidade `MISSING`
- se a amostra é `LATE` (chegou depois do snapshot foi pedido): marcar `LATE`, ainda usável se dentro de janela

### 5. Detecção de fora de ordem e duplicado

- Amostra com `tFonte` < última `tFonte` da mesma fonte → `OUT_OF_ORDER`. Reordenar por `tFonte`. Log auditável.
- Amostra com mesmo `tFonte` que outra → `DUPLICATE`. Descartar a segunda.

### 6. Snapshot quality

Cada snapshot carrega `quality` global = pior qualidade entre canais críticos. Cada canal carrega sua qualidade individual.

## Política de freshness por fonte

| Fonte | Freshness | Notas |
|---|---|---|
| iPhone GPS | 1500 ms | 1 Hz nominal, dobro |
| iPhone CoreMotion | 200 ms | 50-100 Hz nominal |
| RaceBox GNSS | 100 ms | 25 Hz nominal, 2.5× |
| RaceBox IMU | 50 ms | 100 Hz nominal, 5× |
| T4000 CAN | 50 ms | 100 Hz nominal, 5× |

Se a freshness expira sem nova amostra, `signalQuality` da fonte sobe para `DEGRADED`; após N freshness expirados consecutivos, vira `LOST`.

## Comportamento sob falha

- **Fonte cai:** snapshots seguem sendo produzidos com canais dela em `MISSING`. UI do Box mostra status. Análise dependente desse canal opera em modo degradado.
- **Drift de relógio do Mini PC:** afeta `Date.now()` (auditorial), não `performance.now()` (canônico). Toda análise usa `tMono`. ADR-015 reforçado.
- **Latência > freshness mediana × 5:** marca SUSPECT, log auditável.
- **Jitter > 50% do intervalo nominal:** marca SUSPECT.

## Persistência

`TelemetryTimebase` não persiste — é estado em memória. As amostras brutas continuam em `telemetrySamples` (ADR-014). O snapshot pode ser persistido em uma store nova `telemetrySnapshots` SE houver consumidor que precise (decisão futura — não implementar speculativamente).

## Replay

`TelemetryReplayEngine` (a implementar — veja `AUDITORIA_INICIAL_TELEMETRIA.md`) pode reaplicar samples de uma sessão no `TelemetryTimebase` para reproduzir snapshots offline.

Critério de equivalência: snapshot reproduzido = snapshot original, modulo timing relativo. Estado externo (relógio absoluto) é normalizado.

## Implementação proposta

Arquivo único: `src/telemetry/timebase.js`

Camada lógica:
- `Source` — wrapper por fonte com buffer e estatísticas
- `Aligner` — algoritmo de snapshot
- `TickScheduler` — emite `onTick` na taxa do consumidor (Box=10Hz, Cockpit=30Hz, análise=conforme demanda)

Testes obrigatórios (Regra 9 das `TELEMETRY_ENGINEERING_RULES.md`):

- 2 fontes em fase, taxas diferentes → snapshot consistente
- 1 fonte com latência alta → marcação `LATE`
- 1 fonte cai → canais dela viram `MISSING`, demais seguem
- amostras fora de ordem → reordenadas
- duplicadas → descartadas
- gap longo → `MISSING` mantido até nova amostra
- replay produz snapshot idêntico ao original
- ticks emitidos na taxa correta sob jitter

## Riscos

1. **Latência mediana é estimativa, não medição precisa.** Para protocolos sem timestamp interno confiável, usamos `tMono` da recepção. Snapshot fica off por dezenas de ms. Aceitável para análise; insuficiente para crítico de segurança que depende de janela curta.
2. **Buffer de 10s pode crescer em uso longo.** Tamanho fixo, descarta antigo (FIFO). Se análise precisar de janela maior, ler direto do `sampleStore`.
3. **Fonte com timestamp interno errado** (relógio do GNSS sem fix) gera latência negativa absurda. Detectar e ignorar timestamp interno enquanto fonte está sem fix.

## Validação contra implementação atual

**Estado em 2026-04-24:** zero código de timebase existe. Cada provider escreve no `sampleStore` direto, sem fusão. Análises (Detector, FaseCurva) consomem amostras de uma fonte só.

Quando `TelemetryTimebase` for criado, o caminho para análise muda:

```
Antes: provider → sampleStore → análise (uma fonte só)
Depois: providers → timebase → snapshot → análise (multi-fonte)
                  ↘ sampleStore (continua para replay e auditoria)
```

`SessionRecorder` e `Detector` precisam ser adaptados para consumir snapshot em vez de sample bruto. Tarefa atrelada ao próximo bloco de implementação.
