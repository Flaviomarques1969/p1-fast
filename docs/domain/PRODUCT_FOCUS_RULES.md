# PRODUCT_FOCUS_RULES — Regras de foco do produto FAM Racing

Regras permanentes que protegem o produto contra deriva. Aplicam-se a toda entrega — código, UI, conteúdo, integração — e estão acima de preferência estética ou conveniência técnica.

## Regra 1 — O produto é a resposta, não a telemetria

Telemetria é insumo. Métrica é insumo. Gráfico é insumo. Produto é a resposta de decisão que o usuário consegue tomar olhando para a entrega.

Aplicação:

- Não criar tela cuja função se resume a "mostrar dado".
- Toda visualização tem que terminar em "o que fazer com isso".
- Toda métrica vem rotulada com sua interpretação.

## Regra 2 — Toda entrega tem usuário, momento e pergunta

Antes de qualquer linha de código:

- Quem usa? piloto / engenheiro / apoio / mecânico / o próprio Flavio fora da pista
- Em qual momento? antes da pista / durante a pista / entre stints / após o evento / fora de evento (administração)
- Qual pergunta real responde?

Sem as três respostas, a entrega não começa.

## Regra 3 — Linguagem segue o usuário

- Piloto na pista: 2-3 palavras, semântica em cor, BIP, silêncio é default.
- Engenheiro no box: análise completa, evidência, causa provável, ação, risco, confiança.
- Box → piloto: tradução obrigatória. A análise de engenheiro precisa ter equivalente operacional curto.
- Administração (planejamento, garagem, eventos): linguagem direta, sem jargão técnico desnecessário.

## Regra 4 — Separação rígida de ambientes

- Ambiente A (HUD piloto): nunca mostra gráfico, ranking, comparativo longo, explicação analítica.
- Ambiente B (Box engenheiro): pode mostrar análise profunda. Nunca mostra mensagem que iria direto para o piloto sem tradução.
- Ambiente C (Box → piloto): só existe como tradução do B em forma do A.

Misturar os três é violação.

## Regra 5 — Cadeia obrigatória

Dado bruto → Métrica → Interpretação → Resposta → Ação recomendada.

Toda entrega cumpre a cadeia inteira ou é reprovada.

## Regra 6 — Apex como entidade central na análise de curva

Curva nunca é avaliada apenas por velocidade de entrada.

Sequência canônica de análise: Entrada → Frenagem → Turn-in → Apex → Retomada do acelerador → Saída → Delta na reta seguinte.

Detalhe em `APEX_ANALYSIS_RULES.md` e `CORNER_ANALYSIS_RULES.md`.

## Regra 7 — Setup só depois de excluir pilotagem

Antes de recomendar qualquer mudança mecânica:

1. Excluir hipótese de erro do piloto.
2. Excluir hipótese de pneu (composto, desgaste, pressão).
3. Excluir hipótese de tráfego.
4. Excluir hipótese de degradação mecânica não-setup (freio quente, motor cortando).

Só então, recomendar setup com evidência, risco e plano de validação.

## Regra 8 — Dado insuficiente é resposta válida

Sem dado, a entrega responde:

```
Dados insuficientes para concluir.
Hipótese possível: X.
Dado necessário para confirmar: Y.
```

Nunca inventar conclusão. Nunca preencher vazio com texto bonito.

## Regra 9 — Nome de curva é fato, não invenção

Quando o nome real for conhecido, usar (ex: Curva da Bruxa, Mergulho, Junção).

Quando não for, usar identificador técnico provisório: Curva 1, Curva 2, Trecho 7. Nunca inventar nome poético, comercial ou genérico.

## Regra 10 — Confiança é parte da resposta

Toda análise carrega Alta / Média / Baixa.

Confiança baixa → recomendação cautelosa, sugestão de validação obrigatória, não dispara intervenção forte no piloto.

## Regra 11 — Segurança não negocia

Alertas críticos (BOX AGORA, abortar volta, falha mecânica iminente) são determinísticos. Nunca dependem de IA. Nunca podem ser silenciados por filtro de sobrecarga ou por vontade do designer de tela.

ADR-008 do projeto reforça isto.

## Regra 12 — Sem feature ornamental

Feature nova só entra se preenche o `FEATURE_ACCEPTANCE_CRITERIA.md`. Feature já existente que não preenche entra no plano de remoção ou correção, não em "deixa quieto".

## Regra 13 — Sem fases nem v2 no produto entregue

Já é regra do projeto (`feedback_fam_racing_sem_fases.md`). Se uma feature está pronta, está pronta. Se não está, não vai ao usuário. Não existe "placeholder vira X depois" em superfície de uso.

## Regra 14 — Decisão registrada

Toda decisão de produto que afete o sistema entra no `TECHNICAL_DIRECTOR_DECISION_LOG.md`. O log é a memória oficial do gate.

## Regra 15 — O sistema é maior que o painel

O produto FAM Racing inclui (mas não se limita a):

- planejamento de evento e de stint
- checklist na hora da corrida
- painel do box (TV 32")
- HUD do piloto (monitor no carro)
- captura e análise de telemetria
- advisor IA
- análise pós-stint
- relatório pós-evento
- garagem (carros, configurações, manutenção)
- eventos e pendências

Toda regra deste documento aplica a TODOS os módulos. Não existe módulo "menor" que escapa do gate.
