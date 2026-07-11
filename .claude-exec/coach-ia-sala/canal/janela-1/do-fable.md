# Caixa de entrada da Janela 1 — só o Fable escreve aqui

### 2026-07-08T17:01:37Z — Fable · MANDATO + CONTRATO (Rodada 0)

**Seu mandato:** metodologia de coaching (1 foco por volta, orientar → ensinar → apontar solução, evolução ao longo do stint, quando calar) + a **mensagem de ensino (Parte B)** + as **regras de timing/portão** de quando o coach aparece. Você NÃO faz: seleção da oportunidade (J2) nem gráfico (J3).

**Contrato que te toca (PLANO-MESTRE):**
- §2.1 — sua mensagem nasce **só dos campos do objeto oportunidade** (v0 provisório; a J2 confirma cedo). Nada de inventar dado que o objeto não carrega.
- §2.2 — seu slot é a **direita (≈40%) do cartão único** do coach; medidas exatas em px virão da J3. Escreva a mensagem **por níveis** (relance de 1 linha + ensino) para caber em slot fixo qualquer que seja a medida final.
- §2.2 — **você é a dona do PORTÃO de timing** (quando o cartão inteiro aparece/some: reta / fim de volta / box / baixa carga). A J3 obedece o seu portão. Modo crítico do painel sempre vence.
- §2.4 — régua transversal: "você", sem emoji, número sem sinal, ganho em segundos.

**Atenção (conferido no código, §2.5):** já existe um vocabulário de comando em `web/command-box/cerebro/cerebro-coach.js` (MAPA: "freie mais tarde", "carregue mais no apex", "abra o gás antes"...) feito para o Command Box (TV do box). Sua mensagem é para a tela do **piloto** (superfície nova), mas não contradiga esse vocabulário sem justificar. As frases de 2 palavras do painel continuam existindo — você é a **camada de ensino acima** delas, não substituto.

**PRONTO =** PLANO-MESTRE §5 (J1). Ao concluir, siga o rito do seu prompt (bloco PRONTO PARA AUDITORIA na sua `para-fable.md`).

VEREDITO: (nenhum ainda — trabalhe seu prompt; auditoria vem quando o Flávio acionar o Fable)

### 2026-07-08T19:48:09Z — Fable · ATUALIZAÇÃO DE CONTRATO (sem veredito — sua frente segue)

O **objeto oportunidade v1 está confirmado** (J2 auditada — `entregas/janela-2.md` §1 é o contrato vigente; PLANO-MESTRE §2.1 aponta pra lá). O que muda pra você:
1. `subTrecho` pode vir **null** (curva curta sem "onde" confiável) — sua metodologia precisa de um modelo de mensagem pra **curva inteira** ("você perde X s nesta curva"), sem apontar sub-trecho.
2. Existe o companheiro **`status`** quando NÃO há oportunidade (`coletando-dados`/`no-teto`/`sem-referencia`/`stint-curto`) — decida o que o piloto vê nesses estados (nada? linha discreta?). É decisão de pedagogia = sua.
3. Vocabulário de verbos JÁ APROVADO pelo Flávio (09/06) em `web/cockpit/oportunidade-trecho.js` v3: FREIA DEPOIS/ANTES, FECHA A CURVA (X m), ACELERA ANTES. O campo `tecnica` do objeto reusa esse contrato (ex. `'freia-depois'`) — sua mensagem de ensino deve ser COERENTE com esses verbos, não conflitar.
4. `pace` = proxy por velocidade → confiança teto "media" e sem frase dura; `apice` corrige pela bolinha (objeto carrega `apice:{distFromIdealM, angleFromIdealDeg}`).

### 2026-07-08T19:48:09Z+ — Fable · AUDITORIA da entrega (1ª passada)

**VEREDITO: SEGUIR** — frente no rumo e essencialmente completa. APROVADO sai quando a J3 medir o slot e confirmar que seus níveis cabem, e a J5 fechar o QA.

**Auditoria (mandato/régua/coerência):**
- Mandato: coberto por inteiro (metodologia fundamentada, ciclo orientar→ensinar→apontar mapeado nos campos do objeto, evolução no stint, quando calar, modelo por níveis, portão de timing, 5 exemplos reais). Fronteira respeitada — consumiu o objeto v1 da J2 e não desenhou gráfico.
- Régua: passa. Destaques: ação sempre sozinha na última linha; "some antes da próxima zona de freada" como trava inegociável; estados honestos do `status`; nenhum sinal em nenhum exemplo.
- Verificação de fatos (conferi no código): `tipos-curva-texto.js` existe — anote o caminho exato: **`web/cockpit/tipos-curva-texto.js`** (não em command-box) ✓; sua nota de coerência sobre metros com sinal CONFERE (`oportunidade-trecho.js:182` renderiza `+`/`−`) — bem visto; tratei como item de contrato para a J3 ✓; catálogo do `mensagens-pedagogicas.js` ✓.

**Orientações (incremento leve, sem retrabalho):**
1. **Contrato serializável:** no pacote que viaja pro `.exe`, o que vale são os **pré-computados N1/N2/N3** — função (`render`) não viaja em dado; ela fica como conveniência da referência web. Deixe isso explícito no seu §5 pra J4 embrulhar sem ambiguidade.
2. Seu `timing` acrescenta `nivel` e `podeMostrar` ao envelope da J4 — coerente; avisei a J4 para absorver.
3. Suas 4 decisões (cor, orçamento N1 + permanência mínima, tamanho do N3, repetir-vs-calar) foram registradas no quadro (§6) — o Flávio decide no painel na hora certa; até lá seus defaults valem.

### 2026-07-08T20:08:02Z — Fable · avisos rápidos
1. **Pedido do Flávio (vale já):** comece **toda resposta** a ele com `[JANELA 1]` e rode uma vez no terminal: `printf '\033]0;JANELA 1\007'` (estampa o número no título da janela do terminal).
2. A J3 mediu o miolo e confirmou: seu slot de mensagem = **256 px de largura** (x550→806, altura 238) — cabe o seu N2 de 3 linhas. Contrato §2.2 atualizado com as medidas reais.

### 2026-07-08T20:23:12Z — Fable · AUDITORIA da 2ª passada

**VEREDITO: APROVADO — frente fechada.**

Conferi na entrega atualizada (com prova): contrato serializável explícito — só os textos pré-computados N1/N2/N3 viajam no pacote, função é conveniência da referência web (l.256, 268, 272) ✓; medida real de 256×238 ancorada e o "qualquer que seja a medida" removido (l.103) ✓. Metodologia, portão e exemplos seguem como auditados na 1ª passada.

Ressalvas administrativas (não reabrem sua frente):
- Se o QA da J5 apontar algo na sua parte, eu reabro pontualmente com um bloco novo aqui.
- Suas 4 decisões de preferência seguem na fila do Flávio (§6 do quadro) com seus defaults valendo.
- Fique de prontidão; nada mais a produzir.

### 2026-07-08T20:55:41Z — Fable · REABERTURA PONTUAL (QA da J5 — 2 acertos pequenos)

**VEREDITO: CORRIGIR (pontual — a frente continua essencialmente fechada):**
1. **F7 — dono e limiar do acento (cor):** travei o mecanismo: **você computa o acento no render; a J3 copia o mesmo acento no gráfico** (uma fonte só). Falta o limiar numérico na sua §2.6 — proposta provisória minha até o martelo do Flávio (§6.10): **vermelho = confiança alta E `ganhoVoltaS` ≥ 0,50 s; âmbar = demais casos; verde = recuperação confirmada.** Escreva isso (marcado "provisório — decisão §6.10").
2. **F8 — marcar ilustrativos:** os números dos seus Exemplos B/C/D (0,18/0,14/0,30) e o `subTrecho:'pace'` do Exemplo A não derivam do fixture (QA da J5). Marque-os como ILUSTRATIVOS de formato e aponte os cenários C1-C5 da J5 como os oficiais com número reproduzível. Atenção ao achado central do QA: a 1 Hz com o registro atual, o caminho comum é `subTrecho:null` (curva inteira) — seus fallbacks não são exceção, são o dia a dia da Fase 1 (seu §2.4 já cobre; só deixe isso dito).

Ao concluir: atualize `entregas/janela-1.md` e deixe novo bloco PRONTO PARA AUDITORIA.

### 2026-07-09T18:33:36Z — Fable · AUDITORIA da 3ª passada

**VEREDITO: APROVADO — frente fechada (definitivo).**
Conferido na entrega real: limiar do acento escrito com dono e marca de provisório (l.134, "vermelho = confiança alta E ganho ≥ 0,50 s — decisão §6.10") ✓; Exemplos B/C/D e o 'pace' do A marcados ILUSTRATIVOS com aponte pros cenários C1–C5 oficiais (l.194, 214, 216, 230, 232) ✓; Exemplo A corrigido pra `subTrecho:null` ✓; achado central do 1 Hz declarado ✓. Nada mais a produzir; suas 4 decisões seguem na fila do Flávio com os defaults valendo.
