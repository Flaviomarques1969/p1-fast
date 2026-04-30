# PILOT_QUESTIONS_MATRIX — Matriz de perguntas reais do piloto

Catálogo das perguntas que o piloto faz na pista. Toda feature do Ambiente A (HUD piloto) responde direta ou indiretamente a uma destas perguntas. Toda feature do Ambiente B (box) deve gerar resposta que possa ser traduzida em uma destas perguntas pelo Ambiente C.

Mensagem para piloto sempre:

- 2-3 palavras (frase canônica)
- semântica em cor + BIP
- silêncio é default

Mensagem errada para piloto: "A análise estatística dos últimos três stints sugere..." — isso é Ambiente B, não A.

## Eixo RITMO

| Pergunta | Resposta esperada (forma curta) | Frase canônica | Onde calcular |
|---|---|---|---|
| Estou rápido ou lento agora? | Delta vs melhor volta | número delta colorido + cor | Lap em curso vs `Lap.melhor` |
| Minha volta atual está melhor ou pior? | Tendência da volta | barra colorida no HUD; "boa volta" / silêncio | `parcial-aggregator` running |
| Onde estou ganhando? | Trecho dominante positivo | confirmação curta pós-trecho ("boa saída") | delta por trecho |
| Onde estou perdendo? | Trecho dominante negativo | ação antes do próximo trecho ("freie antes") | delta por trecho + plano |
| Estou consistente? | Variância das últimas N voltas | sem mensagem direta — vai pro box | `repeatability.js` |
| Vale continuar empurrando? | Combinação ritmo + pneu + freio + segurança | silêncio se ok; "poupar" se não | regras determinísticas + advisor |

## Eixo FRENAGEM

| Pergunta | Resposta esperada | Frase canônica | Onde calcular |
|---|---|---|---|
| Estou freando cedo? | Delta de ponto de frenagem vs ref | "freie depois" | `fase-curva` + ref histórica |
| Estou freando tarde? | Idem inverso | "freie antes" | idem |
| Estou soltando o freio cedo? | Carregamento de freio até turn-in | "segure freio" (frase a calibrar) | telemetria de pressão freio (E2) |
| Estou carregando freio demais? | Aceleração lateral combinada com pressão | "menos entrada" | telemetria + IMU |
| Estou comprometendo a saída? | Apex tardio + retomada atrasada | "priorize saída" | análise de curva completa |

## Eixo APEX E TRAJETÓRIA

| Pergunta | Resposta esperada | Frase canônica | Onde calcular |
|---|---|---|---|
| Acertei o apex? | Classificação apex (correto / cedo / tarde / fora / interno) | confirmação curta | `APEX_ANALYSIS_RULES.md` |
| Apex cedo? | Apex antecipado | "apex tarde" / "mire tarde" | delta lateral + longitudinal |
| Apex tarde? | Apex tardio (intencional ou não) | "apex cedo" se não-intencional | idem |
| Perdi apex por fora? | Distância lateral excessiva ao apex ideal | "mais interno" | trajetória vs ref |
| Passei interno demais? | Distância lateral negativa | "menos interno" | idem |
| Estou usando toda a pista? | Saída até a borda externa | confirmação | trajetória de saída |
| Estou sacrificando saída? | Apex bom mas retomada tardia | "priorize saída" | análise de curva completa |

## Eixo ACELERAÇÃO E SAÍDA

| Pergunta | Resposta esperada | Frase canônica | Onde calcular |
|---|---|---|---|
| Estou acelerando cedo? | Delta de ponto de retomada vs ref | "acelere depois" | `fase-curva` |
| Estou acelerando tarde? | Idem inverso | "acelere antes" | idem |
| Estou patinando? | Slip ratio (futuro) ou aceleração real vs ideal | confirmação | telemetria avançada |
| Estou saindo lento? | Velocidade de saída vs ref | "saia forte" | parcial-aggregator |
| Estou carregando velocidade para a reta? | Delta na reta seguinte | confirmação | delta de reta |

## Eixo PNEUS

Toda intervenção de pneu na pista é discreta — nunca crítico salvo falha mecânica.

| Pergunta | Resposta esperada | Frase canônica | Onde calcular |
|---|---|---|---|
| Posso continuar empurrando? | Estado consolidado de pneu | silêncio se ok | `tire-wear` + temp pirômetro |
| Algum pneu está quente demais? | Temperatura por roda fora da janela | "poupar D-E" (futuro, calibrar) | telemetria + pirômetro |
| Pressão subiu demais? | Pressão estimada vs alvo | indicação no box | telemetria pressão (futuro) |
| Estou destruindo dianteiro? | Combinação temperatura + tipo de uso | "menos entrada" | tire-wear + análise de curva |
| Preciso aliviar? | Decisão consolidada | "poupar" + cor | regras determinísticas |

## Eixo FREIOS

| Pergunta | Resposta esperada | Frase canônica | Onde calcular |
|---|---|---|---|
| Freio está aquecendo? | Temp freio vs janela | "poupar freio" | telemetria temp freio (futuro) |
| Estou usando freio demais? | Tempo total de freio por volta | indicação no box | telemetria pressão |
| Preciso poupar? | Decisão consolidada | "poupar freio" | regras |
| Pedal pode estar perdendo eficiência? | Pressão constante mas desaceleração caindo | "atenção freio" | telemetria avançada |

## Eixo SEGURANÇA

Aqui as mensagens podem ir até o nível CRÍTICO ou BOX AGORA. Determinísticas, nunca IA. Ver `ALERT_HIERARCHY.md`.

| Pergunta | Resposta esperada | Frase canônica | Onde calcular |
|---|---|---|---|
| Tem algo errado? | Estado consolidado de segurança | silêncio se ok | regras + telemetria |
| Devo abortar? | Decisão crítica do box | "abortar volta" | manual box ou regra crítica |
| Devo voltar ao box? | Decisão BOX AGORA | "box agora" + bip longo | manual box ou regra |
| Existe risco mecânico? | Detecção de anomalia | "atenção" + cor | regras determinísticas |

## Eixo COMUNICAÇÃO COM O BOX

Mensagens prefixadas com "Box:" — ver `SPEC_MENSAGENS.md` §6.5.

| Pergunta do piloto | Vem do box | Frase canônica |
|---|---|---|
| O que o engenheiro está pensando? | Box manual | "Box: foco T2", "Box: manter" |
| Posso atacar agora? | Box manual | "Box: última forte", "Box: livre" (futuro) |
| Devo resfriar? | Box manual | "Box: resfriar" |

## Mensagens proibidas para piloto na pista

Reprovar imediatamente:

- Qualquer frase com mais de 4 palavras.
- Análise estatística ("histograma", "variância", "tendência de stint").
- Comparação entre múltiplos stints.
- Recomendação de setup ("aumentar pressão", "reduzir cambagem") — isso é box, não piloto.
- Ranking ou comparação contra outros pilotos.
- Explicação técnica longa.

## Como adicionar pergunta nova

1. Identificar eixo (ritmo, frenagem, apex, aceleração, pneus, freios, segurança, comunicação).
2. Definir resposta esperada na forma curta + cor + áudio.
3. Verificar se há frase canônica que sirva. Se não, propor nova frase, justificar e atualizar `SPEC_MENSAGENS.md` via ADR.
4. Mapear onde calcular no código.
5. Registrar no Decision Log.

## Lista canônica para implementação imediata

Curto prazo (já existe parcialmente no projeto):

- "boa saída" / "boa frenagem" / "boa volta" — confirmações pós-trecho/volta
- "freie antes" / "freie depois" — ajuste de ponto de frenagem
- "acelere antes" / "acelere depois" — ajuste de retomada
- "priorize saída" — apex tardio
- "mantenha linha" — manutenção
- "menos entrada" / "mais saída" — equilíbrio entrada/saída
- "abortar volta" / "box agora" — críticos
- "Box: ..." — manual do engenheiro

Médio prazo (depende de canais que ainda não chegam):

- "poupar D-E" / "poupar freio" — depende de pirômetro / temp freio
- "atenção freio" — depende de telemetria de pressão e desaceleração

Longo prazo (depende de IA + análise de imagem):

- "bandeira amarela" / "safety car" / "bloco atrás" — depende de Insta360 + Claude Vision (E1)
