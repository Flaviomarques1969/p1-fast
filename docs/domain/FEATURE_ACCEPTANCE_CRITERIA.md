# FEATURE_ACCEPTANCE_CRITERIA — Critérios de aceite de feature

Toda feature nova só é aceita se preenche os 14 campos abaixo. Sem um deles, a feature está incompleta — independente do estado do código.

Este documento é a régua estática. O `DELIVERY_REVIEW_CHECKLIST.md` é o fluxo dinâmico por entrega; este aqui é o contrato mínimo da feature.

## Os 14 campos

### 1. Pergunta que responde

Uma frase, em linguagem do usuário. Tem que existir em `PILOT_QUESTIONS_MATRIX.md` ou `ENGINEER_QUESTIONS_MATRIX.md` — ou ser adicionada lá agora.

Exemplo: "Onde estou perdendo tempo nesse stint?"

### 2. Usuário beneficiado

Piloto / Engenheiro / Apoio / Mecânico / Administração. Nome do papel. Não "todo mundo".

### 3. Momento de uso

Antes da pista / Durante a pista / Entre stints / Após o evento / Administração fora de evento.

Cada momento tem orçamento de atenção próprio:

- HUD piloto: 1 relance, segundos.
- Box durante stint: leitura periférica, sub-segundo de varredura.
- Box entre stints: análise, minutos.
- Pós-evento: leitura aprofundada, dezenas de minutos.
- Administração: tarefas administrativas comuns.

### 4. Dados necessários

Lista explícita: telemetria (quais canais, qual frequência), histórico (quantas voltas), referência (qual baseline), entrada manual (quais campos).

Cada dado vem rotulado: obrigatório / opcional / fallback se faltar.

### 5. Interpretação gerada

O que a feature transforma o dado em? Texto curto, classificação, score, recomendação, gráfico interpretado.

Sem interpretação, é só visualização — reprovado.

### 6. Ação recomendada

O que o usuário deve fazer depois de consumir a feature.

Mesmo "continuar como está" é ação válida — desde que seja decisão consciente, não silêncio.

### 7. Risco

Qual o risco de tomar a ação?

Exemplo: "Mexer na traseira pode mascarar erro de pilotagem real e atrasar correção." Sem risco declarado, recomendação não vai.

### 8. Confiança

Alta / Média / Baixa, com critério explícito de quando cada uma se aplica.

Confiança Baixa nunca dispara intervenção forte no piloto.

### 9. Critério de validação

Como o usuário confirma que a ação funcionou no próximo stint / próxima volta / próximo evento.

Exemplo: "Se a velocidade de saída da Curva 3 subir 3 km/h e o tempo do trecho cair 0,2s, a recomendação se confirma."

### 10. Mensagem para piloto, se aplicável

Frase de 2-3 palavras tirada da biblioteca canônica (`SPEC_MENSAGENS.md` §6) ou justificativa para nova frase.

### 11. Mensagem para box, se aplicável

Análise estruturada: pergunta → resposta → evidência → causa → ação → risco → confiança → validação.

### 12. Impacto

Em qual eixo a feature melhora o produto?

- Segurança
- Consistência
- Ritmo
- Diagnóstico
- Aprendizado de longo prazo
- Operação (logística, planejamento)

Cada feature lista 1-3 eixos. Sem eixo claro, não é feature — é ornamento.

### 13. Tratamento de dado insuficiente

Como a feature responde quando o dado é incompleto, ruim ou ausente.

Texto canônico:

```
Dados insuficientes para concluir.
Hipótese possível: ...
Dado necessário para confirmar: ...
```

Substituir reticências por conteúdo real.

### 14. Relação com entrada/apex/saída (se for análise de curva)

Toda análise de curva preenche:

- Que ponto da curva foi avaliado (entrada, frenagem, turn-in, apex, retomada, saída)?
- O apex foi classificado? (correto / antecipado / tardio / perdido por fora / interno demais / duplo / sacrificado intencionalmente)
- A perda de tempo foi atribuída ao ponto correto?

Análise de curva sem essa seção é reprovada.

## Exemplo de aplicação — Setup Advisor

| Campo | Valor |
|---|---|
| 1. Pergunta | "O que ajustar no carro depois deste stint?" |
| 2. Usuário | Engenheiro |
| 3. Momento | Entre stints |
| 4. Dados necessários | 5+ voltas válidas do stint, plano do stint, ambiente (pneu, temperatura), referência da pista |
| 5. Interpretação | Texto narrativo + 3 pontos-chave + classificação por causa (pilotagem / pneu / setup / mecânico / tráfego) |
| 6. Ação recomendada | Lista de ajustes priorizados, ou "não mexer" justificado |
| 7. Risco | Cada ajuste vem com risco específico |
| 8. Confiança | Alta apenas se 5+ voltas consistentes; Média 3-4; Baixa <3 |
| 9. Validação | Comparar X canais no próximo stint vs este |
| 10. Msg piloto | Não direta — passa por tradução do engenheiro |
| 11. Msg box | Análise completa estruturada |
| 12. Impacto | Diagnóstico + Aprendizado |
| 13. Dado insuficiente | "<5 voltas válidas — sugestão é hipótese, validar primeiro com mais voltas" |
| 14. Curva | N/A (não é análise de curva específica) |

## Exemplo de aplicação — Foco de trecho no HUD do piloto

| Campo | Valor |
|---|---|
| 1. Pergunta | "Como atacar este trecho agora?" |
| 2. Usuário | Piloto |
| 3. Momento | Durante a pista, na janela antes do trecho |
| 4. Dados necessários | Posição no traçado consolidado, velocidade atual, fase de curva, plano de stint ativo |
| 5. Interpretação | Etapa preparando/executando/resultado + ação principal |
| 6. Ação recomendada | 2-3 palavras da biblioteca |
| 7. Risco | Se confiança baixa, ativar pode confundir mais do que ajudar |
| 8. Confiança | Só ativa forte se Alta |
| 9. Validação | Resultado pós-trecho confirma ou nega |
| 10. Msg piloto | Frase canônica + cor + 2 bips curtos |
| 11. Msg box | Telemetria de ativação grava no log para análise pós-stint |
| 12. Impacto | Ritmo + Aprendizado |
| 13. Dado insuficiente | Não ativa modo forte; permanece em modo discreto |
| 14. Curva | Sequência completa (entrada → apex → saída) — alimenta o foco |

## Aplicação a features existentes

A `AUDITORIA_INICIAL_DIRETOR_TECNICO.md` aplica este critério a tudo que já existe e classifica como Aprovado / Aprovado com ajustes / Reprovado / Não avaliado por falta de contexto.
