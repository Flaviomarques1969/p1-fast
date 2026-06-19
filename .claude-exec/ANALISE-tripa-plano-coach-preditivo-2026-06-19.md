# TASK_INIT — Análise da tripa Plano · Stint · P1 Coach · Alerta Preditivo

> Arquivo dedicado a esta tarefa. O `ultima-tarefa.md` (69KB, log ativo) foi PRESERVADO, não sobrescrito.

1. **Pedido original de Flávio:** "essa tripa aí que eu peguei, que é Plano, Stint, P1 Coach — faça análise detalhada e monte um plano de trabalho." Quer saber, dessa coluna do Command Box (vista piloto), o que já está funcionando de verdade com base nos dados reais coletados na nuvem, quais análises estão sendo feitas, e um plano de trabalho.
2. **Objetivo em 1 frase:** Mapear, bloco a bloco dessa coluna, o que é dado REAL (vindo do `cockpit-bubi-live`/coletado) vs número de demonstração ("aguardando ligação"), explicar a análise por trás de cada um, e entregar um plano de trabalho priorizado.
3. **Critérios de conclusão:** (a) cada sub-bloco da tripa classificado REAL / PARCIAL / DEMONSTRAÇÃO com prova no código; (b) a lógica/análise de cada um descrita; (c) o que falta pra ficar real listado; (d) plano de trabalho priorizado, em linguagem de gestor.
4. **Leitura confirmada:** `~/.claude/CLAUDE.md` (sim), `~/.claude-decisoes/padroes.md` (sim), `FLAVIO_EXECUTION_PROTOCOL.md` (sim), `FLAVIO_DONE_CHECKLIST.md` (pendente leitura completa), `FLAVIO_ENVIRONMENT_RULES.md` (sim), `FLAVIO_COMMUNICATION_RULES.md` (pendente leitura completa), memória P1 Fast (sim, índice).
5. **Plano (≤5 passos):** (1) inspecionar o mockup e os módulos JS reais; (2) classificar cada bloco REAL/PARCIAL/DEMO com evidência; (3) descrever a análise de cada um; (4) listar o que falta; (5) montar plano de trabalho.
6. **Áreas a inspecionar:** `_design-reference/mockup-command-box-vista-piloto.html`, módulos JS de cálculo (vmin, frenagem, trail, plano-stint, alerta preditivo, shift light), `docs/ARQUITETURA_DEFINITIVA.md`, `docs/CONCEITOS_TRECHO_PRODUTO.md`, worktree `plano-stint-banco-v1`.
7. **Ambiente alvo:** desenvolvimento.
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização:** não recebida (não é necessária — análise somente leitura).
11. **Riscos:** baixo (só leitura). Risco real seria afirmar que algo é "real" sem prova — mitigado exigindo evidência no código por bloco.
12. **Status inicial:** iniciado.

---

## RESULTADO (verificado por código + verificação adversarial — 16 agentes)

**Veredito-mãe:** a tripa inteira (Plano·Stint, P1 Coach, Alerta Preditivo) está em **DEMONSTRAÇÃO**. O próprio código marca esses blocos como "aguardando ligação" (lista `DEP_LIGACAO`, mockup linha 7790: `['mapa','shift-light','coach','delta-acum','stint','stint-bar','checklist']`). Nenhum número do print sai de dado coletado.

### Por bloco (todos DEMONSTRAÇÃO, com prova)
- **VOLTA 8/12, 67%, decorrido/restante** — fixo no HTML (3773-3779). Não há código que escreva `voltaN/voltaPct/voltaFill`.
- **META DO PILOTO (sub 1:32, 6/8 atingidas)** — fixo (3787-3795). O schema real do plano de stint (mig 0042) **nem tem** campo de tempo-alvo nem "voltas seguidas" → não é só "ligar fio", falta criar o conceito.
- **RITMO VS PLANO (-0.34, PB 1:31.95, stint 1:31.61)** — fixo (3803-3811). Falta "ritmo-alvo do plano" (inexistente no schema) + cálculo de PB e média do stint a partir de voltas reais.
- **P1 COACH frase/lição/pontuação/análise** — vem do objeto `FAKE_LAPS` (4716-4817). Motor real existe (`src/domain/p1-coach.js`) mas **não é importado** pelo mockup.
- **ALERTA PREDITIVO (+8°C, curva 5, ~6 voltas, 1,3°C/volta)** — tudo fixo (3746-3754). Engine real (`web/cockpit/padrao-acumulador.js` + `avaliarPreditivoPorPadrao`) detecta "MOTOR_AQUECENDO" por desvio 20% MAS só devolve o id do alerta; **não calcula** +8°C, curva do pico, nem a extrapolação "~6 voltas" (essa conta não existe em nenhum arquivo). Matéria-prima (temp motor) chega viva via `REAL.water`, mas a conta não está construída.

### O que É real no Command Box hoje (contexto, fora da tripa)
- HUD: **velocidade** e **temperatura de água** = REAL ao vivo (canal `cockpit-bubi-live`). Rotação e lambda chegam vivos mas o HUD não tem campo na tela pra exibi-los → PARCIAL.
- Frenagem / Passagem / Vmin = dado real porém de **arquivo gravado** (voltas Bubi 23-24/05), não ao vivo → PARCIAL.
- Marcha, shift-light, mapa = PARCIAL/DEMONSTRAÇÃO (fonte do notebook ainda não manda marcha/ponto de troca; mapa depende de GPS vivo).

### Arquitetura (doc canônico 16/06)
Quem deve calcular essa tripa é o **app na nuvem** (não a TV, não o notebook que serve só o piloto). O doc reconhece a "lacuna de construção": o processamento na nuvem pras telas do app **ainda é a construir**. Hoje é "local-first, nuvem só espelha". A tripa está em demonstração porque a peça que a alimentaria (cálculo na nuvem) não foi feita.

---

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Se produção foi alterada, autorização registrada: n/a
- Arquivos reais inspecionados: sim (mockup linhas 3700-3818 e 7719-7900; `docs/ARQUITETURA_DEFINITIVA.md`; módulos `src/domain/*` e `web/cockpit/*`; worktree `plano-stint-banco-v1`)
- Alterações feitas: não (só este arquivo de registro)
- Testes/validação executados: leitura de código + grep + verificação adversarial por agentes independentes
- Resultado: concluído (análise + plano entregues)
- Pendências reais: 2 decisões de produto do Flávio (conceito de meta/ritmo-alvo no plano; construir na nuvem vs ligar o cockpit direto)
