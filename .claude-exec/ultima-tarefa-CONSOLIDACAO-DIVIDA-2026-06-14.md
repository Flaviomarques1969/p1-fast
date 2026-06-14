# TASK_INIT 14/06/2026 — CONSOLIDAÇÃO DA DÍVIDA (11 dias fora da versão oficial)

1. **Pedido original (Flávio):** escolheu opção "3" — tratar à parte a dívida maior:
   11 dias / 324 registros automáticos sem consolidar na versão oficial (origin/main parou em 03/06).

2. **Objetivo em 1 frase:** mapear o que está na máquina e NÃO na versão oficial, agrupado por frente
   e por status (pronto/validado vs em andamento), e propor um plano seguro de consolidação —
   SEM registrar/publicar nada não validado.

3. **Critérios de conclusão (desta etapa = diagnóstico + plano):**
   - Mapa da divergência: 482 arquivos (53 do painel) agrupados por área/frente.
   - Cada frente com status: já em produção/validada · pronta pra registrar · em andamento (segurar).
   - Plano de consolidação por ordem de segurança + o que precisa de decisão do Flávio.
   - Entrega em formato mapa (HTML, navegador). NADA registrado na oficial sem autorização.

4. **Leitura confirmada:** protocolos FLAVIO (sim) · memória P1 Fast 2 caminhos (sim) ·
   CLAUDE.md projeto "alertar em risco, não escolher silenciosamente" (sim) · estado git real (sim).

5. **Plano (≤5 passos):**
   (1) Diagnóstico git read-only: divergência por área + migrations + janela temporal.
   (2) Agrupar por frente, cruzar com memória/estado de produção (o que já foi pro ar/nuvem).
   (3) Classificar: validado / pronto / em andamento.
   (4) Montar plano de consolidação seguro + mapa HTML.
   (5) Apresentar; aguardar decisão do Flávio sobre o que registrar.

6. **Ambiente alvo:** desenvolvimento / somente leitura. **Produção protegida:** sim.
   **Autorização produção/registro:** NÃO. Nada vai pra origin/main sem decisão item a item.
7. **Riscos:** registrar trabalho em andamento (trail-braking) na oficial = colocar não-validado.
   Mitigar: classificar status e só propor registro do que está pronto/validado.
8. **Status inicial:** iniciado.

---

## ONDA 1 — CONCLUÍDA 14/06 (registrada na versão oficial)
- Método: linha de consolidação a partir de origin/main + trazidos SÓ os paths seguros
  (docs, supabase/migrations, _design-reference, tools, .claude-perguntas, .claude-exec, raiz .md).
  Código em andamento (web/ios/tests/windows) NUNCA foi trazido. Trava verificou = 0.
- Resultado: commit `f40132b5` "consolidacao onda 1" enviado a origin/main (deb46bed→f40132b5).
  336 arquivos registrados. Dívida caiu de 483 → 151 arquivos.
- Migrations registradas refletem o que JÁ está na nuvem (alinha código↔banco). Duplicata 0028
  registrada COMO ESTÁ (não resolvida — tratar no futuro; resolver mexe no histórico, arriscado).
- Trabalho na máquina intacto (supabase-config.js etc presentes).
- DIVERGÊNCIA conhecida: main LOCAL tem o trabalho (326 registros) mas NÃO tem o commit de
  consolidação (que está só em origin/main). Não reconciliei a main local de propósito. A Onda 2
  usará o MESMO método (branch a partir de origin/main + trazer paths do painel) — não precisa pull.

## ONDA 3 — CONCLUÍDA 14/06 (app iPhone registrado)
- Conferência (workflow): app PRONTO — compila (BUILD SUCCEEDED) + 546 testes Swift verdes;
  manutenção (12/06), treinos v1 (11/06) e telas Assistir/Teste Ao Vivo completas, sem nada pela metade.
- Registrado SÓ `ios/` (20 arquivos) → commit `bff34e0f` em origin/main. Trava: fora-do-app = 0.
- NÃO instalei no iPhone físico (registrar ≠ empacotar/instalar — passo à parte, não pedido).
- Os testes JS (tests/) NÃO entraram: pertencem à Onda 2 (testam o painel; um deles falha pelo trail em andamento).

## PENDENTE — ONDA 2 (painel + testes JS + windows)
- Espera o trail-braking: `tests/node-smoke-trail-religacao.mjs` FALHA no RL-08 porque
  `web/cockpit/index-t3000.html` ainda está no layout de celular (precisa TELA 10,5: height 590, sem notch).
- Quando o RL-08 ficar verde, registrar painel + testes JUNTOS e colocar o painel no ar.
- Divergência da main local vs origin/main aumentou (3 commits de consolidação só no remoto) —
  reconciliar quando fechar a Onda 2. NÃO fazer git pull na main local até lá.

TASK_DONE (Onda 1):
- Pedido conferido: sim · Ambiente: versão oficial (origin/main) · Produção (app/painel no ar) alterada: NÃO
- Autorização: "resolve a onda 1" · Arquivos inspecionados: sim · Testes: trava de exclusão (0 código)
- Resultado: concluído (Onda 1) · Pendências: Ondas 2 e 3.