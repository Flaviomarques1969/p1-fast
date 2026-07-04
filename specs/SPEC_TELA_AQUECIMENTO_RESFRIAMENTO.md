# SPEC — COCKPIT DO PILOTO em AQUECIMENTO (warmup) e COOL DOWN (resfriamento)

> Especificação técnica extraída do código real do P1 Fast (iMac), para replicar em
> outra sessão/máquina. Cada regra tem a referência `arquivo:linha`. **Nada aqui é
> inferido — tudo sai dos arquivos citados.** Data da leitura: 2026-07-03.
>
> ⚠️ **LEIA A SEÇÃO 5 ANTES DE CODAR.** Há um descompasso importante: a especificação
> existe no sistema de design, mas o cockpit APROVADO ainda NÃO a liga.

---

## 1. Onde a spec vive (fonte de verdade)

| Peça | Arquivo | Papel |
|---|---|---|
| **Definição visual** (chuva térmica, cores, intensidades, escandaloso) | `web/cockpit/cockpit.css` | fonte de verdade do comportamento |
| **Geração das gotas** (90 gotas SVG) | `web/cockpit/cockpit.js` (`rainLayer`, `cockpit.js:224-249`) | anima a chuva |
| **Único lugar que RENDERIZA hoje** | `web/cockpit/index.html` ("Mockup Cockpit · dinâmica de mensagem") | mockup — carrega `cockpit.js`, tem `.rain-layer` + `data-rain` |
| Cockpit APROVADO (notebook) | `web/cockpit/cockpit-volta-real.html` | **NÃO liga a chuva** (ver §5) |
| Cockpit APROVADO (iPhone) | `ios/p1fast-ios/Resources/Cockpit/cockpit-app.html` | **NÃO liga a chuva** (ver §5) |

Decisão de origem: **Flávio 27/05/2026** — "chuva térmica premium" resgatada do `mockup-cockpit-ghost.html`, e "bateu 70°C de água = visual escandaloso" (`cockpit.css:630` e `cockpit.css:725`).

---

## 2. Mecanismo — atributo `data-rain` no `.device`

A fase é controlada por UM atributo no elemento raiz do painel: `.device[data-rain="..."]`.
Sobre o painel inteiro há um overlay global `.rain-layer` (`cockpit.css:635-641`):
`position:absolute; inset:0; z-index:3; pointer-events:none; border-radius:48px;` — cobre tudo, não intercepta toque, transição de 900ms ao trocar de fase.

Valores possíveis de `data-rain` (`cockpit.css:694-708`):

| `data-rain` | Fase | Cor | Opacidade da chuva |
|---|---|---|---|
| `off` / vazio / ausente | sem chuva | — | 0 |
| `warmup-alto`  | AQUECIMENTO | **azul** `oklch(78% 0.20 232)` | 1.00 |
| `warmup-medio` | AQUECIMENTO | azul | 0.55 |
| `warmup-leve`  | AQUECIMENTO | azul | 0.20 |
| `cooldown-alto`  | COOL DOWN | **vermelho** `oklch(64% 0.30 22)` | 0.95 |
| `cooldown-medio` | COOL DOWN | vermelho | 0.50 |
| `cooldown-leve`  | COOL DOWN | vermelho | 0.18 |

**Regra de intensidade (a lógica do produto):** a intensidade **decai conforme a temperatura se aproxima da ideal** (`cockpit.css:633`). Longe do ideal → `-alto`; chegando perto → `-medio` → `-leve` → `off`. É o mesmo princípio tanto pra esquentar (warmup) quanto pra esfriar (cool down).

---

## 3. Comportamento visual exato (cores, direção, animação)

Todos os valores abaixo saem de `web/cockpit/cockpit.css` (linhas indicadas). Replicar idêntico.

### 3.1 AQUECIMENTO (`data-rain^="warmup"`)
- Cor: **azul** `oklch(78% 0.20 232)` (`cockpit.css:639`, é o default da camada).
- Gotas caem inclinadas **+8°**, animação `rainFall` (`cockpit.css:653-654, 710-715`).
- Halo (brilho de fundo) no **TOPO** do painel — `radial-gradient ... at 50% 25%` (`cockpit.css:681-688`).

### 3.2 COOL DOWN / RESFRIAMENTO (`data-rain^="cooldown"`)
- Cor: **vermelho** `oklch(64% 0.30 22)` (`cockpit.css:642`).
- Gotas inclinadas **-7°** (direção OPOSTA ao aquecimento), animação `rainFallCold` (`cockpit.css:657-660, 716-721`).
- Halo no **RODAPÉ** do painel — `radial-gradient ... at 50% 75%` (`cockpit.css:689-692`).

### 3.3 Comum às duas
- **90 gotas** SVG (`.drop`) em 3 camadas (frente/meio/fundo), geradas por `cockpit.js:224-249`; posição, duração e opacidade aleatórias por camada.
- Cada gota: gradiente da cor da fase + glow (`box-shadow` na cor corrente) (`cockpit.css:644-656`).
- **Splash** no rodapé: 6 respingos piscando a cada 1.6s (`.rain-layer::after`, `cockpit.css:662-679`).
- Troca de fase = transição suave de 900ms em cor e opacidade.

### 3.4 Barra do stint (complemento opcional)
- `.stint-bar__block.is-warmup` → gradiente **azul** (`cockpit.css:621-623`).
- `.stint-bar__block.is-cooldown` → gradiente **vermelho** (`cockpit.css:624-626`).
- Só cor de fundo do bloco — a chuva animada é o overlay global, não o bloco.

---

## 4. Alerta escandaloso térmico (crítico) — `data-alerta-critico="ativo"`

Fonte: `cockpit.css:723-744`. **Gatilho: água ≥ 70°C** (decisão Flávio 27/05/2026).
Quando ativo (`.device[data-alerta-critico="ativo"] .alerta-escandaloso`):
- **Halo vermelho** ao redor do painel inteiro, pulsando rápido (~0.42s, `escandaloso-halo`).
- **Borda inflamada** (moldura interna vermelha).
- **Mensagem no centro piscando** — no mockup: `MOTOR AQUECENDO` (`index.html:25`); a spec do CSS cita `ÁGUA SUBINDO` (`cockpit.css:728`).
- **Painel vibra** sutilmente.
- `z-index:55`, cobre acima da chuva.

> Observação: o escandaloso é um alerta de **superaquecimento** (problema), não a fase normal de warmup. Warmup normal = chuva azul; superaquecer no meio = escandaloso vermelho.

---

## 5. ⚠️ ESTADO REAL — o cockpit aprovado NÃO liga isso hoje (verificado)

Isto é o ponto crítico pra quem for replicar:

**`cockpit-volta-real.html` (notebook) e `cockpit-app.html` (iPhone), que são as versões APROVADAS:**
- **NÃO têm** `.rain-layer`, nem `data-rain`, nem `.alerta-escandaloso` no HTML — busca retornou vazio. → sem chuva térmica, sem escandaloso.
- A **barra do stint** deles NÃO usa `is-warmup`/`is-cooldown`. Ela colore por **RITMO**: verde = volta mais rápida que a anterior, vermelho = mais lenta, brilho = melhor da sessão, `is-current` = a atual em andamento (`cockpit-app.html:817-833`). Nenhum bloco "aquece/resfria".
- Estados que o cockpit aprovado TEM: `data-modo="normal"|"critico"`, sensores `off|ok|warn`, delta, luz de freio, resultado de frenagem, pista.

**Conclusão honesta:** a **especificação** da fase aquecimento/cool down EXISTE e está pronta no sistema de design (`cockpit.css`), e RODA no mockup `index.html`. Os **cortes de temperatura já estão decididos** (Flávio 27/05/2026 — água ideal 50°C / preditivo 70°C / crítico 80°C, `alertas-criticos.js:41-46`; calibração completa da chuva em `docs/SPEC_ELEMENTO_CHUVA_TERMICA.md` §5). O que **falta** é só o trabalho de LIGAR `data-rain` conforme a água do motor no cockpit final — implementação ainda não feita.

---

## 6. Checklist de replicação (para a outra sessão)

1. No `.device`, dirigir o atributo `data-rain` pela temperatura:
   - esquentando e longe do ideal → `warmup-alto` → `-medio` → `-leve` → `off` ao chegar na janela;
   - esfriando (in-lap / pós-sessão) → `cooldown-alto` → `-medio` → `-leve` → `off`.
2. Garantir o overlay `.rain-layer` no painel e gerar as **90 gotas** (portar `cockpit.js:224-249`).
3. Cores/direções/animações **idênticas** à §3 (valores aprovados — não recriar por aproximação).
4. Água ≥ 70°C → ligar `data-alerta-critico="ativo"` (escandaloso da §4).
5. A barra do stint aquece/resfria (§3.4) é opcional e complementar; o efeito principal é a chuva global.

---

## 7. Não confundir com o Command Box

O **Command Box** (TV do box, `_design-reference/mockup-command-box-vista-piloto.html`) tem OUTRO tratamento de aquece/resfria: blocos `aquece`/`resfria` na barra do stint (azul-gelo ↗ / vermelho ↖) e etiqueta "aquecendo/resfriando · alvo NN°" no painel de pneus. É tela diferente, não misturar com o cockpit do piloto.

---

_Gerado por leitura direta do código em 2026-07-03. Se algum arquivo/linha divergir na máquina de destino, reabrir os arquivos citados e conferir — não assumir._
