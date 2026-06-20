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

---

## EXECUÇÃO — Flávio mandou "completo e do jeito certo e definitivo" (19/06)

Rumo decidido: construir o **cérebro do painel na nuvem** (arquitetura definitiva 16/06), reusando os miolos existentes, provado com volta gravada, sem tocar produção. A nuvem só de produção existe — então NÃO publicar no canal `cockpit-bubi-live` em teste (memória 18/06); valida-se OFFLINE.

**Ambiente isolado de trabalho:** `/Users/imac/Projetos/p1fast-worktrees/cerebro-nuvem-tripa` (linha de trabalho `cerebro-nuvem-tripa`, criada de main HEAD 72a16590). NADA na versão oficial ainda.

**Plano em ondas (executar até o fim):**
1. Base + Voltas/Ritmo — **FEITO E PROVADO (Onda 1)**
2. Ligar na tela (tirar `stint`/`coach` de DEP_LIGACAO; setter lê PainelPronto) — próximo
3. Coach (reusar `src/domain/p1-coach.js`)
4. Meta do piloto (criar tempo-alvo + voltas seguidas no plano)
5. Alerta preditivo (construir conta +°C/curva/ETA; reusar `web/cockpit/padrao-acumulador.js`)

**Onda 1 — entregue:**
- `web/command-box/cerebro/cerebro-painel.js` — cérebro host-agnóstico. `criarCerebroPainel({plano,pbEverSec,stintNumero,stintTotal})` → `onVolta/onSample/snapshot()`. Contrato de saída `PainelPronto` { stint, ritmo, coach, meta, preditivo, _pendentes }. Onda 1 calcula stint(voltas) + ritmo(PB vs melhor do stint); coach/meta/preditivo saem `null` (honesto).
- `web/command-box/cerebro/cerebro-painel.smoke.mjs` — teste offline com o stint gravado `web/cockpit/fixtures/stint-brasilia-3-laps.v1.json`.
- Resultado do teste: STINT volta 8/12 67%; RITMO "à frente -0.06/volta" PB 1:31.95 stint 1:31.89; 8 conferências verdes; EXIT=0.

**Correção 19/06 (Flávio viu desconfigurado):** causa = abri no endereço 8079 (layout salvo mora no localStorage do 8078). Conteúdo idêntico, oficial não tinha sido tocada. Conserto: levei a Onda 1 pra OFICIAL (8078) com backup `_backup-pre-cerebro-stint-2026-06-19.html`. Flávio validou ("está certa agora") e mandou seguir pro Coach SEM mexer no formato. A partir daqui trabalho na OFICIAL (não mais no worktree), sempre com backup.

**Onda 2 (na tela) — FEITA e validada por Flávio no 8078.** Bloco Plano·Stint mostra Voltas+Ritmo reais; Meta marcada "aguardando". Só preenche campos + tira o cinza; formato intocado.

**Onda 3 (Coach) — FEITA e provada (8078):**
- `web/command-box/cerebro/cerebro-coach.js` + `.smoke.mjs`. Reusa `src/domain/trecho-advisor.js` (gerarConselho) sobre as passagens reais `passagens-bubi-brasilia.v1.json` (56 passagens, 7 voltas × 8 curvas). Extrai indicadores de velocidade dos pontos (kmh), acha a curva de maior perda, gera COMANDO + LIÇÃO + ANÁLISE.
- Mockup oficial: backup `_backup-pre-cerebro-coach-2026-06-19.html`. 4 alterações: guarda `__coachRealMode` em rebuildCoach (5417) e updateLiveCoach (5471) p/ a demo não reescrever; 'coach' fora do DEP_LIGACAO; carregador da Onda 3 (preenche frase/meta/licao/licaoDesc/analise; marca pontuacao/progresso/preditivo como "aguardando"; tira cb-sem-real).
- Resultado: frase "carregue mais no apex na 2"; análise "CURVA DA RETA OPOSTA: Vmin 9.4 km/h abaixo da sua melhor"; pontuação/% lição/preditivo = "aguardando". Smoke EXIT=0; headless 8078 confere.
- HONESTO: NOTA da volta e % da lição não têm fonte real (faltam regras de pontuação — decisão de produto do Flávio). Alerta preditivo = Onda 5.

**Faltam:** Onda 4 (Meta do piloto: tempo-alvo + voltas seguidas) · Onda 5 (Alerta preditivo: +°C/curva/ETA). E a regra de pontuação da volta (decisão Flávio) p/ ligar nota+%lição.
