# Caixa da CONSTRUTORA TELA → Fable — só a construtora escreve aqui

> Sempre ACRESCENTE blocos com hora (`date -u +%FT%TZ`); nunca sobrescreva. Blocos obrigatórios: `PRONTO PARA AUDITORIA (M1)` e `(M2)`, com o relato REAL do que foi visto no navegador.

---

### 2026-07-10T13:31:45Z — CONSTRUTORA TELA · PRONTO PARA AUDITORIA (M1)

**Escopo entregue (passo 4 da Fase 1):** o cartão do coach nos 3 estados renderizando no painel aprovado, tempo-exclusivo (decisão 7), gráfico com zoom (decisão 8), SÓ âmbar/verde (decisão 3), número sem sinal — validado no NAVEGADOR REAL (não "deve funcionar").

**Ambiente isolado:** worktree `.claude/worktrees/coach-tela` (branch `claude/coach-fase1-tela`), a partir do estado local atual. Nada foi à versão oficial.

**Arquivos (soma por cima — diff conferido):**
- NOVOS: `web/cockpit/coach-card.js` (render dos 3 estados + gráfico SVG do recorte), `web/cockpit/coach-card.css` (slots fixos + tempo-exclusivo + crítico-vence, tokens reais), `web/cockpit/coach-pacote-exemplo.js` (ANDAIME).
- `web/cockpit/cockpit-volta-real.html`: **só aditivo** — 1 `<link>` do CSS + 2 `dispatchEvent` (portão `coach:curva`/`coach:volta-fim`, zero mudança visual/comportamental) + 1 `<script>` driver da demo.
- `web/cockpit/cockpit.css`: **INTOCADO** (0 mudanças — conferido no `git diff`).

**ANDAIME declarado:** `coach-pacote-exemplo.js` é montado do FIXTURE REAL (`passagens-bubi-brasilia.v1.json`, Bubi 23-24/05) + conversores REAIS (`geoParaDesenho`/`PONTOS_DESENHO`); o recorte/zoom (viewBox/contextoIdx) foi computado pelo algoritmo J3 §4.2. As passagens e o método são REAIS; a ELEIÇÃO da lição é montada por mim p/ a demo. **Troco pelo `construcao/pacote-exemplo.json` do CÉREBRO no M2** (ainda não publicado). Um cenário (ápice da Junção) está marcado `_ilustrativo` — exercita a bolinha, mas o dado 1 Hz não sustenta o "onde-fino" (J5/J3 §5).

**O QUE EU VI no navegador** (servidor estático na raiz do worktree; `cockpit-volta-real.html`):
1. **Oportunidade — Curva "S" (âmbar):** à esq. o recorte do "S" (linha do piloto âmbar vs referência fria tracejada + pista de contexto faint); à dir. `CURVA "S"` / `você perde tempo aqui` / regra / `carregue mais` + `1,0 s`. O **delta gigante "0.00" e a "FREADA" SUMIRAM** (tempo-exclusivo) — voltaram quando o cartão saiu.
2. **Oportunidade — Bruxa (âmbar):** recorte curvo reconhecível, mensagem `carregue mais 0,49 s`.
3. **Oportunidade — Junção ÁPICE (âmbar, ILUSTRATIVO):** as DUAS bolinhas (ideal ○ fantasma + piloto ◉ âmbar) + banda do sub + `feche a curva 2 m` (magnitude, sem sinal).
4. **Oportunidade — técnica RECORRENTE (âmbar, ILUSTRATIVO):** badge **`× 3 curvas`** no canto do gráfico + banda do sub 'freio' + `FREADA — 3 CURVAS` / `freie mais tarde 0,18 s` — exercita o badge e o sub 'freio'.
5. **Oportunidade — "S" RECUPEROU (VERDE):** linha e mensagem verdes, `mantenha 0,10 s` — prova que o coach usa só âmbar/verde (nunca vermelho).
6. **Silêncio honesto:** linha discreta `Juntando dado — 2 voltas` no topo do miolo, **sem** derrubar os números (silêncio não é tempo-exclusivo).
7. **null:** miolo limpo (nada), números do painel normais.
8. **Crítico vence:** com o cartão no ar, disparei o modo crítico (`ÓLEO BAIXO`) → o **cartão sumiu na hora** (a CSS + o observer garantem).
9. **Nada do painel movido/coberto** em nenhum estado: sensores no topo, luzes de freio nas laterais, fileira Entrada/Freio/Ápice/Saída, shift light e barra de voltas todos intactos. O cartão vive no miolo x150→806 · y74→312.
- **Camadas do gráfico exercitadas:** pista de contexto (faint) · linha de referência (fria tracejada) · linha do piloto (acento + velocidade sutil na cor) · banda do sub (freio/ápice) · bolinha do ápice (○/◉) · badge `× N` · rótulo. Só o `degradado` (`tracos==null`) não tem cenário próprio — o silêncio honesto cobre o "sem dado".

**Provas objetivas (browser):** `data-coach` transiciona `oculto → oportunidade → oculto` no portão real (`coach:volta-fim`/`coach:curva`); sob crítico `data-coach=oculto` e `coach-card opacity=0` com overlay crítico `display:flex`; acentos usados = só `ambar`/`verde` (0 vermelho). Sem erros no console.

**Regressão:** no worktree, `smoke:cockpit-web/renderer/state/bootstrap` **verdes** + `smoke:arquitetura` **verde** (a tela só EXIBE; `coach-card.js` não abre conexão nem usa dado fictício — só importa `geoParaDesenho` puro e consome o pacote).

**Nota de comportamento (1 linha, no espírito do painel):** o tempo-exclusivo usa um `data-coach` novo no `.device` — só o estado `oportunidade` faz delta + resultado-da-freada + "última volta" cederem (mesmo padrão que o crítico e a "última volta" já usam de "um cede ao outro"). O `cockpit.css` do painel não foi tocado; o único acréscimo de transição (fade dos números) vive no `coach-card.css`.

**Limite honesto:** o replay ao vivo usa `requestAnimationFrame`, que o Chrome congela em aba de segundo plano — por isso validei os estados no modo `?pose=` (síncrono) e o tempo-exclusivo/crítico nos dois (congelado e ao vivo, com o replay rodando na captura final). A fiação do portão real está provada.

**Pendências p/ o M2:** trocar o ANDAIME pelo pacote real do CÉREBRO; validar contra os cenários C1–C5 da J5 com o dado real; conferir o acento (uma fonte só — J1 calcula, eu copio).

`PRONTO PARA AUDITORIA (M1)` — avise: audita tela.

---

### 2026-07-10T14:05:00Z — CONSTRUTORA TELA · M1 aprovado; item de verificação do M2 fechado ANTECIPADO

Obrigado pelo APROVADO do M1. Ataquei já o seu item ("comprovar o ceder com o delta ATIVO de verdade") pra tirar risco do M2 — não depende do pacote do CÉREBRO (que ainda não publicou `construcao/pacote-exemplo.json`).

**O que fiz** (painel congelado `?pose=30`): pus um **delta ATIVO real** na tela — `0.34` (erro) + ação `BUSCAR LIMITE` + resultado da freada `7 DEPOIS` + `data-msg-state="ativa"` — e confirmei visualmente na foto que os números estão lá. Depois subi o cartão da oportunidade (`coach:volta-fim`, portão real).

**Prova autoritativa (numérica):** com o cartão no ar (`data-coach="oportunidade"`) e o delta `0.34` ATIVO no DOM, `getComputedStyle('.info-bloco').opacity === "0"` e `'.brake-result'.opacity === "0"` (lido com as transições desligadas, pra não medir um frame no meio). Ou seja: **a regra de tempo-exclusivo (`coach-card.css:37-39`) cede o delta ATIVO real, não só o placeholder "0.00"**. O texto `0.34` continua no DOM, só invisível.

**Limite honesto (o mesmo que você viu):** a foto ÚNICA do delta ativo sumindo eu **não** consegui capturar de forma limpa — a aba automatizada fica `visibilityState:"hidden"` e o Chrome **congela a animação de opacidade no thread do compositor** (mudança de texto pinta; fade de opacidade não). Nas 7 fotos limpas do M1 (quando a aba pintou) o ceder aparece visualmente (delta some com o cartão; volta no silêncio/null). Registrei esse artefato em `registro-correcoes.md` (2026-07-10). Na tela 10,5" sempre visível não há esse estado oculto — pinta normal.

**Conclusão:** item do M2 fechado no que dá pra provar sem o navegador em foco real: a REGRA cede o delta ativo (numérico autoritativo) + delta ativo confirmado na tela (foto) + ceder visual já provado nas fotos limpas do M1. Quando o pacote do CÉREBRO chegar, valido o ceder no replay AO VIVO rodando (aba em foco) + C1–C5. Sigo de prontidão.

---

### 2026-07-10T14:54:24Z — CONSTRUTORA TELA · PRONTO PARA AUDITORIA (M2)

**Escopo do M2:** troquei o ANDAIME pelo **pacote REAL do CÉREBRO** (`construcao/pacote-exemplo.json`, o que você auditou) e validei o render no navegador.

**Integração (a tela só EXIBE — fonte única):**
- `web/cockpit/coach-pacote-exemplo.js` agora é **snapshot do pacote real** (cabeçalho aponta a fonte + `_meta`; gerado por `scratchpad/gerar-pacote-tela-real.mjs` que lê o JSON do CÉREBRO). Estados: `oportunidade` (Curva "S") · `silencio` · `semOnda`→null.
- 3 ajustes de RENDER (no `coach-card.js`, território da tela — o dado não foi tocado):
  1. **Linha de ação** agora separa verbo/ganho por tabulação **OU 2+ espaços OU ganho no fim** — o pacote real manda `"carregue mais   1,0 s"` (espaços). Confirmado no DOM: verbo=`"carregue mais"`, ganho=`"1,0 s"` sozinho à direita, sem sinal.
  2. **Encaixe do recorte ao slot** virou trabalho da TELA (o cérebro manda o viewBox cru: `229.9 518 159.1 19.9`, ~8:1). A tela expande simétrico até 1,66:1 (sem cortar/distorcer) → o "S" achatado enche o slot e fica reconhecível. viewBox final medido no DOM: `229.9 479.9 159.1 96.1`.
  3. **Velocidade-na-linha** virou padrão da tela (o pacote real não manda o flag; o dado sempre tem kmh) e a **banda do sub** ganhou fração default no miolo (0,3–0,7) quando o spec não a manda.
- **Linha do silêncio** renderizada **como vem no pacote** (`coach.linha.texto`) — hoje o CÉREBRO já publica com a contagem: **"Juntando dado — 2 voltas"**. Nada hardcoded (fonte única, como você pediu).

**O QUE EU VI no navegador (pacote real, `?pose=30` + tecla K):**
1. **Oportunidade real — Curva "S":** recorte da curva (linha do piloto âmbar com velocidade na cor + referência fria tracejada + pista de contexto), rótulo `CURVA "S"`, mensagem `você perde tempo aqui` / `carregue mais` + `1,0 s` (âmbar, sem sinal). **Delta "0.00" e "FREADA" cederam.**
2. **Silêncio real:** linha discreta `Juntando dado — 2 voltas` no topo; números do painel permanecem (silêncio não é tempo-exclusivo).
3. **semOnda→null:** miolo limpo.
- **Acento usado: só `ambar`** (0 vermelho). Nenhum elemento aprovado movido/coberto.

**Provas numéricas (com transição desligada só p/ medir, defeat do congelamento da aba oculta):**
- Oportunidade no ar → `.info-bloco`=0 e `.brake-result`=0 (cedem). Silêncio → ambos = **1** (não cedem). Confirma a regra do tempo-exclusivo com o dado REAL.

**Regressão:** `smoke:cockpit-web/renderer/state/bootstrap` + `smoke:arquitetura-dado` **verdes**. `cockpit.css` segue com **0 mudanças**. Sem erros no console.

**Limite honesto (ao vivo em foco):** o replay `requestAnimationFrame` continua congelado na aba automatizada (`visibilityState:"hidden"` mesmo em aba nova ativa — não consigo forçar foco de SO daqui). Validei em `?pose=` (render síncrono, mesmo caminho que você usou no M1) + prova numérica do ceder. O ceder VISUAL ao vivo (delta rodando some) fica pendente de uma passada com o navegador em foco de verdade — recomendo você/Flávio conferir num Chrome normal (mesmo servidor estático na raiz do worktree).

**Sobre C1–C5:** o pacote real ship**a a eleição única (C1 = Curva "S" 0,996) + C5 (silêncio) + null** — que a tela renderiza dos dados reais. A eleição C1–C5 é do seu M2 do CÉREBRO (aprovado); o render das formas variantes (Bruxa/ápice/verde/recorrente) foi provado no M1 e o código não mudou (só ganhou robustez).

`PRONTO PARA AUDITORIA (M2)` — avise: audita tela M2.
