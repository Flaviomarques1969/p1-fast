# Histórico — 7 linhas exploradas do Modal Evento

Estas são as 7 propostas iteradas antes do Modal Evento canônico (BC) ser
fixado. Resgatadas do git em 2026-04-30 (commits originais 04-26/27/28).
Servem como **memória de design** — vê-las ajuda a entender por que o BC
final tem a forma que tem.

## Decisão final do FAM Racing

**Linha BC** = "**textos de B** (microcopy/estrutura) + **visual de C**
(cores magenta/cyan + glassmorphism)" com fixes.
Arquivo canônico: `../mockup-evento-BC.html`.

## As 7 linhas

| Arquivo | Título | Hue OKLCH | Características |
|---|---|---|---|
| `mockup-evento-A.html` | Cronógrafo | 240 (azul) + 22 (vermelho accent) | Layout cronográfico, accent vermelho |
| `mockup-evento-B.html` | **Cockpit minimalista** | 235-240 (azul puro) | **Layout escolhido pro BC** — minimalismo, sem accent forte |
| `mockup-evento-C.html` | Tech wellness premium | 285-320 (magenta/roxo) + 200 (cyan) | **Visual escolhido pro BC** — aurora + glassmorphism + magenta-cyan |
| `mockup-evento-D.html` | Pergunta-por-vez | 240 + 22 | Form em wizard step-by-step |
| `mockup-evento-E.html` | Calendar-first | 240 + 85 (amarelo) | Data como protagonista |
| `mockup-evento-F.html` | Linguagem natural | 240 puro | Form conversacional |
| `mockup-evento-G.html` | Sugestão proativa | 240 + 22 | IA sugere antes de perguntar |
| `mockups-evento-comparacao.html` | Comparativo | — | Tabela comparando as 7 linhas |

## Como o BC nasceu

1. Iteração das 7 linhas (A-G) com cores e estruturas diferentes
2. Texto de **B** vence (Cockpit minimalista — labels sentence case,
   sub-labels obrigatório/opcional, microcopy direto, summary final)
3. Visual de **C** vence (Tech wellness premium — aurora double gradient,
   glassmorphism com `backdrop-filter: blur(20px)`, accent gradient
   magenta→cyan, gradient text white→lavender no título)
4. **Fixes obrigatórios** sobre C original:
   - Touch target ≥44px em chips/buttons/close
   - Colon do time-card sempre cor sólida + glow
   - Tipo chips sempre `<button>` (a11y)
   - Foot sticky garantido por `min-height: 0` nos pais flex
   - Gradient text só no título grande + valores numéricos grandes
     (não em CTA, body text, ou múltiplos elementos competindo)
5. Resultado final: `../mockup-evento-BC.html` (texto B + visual C + fixes)

## Como visualizar

```bash
# Server P1 Fast já roda em 8767 (via .claude/launch.json do FAM Racing)
# Abrir cada uma:
http://localhost:8767/_design-reference/historico-evento/mockup-evento-A.html
http://localhost:8767/_design-reference/historico-evento/mockup-evento-B.html
http://localhost:8767/_design-reference/historico-evento/mockup-evento-C.html
# ...etc
http://localhost:8767/_design-reference/historico-evento/mockups-evento-comparacao.html
```
