# Janela 3 — O Gráfico com ZOOM do trecho (Parte A)

> Entrega viva da Janela 3 do Coach de IA de Stint. Dona do **GRÁFICO com zoom** (o que plota · como recorta/amplia · mockups escuros com medidas · onde senta · quando aparece/some). Trabalhadora sob o maestro Fable 5.
> Tudo conferido no código/dados REAIS (2026-07-08) e o método de zoom **rodado de verdade** com os conversores oficiais + o fixture (prova no §4). Onde um dado não existe ou diverge, está escrito — não inventei.
> Régua: preto `oklch(0% 0 0)` · sem-emoji (só traço) · "você" · 956×440 · número-sem-sinal (cor = direção) · só-dado-real · ganho-em-segundos · painel-preservado · timing-seguro (obedece o portão da J1).

---

## 0. TL;DR para o Fable e as outras janelas (leia primeiro)

- **O que o gráfico plota (recomendado):** um **recorte ampliado do traçado da curva** (o "caco" da pista onde o piloto está) com **duas linhas — a sua e a da referência** — sobre o desenho oficial de Brasília, o **sub-trecho em foco** destacado e a **bolinha do ápice** quando o alvo é ápice. Espacial = reconhecível num relance ("isso é o S"), que é o que se pede a 200 km/h. Velocidade × distância e traço de freio entram como **camadas de Fase 2** (a J4 já previu isso), não na Fase 1.
- **Como faz o zoom (método provado):** converto os pontos do traço (`oportunidade.tracos`) e o ápice com **`geoParaDesenho`** (espaço oficial 823×799), calculo o **bounding box** do traço + margem 14% → isso vira o **`viewBox` do SVG** = o recorte/ampliação. O contexto de pista de fundo sai de **`PONTOS_DESENHO`** fatiado pelo índice mais próximo do trecho (mesmo espaço 823×799). **Rodei isso com dado real** (Curva da Bruxa) — funciona (§4).
- **Achado de dado real (importante):** o arquivo `apices-semente-brasilia.js` **NÃO casa** espacialmente com os pontos das passagens do fixture para 7 das 8 curvas (divergência de 53–164 px; só a Curva 2 bate). **Consequência para o gráfico:** ancoro o zoom e a bolinha **no `oportunidade.tracos` e no `oportunidade.apice` da J2** (dado do trecho-detector), **não** no arquivo-semente. Isso coincide com o próprio comentário do arquivo ("sai de cena quando a melhor passagem calcular o ápice físico") e com o objeto v1 da J2. Detalhe no §5.
- **Onde senta:** **cartão único no miolo**, gráfico à **esquerda ≈60%**, mensagem (J1) à **direita ≈40%** — contrato §2.2. Medi o palco aprovado: proponho o cartão em **x 150→806, y 74→312** (gráfico **x 150→544**, mensagem **x 550→806**), 238 px de altura. Medidas e a colisão com os números gigantes (delta/freada) no §2 — **decisão para o Fable/Flávio**.
- **Quando aparece/some:** **não decido isso** — a J1 é dona do portão. O gráfico aparece e some **junto com a mensagem, no mesmo portão** (reta/fim-de-volta/box), **nunca no meio de curva**, e **o modo crítico do painel sempre vence** (some na hora). Eu só desenho; a J1 manda o `timing`.
- **Fronteira:** não escrevo a mensagem (J1) nem projeto a seleção (J2). **Consumo** o objeto oportunidade e desenho em cima.

---

## 1. O que eu consumo (do objeto v1 da J2) e o que devolvo (a `GraficoSpec`)

### 1.1 Campos da `oportunidade` (J2, `entregas/janela-2.md §1`) que o gráfico usa
| Campo | Uso no gráfico |
|---|---|
| `segmentId` | âncora do zoom (curva "herói" na recorrente; a própria na pontual) |
| `curvaNome` | rótulo de orientação (única string desenhada) |
| `tipoCurva` (`T0…SF`) | **SF (Vitória) → não desenha fita de freio** (pé embaixo); ajusta o realce |
| `subTrecho` (`entrada/freio/apice/pace/saida` **ou `null`**) | qual pedaço realçar; **`null` → realça a curva inteira**, sem banda de sub |
| `tracos` (`{atual:[{lat,lng,kmh,t,fracao,sub}], referencia:[...]}` **ou `null`**) | as **duas linhas**; **`null` → modo degradado** (só contexto de pista + estado honesto) |
| `apice` (`{distFromIdealM, angleFromIdealDeg}` **ou `null`**) | a **bolinha** ideal-vs-piloto quando `subTrecho='apice'` |
| `tipo` (`tecnica-recorrente`/`curva-pontual`/`outro`) | recorrente → badge discreto "× N curvas" (a curva desenhada é a herói) |

Todos existem no objeto v1 da J2 — conferido em `entregas/janela-2.md` linhas 27-53. **Não invento nenhum campo novo na oportunidade.**

### 1.2 O que devolvo — `GraficoSpec` (o campo `grafico` do pacote coach da J4)
A J4 formalizou o envelope: `grafico // <spec J3> segmentId + recorte/zoom + camadas` (`janela-4.md:56`) e o record C# `GraficoSpec Grafico` (`janela-4.md:73`). Preencho essa chave com:

```js
grafico = {
  versao: 1,
  segmentId,                 // = oportunidade.segmentId (âncora)
  rotulo,                    // = curvaNome (texto pequeno de orientação)
  acento,                    // 'ambar'|'vermelho'|'verde' — MESMA cor que a J1 usa (direção); nunca sinal
  recorte: {
    espaco: 'desenho-823x799',           // espaço do geoParaDesenho / PONTOS_DESENHO
    viewBox: { x, y, w, h },             // o RECORTE = bbox(traços ∪ ápice) + margem 14% (§4)
    contextoIdx: { de, ate },            // fatia de PONTOS_DESENHO p/ o traço da pista de fundo
  },
  camadas: {                 // O QUE desenhar. O SLOT é fixo; muda o conteúdo, nunca o layout.
    pistaContexto:   true,               // traço da pista de fundo (faint), dá o "onde"
    linhaReferencia: (tracos != null),   // a linha da referência (fantasma)
    linhaPiloto:     (tracos != null),   // a sua linha (cor = acento)
    apice:           (subTrecho === 'apice' && apice != null),
    destaqueSub:     (subTrecho != null),// banda do sub sobre o traço
    fitaMetrica:     null,               // Fase 2 opt-in: 'freio'|'vmin'|'saida'; null na Fase 1
  },
  recorrencia: (tipo === 'tecnica-recorrente')
                 ? { nCurvas, curvas:[curvaNome...] }   // badge "× N" (dado de evidencia.ocorrencias)
                 : null,
  degradado: (tracos == null)
                 ? { motivo:'sem-tracos', mostra:'pista-contexto + status' }  // silêncio honesto
                 : null,
}
```
Porte C# (paridade, aditivo): `record GraficoSpec(int Versao, string SegmentId, string Rotulo, string Acento, Recorte Recorte, Camadas Camadas, Recorrencia? Recorrencia, Degradado? Degradado)`. **Exige portar `geoParaDesenho` para C#** — função pura de ~6 linhas (`pista-oficial-brasilia.js:22-27`), mudança aditiva; a J4 trata o porte.

---

## 2. ONDE SENTA — medição do retângulo livre do miolo (palco aprovado)

> Tarefa da Rodada 0 que o Fable me deu (`do-fable.md`): **medir o retângulo livre real** e propor os px. Medi direto no `web/cockpit/cockpit-volta-real.html` + `cockpit.css` (aprovado 22/06). Origem = canto superior-esquerdo do `.device` (**956×440**, confirmado em `cockpit.css:54`).

### 2.1 Elementos PERMANENTES (sempre visíveis — o cartão NUNCA pode cobrir)
| Elemento | Caixa (x · y) | Fonte no código |
|---|---|---|
| Cluster de 14 sensores (topo) | x ~250–706 · **y 6–41** | HTML `.sensor-row{top:6px}` + 25px+padding |
| Barra de voltas | x 60–920 · **y 50–64** | HTML `.stint-bar{top:50px !important}` + `height:14px` |
| Luz de freio ESQ | **x 5–19** · y ~81–295 | HTML `.brake-light--left{left:5px}`, 9 dots |
| Luz de freio DIR | **x 937–951** · y ~81–295 | HTML `.brake-light--right{right:5px}` |
| Ápice + Entrada/Freio/Vmin/Saída | x 60–920 · **y 320–380** | `cockpit.css:88 .apex{bottom:60px;left:60;right:36;min-height:60}` |
| Shift light (17 LEDs) | centrado · **y ~396–430** | `cockpit.css:104 .shift-light{bottom:10px}` |

**Maior retângulo limpo desses permanentes:** **x 60→896 × y 72→312** (≈ 836×240). O miolo é largo — no meio só passam as duas colunas finas das luzes de freio, nas bordas.

### 2.2 A COLISÃO real (o que o Fable/Flávio precisa decidir)
Dois elementos **grandes e dirigidos por evento** ocupam a faixa vertical central:
- **Delta** (`info-bloco`): ancorado à esquerda (`left:72px`), centro vertical em `top:40%`≈y176; o número usa `--fs-9 = 180px` → ocupa ~**y 97–255** e cresce para a direita até ~**x 412** ("0.00"). Abaixo vem a frase de ação (até ~y300).
- **Resultado da freada / última volta** (`brake-result`): centro em `left:690px`, `top:40%`≈y176; mesmo `--fs-9` → ~**x 540–840 · y 97–255**.

O contrato §2.2 diz "delta à esquerda, freada à direita — nada se move nem é coberto". Tomado ao pé da letra, sobra só **x 412–540 (128 px)** no meio — **pequeno demais para gráfico + mensagem**. Então:

| Caminho | O que é | Cartão possível | Veredito |
|---|---|---|---|
| **(a) Reserva literal** | delta+freada ocupam a faixa central o tempo todo | só ~128×158 px central | **inviável** para ensinar |
| **(b) Tempo-exclusivo (recomendado)** | o cartão e os números gigantes **não coexistem**: os números são artefato de **saída de curva**; o cartão aparece na **reta/fim-de-volta/box** (portão da J1). O painel **já tem o gancho**: `device[data-msg-state="ativa"] .info-bloco` desliza o delta **−230 px** para abrir espaço (`cockpit.css:466-468`), e `ultima-volta` já esconde `brake-result` (mesmo padrão de "um cede ao outro", HTML:162). | cartão central generoso | **recomendado** |

**Recomendação (você decide, é território sensível):** caminho **(b)** — reusar o gancho que o painel **já tem** (delta desliza; freada cede quando a mensagem está ativa). Isso é **somar por cima dentro do padrão existente**, não redesenhar. A única adição de comportamento: enquanto o cartão do coach está no ar, o `brake-result` **cede** (fade/oculta) como o `ultima-volta` já faz — 1 regra CSS no mesmo espírito do painel. **Não altero o painel aqui; proponho e o Fable arbitra com a J1.**

### 2.3 O cartão proposto (px), caminho (b)
Centrado no palco (centro x=478), limpo de todos os permanentes:
```
CARTÃO   : x 150 → 806  (w 656)  ·  y 74 → 312  (h 238)
├─ GRÁFICO (J3, ≈60%) : x 150 → 544  (w 394)  ·  y 74 → 312  (h 238)
└─ MENSAGEM (J1, ≈40%): x 550 → 806  (w 256)  ·  y 74 → 312  (h 238)   (6 px de calha)
```
- Folga acima da barra de voltas (64 → 74 = 10 px) e abaixo do ápice (312 → 320 = 8 px). Nunca toca sensores, luzes de freio, shift, ápice.
- Slot **fixo**: o layout **não muda** com o conteúdo (regra do Flávio). Gráfico curto/alto → escala "contain" dentro do slot (§3.4), o slot não encolhe nem estica.
- Proporção 60/40 é **provisória** — o Fable arbitra com a J1 (ela quer ≥ ~256 px para 3 linhas de N2; 256 px cabe).

---

## 3. O QUE O GRÁFICO PLOTA — opções, trade-offs e recomendação

### 3.1 As opções reais
| Opção | O que mostra | Comunica em relance? | Cobre qual oportunidade? | Custo |
|---|---|---|---|---|
| **A · Traçado com zoom (recomendada)** | recorte da curva + **sua linha vs referência** + ápice + sub em foco | **Sim** — espacial, "isso é o S" | linha, ápice, e (com realce) entrada/freio/saída | baixo (geometria já existe) |
| **B · Velocidade × distância** | perfil de km/h ao longo do trecho, você vs referência | médio — exige ler eixo | Vmin/pace/tração; freada (onde cai) | médio (montar eixo) |
| **C · Traço de freio** | pressão/ponto de freio vs referência | médio | só freio/entrada | médio; **sem sensor de pressão hoje** (só ponto de freada por desaceleração do GPS) |
| **D · Combinação** | A + uma fita fina de B/C embaixo | alto, se a fita for glanceável | tudo | maior; risco de poluir |

### 3.2 Recomendação — **A (traçado com zoom) na Fase 1; D (A + fita métrica) na Fase 2**
Por quê A primeiro:
- **Reconhecimento espacial é o mais rápido de ler** a 200 km/h — o piloto já tem o mapa da curva na cabeça; ver "sua linha abrindo na saída do S" é imediato. Um gráfico de eixos exige decodificação que a reta curta não permite.
- **Reusa geometria que já existe e está selada** (`geoParaDesenho`, `PONTOS_DESENHO`, desenho DEFINITIVO do Flávio) — nada de inventar sistema de coordenadas.
- **Fala a mesma língua do painel:** a **bolinha do ápice** já é vocabulário aprovado; o gráfico a herda em vez de criar símbolo novo.
- **A J4 já desenhou o faseamento** nessa direção: Fase 1 = "recorte do trecho: linha do piloto vs referência" (`janela-4.md:136`); Fase 2 = "velocidade × distância, traço de freio" (`janela-4.md:146`). Minha recomendação encaixa no plano dela sem atrito.

Fase 2 (D) adiciona uma **fita métrica** fina e fixa **abaixo** do caco, que muda de papel conforme o `subTrecho` (freio → marcador do ponto de freada seu vs referência; pace → Vmin; saída → ponto de abertura do gás). Slot fixo: a fita **sempre existe** no layout (mesmo tamanho), só troca o rótulo — o layout não muda com o conteúdo.

### 3.3 A velocidade entra SEM virar segundo gráfico
Cada ponto do traço tem `kmh`. Codifico velocidade **na própria linha** (cor/gradiente de frio→quente ao longo do traço) — assim o "onde ele está lento" aparece na linha, sem segundo eixo. Isso dá parte do valor de B dentro de A, mantendo um só desenho.

### 3.4 A régua "número-sem-sinal" aplicada ao gráfico (reconciliação que a J1 me passou)
A J1 registrou (`janela-1.md:100`) que `oportunidade-trecho.js` renderiza metros **com sinal** (`+3 m`/`−3 m`) e que isso "vive na camada de marcas do gráfico (J3)… deixo a reconciliação para J3/Fable". **Minha resolução:** no gráfico, **direção nunca é sinal** — é **posição + cor**. Onde eu precisaria dizer "+3 m", desenho **a marca do piloto deslocada 3 m para o lado real** (antes/depois, dentro/fora) e a coloro pelo acento. Se um número aparecer, é **magnitude** ("3 m"), nunca "+3/−3". Assim o gráfico cumpre a regra de 04/07 do Flávio e não contradiz a mensagem da J1.

---

## 4. O MÉTODO DO ZOOM — conversores reais + PROVA executada

### 4.1 Os conversores (conferidos, abertos)
- **`geoParaDesenho(lat,lng) → {x,y}`** em `web/cockpit/pista-oficial-brasilia.js:22-27` — mapeia GPS para o **desenho oficial 823×799** (selo DEFINITIVO). É o espaço onde eu desenho.
- **`PONTOS_DESENHO`** (`pista-oficial-brasilia.js:29`) — **495 pontos** do traçado oficial, **já no espaço 823×799**. Fatiado, é o contexto de pista de fundo.
- **`APICES_SEMENTE_BRASILIA`** (`apices-semente-brasilia.js`) — ápice lat/lng por curva. **NÃO uso como âncora** (§5); fica como último recurso no modo degradado.
- **`fracDe(x,y) → 0..1`** (`web/command-box/pista-cb-polyline.js:12`) — fração de arco da volta. **CAVEAT DURO:** a `POLILINHA` de `fracDe` está em **outro espaço** (viewBox do Command Box `130 110 580 660`, `pista-cb-polyline.js:4`), **≠ 823×799** do `geoParaDesenho`. **Não misturar os dois.** Para fatiar o contexto eu uso índice-mais-próximo em `PONTOS_DESENHO` (mesmo espaço), não `fracDe`. O `fracao` que uso é o que já vem anotado em `tracos` (da J2), não recalculado por `fracDe`.

### 4.2 O algoritmo do recorte (determinístico, roda no `.exe`)
```
recorteDoTrecho(oportunidade):
  ref  = oportunidade.tracos.referencia.map(p => geoParaDesenho(p.lat, p.lng))   // 823×799
  meu  = oportunidade.tracos.atual.map(p => geoParaDesenho(p.lat, p.lng))
  pts  = ref ∪ meu ∪ (ápice ideal, se houver)
  bbox = boundingBox(pts)
  m    = 0.14                                        // margem de respiro (14%)
  viewBox = { x: bbox.minX - bbox.w*m, y: bbox.minY - bbox.h*m,
              w: bbox.w*(1+2m),        h: bbox.h*(1+2m) }         // ← o ZOOM
  // contexto de pista: índice de PONTOS_DESENHO mais próximo do centro do bbox, ±22 pts
  ci   = argmin_i dist(PONTOS_DESENHO[i], centro(bbox))
  contextoIdx = { de: max(0, ci-22), ate: min(494, ci+22) }
  return { espaco:'desenho-823x799', viewBox, contextoIdx }
```
O SVG usa esse `viewBox` e escala **"contain"** para dentro do slot 394×238 (o slot não muda; sobra vira letterbox preto). Sem `tracos` (§1), o recorte cai no ápice do arquivo-semente ± janela fixa e mostra só contexto + estado (degradado honesto).

### 4.3 PROVA — rodei com os conversores reais + o fixture (Curva da Bruxa)
Executei os módulos reais (`node`) convertendo passagens reais do fixture. Saída real:
```
PONTOS_DESENHO count: 495   espaço: 823x799
passagens BRUXA: 7   pts por passagem: 14,12,12,11,13,12,12
ref (menor tempo 9,999 s, pneu radial-185-14) → XY: 639,203 | 643,226 | 646,252 | 647,276 | 649,300 | ...
bbox do zoom (823×799): minX 564.8 · minY 203.1 · w 84.1 · h 251.7
viewBox c/ margem 14%: 553.1 167.9 107.6 322.2       ← o recorte que o SVG usa
idx de PONTOS_DESENHO mais perto do trecho: 276/495 (fatia ±22 → 254..298)
```
**Conclusão provada:** o pipeline `tracos → geoParaDesenho → bbox → viewBox` produz um recorte válido a partir de **dado real**, e o contexto de pista sai por índice no mesmo espaço. O método é construível hoje. (Script em `scratchpad/prova-zoom.mjs`.)

### 4.4 Honestidade sobre o limite físico
GPS ~1 Hz → **mediana ~8 pontos por passagem** (J2 §4.1; medi 11–14 na Bruxa). A linha é **esparsa**. Por isso: (1) suavizo com spline **Catmull-Rom** só para leitura, **sem inventar precisão** (a linha é interpolação visual, não medição fina); (2) a **bolinha do ápice** vem do `oportunidade.apice` (trecho-detector), **não** de escolher um ponto esparso do traço; (3) com RaceBox 25 Hz no futuro, a mesma spec fica muito mais fiel — nada muda no contrato.

---

## 5. ACHADO DE DADO — o ápice-semente NÃO casa com o traço em 4 das 8 curvas (e o que faço)

> **Correção (2026-07-08, após QA da J5):** minha 1ª medição disse "7/8". Estava **inflada pelo método** — eu comparava o ápice com o **ponto-do-meio** da lista de pontos da passagem, o que mede "o ápice está no meio do segmento?" e não "está sobre a linha?"; como os **limites de segmento estão tortos** (achado F1 da J5), o ápice físico não cai no meio temporal. A J5 refez com método melhor (distância **mínima em metros** do semente a qualquer ponto de qualquer passagem daquela curva) e **reproduzi/confiro os números**. O real é **4/8**. Minha decisão de ancoragem **fica de pé e foi endossada pelo QA**. Tabela vigente (fonte: `entregas/janela-5.md §2`):

```
Curva                  minDist(m)  (px)   Veredito
CURVA 01                    3,2      2    CASA
CURVA DA RETA OPOSTA        2,5      1    CASA
CURVA 2                     4,0      2    CASA
CURVA DA JUNÇÃO             5,2      3    CASA
CURVA DA BRUXA             70,4     41    DIVERGE   ← cenário-estrela
CURVA DO PLACAR           235,0    138    DIVERGE
CURVA "S"                  99,9     59    DIVERGE   ← cenário-estrela
CURVA DA VITÓRIA           82,4     49    DIVERGE
```
**Leitura:** 4 curvas divergem **feio** (70–235 m ≫ ruído de GPS ~1 Hz e ≫ o espaçamento de amostra ~11–22 m). A contraprova de rótulo da J5 mostra que **não é curva trocada** (nenhuma curva vizinha casa melhor). Ou seja: o ápice-semente está num registro diferente do das passagens para Bruxa, Placar, "S" e Vitória. Não é meu mandato consertar (é dado da J2/motor; a causa vai pra J2/J4 depois do QA).

**Consequência para o gráfico (decisão minha, dentro do meu escopo — endossada pelo QA da J5):**
1. **Âncora do zoom = `oportunidade.tracos`** (os pontos reais da passagem), nunca o ápice-semente.
2. **Bolinha = `oportunidade.apice` {distFromIdealM, angleFromIdealDeg}** da J2 (trecho-detector), posicionada relativa ao ponto de sub `apice` do `tracos.referencia`. Auto-consistente com o traço e **coincide com o objeto v1 da J2** (`janela-2.md:50-51`) e com o próprio aviso do arquivo-semente ("sai de cena quando a melhor passagem calcular o ápice físico", `apices-semente-brasilia.js:6`).
3. O arquivo-semente só entra como **último recurso** no modo degradado (`tracos==null`), com a ressalva visual de que é aproximado — e **sabendo que em Bruxa/"S" (os dois cenários-estrela) ele erra 70–100 m**, então no degradado o realce fica na curva inteira, sem cravar ponto.

**Por que a decisão fica de pé mesmo com 4/8 (e não 7/8):** as duas curvas que mais aparecem no coach (Bruxa e "S") estão **entre as que divergem** — usar o semente ali colocaria a bolinha/zoom no lugar errado. Ancorar no dado vivo elimina o risco nas 8, sem custo.

---

## 6. CAMADAS E CORES (tokens reais do painel — não invento paleta)

Uso os tokens do `cockpit.css:1-16` (mesma paleta OKLCH do painel):
| Camada | Estilo | Token real |
|---|---|---|
| Fundo do slot | preto puro | `--bg oklch(0% 0 0)` |
| Pista de contexto | traço fino, apagado | `--faint oklch(36% 0 0)`, ~2 px |
| **Linha da referência** (fantasma) | fria, discreta, tracejada | `--sistema oklch(78% 0.16 225)`, ~3 px |
| **Linha do piloto** | cor = **acento/direção** (a mesma que a J1) | `--bom` verde `oklch(80% .22 145)` / `--foco` âmbar `oklch(82% .19 70)` / `--erro` vermelho `oklch(68% .26 27)`, ~5 px + brilho |
| Velocidade na linha | gradiente frio→quente ao longo do traço | do `--sistema` ao `--foco` |
| **Bolinha do ápice** | ideal (fantasma) + piloto (acento) | herda o vocabulário da bolinha do painel |
| Banda do sub em foco | faixa suave sobre o traço | acento a baixa opacidade (~18%) |
| Rótulo da curva | texto pequeno, canto sup-esq do slot | `--muted oklch(58% 0 0)`, ~13 px (`--fs-2`) |
| Badge "× N curvas" (recorrente) | discreto, canto sup-dir | `--muted` |

Regras: **sem-emoji** (só formas/traço), **número-sem-sinal** (§3.4), contraste alto sobre preto, brilho igual ao do painel (glow suave) para leitura periférica. Nenhum eixo com texto na Fase 1 (o "quanto" é da mensagem da J1).

---

## 7. MOCKUPS ESCUROS COM MEDIDAS (dentro do slot do gráfico 394×238)

> ASCII = descrição precisa do layout; `▓`=preto, linha do piloto = `━`, referência = `┈`, bolinha ápice = `◉` (ideal `○`). Cores no §6. Casos = os cenários REAIS da J1/J2 (para a J5 cruzar).

### 7.1 Cenário A — Curva "S", saída/pace, ~1,0 s (a manchete do stint)
`subTrecho:'saida'` (ou `pace`), `tipo:'curva-pontual'`, `tipoCurva:'T4'`, acento **âmbar**.
```
 CARTÃO x150→806 · y74→312 (h238)
┌── GRÁFICO 394×238 ──────────────────┬── MENSAGEM 256×238 (J1) ──┐
│ CURVA "S"                    (rótulo)│  (slot da J1 — não é meu) │
│        ┈┈┈┈┈○ (referência, fria)     │                           │
│      ┈┈┈      ╲                      │                           │
│   ━━━━━━━━      ╲   ← você abre aqui  │                           │
│  ━         ╲     ╲                   │                           │
│ ━           ╲     ┈┈ (linha ideal)   │                           │
│  ▂▂▂▂▂▂▂ banda "SAÍDA" (âmbar 18%)   │                           │
│  [pista de contexto faint ao fundo]  │                           │
└──────────────────────────────────────┴───────────────────────────┘
 viewBox = bbox(traços do S)+14%  ·  contain no slot  ·  velocidade = cor da linha
```
Leitura em relance: sua linha (âmbar) **abrindo** na saída vs a referência (fria) que fecha e sai colada — o "onde perde" é visível sem número.

### 7.2 Cenário B — Técnica recorrente: freio (Bruxa herói + Junção + Curva 2), ~0,18 s
`subTrecho:'freio'`, `tipo:'tecnica-recorrente'`, herói = Bruxa, acento **vermelho**, `recorrencia:{nCurvas:3}`.
```
┌── GRÁFICO 394×238 ──────────────────┬── MENSAGEM (J1) ──┐
│ CURVA DA BRUXA              × 3 curvas (badge, canto)   │
│   ┈┈┈┈┈┈┈┈┈┈ (ref: freia fundo, entra rápido)          │
│  ┈          ╲                        │                  │
│ ━━━━━━━╲     ╲   ← você freia CEDO   │                  │
│         ╲     ╲  (marca do freio     │                  │
│  ┃seu    ╲     ┈┈  seu vs ref, §3.4) │                  │
│  ┃ref  ▂▂▂▂ banda "FREIO" (verm 18%) │                  │
│  [contexto faint]                    │                  │
└──────────────────────────────────────┴──────────────────┘
 marca do freio = posição (antes/depois), cor=direção — SEM sinal. Badge "× 3" = recorrência.
```
A curva desenhada é a **herói** (onde mais custa); o badge "× 3 curvas" diz que a lição vale para Junção e Curva 2 (a mensagem da J1 nomeia as três).

### 7.3 Cenário C — Ápice da Junção, 0,14 s, confiança média
`subTrecho:'apice'`, `tipo:'curva-pontual'`, `tipoCurva:'T2'`, acento **âmbar**, `apice:{distFromIdealM:~4, angleFromIdealDeg:...}`.
```
┌── GRÁFICO 394×238 ──────────────────┬── MENSAGEM (J1) ──┐
│ CURVA DA JUNÇÃO                      │                   │
│      ┈┈┈┈○┈┈┈┈  ○ = ápice IDEAL      │                   │
│    ┈┈      ╲   (fantasma)            │                   │
│  ━━━━━━━◉    ╲  ◉ = SEU ápice        │                   │
│ ━        ╲    ╲  (4 m por fora,      │                   │
│           ╲    ┈┈ da bolinha J2)     │                   │
│  [sem fita de freio — foco é ápice]  │                   │
│  [contexto faint]                    │                   │
└──────────────────────────────────────┴──────────────────┘
 bolinha = oportunidade.apice (trecho-detector), NÃO o arquivo-semente (§5). Magnitude "4 m", sem sinal.
```

### 7.4 Estado degradado — `tracos==null` ou J2 devolve `null`+`status` (silêncio honesto)
```
┌── GRÁFICO 394×238 ──────────────────┬── MENSAGEM (J1) ──┐
│                                      │ "Juntando dado —  │
│     [traçado de Brasília inteiro,    │  2 voltas" (J1)   │
│      bem apagado, sem linhas]        │                   │
│         · coletando ·                │                   │
└──────────────────────────────────────┴──────────────────┘
 Sem traços = sem linha inventada. Mostra contexto + estado. (ou o cartão nem aparece — decide a J1.)
```

---

## 8. QUANDO APARECE / SOME (obedeço o portão da J1)

**Não sou dona do timing.** A J1 é (`janela-1.md §3`). O que eu garanto:
- O gráfico **aparece e some junto com a mensagem, no mesmo portão único** — cartão inteiro entra e sai. A J1 manda `timing = {portao:'reta'|'fim-de-volta'|'box', nivel, podeMostrar, duracaoMs, prioridade:'critica-vence'}` (`janela-1.md:173-179`); eu **consumo**.
- **Nunca no meio de curva; some ANTES do próximo `entrada-cruzou`** (`janela-1.md:166`). O gráfico **fica pronto (pré-renderizado) quando a J2 fecha a análise no fim da volta** (`geradaNaVolta`), então quando o portão abre ele já está desenhado — sem custo de render competindo com a pista.
- **Modo crítico do painel SEMPRE vence** — cartão some na hora (`data-modo="critico"`), como delta/freada/ápice já somem (`cockpit-volta-real.html:147-150`). **Shift light e luz de freio nunca são cobertos** — meu slot (x150→806) já os evita por construção (§2).
- **Transição:** fade in/out do cartão inteiro em ~200–260 ms (coerente com as transições do painel), os dois slots juntos. Sem animação dentro do gráfico no calor da volta (nada de linha "desenhando" — distrai); o traço aparece pronto.
- **Dwell:** respeito o `duracaoMs` da J1 (mín ~1,5 s, teto = próxima zona de freada).

---

## 9. PLANO DE CONSTRUÇÃO (web-referência → `.exe`, encaixa no da J4)

- **Fase 1 (web-referência):** `GraficoSpec` v1 + `recorteDoTrecho()` (o algoritmo §4.2, JS puro) + um render SVG no slot do cartão (traçado + 2 linhas + banda do sub + bolinha quando ápice + rótulo). Camadas Fase-1 só (sem fita métrica). Teste: replay da volta real (o próprio painel já roda replay) + o `scratchpad/prova-zoom.mjs` vira teste de unidade do recorte (bbox estável por curva). Casa com a Fase 1 da J4 (`janela-4.md:136`).
- **Fase 2:** fita métrica (freio/vmin/saída) + velocidade-como-cor refinada + porte de `geoParaDesenho`/`recorteDoTrecho` para C# (paridade `GraficoSpec`), render no `MainWindow.xaml`. Casa com `janela-4.md:146`.
- **Não toca:** motor de delta, painel aprovado, v0 do `cerebro-coach.js` — o gráfico **soma por cima** (elemento 100% novo, não existe traçado no painel hoje).

---

## 10. Pendências / decisões para o Flávio (via Fable — não decido sozinho)
1. **Caminho da colisão (§2.2):** aprovar o **caminho (b)** (cartão tempo-exclusivo, reusando o gancho de deslize do delta + o `brake-result` cedendo como o `ultima-volta` já faz). É a única forma de o gráfico ter espaço real sem redesenhar o painel. **Território visual sensível — você decide.**
2. **Medidas do cartão (§2.3):** 60/40 e x150→806 são minha proposta; o Fable arbitra com a J1 (ela precisa de ≥256 px — cabe).
3. **Fase 1 = traçado com zoom** (não velocidade×distância). Confirmar a ordem.
4. **Furo de dado (§5):** ápice-semente × passagem divergem em 7/8 curvas — sinalizado para J2/J4 investigarem (não bloqueia o gráfico).

---

## 11. Autoconferência da régua
preto `oklch(0% 0 0)` (fundo do slot) · sem-emoji (só traço/formas) · "você" (n/a no gráfico, respeitado no rótulo) · **956×440** (cartão medido dentro, sem tocar permanentes) · **número-sem-sinal** (direção = posição+cor; magnitude só, §3.4) · **só-dado-real** (âncora em `tracos`/`apice` reais; método rodado com o fixture, §4; ápice-semente rejeitado por divergência provada, §5) · **ganho-em-segundos** (o "quanto" é da mensagem J1; o gráfico não exibe número de tempo) · **timing-seguro** (obedece o portão da J1; crítico vence; some antes da freada) · **painel-preservado** (elemento novo que soma por cima; nada movido/coberto sem ser a proposta (b) explícita ao Fable).

_Fim da entrega da Janela 3._
