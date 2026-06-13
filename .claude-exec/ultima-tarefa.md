# TASK_INIT 13/06/2026 — LIGAÇÕES REAIS DO COMMAND BOX COM O SISTEMA (análise honesta + teste)

> Tarefa anterior (classificador de curvas) preservada em
> `.claude-exec/ultima-tarefa-backup-pre-command-box-2026-06-13.md`.

1. **Pedido original (Flávio, literal):** "em p1 fast eu Gostaria de começar a criar as
   ligações reais, verdadeiras do Box Command Center com o sistema. Faz uma análise honesta,
   com evidência, teste as funcionalidades para a gente poder fazer funcionar."

2. **Objetivo em 1 frase:** mapear com evidência o que existe hoje no Command Box, o que já
   está ligado a dado real e o que é mockup, testar o que dá pra testar, e entregar um plano
   honesto e faseado para começar as ligações reais — sem tocar produção.

3. **Critérios objetivos de conclusão:**
   (a) inventário verificado de cada tela do Command Box com origem real do dado (estático vs vivo);
   (b) fonte de dado ao vivo real (canal cockpit-bubi-live, Supabase prod fvhwltzhytpnhlqbttmd) e formato;
   (c) levantamento do persistido/histórico (Supabase, advisor) que alimentaria engenharia;
   (d) execução dos testes automáticos relevantes com saída real PASS/FAIL;
   (e) mapa de lacunas honesto;
   (f) plano faseado em linguagem de gestor;
   (g) revisão adversarial antes de entregar;
   (h) NADA alterado em produção nem no cockpit ao vivo.

4. **Leitura confirmada:** ~/.claude/CLAUDE.md (sim) · padroes.md (sim, vazio) ·
   FLAVIO_EXECUTION_PROTOCOL (sim) · FLAVIO_DONE_CHECKLIST (sim) · FLAVIO_ENVIRONMENT_RULES (sim) ·
   FLAVIO_COMMUNICATION_RULES (sim) · CLAUDE.md do projeto (sim) · AMBIENTES_P1_FAST (sim) ·
   memórias Command Box (só visualização; cockpit vs command box) (sim).

5. **Plano <=5 passos:** (1) inventariar cada tela e provar origem do dado; (2) mapear fonte ao
   vivo real e o que entrega; (3) mapear histórico/persistido (Supabase+advisor); (4) rodar testes
   relevantes e capturar saída real; (5) sintetizar lacunas + plano faseado, revisão adversarial,
   abrir pro Flávio.

6. **Arquivos/áreas:** _design-reference/mockup-command-box-*.html + selecao-command-box.html ·
   web/cockpit/cloud-bridge.js, main-t3000.js, cockpit-renderer.js, advisors · api/advisor.js ·
   supabase/migrations, functions, config.toml · tests/node-smoke-* · docs/FONTE_DADOS_AO_VIVO.md.

7. **Ambiente alvo:** desenvolvimento (análise local + leitura). Nada de deploy/escrita.
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida (tarefa é só análise/teste).
11. **Riscos:** (a) Command Box hoje é mockup -> não superestimar "pronto"; (b) canal ao vivo
    aponta pro Supabase de PRODUÇÃO -> leitura segura, não escrever; (c) afirmar "ligado" sem
    prova -> revisão adversarial; (d) telas de engenharia dependem de sensores talvez não instalados.
12. **Status inicial:** iniciado.
