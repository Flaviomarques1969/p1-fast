# Janela 1 — Metodologia de coaching + a Mensagem (Parte B) + Timing

> Entrega viva da Janela 1 do Coach de IA de Stint. Dona da **metodologia**, da **mensagem de ensino (Parte B)** e do **portão de timing** (quando o cartão do coach aparece/some). Trabalhadora sob o maestro Fable 5.
> Tudo ancorado em código/dados REAIS (conferidos 2026-07-08) e no **objeto oportunidade v1 já publicado pela Janela 2** (`entregas/janela-2.md §1`). Onde algo não existe, está escrito "não existe / decisão do Flávio" — não inventei.
> Régua: preto · sem-emoji · **"você"** · 956×440 · **número-sem-sinal (cor = direção)** · só-dado-real · ganho-em-segundos · painel-preservado · timing-seguro.

---

## 0. TL;DR para o maestro e as outras janelas (leia isto primeiro)

- **Uma lição por volta, uma superfície nova.** As frases de 2 palavras do painel (FREOU CEDO…) continuam existindo e intocadas. O coach é a **camada de ENSINO acima** delas, no cartão do miolo — não substitui nada.
- **A mensagem nasce SÓ dos campos do objeto da J2.** Nada de inventar. Mapa campo→texto no §2.2. Verbos **reusam o contrato v3 aprovado pelo Flávio** (`oportunidade-trecho.js`: FREIA DEPOIS/ANTES/MENOS · FECHA A CURVA · ACELERA ANTES) — não crio vocabulário concorrente.
- **A mensagem é escrita por NÍVEIS** (a régua do slot fixo da §2.2): **N1 relance** (1 linha, no calor da volta, só na reta) → **N2 ensino** (3 linhas, fim de volta) → **N3 revisão** (parágrafo, só no box/parado). A instrução acionável fica **sempre sozinha na última linha** — se o piloto voltar o olho pra pista no meio, o que ele pega é a ação, não o enfeite.
- **Direção sem sinal:** o coach nunca escreve `+`/`−`. A direção vem da **palavra** (depois/antes/mais/menos/mantém) e da **cor**. O "quanto ganha" é `ganhoVoltaS` em segundos, **sempre positivo**.
- **Eu sou a dona do PORTÃO (§3).** O cartão inteiro (gráfico J3 + mensagem J1) aparece só em **reta / fim de volta / box / baixa carga** e **some antes da próxima zona de freada**. **Nunca no meio de curva. Modo crítico do painel sempre vence.** A J3 obedece este portão.
- **Silêncio é resposta válida.** Quando a J2 devolve `null` + `status`, o coach ou some ou mostra 1 linha honesta ("2 voltas — juntando dado"). Não enche o piloto de ruído.

---

## 1. METODOLOGIA DE COACHING (1 foco por volta)

### 1.1 Princípios reais de pilotagem e aprendizado motor que sustentam o desenho
Fundamento em princípios estabelecidos de aprendizado motor e de coaching de automobilismo (não em dado do projeto):

1. **Gargalo atencional / uma dica por vez.** A 200+ km/h a leitura periférica do piloto cabe em ~1–2 s e a memória de trabalho segura **uma** instrução acionável. Empilhar dicas piora o desempenho. → **Um foco por volta**, ponto. Isso casa com a J2, que já elege **UMA** oportunidade por volta.
2. **Foco de atenção EXTERNO (hipótese da ação restringida, Wulf).** Dicas sobre o **efeito/ambiente/referência de pista** ("freie mais tarde, na placa") produzem melhor aprendizado que dicas sobre o **corpo** ("aperte mais o pé"). → A mensagem aponta **lugar e ação na pista** (freada, ápice, saída), nunca mecânica corporal.
3. **Do grosso ao fino (Fitts & Posner: cognitivo → associativo → autônomo).** Corrige-se primeiro o **erro grosso** (ponto de freada, Vmin), depois o **ajuste fino** (taxa de soltura do freio, linha). → A lição **evolui ao longo do stint** (§1.3).
4. **Hipótese da orientação (guidance hypothesis, Schmidt & Lee): feedback constante vicia.** Corrigir a MESMA coisa toda volta cria dependência e trava a consolidação. Feedback **espaçado/resumido** aprende melhor. → **Quando calar** (§1.4).
5. **Feedback fora do pico de carga.** A instrução chega **depois** da execução (fim da curva / fim da volta), nunca **durante** a curva (pico de carga). → **Portão de timing** (§3).
6. **KR + KP (resultado + como).** O piloto precisa do **resultado** (quanto custou/rende, em s) e do **como** (o que fazer). A mensagem carrega os dois, mas **lidera pela ação** (KP), não pelo número. → **Modelo de conteúdo** (§2).

### 1.2 O ciclo curto: ORIENTAR → ENSINAR → APONTAR A SOLUÇÃO
Um grande coach não descarrega análise; ele fecha um ciclo curto por foco. Mapeio o ciclo direto nas **três coisas que a mensagem sempre carrega**:

| Passo do coach | O que faz | Vira, na mensagem | Campo do objeto (J2) |
|---|---|---|---|
| **Orientar** | nomeia O foco e ONDE | linha de foco: *"Freada da Bruxa"* | `curvaNome` + `subTrecho` (+`tecnica`) |
| **Ensinar** | diz POR QUÊ custa (mecanismo) | linha de mecanismo: *"você tira velocidade cedo"* | `subTrecho` + `tipoCurva` (texto-fácil do tipo) |
| **Apontar a solução** | diz O QUE fazer + QUANTO rende | linha de ação + ganho: *"segure o freio · 0,12 s"* | `tecnica`/verbo v3 + `ganhoVoltaS` |

O ciclo é **o mesmo** nos três níveis (§2.3); muda só **quanto** dele cabe no tempo disponível. No relance (N1) sobra só o "apontar" (a ação); no ensino (N2) entram os três passos; na revisão (N3) entra o histórico do stint.

### 1.3 Como a lição EVOLUI ao longo do stint (do grosso ao fino)
A evolução **emerge de graça** porque a J2 re-elege a maior oportunidade a cada volta: quando o piloto conserta o erro nº 1, o nº 2 vira o nº 1. Minha parte é **fazer a linguagem acompanhar** e **confirmar o ganho**:

- **Início do stint (voltas voadoras 1–3):** erro grosso, magnitude grande. Tipicamente **freio/entrada** (ponto de freada) ou **Vmin**. Linguagem **direta e imperativa** ("freie mais tarde na Bruxa").
- **Meio do stint:** o grosso encolheu abaixo do piso (a J2 para de elegê-lo); sobe o **fino** — soltura do freio, **ápice** (bolinha), **pace/saída**. Linguagem **mais fina** ("carregue mais no ápice", "estique a saída"). Confiança tende a subir (mais voltas → `fConsistencia`).
- **Fim do stint:** consolidação. Mais **silêncio**; mais **confirmação** ("recuperou · 0,10 s") quando o piloto fecha a lição. Se nada novo passa o piso → `status:'no-teto'` → coach some ou mostra "no ritmo".

**Regra de continuidade da lição (minha):** quando a J2 mantém a MESMA `tecnica`/`segmentId` por voltas seguidas (a `stickiness` dela), eu **não repito a lição inteira** — degrado para **relance curto** ("de novo: freada da Bruxa") e reservo o ensino completo para quando o foco **mudar** ou quando houver **folga** (box). Repetir por extenso toda volta é exatamente o que a hipótese da orientação condena.

### 1.4 QUANDO CALAR (silêncio é parte da metodologia)
O coach fica **calado** quando:
- **J2 devolve `null`.** Sem oportunidade acima do piso, ou `status ∈ {coletando-dados, no-teto, sem-referencia, stint-curto}`. Mostro no máximo **uma linha de estado honesto** (§2.5), nunca uma lição fabricada.
- **Lição recém-dada e piloto melhorando.** Depois de ensinar um foco, **pulo pelo menos uma volta** antes de repetir (dou tempo de consolidar). Se o `ganhoVoltaS` daquele foco cai volta a volta, **calo** — ele está corrigindo sozinho.
- **Confiança baixa** (`confianca.nivel === 'baixa'`). Não ensino "duro"; ou fico em relance como **sugestão** ("talvez a freada da Bruxa") ou calo. Nunca afirmo padrão sobre 1–2 amostras de GPS ~1 Hz (§2.4).
- **Segurança / carga alta.** Dentro de curva, freando, g lateral alto, ou **modo crítico** — cartão some na hora (§3). Silêncio aqui não é pedagogia, é segurança.

---

## 2. MODELO DE CONTEÚDO DA MENSAGEM (Parte B)

### 2.1 O que a mensagem SEMPRE carrega (as 4 perguntas)
Toda mensagem responde, no máximo, a estas quatro — nesta ordem de prioridade (a última é a que **nunca** pode faltar):

1. **O QUÊ** — o foco único (a técnica ou o sub-trecho).
2. **ONDE** — a curva (e o sub, quando `subTrecho != null`).
3. **POR QUÊ** — o mecanismo, em uma frase (o que acontece com o carro).
4. **COMO + QUANTO** — a ação corretiva (verbo v3) **+** o ganho em segundos. **Esta linha é a âncora** e vai sempre por último.

Nem todo nível mostra as quatro (§2.3). Mas **a linha 4 (ação+ganho) aparece em todos os níveis** — é o mínimo pedagógico útil.

### 2.2 Mapa CAMPO (objeto J2) → TEXTO (não invento nada fora daqui)
A mensagem é uma **função pura** do objeto oportunidade. Contrato de render que a J4 embrulha (§5):

```
renderMensagem(oportunidade, nivel, contextoTiming) -> { linhas:[string], acento:'ambar'|'vermelho'|'verde', ganhoTxt:string }
```

| Elemento | Campo(s) consumido(s) | Regra de texto | Exemplo |
|---|---|---|---|
| **O QUÊ** | `tipo`, `tecnica`, `subTrecho` | técnica-recorrente → nome da técnica; pontual → sub; `subTrecho:null` → "esta curva" | "freada", "ápice", "esta curva" |
| **ONDE** | `curvaNome` (+ `subTrecho`) | nome oficial da curva, curto ("Bruxa", "Junção", "Curva 01"). Sub vira preposição de lugar | "na freada da Bruxa" |
| **POR QUÊ** | `subTrecho` + `tipoCurva` | frase de mecanismo derivada do **texto-fácil do tipo** (`tipos-curva-texto.js`) + do sub | T5 (Curva 01): "solta o freio cedo e o carro escapa de frente" |
| **COMO** | `tecnica` / verbo **v3** (`oportunidade-trecho.js`) | imperativo "você", foco externo (placa/ápice/zebra), **sem sinal** | "segure o freio mais um instante" |
| **QUANTO** | `ganhoVoltaS` (e `ganhoStintS`) | segundos, **sempre positivo**, formato `0,12 s`. Stint só no N2/N3 e se `!= null` | "0,12 s" (volta) · "no stint, ~0,7 s" |
| **CONFIANÇA** | `confianca.nivel` | governa modo (duro/sugestão/silêncio) e cor; **não vira número na tela** | alta→afirma; baixa→"talvez" |

**Contrato de verbos (reuso do v3 aprovado, não contradigo o Command Box):**

| `subTrecho`/alvo | Verbo v3 aprovado | Direção pela PALAVRA (nunca por sinal) |
|---|---|---|
| `freio` (ponto dele antes do ouro) | **FREIA DEPOIS** | "freie mais tarde" / "segure o freio" |
| `freio` (ponto dele depois do ouro) | **FREIA ANTES** | "antecipe a freada" |
| `freio` (mesmo ponto, Vmin baixa) | **FREIA MENOS** | "freie mais leve" (menos pressão) |
| `entrada` | **FREIA DEPOIS** | "entre mais forte / carregue velocidade" |
| `apice` | **FECHA A CURVA** (X m da bolinha) | "feche mais a curva" (a bolinha mostra onde) |
| `saida`/`pace` | **ACELERA ANTES** (sem número) | "abra o gás antes" |

> **Nota de coerência (para o Fable):** o `oportunidade-trecho.js` renderiza os **metros** com sinal (`+3 m` / `−3 m`). Isso é anterior à regra "número-sem-sinal" (04/07) e vive na camada de **marcas do gráfico (J3)**, não na minha mensagem. **A minha mensagem não usa sinal em lugar nenhum** — direção é sempre palavra + cor; se eu citar metros, é magnitude ("3 m mais tarde"). Deixo a reconciliação do sinal-nos-metros para J3/Fable; não é a minha superfície.

### 2.3 Os NÍVEIS da mensagem (a régua do slot fixo — §2.2 do PLANO-MESTRE)
Escrevo por níveis para caber em slot fixo. **Medida real confirmada pela J3 (2026-07-08): o slot da mensagem = 256 px de largura × 238 px de altura** (miolo em x550→806) — **o N2 de 3 linhas cabe**. O layout **não muda** com o conteúdo; muda o **nível** conforme o portão de timing.

| Nível | Quando (portão §3) | Conteúdo | Orçamento seguro | Exemplo |
|---|---|---|---|---|
| **N0 — Silêncio** | curva/freada/crítico, ou J2=null sem estado a mostrar | cartão some | — | (nada) |
| **N1 — Relance** | reta / baixa carga, no calor da volta | **só a ação** (linha 4) | **1 linha, ≤ 5 palavras / ≤ ~28 caracteres** | `Freada da Bruxa · 0,12 s` |
| **N2 — Ensino** | fim de volta (linha de chegada, na reta) | 3 linhas: foco+onde / por quê / ação+ganho | **≤ 3 linhas, cada ≤ ~7 palavras** | (mock §2.6) |
| **N3 — Revisão** | box / carro parado | parágrafo: recap do stint + ganho acumulado + próximo foco | livre (parado, sem limite de segurança) | (mock §4) |

**Regra dura de leitura segura (a mais importante):** em N1 e N2, **a linha de AÇÃO fica sempre sozinha por último**. O piloto lê de cima pra baixo; se ele devolver o olho à pista no meio, o que sobrou na retina é a ação (útil), não o mecanismo (enfeite). Cada linha é uma **unidade de relance** independente.

### 2.4 Honestidade sobre o limite físico (regra "só dado real")
- **GPS ~1 Hz** dá 1–2 amostras por sub. A J2 já rebaixa confiança e usa `subTrecho:null` quando o "onde" não é confiável. **Minha mensagem obedece:** com `subTrecho:null`, **não nomeio o sub** — falo da curva inteira ("você perde 0,3 s nesta curva"), o relógio é honesto, o "onde-fino" não mente.
- **`confianca.nivel==='baixa'`** → modo sugestão ("talvez") ou silêncio. Nunca afirmo lição fina sobre ruído.
- **`pace` e `apice`** não ganham verbo "duro": `pace` → "abra o gás antes" sem número; `apice` → a **bolinha** faz o trabalho visual, a mensagem só a acompanha ("feche mais a curva"). Isso espelha o que o `DeltaCoach`/`oportunidade-trecho.js` já fazem (ápice sem frase de 2 palavras).
- **`marcha` está fora** (sem sensor — a J2 removeu). Não menciono marcha.

### 2.5 Estado honesto (o companheiro `status` da J2)
Quando a J2 devolve `null` + `status`, o coach mostra **uma linha** (ou some). Sem inventar lição:

| `status.estado` | Linha (N1) | Cor |
|---|---|---|
| `coletando-dados` | `Juntando dado — 2 voltas` | neutra (cinza) |
| `no-teto` | `No seu ritmo` | verde |
| `sem-referencia` | `Sem volta de comparação ainda` | neutra |
| `stint-curto` | `Stint curto — sem base` | neutra |

### 2.6 Tom e cor (decisão de preferência → marcada para o Flávio no §6)
- **Tom:** "você" sempre; imperativo curto na ação; **sem emoji**; foco externo (pista), nunca corpo; sem jargão gratuito.
- **Cor / acento — DONO e mecanismo (travado pelo Fable, F7):** o **acento é computado por MIM (J1) no render** e vai no campo `acento` dos pré-computados N1/N2/N3; **a J3 COPIA o mesmo `acento` no gráfico** — uma fonte só, mensagem e gráfico nunca divergem de cor.
- **Limiar do acento — PROVISÓRIO (decisão §6.10 do quadro do Fable / §6 item 1 aqui; vale até o martelo do Flávio):**
  - **vermelho** = `confianca.nivel === 'alta'` **E** `ganhoVoltaS ≥ 0,50 s` (perda grande e comprovada).
  - **âmbar** = todos os demais casos (o padrão do coach — "aqui dá pra melhorar").
  - **verde** = **recuperação confirmada** (o piloto fechou a lição — reforço positivo, reusa a lógica RECORDE/MELHOR STINT).
  Direção continua **sem sinal**: a cor dá a direção, nunca um `+`/`−`. **Isto é semântica de cor numa superfície NOVA — decisão do Flávio (§6.10).**

**Mock do slot da mensagem (direita ≈40% do cartão, fundo preto, sem-emoji, "você", número sem sinal) — nível N2:**
```
┌───────────────────────────┐   ← slot da mensagem (J1), à direita do cartão
│  FREADA DA BRUXA           │   linha 1 — foco + onde        (acento âmbar)
│  você tira velocidade cedo │   linha 2 — por quê (mecanismo)
│  ───────────────────────── │
│  segure o freio   0,12 s   │   linha 4 — AÇÃO + ganho  (sozinha; ganho sem sinal)
└───────────────────────────┘
```

---

## 3. TIMING / PORTÃO DE SEGURANÇA (a Janela 1 é a dona; a J3 obedece)

O cartão do coach (gráfico J3 + mensagem J1) **aparece e some INTEIRO**, controlado por **um portão único**. Regras:

### 3.1 As janelas onde o cartão PODE aparecer
Ancoradas no que o sistema **já sabe** (o `trecho-detector.js` dispara os 4 marcos `entrada-cruzou → freada-iniciou → apice-cruzou → saida-cruzou`, e o cérebro sabe a volta):

| Portão | Gatilho real | Nível mostrado | Por quê é seguro |
|---|---|---|---|
| **`reta` / baixa carga** | entre `saida-cruzou` de uma curva e `entrada-cruzou` da próxima, **e** velocidade alta-e-estável **e** freio ~0 **e** g lateral baixo | **N1 relance** | fora de curva e de freada; carga cognitiva mínima |
| **`fim-de-volta`** | cruzou a linha de chegada (volta incrementou / `cronometroTotalS` reiniciou) — carro na reta principal | **N2 ensino** | pausa natural; a análise da J2 **acabou de fechar** naquela volta (`geradaNaVolta`), lição fresca |
| **`box`** | velocidade ≈ 0 / flag de box (msg 17 BOX) | **N3 revisão** | carro parado — sem limite de segurança |

### 3.2 Quando o cartão NUNCA aparece (travas duras)
- **Dentro de curva** (entre `entrada-cruzou` e `saida-cruzou` do trecho ativo).
- **Freando** (`pedalFreioPct` acima de um limiar) ou **g lateral alto** (`accelYg`).
- **Modo crítico do painel** (overlay que toma a tela) — **sempre vence**; o cartão some na hora. Também **shift light e luz de freio nunca são cobertos** (contrato §2.2).
- **Confiança baixa + calor da volta** — sem relance duvidoso a 200 km/h.

### 3.3 Regras de estabilidade (não piscar, não perseguir o olho)
- **Some ANTES da próxima zona de freada.** O cartão tem que estar **fora da tela** quando o piloto cruza o `entrada-cruzou` da próxima curva. Isto é inegociável: nada de coach competindo com a curva.
- **Dwell mínimo e gap mínimo.** Um cartão fica no mínimo ~1,5 s (senão nem dá pra ler) e no máximo até a próxima zona de freada; entre dois cartões, um gap mínimo pra não tremular.
- **Um N2 por volta, no máximo.** A lição da volta aparece uma vez (no fim da volta). N1 relance, no máximo um por reta.
- **Histerese herdada da J2.** A J2 já tem `stickiness` (só troca o foco se o desafiante bate por ≥0,10 s) — respeito: não troco a lição no meio do caminho.

### 3.4 O contrato do portão (o que entrego para a J3 obedecer)
```
timing = {
  portao,        // 'reta' | 'fim-de-volta' | 'box'  — decidido pelo estado do trecho-detector + sensores
  nivel,         // 'N1' | 'N2' | 'N3'  — decorre do portao (reta→N1, fim-de-volta→N2, box→N3)
  podeMostrar,   // boolean — TODAS as travas §3.2 passaram
  duracaoMs,     // dwell alvo; teto = tempo até o próximo entrada-cruzou
  prioridade     // 'critica-vence'  — modo crítico do painel derruba o cartão
}
```
A J3 desenha o gráfico **no mesmo portão**; nós dois aparecemos/sumimos juntos. **Quem calcula `podeMostrar` e `portao` é a J1** (esta janela); a J3 consome.

---

## 4. EXEMPLOS ESCRITOS POR TIPO (curvas e dados reais de Brasília)

Todos usam curvas reais (`_meta.ordemCurvas`), tipos reais (`tipos-curva-brasilia.js`), verbos v3 aprovados. Ganho **sempre positivo, sem sinal**.

> **F8 — natureza dos números (travado pelo QA da J5):** estes exemplos mostram o **FORMATO** da mensagem em cada tipo. Os **números** dos Exemplos B/C/D (0,18 · 0,14 · 0,30) e o `subTrecho:'pace'` do Exemplo A **são ILUSTRATIVOS** — não saem do fixture. Os **cenários oficiais com número reproduzível** (motor rodado) são os **C1–C5 da J5** (`entregas/janela-5.md §2`): C1 = Curva "S" 0,99 s (a vitrine), C2 = Bruxa 0,485 s, C3 = técnica recorrente (também ilustrativa — irrealizável no dado atual), C4 = Vitória SF (gate), C5 = silêncio.
>
> **Achado central do QA (importante para a pedagogia):** a GPS ~1 Hz com o registro de hoje, o caminho **COMUM** da Fase 1 é `subTrecho:null` (mensagem de **curva inteira** — "você perde X s nesta curva"), porque quase nunca há amostra suficiente para confiar no "onde-fino". Ou seja: **meus fallbacks `subTrecho:null` (§2.4) não são exceção — são o dia a dia da Fase 1.** O ensino do sub específico (freio/saída/ápice) fica para quando entrar a captura a 25 leituras/s. O sistema não quebra: ele **silencia o "onde-fino"** e mantém o ganho honesto pelo relógio.

### Exemplo A — `tipo: 'curva-pontual'` · a Curva "S" (o achado REAL do fixture = cenário C1 da J5)
**Objeto (J2, resumido):** `tipo:'curva-pontual'`, `curvaNome:'CURVA "S"'`, `tipoCurva:'T4'`, **`subTrecho:null`**, `ganhoVoltaS:0.99`, `ganhoStintS:4.75`, `confianca:{nivel:'alta'}`.
Achado real (J2 + QA C1 da J5): a Curva "S" perde ~1,0 s em **5/5 voltas voadoras** (p25 = 0,996 s) → confiança **alta**. **Correção F8:** a 1 Hz o `subTrecho` honesto é **`null`** (curva inteira), não `'pace'` — 7 pontos por passagem não sustentam o "onde-fino". Por isso a mensagem fala da **curva**, não da saída.

- **N1 (reta):** `Curva "S"  ·  1,0 s`
- **N2 (fim de volta) — curva inteira (`subTrecho:null`):**
```
CURVA "S"
você perde tempo aqui
─────────────────────
carregue mais       1,0 s
```
- **N3 (box):** `Sua maior sobra hoje é a Curva "S": em todas as voltas você perde cerca de 1 segundo ali — repete toda volta, então é dado firme. É um "S" encadeado (T4): o que importa é já sair posicionado pra próxima. Com o dado de hoje (1 leitura por segundo) eu não aponto o ponto exato dentro da curva, aponto a curva inteira; com a captura fina isso vira "onde". No resto do stint vale perto de 5 segundos.`
- **Timing:** N2 no `fim-de-volta`; some antes do `entrada-cruzou` da Curva 01.

### Exemplo B — `tipo: 'tecnica-recorrente'` · freou cedo em várias curvas · **FORMATO ILUSTRATIVO**
> **F8:** número e sub são **ilustrativos** — a técnica-recorrente de freio com sub nomeado é o cenário C3 da J5, que ela declarou **irrealizável no dado de 1 Hz de hoje** (o "onde-fino" cai pra `null`). Este exemplo mostra o **formato** que a mensagem terá quando entrar a captura fina (25 leituras/s).

**Objeto (J2):** `tipo:'tecnica-recorrente'`, `tecnica:'freia-depois'`, `subTrecho:'freio'`, `segmentId`/`curvaNome` da pior ocorrência = `'CURVA DA BRUXA'` (T0), `ganhoVoltaS:0.18` *(ilustrativo)*, `evidencia.ocorrencias:[Bruxa, Junção, Curva 2]`, `confianca:{nivel:'alta'}`.

- **N1 (reta):** `Freie mais tarde` *(técnica, sem curva — é padrão em várias)*
- **N2 (fim de volta):**
```
FREADA — 3 CURVAS
você tira velocidade cedo
─────────────────────
freie mais tarde    0,18 s
```
- **N3 (box):** `O mesmo erro se repete em três curvas — Bruxa, Junção e Curva 2: você começa a freada cedo demais e chega devagar. É a sua maior lição de técnica hoje. Trabalhe segurar o freio um instante a mais na Bruxa primeiro (é onde mais custa) e leve pra Junção e a Curva 2. Somando as três, dá cerca de 0,18 s por volta.`
- **Timing:** N2 no `fim-de-volta`. Se repetir na volta seguinte com o piloto melhorando → **N1 curto** ("de novo: freie mais tarde") ou silêncio.

### Exemplo C — `tipo: 'outro'` · ápice aberto na Curva da Junção (corrige pela bolinha) · **FORMATO ILUSTRATIVO**
> **F8:** número e a atribuição ao ápice são **ilustrativos** (o ápice a 1 Hz também tende a `null`; a bolinha só é confiável com captura fina). Mostra o **formato** da correção por bolinha.

**Objeto (J2):** `tipo:'outro'`, `subTrecho:'apice'`, `curvaNome:'CURVA DA JUNÇÃO'` (T2, raio decrescente), `apice:{distFromIdealM:2.4, angleFromIdealDeg:...}`, `ganhoVoltaS:0.14` *(ilustrativo)*, `confianca:{nivel:'media'}`.

- **N1 (reta):** `Ápice da Junção  ·  0,14 s`
- **N2 (fim de volta):**
```
ÁPICE DA JUNÇÃO
a curva fecha e você abre
─────────────────────
feche a curva 2 m   0,14 s
```
> A **bolinha** do painel (spec v2) faz a correção visual; a mensagem só a acompanha. `2 m` vem de `apice.distFromIdealM` — magnitude, **sem sinal**.
- **Timing:** N2 no `fim-de-volta`; confiança `media` → tom firme mas sem "vermelho".

### Exemplo D — `subTrecho: null` · Curva da Vitória (SF, curva curta — fallback da J2) · cenário C4 da J5
> **F8:** o **formato** (curva inteira + gate SF) está certo e é o oficial (cenário C4 da J5); só o número `0,30` é **ilustrativo** — no dado real a Vitória fica ~1,0 s ou abaixo do piso conforme a calibração (decisão do Flávio, ver J5 C4).

**Objeto (J2):** `tipo:'curva-pontual'`, `subTrecho:null` (fallback de curva curta — poucas amostras), `curvaNome:'CURVA DA VITÓRIA'` (SF, pé embaixo — **gate de freio da J2 descarta qualquer "freou"**), `ganhoVoltaS:0.30` *(ilustrativo)*, `confianca:{nivel:'media'}`.

- **N1 (reta):** `Curva da Vitória  ·  0,3 s`
- **N2 (fim de volta):**
```
CURVA DA VITÓRIA
você perde tempo aqui
─────────────────────
carregue mais       0,3 s
```
> Como é **SF (pé embaixo)** e `subTrecho:null`, **não falo de freio nem aponto sub** — seria artefato (regra da J2). Falo da curva inteira e de "carregar mais" (linha/Vmin). Honesto.
- **Timing:** N2 no `fim-de-volta`.

### Exemplo E — Silêncio / estado honesto (início de stint)
**Objeto (J2):** `null` + `status:{estado:'coletando-dados', voltasObservadas:2, motivo:'2 voltas — junto mais dado'}`.
- **N1:** `Juntando dado — 2 voltas` (cinza) — ou cartão some. **Sem lição inventada.**

---

## 5. CONTRATO DE SAÍDA (a forma que a J1 entrega; a J4 embrulha)

O que a J1 entrega para o campo `coach.mensagem` e `coach.timing` do pacote (a J4 formaliza o envelope `coach` — §2.3 do PLANO-MESTRE):

**O que viaja pro `.exe` = SÓ os textos pré-computados N1/N2/N3 (dado serializável).** Função **não viaja em dado** (orientação do Fable, 1ª auditoria): o `render(nivel)` é **conveniência da referência web** — na web, o cérebro pode gerar os níveis on-the-fly; no pacote que a J4 embrulha e manda pro C#, o que trafega é o objeto **puro** abaixo (strings já prontas). O `.exe` só escolhe qual nível mostrar pelo `timing.nivel`; não roda função no caminho quente.

```js
// FORMA SERIALIZÁVEL (é isto que a J4 embrulha no campo coach.mensagem e manda pro .exe):
coach.mensagem = {
  N1: { linhas:['Freada da Bruxa · 0,12 s'], acento:'ambar' },
  N2: { linhas:['FREADA DA BRUXA','você tira velocidade cedo','segure o freio   0,12 s'], acento:'ambar' },
  N3: { texto:'...', acento:'ambar' },
  estado: null | { estado, motivo }   // quando a oportunidade é null (§2.5)
}
coach.timing = { portao, nivel, podeMostrar, duracaoMs, prioridade:'critica-vence' }   // §3.4

// SÓ na referência web (NÃO serializa, NÃO vai pro .exe) — conveniência de quem monta os pré-computados:
//   render(nivel) => ({ linhas:[...], acento:'ambar'|'vermelho'|'verde', ganhoTxt:'0,12 s' })
```
- **Entra:** o objeto oportunidade da J2 (ou `null`+`status`) + o estado do `trecho-detector` + sensores (freio/g/velocidade) + evento de linha-de-chegada.
- **Sai:** `coach.mensagem` (N1/N2/N3 pré-computados) + `coach.timing`. Puro texto + flags; **nenhum dado inventado, nenhum sinal, nenhum km/h, nenhuma função no dado**.
- **Não toco** no motor de delta, na v0 `cerebro-coach.js` (Command Box), nem no painel aprovado. Somo por cima.

---

## 6. DECISÕES PARA O FLÁVIO (via Fable — não decido sozinho)
1. **Semântica de cor do coach** (§2.6 · quadro do Fable §6.10): **vermelho** = confiança alta E ganho ≥ 0,50 s · **âmbar** = padrão · **verde** = recuperação confirmada. O acento é uma fonte só (eu calculo, a J3 copia). Limiar 0,50 s é **provisório** — é preferência numa **superfície nova**. **Proponho isso; você decide.**
2. **Orçamento de texto do N1** (≤5 palavras/~28 caracteres) e **dwell mínimo** (~1,5 s): proponho os valores; dependem de teste no replay real da volta e do seu conforto de leitura. **Você calibra.**
3. **N3 (box) — quanto texto:** proponho parágrafo de recap. Se preferir enxuto (2–3 frases), digo.
4. **"Repetir vs calar" agressividade:** proponho pular ≥1 volta antes de repetir a mesma lição (hipótese da orientação). Se você quiser mais insistência, ajusto o limiar.

## 7. FRONTEIRAS RESPEITADAS
- **Não** projetei o algoritmo que escolhe a oportunidade (é da J2 — **consumo** o objeto v1 dela).
- **Não** desenhei o gráfico (é da J3 — divido o cartão pelo contrato §2.2; entrego o portão que ela obedece).
- **Não** formalizei o envelope `coach` (é da J4 — entrego a forma da `mensagem` e do `timing` para ela embrulhar).

## 8. Autoconferência da régua
preto (doc) · sem-emoji · **"você"** · 956×440 (respeitado; não movi nem cobri painel) · **número-sem-sinal** (direção por palavra+cor; ganho sempre positivo) · só-dado-real (marcha fora; `subTrecho:null` quando o "onde" não é confiável; estado honesto no silêncio) · **timing-seguro** (nunca em curva/freada; crítico vence; some antes da próxima freada) · **ganho-em-segundos** · painel-preservado (motor, v0 e painel intocados; coach soma por cima).

_Fim da entrega da Janela 1._
