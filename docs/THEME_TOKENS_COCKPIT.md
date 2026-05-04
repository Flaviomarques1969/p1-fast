# THEME TOKENS — Cockpit ao vivo (Sprint 1B)

Pré-extração para o **Sprint 1B** (cockpit ao vivo).

Os 3 mockups do cockpit usam paleta INTENCIONALMENTE diferente do hub (Padrão B). Cockpit é instrumento operacional pra leitura periférica em luz solar — `--bg=oklch(0%)` preto puro pra contraste máximo, vs hub `oklch(20%)` cinza escuro pra UI normal. Theme.swift do app deve expor 2 tracks de tokens com namespace separado (`Color.cockpit.bg` vs `Color.hub.bg`) ou contexto via Environment.

Conversão OKLCH→sRGB via `tools/oklch-to-srgb.mjs` (mesmo conversor do hub).

## Resumo

| Categoria | Qtd |
|---|---|
| REDEFINIDOS (mesmo nome, OKLCH diferente do hub) | 3 |
| NOVOS (só cockpit) | 21 |
| IGUAIS ao Padrão B | 0 |

## ⚠ Tokens redefinidos vs hub

**Decisão crítica**: Theme.swift precisa de namespace separado pra evitar choque (mesmo `--bg` significa coisa diferente). Sugestão: `Color.Cockpit` enum vs `Color.Hub` enum.

| Token | Hub (Padrão B) | Cockpit | Hex cockpit | Mockups |
|---|---|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `oklch(0% 0 0)` | `#000000` | 3 |
| `--surface` | `oklch(24% 0.005 240)` | `oklch(11% 0 0)` | `#040404` | 3 |
| `--hairline` | `oklch(33% 0.005 240)` | `oklch(28% 0 0)` | `#292929` | 3 |

## Tokens novos (só cockpit)

Adicionar ao namespace `Color.Cockpit` em Theme.swift.

| Token | OKLCH | Hex | RGB(A) | Categoria |
|---|---|---|---|---|
| `--border` | `oklch(22% 0 0)` | `#1b1b1b` | `rgb(27, 27, 27)` | core |
| `--ink` | `oklch(100% 0 0)` | `#ffffff` | `rgb(255, 255, 255)` | core |
| `--muted` | `oklch(58% 0 0)` | `#7a7a7a` | `rgb(122, 122, 122)` | core |
| `--faint` | `oklch(36% 0 0)` | `#3d3d3d` | `rgb(61, 61, 61)` | core |
| `--bom` | `oklch(80% 0.22 145)` | `#45e059` | `rgb(69, 224, 89)` | core |
| `--erro` | `oklch(68% 0.26 27)` | `#ff2a2f` | `rgb(255, 42, 47)` | core |
| `--sistema` | `oklch(78% 0.16 225)` | `#00cbff` | `rgb(0, 203, 255)` | core |
| `--foco` | `oklch(82% 0.19 70)` | `#ffaa00` | `rgb(255, 170, 0)` | core |
| `--ouro` | `oklch(74% 0.16 73)` | `#e79800` | `rgb(231, 152, 0)` | core |
| `--halo-recorde` | `oklch(78% 0.18 65 / .42)` | `#ff9b00` | `rgba(255, 155, 0, 0.42)` | halo |
| `--halo-pior` | `oklch(56% 0.22 305 / .42)` | `#9442d9` | `rgba(148, 66, 217, 0.42)` | halo |
| `--ghost-cyan` | `oklch(78% 0.16 225)` | `#00cbff` | `rgb(0, 203, 255)` | ghost overlay |
| `--ghost-cyan-soft` | `oklch(78% 0.16 225 / .55)` | `#00cbff` | `rgba(0, 203, 255, 0.55)` | ghost overlay |
| `--warmup-1` | `oklch(72% 0.22 30)` | `#ff5d48` | `rgb(255, 93, 72)` | fase térmica |
| `--warmup-2` | `oklch(82% 0.21 60)` | `#ff9c00` | `rgb(255, 156, 0)` | fase térmica |
| `--warmup-3` | `oklch(88% 0.18 85)` | `#ffcc03` | `rgb(255, 204, 3)` | fase térmica |
| `--cooldown-1` | `oklch(70% 0.14 230)` | `#00ade4` | `rgb(0, 173, 228)` | fase térmica |
| `--cooldown-2` | `oklch(82% 0.10 215)` | `#70d5ed` | `rgb(112, 213, 237)` | fase térmica |
| `--cooldown-3` | `oklch(92% 0.06 210)` | `#b7f0fb` | `rgb(183, 240, 251)` | fase térmica |
| `--rain-aquec` | `oklch(78% 0.20 232)` | `#00c9ff` | `rgb(0, 201, 255)` | chuva térmica |
| `--rain-resfri` | `oklch(64% 0.30 22)` | `#ff0027` | `rgb(255, 0, 39)` | chuva térmica |

## Por mockup (auditoria)

### Cockpit base — `_design-reference/mockup-cockpit-piloto.html`

14 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(0% 0 0)` | `#000000` |
| `--surface` | `oklch(11% 0 0)` | `#040404` |
| `--border` | `oklch(22% 0 0)` | `#1b1b1b` |
| `--hairline` | `oklch(28% 0 0)` | `#292929` |
| `--ink` | `oklch(100% 0 0)` | `#ffffff` |
| `--muted` | `oklch(58% 0 0)` | `#7a7a7a` |
| `--faint` | `oklch(36% 0 0)` | `#3d3d3d` |
| `--bom` | `oklch(80% 0.22 145)` | `#45e059` |
| `--erro` | `oklch(68% 0.26 27)` | `#ff2a2f` |
| `--sistema` | `oklch(78% 0.16 225)` | `#00cbff` |
| `--foco` | `oklch(82% 0.19 70)` | `#ffaa00` |
| `--ouro` | `oklch(74% 0.16 73)` | `#e79800` |
| `--halo-recorde` | `oklch(78% 0.18 65 / .42)` | `#ff9b00` |
| `--halo-pior` | `oklch(56% 0.22 305 / .42)` | `#9442d9` |

### Cockpit ghost — `_design-reference/mockup-cockpit-ghost.html`

24 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(0% 0 0)` | `#000000` |
| `--surface` | `oklch(11% 0 0)` | `#040404` |
| `--border` | `oklch(22% 0 0)` | `#1b1b1b` |
| `--hairline` | `oklch(28% 0 0)` | `#292929` |
| `--ink` | `oklch(100% 0 0)` | `#ffffff` |
| `--muted` | `oklch(58% 0 0)` | `#7a7a7a` |
| `--faint` | `oklch(36% 0 0)` | `#3d3d3d` |
| `--bom` | `oklch(80% 0.22 145)` | `#45e059` |
| `--erro` | `oklch(68% 0.26 27)` | `#ff2a2f` |
| `--sistema` | `oklch(78% 0.16 225)` | `#00cbff` |
| `--foco` | `oklch(82% 0.19 70)` | `#ffaa00` |
| `--ouro` | `oklch(74% 0.16 73)` | `#e79800` |
| `--halo-recorde` | `oklch(78% 0.18 65 / .42)` | `#ff9b00` |
| `--halo-pior` | `oklch(56% 0.22 305 / .42)` | `#9442d9` |
| `--ghost-cyan` | `oklch(78% 0.16 225)` | `#00cbff` |
| `--ghost-cyan-soft` | `oklch(78% 0.16 225 / .55)` | `#00cbff` |
| `--warmup-1` | `oklch(72% 0.22 30)` | `#ff5d48` |
| `--warmup-2` | `oklch(82% 0.21 60)` | `#ff9c00` |
| `--warmup-3` | `oklch(88% 0.18 85)` | `#ffcc03` |
| `--cooldown-1` | `oklch(70% 0.14 230)` | `#00ade4` |
| `--cooldown-2` | `oklch(82% 0.10 215)` | `#70d5ed` |
| `--cooldown-3` | `oklch(92% 0.06 210)` | `#b7f0fb` |
| `--rain-aquec` | `oklch(78% 0.20 232)` | `#00c9ff` |
| `--rain-resfri` | `oklch(64% 0.30 22)` | `#ff0027` |

### Cockpit comparação — `_design-reference/mockup-cockpit-comparacao.html`

14 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(0% 0 0)` | `#000000` |
| `--surface` | `oklch(11% 0 0)` | `#040404` |
| `--border` | `oklch(22% 0 0)` | `#1b1b1b` |
| `--hairline` | `oklch(28% 0 0)` | `#292929` |
| `--ink` | `oklch(100% 0 0)` | `#ffffff` |
| `--muted` | `oklch(58% 0 0)` | `#7a7a7a` |
| `--faint` | `oklch(36% 0 0)` | `#3d3d3d` |
| `--bom` | `oklch(80% 0.22 145)` | `#45e059` |
| `--erro` | `oklch(68% 0.26 27)` | `#ff2a2f` |
| `--sistema` | `oklch(78% 0.16 225)` | `#00cbff` |
| `--foco` | `oklch(82% 0.19 70)` | `#ffaa00` |
| `--ouro` | `oklch(74% 0.16 73)` | `#e79800` |
| `--halo-recorde` | `oklch(78% 0.18 65 / .42)` | `#ff9b00` |
| `--halo-pior` | `oklch(56% 0.22 305 / .42)` | `#9442d9` |

## Swatches da comparação (não tokenizadas no mockup)

`mockup-cockpit-comparacao.html` linhas 76-77 usam 2 cores **hardcoded inline** (não viraram CSS variable). Vão entrar em Theme.swift como `Color.Cockpit.compareSwatchOrange` e `Color.Cockpit.compareSwatchPurple` quando o cockpit comparação for portado (Sprint 1B-7).

| Uso CSS | OKLCH | Hex |
|---|---|---|
| `.compare-row--orange .swatch` | `oklch(78% 0.18 65)` | `#ff9b00` |
| `.compare-row--purple .swatch` | `oklch(56% 0.22 305)` | `#9442d9` |

Notar que **compareSwatchOrange === --halo-recorde com alpha=1** e **compareSwatchPurple === --halo-pior com alpha=1**. Em Theme.swift, dá pra deriver via `.opacity(1)` em vez de duplicar — mas verificar se mockup canônico realmente trata como mesma cor (pode ser coincidência).

## Tokens de motion + tipografia (compartilhados com hub)

Não-color tokens estão no `THEME_TOKENS.md` / `THEME_TOKENS_HUB.md` e devem ser reusados no cockpit (zero divergência). Lista pra referência:

**Motion** (idênticos aos do hub):
- `--ease-inout: cubic-bezier(0.65, 0, 0.35, 1)`
- `--ease-out:   cubic-bezier(0.22, 1, 0.36, 1)`
- `--ease-msg:   cubic-bezier(0.16, 1, 0.3, 1)` (só piloto + ghost)

**Tipografia** (compartilhada):
- `--ff-display: 'Inter', system-ui, sans-serif`
- `--ff-mono:    'JetBrains Mono', ui-monospace, monospace`

**Sizing escala** (compartilhada — nomes `fs-0` a `fs-9`):
- `--fs-0: 9px`, `--fs-1: 11px`, `--fs-2: 13px`, `--fs-5: 32px`, `--fs-6: 32px`, `--fs-9: 180px`
- `--lh-dom: 0.88`, `--ls-tight: -0.045em`
- `--ls-caps-l/m/s: 0.35em / 0.22em / 0.06em`

**Layout cockpit-only** (largura/altura semanticos):
- `--apex-h: 60px` (altura do bloco apex/curva)
- `--acao-h: 44px` (altura comando ativo)
- `--esp-h: 24px` (altura espessuras gerais)

Em Theme.swift do app: motion + tipografia ficam no namespace global (`Theme.ease`, `Theme.font`); sizing cockpit-only fica em `Theme.Cockpit.layout`.
