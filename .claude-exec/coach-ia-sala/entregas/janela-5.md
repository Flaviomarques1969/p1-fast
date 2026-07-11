# Janela 5 — Cenários reais ponta a ponta + Auditoria de coerência (QA)

> Entrega viva da Janela 5 do Coach de IA de Stint. Eu NÃO projeto as primitivas — **uso, provo e estresso** o que J1–J4 produziram, com dado REAL do fixture (`web/command-box/fixtures/passagens-bubi-brasilia.v1.json`, Bubi 23-24/05, 56 passagens = 8 curvas × 7 voltas).
> **Todo número dos cenários saiu de script executado** (`scratchpad/analise-j5.mjs` e `scratchpad/prova-motor-bruxa.mjs`, rodados 2026-07-08). Onde um número é ilustrativo, está ESCRITO que é.
> Régua fiscalizada: preto `oklch(0% 0 0)` · sem-emoji · "você" · 956×440 · número-sem-sinal · ganho-em-segundos · só-dado-real · timing-seguro · painel-preservado.

---

## 0. TL;DR para o Fable (leia primeiro)

1. **O conjunto J1–J4 ENCAIXA.** Objeto v1 (J2) → mensagem por níveis (J1) → GraficoSpec (J3) → envelope 3 estados (J4): rodei 5 cenários ponta a ponta e nenhum campo falta, nenhum contrato se contradiz na forma. Todas as citações de código das 4 entregas que conferi batem (§4.1).
2. **QA extra 1 — o achado "7/8" da J3 está SUPERESTIMADO: o real é 4/8.** Verifiquei com método independente (distância mínima em METROS do ápice-semente a qualquer ponto das passagens da curva — a própria promessa do arquivo-semente, "nunca a mais de ~10 m da linha"). Divergem de verdade: **Bruxa 70 m · Placar 235 m · "S" 100 m · Vitória 82 m**. Casam: **Curva 01 (3,2 m) · Reta Oposta (2,5 m) · Junção (5,2 m) · Curva 2 (4,0 m)**. O método da J3 (comparar com o ponto-do-meio da passagem) mede "o ápice está no meio do segmento?", não "o ápice está na linha?". **A decisão prática da J3 continua CERTA** (ancorar zoom/bolinha em `tracos`/`apice`, não no semente) — 4 curvas divergem feio, inclusive as duas estrelas dos cenários. Detalhe no §2.
3. **Achado NOVO (o maior da auditoria): em 4/8 curvas a FREADA não está dentro do próprio segmento.** Perfil de velocidade real (§3): Bruxa e Vitória **começam** no ponto lento (Bruxa: 116→144 km/h, só aceleração; vmin no índice 0); Reta Oposta e Junção **terminam** nele; Placar (4 pts, 142→146) não tem ponto lento nenhum. Consequência dura: **a freada da Bruxa mora no FIM do segmento da Junção** — o sub `freio` da Bruxa é inatribuível com este registro, e o cenário-vitrine do briefing ("freada cedo recorrente na Curva da Bruxa") **não é produzível deste fixture**. Provável mesma causa-raiz da divergência do ápice-semente (registros de limites de trecho diferentes entre a base 27/05 e a 23-24/05). Investigação = J2/J4 + linhas reais do trecho-detector.
4. **Rodei o motor REAL na Bruxa** (`calcularDelta`, pior voadora 24/05 v3 vs melhor 23/05 v4): gap de relógio **0,485 s**, integração por sub explica só **0,025 s (5%)**. Confirma dramaticamente a regra da J2 ("relógio é a autoridade; integração só diz onde") **e** mostra que, a GPS 1 Hz com este registro, o caminho COMUM da Fase 1 é o fallback `subTrecho:null` (curva inteira) — os fallbacks que J1/J3 desenharam não são exceção, são o dia a dia.
5. **Números da J2 reproduzidos de forma independente, exatos:** out-laps 76,0/77,0 s ✓ · Curva "S" média 1,394 / quantil baixo 0,996 / 5-de-5 voltas ≥ 0,986 ✓. A eleição com dado real elege **Curva "S" (0,99 s)** e, atrás, **Bruxa (0,49 s)** — mais ninguém passa o piso.
6. **3 furos de especificação na J2** (fórmula da confiança ambígua; fallback que nunca pontua; p25 × mediana muda o destino de 2 curvas) e **2 desalinhamentos menores J1×J3 / J1×J4** — lista completa com dono no §4.

---

## 1. OS 5 CENÁRIOS PONTA A PONTA (dado real; objeto v1 J2 → gráfico J3 → mensagem J1 → timing)

> Formato de cada um: o objeto que a J2 emitiria → a `GraficoSpec` da J3 → a mensagem da J1 (níveis) → o envelope/timing da J4. Os cenários exercitam de propósito: fallback `subTrecho:null` (C1, C2), gate SF (C4), silêncio honesto (C5) — o QA extra 2 do Fable.

### C1 — A manchete real do stint: CURVA "S", ~1,0 s por volta, TODA volta
**Dado real:** ref 5,004 s · voadoras [5,99 · 6,00 · 7,00 · 6,00 · 7,00] → gaps [0,99 · 1,00 · 2,00 · 1,00 · 2,00] · hit 5/5 · p25 = **0,996 s** · média 1,394 s (contexto). 7 pts/passagem → nenhum sub com amostra confiável → **fallback §5.4 da J2: curva-pontual com `subTrecho:null`** (nota: o Exemplo A da J1/J2 usou `'pace'`; a 1 Hz o honesto é null — ver achado F8).
```js
oportunidade = { id:'v6-s-curva', geradaNaVolta:6, tipo:'curva-pontual', tecnica:null,
  tipoCurva:'T4', segmentId:'<segment_id real do "S" no fixture>', curvaNome:'CURVA "S"',
  subTrecho:null, ganhoVoltaS:0.99, ganhoStintS:4.75,            // 0,99 × 8 restantes × 0,6 adesão
  confianca:{ nivel:'alta', valor:0.85, origem:'derivada-J2' },
  reconciliacao:{ tempoTrechoAtualS:6.00, tempoTrechoRefS:5.004, gapMedidoS:0.996, deltaTotalIntegradoS:null, escala:1 },
  projecao:{ voltasRestantes:8, adesao:0.6, base:'projetada' },
  evidencia:{ voltasObservadas:[2,3,4,6,7], ocorrencias:[{curvaNome:'CURVA "S"', subTrecho:null, deltaS:0.996}], deltaMedioS:1.394 },
  referencia:{ tipoPneu:'radial-185-14', tempoTrechoS:5.004 }, apice:null, tracos:{ atual:[...], referencia:[...] } }
```
- **Gráfico (J3):** `camadas.destaqueSub:false` (sub null → realça a curva inteira, previsto em `janela-3.md §1.1`); duas linhas sobre o recorte do "S"; badge nenhum. Encaixa sem campo faltando.
- **Mensagem (J1, sub null → não nomeia sub — regra §2.4 dela):**
  - N1 (reta): `Curva "S" · 1,0 s`
  - N2 (fim de volta): `CURVA "S"` / `você deixa 1 segundo aqui, toda volta` / `─` / `carregue mais velocidade · 1,0 s`
  - N3 (box): recap com `ganhoStintS` ~5 s — como o N3 do Exemplo A da J1.
- **Timing:** análise fecha no `fim-de-volta` (`geradaNaVolta:6`) → N2 na reta principal; some antes do `entrada-cruzou` da Curva 01. Crítico vence.
- **Veredito de encaixe: PASSA.** Todos os campos que J1/J3/J4 leem existem no objeto v1; nenhum inventado.

### C2 — Bruxa, 0,49 s — e o MOTOR REAL rodado (o caminho honesto da Fase 1)
**Dado real:** ref 9,999 s (23/05 v4) · atual 10,484 s (24/05 v3, voadora) · gap relógio **0,485 s** · p25 do stint 0,485 · hit 4/5. **Motor real (`calcularDelta`) executado:** `deltaTotalS = 0,025 s` · `piorSubTrecho:'pace'` (0,030 s) — a integração explica **5%** do gap. Pela regra da própria J2 (§3.3: divergência integrado×medido >30% → rebaixa confiança), o "onde-fino" cai e o resultado honesto é de novo **`subTrecho:null`**: "você perde meio segundo NESTA CURVA", sem apontar freio/saída.
- **Mensagem (J1):** N1 `Curva da Bruxa · 0,5 s` · N2 `CURVA DA BRUXA` / `você deixa meio segundo aqui` / `─` / `carregue mais · 0,5 s`.
- **Gráfico (J3):** zoom no traço real da Bruxa (o bbox que a própria J3 provou no `prova-zoom.mjs`), curva inteira realçada, sem banda de sub, sem fita de freio.
- **O anti-cenário (QA):** a versão "você freia cedo na Bruxa" (mockup B da J3, Exemplo B da J1) **não sai deste dado**: os 11-14 pontos da Bruxa começam a 116-119 km/h SUBINDO — não há freada no segmento (§3). Enquanto o registro de limites for este, mensagem de freio na Bruxa seria **inventada** — violaria "só dado real".
- **Veredito de encaixe: PASSA** (no caminho curva-inteira). O caminho sub `freio` fica CONDICIONADO ao achado F4.

### C3 — Técnica recorrente (freio em ≥3 curvas) — formato completo, números ILUSTRATIVOS
O formato ponta a ponta é o do Exemplo B da J1 + mockup B da J3 (herói = pior ocorrência; badge `× 3 curvas`; `evidencia.ocorrencias` com as 3). O encaixe de campos **fecha** (tipo/tecnica/ocorrencias/badge/verbo v3 `freia-depois`).
**Mas registro como QA:** o ganho (0,18 s) e a própria recorrência de `freio` **não são computáveis deste fixture** — recorrência por sub exige o anotador ao vivo (`live-data-bridge` + marcos do detector) ou 25 Hz, e 4/8 segmentos nem contêm a própria freada (F4). Consequência prática para a J4: **o replay de teste da Fase 1 precisa incluir o anotador de sub** (hoje o plano dela alimenta o acumulador com `DeltaResultado`, o que pressupõe pontos já anotados — de onde vem a anotação no replay precisa estar explícito no plano de teste).
- **Veredito de encaixe: PASSA na forma; irrealizável no dado atual** (fica como cenário de contrato, não de demonstração).

### C4 — CURVA DA VITÓRIA (SF): o gate na prática + a decisão que muda o destino dela
**Dado real:** ref 3,996 s · gaps voadoras [0,004 · 1,004 · 1,004 · 0,004 · 1,004] — **bimodal** (ou anda no ritmo, ou deixa 1 s) · mediana 1,004 s (a "~1,0 s" que a J2 citou ✓) · **p25 = 0,004 s** · 5-6 pts/passagem · perfil 88→101 km/h (velocidades mais baixas da volta inteira).
- **Com a regra escrita da J2 (`ganhoVoltaS` = quantil BAIXO):** 0,004 < piso 0,10 → **não elege → silêncio**. É o comportamento de hoje, e este cenário então vira o C5.
- **Se a calibração escolher mediana para o fallback:** oportunidade curva-pontual de **1,0 s**, `subTrecho:null`, confiança média (consistência 3/5). E aqui o **gate SF trabalha de verdade**: o trecho tem as menores velocidades da pista e uma queda de 31 km/h vindo do "S" — o motor atribuiria perda a "freio" com facilidade, e o gate (que roda ANTES do argmax, no determinístico — J2 §6.2.1) **bloqueia qualquer verbo de freada**, sobrando linha/Vmin: N2 = `CURVA DA VITÓRIA` / `você perde 1 segundo aqui` / `─` / `carregue mais · 1,0 s`. **Freio NUNCA é apontado na Vitória** — conferi que J1 (Exemplo D), J2 (gate) e J3 (`tipoCurva SF → sem fita de freio`) dizem a mesma coisa. ✓
- **A escolha p25×mediana é o achado F3** — muda a Vitória (e o Placar) de "coach" para "silêncio". Calibração → Flávio.

### C5 — Silêncio honesto no início do stint (o caminho de TODO começo)
**Dado real:** a 1ª volta do dia é out-lap detectável pela regra da J2 — soma dos trechos 76,0 s (23/05) / 77,0 s (24/05) vs mediana 71,0 s → >5% → descartada ✓ (os números que a J2 citou, reproduzidos).
Voltas voadoras observadas: 2 → nenhum candidato com 3 ocorrências → J2 devolve `null` + `status:{estado:'coletando-dados', voltasObservadas:2, motivo:'2 voltas — junto mais dado antes de apontar'}`.
- **Envelope (J4):** `coach = { versao:1, tipo:'silencio', status:{...} }` — NÃO entra em `_pendentes` (onda viva). ✓
- **Mensagem (J1 §2.5):** linha única `Juntando dado — 2 voltas` (cinza) ou cartão ausente. ✓
- **Gráfico (J3 §7.4):** modo degradado (pista apagada + estado), sem linha inventada. ✓
- **Veredito de encaixe: PASSA** — os três renders leem o MESMO ramo e nenhum fabrica cartão. O silêncio não tem cara de defeito.

---

## 2. QA EXTRA 1 — verificação independente do achado da J3 (ápice-semente × fixture)

**Método próprio** (diferente do da J3): distância **mínima em metros** (fórmula equiretangular do próprio produto) do ápice-semente de cada curva a **qualquer** ponto de **qualquer** passagem daquela curva no fixture + contraprova de rótulo (qual curva do fixture tem o ponto globalmente mais próximo daquele semente). Régua física: o cabeçalho do próprio `apices-semente-brasilia.js` promete "ápice nunca está a mais de ~10 m da linha". A 1 Hz o espaçamento entre amostras é ~11-22 m, então distância-mínima pode superestimar em até ~11 m — tudo acima de ~25 m é divergência real.

| Curva | minDist (m) | (px) | Veredito | Contraprova de rótulo |
|---|---|---|---|---|
| CURVA 01 | **3,2** | 2 | **CASA** | mais próximo global = ela mesma |
| CURVA DA RETA OPOSTA | **2,5** | 1 | **CASA** | (ponto de VITÓRIA passa a 0,7 m — trechos se avizinham) |
| CURVA 2 | **4,0** | 2 | **CASA** | ela mesma |
| CURVA DA JUNÇÃO | **5,2** | 3 | **CASA** | ela mesma |
| CURVA DA BRUXA | **70,4** | 41 | **DIVERGE** | ela mesma (70 m é o mais perto que existe) |
| CURVA DO PLACAR | **235,0** | 138 | **DIVERGE** | mais próximo global = BRUXA, a 166 m — o semente do Placar está longe de TUDO |
| CURVA "S" | **99,9** | 59 | **DIVERGE** | ela mesma |
| CURVA DA VITÓRIA | **82,4** | 49 | **DIVERGE** | ela mesma |

**Veredito sobre o achado da J3: CONFIRMO PARCIALMENTE / REFUTO O "7/8".**
- **Real: 4/8 divergem** — e feio (70-235 m ≫ ruído de GPS e ≫ espaçamento de amostra). Não é deslocamento de rótulo (a contraprova não acha curva vizinha casando melhor).
- **7/8 era artefato do método:** a J3 comparou o ápice com o **ponto-do-meio** da lista de pontos da passagem. Como os limites de segmento estão tortos (§3), o ápice físico não fica no meio temporal do segmento — Curva 01/Reta Oposta/Junção têm o semente EM CIMA da linha (1-3 px), mas longe do "meio".
- **A consequência prática da J3 fica DE PÉ e eu a endosso:** ancorar zoom e bolinha em `oportunidade.tracos`/`oportunidade.apice`, nunca no semente — porque 4 curvas divergem de verdade, incluindo Bruxa e "S" (os dois cenários-estrela).
- **Correção a fazer:** o registro de correções do projeto guarda o "7/8" como fato — atualizei com esta medição (entrada de 2026-07-08 da J5).

## 3. O ACHADO NOVO — limites de segmento × freada (perfil de velocidade real, volta 23/05 v4)

| Curva | Perfil kmh (1ª→última amostra) | Vmin está | Leitura |
|---|---|---|---|
| CURVA 01 | 157…149…**113**…114 | no meio | segmento bem formado (freada dentro) |
| RETA OPOSTA | 127…139…129…**94** | na ÚLTIMA | freada no fim — sub `saida` impossível |
| CURVA 2 | 149…158…**100**…127 | no meio | bem formado |
| JUNÇÃO | 128…144…**98** | na ÚLTIMA | freada no fim (é a freada da BRUXA?) |
| BRUXA | **116**…144 | na PRIMEIRA | SÓ aceleração — sem freada no segmento |
| PLACAR | **142**…146 | na primeira | 4 pts, tudo rápido — sem ponto lento |
| CURVA "S" | 101…**100**…119 | quase início | entra já devagar — freada antes do segmento |
| VITÓRIA | **88**…101 | na PRIMEIRA | só aceleração; menores velocidades da pista |

**Consequências (para o Fable despachar):**
1. Com este registro, `porSubTrecho.freio/entrada` das 4 curvas tortas não corresponde à freada física da curva nomeada. Lição de freio nessas curvas = inatribuível (a Fase 1 cai no honesto `subTrecho:null`, que J1/J3 já cobrem — o sistema NÃO quebra, ele silencia o "onde-fino").
2. **Hipótese de causa-raiz comum** com o §2: os limites de trecho da base do fixture (23-24/05) não são os mesmos do registro que gerou o semente (27/05 canônicas). Quem confere: J2/J4 contra as linhas reais do `trecho-detector` (se as linhas ao vivo forem as boas, o problema é só do fixture e o replay de teste precisa disso mapeado; se forem as mesmas do fixture, os 4 marcos da Bruxa/Vitória nunca disparam `freada-iniciou` dentro do trecho — e aí é defeito de registro no produto).
3. O cenário-exemplo do próprio briefing ("freada cedo recorrente na Curva da Bruxa custando 0,12 s/volta") é **impossível neste dado** — sugiro o Fable promover o C1 (Curva "S", 1,0 s, curva inteira) a cenário-vitrine oficial.

## 4. RELATÓRIO DE COERÊNCIA J1–J4 (o que encaixa, o que fura, com dono)

### 4.1 O que CONFERI e BATE (prova por citação)
- **Citações de código das 4 entregas — todas que chequei batem:** `cerebro-painel.js:167` (`const coach = null;` + l.175 no pacote) · `cerebro-coach.js` v0 funcional (`avaliarCoach` l.86, TOL 0,15 l.24, `perdaKmh`) · `cockpit.css:54` (956×440) e `:466-468` (delta desliza −230 px com `data-msg-state="ativa"`) · modo crítico esconde info-bloco/brake-result/ultima-volta/apex (HTML) · `ultima-volta` em `left:690px; top:40%` (as medidas da J3 têm base real) · `PONTOS_DESENHO` = 495 · `pista-cb-polyline.js` viewBox `130 110 580 660` ≠ espaço 823×799 (caveat da J3 correto) · `tipos-curva-brasilia.js` VITÓRIA=SF + `semFreadaPorTipo` · `stint-plan.js` `nVoltasAlvo` obrigatório · `DeltaCoach.cs:31` `TempoAtualS = null` · `CockpitStateModel.cs` sem campo Coach (grep vazio ✓ afirmação da J4) · `CockpitOrchestrator.cs` `FecharTrecho`/`DeltaCalculator.Calcular:361`/`MensagensPedagogicas.Decidir:367` · `oportunidade-trecho.js` verbos v3 + metros com sinal `+/−` (l.182 — a ressalva da J1 é real) · **`tipos-curva-texto.js` EXISTE** (`web/cockpit/`) — a J1 não inventou o arquivo.
- **§2.5 do PLANO-MESTRE cumprido por todos:** nenhuma entrega trata `cerebro-coach.js` como vazio; J4 caminho A preserva a v0; J1/J2/J3 declaram não tocá-la. ✓
- **Régua dura nas 4 entregas:** sem emoji, "você", ganho em segundos, número sem sinal (J1 por palavra+cor; J3 por posição+cor; J2 clamp na fronteira), crítico-vence em J1/J3/J4. ✓
- **Números da J2 reproduzidos por mim, de forma independente:** out-laps 76,0/77,0 s · "S" média 1,394 / p25 0,996 / 5-de-5. ✓ (O método dela sobreviveu à tentativa de refutação.)

### 4.2 ACHADOS (F1-F8, mais grave primeiro, com dono)
| # | Dono | Gravidade | Achado |
|---|---|---|---|
| **F1** | **DADO (J2/J4 investigam)** | ALTA | Limites de segmento tortos em 4/8 curvas (§3): freada fora do próprio trecho → sub `freio/entrada/saida` inatribuível nessas curvas; cenário-vitrine do briefing não é produzível. Conferir contra as linhas reais do trecho-detector. |
| **F2** | **J2** | ALTA | `fAmostras` ambígua: os dois exemplos do §4.3 dela usam janelas diferentes — "S" só dá `fAmostras=1` contando amostras AGREGADAS no stint; Placar só dá `fAmostras=0` contando POR VOLTA. Do jeito escrito, ou a manchete "S" nunca elege, ou o Placar elege. Precisa fixar a janela de contagem. |
| **F3** | **J2 (calibração → Flávio)** | ALTA | Fallback §5.4: (a) se a confiança do fallback usa `fAmostras` por sub = 0, `score = ganho × 0` e o fallback NUNCA elege — precisa de régua própria (ex.: amostras da curva inteira); (b) `ganhoVoltaS` do fallback: **p25 vs mediana muda o destino real de 2/8 curvas** (Vitória e Placar: gaps bimodais 0/1 s → p25 0,004 = silêncio; mediana 1,0 = oportunidade). Hoje §3.5 diz "p25"; §5.4 diz "gapMedido" sem agregador. |
| **F4** | **J3** | MÉDIA | Achado "ápice-semente 7/8" refutado em parte: real = **4/8** (§2). O método ponto-do-meio mede outra coisa. Corrigir o §5 dela e o registro de correções (feito por mim). A decisão de ancoragem fica de pé. |
| **F5** | **J4** | MÉDIA | Plano de teste da Fase 1 pressupõe `DeltaResultado` já anotado, mas no replay ninguém anota `fracao`/`sub` dos pontos do fixture (o anotador vivo é o `live-data-bridge`, que não roda no replay do acumulador). Explicitar QUEM anota no teste — sem isso o teste de paridade não fecha. |
| **F6** | **J1×J4** | BAIXA | Faseamento divergente: J1 diz `fim-de-volta → N2` (3 linhas); a Fase 1 da J4 só embarca N1 ("mensagem nível 1", com portão fim-de-volta). Reconciliar: ou a Fase 1 mostra N1 no fim da volta (e a tabela da J1 vale da Fase 2 em diante), ou o N2 entra na Fase 1. |
| **F7** | **J1×J3 (→ decisão §6.3 do Flávio)** | BAIXA | Acento divergente no MESMO cenário: mockup B da J3 = vermelho; regra da J1 (§2.6) = vermelho só p/ "perda grande e recorrente" — 0,18 s é "grande"? Falta o limiar numérico de cor, e quem o computa (J1 no render; J3 copia). |
| **F8** | **J1/J2 (nota)** | BAIXA | Números dos Exemplos B/C/D da J1 (0,18/0,14/0,30) e o `subTrecho:'pace'` do Exemplo A não derivam do fixture (D: o real é 0,004 ou 1,004, F3). São exemplos, não medição — mas ninguém deve tratá-los como dado. Os cenários C1-C5 daqui substituem com números reproduzíveis. |

### 4.3 Reproduzir minhas provas
```
cd "/Users/imac/Projetos/P1 Fast"
node .claude-exec/coach-ia-sala/provas-j5/analise-j5.mjs        # gaps/eleição/out-laps + QA-1 do ápice (tabela §2)
node .claude-exec/coach-ia-sala/provas-j5/prova-motor-bruxa.mjs # motor real na Bruxa: gap 0,485 vs integrado 0,025
```
(Scripts + saídas salvos em `coach-ia-sala/provas-j5/` — `RESULTADO-*.txt` são as execuções de 2026-07-08. A anotação de `sub` do segundo script é aproximação offline DECLARADA — ao vivo quem anota é o `live-data-bridge` com os marcos do detector.)

## 5. Autoconferência da régua (J5)
preto (doc; cenários herdam tokens da J3) · sem-emoji · "você" (todas as mensagens dos cenários) · 956×440 (cenários usam o cartão medido da J3; nada movido) · número-sem-sinal (nenhum cenário exibe sinal; direção por palavra/cor) · **só-dado-real** (todo número de cenário saiu de script executado; ilustrativos estão marcados; C3 declarado irrealizável no dado atual) · ganho-em-segundos (nenhum km/h como métrica final) · timing-seguro (todos os cenários no portão da J1; freio jamais apontado na Vitória) · painel-preservado (nenhuma proposta minha toca o painel).

## 6. Fronteiras respeitadas
Não projetei primitiva nenhuma: os cenários usam o objeto v1 da J2, o GraficoSpec da J3, os níveis da J1 e o envelope da J4 exatamente como publicados. Achado vai para o FABLE (este relatório + `para-fable.md`), não direto para as janelas.

_Fim da entrega da Janela 5._
