# DELIVERY_REVIEW_CHECKLIST — Checklist de Revisão pelo Diretor Técnico

Toda entrega — tela, módulo, relatório, alerta, métrica, integração ou feature — passa por este checklist antes de ir ao usuário.

Resultado vai para `TECHNICAL_DIRECTOR_DECISION_LOG.md`.

## 1. Identificação da entrega

- Nome da entrega:
- Tipo: tela / módulo / relatório / alerta / métrica / integração / outro
- Ambiente: piloto / box engenheiro / box piloto / pré-evento / pós-evento / administração
- Usuário principal:
- Momento de uso:
- Arquivos tocados:

## 2. Pergunta principal

- Qual pergunta real essa entrega responde?
- Essa pergunta é de piloto, engenheiro, apoio ou administração?
- Essa pergunta acontece antes, durante ou depois da pista?
- A pergunta foi extraída de `PILOT_QUESTIONS_MATRIX.md` ou `ENGINEER_QUESTIONS_MATRIX.md`?
- Se a pergunta é nova, foi adicionada à matriz correspondente?

## 3. Decisão

- Que decisão essa entrega permite tomar?
- Essa decisão é imediata (segundos) ou analítica (minutos/horas)?
- O que o usuário deve fazer depois?
- Existe caminho explícito do "vi a informação" para o "tomei a ação"?

## 4. Dados

- Quais dados são usados (próprios, histórico, referência, IA)?
- Esses dados são confiáveis?
- Qual a frequência mínima/qualidade mínima?
- Há dado faltante? Como se comporta?
- A entrega diferencia fato, hipótese e recomendação?
- Origem de cada número está rastreável (live / histórico / IA / manual)?

## 5. Ação

- Existe ação recomendada explícita?
- A ação é clara em uma frase?
- A ação tem risco declarado?
- A ação tem critério de validação no próximo stint/volta?
- Quem executa a ação está nomeado (piloto, mecânico, engenheiro)?

## 6. Linguagem

- A linguagem está adequada ao usuário?
- Piloto recebeu mensagem curta (2-3 palavras)?
- Engenheiro recebeu análise completa estruturada (pergunta → resposta → evidência → causa → ação → risco → confiança → validação)?
- Box consegue traduzir análise técnica para instrução operacional curta?
- Mensagens fora da biblioteca canônica? (se sim, justificar e atualizar `BOX_TO_PILOT_TRANSLATION_RULES.md`)

## 7. Curvas e apex (se aplicável)

- A análise considera entrada, frenagem, turn-in, apex, retomada do acelerador, saída e impacto na reta seguinte?
- O apex foi classificado conforme `APEX_ANALYSIS_RULES.md`?
- A perda de tempo foi atribuída ao ponto correto da curva (entrada / apex / saída)?
- O sistema evita avaliar curva apenas por velocidade de entrada?
- Confiança da análise está declarada?

## 8. Confiança e dado insuficiente

- Confiança da análise: Alta / Média / Baixa.
- Se confiança Baixa, o sistema reduz intensidade da intervenção (não dispara foco forte ao piloto, não recomenda setup, propõe validação)?
- Se dado insuficiente, a entrega responde como "Dados insuficientes" + hipótese + dado necessário + caminho de validação?

## 9. Segurança

- A entrega afeta canal crítico (alerta, BOX AGORA, abortar volta)? Se sim, é determinística (não-IA)?
- Filtro de sobrecarga não pode silenciar canal crítico — verificado?
- Regressão de segurança não introduzida?

## 10. Performance e contexto técnico

- Roda dentro do orçamento de tempo do momento de uso (HUD = ms; box = sub-segundo; relatório pós = segundos a minutos)?
- Não bloqueia coleta de telemetria (ADR-003 / ADR-014)?
- Não introduz dependência de rede em caminho live?

## 11. Reprovação automática

Reprovar imediatamente se ocorrer qualquer um:

- For apenas gráfico bonito sem decisão.
- Não responder pergunta real.
- Não gerar decisão.
- Não gerar ação.
- Misturar hipótese com fato.
- Recomendar setup sem evidência ou antes de excluir pilotagem.
- Sobrecarregar piloto com informação.
- Criar alerta sem ação.
- Criar métrica sem interpretação.
- Analisar curva sem considerar apex.
- Inventar nome de curva.
- Apresentar dado insuficiente como conclusão.
- Misturar Ambiente A, B e C.
- Não declarar confiança.
- Quebrar canal crítico determinístico.

## 12. Decisão final

- Aprovado pelo Diretor Técnico: SIM / NÃO / SIM COM AJUSTES
- Motivo:
- Ajustes obrigatórios (se houver):
- Data:
- Sessão / commit / PR:

## 13. Pós-aprovação

- Decision Log atualizado: SIM / NÃO
- Memória do projeto atualizada se mudou alguma decisão estrutural: SIM / NÃO / NÃO APLICÁVEL
- Auditoria atualizada se módulo já estava listado: SIM / NÃO / NÃO APLICÁVEL
