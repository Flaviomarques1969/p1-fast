# Caixa de entrada da Janela 3 — só o Fable escreve aqui

### 2026-07-08T17:01:37Z — Fable · MANDATO + CONTRATO (Rodada 0)

**Seu mandato:** o **gráfico com zoom do trecho (Parte A)** — o que plota (opções + recomendação), como recorta/amplia a geometria em torno do `segmentId`, mockups escuros com medidas, onde senta no miolo e quando aparece/some. Legível em relance, alta velocidade. Você NÃO faz: mensagem (J1) nem seleção (J2).

**Contrato que te toca (PLANO-MESTRE):**
- §2.1 — você consome do objeto oportunidade: `segmentId` (a âncora do zoom), `subTrecho` (o que destacar) e `tracos.atual`/`tracos.referencia` (as duas linhas). Formato v0 provisório; a J2 confirma cedo.
- §2.2 — seu slot é a **esquerda (≈60%) do cartão único** do coach. **Tarefa sua da Rodada 0: MEDIR o retângulo livre real do miolo** no HTML/CSS aprovado (`web/cockpit/cockpit-volta-real.html` + `cockpit.css`) e **propor as medidas exatas do cartão em px** — eu arbitro com a J1. Slot fixo: layout nunca muda conforme o conteúdo.
- §2.2 — aparecer/sumir segue **o portão da J1** (o cartão inteiro vem e vai junto). Modo crítico do painel SEMPRE vence; shift light e luz de freio nunca são cobertos.
- §2.4 — régua: fundo preto `oklch(0% 0 0)`, sem emoji, número sem sinal, painel aprovado intocado.

**Geometria (aponta o briefing §4.6 — confirme ao abrir):** `geoParaDesenho` em `web/cockpit/pista-oficial-brasilia.js`, `fracDe` em `web/command-box/pista-cb-polyline.js`, ápices em `web/cockpit/apices-semente-brasilia.js`, tipos de curva em `web/command-box/tipos-curva-brasilia.js`. **Não existe hoje nenhum desenho de traçado no painel do piloto** — seu elemento é 100% novo, e o visual do painel é território sensível do Flávio: proponha DENTRO do padrão.

**PRONTO =** PLANO-MESTRE §5 (J3). Ao concluir, siga o rito do seu prompt (bloco PRONTO PARA AUDITORIA na sua `para-fable.md`).

VEREDITO: (nenhum ainda — trabalhe seu prompt; auditoria vem quando o Flávio acionar o Fable)

### 2026-07-08T19:48:09Z — Fable · ATUALIZAÇÃO DE CONTRATO (sem veredito — sua frente segue)

O **objeto oportunidade v1 está confirmado** (J2 auditada — `entregas/janela-2.md` §1 é o contrato vigente; PLANO-MESTRE §2.1 aponta pra lá). O que muda pra você:
1. Você consome: `segmentId` (âncora do zoom), `subTrecho`, `tracos.atual/referencia` (as duas linhas) e **`apice:{distFromIdealM, angleFromIdealDeg}`** (a bolinha, quando o alvo é ápice).
2. `subTrecho` pode vir **null** (curva curta) — preveja o zoom da **curva inteira**, sem destaque de sub-trecho.
3. `tracos` pode vir **null** — o gráfico precisa de um comportamento definido nesse caso (não desenhar? só rótulo?). Especifique.
4. O ganho exibido vem POSITIVO em segundos (`ganhoVoltaS`); número sem sinal, cor dá direção — vale pro que você plotar também.

### 2026-07-08T19:48:09Z+ — Fable · ATUALIZAÇÃO 2 (J1 auditada — o portão de timing está publicado)

1. A J1 publicou o **contrato do portão** que você obedece (`entregas/janela-1.md` §3.4): `timing = {portao, nivel, podeMostrar, duracaoMs, prioridade:'critica-vence'}` — o cartão inteiro (seu gráfico + mensagem dela) aparece/some junto; **some antes da próxima zona de freada**; nível N1 (reta) / N2 (fim de volta) / N3 (box). Seu gráfico deve ter leitura compatível com cada nível (relance no N1/N2).
2. **Item de contrato pra você (conferido no código):** o motor v3 `web/cockpit/oportunidade-trecho.js:182` renderiza metros com sinal (`+3 m`/`−3 m`) — é anterior à regra "número sem sinal" (04/07). **Na superfície do coach, marcas de metros vão SEM sinal** (direção por cor/posição/seta de traço). Especifique como o seu gráfico mostra "3 m mais tarde/antes" sem `+`/`−`.
3. O slot da mensagem da J1 tem mock em `entregas/janela-1.md` §2.6 — dimensione o seu lado do cartão junto com a medida real do miolo que você vai levantar.

### 2026-07-08T20:08:02Z — Fable · AUDITORIA da entrega (1ª passada)

**VEREDITO: SEGUIR** — frente no rumo e essencialmente completa. APROVADO sai depois do martelo do Flávio no caminho (b) e do QA da J5.

**Auditoria (mandato/régua/coerência):**
- Mandato: coberto por inteiro (opções + recomendação A/Fase 1, método do zoom PROVADO com dado real, medição do miolo, mockups com px, aparecer/sumir obedecendo o portão da J1). Fronteira respeitada.
- Régua: passa. Destaque: sua resolução do "número sem sinal" no gráfico (direção = posição + cor; número só magnitude) fecha a reconciliação que a J1 te passou — adotada como regra do cartão.
- Verificação de fatos (conferi no código): `.device` 956×440 (cockpit.css ~l.53) ✓; `data-msg-state="ativa"` desliza o delta −230px (cockpit.css:466-468) ✓; `data-ultima="on"` esconde `.brake-result` (HTML l.161-162) ✓. O gancho que o caminho (b) reusa é real.

**Arbitragens do maestro:**
1. **Medidas do cartão ACEITAS como contrato de trabalho** (provisório até o martelo visual do Flávio): cartão x150→806 · y74→312 (h238); gráfico x150→544 (394px); mensagem x550→806 (256px — atende o mínimo da J1). PLANO-MESTRE §2.2 atualizado.
2. **Caminho (b) — tempo-exclusivo:** registrado como decisão do FLÁVIO (§6 do quadro), com minha recomendação de aceitar (reusa comportamento que o painel já tem; nada é redesenhado). Até ele decidir, siga projetando no caminho (b).
3. **Furo ápice-semente × passagens (seu §5):** aceito o seu contorno (âncora = `tracos`/`apice` vivos). A verificação independente do furo virou item de QA da J5; investigação de causa vai pra J2/J4 depois do QA. Não te bloqueia.
4. Fase 1 = traçado com zoom: coerente com o plano da J4; registrado pro Flávio confirmar junto com o caminho (b).

**Pedido do Flávio (novo, vale já):** comece **toda resposta** a ele com `[JANELA 3]` e rode uma vez no terminal: `printf '\033]0;JANELA 3\007'` (estampa o número no título da janela do terminal).

### 2026-07-08T20:55:41Z — Fable · CORREÇÃO do QA da J5 (leve)

**VEREDITO: CORRIGIR (pontual)** — o QA da J5 verificou seu achado do ápice-semente com método independente (distância mínima em METROS do semente à linha real; reproduzi a prova, números confirmados): **o real é 4/8, não 7/8**. Divergem: Bruxa 70 m · Placar 235 m · "S" 100 m · Vitória 82 m. Casam (≤5,2 m): Curva 01, Reta Oposta, Junção, Curva 2. Seu método (ponto-do-meio da passagem) mede "o ápice está no meio do segmento?", não "está na linha?" — e os limites de segmento estão tortos (achado F1 da J5), o que inflou seu número.
**O que fazer (só isto):** corrija o §5 da sua entrega — troque o "7/8" pela tabela/método da J5 (`entregas/janela-5.md §2`) e mantenha sua decisão de ancoragem (ela fica DE PÉ e foi endossada pelo QA: 4 curvas divergem feio, incluindo Bruxa e "S"). O registro de correções do projeto já foi atualizado pela J5. Depois deixe novo bloco PRONTO na sua caixa.

### 2026-07-09T18:33:36Z — Fable · AUDITORIA da correção

**VEREDITO: APROVADO — frente fechada (definitivo).**
Conferido na entrega real: §5 corrigido com a tabela em metros da J5 e a explicação honesta do porquê o "7/8" estava inflado (l.183, 191-192, 203); a decisão de ancoragem (traços/bolinha vivos, nunca o semente) mantida e endossada ✓; cadeia do registro de correções preservada ✓.
Nota administrativa: a ÚNICA coisa que ainda depende de terceiro na sua frente é o martelo do Flávio no caminho (b) — está na fila dele (§6.7 do quadro) e não é pendência sua. De prontidão; nada mais a produzir.
