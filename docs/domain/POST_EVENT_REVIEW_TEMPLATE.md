# POST_EVENT_REVIEW_TEMPLATE — Template de relatório pós-evento

Relatório consolidado depois de um evento (track day, treino, validação). Maior escopo que `POST_STINT_REVIEW_TEMPLATE.md` — agrega todos os stints do evento e orienta o próximo.

A geração inicial vem da IA pós-evento. O engenheiro valida e edita. O resultado fica salvo no Decision Log e fica disponível para consulta entre eventos.

## 1. Resumo executivo

3-5 linhas. Linguagem direta, sem jargão.

```
Evento: ___________________________
Data: _____________________________
Pista: ____________________________
Piloto: ___________________________
Carro / configuração: _____________

Sumário em uma frase: ___
Cumpriu o objetivo do dia? sim / parcialmente / não — por quê
Maior conquista: ___
Maior frustração: ___
Confiança da análise: Alta / Média / Baixa
```

## 2. Stints do dia

Tabela:

```
Stint  Hora    Voltas  Melhor    Objetivo declarado          Cumpriu?
1      09:30   12      1:32.4    aquecer + baseline           sim
2      10:45   15      1:30.8    ataque                       parcial
3      ...
```

## 3. Melhor volta

```
Tempo: __:__.__ — Stint __ Volta __
Em comparação com:
  - PB pessoal nesta pista: ___
  - PB pessoal carro: ___
  - Referência (pista de referência cadastrada): ___
Em qual stint / hora aconteceu:
Condições da volta (pneu, ambiente):
Trechos dominantes positivos:
Trechos onde ainda houve perda:
```

## 4. Volta ideal

```
Soma das melhores parciais válidas: __:__.__
Delta volta real → ideal: __ s
Distribuição da perda por parcial:
  Parcial 1: __ s
  Parcial 2: __ s
  Parcial 3: __ s
  Parcial 4: __ s
```

## 5. Principal ganho possível

```
Trecho com maior potencial: ___ (estimativa __ s)
Razão: ___
Caminho de ganho: pilotagem / setup / outro
Plano para próximo evento: ___
```

## 6. Principal erro repetitivo

```
Padrão: ___
Trechos onde aparece: ___
Frequência (% das voltas válidas): __%
Causa provável: ___
Ação recomendada: ___
Já comunicado ao piloto durante o evento? sim / não / parcialmente
```

## 7. Diagnóstico do piloto (consolidado)

```
Pontos fortes do piloto neste evento:
  - ___
  - ___
Pontos a desenvolver:
  - ___
  - ___
Padrões recorrentes:
  - ___
Evolução vs evento anterior: melhorou / estável / regrediu — em qual eixo
Recomendações de treino para próximo evento:
  - ___
```

## 8. Diagnóstico do carro (consolidado)

```
Comportamento dominante observado: ___
Em quais condições piorava: ___
Em quais condições melhorava: ___
Sinais de degradação mecânica: nenhum / suspeita / confirmada
Itens que merecem inspeção pós-evento:
  - ___
```

## 9. Análise de frenagem

```
Padrão geral: consistente / variável
Pontos de frenagem dominantes:
Curva | ponto médio | desvio | consistência
___   | ___         | ___    | ___

Pontos críticos:
Recomendação para próximo evento:
```

## 10. Análise de apex e trajetória

Por trecho relevante (top 5):

```
Trecho ___:
  Estratégia cadastrada: antecipado / neutro / tardio / duplo
  Execução média: ___
  Tendência ao longo do evento: ___
  Recomendação: ___
```

Detalhes por curva em `APEX_ANALYSIS_RULES.md` e `CORNER_ANALYSIS_RULES.md`.

## 11. Análise de saída de curva

```
Trechos com saída comprometida ao longo do evento:
  - ___
Padrão: ___
Recomendação: ___
```

## 12. Estado de pneus

```
Composto usado: ___
Vida útil consumida: __% (estimativa baseada em tire-wear)
Comportamento (degradação ao longo dos stints):
Janela de temperatura observada vs ideal:
Recomendação para próximo evento: manter / mudar composto / mudar pressão alvo
Substituição agendada? quando
```

## 13. Estado de freios

```
Temperatura observada: ___
Tendência de fade: nenhuma / leve / preocupante
Vida útil de pastilhas estimada: __%
Fluido: ___
Recomendação:
```

## 14. Estado de motor

```
Canais Injepro: dentro / fora da janela
Alarmes do dia: ___
Manutenção recomendada antes do próximo evento:
  - ___
Tendência vs eventos anteriores:
```

## 15. Recomendações para o próximo evento

```
Mudanças propostas:
  - ___
Razão de cada uma:
  - ___
Risco de cada uma:
  - ___
Como validar:
  - ___
```

## 16. O que testar no próximo evento

```
Hipótese 1: ___ — como testar — critério de sucesso
Hipótese 2: ___ — como testar — critério de sucesso
```

## 17. O que NÃO mexer

Campo OBRIGATÓRIO. Sem ele, o relatório é considerado incompleto.

```
NÃO mexer em: ___
Razão: ___
NÃO mexer em: ___
Razão: ___
```

Exemplo:

```
NÃO mexer na traseira neste momento.
Razão: a perda principal está na entrada e apex da Curva 3, por excesso de
velocidade de entrada. Não é setup. Mexer na traseira mascara o erro de pilotagem.
```

## 18. Plano do próximo treino

```
Objetivos:
  1. ___
  2. ___
Foco principal:
Composto / pressão / setup propostos:
Voltas estimadas:
Carga sobre piloto:
```

## 19. Pendências geradas

Itens que viram pendência (manutenção, compra de peça, ajuste no cadastro do autódromo, calibração):

```
Pendência 1: ___ — prazo — responsável
Pendência 2: ___ — prazo — responsável
```

## 20. Decisão final

```
Aprovado pelo engenheiro / Flavio: SIM / NÃO / SIM COM AJUSTES
Confiança final: Alta / Média / Baixa
Salvo em advisorSuggestions (tipo='posevento'): SIM / NÃO
Registrado no Decision Log: SIM / NÃO
```

## Reprovação automática

Reprovar relatório pós-evento que:

- não preencha §1, §3, §4, §5, §6
- não preencha §17 ("o que NÃO mexer")
- recomende setup sem evidência
- analise curva sem apex (§10)
- não declare confiança em §20
- não gere pendências quando há ação de manutenção identificada

## Integração com o código

Hoje não há módulo `post-event` — apenas `post-stint`. Recomendação:

- Adicionar endpoint `/api/post-event` análogo a `/api/post-stint`
- Modal "Relatório do Evento" no Box, similar a "Pós-stint"
- Salvar em `advisorSuggestions` com `tipo='posevento'`

Ver `AUDITORIA_INICIAL_DIRETOR_TECNICO.md`.
