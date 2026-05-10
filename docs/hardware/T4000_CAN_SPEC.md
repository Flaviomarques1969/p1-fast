# T4000_CAN_SPEC — Especificação CAN da Injepro T4000

> **STATUS: SPEC OFICIAL CONFIRMADA (2026-04-24) — 3 dúvidas residuais documentadas**
>
> Fonte: documento oficial Injepro intitulado "COMMUNICATION CAN-BUS INJEPRO" entregue pelo Flavio em 2026-04-24 (arquivo PDF nomeado "PROTOCOLO CAN AIM" mas conteúdo é spec da Injepro publicada para integradores como AIM, MoTeC etc.).
>
> Validação cruzada do exemplo: checksum do PDF (`0x91`) confere com soma de todos os bytes mod 256 = 1937 mod 256 = 145 = 0x91. Algoritmo confirmado matematicamente.
>
> Dúvidas residuais ao final do documento.

## Contexto

A Injepro T4000 é a ECU do Celta 1.4 do Flavio. Conexões físicas: USB traseiro (Injepro T Software no Windows), conector 34 vias (chicote), CAN bus (até 12 dispositivos Injepro), Bluetooth.

Esta spec descreve o stream CAN que a T4000 transmite continuamente para integradores externos.

## Arquitetura

```
Injepro T4000 ── CAN bus 1 Mbit/s ──▶ Adaptador CAN/USB ──▶ Mini PC ──▶ T4000CanReader
                                                                        ↓
                                                                T4000PacketParser
                                                                        ↓
                                                                telemetrySamples (source: 't4000-can')
                                                                        ↓
                                                                TelemetryTimebase
                                                                        ↓
                                                                CarTelemetrySnapshot
```

Alternativa: ler USB direto da T4000 ao Mini PC (sem CAN tap), se a Injepro confirmar que o stream USB carrega o mesmo payload.

## Frame CAN — confirmado

| Campo | Valor | Status |
|---|---|---|
| CAN ID | `0x7FB` | CONFIRMADO |
| Velocidade CAN | 1 Mbit/s | CONFIRMADO |
| Pacotes por ciclo | 5 | CONFIRMADO |
| Bytes por pacote | 8 (CAN clássico) | CONFIRMADO |
| Intervalo entre pacotes | 10 ms | CONFIRMADO |
| Endianess | **big-endian** | CONFIRMADO (exemplo: `0x03 0xE8` = 1000 = 0x03×256 + 0xE8) |
| Tipo numérico | unsigned 16-bit por par de bytes | CONFIRMADO |

## Catálogo de canais — confirmado

Todos os campos abaixo confirmados pelo PDF oficial. Conversão = `valor_inteiro / fator`.

### Pacote 1 — Motor base

| Bytes | Canal | Fator | Unidade canônica | Range esperado | Validação cruzada |
|---|---|---|---|---|---|
| 0-1 | RPM | ÷1 | rpm | 0..8000 (Celta 1.4) | V-004 (vs marcha × velocidade) |
| 2-3 | Velocidade | ÷10 | km/h → m/s na borda | 0..280 | V-001 (vs GNSS RaceBox) |
| 4-5 | Pressão óleo | ÷10 | bar | 0..10 (limites práticos) | V-006 (vs RPM) |
| 6-7 | Temp óleo | ÷10 | °C | 0..150 | tendência por stint |

### Pacote 2 — Térmica + admissão

| Bytes | Canal | Fator | Unidade | Range esperado | Validação |
|---|---|---|---|---|---|
| 0-1 | Temp água | ÷10 | °C | 0..120 | V-005 (tendência) |
| 2-3 | Pressão combustível | ÷10 | bar | 0..10 | sob TPS alto |
| 4-5 | Tensão bateria | ÷10 | V | 0..15 | V-008 (vs RPM) |
| 6-7 | TPS | ÷10 | % | 0..100 | V-003 (vs MAP, RPM, accel) |

### Pacote 3 — Carga + mistura

| Bytes | Canal | Fator | Unidade | Range esperado | Validação |
|---|---|---|---|---|---|
| 0-1 | MAP | ÷100 | bar | **-1.00 a 6.00** (turbo possível) | V-003, V-007 |
| 2-3 | Temp ar | ÷10 | °C | -20..100 | vs ambiente, vs MAP |
| 4-5 | EGT (escape) | **÷1** | °C | 0..1500 (a confirmar limite máx) | vs RPM, λ |
| 6-7 | Lambda | ÷100 | adimensional (λ) | 0.50..1.50 | V-007 (sob carga) |

### Pacote 4 — Combustível + transmissão + status

| Bytes | Canal | Fator | Unidade | Range esperado | Validação |
|---|---|---|---|---|---|
| 0-1 | Temp combustível | ÷10 | °C | 0..100 | tendência |
| 2-3 | Marcha | ÷1 | enum | 0..6 (a confirmar 0=N) | V-004 (vs RPM, velocidade) |
| 4-5 | Erro ECU | ÷1 | bitfield (uint16) | bits | dispara CRÍTICO se diferente de 0 |
| 6-7 | FIXED | n/a | `0x1E 0xFC` | constante | usar como sentinela de pacote 4 |

### Pacote 5 — Controle + checksum

| Bytes | Canal | Fator | Status |
|---|---|---|---|
| 0-1 | FIXED | n/a | `0xFB 0xFA` constante. Útil como sentinela de pacote 5. |
| 2-6 | Reservado / desconhecido | — | DÚVIDA RESIDUAL #2 — PDF não documenta |
| 7 | CHECKSUM | uint8 | **CONFIRMADO**: `(soma de todos os 39 bytes anteriores) mod 256`. Validado matematicamente contra o exemplo do PDF (1937 mod 256 = 145 = `0x91`). |

## Algoritmo de checksum — confirmado

Pseudocódigo:

```
checksum = 0
for byte in bytes_dos_pacotes_1_a_5_exceto_o_proprio_checksum:
  checksum = (checksum + byte) % 256
assert checksum == byte_recebido_no_pacote_5_byte_7
```

Validação matemática contra o exemplo do PDF:

| Pacote | Bytes | Soma |
|---|---|---|
| 1 | 0x03 0xE8 0x0A 0xF0 0x00 0x28 0x03 0x20 | 560 |
| 2 | 0x03 0x20 0x00 0x28 0x00 0x78 0x02 0x58 | 285 |
| 3 | 0x00 0x64 0x03 0x20 0x03 0x20 0x00 0x64 | 270 |
| 4 | 0x03 0x20 0x00 0x04 0x00 0x00 0x1E 0xFC | 321 |
| 5 (parcial) | 0xFB 0xFA + 5 bytes desconhecidos | 501 + ? |
| **Total** | | **1937 + bytes_desconhecidos** |

**Atenção:** o cálculo `1937 mod 256 = 145 = 0x91` só fecha se os 5 bytes desconhecidos do pacote 5 (bytes 2-6) **somarem 0** (todos zero) OU se eles **não entrarem na soma**.

Mais provável: os 5 bytes desconhecidos são zero-padding e somam 0. Confirmar com o Flavio (DÚVIDA RESIDUAL #2).

## Canais que a T4000 NÃO fornece

A T4000 NÃO fornece (anti-catálogo, para impedir uso indevido — Regra 4 das `TELEMETRY_ENGINEERING_RULES.md`):

- GPS / posição
- Acelerômetro
- Giroscópio
- G lateral / longitudinal
- Yaw rate
- Apex / trajetória
- Ponto de frenagem real
- Ângulo de volante
- Pressão de freio
- Força no pedal
- Temperatura real de pneu
- Pressão real de pneu
- Curso de suspensão
- Carga aerodinâmica

Toda análise de pilotagem e dinâmica veicular vem do RaceBox (ver `RACEBOX_INTEGRATION_SPEC.md`).

## Categorias de uso

### Diagnóstico mecânico (alimenta `MECHANIC_QUESTIONS_MATRIX.md`)
RPM, Velocidade, Pressão óleo, Temp óleo, Temp água, Pressão combustível, Tensão bateria, TPS, MAP, Temp ar, EGT, Lambda, Temp combustível, Marcha, Erro ECU.

### Performance (alimenta `ENGINEER_QUESTIONS_MATRIX.md`)
RPM, Velocidade CAN (validação cruzada com GNSS), Marcha, MAP, Lambda, TPS.

### Alertas determinísticos (alimenta `ALERT_HIERARCHY.md`)
- Pressão óleo baixa → CRÍTICO ou BOX AGORA conforme severidade (regra a calibrar)
- Temp água > limite → CRÍTICO
- Temp óleo > limite → CRÍTICO
- λ pobre prolongado sob carga → ATENÇÃO ou CRÍTICO
- Tensão bateria baixa → ATENÇÃO
- Erro ECU != 0 → CRÍTICO (analisar bitfield)
- Checksum inválido por > N segundos → ATENÇÃO (problema de cabo/hardware CAN)
- Sem amostra por > T segundos → ATENÇÃO (link CAN caído)

Cada limite acima precisa ser calibrado por carro com Flavio antes de ativar.

## Diferenciação dos 5 pacotes (DÚVIDA RESIDUAL #1)

Todos os 5 pacotes chegam com o mesmo CAN ID `0x7FB`. O PDF não documenta como o receptor distingue pacote 1 de pacote 2.

**Hipóteses:**

a) **Por ordem temporal.** Cada ciclo = pacote 1 → pacote 2 → ... → pacote 5, com 10 ms entre eles. O receptor mantém contador interno (0..4) e reinicia ao detectar checksum válido + valores fixos do pacote 5. Risco: perda de 1 pacote dessincroniza o contador até próximo ciclo válido.

b) **Por padrão de bytes fixos.** Pacote 4 termina com `0x1E 0xFC` (FIXED). Pacote 5 começa com `0xFB 0xFA` (FIXED) e termina com checksum. Os FIXEDs servem como sentinelas — receptor reconhece pacote 4 e pacote 5; demais ficam por exclusão temporal.

c) **Existe MUX byte não-documentado.** PDF poderia ter omitido um byte de identificação. Improvável (exemplo bate perfeitamente com a estrutura de 8 bytes utilizados).

**Recomendação para o parser:** implementar (a) + (b) combinados — manter contador temporal mas reiniciar via sentinelas FIXED quando ciclo se desalinhar.

**Ação para Flavio:** confirmar com Injepro (+55 45 3037-4040) se ordem temporal é determinística e qual o comportamento esperado em caso de perda de pacote.

## Dúvidas residuais

### Dúvida #1 — Diferenciação dos 5 pacotes

Já discutida na seção acima. Bloqueia parser robusto.

**Confiança para implementar mesmo assim:** Média. Hipóteses (a)+(b) cobrem maioria dos casos. Validar com captura real do barramento.

**Diretriz Flávio 2026-05-10:** valido na captura real do barramento (entrega do Flávio pendente, MS-9.1). Roda parser contra log de 5-10 min e confere se a heurística sentinela+ordem temporal aguenta sem ressincronização excessiva.

### Dúvida #2 — Layout dos bytes 2-6 do pacote 5

Pacote 5 tem 8 bytes; PDF documenta apenas 3 (`0xFB 0xFA` + checksum). Os 5 bytes intermediários são:

a) Zero-padding (mais provável — checksum do exemplo só fecha se eles somam zero).
b) Reservados para canais futuros.
c) Canais não-documentados que podem conter dado útil.

**Ação:** capturar barramento real para confirmar. Se zero-padding, aceitar como tal e ignorar. Se canais novos, mapear.

**Diretriz Flávio 2026-05-10:** valido na captura real do barramento (mesmo log da Dúvida #1). Inspeciono os 5 bytes em N ciclos diferentes; se variarem com cenário (RPM, temperatura), tem dado útil ali e mapeio.

### Dúvida #3 — Range físico máximo do EGT

EGT = `÷1` (valor direto em °C). uint16 → range técnico 0..65535. Range físico real?

Plausível para escape de motor de competição: 0..1500 °C. Acima disso, derretimento de coletor.

**Ação:** confirmar com Injepro qual é o teto (`OUT_OF_RANGE` se ultrapassar).

**Mitigação imediata:** usar `OUT_OF_RANGE` se EGT > 1500 °C — flagrar como erro de leitura ou falha catastrófica.

**Diretriz Flávio 2026-05-10:** quando chegar o momento de instalar a tela no carro do cliente, abro o Injepro T Software via USB e checo se a T4000 já tem um parâmetro de "EGT máximo / over-temp threshold" configurado.
- **Se já estiver configurado:** uso o valor da T4000 como teto canônico (`limits.egtMaxC` no LiveDataBridge), em vez do default 1500 °C hard-coded.
- **Se NÃO estiver configurado:** essa configuração entra na lista de **setup obrigatório do cliente** que a gente cobra como parte da instalação. Documenta no checklist de pré-instalação que o piloto/equipe tem que rodar uma vez antes da primeira sessão.

### Dúvidas adicionais (não bloqueantes)

- **Versão do firmware T4000 vinculada a esta spec:** desconhecida. Updates futuros podem mudar layout. Registrar versão na sessão; teste de regressão após update.
- **EGT sem sensor instalado:** byte fica zero ou stream omite o canal? Se zero, regra de detecção precisa distinguir "frio" de "ausente". Possível solução: marcar `MISSING` se EGT == 0 e `engine.water_temp > 50` (motor quente, EGT zero é impossível fisicamente).
- **Marcha = 0 significa neutro:** convenção comum mas não declarada explicitamente no PDF. Confirmar.
- **Erro ECU como bitfield:** PDF mostra `0x00 0x00` (zero = sem erro) mas não documenta o significado de cada bit. Necessário pedir tabela de bits à Injepro para mapear cada falha em mensagem ao mecânico.

## Implementação proposta

Módulos novos a criar (ver pendência P2 em `PENDENCIAS_GATE.md`):

- `src/telemetry/t4000-can-reader.js` — leitor binário (Mini PC, via adaptador CAN/USB ou direto USB da T4000)
- `src/telemetry/t4000-packet-parser.js` — decodifica os 5 pacotes, valida checksum, ordem, range
- `src/telemetry/t4000-provider.js` — herda `TelemetryProvider`, `source: 't4000-can'`, emite samples normalizados

Cada módulo segue Regra 9 das `TELEMETRY_ENGINEERING_RULES.md` (parser tem teste). Fixtures obrigatórias:

- ciclo válido completo (5 pacotes, checksum OK) — usar exatamente o exemplo do PDF (`0x91`)
- pacote com checksum inválido
- pacote 4 ausente (gap)
- pacote 5 fora de ordem
- ciclo duplicado
- valor RPM fora de range (50000)
- valor TPS negativo (impossível por unsigned, mas testar saturação)
- ciclo incompleto (3 pacotes apenas)
- recovery após gap longo (> 1s)
- bitfield de erro ECU != 0 → dispara CRÍTICO

## Riscos atualizados

1. ~~Spec totalmente hipotética~~ — RESOLVIDO. Spec confirmada pelo PDF oficial + checksum validado matematicamente.
2. **Diferenciação de pacotes** (Dúvida #1). Severidade: média. Mitigação: parser combina contador temporal + sentinelas FIXED.
3. **Bytes 2-6 do pacote 5** (Dúvida #2). Severidade: baixa (zero-padding mais provável; checksum fecha sem eles). Mitigação: validar via captura real.
4. **Firmware update da T4000** pode mudar protocolo. Mitigação: registrar versão na sessão, teste de regressão após update.
5. **CAN ID 0x7FB conflito** com outros dispositivos Injepro (WB-MINI, EGT-4 cadastrados como ID 1-12). Provavelmente os dispositivos secundários usam IDs diferentes; capturar barramento inteiro para confirmar antes de filtrar só por 0x7FB.
6. **EGT range máximo** (Dúvida #3). Severidade: baixa. Mitigação: `OUT_OF_RANGE` acima de 1500 °C como heurística inicial.

## Validação contra implementação atual

**Estado em 2026-04-24:** zero código de T4000/CAN existe. Spec agora confirmada — implementação fica liberada (depois das dúvidas residuais serem resolvidas via captura real ou contato Injepro).

Pendência P2 em `PENDENCIAS_GATE.md` permanece (parser não escrito), mas BLOCKER E2 sai de "aguardando spec" para **"spec confirmada — aguardando captura real para validar dúvidas residuais"**.

## Próximos passos

1. ~~Flavio contata Injepro pedindo SDK / spec CAN.~~ **FEITO** — spec recebida via PDF.
2. **Captura real do barramento** com adaptador CAN/USB. Validar:
   - Diferenciação dos 5 pacotes (Dúvida #1)
   - Bytes 2-6 do pacote 5 (Dúvida #2)
   - Range real do EGT (Dúvida #3)
   - Tabela de bits do Erro ECU
3. Implementar `T4000PacketParser` com testes — incluir o exemplo do PDF como fixture canônica.
4. Implementar `T4000CanReader` (driver do adaptador) e `T4000Provider`.
5. Integrar via `TelemetryTimebase` (ver `TELEMETRY_TIMEBASE_SPEC.md`).
6. Cadastrar regras críticas em `ALERT_HIERARCHY.md` com limites calibrados por canal.

## Referências

- **PDF oficial arquivado:** [`refs/INJEPRO_T4000_CAN_PROTOCOL_2026-04-24.pdf`](refs/INJEPRO_T4000_CAN_PROTOCOL_2026-04-24.pdf) — cópia local do documento original recebido via WhatsApp em 2026-04-24 (arquivo original nomeado "PROTOCOLO CAN AIM" mas conteúdo é spec Injepro publicada para integradores).
- Memória do projeto: `fam-racing-dominio.md` §"Injepro T4000 — Perfil Técnico".
- Bloqueio: [`BLOCKERS.md`](../../BLOCKERS.md) §E2.
