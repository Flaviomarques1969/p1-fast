# RaceOps Chief Telemetry Engineer Gate

Documento mestre do segundo guardião da camada de governança do FAM Racing.

Atua em paralelo ao [`TECHNICAL_DIRECTOR_GATE.md`](TECHNICAL_DIRECTOR_GATE.md). Toda entrega de produto passa pelos dois gates antes de ser declarada concluída.

- **Diretor Técnico** garante que a entrega responde uma pergunta real de corrida e gera ação prática.
- **Engenheiro-Chefe de Telemetria** garante que os dados estão corretos, sincronizados, auditáveis, rastreáveis e úteis.

## Premissa

Telemetria não é produto. Dashboard não é produto. **O produto é a resposta de decisão baseada em dado confiável.**

Toda entrega obedece à cadeia estendida:

```
DADO BRUTO
→ DADO DECODIFICADO        (parser)
→ DADO NORMALIZADO         (unidade interna canônica)
→ DADO DERIVADO            (cálculo + inferência marcada)
→ INTERPRETAÇÃO TÉCNICA    (engenheiro)
→ RESPOSTA OPERACIONAL     (box → piloto)
→ AÇÃO RECOMENDADA         (com risco e confiança)
→ VALIDAÇÃO                (como confirmar no próximo stint)
```

Sem qualquer etapa, a entrega é reprovada.

## Missão do Engenheiro-Chefe de Telemetria

Para cada entrega, responder:

1. O dado tem timestamp confiável?
2. A origem do dado está identificada?
3. A unidade está correta?
4. A escala está validada?
5. O pacote foi decodificado corretamente?
6. O checksum foi validado quando aplicável?
7. A amostra tem classificação de qualidade?
8. Os dados da T4000 e do RaceBox estão sincronizados?
9. Existe latência medida ou estimada?
10. Existe timeline unificada?
11. O sistema diferencia dado real de inferência?
12. O sistema sabe lidar com dado ausente, atrasado, suspeito ou fora de ordem?
13. A análise pode ser reproduzida depois?
14. Existe teste para parser, sincronização, inferência e alerta?

Resposta negativa em qualquer um → REPROVADA PELO ENGENHEIRO-CHEFE DE TELEMETRIA.

## Princípios não-negociáveis (telemetria)

1. **Toda amostra carrega timestamp monotônico interno** (ADR-015 do projeto — `performance.now()`, não `Date.now()`).
2. **Toda amostra carrega origem** (`source: 'device' | 'racebox' | 't4000-can' | 'mock' | 'replay'`).
3. **Toda amostra carrega unidade canônica** — ver `TELEMETRY_ENGINEERING_RULES.md` §unidades.
4. **Toda amostra carrega qualidade** — uma das 11 categorias de `DATA_QUALITY_RULES.md`.
5. **Inferência é marcada como inferência** — nunca apresentada como fato.
6. **Sem sensor real, sem afirmação:** não dizer "freio aplicado" sem sensor de freio; usar "frenagem inferida".
7. **Snapshot unificado é construído**, não inventado — ver `TELEMETRY_SNAPSHOT_SPEC.md`.
8. **Múltiplas frequências são aceitas** — não exigir taxa única; usar `TelemetryTimebase` para alinhar.
9. **Falha de sincronização é evento auditável**, não silêncio.
10. **Replay offline é obrigatório** — toda análise deve ser reproduzível a partir do `telemetrySamples`.
11. **Cada parser tem teste** com fixtures de pacote válido, perdido, duplicado, fora de ordem, checksum inválido, valor fora de faixa.
12. **Validação cruzada acontece** — ver `CROSS_VALIDATION_RULES.md`.

## Reprovação automática (telemetria)

Reprovar imediatamente se:

1. Amostra sem timestamp.
2. Amostra sem origem.
3. Amostra sem unidade.
4. Inferência apresentada como medição.
5. Parser sem teste.
6. Sync sem teste.
7. Snapshot construído ignorando qualidade da fonte.
8. Conclusão de análise sem dado rastreável.
9. Fonte de dados nova sem catálogo de canais (campo, unidade, range, taxa esperada).
10. Mensagem ao box ou piloto baseada em dado com qualidade `MISSING` / `LOW_CONFIDENCE` / `INVALID_CHECKSUM` sem aviso explícito.
11. Recomendação de setup baseada em dado não-validado.
12. Replay de sessão impossível.
13. Mistura de unidades (km/h e m/s no mesmo cálculo, °C e K, etc.).
14. Sensor inexistente assumido como existente.
15. Spec de protocolo (CAN, BLE) cravada no código sem confirmação documental.

## Ambientes de telemetria

### Ambiente T1 — Captação (no carro)

Processos rodando no Mini PC do carro lendo das fontes físicas.

Fontes principais:
- Injepro T4000 via CAN bus (1 Mbit/s, ID 0x7FB hipotético — ver `T4000_CAN_SPEC.md`, validação pendente em [BLOCKERS.md](../../BLOCKERS.md) E2)
- RaceBox Mini via BLE 5.2 (GNSS 25 Hz + IMU ±8g)
- iPhone fixo via WiFi/4G publicando GPS + CoreMotion (Perna 1, atual)
- Câmeras Insta360 (vídeo, fora do escopo deste gate)

Garantias mínimas:
- Cada leitor (T4000, RaceBox, iPhone) é um `TelemetryProvider` (ver `src/telemetry/provider.js`).
- Cada amostra tem `t`, `tMono`, `source`, `signalQuality`.
- Falha de leitura é registrada, não engolida.

### Ambiente T2 — Sincronização e snapshot

`TelemetryTimebase` (ainda não implementado) consome todos os providers, alinha por `tMono`, e produz `CarTelemetrySnapshot` por instante.

### Ambiente T3 — Análise

`Detector`, `FaseCurva`, `Corredor` consomem snapshots e produzem `Lap`, `SegmentExecution`, `CornerAnalysis`. Cada output carrega `confidence` e `data_quality`.

### Ambiente T4 — Replay e teste

`TelemetryReplayEngine` (ainda não implementado) reaplica `telemetrySamples` de uma sessão no detector para reproduzir análises offline.

`TelemetryTestFixtures` (ainda não implementado) gera cenários sintéticos de erro: pacote perdido, fora de ordem, checksum inválido, valor fora de faixa, perda de GNSS, drift de IMU, latência BLE, divergência CAN vs GNSS.

## Estrutura desta camada

Pasta `docs/raceops/`. Documentos do segundo gate:

- `CHIEF_TELEMETRY_ENGINEER_GATE.md` (este arquivo)
- `TELEMETRY_ENGINEERING_RULES.md` — regras permanentes de engenharia de telemetria
- `TELEMETRY_REVIEW_CHECKLIST.md` — checklist por entrega de telemetria
- `T4000_CAN_SPEC.md` — spec da Injepro T4000 (status: hipótese, validação pendente)
- `RACEBOX_INTEGRATION_SPEC.md` — spec do RaceBox Mini (status: hipótese, NDA leve)
- `TELEMETRY_TIMEBASE_SPEC.md` — sincronização multi-fonte
- `TELEMETRY_SNAPSHOT_SPEC.md` — snapshot unificado do carro por instante
- `DATA_QUALITY_RULES.md` — 11 classificações + regras de uso
- `CROSS_VALIDATION_RULES.md` — validações redundantes obrigatórias
- `MECHANIC_QUESTIONS_MATRIX.md` — perguntas do mecânico
- `TELEMETRY_ENGINEERING_DECISION_LOG.md` — log permanente das decisões de engenharia
- `AUDITORIA_INICIAL_TELEMETRIA.md` — auditoria do pipeline atual

## Regra antes de declarar tarefa concluída

Toda entrega que toca dado registra no Decision Log da telemetria:

```
## Revisão do Engenheiro-Chefe de Telemetria
### Dados usados
### Origem dos dados
### Timestamp validado?
### Unidade validada?
### Escala validada?
### Qualidade dos dados (uma das 11)
### Sincronização validada?
### Inferência marcada como inferência?
### Testes existentes
### Riscos técnicos
### Resultado: Aprovado / Reprovado / Aprovado com ajustes
### Motivo
```

Sem essa seção (mais a do Diretor Técnico), a entrega está incompleta.

## Relação com o resto do projeto

- ADR-014 (`ARCHITECTURE_DECISIONS.md`) — `telemetrySamples` append-only, sync por batch. Reforçado.
- ADR-015 — `performance.now()` para deltas. Reforçado.
- `BLOCKERS.md` — E2 (Injepro), E3 (iPhone app), E4 (RaceBox) são bloqueios físicos para o pipeline ficar live. O gate enforça que toda entrega declare como se comporta com essas fontes ausentes ou parciais.
- `src/telemetry/*` — base atual aprovada com ajustes. Detalhe na auditoria.
