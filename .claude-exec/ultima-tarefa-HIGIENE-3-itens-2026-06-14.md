# TASK_INIT 14/06/2026 — HIGIENE (3 itens da auditoria)

> Arquivo próprio. NÃO toca o checkpoint trail-braking nem o de segurança.

1. **Pedido original (Flávio):** "faça tudo isso. faça os três" — referindo-se aos 3 que ofereci:
   (1) faxina das linhas de trabalho; (2) padronizar o pneu (tipo_pneu); (3) centralizar a chave pública.

2. **Objetivo em 1 frase:** executar os 3 itens de higiene, fazendo em desenvolvimento o que é seguro,
   preservando trabalho (faxina) e pedindo autorização para o que toca produção/é irreversível.

3. **Critérios de conclusão por item:**
   - FAXINA: inventário (incorporadas/seguras vs preservar vs ativas); remover só worktrees locais 100%
     incorporados+limpos; listar linhas remotas a apagar para o Flávio confirmar (irreversível). NUNCA
     perder trabalho órfão (regra dura: já perdeu Vista Piloto v04, Mola Helicoidal).
   - PNEU: normalização no código (seguro, dev) aplicada + testes verdes; migration de CHECK preparada
     e valores propostos (NÃO aplicar em prod sem autorização + decisão dos valores).
   - CHAVE: centralizar a chave pública num arquivo único (refactor de código, dev) + testes verdes,
     SE for seguro (todos os consumidores são módulos). Deploy do painel = separado, com autorização.

4. **Leitura confirmada:** protocolos FLAVIO (sim) · memória P1 Fast 2 caminhos (sim) · auditoria 14/06 (sim) ·
   regra "incorporar versões finais" + "não deletar sem preservar" (sim).

5. **Plano (≤5 passos):**
   (1) Investigar/preparar os 3 em paralelo (workflow read-only).
   (2) FAXINA: executar limpeza segura + listar o irreversível p/ confirmação.
   (3) PNEU: aplicar normalização no código + testar; preparar migration CHECK (sem aplicar).
   (4) CHAVE: centralizar no código + testar (se seguro).
   (5) Reportar: feito / preparado-aguardando-autorização / aguardando-decisão.

6. **Ambiente alvo:** desenvolvimento. **Produção protegida:** sim. **Autorização produção:** não (só "faça").
7. **Riscos:** FAXINA = perda de trabalho (mitigar: preservar em dúvida, só apagar incorporado, confirmar remoto).
   PNEU CHECK / CHAVE deploy = tocam produção (não aplicar sem autorização).
8. **Status inicial:** iniciado.