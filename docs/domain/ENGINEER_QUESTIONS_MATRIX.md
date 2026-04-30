# ENGINEER_QUESTIONS_MATRIX — Matriz de perguntas reais do engenheiro

Catálogo das perguntas que o engenheiro faz no box, antes/durante/após o stint. Toda feature do Ambiente B (Box engenheiro) responde a uma destas perguntas — em forma estruturada (pergunta → resposta curta → evidência → causa provável → ação recomendada → risco → confiança → como validar).

## Eixo PERFORMANCE

| Pergunta | Forma de resposta | Onde calcular |
|---|---|---|
| Qual foi a melhor volta deste stint? | Lap.tempoMs mínimo + comparação com PB pessoal/track | `Lap.melhor` |
| Qual é a volta ideal (combinando melhores parciais)? | Soma das melhores parciais válidas | `parcial-aggregator.idealLap` |
| Qual o delta entre volta real e volta ideal? | Diferença em ms + por parcial | `compare-view` |
| Onde está o maior potencial de ganho? | Trecho com maior delta para a referência | `attack-priority` |
| Qual setor mais comprometeu o stint? | Soma de deltas por parcial vs referência | `parcial-aggregator` |
| Qual curva mais comprometeu? | Soma de deltas por trecho | `parcial-aggregator` |
| O piloto está evoluindo ou piorando dentro do stint? | Tendência das últimas N voltas | `repeatability` |
| O piloto está evoluindo dia a dia? | Comparação cross-evento | base de eventos |

## Eixo PILOTAGEM

| Pergunta | Forma de resposta | Onde calcular |
|---|---|---|
| Piloto está freando cedo? | Estatística de ponto de frenagem nas últimas voltas | `fase-curva` + ref |
| Está freando tarde? | Idem | idem |
| Está entrando rápido demais? | Velocidade de entrada vs janela ideal | `parcial-aggregator` |
| Está errando apex? | Classificação `APEX_ANALYSIS_RULES.md` | analise de curva |
| Está acelerando tarde? | Delta de ponto de retomada | `fase-curva` |
| Está inconsistente? | Variância por trecho | `repeatability` |
| O erro é repetitivo ou isolado? | N voltas consecutivas com mesmo erro | `error-classifier` |
| O piloto sacrifica saída? | Apex bom + retomada atrasada + delta na reta seguinte | análise sequencial |

## Eixo CARRO

| Pergunta | Forma de resposta | Onde calcular |
|---|---|---|
| O carro está saindo de frente (subesterço)? | Padrão: ângulo de volante alto + raio amplo + delta na entrada | telemetria + IMU + ângulo |
| Está saindo de traseira (sobresterço)? | Padrão: contra-volante + slip do eixo traseiro | telemetria + IMU |
| Está instável em frenagem? | Yaw durante frenagem alta | IMU + pressão freio |
| Está perdendo tração? | Slip estimado em saída | telemetria + IMU |
| Está perdendo velocidade de reta? | Velocidade max em retas vs ref | parcial-aggregator |
| Há sinal de degradação mecânica? | Tendência de queda de performance independente de pilotagem | regras de detecção |

## Eixo SETUP

Aqui é onde a Regra 7 do `PRODUCT_FOCUS_RULES.md` morde mais forte: nunca recomendar setup antes de excluir pilotagem.

| Pergunta | Forma de resposta |
|---|---|
| Mexer ou não mexer? | Decisão consolidada com risco e confiança |
| Pressão? | Delta vs janela alvo + composto + temperatura |
| Cambagem? | Padrão de desgaste + comportamento em curva longa |
| Convergência? | Comportamento em transição reta-curva |
| Barra estabilizadora? | Rolagem vs apoio em curva longa |
| Amortecedor? | Resposta a zebra + assentamento |
| Freio? | Temperatura + eficiência + pedal |
| Relação? | Velocidade em fim de reta + RPM em curva lenta |
| Mapa? | Resposta de aceleração + consumo + λ |
| Arrefecimento? | Tendência de temperatura motor + ar |

Toda recomendação de setup segue:

```
Sintoma observado:
Evidência nos dados:
Causa provável:
Ajuste recomendado:
Risco do ajuste:
Como validar no próximo stint:
Confiança:
```

## Eixo PLANEJAMENTO

| Pergunta | Forma de resposta |
|---|---|
| Qual é o objetivo deste stint? | StintPlan ativo, escolhido no `stint-planner` |
| Qual é a meta? | Lista canônica (testar setup, treinar piloto, buscar tempo, validar manutenção, testar pneu, testar freio, coletar dados, simular corrida) |
| Quais trechos focar? | Multi-select 1-3 trechos no plano |
| FocusMode? | Auto / piloto / sugestão do engenheiro |
| Quantas voltas? | Plano + critério de abortar |
| Critério de abortar? | Regras explícitas (temperatura, ritmo, segurança) |
| Critério de chamar para o box? | Regras explícitas |

## Eixo PNEUS

| Pergunta | Forma de resposta |
|---|---|
| Estado dos 4 pneus? | Pirômetro 4 pontos + pressão + desgaste estimado |
| Quantas voltas o composto aguenta? | `tire-wear` baseado em histórico de instalações |
| Pressão atual vs alvo? | Manual no início + telemetria (futuro) |
| Janela ótima de temperatura? | Lookup composto + condição |
| Quando trocar? | Regras (vida útil + degradação observada) |

## Eixo FREIOS

| Pergunta | Forma de resposta |
|---|---|
| Temperatura atual? | Telemetria de freio (futuro) |
| Eficiência? | Desaceleração vs pressão de pedal |
| Risco de fade? | Tendência |
| Quando revisar? | Histórico de uso + fluido |

## Eixo MOTOR

| Pergunta | Forma de resposta |
|---|---|
| RPM, MAP, λ, temp motor, temp ar, pressão óleo, pressão combustível, ponto, %inj? | Canais Injepro T4000 (E2) — listar individual |
| Algum canal fora da janela? | Regra por canal + alerta no box |
| Tendência de degradação? | Comparação stint a stint |
| Mapa adequado? | λ-target vs λ-real, distribuição |

## Eixo CONFIANÇA E DADO

Toda resposta do engenheiro carrega:

- Confiança: Alta / Média / Baixa
- Critério: número mínimo de voltas válidas, qualidade do GPS, qualidade da telemetria
- Caminho de validação: o que confirmar no próximo stint

## Eixo PÓS-EVENTO

| Pergunta | Onde |
|---|---|
| Resumo executivo do dia? | `POST_EVENT_REVIEW_TEMPLATE.md` |
| Qual ganho possível para o próximo evento? | Idem |
| O que NÃO mexer? | Idem — campo obrigatório |
| Plano do próximo treino? | Idem |
| Status de pneus / freios / motor para próximo? | Idem |

## Como adicionar pergunta nova

1. Identificar eixo.
2. Mapear onde a resposta vive (qual módulo, qual store).
3. Definir forma estruturada (pergunta → resposta → evidência → causa → ação → risco → confiança → validação).
4. Atualizar este documento.
5. Registrar no Decision Log.
