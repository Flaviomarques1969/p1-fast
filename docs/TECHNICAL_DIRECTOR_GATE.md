# RaceOps Technical Director Gate

> Este é o **primeiro de dois gates** da camada de governança. O segundo é o [`CHIEF_TELEMETRY_ENGINEER_GATE.md`](CHIEF_TELEMETRY_ENGINEER_GATE.md). Toda entrega passa pelos dois antes de ser declarada concluída.
>
> - **Diretor Técnico** (este documento): garante que a entrega responde uma pergunta real de corrida e gera ação prática.
> - **Engenheiro-Chefe de Telemetria**: garante que os dados estão corretos, sincronizados, auditáveis, rastreáveis e úteis.

Documento mestre da camada de governança técnica e de produto do FAM Racing.

Toda nova tela, módulo, métrica, alerta, relatório, análise, gráfico, integração ou feature passa por este Diretor Técnico antes de ser considerada pronta. Vale para os ambientes existentes e futuros do produto: planejamento de evento, checklist na hora da corrida, painel do box, HUD do piloto, telemetria, advisor, análise pós-stint, relatório pós-evento, garagem, eventos, pendências e o que vier.

## Premissa central

Telemetria não é produto. O produto é a resposta de decisão.

Toda entrega obedece à cadeia:

Dado bruto → Métrica → Interpretação → Resposta → Ação recomendada.

Se a cadeia não fecha, a entrega é reprovada.

## Princípios não-negociáveis

1. Nenhuma métrica aparece isolada — toda métrica vem com interpretação.
2. Nenhum gráfico existe sem decisão associada.
3. Nenhum alerta existe sem ação recomendada.
4. Nenhuma tela existe sem responder pergunta real do usuário no momento de uso real.
5. Toda análise separa fato, hipótese e recomendação.
6. Toda recomendação carrega risco, confiança e como validar.
7. Análise de curva nunca é avaliada só por velocidade de entrada — sempre considera entrada, frenagem, turn-in, apex, retomada do acelerador, saída e impacto na reta seguinte.
8. Nome de curva nunca é inventado. Sem nome real → identificador técnico provisório.
9. Dado insuficiente nunca vira conclusão. Vira hipótese + dado faltante + caminho de validação.
10. Setup nunca é recomendado antes de excluir erro de pilotagem.

## Missão do Diretor Técnico

Para cada entrega, o Diretor Técnico responde:

1. Essa entrega ajuda o piloto a andar melhor?
2. Essa entrega ajuda o box a tomar decisão melhor?
3. Essa entrega melhora segurança, consistência, ritmo, diagnóstico ou aprendizado?
4. Essa entrega responde uma pergunta real de corrida?
5. Essa entrega evita dashboard bonito porém inútil?
6. Essa entrega separa fato, hipótese e recomendação?
7. Essa entrega gera ação prática?
8. Essa entrega respeita o momento de uso (antes da pista, durante a pista, box ou pós-evento)?
9. Essa entrega usa linguagem adequada ao usuário correto?
10. Essa entrega considera o apex corretamente quando analisa curvas?

Resposta negativa em qualquer um → REPROVADA PELO DIRETOR TÉCNICO.

## Três ambientes obrigatórios

O sistema preserva três visões diferentes — código e UI nunca podem confundir.

### Ambiente A — Piloto na pista

Quem usa: piloto dentro do carro.
Onde: HUD na tela física do cockpit (monitor IBW 10.5" FHD no carro).
Princípio: instantâneo, óbvio, agressivamente legível, impossível interpretar errado.
Forma: frase de no máximo 2-3 palavras, semântica clara em cor, BIP discreto, silêncio como default.
Veto: gráfico complexo, análise estatística, número solto sem rótulo, mensagem longa, narração de volta.

### Ambiente B — Box / visão engenheiro

Quem usa: engenheiro/apoio no box.
Onde: TV 32" do box (1920×1080 landscape, mouse+teclado).
Princípio: pode receber análise profunda — desde que estruturada como pergunta → resposta curta → evidência → causa provável → ação recomendada → risco → confiança → como validar.
Veto: visualização bonita sem decisão, métrica sem interpretação, recomendação sem evidência, sugestão de setup antes de excluir erro de pilotagem.

### Ambiente C — Box / visão piloto

Quem usa: engenheiro decidindo o que comunicar ao piloto.
Onde: mesma tela do box, em modo de tradução.
Princípio: traduz análise técnica do Ambiente B em instrução curta do Ambiente A.
Regra: toda análise técnica do Ambiente B precisa ter equivalente operacional curto que possa ir ao piloto.

## Momentos de uso (todas as entregas mapeiam para um)

1. ANTES DA PISTA — planejamento do evento, planejamento do dia, planejamento do stint, checklist pré-pista. Ver `PRE_EVENT_CHECKLIST.md`.
2. DURANTE A PISTA — captura de telemetria, painel do box, HUD do piloto, mensagens, focos, alertas. Ver `ALERT_HIERARCHY.md` + `BOX_TO_PILOT_TRANSLATION_RULES.md`.
3. ENTRE STINTS — pirômetro, pressão, ajustes, plano do próximo stint, advisor pós-stint. Ver `POST_STINT_REVIEW_TEMPLATE.md`.
4. APÓS O EVENTO — relatório pós-evento, ajustes para o próximo, decisões de carro/setup/treino. Ver `POST_EVENT_REVIEW_TEMPLATE.md`.

## Cadeia de qualquer entrega

```
PERGUNTA real do usuário no momento real
      │
      ▼
DADO disponível (próprio + histórico + referência)
      │
      ▼
MÉTRICA com unidade e contexto
      │
      ▼
INTERPRETAÇÃO (separando fato, hipótese, recomendação)
      │
      ▼
RESPOSTA curta (Ambiente A) + completa (Ambiente B)
      │
      ▼
AÇÃO recomendada com risco, confiança e validação
      │
      ▼
DECISÃO registrada (Decision Log)
```

Se a entrega corta etapa, é reprovada.

## Reprovação automática

Reprovar imediatamente toda entrega que viole qualquer regra abaixo:

1. Dashboard sem decisão.
2. Métrica sem interpretação.
3. Alerta sem ação.
4. Setup sem evidência.
5. Setup antes de excluir erro de pilotagem.
6. Mensagem longa para piloto na pista.
7. Análise rasa para engenheiro.
8. Confundir telemetria com resposta.
9. Inventar nome de curva.
10. Tratar dado insuficiente como conclusão.
11. Criar complexidade sem ganho operacional.
12. Priorizar estética acima de decisão.
13. Ignorar segurança.
14. Não separar piloto, box engenheiro e box piloto.
15. Não dizer o que fazer depois.
16. Não registrar decisão.
17. Analisar curva sem considerar apex.
18. Avaliar curva só por velocidade de entrada.
19. Não diferenciar entrada, apex e saída.
20. Não indicar confiança da análise.

## Estrutura desta camada de governança

Esta pasta `docs/raceops/` contém os documentos:

- `TECHNICAL_DIRECTOR_GATE.md` (este arquivo) — visão mestre
- `PRODUCT_FOCUS_RULES.md` — regras de foco do produto
- `DELIVERY_REVIEW_CHECKLIST.md` — checklist de revisão por entrega
- `FEATURE_ACCEPTANCE_CRITERIA.md` — critério de aceite por feature
- `PILOT_QUESTIONS_MATRIX.md` — perguntas reais do piloto
- `ENGINEER_QUESTIONS_MATRIX.md` — perguntas reais do engenheiro
- `BOX_TO_PILOT_TRANSLATION_RULES.md` — como traduzir análise técnica em mensagem operacional
- `APEX_ANALYSIS_RULES.md` — apex como entidade central
- `CORNER_ANALYSIS_RULES.md` — análise de curva sequencial
- `PRE_EVENT_CHECKLIST.md` — checklist pré-pista
- `ALERT_HIERARCHY.md` — INFORMATIVO/ATENÇÃO/CRÍTICO/BOX AGORA
- `POST_STINT_REVIEW_TEMPLATE.md` — template de revisão pós-stint
- `POST_EVENT_REVIEW_TEMPLATE.md` — template de relatório pós-evento
- `TECHNICAL_DIRECTOR_DECISION_LOG.md` — log permanente das decisões do Diretor Técnico
- `AUDITORIA_INICIAL_DIRETOR_TECNICO.md` — auditoria do estado atual do produto
- `PENDENCIAS_GATE.md` — pendências vivas (P0/P1/P2/P3) derivadas da auditoria, Decision Log e validações

**Segundo gate (telemetria):**

- `CHIEF_TELEMETRY_ENGINEER_GATE.md` — visão mestre do segundo gate
- `TELEMETRY_ENGINEERING_RULES.md` — regras permanentes de engenharia de telemetria
- `TELEMETRY_REVIEW_CHECKLIST.md` — checklist por entrega de telemetria
- `T4000_CAN_SPEC.md` — spec da Injepro T4000 (status: hipótese)
- `RACEBOX_INTEGRATION_SPEC.md` — spec do RaceBox Mini (status: hipótese parcial)
- `TELEMETRY_TIMEBASE_SPEC.md` — sincronização multi-fonte
- `TELEMETRY_SNAPSHOT_SPEC.md` — snapshot unificado do carro
- `DATA_QUALITY_RULES.md` — 11 categorias canônicas
- `CROSS_VALIDATION_RULES.md` — validações cruzadas obrigatórias
- `MECHANIC_QUESTIONS_MATRIX.md` — perguntas reais do mecânico
- `TELEMETRY_ENGINEERING_DECISION_LOG.md` — log permanente das decisões de telemetria
- `AUDITORIA_INICIAL_TELEMETRIA.md` — auditoria do pipeline de telemetria

## Regra antes de declarar qualquer tarefa concluída

Antes de declarar qualquer tarefa concluída, registrar no Decision Log do Diretor Técnico:

```
## Revisão do Diretor Técnico
### Entrega avaliada
### Pergunta real que responde
### Usuário beneficiado
### Momento de uso
### Decisão que permite tomar
### Ação recomendada
### Risco
### Confiança
### Apex considerado? Sim / Não / Não aplicável
### Resultado: Aprovado / Reprovado / Aprovado com ajustes
### Motivo
```

E, se a entrega toca dado, registrar TAMBÉM no `TELEMETRY_ENGINEERING_DECISION_LOG.md`:

```
## Revisão do Engenheiro-Chefe de Telemetria
### Dados usados
### Origem dos dados
### Timestamp validado?
### Unidade validada?
### Escala validada?
### Qualidade dos dados
### Sincronização validada?
### Inferência marcada como inferência?
### Testes existentes
### Riscos técnicos
### Resultado: Aprovado / Reprovado / Aprovado com ajustes
### Motivo
```

Sem ambas as seções (quando aplicável), a entrega está incompleta.

## Relação com o resto do projeto

- ADR-008 (`ARCHITECTURE_DECISIONS.md`) já dizia: IA não opera segurança crítica. O Gate reforça e amplia.
- ADR-011 (specs travadas de tela) e ADR-012 (mensagens) continuam fonte de verdade visual e de linguagem. O Gate adiciona governança de produto sobre elas.
- `docs/PLANO_EXECUCAO.md` (blocos A-G) define o que vai ser construído. O Gate define como aceitar o que foi construído.
- `BLOCKERS.md` lista bloqueios de hardware. O Gate exige que toda entrega declare como se comporta com dado insuficiente — então bloqueio de hardware nunca vira "feature pela metade".
- Memórias do projeto (`memory/fam-racing*.md`) são contexto. O Gate é a régua.
