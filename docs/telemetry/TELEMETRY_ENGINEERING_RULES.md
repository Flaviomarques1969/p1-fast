# TELEMETRY_ENGINEERING_RULES — Regras de engenharia de telemetria

Regras permanentes que protegem a confiabilidade dos dados. Aplicam-se a toda fonte (T4000, RaceBox, iPhone, mock, replay) e a todo módulo que consome telemetria.

## Regra 1 — Toda amostra carrega 4 metadados

Sem um deles, a amostra é descartada (ou rotulada `INVALID`):

- `t` — timestamp Unix (ms) — auditorial
- `tMono` — `performance.now()` (ms) — canônico para deltas (ADR-015)
- `source` — `'device' | 'racebox' | 't4000-can' | 'mock' | 'replay'`
- `signalQuality` / `quality` — uma das 11 categorias de `DATA_QUALITY_RULES.md`

## Regra 2 — Unidades canônicas internas

Todo cálculo interno usa unidades canônicas. Conversão acontece na borda (parser na entrada, formatador na UI).

| Grandeza | Canônica | Aceita também (com conversão na borda) |
|---|---|---|
| Velocidade | m/s | km/h (UI) |
| Pressão | bar | psi (UI), kPa (import) |
| Temperatura | °C | K (interno se cálculo exigir), °F (proibido) |
| Aceleração | m/s² | g (UI) |
| Tempo | ms | s (UI), HH:mm:ss (UI) |
| Posição | latitude/longitude (WGS84) decimal | x/y do viewBox (derivado via projector) |
| Distância | metros | km (UI) |
| Ângulo | graus | radianos (interno se cálculo exigir) |
| RPM | rpm | — |
| TPS | % (0..100) | normalizado 0..1 (interno) |
| Lambda | adimensional (λ) | AFR (UI opcional) |

## Regra 3 — Inferência é marcada como inferência

Sem sensor de freio, dizer:

- "frenagem inferida" — não "freio aplicado"
- "desaceleração compatível com frenagem" — não "pressão de freio X bar"

Sem sensor de volante, dizer:

- "trajetória sugere subesterço" — não "ângulo de volante 45°"

Sem sensor de pneu, dizer:

- "tendência de degradação inferida pelo ritmo" — não "temperatura do pneu 95°C"

Tipo de cada valor: `measured | calculated | inferred | estimated | constant`. Campo obrigatório quando aplicável.

## Regra 4 — Sem sensor real, sem afirmação

Lista do que NÃO existe hoje no projeto e portanto NÃO pode ser afirmado como medido:

- Pressão de freio (sem sensor)
- Força no pedal (sem sensor)
- Temperatura real de pneu (apenas pirômetro pós-stint, manual)
- Pressão real de pneu (apenas valor manual início de stint)
- Curso de suspensão (sem sensor)
- Temperatura real de freio (sem sensor)
- Ângulo de volante (sem sensor)
- Slip ratio (sem sensor)
- Carga aerodinâmica (sem sensor)

Se algum desses entrar como sensor no futuro, atualizar esta regra + o `T4000_CAN_SPEC.md` (se vier por CAN).

## Regra 5 — Múltiplas taxas são aceitas

Cada fonte tem sua taxa real:

- iPhone GPS: ~1 Hz
- iPhone CoreMotion: ~50-100 Hz (varia por dispositivo)
- RaceBox GNSS: 25 Hz (declarado)
- RaceBox IMU: 100 Hz (declarado)
- T4000 CAN: ~100 Hz por canal (hipótese — confirmar)
- Mock: 10 Hz (configurável)

Não forçar todas a mesma frequência. `TelemetryTimebase` alinha por `tMono`. Quando snapshot exigir valor de canal sem amostra recente, marca como `INTERPOLATED` ou `MISSING`.

## Regra 6 — Sincronização tem estratégia explícita

Para cada situação possível:

| Situação | Tratamento |
|---|---|
| Amostra ausente | `MISSING`, marca no snapshot, conta como gap |
| Amostra atrasada | `LATE`, aplica se ainda dentro de janela útil; descarta se passou janela |
| Amostra fora de ordem | `OUT_OF_ORDER`, reordena por `tMono`, log auditavel |
| Amostra duplicada | `DUPLICATE`, descarta segunda |
| Amostra fora de range | `OUT_OF_RANGE`, marca, alimenta análise como hipótese |
| Checksum inválido | `INVALID_CHECKSUM`, descarta amostra inteira |
| Valor interpolado | `INTERPOLATED`, marca; usado quando snapshot precisa do canal |
| Valor estimado | `ESTIMATED`, marca; usado quando snapshot fundiu múltiplas fontes |
| Confiança baixa | `LOW_CONFIDENCE`, marca; UI mostra com indicador visual |
| Drift de IMU | `SUSPECT`, marca canal individual; recalibra se possível |

## Regra 7 — Validação cruzada é rotina

Sempre que dois canais redundantes existirem, comparar. Sempre que um canal puder validar outro fisicamente, comparar.

Exemplos: velocidade CAN vs velocidade GNSS, aceleração longitudinal vs derivada da velocidade, RPM vs marcha vs velocidade, λ vs TPS+MAP+RPM, pressão óleo vs RPM.

Divergência → marca SUSPECT, gera hipótese (não certeza), alimenta o `CrossValidationEngine` (a implementar). Detalhe em `CROSS_VALIDATION_RULES.md`.

## Regra 8 — Replay é obrigatório

Toda análise rodada em produção tem que ser reproduzível offline. O `telemetrySamples` (append-only, ADR-014) é a fonte canônica. Replay alimenta o detector com os mesmos samples e produz a mesma análise.

Se uma análise depende de estado externo (relógio do sistema, random, ID gerado), isso é bug — replay não funcionará.

## Regra 9 — Cada parser tem teste

Fixtures obrigatórias por parser:

- pacote válido completo (caso feliz)
- pacote com checksum inválido
- pacote truncado
- pacote duplicado
- pacote fora de ordem
- valor numérico fora de faixa
- valor categórico fora do enum
- ausência prolongada da fonte
- recovery após gap

Sem essas fixtures, parser não está pronto.

## Regra 10 — Spec é spec, não código

Especificações de protocolo (CAN, BLE) ficam em arquivos `*_SPEC.md` em `docs/raceops/`. Código deve referenciar a spec por seção (ex: "campo RPM, byte 0-1, big-endian, fator 1.0, ver `T4000_CAN_SPEC.md` §pacote 1").

Se a spec mudar, código quebra com erro claro — não silenciosamente decodifica errado.

## Regra 11 — Catálogo por fonte

Cada fonte de telemetria tem catálogo declarado:

- canal (nome interno)
- unidade canônica
- range esperado
- taxa esperada (Hz)
- tipo (measured / calculated / inferred / estimated / constant)
- validação cruzada aplicável
- consumidor primário
- nível de criticidade (segurança / performance / diagnóstico / opcional)

Catálogo vive na spec da fonte: `T4000_CAN_SPEC.md`, `RACEBOX_INTEGRATION_SPEC.md`, etc.

## Regra 12 — Logging não é dado

Logs (`logger.info`, `logger.warn`, `logger.error`) são para diagnóstico humano. Não viram análise.

Toda análise lê do `telemetrySamples` ou de stores derivadas (`laps`, `segmentExecutions`). Nunca de log.

## Regra 13 — Decisão crítica é determinística (ADR-008 reforçada)

Alertas CRÍTICO e BOX AGORA (`ALERT_HIERARCHY.md`) são código determinístico, não IA. Cada regra tem teste automatizado. Nunca silenciados por filtro de sobrecarga.

Para isso valer, dado de entrada precisa ter qualidade `OK` ou pior explicitamente declarada — não pode ser silêncio.

## Regra 14 — Confiança é parte do output

Toda análise carrega `confidence: 'Alta' | 'Média' | 'Baixa'`. Critério explícito por análise.

Confiança Baixa → não dispara intervenção forte no piloto, não recomenda setup, propõe validação adicional.

## Regra 15 — Erro de fonte não é silêncio

Quando uma fonte cai, o sistema:

1. Marca o `signalQuality = 'lost'` na próxima amostra que tentaria emitir.
2. Gera evento auditável (log warning + linha em store de eventos).
3. UI do Box mostra status "perdido" daquela fonte.
4. Análises que dependem desse canal passam a operar em modo degradado, sinalizado.
5. Crítico de segurança que dependia do canal vira alerta de "canal indisponível" — não silêncio.
