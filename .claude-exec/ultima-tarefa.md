# Última tarefa — ABRIR CANAL CLAUDE iMac↔notebook (branch claude-comms) — 2026-07-11

## TASK_INIT — 2026-07-11
- Pedido original: "em p1 fast abra um canal com o notebook. branch claude-comms"
- Objetivo (1 frase): ativar do lado do iMac o canal de mensagens Claude iMac↔notebook no branch `claude-comms` (sincronizar, ler pendências, avisar presença, ligar vigia).
- Critérios de conclusão: (a) worktree do canal sincronizada com origin/claude-comms; (b) mensagens para `imac` lidas; (c) mensagem "iMac entrou no canal" publicada pro notebook; (d) vigia (leitura) ligada em background.
- Leituras: ~/.claude/CLAUDE.md ✅ (contexto) · licoes-globais ✅ (sessão) · ficha project_p1fast_canal_claude_imac_notebook ✅ · LEIA-PRIMEIRO.md ✅ · p1-comms.sh ✅ · vigia-canal.sh ✅ · registro-correcoes (canal/comms/vigia) ✅
- Plano (≤5): (1) fetch+reset da worktree; (2) p1-comms.sh ler; (3) publicar aviso de presença; (4) ligar vigia-canal.sh em background; (5) reportar + TASK_DONE.
- Ambiente alvo: desenvolvimento (branch claude-comms isolado). Produção protegida: sim. Autorização produção: não (não necessária — canal não toca produção).
- Riscos: baixíssimo — branch carrega só mensagens, isolado, reversível. NUNCA merge na main.
- Estado real levantado: worktree `~/Projetos/p1fast-worktrees/comms` já existe, identidade=imac, branch claude-comms rastreando origin, conversa ativa de hoje (última imac->notebook 134418Z, última notebook->imac 133633Z), nenhuma vigia rodando.
- Status inicial: iniciado.

## TASK_DONE — 2026-07-11
- Pedido original conferido: sim ("abra um canal com o notebook. branch claude-comms").
- Ambiente trabalhado: desenvolvimento (branch claude-comms isolado). Produção foi alterada: NÃO. Autorização produção: n/a.
- Arquivos reais inspecionados: sim (worktree, LEIA-PRIMEIRO.md, p1-comms.sh, vigia-canal.sh, 3 mensagens pendentes do notebook, registro-correcoes).
- Alterações feitas: sim — (1) sincronizei a worktree com origin/claude-comms via `p1-comms.sh ler`; (2) publiquei aviso de presença `211536Z-de-imac-para-notebook.md`; (3) liguei `vigia-canal.sh` em background (PID 48904, baseline 210852Z). Nenhum código de produto/web/produção tocado.
- Testes/validação: `p1-comms.sh ler` puxou e mostrou os recados (o `ls` pré-fetch estava defasado — lição já registrada); `pgrep vigia-canal.sh` confirmou processo vivo; saída "vigia LIGADA" conferida.
- Resultado: CONCLUÍDO — canal aberto, sincronizado e na escuta.
- Pendências reais (do notebook, NÃO executadas — aguardam ordem/decisão do Flávio):
  1. 134903Z — meu território shift-light-orquestrador.js (meia-convergência + descarte de perfis JS antigos) agora na linha de produção do notebook; obra minha pendente, não executada.
  2. 144947Z — divergência PROPOSITAL C#×JS (âncora absoluta da chave de marcha); pediram registrar em memória; espelhar no JS = decisão do Flávio.
  3. 210852Z — PEDIDO DE SPEC (glass mapa central + glass componentes + barra de voltas sem térmica). Embute REGRA nova de negócio (cápsulas 1/N deixarem de ser Aquecimento/CoolDown) que o notebook está INFERINDO do Flávio — precisa confirmação dele antes de eu formalizar a spec.

## ANDAMENTO — conversa ao vivo com o notebook (Flávio: "ele quer falar com você") — 2026-07-11
- Flávio autorizou engajar direto. Respondi o pedido de spec do notebook pelo canal:
  - `212513Z-de-imac-para-notebook` — SPEC dos vidros com valores reais: item 1 (glass mapa central = `coach-miolo.css` .coach-zoom + `coach-zoom-live.js`, commit c840e129, geometria/gradiente/blur 16px/raio 18px/aro de luz/lâmina interna/8 sombras + constantes do zoom) e item 3 (só o mapa central ganhou vidro novo; não há token compartilhado; `.legend`/dome-glass são antigos). Item 4 (ápice) acusado — espelhar no web = ordem do Flávio.
  - Notebook (`212812Z`) aceitou, JÁ iniciou o porte, e pediu os 2 arquivos-fonte (c840e129 não está no GitHub) + confirmar se a pista mudou.
- Item 2 (barra de voltas) → painel `p1fast-barra-voltas-1826` (renderização VERIFICADA no Chrome: 3 cartões = 3 perguntas). Flávio respondeu:
  1. Térmicas SAEM da barra; aquecimento/resfriamento passam pra TELA dedicada (já no .exe); barra = só voltas planejadas + box.
  2. Box continua magenta.
  3. Gatilho: critério = limite mínimo esperado de aquecer/resfriar; aquecimento fica +5s e sai; resfriamento fica até desligar (vai pro box).
  Decisões gravadas em `~/.claude-decisoes/perguntar-historico.jsonl`.
- Entreguei ao notebook (`214110Z`, commit 5dba06b6): o martelo do item 2 + os 2 arquivos-fonte em `mensagens/assets/` (opção b — empurrar minha linha sairia 1804 registros; assets/ já era usado p/ PNG, isolado/reversível) + pista NÃO mudou (f8b1a648, 2026-06-10; mesma versão do c840e129).
- Vigia RELIGADA (PID 55146, baseline 212812Z). Canal segue na escuta.
- Pendência do notebook: portar câmera/ghost com os arquivos; nada mais depende do Flávio agora.

---

# Última tarefa — REVISÃO DA TELA PRINCIPAL DO APP (Home iPhone) — 2026-07-11

## TASK_INIT — 2026-07-11
- Pedido original: "no app p1 fast a tela principal eu não gosto. faça uma revisão funcional e de formato. na execução vamos usar 2 janelas em opus 4.8 para vc coordenar a implantação. faça propostas ultra premium."
- Objetivo (1 frase): revisar a Home do app iPhone (função + formato) e apresentar propostas ultra premium para Flávio escolher; implantação depois via 2 janelas Opus 4.8 coordenadas por mim.
- Critérios de conclusão: (a) revisão objetiva baseada no código real (HomeView.swift); (b) propostas visuais reais em HTML (iPhone, tema escuro) abertas no navegador; (c) painel de decisão aberto para o Flávio.
- Leituras obrigatórias: ~/.claude/CLAUDE.md ✅ · ~/.claude-decisoes/padroes.md ✅ · FLAVIO_EXECUTION_PROTOCOL ✅ · FLAVIO_DONE_CHECKLIST ✅ · FLAVIO_ENVIRONMENT_RULES ✅ · FLAVIO_COMMUNICATION_RULES ✅ · licoes-globais ✅ · registro-correcoes ✅
- Plano (≤5): (1) inspecionar HomeView.swift + mockups canônicos; (2) revisão funcional/formato; (3) montar propostas HTML ultra premium (375×812, fundo preto, sem emoji, âmbar p/ ruim); (4) abrir no navegador + painel perguntar; (5) aguardar decisão — implantar SÓ depois, com as 2 janelas.
- Arquivos: ios/p1fast-ios/Sources/Views/HomeView.swift, Components/*, Theme.swift, _design-reference/mockup-home-{cheio,vazio}.html.
- Ambiente alvo: desenvolvimento. Produção protegida: sim. Autorização para produção: não. Evidência: não recebida.
- Riscos: nenhum nesta fase — só leitura + arquivos NOVOS de proposta (nada existente alterado).
- Status: fase de DECISÃO CONCLUÍDA 2026-07-11 — revisão entregue; 3 propostas HTML abertas; Flávio decidiu (painel `p1fast-home-conceito-1444`): Conceito A "Dia de Pista" + ferramentas de teste vão para a Garagem. REPLANEJADO a pedido do Flávio para 5 JANELAS Opus 4.8 em 2 ondas (J1 herói · J2 volta+ao vivo · J3 carros+números · J4 garagem · J5 montadora/auditoria). Mandatos PROMPT-J1..J5 + COORDENACAO.md em `.claude-exec/home-dia-de-pista/`. EXECUTADO: 5 janelas entregaram e foram AUDITADAS (3 consertos do coordenador: J2 e J5 com trabalho fora do registro, J4 com ~7.200 arquivos de cache no registro). MONTAGEM FINAL CONCLUÍDA na linha `claude/home-integracao` (de4221d3): peças reais no lugar, anel verde a 100%, duplicidade da melhor volta removida, empacotamento verde, fotos reais no simulador. Versão oficial INTOCADA — incorporação só com ordem do Flávio.

---

# Última tarefa — COORDENADOR FABLE 5 · Coach de IA · CONSTRUÇÃO DA FASE 1 (coordenação)

> Registros anteriores (Janelas 3, 1, 4, 2 e Coordenador/design) preservados logo abaixo.

## TASK_INIT — CONSTRUTORA CÉREBRO (o lado do DADO) — 2026-07-10
- Protocolo carregado: sim (contrato global `~/.claude/CLAUDE.md` + FLAVIO_EXECUTION/DONE/ENVIRONMENT/COMMUNICATION + padroes.md + licoes-globais + registro-correcoes do projeto). Padrões carregados: sim.
- Ambiente alvo: DESENVOLVIMENTO. Trabalho em ambiente isolado `.claude/worktrees/coach-cerebro` (linha `claude/coach-fase1-cerebro`), a partir do estado local atual. Nada vai à versão oficial sem ordem do Flávio. Produção protegida: sim. Autorização para produção: não (não necessária).
- Evidência de autorização produção: não recebida (não aplicável — DEV).
- Pedido original: mandato `.claude-exec/coach-ia-sala/PROMPT-CONSTRUTORA-CEREBRO.md` (Fable, 09/07) — passos 0–3 da Fase 1 + testes do cérebro: (0) investigar limites de trecho contra o fixture — GATE; (1) `tempoAtualS` aditivo no `delta-calculator.js`; (2) módulo NOVO `cerebro-coach-stint.js` (acumulador do stint + eleição J2); (3) pacote de 3 estados (`null`/`silencio`/`oportunidade`) ligado em `cerebro-painel.js:167`; (4) nova casa no `CONTRATO_DADOS.md` + smoke:arquitetura verde; (5) testes node.
- Objetivo (1 frase): construir o LADO DO DADO do Coach de IA — o acumulador de stint que elege UMA lição por volta e emite o pacote de 3 estados honestos que a TELA só exibe, sem tocar a v0 `cerebro-coach.js` nem o painel aprovado.
- Critério de conclusão: passo 0 com laudo (defeito do dado de teste OU do produto — se produto, PARAR e deixar PRONTO PARA AUDITORIA); `pacote-exemplo.json` real publicado nos 3 estados; módulo + pacote construídos; testes node verdes; `smoke:arquitetura` verde; nova casa no CONTRATO_DADOS; blocos M1/M2 na caixa do Fable com comandos+saídas REAIS.
- Plano (≤5): (1) ambiente isolado + PASSO 0 (rodar detector/linhas reais contra fixture, dar laudo) → se produto, PARAR; (2) `tempoAtualS` aditivo no delta-calculator (paridade C#) sem quebrar consumidores; (3) `cerebro-coach-stint.js` (acumulador+eleição J2, gates, dedup, estabilidade, fallback, status honesto) + pacote 3 estados; (4) ligar campo em cerebro-painel.js:167 + nova casa CONTRATO_DADOS + smoke:arquitetura; (5) testes node + pacote-exemplo.json + M1/M2 + TASK_DONE + registro.
- Arquivos a inspecionar: `web/cockpit/delta-calculator.js` (calcularDelta, pontoCanonico l.188), `web/cockpit/trecho-detector.js`, `web/cockpit/mensagens-pedagogicas.js:206`, `web/cockpit/oportunidade-trecho.js` (verbos v3), `web/command-box/cerebro/cerebro-painel.js:167`, `web/command-box/cerebro/cerebro-coach.js` (v0 INTOCÁVEL), `src/domain/stint-plan.js`, fixture `web/command-box/fixtures/passagens-bubi-brasilia.v1.json`, `docs/CONTRATO_DADOS.md`. Novos: `web/command-box/cerebro/cerebro-coach-stint.js` + testes.
- Riscos: (a) passo 0 pode acusar defeito de registro no PRODUTO → GATE: parar e deixar para o Fable; (b) sobrescrever a v0 `cerebro-coach.js` achando-a vazia (registro 2026-07-08 já avisa: é v0 funcional km/h — INTOCÁVEL); (c) formalizar contra v0 provisório em vez do v1 real da J2 (registro avisa: ler `entregas/janela-2.md §1`); (d) fórmula de amostras sem dizer QUAL janela conta (registro 2026-07-08 F2/F3a).
- Status: CONCLUÍDO E APROVADO pelo Flávio ("perfeito", 2026-07-11 ~12h20) — tela do iPhone corrigida (viewport device-width + painel pinado + folga 46→18) e instalada no aparelho físico
- Status PASSOS 1-5 (M2): **CONCLUÍDO 2026-07-10T14:36Z (no ambiente isolado; produção/produto intocados).**
  1. `tempoAtualS` aditivo em `web/cockpit/delta-calculator.js` (5 campos antigos intactos).
  2. Módulo NOVO `web/command-box/cerebro/cerebro-coach-stint.js` (acumulador+eleição J2; p25 conservador decisão 9; gate SF; stickiness; out-laps; fallback curva-inteira; status honesto; calibração NOMEADA decisão 2; insistência plano decisão 6). v0 `cerebro-coach.js` INTOCADA.
  3. Pacote 3 estados (envelope J4 §2) — mensagem N1/N2 SÓ âmbar (decisão 3) + GraficoSpec (J3) + timing. Ligado em `cerebro-painel.js:167` de forma NÃO-QUEBRÁVEL (acumulador opcional).
  4. Nova casa em `docs/CONTRATO_DADOS.md` §2 + trava `CASAS` do smoke. `smoke:arquitetura` 28/0.
  5. `tests/node-smoke-coach-stint.mjs` (11/0) + no `npm run smoke`.
  - PUBLICADO: `construcao/pacote-exemplo.json` (3 estados) — eleição Curva "S" 0,996 (p25) reproduz J5 C1. Gerador em `construcao/gerar-pacote-exemplo.mjs`.
  - Testes reais: delta 11/0 · mensagens 17/0 · arquitetura 28/0 · coach-stint 11/0 · cerebro-painel VERDE · oportunidade-trecho 13/0. `npm run smoke`: só 4 falhas em schema-parity (contagem de tabelas), PRÉ-EXISTENTES (idênticas na base) — não é do coach.
  - Bloco `PRONTO PARA AUDITORIA (M2)` na caixa do Fable. Ambiente isolado: `.claude/worktrees/coach-cerebro`.
- **M2 APROVADO pelo Fable (do-fable.md 2026-07-10T14:50Z)** — verificação independente: todos os testes reconferidos, fronteiras limpas (v0/HTML/CSS 0 diff), pacote validado contra o contrato. Nota cosmética (linha do silêncio sem contagem + N1 nome curto) RESOLVIDA na hora: `linhaSilencio(status)` → "Juntando dado — 2 voltas"; nomeCurto → "Curva \"S\"". Testes 11/0, pacote republicado. **Frente do CÉREBRO FECHADA.** Próximo/último ato = integração M2 CÉREBRO × M2 TELA (conduzida pelo Fable/Flávio). Pendências de produto: conserto do registro de segmentos (autorização do Flávio); porte C# (Fase 2).

---

## TASK_INIT — CONSTRUTORA TELA (o cartão do coach no painel) — 2026-07-10
- Protocolo carregado: sim (contrato global `~/.claude/CLAUDE.md` + licoes-globais + registro-correcoes do projeto). Padrões carregados: sim.
- Ambiente alvo: DESENVOLVIMENTO. Trabalho em ambiente isolado `.claude/worktrees/coach-tela` (branch `claude/coach-fase1-tela`), a partir do estado local atual. Nada vai à versão oficial sem ordem do Flávio. Produção protegida: sim. Autorização para produção: não (não necessária).
- Evidência de autorização produção: não recebida (não aplicável — DEV).
- Pedido original: mandato `PROMPT-CONSTRUTORA-TELA.md` (Fable, 10/07) — passo 4 da Fase 1: construir o **cartão do coach** nos 3 estados (`null`/`silencio`/`oportunidade`) na referência web `web/cockpit/cockpit-volta-real.html` (+ `cockpit.css`), com tempo-exclusivo (decisão 7), gráfico com zoom (decisão 8), SÓ âmbar/verde (decisão 3), número sem sinal, validado no navegador real.
- Objetivo (1 frase): renderizar o cartão do coach (gráfico à esq. 394px + mensagem à dir. 256px, cartão x150→806 · y74→312) somando POR CIMA do painel aprovado, sem mover/cobrir nada, provado no replay real do navegador.
- Critério de conclusão: os 3 estados renderizando no navegador real · tempo-exclusivo (delta e freada cedem quando o cartão entra e voltam quando sai) · crítico derruba o cartão na hora · nada do painel aprovado movido/coberto · bloco `PRONTO PARA AUDITORIA (M1)` na caixa do Fable com o que foi VISTO.
- Plano (≤5): (1) ambiente isolado; (2) `coach-card.css` + `coach-card.js` (render dos 3 estados + gráfico SVG do recorte) + pacote-exemplo ANDAIME do fixture real; (3) somar o cartão + driver no HTML aprovado (tempo-exclusivo por `data-coach`, crítico vence); (4) validar no navegador real (replay) e capturar tela; (5) M1 na caixa + TASK_DONE + registro.
- Arquivos a inspecionar/tocar: `web/cockpit/cockpit-volta-real.html`, `web/cockpit/cockpit.css` (tokens, ler), `web/cockpit/pista-oficial-brasilia.js` (geoParaDesenho/PONTOS_DESENHO), fixture `web/command-box/fixtures/passagens-bubi-brasilia.v1.json`. Novos: `web/cockpit/coach-card.css`, `web/cockpit/coach-card.js`, `web/cockpit/coach-pacote-exemplo.js`.
- Riscos: (a) painel aprovado é intocável — só somar por cima; (b) CÉREBRO ainda não publicou `construcao/pacote-exemplo.json` → uso mock ANDAIME do fixture real, declarado, troca no M2; (c) delta (`.info-bloco` x72→~412) e freada (`.brake-result` x690) COLIDEM com os slots do cartão → tempo-exclusivo obrigatório (decisão 7).
- Status: **M1 APROVADO pelo Fable (14:50Z) + M2 CONCLUÍDO 2026-07-10T14:54Z.**
  - M1: 3 estados + 4 variantes no navegador real, tempo-exclusivo (números cedem e voltam), crítico derruba o cartão, painel aprovado intocado. Item de verificação do M2 (ceder com delta ativo) fechado antecipado e ACEITO pelo Fable (14:12Z).
  - M2: troquei o ANDAIME pelo **pacote REAL do CÉREBRO** (`construcao/pacote-exemplo.json`, auditado). Render casou com o formato real (linha de ação por espaços, viewBox cru encaixado no slot pela tela, velocidade padrão, silêncio "Juntando dado — 2 voltas" como vem = fonte única). Validado no navegador (pose): Curva "S" âmbar renderiza, ceder numérico (oportunidade opacity 0 / silêncio 1), só âmbar. Smokes cockpit + `arquitetura-dado` verdes; `cockpit.css` 0 mudanças. Bloco `PRONTO PARA AUDITORIA (M2)` na caixa do Fable.
  - **PENDENTE (não bloqueia):** ceder VISUAL no replay AO VIVO com aba em foco real — a aba automatizada fica `hidden` (rAF congela); recomendo conferência num Chrome normal. Integração final CÉREBRO×TELA conduzida pelo Fable/Flávio. Aguardando auditoria do M2.

---

## TASK_INIT — Coordenação da construção da Fase 1 — 2026-07-10
- Protocolo carregado: sim (contrato global + arquivos FLAVIO_* lidos nesta sessão). Padrões: sim.
- Ambiente alvo: DESENVOLVIMENTO (as construtoras trabalham em ambientes isolados `.claude/worktrees/coach-cerebro|coach-tela`; nada vai à versão oficial sem auditoria + ok do Flávio). Produção protegida: sim. Autorização produção: não (não necessária).
- Pedido original: Flávio perguntou "vamos fazer em cada janela?" → painel `p1fast-construcao-fase1-1607` → **opção A: 2 construtoras (CÉREBRO e TELA) + Fable auditor por marcos**.
- Objetivo (1 frase): coordenar a construção da Fase 1 do Coach conforme `SOLUCAO-FINAL.md §7` — prompts prontos, caixas prontas, auditoria nos marcos M1/M2 de cada construtora, integração ao final.
- Critérios de conclusão: M2 das duas construtoras APROVADOS (testes/smoke verdes + validação no navegador real) + proposta de incorporação auditada ao Flávio.
- Plano (≤5): (1) prompts + caixas ✓; (2) largada pelo Flávio; (3) auditar M1×M1 (laudo passo 0 é gate); (4) auditar M2×M2 + integração; (5) TASK_DONE + registro.
- Riscos: passo 0 pode acusar defeito de registro no produto (gate: parar e decidir com o Flávio); duas linhas de trabalho paralelas exigem disciplina de fronteira (mitigado: arquivos disjuntos por prompt + ambientes isolados).
- Status: iniciado 2026-07-10T02:14Z — aguardando largada das construtoras.

## TASK_DONE — Coordenação da construção da Fase 1 — 2026-07-10 (integração concluída)
- Pedido original conferido: sim (opção A do Flávio executada: 2 construtoras + Fable auditor; "siga" = integração conduzida).
- Ambiente trabalhado: DESENVOLVIMENTO (ambientes isolados + linha de integração `claude/coach-fase1-integracao`). Produção foi alterada: não. Autorização: n/a.
- Arquivos reais inspecionados: sim — cada marco auditado com verificação independente (testes re-executados pelo Fable; inspeção visual no navegador com fotos; laudo do passo 0 conferido na migração 0029 real; pacote validado contra o contrato).
- Alterações feitas: pelas construtoras nos ambientes isolados (auditadas); pelo Fable só coordenação + a junção das duas linhas (0 conflitos).
- Testes/validação executados: sim — bateria completa na linha integrada: tudo verde exceto as 4 falhas PRÉ-EXISTENTES do schema-parity (idênticas à base); coach-stint 11/0, delta 11/0, mensagens 17/0, arquitetura 28/0, cockpit-web 16/0; painel integrado conferido no navegador.
- Resultado: **CONCLUÍDO** — Fase 1 construída, auditada e integrada. Marcos: CÉREBRO M1 (portão do passo 0: defeito de registro no produto CONFIRMADO na 0029; caminho curva-inteira liberado) + M2 APROVADO; TELA M1 + M2 APROVADOS (validação visual com dado real).
- Pendências reais: (1) **martelo do Flávio "incorpora"** → juntar a linha de integração à linha oficial de trabalho local (reversível; não é produção); (2) conserto do registro de trechos do produto (janela ±30 m) = tarefa separada registrada, aguarda priorização/autorização; (3) ver o fade ao vivo com o navegador em foco = passada do Flávio; (4) Fase 2 (.exe) conforme SOLUCAO-FINAL.
- Registro de correções: atualizado durante a tarefa pelas construtoras; nenhuma correção nova do coordenador nesta etapa.

---

## TASK_INIT — Janela 3 (trabalhadora sob o maestro Fable 5) — 2026-07-08
1. **Pedido original:** rodar `coach-ia-sala/PROMPT-JANELA-3.md` — frente = o gráfico com zoom do trecho (Parte A) do Coach de IA.
2. **Objetivo (1 frase):** especificar o gráfico (o que plota + método do zoom com conversores reais + mockups escuros com medidas + posição/aparição), sem quebrar o painel aprovado.
3. **Critérios (PLANO-MESTRE §5/J3):** o que plota recomendado + zoom com conversores reais + mockups escuros com px + posição/aparição; medidas do miolo postadas ao Fable; bloco PRONTO.
4. **Leitura confirmada:** ~/.claude/CLAUDE.md (global) + CLAUDE.md do projeto; briefing PROMPT-FABLE5 (§4.6/4.7); PLANO-MESTRE (§2.1-2.5); mandato do-fable.md (J3); painel cockpit-volta-real.html + cockpit.css (aprovado); conversores reais (pista-oficial-brasilia.js `geoParaDesenho`+`PONTOS_DESENHO`, pista-cb-polyline.js `fracDe`, apices-semente-brasilia.js, tipos-curva-brasilia.js); fixture passagens-bubi-brasilia.v1.json; **entregas REAIS janela-2.md (objeto v1), janela-1.md (portão/timing), janela-4.md (envelope grafico)**.
5. **Plano (≤5):** (1) ler contexto+conversores ✓; (2) medir retângulo livre do miolo ✓; (3) PROVAR o zoom rodando conversores+fixture ✓; (4) escrever entrega+mockups ✓; (5) postar medidas+PRONTO ✓.
6. **Ambiente:** desenvolvimento. **7. Produção protegida:** sim. **8. Autorização produção:** não (desnecessária — só documento). **9. Riscos:** cobrir/mover elemento do painel (mitigado: medi antes, só somo por cima, colisão delta/freada sinalizada como decisão do Flávio); inventar formato de dado (mitigado: conversores+fixture rodados; objeto v1 real da J2 consumido). **10. Status:** concluído.

## TASK_DONE — Janela 3 — 2026-07-08
- Pedido original conferido: sim (PROMPT-JANELA-3 item por item). Ambiente: desenvolvimento. Produção alterada: não. Autorização: n/a.
- Arquivos reais inspecionados: sim (lista no TASK_INIT). Alterações: só documentos (`entregas/janela-3.md`, `canal/janela-3/para-fable.md`, este arquivo, `registro-correcoes.md`). Nenhum código de produto tocado.
- Testes/validação executados: **método de zoom RODADO** com conversores oficiais + fixture real (`scratchpad/prova-zoom.mjs` → bbox/viewBox válidos da Bruxa; `scratchpad/prova2.mjs` → divergência ápice-semente×passagem em 7/8 curvas). Medidas do miolo tiradas do HTML/CSS aprovado. Documento — sem build de produto a rodar.
- Resultado: CONCLUÍDO (aguardando auditoria do Fable). Pendências reais: 4 decisões p/ Flávio/Fable (janela-3.md §10): caminho (b) da colisão delta/freada; medidas 60/40; Fase 1=traçado; furo de dado ápice-semente. Nenhum bloqueio.
- **2ª passada (Fable 20:55 · CORRIGIR pontual):** QA da J5 refez o achado do §5 em metros → real é 4/8 (não 7/8); meu método comparava com o ponto-do-meio da passagem, inflado por limites de segmento tortos (F1 da J5). Corrigi o §5 (tabela em metros da J5); decisão de ancoragem mantida e endossada pelo QA. Novo PRONTO na para-fable.md. Registro: cadeia achado→correção da J5 preservada.

---

# Última tarefa — JANELA 1 · Coach de IA de Stint · Metodologia + Mensagem (Parte B) + Timing

> Registros das Janelas 4 e 2 preservados logo abaixo (não sobrescritos).

## TASK_INIT — Janela 1 (trabalhadora sob o maestro Fable 5) — 2026-07-08
1. **Pedido original:** rodar `coach-ia-sala/PROMPT-JANELA-1.md` — frente = metodologia de coaching (1 foco/volta) + mensagem de ensino (Parte B) + regras de timing/portão.
2. **Objetivo (1 frase):** projetar como o coach ensina em ciclo curto, o modelo de conteúdo da mensagem por níveis, e o portão de quando o cartão aparece/some — sem tocar produto/produção.
3. **Critérios (PLANO-MESTRE §5/J1):** metodologia + modelo de mensagem + regras de tamanho/timing + exemplos por tipo, na régua dura e no contrato de layout; + bloco PRONTO em `para-fable.md`.
4. **Leitura confirmada:** ~/.claude/CLAUDE.md, CLAUDE.md do projeto, PROMPT-JANELA-1.md, PROMPT-FABLE5-COACH-IA-STINT.md, PLANO-MESTRE.md, do-fable.md (mandato J1), **entregas/janela-2.md (objeto v1 REAL)**. Código real aberto (prova): mensagens-pedagogicas.js, cerebro-coach.js, trecho-advisor.js, oportunidade-trecho.js (verbos v3), tipos-curva-brasilia.js, tipos-curva-texto.js.
5. **Plano (≤5):** (1) ler contexto+código+objeto J2 ✓; (2) metodologia (princípios reais + ciclo + evolução + calar); (3) modelo de mensagem por níveis + mapa campo→texto; (4) portão de timing; (5) exemplos reais + escrever entrega + fechar canal.
6. **Ambiente alvo:** desenvolvimento. **7. Produção protegida:** sim. **8. Autorização produção:** não (desnecessária — só projeto/documento). **9. Riscos:** trabalhar contra o v0 provisório em vez do objeto real da J2 (mitigado: descoberto e corrigido — consumi o v1 real); inventar vocabulário concorrente (mitigado: reusei verbos v3 aprovados). **10. Status:** concluído (entrega escrita).

## TASK_DONE — Janela 1 — 2026-07-08
- Pedido original conferido: sim. Ambiente: desenvolvimento. Produção alterada: não. Autorização: n/a.
- Arquivos reais inspecionados: sim (lista no TASK_INIT). Alterações: só documentos (`entregas/janela-1.md`, `canal/janela-1/para-fable.md`, este arquivo, `registro-correcoes.md`). Nenhum código de produto tocado.
- Testes/validação: N/A executável (entrega é projeto/documento); validação = conferência item-a-item do PROMPT-JANELA-1 e da régua (§8 da entrega). Contagem de exemplos = 5 (>= 3-5 pedidos). Fronteiras J2/J3/J4 respeitadas.
- Resultado: concluído. Pendências reais: 4 decisões de preferência para o Flávio (entregas/janela-1.md §6); aguarda auditoria do Fable.

---

# Última tarefa — JANELA 4 · Coach de IA de Stint · Integração / plataforma / plano em fases

> Registro da Janela 2 preservado logo abaixo (não sobrescrito).

## TASK_INIT — Janela 4 (trabalhadora sob o maestro Fable 5) — 2026-07-08
1. **Pedido original:** rodar `coach-ia-sala/PROMPT-JANELA-4.md` — frente = plataforma que encaixa o Coach de IA + plano de construção em fases.
2. **Objetivo (1 frase):** projetar o ponto de encaixe (web → C#), a forma do pacote do coach, o fluxo de dado, a estratégia de teste e o plano em fases — sem tocar produto/produção.
3. **Critérios (PLANO-MESTRE §5/J4):** encaixe + pacote coach v1 + fluxo + teste + Fase 1 construível; + proposta de convivência da v0 (pedido do Fable no `do-fable.md`); + bloco PRONTO em `para-fable.md`; + régua dura conferida.
4. **Leitura confirmada:** ~/.claude/CLAUDE.md, CLAUDE.md do projeto, PLANO-MESTRE.md, do-fable.md, briefing PROMPT-FABLE5, CONTRATO_DADOS.md. Código real aberto (prova): cerebro-coach.js, cerebro-painel.js (l.167 coach:null), cerebro-vivo.js, delta-calculator.js, cloud-bridge.js, DeltaCoach.cs, CockpitState.cs, CockpitStateModel.cs, Enums.cs (MsgTipo Comunicacao/Grave), CockpitOrchestrator.cs (FecharTrecho l.340-399).
5. **Plano (≤5):** (1) ler contexto+código ✓; (2) formalizar pacote coach v1; (3) encaixe web+C# + fluxo; (4) teste + fases + convivência v0; (5) escrever entrega + fechar canal.
6. **Ambiente alvo:** desenvolvimento. **7. Produção protegida:** sim. **8. Autorização produção:** não (não recebida; desnecessária — só projeto). **9. Riscos:** contaminar a v0 (mitigado: proposta preserva 100%); inventar forma de J1/J2/J3 (mitigado: encaixo só o envelope). **10. Status:** concluído (entrega escrita).

## TASK_DONE — Janela 4 — 2026-07-08
- Pedido original conferido: sim. Ambiente: desenvolvimento. Produção alterada: não. Autorização: n/a.
- Arquivos reais inspecionados: sim (lista no TASK_INIT). Alterações: só documentos (`entregas/janela-4.md`, `canal/janela-4/para-fable.md`, este arquivo). Nenhum código de produto tocado.
- Testes/validação: verificação de existência/linha de cada arquivo e campo citado no código real (encaixe l.167, DeltaResultado, CockpitStateModel sem campo Coach, FecharTrecho já produz o delta por trecho). Documento — sem build a rodar.
- Resultado: **APROVADO pelo Fable — frente fechada (definitivo, 2026-07-09T18:33Z)**, após 4 passadas (SEGUIR/SEGUIR/APROVADO/reabertura pontual QA J5/APROVADO). Absorvidas as formas de J1/J2/J3 + 3 itens do QA da J5 (anotador do replay, PASSO 0 dos limites de trecho, Fase 1 = N1+N2). Pendências: nenhuma de plataforma; o PASSO 0 roda junto com a J2 quando o Flávio autorizar a Fase 1.

---

# Última tarefa — JANELA 2 · Coach de IA de Stint · Inteligência de seleção da oportunidade

> Backup da tarefa anterior (Fase 2 IA temperatura): `.claude-exec/ultima-tarefa.backup-pre-coach-ia-2026-07-08.md`
> O registro do papel de Coordenador Fable 5 (Rodada 0) está preservado mais abaixo.

## RETOMAR (Janela 2): entrega viva em `.claude-exec/coach-ia-sala/entregas/janela-2.md`. Ao concluir, bloco PRONTO PARA AUDITORIA em `canal/janela-2/para-fable.md` e avisar o Flávio.

---

## TASK_INIT — Janela 2 (trabalhadora sob o maestro Fable 5) — 2026-07-08

- Protocolo carregado: sim (FLAVIO_EXECUTION_PROTOCOL / DONE_CHECKLIST / ENVIRONMENT_RULES / COMMUNICATION_RULES + ~/.claude/CLAUDE.md).
- Padrões carregados: sim (~/.claude-decisoes/padroes.md — 0 decisões registradas).
- Ambiente alvo: DESENVOLVIMENTO. A entrega é um DOCUMENTO de projeto (`entregas/janela-2.md` + caixas de canal). Nenhum código de produto tocado.
- Produção protegida: sim. Autorização para produção: não (não recebida; desnecessária — nada de produto muda).
- Pedido original: assumir a Janela 2 do Coach de IA (prompt `coach-ia-sala/PROMPT-JANELA-2.md`) — projetar a inteligência que elege a ÚNICA maior oportunidade de ganho de tempo (em SEGUNDOS) por volta olhando o stint; DEFINIR o objeto-oportunidade que J1 (mensagem), J3 (gráfico) e J5 (cenários) consomem; comparar abordagens e recomendar; publicar rascunho do objeto CEDO.
- Objetivo (1 frase): entregar o objeto-oportunidade fechado + algoritmo (abordagens comparadas + recomendada) + método do ganho em s + encaixe no motor de delta, tudo conferido no código REAL.
- Critérios objetivos de conclusão (PLANO-MESTRE §5/J2): objeto fechado; algoritmo com abordagens comparadas e a recomendada; método do ganho em segundos; encaixe no motor de delta. Mais: rascunho do objeto publicado cedo em `para-fable.md`; bloco PRONTO PARA AUDITORIA; aviso ao Flávio.
- Plano (≤5): (1) [FEITO] conferir motor de delta / fixture / tipos de curva / detector / migração no código real; (2) rodar painel de projeto (3 abordagens + rigor do ganho em s + adversário de contrato) via workflow; (3) sintetizar objeto + algoritmo + método do ganho; (4) escrever `entregas/janela-2.md` e publicar o rascunho do objeto; (5) PRONTO PARA AUDITORIA + avisar o Flávio.
- Arquivos inspecionados (com prova): `web/cockpit/delta-calculator.js` (SUB_TRECHOS l.57; saída l.168-174), `windows/cockpit/P1Fast.Cockpit.Domain/DeltaCoach.cs` (port + mapa sub→frase), `web/cockpit/trecho-detector.js` (4 marcos, apice distFromIdealM/angle), `web/command-box/tipos-curva-brasilia.js` (8 curvas + tipo, SF), `supabase/migrations/0026_...sql` (tabela melhores_passagens_trecho), `web/command-box/cerebro/cerebro-coach.js` (v0 km/h — PRESERVAR), `cerebro-painel.js` (l.167 coach:null), fixture (56 passagens = 8 curvas × 7 voltas, pontos crus {lat,lng,kmh,t}).
- Riscos: (a) travar objeto que J1/J3/J5 herdam errado → mitigação: conferido no código; ajustes ao v0 do Fable com campos novos SINALIZADOS ao maestro, não impostos; (b) sobrescrever a v0 do cerebro-coach → mitigação: NÃO toco código de produto, só documento; (c) inventar número de ganho → mitigação: método ancorado no `tempo_trecho_s` real + `porSubTrecho`, com reconciliação anti-dupla-contagem.
- Status inicial: iniciado 2026-07-08 (janela 2).

## Andamento — Janela 2
- Investigação concluída (read-only): todos os fatos do contrato conferidos no código/dados reais; fixture reconstrói 7 voltas completas (stint real do Bubi) — o método do ganho em s é COMPUTÁVEL de dado real, não inferido.
- Painel de projeto (workflow, 9 agentes, 0 erros): 3 abordagens (regra fixa / pontuação / IA) + rigor do ganho em s + modelo de sinal-ruído + 3 fiscais de contrato + crítico de completude. Os dois braços de rigor convergiram no MESMO método honesto (independentes) — sinal forte. Fiscais acharam furos reais (teto por deltaTotalS subestima; sinal cru na tela; piso positivo fabrica oportunidade; SF/pace/apice no lugar errado; out-lap; curva curta; cold start) — TODOS fechados na entrega.
- Entrega escrita: `entregas/janela-2.md` (objeto v1 §1; método do ganho em s §3; sinal-ruído+confiança §4; eleição §5; abordagens+recomendação §6; encaixe no motor §7; pendências §8). Rascunho do objeto + PRONTO PARA AUDITORIA publicados em `canal/janela-2/para-fable.md` (2 cartões).

## TASK_DONE — Janela 2 — 2026-07-08
- Pedido original conferido: sim (PROMPT-JANELA-2.md item por item — §9 abaixo).
- Ambiente trabalhado: DESENVOLVIMENTO (só documentos em `.claude-exec/coach-ia-sala/`). Produção foi alterada: não.
- Se produção foi alterada, autorização registrada: n/a.
- Arquivos reais inspecionados: sim (delta-calculator.js, DeltaCoach.cs, trecho-detector.js, tipos-curva-brasilia.js, migração 0026, cerebro-coach.js, cerebro-painel.js, oportunidade-trecho.js, stint-plan.js, cerebro-preditivo.js, fixture).
- Alterações feitas: sim (entregas/janela-2.md; canal/janela-2/para-fable.md; registro-correcoes.md; este arquivo). Nenhum código de produto tocado.
- Testes/validação executados: análise numérica REAL do fixture (node) reconstruindo as 7 voltas + melhor por curva + perda por curva/volta + recorrência; painel adversário de 9 agentes; verificação de existência de cada arquivo citado.
- Resultado: CONCLUÍDO. **Auditoria do Fable (2026-07-08T19:48Z): VEREDITO SEGUIR** — frente no rumo, essencialmente completa, 0 correções pedidas. Fable ARBITROU: objeto v1 (§1) vira o CONTRATO VIGENTE (todos os acréscimos aceitos, PLANO-MESTRE §2.1 aponta pra minha §1); `tempoAtualS` aceito como Fase 1 aditiva (J4 formaliza); `marcha` fora aceito; meus defaults de calibração valem provisoriamente para J1/J3/J5, decisão final vai ao Flávio no painel. APROVADO virá quando J1/J3 consumirem sem mudança e a J5 fechar o QA. Estado: DE PRONTIDÃO para ajuste fino.
- Pendências reais: nenhuma agora (Fable: "Pendência sua: nenhuma"). As 4 decisões de calibração ficam para o painel do Flávio na hora certa (não bloqueiam).
- 2026-07-08T20:55Z — Fable **CORRIGIR** (QA da J5): 4 pontos aplicados na entrega (v1.1) — F2 janela do fAmostras fixada em agregada no stint; F3a fallback com régua própria (curva inteira); F3b dois ramos p25×mediana + decisão pro Flávio; F8 números marcados [fixture]/[ilustrativo]; F1 §7.2 (investigação de limites de segmento com a J4). Método central inalterado (J5 reproduziu os números). 2º PRONTO PARA AUDITORIA no canal. Registro-correcoes atualizado. Nada de produto tocado. Estado: DE PRONTIDÃO.
- 2026-07-09T18:33Z — Fable **VEREDITO: APROVADO — frente fechada (definitivo)**. Conferiu a v1.1 na entrega real (janela de contagem agregada com os 2 exemplos na mesma régua; fallback com régua própria; 2 ramos p25×mediana na fila do Flávio; ilustrativos marcados; F1 §7.2 com segments-loader.js conferido). **Janela 2 ENCERRADA.** Única pendência futura: executar o PASSO 0 (investigação dos limites de segmento) junto com a J4 QUANDO a construção da Fase 1 for autorizada — nada a fazer agora. Estado final: DE PRONTIDÃO.

### Checagem item-por-item contra o PROMPT-JANELA-2.md
1. Objeto oportunidade definido e publicado cedo → §1 + cartão no canal. OK.
2. Do delta à oportunidade (agregação volta+stint, a ÚNICA que mais paga) → §3, §5. OK.
3. Classificação técnica-recorrente / curva-pontual / outro → §5.1, §5.3, §6.3. OK.
4. Sinal vs ruído + nível de confiança → §4 (dois pisos, fórmula, gates, out-lap, curva curta). OK.
5. Ganho estimado (s/volta e stint) com o método → §3 (relógio=teto, escala, quantil, adesão). OK.
6. Mais de uma abordagem comparada + recomendada → §6 (A/B/C, recomenda B endurecida + C offline). OK.
7. Encaixe no motor de delta → §7 (entra/sai/derivado; tempoAtualS §7.1). OK.
8. Fronteira respeitada (não escrevi mensagem J1 nem gráfico J3) → §0, §9. OK.

---

## (Preservado) Papel anterior nesta linha de trabalho — COORDENADOR FABLE 5 · Rodada 0

> Registro mantido para não perder contexto. Retomada do maestro: Flávio aciona com "audita janela N" / "sintetiza".

---

## TASK_INIT — Rodada 0 do Coordenador (Fable 5) — 2026-07-08

- Protocolo carregado: sim (FLAVIO_EXECUTION_PROTOCOL / DONE_CHECKLIST / ENVIRONMENT_RULES / COMMUNICATION_RULES + ~/.claude/CLAUDE.md).
- Padrões carregados: sim (~/.claude-decisoes/padroes.md — ainda sem decisões registradas).
- Ambiente alvo: DESENVOLVIMENTO (só arquivos de coordenação em `.claude-exec/coach-ia-sala/`; nenhum código de produto tocado).
- Produção protegida: sim.
- Autorização para produção: não. Evidência: "não recebida" (nem necessária — Rodada 0 não toca produto).
- Pedido original: Flávio colou `COORDENADOR-FABLE5.md` — assumir o papel de maestro sob demanda das 5 janelas Opus 4.8 e executar a **Rodada 0** (travar contratos de interface, preencher PLANO-MESTRE.md, criar a caixa de correio com mandato de cada janela), depois ficar de prontidão.
- Objetivo (1 frase): deixar a mesa pronta para as 5 janelas trabalharem em paralelo sem se bloquear — contratos travados contra o código REAL (verificado, não inferido).
- Critérios objetivos de conclusão da Rodada 0:
  1. Afirmações-chave do briefing conferidas no código real (motor de delta, encaixe vazio do coach, `coach: null` no pacote, geometria, painel, fixture).
  2. `PLANO-MESTRE.md` preenchido: objeto oportunidade v0, contrato de layout do miolo, pacote do coach, dependências, matriz de status, definição de pronto, decisões abertas.
  3. `canal/janela-N/{para-fable.md, do-fable.md}` criados (N=1..5), com primeiro bloco de mandato + contrato em cada `do-fable.md`.
  4. Aviso ao Flávio: "Rodada 0 pronta — pode soltar as janelas 1 a 5", e prontidão (sem loop).
- Plano (≤5): (1) verificar fontes-da-verdade no código real; (2) preencher PLANO-MESTRE.md preservando o esqueleto existente; (3) criar caixas de correio com mandatos; (4) atualizar este arquivo + registro; (5) avisar e parar.
- Arquivos/áreas a inspecionar: `web/cockpit/delta-calculator.js`, `web/command-box/cerebro/cerebro-coach.js`, `cerebro-painel.js`, `web/cockpit/cockpit-volta-real.html` + `cockpit.css`, geometria (`pista-oficial-brasilia.js`, `pista-cb-polyline.js`, `apices-semente-brasilia.js`, `tipos-curva-brasilia.js`), `trecho-detector.js`, fixture `passagens-bubi-brasilia.v1.json`, migração `0026`.
- Riscos: (a) travar contrato errado e as 5 janelas herdarem o erro → mitigação: só travar o que foi conferido no código; o resto marcado PROVISÓRIO com dono; (b) sobrescrever conteúdo existente da sala → mitigação: PLANO-MESTRE preenchido por edição preservando o esqueleto; para-fable.md é da janela (só garanto que exista).
- Status: iniciado 2026-07-08T14:41Z.

## Andamento
- 2026-07-08T15:0xZ — Flávio pediu reavaliação de gasto; aprovou o **modo enxuto**: sem leitores paralelos do maestro; conferência pontual só nos 3 fatos dos contratos; Fable atua só em Rodada 0 / "audita janela N" / arbitragem / "sintetiza".
- 2026-07-08T17:01Z — **Rodada 0 CONCLUÍDA**: contratos §2.1–2.4 no PLANO-MESTRE (v0 provisórios com dona), correção ao briefing em §2.5 (cerebro-coach.js NÃO está vazio — v0 funcional preservada; null é só o campo em cerebro-painel.js:167), caixas canal/janela-1..5 criadas com mandato, entregas/ pronta, registro-correcoes atualizado. Conferências com prova: delta-calculator.js (SUB_TRECHOS l.57, saída l.169-173), cerebro-coach.js (cat integral), cerebro-painel.js (grep coach l.167/175), fixture (head — pontos crus {lat,lng,kmh,t}, 8 curvas oficiais).
- Estado atual: **DE PRONTIDÃO** — aguardando "audita janela N" / "audita" / "sintetiza" do Flávio. Nenhum código de produto tocado; produção intacta.
- 2026-07-09T18:33Z — **TODAS AS 5 FRENTES APROVADAS** após 3 rodadas de auditoria + QA adversarial (J5) com provas reproduzidas pelo maestro. Achado central: a 1 Hz o caminho comum da Fase 1 é coach de curva inteira (`subTrecho:null`); vitrine oficial = Curva "S" ~1,0 s/volta; F1 (limites de segmento tortos em 4/8 curvas) = investigação passo 0 da Fase 1 (J4+J2). Faltam: **"abre as decisões"** (10 martelos no §6 do PLANO-MESTRE) e **"sintetiza"** (SOLUCAO-FINAL.md). Recomendação do maestro: decisões antes da síntese.
- 2026-07-09 — **DECISÕES + SÍNTESE CONCLUÍDAS. SALA ENCERRADA.** Painel `p1fast-coach-decisoes-1543` (renderização VERIFICADA no navegador: 10 cartões = 10 perguntas, sem erro) respondido pelo Flávio: 9 decisões (3-B sem vermelho no coach → padrão GERAL gravado em licoes-globais.md; 6-B insistência contínua via plano do stint; demais = recomendações aceitas) + nova demanda registrada (tela de Aprendizagem no Command Box). `entregas/SOLUCAO-FINAL.md` escrita com tudo incorporado. Decisões brutas em `~/.claude-decisoes/perguntar-historico.jsonl`.

## TASK_DONE — Coordenador Fable 5 (sala completa) — 2026-07-09
- Pedido original conferido: sim (COORDENADOR-FABLE5.md item por item: Rodada 0 ✓ · auditorias sob demanda ✓ · arbitragens ✓ · síntese ✓; modo enxuto aprovado pelo Flávio em 08/07 respeitado).
- Ambiente trabalhado: desenvolvimento (só documentos da sala + memória). Produção foi alterada: não. Autorização: n/a.
- Arquivos reais inspecionados: sim (afirmações de contrato conferidas no código real; provas da J5 reproduzidas com saídas idênticas).
- Alterações feitas: sim (PLANO-MESTRE, caixas canal/janela-1..5, SOLUCAO-FINAL.md, painel de decisões, licoes-globais.md, perguntar-historico.jsonl, este arquivo; registro-correcoes atualizado durante a tarefa).
- Testes/validação executados: sim (contraprovas de código a cada auditoria; scripts da J5 re-executados; painel renderizado e contado no navegador real: 10/10 sem erro).
- Resultado: CONCLUÍDO.
- Pendências reais: construção da Fase 1 aguarda o "vai" do Flávio (passo 0 = investigação dos limites de trecho); adequação do padrão de cores nas telas antigas = tarefa separada a planejar; nova demanda (tela de Aprendizagem no Command Box) aguarda priorização.

---

## TASK_INIT — JANELA 5 (Cenários reais + Auditoria de coerência) — 2026-07-08

- Pedido original: Flávio: "vc é a janela 5" — assumir o mandato da Janela 5 (PROMPT-JANELA-5.md + canal/janela-5/do-fable.md): 3–5 cenários reais ponta a ponta + auditoria adversarial de coerência de J1–J4 + 2 QAs extras do Fable.
- Objetivo (1 frase): provar o conjunto J1–J4 com dado real de Brasília e caçar furo, entregando `coach-ia-sala/entregas/janela-5.md`.
- Critérios de conclusão: (1) 3–5 cenários ponta a ponta (objeto v1 J2 → gráfico J3 → mensagem J1 → timing) com dado REAL do fixture; (2) relatório de coerência J1–J4 contra a régua dura, com janela responsável por achado; (3) QA extra 1: verificação INDEPENDENTE do achado ápice-semente×fixture da J3; (4) QA extra 2: cenários cobrem silêncio honesto, subTrecho:null e gate SF da Vitória; (5) bloco PRONTO PARA AUDITORIA em para-fable.md + aviso de 1 linha ao Flávio.
- Leitura obrigatória confirmada: ~/.claude/CLAUDE.md (sim) · ~/.claude-decisoes/padroes.md (sim — vazio) · FLAVIO_EXECUTION_PROTOCOL.md (sim) · FLAVIO_DONE_CHECKLIST.md (sim) · FLAVIO_ENVIRONMENT_RULES.md (sim) · FLAVIO_COMMUNICATION_RULES.md (sim).
- Plano (≤5): (1) conferir citações-chave de J1–J4 no código real; (2) análise própria do fixture (tempos/gaps/quantis) + rodar o motor de delta real; (3) verificação independente do ápice-semente (método próprio, em metros); (4) escrever entregas/janela-5.md; (5) fechar canal + registro + TASK_DONE.
- Arquivos/áreas a inspecionar: entregas/janela-1..4.md, fixture passagens-bubi-brasilia.v1.json, delta-calculator.js, apices-semente-brasilia.js, pista-oficial-brasilia.js, tipos-curva-brasilia.js, cerebro-coach.js, cerebro-painel.js, cockpit.css/cockpit-volta-real.html, oportunidade-trecho.js, DeltaCoach.cs, CockpitOrchestrator.cs.
- Ambiente alvo: DESENVOLVIMENTO (só leitura de código + escrita em .claude-exec/ e scratchpad; nenhum código de produto tocado).
- Produção protegida: sim. Autorização para produção: não. Evidência: "não recebida" (nem necessária).
- Riscos: (a) validar cenário contra citação errada das outras janelas → mitigação: spot-check no código real antes de aceitar; (b) "número real" que na verdade é derivado → mitigação: todo número dos cenários sai de script executado e a origem fica declarada.
- Status: iniciado 2026-07-08.

## TASK_DONE — JANELA 5 — 2026-07-08
- Pedido original conferido: sim (mandato do-fable.md + PROMPT-JANELA-5.md, item por item).
- Ambiente trabalhado: desenvolvimento (só leitura de código de produto + escrita em .claude-exec/; nada de produto tocado).
- Produção foi alterada: não.
- Arquivos reais inspecionados: sim (entregas J1-J4, fixture, delta-calculator, cerebro-coach/painel, cockpit.css/html, geometria, oportunidade-trecho, live-data-bridge, DeltaCoach.cs, CockpitOrchestrator.cs, CockpitStateModel.cs, stint-plan, tipos-curva).
- Alterações feitas: sim — criados entregas/janela-5.md e provas-j5/ (2 scripts + 2 resultados); acrescentados bloco PRONTO em para-fable.md, 2 entradas no registro-correcoes.md, TASK_INIT/TASK_DONE aqui. NADA sobrescrito/removido.
- Testes/validação executados: sim — 2 scripts de análise executados contra o fixture e o motor real (saídas salvas em provas-j5/RESULTADO-*.txt).
- Resultado: concluído (os 5 critérios do TASK_INIT atendidos: 5 cenários reais; relatório F1-F8 com dono; QA-1 independente [refuta 7/8 → confirma 4/8]; QA-2 coberto [silêncio/subTrecho:null/gate SF]; canal fechado com PRONTO).
- Pendências reais: as dos ACHADOS (F1-F8) — são das outras janelas/Fable/Flávio, não desta. Limitação declarada: anotação de sub do prova-motor é aproximação offline (declarada no script e na entrega); linhas ao vivo do trecho-detector não conferidas (F1, despachado).

## TASK_INIT — Fable · REDESENHO DO MIOLO (ordem direta do Flávio, 2026-07-10)
- Protocolo/padrões: sim (sessão corrente). Ambiente: DESENVOLVIMENTO (`.claude/worktrees/coach-miolo-v2`, linha `claude/coach-miolo-v2`). Produção protegida: sim; autorização: n/a.
- Pedido original (palavras dele): "redesenhar e criar o espaço para no meio ver o zoom do trecho da pista com o ghost; o 7.0/buscar limite mais para a esquerda, um pouco menor; o 76 antes bem mais para a direita; no meio o zoom só do carro onde ele está com o ghost".
- Leitura: REVISÃO da decisão 7 (tempo-exclusivo → coexistência com números nas laterais e zoom permanente no centro). Registrada no histórico de decisões.
- Objetivo (1 frase): miolo novo — delta menor à esquerda, freada à direita, zoom permanente do trecho atual com ghost (melhor passagem real) e carro ao vivo no centro; lição do coach no fim da volta entra no espaço central.
- Plano (≤5): (1) css de sobreposição (sem tocar cockpit.css); (2) módulo do zoom ao vivo (ghost = melhor passagem por curva do fixture real); (3) 1 gancho aditivo no painel (posição a cada leitura); (4) validar no navegador com foto; (5) mostrar ao Flávio e iterar.
- Riscos: mexe no visual aprovado POR ORDEM dele — tudo em sobreposição reversível; nomes de curva fixture×barras podem divergir (mapeio por proximidade como reserva).
- Status: iniciado.

## Andamento — Fable · miolo v2 + app (2026-07-10, noite)
- Redesenho do miolo ITERADO com o Flávio ao vivo (10+ rodadas): zoom central com carro fixo apontando pra cima e mundo girando pela TANGENTE da rota; carro silhueta que esterça pela CURVATURA do traçado; ghost v3 = bolinha azul esmaecida CONTÍNUA da melhor volta completa real + gap ao vivo circular com rastreador anti-dobra; vidro premium (aro de luz, lâmina interna, elevação); pista como faixa; zoom pela velocidade; rastro tom único 13 leituras; anti-salto por duração real entre leituras. Auditoria externa pedida pelo Flávio achou 3 defeitos graves (cascata morta, chicote de giro, portais) — corrigidos com prova. Registro-correcoes atualizado (4 entradas novas).
- **"1 e 2" do Flávio:** (1) miolo v2 INCORPORADO à linha oficial local (0 conflitos, testes verdes pós-junção); (2) cópia embutida do app REMONTADA da base nova: apresentação iPhone + fetches relativos + DEMO-cede-ao-vivo (decisão do giro, opção A recomendada aceita) + 12 arquivos copiados (inclui fixture do ghost + pista oficial); pacote autossuficiente conferido; tela renderizada e FOTOGRAFADA funcionando (vidro+ghost+gap+selo DEMONSTRAÇÃO). Pasta Cockpit é referência de pasta no projeto (novos arquivos embarcam sozinhos).
- Empacotamento de validação (simulador) rodando em segundo plano. Falta: instalar no iPhone físico do Flávio (precisa do aparelho conectado / fluxo Xcode).


## 2026-07-11 (tarde) — aviso elegante sem transmissão + bolinha verde limão
- Pedidos: (1) trocar erro técnico feio da tela ASSISTIR por aviso elegante; (2) bolinha verde limão no lugar do carrinho no zoom central.
- Feito: AssistirView (aviso + selo neutro + retentativa silenciosa 20s + log interno); coach-zoom-live.js nas 2 cópias (bolinha limão, esterço removido); atalho de bancada --p1-login-dev.
- Provas: capturas simulador 16PM (assistir) e 375×812 (cockpit) + render web pose=30. Instalado no iPhone físico.
- Status: concluído — aguardando confirmação visual do Flávio.

## TASK_INIT — JANELA 1 (Opus 4.8) — HeroEventoCard (Home Dia de Pista) — 2026-07-11
- Protocolo carregado: sim
- Padrões carregados: sim
- Ambiente alvo: desenvolvimento (worktree `.claude/worktrees/home-j1-heroi`, linha `claude/home-j1-heroi`, a partir de `main` local)
- Produção protegida: sim
- Autorização para produção: não (n/a — nada vai ao ar)
- Pedido entendido: criar componente novo `HeroEventoCard.swift` (assinatura do CONTRATO) + tokens novos no Theme.swift se faltarem + #Preview 4 estados.
- Critério de conclusão: componente com assinatura EXATA do contrato; anel de prontidão (some se nil); linha pendências tocável (some com 0); selo âmbar "EM N DIAS"/azul "HOJE"; botão "Iniciar Stint"; empacotamento verde; foto dos previews; testes existentes verdes; entrega janela-1.md.
- Fronteira: só `HeroEventoCard.swift` (novo) + `Theme.swift`. Nada mais.
- Nota tokens: âmbar já existe (Color.atencao #fab72a). Verificar se falta algo antes de tocar Theme.
- Status inicial: iniciado.

## TASK_DONE — JANELA 1 — HeroEventoCard — 2026-07-11
- Pedido original conferido: sim (mandato PROMPT-J1-HEROI.md, item por item)
- Ambiente trabalhado: desenvolvimento (worktree `claude/home-j1-heroi`; produção intocada)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (COORDENACAO.md, mockup aprovado, Theme.swift, EyebrowHeader/SummaryStats, project.yml, registro-correcoes)
- Alterações feitas: sim — criado `HeroEventoCard.swift` (novo). Theme.swift NÃO alterado (âmbar já existia como Color.atencao). Nada removido/sobrescrito.
- Testes/validação executados: sim — build REAL do alvo `p1fast-ios` no simulador P1-Zoom375 = BUILD SUCCEEDED (inclui os 4 #Preview); fotos dos 4 estados renderizados (provas-j1/); smoke oklch 10 ok/0 fail (tokens intactos)
- Resultado: concluído (assinatura EXATA do contrato; 4 estados honestos: anel some se nil, linha some se 0, HOJE azul; sem emoji; sem vermelho; fronteira respeitada)
- Pendências reais: nenhuma da J1. Consumo pela J5 e montagem final = coordenador (Fable).

---

# JANELA 5 — ESTRUTURA DA HOME "Dia de Pista" — 2026-07-11

## TASK_INIT — J5
- Protocolo carregado: sim · Padrões carregados: sim
- Ambiente alvo: desenvolvimento · Produção protegida: sim · Autorização produção: não
- Pedido entendido: reescrever o estado cheio da HomeView.swift contra o CONTRATO, com peças provisórias, ligando dado real e removendo os botões de teste da Home (papel J5, trava janela-5).
- Critério de conclusão: Home reescrita chamando as 5 assinaturas do CONTRATO + stubs provisórios + empacotamento verde + fotos no simulador + relatório com provas.
- Ambiente isolado: worktree `.claude/worktrees/home-j5-estrutura`, linha `claude/home-j5-estrutura`, a partir do main local (68813c12). Nunca incorporar.

## TASK_DONE — J5
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (worktree isolado)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (HomeView.swift do worktree, ContentView.swift, PendenciaRepository, StintRepository, EventoRepository, Theme.swift, componentes reais J1–J3 nas worktrees, referência HTML aprovada, project.yml)
- Alterações feitas: sim — HomeView.swift (reescrita estado cheio + HeroSemEvento + HomeData estendido), HomeDiaDePistaStubs.swift (NOVO, 5 provisórios), ContentView.swift (seam de dado real, só leitura), project.pbxproj (xcodegen registrou o stub). Nada removido/sobrescrito indevidamente; structs antigos preservados sem chamada.
- Testes/validação executados: sim — `xcodebuild` no simulador P1-Zoom375 = BUILD SUCCEEDED (com provisórios e no build final limpo); sem alvo XCTest no iOS; 3 fotos (cheio/rodapé/vazio) em entregas/provas-j5.
- Resultado: concluído — estrutura entregue contra o CONTRATO, dado real ligado (prontidão somente-leitura, honesto), estados honestos, sem vermelho/emoji, largura toda, fronteira respeitada (delta = 4 arquivos, nada proibido tocado).
- Pendências reais: iPhone 16 Pro Max não instalado nesta máquina (provado no P1-Zoom375, device canônico); montagem final (troca provisórios→reais + J4) é do coordenador, só com ordem do Flávio. 3 decisões de formato anotadas na entrega para o Flávio confirmar (avatar→Garagem; AoVivoRow alimentada pelo stint ao vivo; MelhorVoltaCard via HomeData.melhorVoltaMs).

## 1. Pedido original do Flávio
Criar uma tela ANTES do Command Box: um MENU pra escolher o que ver no navegador da TV
(Fire Stick). Hoje o que está no ar é a Vista do Piloto. O menu chama essa tela e as outras
(Engenheiro, Frenagem & Aceleração que está sendo criada, etc.). Tela super hiper premium,
extremamente bonita, com a FOTO do carro Bubi (Celta) no fundo — a mesma do cadastro do carro.

## 2. Objetivo (1 frase)
Entregar um launcher premium, navegável pelo controle do Fire Stick, que abre cada visão do Command Box.

## 3. Critérios de conclusão
- Arquivo de menu criado, abre em navegador, full screen 16:9 de TV.
- Cards pras visões reais existentes (Piloto, Engenheiro, Comparar Voltas) + card "em construção" (Frenagem & Aceleração).
- Navegável por controle remoto (setas + OK) e por mouse/toque.
- Visual premium com identidade FAM Racing (Celta #80).
- Aberto no navegador pra validação.

## 4. Confirmação de leitura
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim (existe)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim (existe)
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim (existe)
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim (existe)
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim (existe)
- Projeto: CLAUDE.md do P1 Fast + memória

## 5. Plano (<=5 passos)
1. Inventariar telas existentes do Command Box (FEITO).
2. Criar menu premium navegável por controle remoto.
3. Ligar os cards às telas reais.
4. Abrir no navegador.
5. Pedir a foto real do carro ao Flávio (único item que não consigo verificar).

## 6. Arquivos/áreas
- _design-reference/menu-command-box.html (NOVO)
- Liga em: mockup-command-box-vista-piloto.html, -vista-engenheiro.html, -comparar-voltas.html

## 7. Ambiente alvo: desenvolvimento
## 8. Produção protegida: sim
## 9. Autorização para produção: não
## 10. Evidência da autorização: não recebida (NÃO republicar em command-box-tv.vercel.app sem ordem)
## 11. Riscos: a foto do carro não foi localizada na máquina/cadastro — usar placeholder premium até Flávio fornecer.
## 12. Status inicial: iniciado

---
## STATUS FINAL: CONCLUÍDO (menu premium com a FOTO REAL do Bubi no fundo) — 2026-06-27
- Menu criado e aberto no navegador: _design-reference/menu-command-box.html
- Cards ligados às telas reais existentes (Piloto, Engenheiro, Comparar Voltas) — links 200.
- Card "Frenagem & Aceleração" marcado "Em construção" (tela ainda sendo criada).
- Navegação por controle remoto (setas + OK) + mouse/toque implementada.
- ★ FOTO DO CARRO: LOCALIZADA E APLICADA (resolveu o bloqueio do registro anterior).
  A foto real do Bubi (Celta #80 FAM Racing, na pista) estava em
  `_design-reference/_backups/carro-foto-bolinha-641A81E7/641A81E7-3192-4E68-8183-B8401F105574.jpg`
  (foto do cadastro do carro). Copiada para `_design-reference/bubi.jpg` e ligada no menu
  (`--foto-carro: url('bubi.jpg')` + body.has-foto desliga o desenho provisório).
- Validado no navegador pela 8078 (foto e 3 telas-alvo respondem 200). Capturas em /tmp/menu-com-foto.png.
- NÃO republicado em command-box-tv.vercel.app (sem autorização de produção).

---
## Atualização (iteração com Flávio)
- Foto real do Bubi (bubi.jpg) no fundo do menu; número 80 removido; tratamento premium (véu topo/base, sombra no texto).
- Botão "Voltar" (premium, navegável por controle + tecla Voltar) adicionado em:
  - mockup-command-box-vista-piloto.html
  - mockup-command-box-vista-engenheiro.html
  - mockup-command-box-comparar-voltas.html JÁ tinha back-link pro menu (mantido).
- Endereço curto escolhido por Flávio: p1box.vercel.app (p1 não estava livre).
- PENDENTE (go-live): montar o pacote (menu como home + as 3 visões + dependências + bubi.jpg)
  e publicar em p1box.vercel.app. É "colocar no ar" — confirmar visual aprovado antes.

---
## TASK_DONE — Menu do Command Box publicado (27/06)
- Endereço NO AR: https://p1box.vercel.app (público, sem login — conferido HTTP 200).
- Home = menu; telas ativas: Visão do Piloto, Frenagem & Aceleração (cada uma com botão "Voltar").
- Visão do Engenheiro: "Em construção" no menu (sem link) — não publicada (estava bagunçada).
- Número 80 removido; foto real do Bubi (bubi.jpg) no fundo.
- Pacote montado por tools/montar-p1box.mjs (0 dependências faltando; 36 deps).
- Projeto Vercel próprio "p1box" (scope flaviomarques-6007s-projects), separado do command-box-tv (intocado).
- REPUBLICAR no futuro:
    node tools/montar-p1box.mjs && npx vercel deploy "dist/p1box" --prod --yes --scope flaviomarques-6007s-projects
- Resultado: CONCLUÍDO. Pendência: ligar Engenheiro quando a tela for arrumada; tela de Frenagem nova (se diferente da Comparar Voltas) quando o Flávio definir.

═══════════════════════════════════════════════════════════
## [2026-07-11] HOME DIA DE PISTA — JANELA 2 (Melhor Volta + Ao Vivo)
═══════════════════════════════════════════════════════════

TASK_INIT:
- Protocolo carregado: sim
- Padrões carregados: sim
- Ambiente alvo: desenvolvimento
- Produção protegida: sim
- Autorização para produção: não
- Pedido entendido: J2 do plano 5 janelas — criar MelhorVoltaCard.swift e AoVivoRow.swift contra o contrato.
- Critério de conclusão: 2 arquivos com assinatura exata, #Preview dos estados, build+testes verdes, entrega em entregas/janela-2.md.

TASK_DONE:
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (worktree claude/home-j2-volta-aovivo, base main 68813c12)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (Theme.swift, PistaBrasilia.swift, EyebrowHeader.swift, referência HTML, COORDENACAO.md)
- Alterações feitas: sim (2 arquivos novos em Sources/Components/)
- Testes/validação executados: sim (xcodebuild BUILD SUCCEEDED; p1fast-smoke 575 ok/1 fail = baseline PERSIST-03; fotos renderizadas e conferidas)
- Resultado: concluído
- Pendências reais: nenhuma
---

# TASK_INIT — J3 CARROS + NÚMEROS (Home "Dia de Pista") — 2026-07-11

1. Pedido original: mandato PROMPT-J3-CARROS-NUMEROS.md — construir 2 componentes SwiftUI novos da nova Home.
2. Objetivo (1 frase): entregar `CarroRowCompacta.swift` e `NumerosRodape.swift` com assinatura exata do contrato + #Preview, empacotamento verde.
3. Critérios de conclusão: 2 arquivos criados com assinatura do contrato; #Preview de cada (2+ carros; números zerados e cheios); build iOS verde; testes existentes verdes; relatório entregas/janela-3.md com provas reais.
4. Leituras confirmadas: ~/.claude/CLAUDE.md: sim · CLAUDE.md projeto: sim · COORDENACAO.md: sim · registro-correcoes.md: sim · Theme.swift (tokens): sim · proposta-a-dia-de-pista.html (ref visual): sim.
5. Plano (≤5): (a) worktree base 68813c12; (b) CarroRowCompacta; (c) NumerosRodape; (d) previews; (e) xcodegen+build+fotos+relatório.
6. Arquivos a inspecionar: Theme.swift, SummaryStats.swift, componentes existentes (idioma), project.yml.
7. Ambiente alvo: DESENVOLVIMENTO.
8. Produção protegida: sim.
9. Autorização para produção: não.
10. Evidência de autorização: não recebida.
11. Riscos: usar só tokens existentes do Theme (J1 é quem toca Theme.swift); não colidir com fronteiras de outras janelas.
12. Status inicial: iniciado.

## TASK_DONE — J3 CARROS + NÚMEROS — 2026-07-11
- Pedido original conferido: sim (2 componentes com assinatura do contrato + previews + provas)
- Ambiente trabalhado: DESENVOLVIMENTO (worktree claude/home-j3-carros-numeros, base 68813c12)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (Theme.swift, SummaryStats/Card/EyebrowHeader/FAB/BottomNav, ContentView, project.yml, ref visual)
- Alterações feitas: sim (CarroRowCompacta.swift + NumerosRodape.swift novos; pbxproj regenerado)
- Testes/validação executados: sim (xcodebuild BUILD SUCCEEDED; foto no simulador P1-Zoom375; node-smoke-oklch 10/0)
- Resultado: CONCLUÍDO
- Pendências reais: nenhuma na minha fronteira; integração na Home = J5/coordenador
