# Janela 2 — Inteligência que elege a MAIOR oportunidade de ganho (em segundos)

> Entrega viva da Janela 2 do Coach de IA de Stint. Dona do **OBJETO OPORTUNIDADE** (J1/J3/J5 consomem).
> Tudo conferido no código/dados REAIS (2026-07-08). Onde algo não existe, está escrito "não existe / precisa vir de X" — não inventei.
> Régua: preto · sem-emoji · "você" · 956×440 · número-sem-sinal · só-dado-real · ganho-em-segundos · painel-preservado.

> **v1.1 (2026-07-08, pós-QA da J5 / CORRIGIR do Fable):** fechados 3 acertos de especificação — janela de contagem da confiança fixada em **agregada no stint** (F2, §4.3); **fallback de curva inteira ganhou régua própria** para poder pontuar (F3a, §5.4); números não vindos do fixture marcados como **ilustrativos** (F8). Acrescentada a investigação conjunta J2/J4 dos limites de segmento (F1, §7.2). **O método central não mudou** — o QA da J5 reproduziu os números exatos (out-laps 76,0/77,0 s; Curva "S" quantil-baixo 0,996 s, 5/5 voltas).

> **Nota sobre números (F8):** os valores tirados do fixture real estão marcados **[fixture]**; os que ilustram a mecânica (ex.: um `deltaTotalS` integrado hipotético) estão marcados **[ilustrativo]**. Os cenários oficiais com número reproduzível são os **C1–C5 da J5** (`entregas/janela-5.md`).

---

## 0. TL;DR para as outras janelas (leia isto primeiro)

- **A oportunidade é UMA por volta.** Não é lista do que está ruim; é o ÚNICO ponto que mais paga agora, em **segundos**.
- **O número honesto do ganho** nasce do **relógio** (`tempo_trecho_s` medido entre a linha de entrada e a de saída), NÃO da integração ponto a ponto. A integração (`porSubTrecho`) só diz **ONDE** dentro da curva se perde — nunca **quanto** por cima do medido.
- **O filtro de ruído mais forte é o STINT, não a volta.** GPS ~1 Hz dá ~1–2 amostras por sub-trecho por volta: isso é indistinguível de ruído. O que separa sinal de ruído é a **repetição volta-a-volta**. Achado real do fixture (§4): a maior perda de UMA volta é a *out-lap* (pneu frio, +3,0 s) — armadilha; a oportunidade REAL é a **Curva "S", que perde ~1 s em TODAS as 5 voltas de corrida**.
- **O objeto vai no §1.** J1 (mensagem) lê `subTrecho`, `tipo`, `tecnica`, `ganhoVoltaS`, `confianca`, `evidencia`. J3 (gráfico) lê `segmentId`, `tracos`, `apice`. J5 (cenários) lê tudo.
- **Fronteira:** eu NÃO escrevo a mensagem (J1) nem desenho o gráfico (J3). Entrego o **dado** que os dois consomem.

---

## 1. O OBJETO OPORTUNIDADE — v1 (contrato que J1/J3/J5 consomem)

Confirmo o v0 do Fable (PLANO-MESTRE §2.1) e proponho **acréscimos** (marcados `[+J2]`) que os fiscais do próprio painel provaram necessários para o objeto ser **auditável numa passada** e **honesto**. Nada dos itens travados pelo Fable muda (ganho em segundos; número positivo sem sinal; `segmentId` = UUID do motor; `subTrecho` nos 5 nomes literais; `curvaNome` da lista oficial das 8). Os acréscimos ficam para o **Fable arbitrar** — não os imponho.

```js
// avaliarOportunidade(estadoDoStint) -> Oportunidade | null
// null = nenhuma oportunidade passou os portões nesta volta (ver `status`, abaixo).

oportunidade = {
  id,             // string única no stint (ex. "v12-s-linha")
  geradaNaVolta,  // número da volta que fechou a análise
  tipo,           // 'tecnica-recorrente' | 'curva-pontual' | 'outro'
  tecnica,        // string quando faz sentido (ex. 'freia-depois'); senão null. Ver §6.3.
  tipoCurva,      // [+J2] 'T0'|'T1'|'T2'|'T4'|'T5'|'SF' — do tipos-curva-brasilia.js. Necessário p/ o gate SF e p/ a lição.
  segmentId,      // UUID do trecho ALVO do zoom. Recorrente: o da pior ocorrência (curva "herói"); pontual: a própria.
  curvaNome,      // nome oficial (lista _meta.ordemCurvas). Recorrente: o da pior ocorrência.
  subTrecho,      // 'entrada'|'freio'|'apice'|'pace'|'saida' — OU null quando é ganho de curva inteira (fallback §5.4)

  ganhoVoltaS,    // ganho estimado POR VOLTA, em SEGUNDOS, SEMPRE POSITIVO (>= piso). Método no §3.
  ganhoStintS,    // projeção no resto do stint, em s (ou null). Método no §3.5.

  confianca,      // { nivel:'baixa'|'media'|'alta', valor:0..1, origem:'derivada-J2' }  // [+J2 origem]

  reconciliacao,  // [+J2] { tempoTrechoAtualS, tempoTrechoRefS, gapMedidoS, deltaTotalIntegradoS, escala }
                  //       deixa o Fable conferir num relance: ganhoVoltaS <= gapMedidoS. Ver §3.3.
  projecao,       // [+J2] { voltasRestantes, adesao, base:'projetada'|'retrospectiva' } — audita o ganhoStintS. Ver §3.5.

  evidencia,      // { voltasObservadas:[n...], ocorrencias:[{segmentId,curvaNome,subTrecho,deltaS}...], deltaMedioS }
                  //   Recorrente: ocorrencias lista as >=3 curvas atingidas. deltaS aqui é INTERNO (pode ser negativo);
                  //   NUNCA vai cru pra tela — a tela recebe só ganhoVoltaS (positivo). Ver §5.7.
  referencia,     // { tipoPneu, tempoTrechoS } — a melhor histórica usada (pneu separa histórico).
  apice,          // [+J2] { distFromIdealM, angleFromIdealDeg } | null — a "bolinha" do trecho-detector,
                  //       carregada quando subTrecho='apice' pra a correção não ficar órfã. Ver §6.3.
  tracos          // { atual:[{lat,lng,kmh,t,fracao,sub}], referencia:[...] } | null — matéria-prima do gráfico (J3).
}
```

Companheiro do objeto (o "silêncio honesto" que hoje não existe no v0 — item do crítico):

```js
status = {  // [+J2] devolvido junto quando a eleição retorna null
  estado,          // 'coletando-dados' | 'no-teto' | 'sem-referencia' | 'stint-curto'
  voltasObservadas,// quantas voltas voadoras já entraram
  motivo,          // texto curto, honesto ("2 voltas — junto mais dado antes de apontar")
}
```
Sem esse `status`, o `.exe` mostraria silêncio parecendo bug. J4 decide **onde** ele entra no pacote `coach`.

### 1.1 Mudanças em relação ao v0 do Fable (para o Fable arbitrar)
| Campo | v0 | v1 (J2) | Por quê |
|---|---|---|---|
| `subTrecho` | 5 nomes | 5 nomes **ou `null`** | fallback de curva curta (§5.4) aponta a curva sem nomear o sub (poucas amostras → não dá pra confiar no "onde") |
| `tipoCurva` | — | `[+J2]` | o gate SF (Vitória) e a lição precisam do tipo; vem de `tipos-curva-brasilia.js`, não do motor |
| `confianca.origem` | — | `'derivada-J2'` | o motor **não** emite confiança; carimbar a origem evita a tela tratar como medição |
| `reconciliacao` | — | `[+J2]` | prova, num relance, que `ganhoVoltaS <= gapMedidoS` (anti-super-estimativa) |
| `projecao` | — | `[+J2]` | torna o `ganhoStintS` auditável (projeção vs tempo já perdido) |
| `apice` | — | `[+J2]` | carrega a "bolinha" quando o alvo é ápice, senão a correção fica órfã |
| `status` (companheiro) | — | `[+J2]` | o v0 não tinha estado "sem oportunidade" — o `.exe` precisa de silêncio honesto |

Tudo mais do v0 fica **idêntico**.

---

## 2. De onde vem cada dado (o que é do motor, o que EU derivo)

Regra de ouro que os fiscais cobraram: **separar o que o motor emite do que J2 deriva** — para ninguém tratar número derivado como medição.

| Dado | Fonte REAL | Observação |
|---|---|---|
| `deltaS, distM, amostras` por sub | `calcularDelta` (`delta-calculator.js` l.168-174) | uma curva por chamada |
| `deltaTotalS, piorSubTrecho, piorDeltaS` | idem | `deltaTotalS` = **soma sinalizada** dos 5 subs (l.157) |
| `tempo_trecho_s` (medido) | passagem / `melhores_passagens_trecho` (migração 0026) | **relógio** — a autoridade do ganho |
| `tempo_trecho_s` da volta **atual** | do coletor da passagem | **o `calcularDelta` do JS NÃO retorna** (só o record C# tem `TempoAtualS`, default null). Proposta §7.1 |
| `segmentId → curvaNome / tipoCurva` | `_meta.ordemCurvas` + `tipos-curva-brasilia.js` | mapas **externos** ao motor; precisam ser embarcados no `.exe` |
| `apice.distFromIdealM / angleFromIdealDeg` | evento `apice-cruzou` do `trecho-detector.js` (l.304-310) | a "bolinha" |
| `voltasRestantes` | `StintPlan.nVoltasAlvo` (`src/domain/stint-plan.js` l.57-69) − voltas rodadas | **fonte real** — `nVoltasAlvo` é obrigatório antes de cada stint. Sem plano → projeção null |
| `confianca, ocorrencias[], voltasObservadas, deltaMedioS, reconciliacao, projecao` | **reducer da J2** (novo) | derivados; `origem:'derivada-J2'` |
| `tracos` | passagens (atual + referência) | costurado fora do `calcularDelta` |

`marcha` foi **removida** do universo de "outro": os pontos crus são só `{lat,lng,kmh,t}` — **não há canal de marcha/RPM na passagem**. Afirmar "marcha errada" seria inventar (item do crítico). Fica registrada como **não-detectável com os sensores atuais**.

---

## 3. MÉTODO DO GANHO EM SEGUNDOS (o coração honesto)

Derivado de forma independente por dois braços do painel — **convergiram no mesmo método**. Passo a passo:

### 3.1 Verdade = relógio, não integração
Por curva e por volta: **`gapMedidoVolta = tempo_trecho_s(atual) − tempo_trecho_s(melhor histórica)`**. A melhor histórica vem de `melhores_passagens_trecho` na chave `(carro_id, track_id, tipo_pneu, segment_id)` — **pneu separa o histórico**. Esse gap é o **TETO honesto** do que dá pra ganhar naquela curva naquela volta.

### 3.2 Integração só diz ONDE (não quanto)
`calcularDelta` distribui a perda dentro da curva em `porSubTrecho[sub].deltaS`. Serve para achar o sub campeão — **nunca** para somar por cima do gap medido.

### 3.3 Escalar ao teto (anti-super-estimativa) — vai no campo `reconciliacao`
```
escala        = min(1, gapMedidoVolta / max(ε, deltaTotalIntegradoS))
ganhoSubVolta = deltaS_sub × escala           // garante  Σ_sub  <=  gapMedidoVolta
```
Se `gapMedidoVolta <= 0` (a curva foi igual/melhor que a referência) → contribui **0**, sem oportunidade. Se a divergência integrado-vs-medido for grande (>~30%), **rebaixa a confiança** (sinal de casamento de fração ruim, não de oportunidade).

### 3.4 A DUPLA CONTAGEM que este método mata
Os fiscais confirmaram dois modos de contar o mesmo tempo duas vezes — os dois estão fechados:
- **Curva × sub:** somar `gapMedido` (curva) **+** `deltaS` do sub como se fossem ganhos separados. São o **mesmo tempo** (o sub é pedaço da curva). Exemplo real: Curva "S", volta 23/05 v3, `gapMedido = 6,000 − 5,004 = 0,996 s`. Somar `0,996 + ~0,60` daria 1,60 s — **+60% acima do que a curva perdeu**. Trava: `ganhoVoltaS <= gapMedido`, sempre.
- **Recorrente × pontual:** o mesmo `deltaS` entrar numa oportunidade pontual E na recorrente. Trava: **dedup por `(segmentId, sub, volta)`** — cada `deltaS` entra em UM agregado só. Como a saída é UMA oportunidade, nunca se soma as duas.

### 3.5 `ganhoVoltaS` e `ganhoStintS`
- **`ganhoVoltaS` = quantil BAIXO** (p25 ou mínimo) dos gaps por volta do candidato eleito — **não a média**. A média infla com voltas ruins. (Fixture, Curva "S": média dos gaps = 1,394 s por causa de 2 voltas de ~2 s; o ganho honesto recuperável **toda volta** é o quantil baixo ~0,99 s.) A média fica em `evidencia.deltaMedioS`, como contexto.
- **`ganhoStintS = ganhoVoltaS × voltasRestantes × adesao`**, com `adesao ∈ (0,1)` (default conservador **0,5–0,6**, calibrável) — porque a melhor histórica é um teto que ninguém repete em toda volta. Multiplicar por adesão=1 super-estima. Exemplo real: Curva "S", `0,99 × 8 voltas × 0,6 = 4,75 s` (**não** `0,99 × 8 = 7,92 s`).
- **`ganhoStintS = null` quando:** `voltasRestantes<=0` (última volta / stint desconhecido); menos de 3 voltas voadoras com a ocorrência; `ganhoVoltaS` abaixo do piso; ou barrado por gate. **Melhor null do que número inventado.**
- **`voltasRestantes` NÃO muda a eleição** (é escalar comum a todos os candidatos) — só o número exibido. Por isso não entra no critério de escolha, só na projeção.

### 3.6 Todo número que sai é POSITIVO
`ganhoVoltaS`, `ganhoStintS`, `deltaMedioS` exibidos = `max(0, valor)`. Se o quantil do eleito for `<= piso` ou negativo → **não emite oportunidade** (retorna `null` + `status`). `deltaS` cru (que pode ser negativo, l.145) fica **interno**; a cor dá a direção na tela, o número nunca leva sinal.

---

## 4. SINAL vs RUÍDO + CONFIANÇA (GPS ~1 Hz)

### 4.1 O físico
No fixture real, uma passagem tem **mediana ~8 pontos** (mín. 4). Isso é ~1–2 amostras por sub por volta. O erro de tempo por par a ~1 Hz é da ordem do próprio piso (~0,05 s). **Conclusão dura: um sub de uma volta com 1 amostra é indistinguível de ruído. A separação real vem do STINT** (a média entre voltas reduz o ruído ~1/√ocorrências — 5–7 voltas ≈ 2,5×).

### 4.2 Dois pisos (não um só)
- **0,05 s** = piso de **medição** por sub por volta (é o `SubTrechoMinS` do motor). Abaixo disso, a amostra não conta.
- **0,10 s** = piso de **ELEIÇÃO/anúncio** no `deltaMedioS`/`ganhoVoltaS` agregado (alinhado ao `RecordeGanhoMinS=0.10`). O `0,05` do coach de hoje é o limiar de *dizer* uma frase fugaz; **eleger** a oportunidade do stint pede o piso maior — 0,05 está dentro do jitter do GPS.

### 4.3 Fórmula da confiança (derivada por J2; `origem:'derivada-J2'`)

**Janela de contagem — FIXA e única (correção F2):** `fAmostras` conta as amostras **AGREGADAS no stint** para a unidade que está sendo eleita — não amostras de uma volta só. Isso é coerente com o §4.1 (a separação de ruído vem do stint, não da volta) e vale igual nos dois exemplos abaixo.
- Candidato de **sub**: `nAmostras = Σ (voltas voadoras onde o (segmentId,sub) ocorreu) porSubTrecho[sub].amostras`.
- Candidato de **curva inteira** (fallback §5.4): `nAmostras = Σ (voltas voadoras) pontos da CURVA` (régua própria — ver §5.4).

```
valor = clip( fAmostras × fConsistencia × fMagnitude , 0, 1 )   // gates aplicados depois, como teto
  fAmostras     = clip((nAmostras − 2)/6, 0, 1)   // AGREGADO no stint: <=2→0 ; ~8→1 (satura)
                  guard duro: distM médio < 8 m OU nAmostras < 2 → descarta (sem suporte)
  fConsistencia = hitRate × clip(1 − CV, 0, 1)      // FATOR DE MAIOR PESO conceitual
                  hitRate = nOcorrencias / voltasObservadas ; CV = desvio(deltaS)/deltaMedioS
  fMagnitude    = clip((deltaMedioS − 0.10)/0.10, 0, 1)   // 0.10→0, 0.15→0.5, >=0.20→1
nivel: valor>=0.66 alta ; 0.33–0.66 media ; <0.33 baixa
```
`fConsistencia` pesa mais de propósito: **repetir volta-a-volta é a prova de que não é ruído.**

**Os dois exemplos, agora com a MESMA régua (agregado no stint) — [fixture]:**
- **Curva "S", caminho real da Fase 1 (curva inteira, `subTrecho:null`):** 5 voltas voadoras × ~7,4 pontos = **37 pontos agregados** → `fAmostras=1,0`; aparece em 5/5 voltas, gaps apertados (0,986–1,997, quantil-baixo 0,996) → `fConsistencia≈1`; `deltaMedioS` (quantil-baixo) 0,996 → `fMagnitude=1`; teto prudente do 1 Hz → **valor ≈ 0,9 → ALTA**. **Elege.**
- **Curva do Placar, tentativa de SUB (freio):** ~0,9 ponto/sub/volta × ~5 voltas ≈ **4–5 amostras agregadas no sub** → `fAmostras≈0,4`; mesmo com magnitude grande (~1,0 s), `valor` cai para média-baixa → **NÃO elege no nível de SUB** (não dá pra confiar no "onde"). Cai no **fallback de curva inteira** (§5.4), que aí conta os 23 pontos da curva agregados → `fAmostras=1` e a decisão p25×mediana (F3b, §8) define se vira coach ou silêncio.

Ou seja: a mesma régua explica por que a "S" **elege** (37 pontos de suporte na curva) e por que o Placar **não elege no sub** (4–5 amostras) mas **pode** eleger no nível de curva.

### 4.4 Gates de domínio (aplicados como teto DEPOIS da fórmula)
- **SF — Curva da Vitória** (`semFreadaPorTipo('SF')=true`): pé embaixo, **sem freada**. Oportunidade de **freio** ali → **DESCARTADA** (qualquer "Freou Cedo/Tarde" é artefato). Oportunidade de **entrada** → suspeita (`valor ×0.3`). A perda medida na Vitória é real (~1,0 s de mediana no fixture), mas só pode virar **linha/Vmin/pace**, nunca freio. **O gate roda no prior determinístico, ANTES do argmax** — não pode ficar a cargo de um LLM (§6.2).
- **`pace`** = **proxy por velocidade** (`delta-calculator.js` l.53-56; não há sensor de acelerador casado por tempo): teto de confiança **`media`** e **sem frase** (cai em `null` no `DeltaCoach.cs`, confirmado). O ganho em segundos ainda vale; a entrega é sem verbo pedagógico duro.
- **`apice`** = corrige pela **BOLINHA visual** (`distFromIdealM/angleFromIdealDeg`), **sem frase de 2 palavras** (spec v2). Se o ápice for o alvo, o objeto carrega `apice:{...}` (§6.3), senão a correção fica órfã.

### 4.5 Armadilhas de runtime que os fiscais/crítico acharam (e a regra para cada)
- **Out-lap ao vivo:** no fixture dá pra ver "volta 1 de cada dia" (76,0 e 77,0 s), mas **ao vivo não há rótulo**. Regra determinística: descartar a **1ª volta voadora** e qualquer volta com **tempo total > ~5% acima da mediana móvel** do stint. Sem isso, a out-lap contamina o quantil.
- **Curva curta estruturalmente ineleível:** Placar (3,0 s) e Vitória (4,0 s) têm 4–6 pontos → todo sub fica com ~1 amostra → nunca eleitas mesmo perdendo tempo medido. **Fallback §5.4** cobre.
- **Cold start** (primeiro `(carro,track,pneu)` sem linha em `melhores_passagens_trecho`): sem `vRef`, o `calcularDelta` não tem contra o que integrar. Contrato: **referência provisória = a melhor passagem do PRÓPRIO stint**; com <2 passagens, silêncio (`status:'sem-referencia'`).
- **Sub errado com segundo certo:** deriva de fração (tolerância 0,02) com poucos pontos joga o `dt` no sub vizinho. Regra: com `amostrasMin` baixo, **rebaixar para curva-pontual sem nomear o sub** (`subTrecho:null`) — a magnitude (relógio) continua honesta, o "onde" não mente.
- **Empate/oscilação:** no fixture, Junção/Bruxa/Placar/Vitória/"S" ficam ~1,0 s — sem histerese o foco "pinga" a cada volta. Regra: **stickiness** — mantém a eleita até um desafiante bater por **≥0,10 s** (reusa `RecordeGanhoMinS`).

---

## 5. A ELEIÇÃO — qual é a ÚNICA (algoritmo)

### 5.1 Universo de candidatos (todos em segundos recuperáveis por volta, comparáveis)
1. **Curva-pontual:** para cada `(segmentId, sub)` que passou pisos+gates → `ganho = ganhoSubVolta` daquela curva.
2. **Técnica-recorrente:** para cada `sub` com frase de coach (`entrada/freio/saida`) que aparece em **≥3 curvas distintas** com sinal consistente → `ganho = soma do ganhoSubVolta desse sub POR VOLTA nas curvas recorrentes`. (É per-volta e recuperável **se a lição for aplicada a todas** — por isso `evidencia.ocorrencias` lista as curvas.)
3. **Outro:** `apice` (linha) e `pace` (Vmin/tração), ou o **fallback de curva inteira** (§5.4). Sem frase dura; a entrega é bolinha/rótulo. `marcha` fora (sem dado).

### 5.2 Score e escolha
```
score = ganhoVoltaS_reconciliado × confianca.valor        // valor esperado, em segundos
elege = argmax(score) entre candidatos que passam piso(0.10) + gates + amostrasMin
        com STICKINESS (mantém a atual até desafiante bater por >= 0.10 s)
```
**Não** uso peso de "alavancagem" multiplicativo extra (os fiscais mostraram que sem calibração ele enviesa) — a alavancagem da técnica **emerge naturalmente** da soma entre curvas. Se dois candidatos empatarem dentro de 0,05 s, desempate por **maior consistência**, depois pela prioridade física herdada do coach de 2 palavras (freio > entrada > saída > pace > ápice). **Essa ordem de prioridade e os limiares são calibração — decisão do Flávio (§8), não minha.**

### 5.3 Comensurabilidade recorrente × pontual (furo que os fiscais acharam — fechado)
Técnica e pontual entram no mesmo `argmax` **em segundos recuperáveis POR VOLTA** (não em soma de stint): pontual = gap da curva; técnica = soma **por volta** do mesmo sub nas curvas recorrentes. Fica claro no objeto que o número da técnica é **teto contingente** a aplicar a lição a todas as curvas de `evidencia.ocorrencias`.

### 5.4 Fallback de curva curta / poucas amostras (item do crítico) — com régua PRÓPRIA (correção F3a)
Quando uma curva perde tempo **medido** (`gapMedido >= 0.10`) mas nenhum sub tem amostras suficientes para confiar no "onde" (Placar, Vitória, ou GPS esparso), emite **curva-pontual com `subTrecho:null`**: ganho = do `gapMedido` (relógio, confiável mesmo sem decompor), entrega = "você está perdendo Xs nesta curva" sem apontar sub.

**Correção F3a — o fallback tinha ficado com pontuação zero.** Se a confiança do fallback usasse `fAmostras` de um **sub** (≈0 em curva curta), o `score = ganho × 0` e o §5.4 **nunca elegeria** — as curvas curtas continuariam órfãs, o oposto do que ele existe para resolver. **Régua própria:** o fallback calcula `fAmostras` sobre os **pontos da CURVA inteira** agregados no stint (Placar 23, Vitória 28, "S" 37 — todos saturam), não sobre um sub. Assim ele **pontua de verdade** e as curvas curtas ganham coach honesto (de curva, não de sub).

**Correção F3b — dois ramos do ganho do fallback (decisão do Flávio, §8).** O número por volta do fallback pode ser:
- **(a) quantil-baixo (p25)** dos `gapMedido` por volta — conservador; tende a **silenciar** Placar e Vitória (gaps no limite do piso viram sub-piso no p25).
- **(b) mediana** dos `gapMedido` por volta — mais generoso; **mantém** Placar e Vitória como coach de curva.

Os dois ramos ficam especificados; **qual usar é calibração de negócio — decisão sua** (muda o destino de 2 das 8 curvas: coach vs silêncio). A J5 confirmou o efeito nos cenários C4 (Vitória) e no Placar.

### 5.5 Estado "sem oportunidade" (retorno `null` + `status`)
Se ninguém passa piso+gates, ou stint tem <3 voltas voadoras, ou a volta foi igual/melhor que a referência → retorna `null` com `status.estado` em `coletando-dados`/`no-teto`/`sem-referencia`/`stint-curto`. Silêncio é resposta válida — e honesta.

### 5.6 Pseudocódigo (determinístico, roda no `.exe`)
```
por volta (ao cruzar a linha de chegada):
  para cada curva c das 8:
     d = calcularDelta({atual:c, referencia:melhorHistorica[c]})   // motor existente
     gap = tempoAtual[c] − tempoRef[c]                              // relógio (teto)
     se gap <= 0.05: continue                                       // sem perda
     escala = min(1, gap / max(ε, d.deltaTotalS))
     para cada sub: ganhoSub[c][sub] = max(0, d.porSubTrecho[sub].deltaS) × escala
     acumulaNoStint(c, sub, ganhoSub, d.porSubTrecho[sub].amostras, gap)   // dedup (segmentId,sub,volta)
  candidatos = montaPontuais() ∪ montaRecorrentes(spread>=3) ∪ montaOutro() ∪ fallbackCurvaCurta()
  candidatos = filtra(piso 0.10, gates SF/pace/apice, amostrasMin, exclui out-laps)
  eleita = stickiness( argmax(ganhoVoltaS × confianca.valor) )
  se !eleita: return { null, status }
  return montaObjeto(eleita)   // preenche §1, reconciliacao, projecao, apice, tracos
```

### 5.7 Nada de sinal cru na tela
`evidencia.ocorrencias[].deltaS` e `deltaMedioS` podem ser negativos (sub que ganhou tempo) — ficam **internos**. A fronteira do reducer entrega para J1/J3 **só magnitude positiva**; a cor dá a direção. Regra dura do Flávio (número sem sinal).

---

## 6. ABORDAGENS COMPARADAS + RECOMENDAÇÃO

Três abordagens candidatas foram projetadas e fiscalizadas de forma independente. Resumo:

| | **A — Regra fixa** | **B — Pontuação ponderada** | **C — Raciocínio de IA** |
|---|---|---|---|
| Como elege | limiares + ordem de prioridade fixos | `score = ganho×confiança`, rankeia e escolhe o topo | LLM raciocina sobre a tabela de deltas e escolhe |
| Roda no `.exe` a 200 km/h | sim | sim | **não** (latência/offline/não-determinismo) |
| Determinístico / testável (255 testes) | sim | sim | não |
| Acha padrão recorrente sutil | fraco | bom (soma entre curvas) | ótimo |
| Risco de inventar (contra "só dado real") | baixo | baixo | **alto** (alucina padrão em ruído de 3-4 amostras) |
| Risco de km/h ou sinal vazar | baixo | baixo (com clamp na fronteira) | **alto** (narra "−0,12 s"/"5 km/h") |
| Calibração | limiares manuais | pesos/pisos (calibrar no fixture) | prompt |

### 6.1 Recomendação — **B (pontuação ponderada), endurecida**, com **C só offline no box**
- **B é o motor de runtime.** É determinístico, barato (só aritmética sobre a saída do motor), roda no `.exe` e porta fiel para o C# — exatamente como o `DeltaCoach.cs` já é (255 testes). Rankear por `ganho × confiança` integra naturalmente o valor esperado em segundos.
- **A é caso degenerado de B** (B com pesos binários). Não some capacidade; some risco de rigidez. Fica absorvida.
- **C (LLM) fica ESTRITAMENTE offline, no box**, entre stints/sessões: enriquecer a **narrativa** da lição e **auditar padrões** — **nunca** no caminho quente, **nunca** calculando o número do ganho. O determinismo é primário; a IA é reranker/narrador auditado por cima, e a produção e os 255 testes ficam preservados.

### 6.2 Correções obrigatórias que o painel adversário provou (valem para B)
1. **Gates de tipo no PRIOR determinístico, não no LLM** — zerar/excluir `freio` em curva SF e tirar `pace`/`apice` da eleição de FRASE **antes** do `argmax`. (Se ficar no LLM, o guarda-corpo anti-alucinação reintroduz o erro.)
2. **Teto do ganho nunca é `deltaTotalS`** (soma sinalizada) — seria subestimar: uma curva que perde 0,20 s no freio mas ganha 0,15 s na saída tem `deltaTotalS=+0,05`, e a perda recuperável do freio continua 0,20 s. Teto = o **próprio `deltaS` positivo do sub** e o **`gapMedido` da curva** (relógio). O `deltaTotalS` só entra na `escala` (§3.3).
3. **Sem piso positivo que fabrica oportunidade** — se a mediana do `(seg,sub)` for `<= 0,10` ou negativa, **não emite** (não força 0,05).
4. **Excluir out-laps** da recorrência (§4.5).
5. **Clamp na fronteira**: nada de `deltaS`/km/h chega à tela; ganho sempre positivo, em segundos.
6. **Coexistência sem vazar km/h**: a v0 `cerebro-coach.js` (seleção por km/h, Command Box) fica **preservada** e **separada**; a tela do coach de IA nunca mostra Vmin/km/h como métrica final ao lado do ganho em segundos.

### 6.3 Reuso do que já existe (não reinventar prescrição)
`web/cockpit/oportunidade-trecho.js` (motor "o que fazer no trecho que vem", **v3 aprovado por Flávio 09/06**) já consome a saída do `calcularDelta` e prescreve, por trecho, em segundos: `freio pior → FREIA DEPOIS/ANTES (±X m)`; `entrada pior → FREIA DEPOIS`; `ápice pior → FECHA A CURVA (X m, da bolinha)`; `saída pior → ACELERA ANTES (sem número até o Pace virar registro real)`. **A J2 fica ACIMA disso:** o `oportunidade-trecho.js` mostra a oportunidade de CADA trecho; a J2 **elege a ÚNICA a ensinar** olhando a volta e o stint. O `tecnica`/entrega do objeto **reusa esse contrato de verbos aprovado** (ex.: `tecnica:'freia-depois'`), e o campo `apice:{distFromIdealM,angleFromIdealDeg}` alimenta o "FECHA A CURVA X m". J4 formaliza a convivência.

---

## 7. ENCAIXE NO MOTOR DE DELTA (o que entra, o que sai)

```
                 melhores_passagens_trecho (0026)         StintPlan.nVoltasAlvo (stint-plan.js)
                            │                                        │
 passagem atual ──► calcularDelta(atual, ref)  ──►  [ REDUCER DA J2 (novo) ]  ──►  Oportunidade | null  + status
 (coletor+detector)  {segmentId,deltaTotalS,       agrega volta+stint,              (§1)
                      porSubTrecho,pior...}         reconcilia ao relógio,
                                                    confiança, gates, eleição
                            ▲                                        │
                   apice-cruzou (trecho-detector)  ─────────────────┘  (bolinha)
```
- **ENTRA no reducer:** por curva, a saída do `calcularDelta` + o `tempo_trecho_s` medido (atual e referência) + o evento `apice-cruzou` + `nVoltasAlvo` do stint. O reducer guarda **memória do stint** (o motor não tem — é uma curva por chamada).
- **SAI do reducer:** o objeto do §1 (ou `null`+`status`). É o que J4 pluga no campo `coach` do pacote (`cerebro-painel.js:167`).
- **O motor de delta NÃO muda** (evolução soma por cima). A v0 `cerebro-coach.js` (km/h) **não é tocada**.

### 7.1 Uma dependência que precisa de decisão (não invento)
O `calcularDelta` **do JS** não retorna o `tempo_trecho_s` da volta atual (só o record C# `DeltaResultado` tem `TempoAtualS`, e vem `null`). O reducer precisa dele para a `reconciliacao`. **Proposta (para J4/Flávio):** expor `tempoAtualS` na saída do motor JS (paridade com o C#) — mudança **aditiva**, não quebra contrato. Enquanto não vier, o `tempoAtualS` é lido do coletor da passagem. **Não é código que eu altere aqui** (produção protegida; é decisão de integração da J4).

### 7.2 Investigação conjunta J2/J4 dos limites de segmento — passo 0 da Fase 1 (correção F1)
A J5 achou (com prova de perfil de velocidade, `entregas/janela-5.md §3`) que **em 4/8 curvas a freada física não está dentro do próprio segmento** do fixture: Bruxa e Vitória **começam** já no ponto lento (só aceleração no trecho); Reta Oposta e Junção **terminam** nele (a freada da Bruxa parece morar no fim do segmento da Junção); Placar (4 pontos) não tem ponto lento. Consequência: nessas curvas o sub `freio`/`entrada` do motor **não corresponde** à freada da curva nomeada — e o caminho honesto vira o fallback `subTrecho:null` (que a J2 já cobre; o sistema **silencia o "onde-fino", não quebra**).

**O que É meu (J2) conferir, antes de qualquer código da Fase 1** — comparar o registro do fixture com as **linhas reais** que o produto usa:
1. **De onde saem as linhas ao vivo:** `web/cockpit/segments-loader.js` monta os segmentos (`entradaLine {a,b}`, `apicePoint`, `saidaLine {a,b}`) que alimentam o `TrechoDetector` (`web/cockpit/trecho-detector.js` / `.../TrechoDetector.cs`). Essa é a fonte-da-verdade dos limites no produto.
2. **O teste (determinístico, sem tocar produção):** rodar o `TrechoDetector` sobre as passagens reais do fixture e conferir, por curva, se o evento **`freada-iniciou`** (desaceleração ≥ 0,5 g) cai **dentro** do próprio segmento — usando o perfil de velocidade da tabela da J5 como gabarito de onde o ponto lento realmente está.
3. **O veredito de causa-raiz:**
   - Se as linhas ao vivo colocam a freada **dentro** do segmento → o problema é **só do fixture** (base 23-24/05 com limites diferentes da base 27/05 que gerou os ápices-semente). Ação: mapear o remapeamento no **replay de teste** (a J4 precisa disso — o replay tem de anotar `sub` a partir das linhas boas, não das do fixture).
   - Se as linhas ao vivo **coincidem** com as do fixture (freada fora do trecho) → é **defeito de registro no produto**: os 4 marcos da Bruxa/Vitória nunca disparam `freada-iniciou` dentro do trecho. Ação: correção de limites de segmento (Fase 1, com autorização — produção protegida).
4. **Provável causa-raiz comum** com a divergência do ápice-semente (J3/J5): mesmos limites de trecho desencontrados entre as duas bases. Conferir as duas coisas juntas.

Isto é **investigação (leitura/teste), não alteração de produto** — executo quando a Fase 1 abrir, em par com a J4. A minha `apice{}` (do `trecho-detector`) segue válida como âncora enquanto isso.

---

## 8. Pendências / decisões para o Flávio (via Fable — não decido sozinho)

1. **Calibração** (pisos e pesos): piso de eleição **0,10 s**; `adesao` default **0,5–0,6**; `spread>=3` curvas para virar "técnica"; ordem de prioridade de desempate (freio > entrada > saída > pace > ápice); margem de stickiness **0,10 s**. São escolhas de negócio/pilotagem — proponho os valores acima, **você decide**. _(Fable: valem provisoriamente para J1/J3/J5; decisão final vai a você no painel.)_
2. **[F3b] Ganho do fallback de curva inteira — p25 (conservador, silencia Placar e Vitória) OU mediana (mantém as duas como coach):** muda o destino de 2 das 8 curvas (coach vs silêncio). Proponho **mediana** (não deixa curva curta órfã), **você decide**. Ver §5.4 e J5 C4.
3. **`marcha`**: confirmo que fica **fora** (sem sensor). Se um dia entrar canal de marcha/RPM, reabrimos. _(Fable: aceito.)_

**Já arbitrado pelo Fable (2026-07-08T19:48Z) — não é mais pendência:** os acréscimos ao objeto (`tipoCurva`, `reconciliacao`, `projecao`, `apice`, `status`, `subTrecho:null`) foram **aceitos — o §1 é o contrato vigente**; o `tempoAtualS` no motor JS foi aceito como **mudança aditiva da Fase 1** (a J4 formaliza; nada de produto muda agora).

---

## 9. Autoconferência da régua (o que a J2 garante)
preto (doc) · sem-emoji · "você" · **número-sem-sinal** (clamp na fronteira, §3.6/§5.7) · **só-dado-real** (marcha removida; `tempoAtualS`/`voltasRestantes` com fonte real ou null) · **ganho-em-segundos** (relógio como teto; km/h nunca é final) · **painel-preservado** (motor e v0 intocados; coach soma por cima). Fronteira respeitada: **não** escrevi a mensagem (J1) nem desenhei o gráfico (J3).

_Fim da entrega da Janela 2._
