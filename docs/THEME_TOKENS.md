# THEME TOKENS — Padrão B (canônico) → Swift/sRGB

Pré-extração para o **Prompt #7** (`Theme.swift` + componentes SwiftUI).

A parte mais sujeita a erro daquele prompt é a conversão OKLCH → sRGB
(o critério de aceitação exige "comentário no PR explicando como cor
OKLCH foi convertida pra sRGB"). Este doc fixa essa conversão pra que
o trabalho seja só copiar valores.

## Como foi feito

`tools/oklch-to-srgb.mjs` implementa a fórmula canônica do Björn
Ottosson (2020):

```
OKLCH → OKLab (cilíndrica → cartesiana: a = C·cos(h), b = C·sin(h))
OKLab → linear sRGB (matriz 3×3 do paper)
linear sRGB → sRGB (gamma; cutoff em 0.0031308)
```

Verificável via `node tests/node-smoke-oklch.mjs` (10 testes, pin contra
referências conhecidas: `oklch(20% 0.005 240) → #141618`,
`oklch(78% 0.13 235) → #55c4fe`, etc).

Re-gerar o doc:

```sh
node tools/oklch-to-srgb.mjs > docs/THEME_TOKENS.md.gen
```

## Fonte

`_design-reference/historico-evento/mockup-evento-B.html` — Padrão B
canônico (referência pra `Theme.swift` no Prompt #7).

## Tokens nomeados (10)

Estes viram propriedades públicas em `Theme.swift`:

| Token CSS | OKLCH | Hex sRGB | RGB | Sugestão Swift |
|---|---|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `#141618` | `rgb(20, 22, 24)` | `Color.surface` (background) |
| `--surface` | `oklch(24% 0.005 240)` | `#1d2021` | `rgb(29, 32, 33)` | `Color.surfaceRaised` |
| `--surface-2` | `oklch(28% 0.005 240)` | `#27292b` | `rgb(39, 41, 43)` | `Color.surfaceHover` |
| `--hairline` | `oklch(33% 0.005 240)` | `#333638` | `rgb(51, 54, 56)` | `Color.border` |
| `--text` | `oklch(95% 0.003 240)` | `#edeff0` | `rgb(237, 239, 240)` | `Color.text` |
| `--text-2` | `oklch(75% 0.01 240)` | `#a8afb4` | `rgb(168, 175, 180)` | `Color.textMuted` |
| `--text-3` | `oklch(58% 0.012 240)` | `#747b81` | `rgb(116, 123, 129)` | `Color.textFaint` |
| `--accent` | `oklch(78% 0.13 235)` | `#55c4fe` | `rgb(85, 196, 254)` | `Color.accent` |
| `--accent-2` | `oklch(82% 0.10 235 / .15)` | `#81cffc` α=0.15 | `rgba(129, 207, 252, 0.15)` | `Color.accentDim` |
| `--green` | `oklch(78% 0.16 150)` | `#5fd37f` | `rgb(95, 211, 127)` | `Color.success` |

## Cores inline (10) — sem token nomeado

Usadas direto em CSS rules do mockup (gradientes, hovers, shadows). Em
Swift devem virar **variantes derivadas** ou parâmetros de modificadores —
não tokens públicos do Theme:

| OKLCH | Hex sRGB | RGB(A) | Onde aparece |
|---|---|---|---|
| `oklch(22% 0.005 240)` | `#191b1d` | `rgb(25, 27, 29)` | gradient device top |
| `oklch(18% 0.005 240)` | `#101214` | `rgb(16, 18, 20)` | gradient device bottom |
| `oklch(0% 0 0 / .6)` | `#000000` α=0.6 | `rgba(0, 0, 0, 0.6)` | shadow do device |
| `oklch(12% 0.005 240)` | `#050607` | `rgb(5, 6, 7)` | bezel ring (8px outline) |
| `oklch(26% 0.01 235)` | `#1f2528` | `rgb(31, 37, 40)` | hover state |
| `oklch(78% 0.13 235 / .14)` | `#55c4fe` α=0.14 | `rgba(85, 196, 254, 0.14)` | accent ring |
| `oklch(40% 0.10 235)` | `#004e75` | `rgb(0, 78, 117)` | accent dark variant |
| `oklch(78% 0.13 235 / .15)` | `#55c4fe` α=0.15 | `rgba(85, 196, 254, 0.15)` | accent shadow |
| `oklch(15% 0.01 235)` | `#070c0f` | `rgb(7, 12, 15)` | text on accent (button) |
| `oklch(82% 0.14 235)` | `#58d2ff` | `rgb(88, 210, 255)` | accent hover |

## Exemplo de uso em SwiftUI (rascunho)

```swift
extension Color {
    static let surface       = Color(red: 20/255, green: 22/255, blue: 24/255)   // --bg
    static let surfaceRaised = Color(red: 29/255, green: 32/255, blue: 33/255)   // --surface
    static let accent        = Color(red: 85/255, green: 196/255, blue: 254/255) // --accent
    static let accentDim     = Color(red: 129/255, green: 207/255, blue: 252/255)
                                    .opacity(0.15)                                // --accent-2
    static let text          = Color(red: 237/255, green: 239/255, blue: 240/255) // --text
    static let textMuted     = Color(red: 168/255, green: 175/255, blue: 180/255) // --text-2
    static let textFaint     = Color(red: 116/255, green: 123/255, blue: 129/255) // --text-3
    static let border        = Color(red: 51/255, green: 54/255, blue: 56/255)    // --hairline
    static let success       = Color(red: 95/255, green: 211/255, blue: 127/255)  // --green
}
```

## Outras referências do prompt #7

Tokens não-cor que o prompt menciona (sem conversão necessária — copiar literal do mockup):

- **Tipografia**: Inter (display) + JetBrains Mono. SwiftUI: `Font.custom("Inter", size:...)` ou system fonts conforme o canônico.
- **Espaçamento**: `xs(4)`, `sm(8)`, `md(16)`, `lg(24)`, `xl(32)`, `xxl(48)` — literais do prompt #7.
- **Raio**: `sm(8)`, `md(12)`, `lg(16)`, `pill(999)` — literais do prompt #7.
- **Mockup canônico**: `_design-reference/historico-evento/mockup-evento-B.html` (variável `--radius: 12px` aparece lá).

## Componentes do prompt #7

- `EyebrowHeader` — eyebrow uppercase + título grande + summary stats
- `SummaryStats` — grid horizontal valor grande + label small
- `Card` — surface + border + padding md + raio md
- `Chip` — pill com background surfaceRaised
- `BottomNav` — barra inferior 3-4 itens
- `FAB` — botão accent flutuante, label texto puro

Cada um com Preview SwiftUI mostrando default/hover/pressed/disabled.

## Regras inegociáveis (lembrete pro #7)

- Tratamento "você" em todas as strings.
- Sem ícones decorativos. Texto puro em todos labels.
- Visual diff vs `mockup-evento-B.html` < 2%.
- Nada inventado: token novo precisa de OKLCH no mockup primeiro.
