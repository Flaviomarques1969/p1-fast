# DATA_QUALITY_RULES — Classificação obrigatória de qualidade

11 categorias canônicas. Toda amostra (e cada canal de snapshot) carrega exatamente uma. UI, análise e alerta consultam essa categoria antes de usar o dado.

## As 11 categorias

| Categoria | Significado | Regra de uso |
|---|---|---|
| `OK` | Dado medido, validado, dentro de range, sem latência anormal | Usar livre |
| `SUSPECT` | Dado possivelmente válido mas com sinal de problema (drift, jitter, divergência cruzada) | Usar com cuidado; nunca para CRÍTICO sem aviso |
| `MISSING` | Sem amostra dentro da janela de freshness da fonte | Não usar; análise opera em modo degradado |
| `LATE` | Amostra chegou depois da janela esperada mas ainda dentro do tolerável | Usar; marcar UI; reduzir confiança |
| `OUT_OF_ORDER` | Amostra com timestamp anterior à última recebida da mesma fonte | Reordenar; log auditável; manter |
| `INVALID_CHECKSUM` | Pacote falhou validação de checksum/CRC | Descartar |
| `OUT_OF_RANGE` | Valor numérico fora do range esperado para o canal | Marcar; análise pode usar como hipótese de falha de sensor |
| `DUPLICATE` | Amostra repetida (mesmo timestamp interno) | Descartar segunda |
| `INTERPOLATED` | Valor calculado por interpolação entre amostras anteriores e posteriores | Aceitável para visualização; não usar para CRÍTICO |
| `ESTIMATED` | Valor estimado por fusão de fontes ou modelo (ex: `speed_fused`) | Aceitável; declarar `confidence` |
| `LOW_CONFIDENCE` | Dado válido mas com baixa confiança (poucos satélites, IMU sem calibrar, etc.) | Marcar UI; nunca para CRÍTICO sem aviso |

## Regra 1 — Categoria default por fonte

Cada provider declara a categoria default que assume quando emite uma amostra sem problema detectado:

- `DeviceProvider` (iPhone): `OK` se `gpsAccuracy <= 5m`; `LOW_CONFIDENCE` se 5-20m; `SUSPECT` se 20-50m; `MISSING` se sem fix.
- `MockProvider`: `OK` (dado sintético controlado).
- `RaceBoxProvider` (a criar): `OK` se `gpsAccuracy <= 1m` e `numSatellites >= 8`; `LOW_CONFIDENCE` se 1-5m ou 6-7 satélites; `SUSPECT` se 5-15m ou 4-5 satélites; `MISSING` se sem fix.
- `T4000Provider` (a criar): `OK` se checksum válido + valores em range; `INVALID_CHECKSUM` ou `OUT_OF_RANGE` conforme caso.

## Regra 2 — Categoria pode mudar no pipeline

Provider emite `OK`. Timebase recebe atrasada → marca `LATE`. Detector recebe → marca `OUT_OF_ORDER` se reordenar.

A categoria final que entra na análise é a do snapshot, não a inicial.

## Regra 3 — UI mostra qualidade

Toda métrica visível tem indicador de qualidade quando ≠ `OK`:

- `INTERPOLATED` / `ESTIMATED` → ícone discreto (ex: pequeno asterisco ou cor levemente atenuada)
- `LATE` / `LOW_CONFIDENCE` / `SUSPECT` → ícone de atenção
- `MISSING` → célula vazia (`—`) ou faixa diagonal cobrindo
- `OUT_OF_RANGE` → cor de alerta + valor entre parênteses
- `INVALID_CHECKSUM` / `DUPLICATE` → não exibido (descartado)

## Regra 4 — Crítico precisa OK

Alerta CRÍTICO ou BOX AGORA (`ALERT_HIERARCHY.md`) só dispara com dado `OK`. Se dado vira `SUSPECT` ou `LOW_CONFIDENCE`, o alerta crítico vira "canal indisponível" — não silêncio, não decisão automática.

Exceção: se a regra crítica é específicamente sobre falha de canal (`MISSING` por > T segundos = ATENÇÃO), aí a categoria entra na regra.

## Regra 5 — Confiança ≠ qualidade

`confidence: 'Alta' | 'Média' | 'Baixa'` é da análise (pergunta → resposta). Refere-se ao quanto a conclusão é forte. `quality` é do dado bruto.

Análise com dados `OK` pode ainda ter `confidence: 'Baixa'` (poucas voltas, padrão fraco). Análise com dados `LOW_CONFIDENCE` raramente terá `confidence: 'Alta'`.

## Regra 6 — Validação cruzada altera qualidade

Quando `CrossValidationEngine` (a implementar — ver `CROSS_VALIDATION_RULES.md`) detecta divergência entre canais redundantes:

- ambos `OK` mas divergem além do limite → ambos viram `SUSPECT` até reconciliar
- um `OK` outro fora de range → marcar o fora de range, manter o OK

## Regra 7 — Replay preserva qualidade

Amostra persistida em `telemetrySamples` mantém a categoria que tinha quando foi salva. Replay produz snapshots com qualidades equivalentes ao original.

## Regra 8 — Logs são separados

Categoria de qualidade fica no campo da amostra/snapshot, não em log. Logs são para diagnóstico humano (Regra 12 das `TELEMETRY_ENGINEERING_RULES.md`).

## Regra 9 — Catálogo por canal

Cada canal declara em sua spec (T4000, RaceBox) o range esperado + critério para `OUT_OF_RANGE`. Ex:

- `engine.rpm`: range 0..8000; > 8500 → `OUT_OF_RANGE` + alarme.
- `engine.water_temp`: range 60..120; < 0 ou > 150 → `OUT_OF_RANGE`.
- `position.gps_accuracy`: > 50 → `MISSING` (sem fix utilizável).

## Validação contra implementação atual

**Estado em 2026-04-24:** o `provider.js` usa `SignalQuality` com 4 categorias (`good`, `degraded`, `bad`, `lost`). Cobre apenas a parte de fonte; não cobre `INTERPOLATED`, `ESTIMATED`, `OUT_OF_ORDER`, `DUPLICATE`, `INVALID_CHECKSUM`, `LATE`, `OUT_OF_RANGE`.

Plano de migração:

1. Manter `SignalQuality` por compatibilidade (estado da fonte como um todo).
2. Adicionar `quality` por amostra com as 11 categorias canônicas.
3. `TelemetryTimebase` (a criar) é responsável por aplicar as transições (LATE/OUT_OF_ORDER/INTERPOLATED).
4. UI (Box, Cockpit) atualiza para mostrar indicadores das categorias relevantes.

Migração não quebra dado existente — campo novo, default `OK` para amostras antigas (com nota de que são pré-classificação).
