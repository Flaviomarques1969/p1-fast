# POST_STINT_REVIEW_TEMPLATE — Template de revisão pós-stint

Estrutura obrigatória da revisão entre dois stints. O sistema apresenta esta estrutura preenchida; o engenheiro valida e edita; só então sugestões vão ao plano do próximo stint ou ao piloto.

A IA `/api/post-stint` segue este template ao gerar a análise. Sem template preenchido, a sugestão não vai pro Decision Log.

## 1. Identificação do stint

```
Stint #__
Evento: ______________________________
Data / hora início / fim:
Pista / parcial focada:
Piloto:
Carro / configuração:
Combustível início / fim:
Pneus (composto / idade / pressão início / pressão estimada fim):
Ambiente (temp pista / ar / condição):
Voltas totais / voltas válidas:
Plano declarado (objetivo, abordagem, trechos-foco, FocusMode):
```

## 2. Resumo executivo

Em 3-5 linhas:

- O stint cumpriu o objetivo?
- O que foi melhor que o esperado?
- O que ficou abaixo?
- Há alguma regressão vs stint anterior?
- Nível de confiança da análise: Alta / Média / Baixa.

## 3. Performance

```
Melhor volta deste stint: __:__.__ (vs PB do dia: __, vs PB pessoal: __)
Volta ideal (combinando melhores parciais válidas): __:__.__
Delta volta real → ideal: __ s
Maior potencial de ganho identificado: trecho ___, estimativa __ s
Tendência dentro do stint: melhorou / estável / piorou
```

## 4. Diagnóstico do piloto

Estrutura por trecho dominante (top 3):

```
Trecho: ___ (Curva da Bruxa / Curva 3 / etc.)
Pergunta: ___
Resposta curta: ___
Evidência (números): ___
Causa provável: ___ (pilotagem / pneu / carro / setup / tráfego)
Ação recomendada: ___
Risco da ação: ___
Confiança: Alta / Média / Baixa
Como validar no próximo stint: ___
```

## 5. Diagnóstico do carro

```
Comportamento dominante: subesterço / sobresterço / instabilidade / equilibrado
Em qual ponto da curva: entrada / apex / saída / transição
Em quais trechos: ___
Frequência: isolado / recorrente
Causa provável: setup / pneu / mecânico
Ação recomendada: ___
```

## 6. Análise de frenagem

```
Pontos de frenagem: consistentes / variáveis
Carregamento: progressivo / abrupto / inconsistente
Temperatura freio (se disponível): dentro / fora da janela
Padrão de erro: ___
Ação para piloto: ___
Ação para mecânico: ___
```

## 7. Análise de apex e trajetória

Para cada trecho relevante:

```
Trecho: ___
Apex classificação: correto / antecipado / tardio / perdido por fora / interno demais / sacrificado / etc.
Delta lateral / longitudinal vs apex ideal: ___ m / ___ m
Velocidade no apex: ___ km/h
Velocidade mínima: ___ km/h
Estratégia da curva (cadastro): antecipado / neutro / tardio / duplo
Compatibilidade execução vs estratégia cadastrada: alta / média / baixa
Ponto onde a perda nasceu: entrada / frenagem / turn-in / apex / retomada / saída
Frase para piloto (se aplicável): ___
```

Detalhes em `APEX_ANALYSIS_RULES.md` e `CORNER_ANALYSIS_RULES.md`.

## 8. Análise de saída de curva

```
Trechos com saída comprometida: ___
Padrão (apex tardio mas retomada atrasada / apex bom mas saída errada / etc.): ___
Delta na reta seguinte: ___ km/h fim de reta vs ref
Recomendação: ___
```

## 9. Estado de pneus

```
Temperaturas pós-stint (4 pontos): D-E ___ / D-D ___ / T-E ___ / T-D ___
Pressões estimadas pós-stint: D ___ / T ___ psi
Desgaste estimado: ___
Janela ideal vs real: dentro / fora
Composto adequado para condição? sim / não / dúvida
Ação recomendada: manter / mudar pressão / mudar composto / trocar
```

## 10. Estado de freios

```
Temperatura (se disponível): ___
Eficiência (desaceleração vs pressão): boa / em queda
Risco de fade no próximo stint: baixo / médio / alto
Ação recomendada: ___
```

## 11. Estado de motor

Canais Injepro T4000 (E2):

```
RPM máx: ___ (limite: ___)
MAP: dentro / fora janela
λ (sonda WB): adequado / pobre / rico
Temp motor: ___ (limite: ___)
Temp ar: ___
Pressão óleo: ___
Pressão combustível: ___
Alarmes disparados: ___
Ação recomendada: ___
```

## 12. Plano para o próximo stint

```
Objetivo proposto: ___
Tipo de abordagem: aquecimento / ataque / consistência / teste / livre
Trechos-foco propostos: ___ (1-3 trechos)
FocusMode proposto: auto / piloto / engenheiro
Ajustes mecânicos propostos: ___
Risco dos ajustes: ___
Critério de sucesso: ___
Critério de abortar: ___
```

## 13. O que NÃO mexer

Campo obrigatório. Lista do que está bom e não deve ser alterado.

```
Não mexer em: ___
Razão: ___
```

Sem esse campo, a revisão é considerada incompleta.

## 14. Tradução para o piloto

A partir do diagnóstico do piloto (§4), gerar a lista das frases canônicas que vão ao HUD no próximo stint:

```
Frase 1: "___" (trecho ___, gatilho ___)
Frase 2: "___" (trecho ___, gatilho ___)
...
```

Máximo 3 frases ativas por stint para não sobrecarregar.

Aplicar `BOX_TO_PILOT_TRANSLATION_RULES.md`.

## 15. Decisão final

```
Aprovado pelo engenheiro: SIM / NÃO / SIM COM AJUSTES
Edições do engenheiro: ___
Confiança final: Alta / Média / Baixa
Registrado em advisorSuggestions: SIM / NÃO
Registrado no Decision Log: SIM / NÃO
```

## Reprovação automática

Reprovar revisão pós-stint que:

- não preencha §1, §2, §3
- recomende setup sem evidência (§4-§6)
- não preencha §13 ("o que NÃO mexer")
- não declare confiança em §15
- crie frase para piloto fora da biblioteca canônica sem justificativa
- analise curva sem considerar apex (§7)

## Integração com o código atual

Hoje:

- `api/post-stint.js` + `src/box/post-stint.js` cobre §2-§4 parcialmente
- `src/domain/advisor-suggestion.js` armazena (com aprovação/edição/rejeição)

A ser adequado:

- Cobrir §7 (apex) explicitamente no prompt
- Garantir §13 ("o que NÃO mexer") no payload
- Gerar §14 (tradução para piloto) automaticamente
- Salvar revisão estruturada no Decision Log

Ver `AUDITORIA_INICIAL_DIRETOR_TECNICO.md` para o estado atual.
