# MECHANIC_QUESTIONS_MATRIX — Matriz de perguntas reais do mecânico

Catálogo das perguntas que o mecânico faz no box, antes/durante/depois do stint. Toda feature do sistema que toca diagnóstico mecânico responde a uma destas perguntas — em forma estruturada (pergunta → resposta curta → evidência → causa provável → ação → risco → confiança → validação).

Complementa `ENGINEER_QUESTIONS_MATRIX.md` (engenheiro de pista) e `PILOT_QUESTIONS_MATRIX.md`. O mecânico foca em saúde mecânica do carro; o engenheiro foca em performance e setup; o piloto foca em pilotagem.

## Eixo MOTOR — saúde básica

| Pergunta | Forma de resposta | Origem do dado |
|---|---|---|
| Pressão de óleo está segura? | Janela por RPM + temp óleo (`CROSS_VALIDATION_RULES.md` V-006) | T4000 CAN |
| Temperatura de água está estável? | Tendência por minuto (V-005) | T4000 CAN |
| Temperatura de óleo subindo? | Tendência | T4000 CAN |
| Tensão de bateria caindo? | Detecção V-008 | T4000 CAN |
| Alguma falha registrada na ECU? | Bitfield `engine.ecu_error` | T4000 CAN |
| Existe risco mecânico imediato? | Combinação de regras críticas | T4000 + ALERT_HIERARCHY |
| Motor está repetindo comportamento entre voltas? | Comparação volta a volta dos canais T4000 | T4000 análise |

## Eixo MISTURA E COMBUSTÃO

| Pergunta | Forma de resposta | Origem |
|---|---|---|
| A mistura está correta? | λ por janela (TPS, MAP, RPM) | T4000 CAN |
| Lambda fica pobre sob carga? | V-007 | T4000 CAN |
| Pressão de combustível cai em alta? | `engine.fuel_pressure` sob TPS alto | T4000 CAN |
| Bicos parecem entupidos? | Inferência: λ pobre + pressão estável + TPS alto | T4000 CAN análise |
| Mapa de combustível adequado? | Histograma de λ × células (futuro) | T4000 + análise pós-stint |

## Eixo ADMISSÃO E ESCAPE

| Pergunta | Forma de resposta | Origem |
|---|---|---|
| Temperatura de admissão está subindo? | `engine.intake_temp` tendência | T4000 CAN |
| MAP coerente com TPS? | Validação cruzada V-003 | T4000 análise |
| EGT (escape) dentro da janela? | `engine.egt` por RPM (se EGT-4 instalado) | T4000 CAN |
| Possível restrição admissão? | TPS alto + MAP baixo + accel baixo | Inferência |

## Eixo TRANSMISSÃO

| Pergunta | Forma de resposta | Origem |
|---|---|---|
| Marcha sendo lida corretamente? | V-004 | T4000 + GNSS |
| Patinação de embreagem? | RPM × marcha × velocidade fora da janela | V-004 |
| Velocidade CAN bate com GNSS? | V-001 | T4000 + RaceBox |

## Eixo ELÉTRICA

| Pergunta | Forma de resposta | Origem |
|---|---|---|
| Alternador carregando? | V-008 (tensão sob RPM > 2000) | T4000 |
| Algum sensor da ECU dando timeout? | Falta de canal por > T segundos | T4000 reader |
| Bateria descarregando entre stints? | Tensão início vs fim do stint | T4000 análise |

## Eixo SAÚDE GERAL DA TELEMETRIA (mecânico precisa saber se o que está vendo é real)

| Pergunta | Forma de resposta | Origem |
|---|---|---|
| Os dados que estou vendo são confiáveis? | `quality` global dos canais relevantes | DATA_QUALITY_RULES |
| Algum canal está silencioso? | Lista de canais `MISSING` | TelemetryTimebase status |
| Fonte caiu? | `signalQuality: 'lost'` | Provider |
| Cabo CAN solto? | T4000 sem amostra ou checksum inválido em série | CrossValidation |
| BLE do RaceBox instável? | Latência alta, gaps | TelemetryTimebase métricas |

## Eixo PNEUS (manual + inferido)

Mecânico preenche pirômetro/pressão manualmente; sistema cruza com performance.

| Pergunta | Forma de resposta | Origem |
|---|---|---|
| Temperatura dos 4 pneus está homogênea? | Pirômetro 4 pontos pós-stint | StintEnvironment manual |
| Pressão final é coerente com inicial? | Manual início + manual fim | StintEnvironment |
| Composto adequado para a condição? | Lookup composto + comparação ritmo | TireWear + Stint |
| Vida útil estimada? | `tire-wear.js` baseado em histórico | Domain |
| Padrão de desgaste sugere setup errado? | Pirômetro lateral × central + tendência (futuro) | StintEnvironment + análise |

## Eixo FREIOS (manual + inferido)

Sem sensores reais (Regra 4 das `TELEMETRY_ENGINEERING_RULES.md`). Tudo manual ou inferido.

| Pergunta | Forma de resposta | Origem |
|---|---|---|
| Tendência de fade? | Inferência: alongamento de frenagem volta a volta | DrivingEventDetector |
| Pastilhas chegando ao limite? | Histórico de uso (manual) | Manual |
| Fluido recente? | Manual | Manual |
| Disco empenado? | Sensação do piloto + vibração inferida (futuro) | Manual + IMU análise |

## Eixo PRÉ-EVENTO (mecânico)

Antes de qualquer stint, mecânico responde:

- Pressões calibradas (frias)?
- Pneus aderentes?
- Freios revisados?
- Combustível suficiente para o stint planejado?
- Câmeras ligadas?
- T4000 ligada e reportando?
- RaceBox carregado, BLE pareado, fix GNSS?
- Sensores funcionando?
- Cabo USB / CAN firmes?
- Comunicação Mini PC ↔ box estável?
- Logging ativado?

Ver `PRE_EVENT_CHECKLIST.md` §Etapa 3.

## Eixo PÓS-STINT (mecânico)

Logo após retorno:

- Pirômetro 4 pontos por pneu
- Pressão final por pneu
- Vazamentos visíveis?
- Som anormal?
- Temperatura mão (motor, freio) apropriada?
- Próximo stint vai precisar de quê?

Ver `POST_STINT_REVIEW_TEMPLATE.md` §9 (pneus) e §10 (freios).

## Eixo PÓS-EVENTO (mecânico)

Ver `POST_EVENT_REVIEW_TEMPLATE.md` §13 (freios) e §14 (motor) e §19 (pendências geradas).

## Linguagem

Mensagens para mecânico podem ser longas e técnicas — diferente do piloto. Mas cada uma carrega:

- pergunta de origem (deste catálogo ou novo)
- resposta curta
- evidência (quais canais, qual janela)
- causa provável
- ação recomendada (verificar / trocar / ajustar / inspecionar)
- risco
- confiança
- validação no próximo stint

## Reprovação automática

Reprovar feature de diagnóstico mecânico que:

- afirma medição que não existe (Regra 4 das `TELEMETRY_ENGINEERING_RULES.md`)
- mistura inferência com fato
- não cita janela temporal
- não cita evidência
- recomenda intervenção sem critério de validação
- ignora qualidade dos dados

## Como adicionar pergunta nova

1. Identificar eixo (motor / mistura / admissão / transmissão / elétrica / pneus / freios / pré / pós).
2. Mapear quais canais respondem.
3. Definir validações cruzadas aplicáveis (`CROSS_VALIDATION_RULES.md`).
4. Atualizar este documento.
5. Registrar no Decision Log do Diretor Técnico (perspectiva de produto) E no Decision Log do Engenheiro-Chefe de Telemetria (perspectiva de dados).
