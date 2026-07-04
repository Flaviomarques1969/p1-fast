# SPEC DE IMPLEMENTAÇÃO — Elemento "CHUVA TÉRMICA" do Cockpit (aquecimento / cool down)

> Especificação completa e autossuficiente do efeito de **chuva térmica** do cockpit do
> piloto, para reimplementar em outra máquina/tecnologia (ex.: notebook Windows nativo)
> com a **mesma qualidade visual e o mesmo nível dinâmico**.
>
> Todos os números saem do código real do P1 Fast (iMac), lidos em 2026-07-03.
> Referências no formato `arquivo:linha`. As cores em RGB foram convertidas de oklch
> por script (não são estimativas de olho). **Nada aqui é inferido; onde falta decisão,
> está escrito "A DEFINIR".**
>
> Fontes canônicas:
> - `web/cockpit/cockpit.css` — definição visual (linhas 619-790)
> - `web/cockpit/cockpit.js` — geração das gotas (linhas 223-252)
> - Origem: mockup `mockup-cockpit-ghost.html`. Decisão Flávio 27/05/2026.
> - Contexto e ressalva de "ainda não ligado no cockpit aprovado": `docs/SPEC_TELA_AQUECIMENTO_RESFRIAMENTO.md` §5.

---

## 0. Resumo executivo (1 parágrafo)

Sobre o painel inteiro do cockpit cai uma **chuva** de tela cheia. Ela é **azul** quando a
água do motor está **abaixo da janela ideal** (aquecendo, até ~50°C) e **vermelha** quando
está **acima da ideal** (esquentando demais, precisa esfriar). A chuva é **mais forte quanto
mais longe da temperatura ideal** e some ao chegar na janela (50–55°C). São 90 gotas em 3
profundidades (umas grandes e rápidas na frente, outras pequenas e lentas ao fundo), com
brilho, respingo no chão e um halo de cor. Se a água passa de **70°C**, a chuva dá lugar a um
**alerta escandaloso** ("MOTOR AQUECENDO"); em **80°C** vira o crítico absoluto ("MOTOR
QUENTE"): o painel vira um halo vermelho pulsante com a mensagem gigante piscando no centro.

---

## 1. Área e sistema de coordenadas

- Painel (`.device`): **956 × 440 px**, cantos arredondados **48px**, `overflow:hidden`. (`cockpit.css:53-58`)
- A chuva é um **overlay que cobre 100% do painel** (`.rain-layer`): `position:absolute; inset:0; z-index:3; pointer-events:none; border-radius:48px; overflow:hidden`. (`cockpit.css:635-637`)
- As gotas caem de **cima (y = -40px) até o fundo (y = 490px)** — 490 > 440 de propósito, pra gota sair inteira por baixo. (`cockpit.css:711-714`)
- Ao reimplementar em outra resolução: tratar como espaço **956×440** e escalar proporcionalmente; a inclinação e as durações NÃO mudam com a escala.

### Pilha de camadas (z-index) — de baixo pra cima
| z | elemento | papel |
|---|---|---|
| 0 | conteúdo do cockpit (delta, sensores, pista) | painel normal |
| 3 | `.rain-layer` | **a chuva** (gotas + halo + respingo) |
| 55 | `.alerta-escandaloso` | alerta de 70°C (cobre tudo) |

---

## 2. Sistema de cores (oklch canônico + RGB convertido)

Use oklch se a plataforma suportar; senão, use o RGB (conversão exata por script).

| Uso | oklch (fonte de verdade) | RGB / hex (convertido) |
|---|---|---|
| **Gota — AQUECIMENTO (azul)** | `oklch(78% 0.20 232)` | **#00C9FF** — rgb(0,201,255) |
| **Gota — COOL DOWN (vermelho)** | `oklch(64% 0.30 22)` | **#FF0027** — rgb(255,0,39) |
| Barra stint aquece (grad topo→base) | `oklch(72% 0.14 235)` → `oklch(58% 0.18 235)` | #2EB1EF → #0086D4 |
| Barra stint resfria (grad topo→base) | `oklch(72% 0.18 35)` → `oklch(58% 0.22 30)` | #FF7350 → #DF2414 |
| Escandaloso vermelho base | `oklch(68% 0.26 27)` | #FF2A2F |
| Escandaloso vermelho brilhante | `oklch(78% 0.30 27)` | #FF323A |
| Escandaloso texto | `oklch(98% 0.10 25)` | #FFDFD7 |

> Nota: em oklch, mudar de fase é só **trocar o matiz (H)** e a intensidade — a cor da gota
> usa `currentColor`, então basta animar a cor do container e as gotas, o glow e o halo
> acompanham juntos.

---

## 3. Modelo da gota — algoritmo exato (`cockpit.js:223-252`)

Gera-se **90 gotas** (`gerarChuva(n=90)`). Para cada gota, sorteia-se `r = random()` e cai
numa de **3 camadas de profundidade**:

| Camada | Probabilidade | Largura (px) | Altura (px) | Duração queda (s) | Opacidade base |
|---|---|---|---|---|---|
| **Frente** (grande/rápida/opaca) | `r < 0.15` (15%) | 2.4–3.2 | 26–44 | 1.0–1.6 | 0.85–1.00 |
| **Meio** | `0.15 ≤ r < 0.70` (55%) | 1.4–2.0 | 14–28 | 1.5–2.5 | 0.65–0.95 |
| **Fundo** (pequena/lenta/fraca) | `r ≥ 0.70` (30%) | 0.9–1.3 | 8–18 | 2.4–3.9 | 0.30–0.60 |

Por gota, ainda:
- **posição horizontal** `left`: aleatória 0–100% da largura;
- **atraso da animação** `animation-delay`: aleatório **-0 a -2.5s** (negativo → cada gota
  começa num ponto diferente da queda, então na hora que liga já está "chovendo cheio",
  sem onda de entrada);
- **duração** e **opacidade**: da camada (tabela acima).

**Forma da gota** (`cockpit.css:644-656`):
- retângulo fino com `border-radius:2px`;
- preenchimento é um **gradiente vertical da cor da fase**: 0–30% cor cheia → 60% cor a 50% → 100% transparente (a gota tem "cabeça" sólida e "cauda" que some);
- **glow**: `box-shadow: 0 0 4px currentColor, 0 0 10px (cor a 35%)` — cada gota brilha;
- inclinação base **+8°** (aquecimento) — ver §4.

---

## 4. Animação de queda (a dinâmica)

Duas animações, uma por fase — a diferença NÃO é só cor, é a **direção**:

### 4.1 Aquecimento — `rainFall` (`cockpit.css:710-715`)
- gota inclinada **+8°**;
- keyframes: `0%` em y=-40px, opacidade 0 → `8%` opacidade 1 → `88%` opacidade 1 → `100%` em y=490px, opacidade 0;
- `animation-timing-function: linear`, `infinite`.

### 4.2 Cool down — `rainFallCold` (`cockpit.css:716-721`)
- gota inclinada **-7°** (cai "para o outro lado");
- keyframes: `0%` y=-40 op0 → `10%` op1 → `85%` op1 → `100%` y=490 op0;
- `linear infinite`.

**Regra:** aquecimento = gotas ↘ (+8°); cool down = gotas ↙ (-7°). É essa inversão de
sentido, junto com a cor, que dá a leitura instantânea de "esquentando" vs "esfriando".

### 4.3 Envelope de opacidade
A opacidade de cada gota some nas pontas (entra/sai transparente) e fica cheia no miolo do
trajeto — some suave em cima e embaixo. É por gota, além da opacidade global da §5.

---

## 5. Intensidade × temperatura (a lógica do produto)

A intensidade é controlada por um atributo `data-rain` no painel. Cada nível define a
**opacidade global** da chuva inteira (`cockpit.css:694-708`):

| `data-rain` | Fase | Opacidade global |
|---|---|---|
| `off` / vazio / ausente | sem chuva | 0 |
| `warmup-alto`  | aquecimento | **1.00** |
| `warmup-medio` | aquecimento | 0.55 |
| `warmup-leve`  | aquecimento | 0.20 |
| `cooldown-alto`  | cool down | **0.95** |
| `cooldown-medio` | cool down | 0.50 |
| `cooldown-leve`  | cool down | 0.18 |

**Regra de negócio (`cockpit.css:633`):** *a intensidade decai conforme a temperatura se
aproxima da ideal.*

**Cortes de temperatura — DECISÃO FLÁVIO 27/05/2026 (já informados, não é "a definir").**
O sensor que rege a chuva é a **água do motor** (`waterTempC`, do T3000/T4000). Âncoras
**confirmadas no código** `web/cockpit/alertas-criticos.js:41-46` (`ALERTA_LIMITES_DEFAULT`):
ideal **50°C**, preditivo **70°C**, crítico **80°C**. Calibração completa da chuva
(decisão registrada — memória `p1fast-bubi-temperatura-operacional`):

| Água do motor | Estado da tela | `data-rain` |
|---|---|---|
| **< 45°C** | aquecendo (azul forte no começo, sumindo perto de 50) | `warmup-alto` |
| **45–48°C** | aquecendo | `warmup-medio` |
| **48–50°C** | quase na janela | `warmup-leve` |
| **50–55°C** (centro 50) | **janela ideal — carro pronto** | `off` (sem chuva) |
| **55–65°C** | subindo, ainda tolerável | `cooldown-leve` |
| **65–70°C** | subindo | `cooldown-medio` |
| **≥ 70°C** | **preditivo escandaloso — "MOTOR AQUECENDO"** | `cooldown-alto` + `data-alerta-critico="ativo"` |
| **≥ 80°C** | **crítico absoluto — "MOTOR QUENTE"** (sobrepõe tudo) | escandaloso crítico |

> **Semântica do Bubi (importante):** o motor opera FRIO (~50°C). Aqui azul/vermelho NÃO é
> volta de saída/entrada — é temperatura **relativa à janela ideal**: **azul = ainda abaixo
> dos 50** (aquecendo); **vermelho = passou dos 50 subindo** (esquentando demais, precisa
> esfriar). Por isso subir de 55°C já vira vermelho.

> Implementação: a máquina recebe a água do motor ao vivo e mapeia pra um dos 7 estados de
> `data-rain`. Os cortes acima são os do **Bubi (Celta 1.4)**; deixar **parametrizável** por
> carro (vêm do cadastro / `ALERTA_LIMITES_DEFAULT`), não fixar no código da tela.

### 5.1 Segundo gatilho do "MOTOR AQUECENDO" — por padrão histórico
Além do corte absoluto (70°C), o "MOTOR AQUECENDO" também dispara por **desvio do padrão
aprendido**: o sistema aprende o padrão da combinação (carro + autódromo + pneu) em **3
voltas** e alerta quando a temperatura fica **20% acima** desse padrão (decisão Flávio
27/05/2026; código `alertas-criticos.js:185-189`, memória `p1fast-deteccao-por-padrao-historico`).
Para a CHUVA, o que vale é a tabela de água acima; o padrão histórico é um gatilho a mais
do alerta escandaloso.

---

## 6. Halo e respingo (acabamento premium)

### 6.1 Halo de cor (brilho ambiente) — `.rain-layer::before` (`cockpit.css:681-692`)
- **Aquecimento:** halo azul no **TOPO** do painel — `radial-gradient(ellipse 80% 70% at 50% 25%, azul 35% → transparente 65%)`, opacidade 0.85 (0.30 no `-leve`). (`cockpit.css:705-708`)
- **Cool down:** halo vermelho no **RODAPÉ** — mesmo gradiente em `at 50% 75%`, opacidade 0.75. (`cockpit.css:689-692, 706`)
- `mix-blend-mode:screen`, transição de 900ms.

### 6.2 Respingo no chão — `.rain-layer::after` (`cockpit.css:662-679`)
- faixa de **24% de altura** colada no fundo;
- **6 respingos** (elipses pequenas) em posições fixas (12%, 28%, 44%, 60%, 76%, 90% da largura), na cor da fase;
- `filter:blur(.6px)`, `mix-blend-mode:screen`;
- **cintila**: animação `splashFlicker 1.6s ease-inout infinite`, opacidade oscila 0.30 ↔ 0.65. (`cockpit.css:676-679`)

---

## 7. Alerta escandaloso (superaquecimento — água ≥ 70°C)

Camada separada `.alerta-escandaloso` (z-index 55), ligada por `data-alerta-critico="ativo"`
no painel. Dois níveis (decisão Flávio 27/05/2026; limites em `alertas-criticos.js:41-46`):
- **Água ≥ 70°C → "MOTOR AQUECENDO"** (preditivo escandaloso — gravidade `super`).
- **Água ≥ 80°C → "MOTOR QUENTE"** (crítico absoluto — sobrepõe tudo, gravidade `super`).

Visual (o mesmo pros dois, muda só o texto): (`cockpit.css:723-790`)

Quando ativa, ao mesmo tempo:
1. **Halo vermelho pulsante** ao redor do painel — animação `escandaloso-halo` **0.42s
   steps(2) infinite**, alternando entre (`cockpit.css:745-754`):
   - estado A: moldura interna 4px + glow interno 80px + glow externo 60px, vermelho `oklch(68% 0.26 27)` a 55–85%;
   - estado B (mais forte): moldura 6px + glow interno 120px + glow externo 100px, vermelho `oklch(78% 0.30 27)` a 80–100%.
2. **Mensagem gigante no centro** (`.alerta-escandaloso__texto`, `cockpit.css:755-774`):
   - fonte Inter, **62px**, peso **900**, caixa alta, duas linhas empilhadas (ex.: `MOTOR` / `AQUECENDO`), cor #FFDFD7;
   - sombra: glow vermelho `0 0 24px` + `0 0 48px` **e** contorno preto (2px pros dois lados);
   - **pisca**: `escandaloso-blink 0.4s steps(2) infinite` — opacidade 0.3↔1 e **escala 1.0↔1.08** (a mensagem "respira" pulsando). (`cockpit.css:787-790`)
3. **Foco total** — somem delta central, mensagem lateral e os widgets Entrada/Freio/Ápice/Saída (`opacity:0`, transição 240ms). Só o alerta na tela. (`cockpit.css:776-786`)

> Distinção importante: **warmup normal = chuva azul.** O escandaloso é o caso de
> **superaquecer** (problema), não a fase normal de aquecer. São coisas diferentes.

---

## 8. Barra do stint (complemento, opcional)

Blocos da barra de voltas podem colorir a fase (`cockpit.css:619-626`):
- `.is-warmup` → gradiente azul (#2EB1EF → #0086D4);
- `.is-cooldown` → gradiente vermelho (#FF7350 → #DF2414).
É só cor de fundo do bloco — **o efeito principal é a chuva global**, não o bloco.

---

## 9. Curvas de animação e fontes (tokens) — `cockpit.css:1-39`

| Token | Valor | Onde |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | transições de entrada/saída |
| `--ease-inout` | `cubic-bezier(0.65, 0, 0.35, 1)` | cintilar do respingo |
| `--ease-msg` | `cubic-bezier(0.16, 1, 0.3, 1)` | mensagens |
| Fonte display | Inter (500–900) | mensagem escandalosa |
| Fonte mono | JetBrains Mono | telemetria |

- **Troca de fase** (azul↔vermelho, ou mudança de intensidade): transição de **900ms** com `--ease-out`, em cor e opacidade (`cockpit.css:640, 686`). Nunca cortar seco — sempre cross-fade.
- Queda das gotas: **linear** (constante), sem easing.

---

## 10. Tabela-resumo de parâmetros (para portar)

| Parâmetro | Valor |
|---|---|
| Nº de gotas | 90 |
| Camadas | 3 (frente 15% / meio 55% / fundo 30%) |
| Largura da gota | 0.9–3.2 px (por camada) |
| Altura da gota | 8–44 px (por camada) |
| Duração da queda | 1.0–3.9 s (por camada), linear |
| Atraso inicial | -0 a -2.5 s (aleatório, negativo) |
| Trajeto | y: -40px → 490px |
| Inclinação aquecimento | +8° |
| Inclinação cool down | -7° |
| Glow por gota | box-shadow 4px + 10px na cor |
| Opacidade global (7 estados) | 0 / .20 / .55 / 1.0 (warm) · .18 / .50 / .95 (cool) |
| Halo aquecimento | topo (50% 25%), opacidade .85 |
| Halo cool down | rodapé (50% 75%), opacidade .75 |
| Respingos | 6 elipses, cintilam 1.6s (0.30↔0.65) |
| Transição de fase | 900ms ease-out (cor + opacidade) |
| Sensor que rege a chuva | água do motor (`waterTempC`, T3000/T4000) |
| Cortes da chuva (Bubi) | <45 alto · 45–48 médio · 48–50 leve · 50–55 OFF · 55–65 cool-leve · 65–70 cool-médio · ≥70 cool-alto+alerta |
| Escandaloso: gatilho | ≥70°C "MOTOR AQUECENDO" · ≥80°C "MOTOR QUENTE" |
| Escandaloso: halo | pulsa 0.42s steps(2) |
| Escandaloso: mensagem | 62px/900, pisca 0.4s, escala 1.0↔1.08 |

---

## 11. Critério de aceite ("mesma qualidade")

A reimplementação está correta quando:
1. Chuva **azul** no aquecimento com gotas inclinadas ↘, **vermelha** no cool down inclinadas ↙.
2. As 3 profundidades são perceptíveis (gotas grandes e nítidas na frente; pequenas e apagadas ao fundo).
3. Cada gota **brilha** (glow) e tem cabeça sólida + cauda que some.
4. Tem **halo** de cor (topo no aquece, rodapé no cool down) e **respingo cintilante** no chão.
5. A intensidade **sobe/desce** conforme a temperatura (7 estados), sem cortar seco (cross-fade 900ms).
6. Água ≥70°C → entra o **escandaloso** (halo pulsante + mensagem gigante piscando + esconde o resto).
7. Cores batem com o RGB da §2.

---

## 12. Anexo — código de referência (verbatim)

### 12.1 Geração das gotas — `web/cockpit/cockpit.js:223-252`
```js
// Chuva térmica premium — gera 90 gotas em 3 camadas (foreground/midground/background)
const rainLayer = document.getElementById('rainLayer');
function gerarChuva(n=90){
  if(!rainLayer) return;
  rainLayer.innerHTML = '';
  for(let i=0; i<n; i++){
    const drop = document.createElement('span');
    drop.className = 'drop';
    const r = Math.random();
    let camada;
    if(r < 0.15){
      camada = { w: 2.4 + Math.random()*0.8, h: 26 + Math.random()*18,
                 dur: 1.0 + Math.random()*0.6, op: 0.85 + Math.random()*0.15 };
    } else if(r < 0.70){
      camada = { w: 1.4 + Math.random()*0.6, h: 14 + Math.random()*14,
                 dur: 1.5 + Math.random()*1.0, op: 0.65 + Math.random()*0.30 };
    } else {
      camada = { w: 0.9 + Math.random()*0.4, h: 8 + Math.random()*10,
                 dur: 2.4 + Math.random()*1.5, op: 0.30 + Math.random()*0.30 };
    }
    drop.style.left = (Math.random()*100) + '%';
    drop.style.width = camada.w.toFixed(2) + 'px';
    drop.style.height = camada.h.toFixed(0) + 'px';
    drop.style.animationDelay = (-Math.random()*2.5).toFixed(2) + 's';
    drop.style.animationDuration = camada.dur.toFixed(2) + 's';
    drop.style.opacity = camada.op.toFixed(2);
    rainLayer.appendChild(drop);
  }
}
gerarChuva();
```

### 12.2 Estilo e animação — `web/cockpit/cockpit.css:635-721` (essencial)
```css
.rain-layer{
  position:absolute;inset:0;z-index:3;pointer-events:none;
  overflow:hidden;border-radius:48px;
  opacity:0;
  color: oklch(78% 0.20 232);          /* azul aquecimento (default) */
  transition:opacity 900ms var(--ease-out), color 900ms var(--ease-out);
}
.device[data-rain^="cooldown"] .rain-layer{ color: oklch(64% 0.30 22); } /* vermelho */

.rain-layer .drop{
  position:absolute;top:-40px;border-radius:2px;
  background:linear-gradient(to top,
    currentColor 0%, currentColor 30%,
    color-mix(in oklch, currentColor 50%, transparent) 60%, transparent 100%);
  box-shadow:0 0 4px currentColor, 0 0 10px color-mix(in oklch, currentColor 35%, transparent);
  transform:rotate(8deg);
  animation:rainFall linear infinite;
}
.device[data-rain^="cooldown"] .rain-layer .drop{
  transform:rotate(-7deg); animation-name:rainFallCold;
}

/* intensidades */
.device[data-rain="warmup-alto"]    .rain-layer{ opacity:1.0; }
.device[data-rain="warmup-medio"]   .rain-layer{ opacity:.55; }
.device[data-rain="warmup-leve"]    .rain-layer{ opacity:.20; }
.device[data-rain="cooldown-alto"]  .rain-layer{ opacity:.95; }
.device[data-rain="cooldown-medio"] .rain-layer{ opacity:.50; }
.device[data-rain="cooldown-leve"]  .rain-layer{ opacity:.18; }

@keyframes rainFall{
  0%{transform:translateY(-40px) rotate(8deg);opacity:0;}
  8%{opacity:1;} 88%{opacity:1;}
  100%{transform:translateY(490px) rotate(8deg);opacity:0;}
}
@keyframes rainFallCold{
  0%{transform:translateY(-40px) rotate(-7deg);opacity:0;}
  10%{opacity:1;} 85%{opacity:1;}
  100%{transform:translateY(490px) rotate(-7deg);opacity:0;}
}
```
(Halo `::before`, respingo `::after` e escandaloso: `cockpit.css:662-790` — copiar verbatim de lá ao portar.)

---

_Gerado por leitura direta do código em 2026-07-03. Cores RGB convertidas de oklch por
script (fórmula oklch→sRGB padrão). Se algum arquivo/linha divergir na máquina de destino,
reabrir os arquivos citados e conferir — não assumir._
