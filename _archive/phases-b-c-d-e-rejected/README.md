# Phases B / C / D / E — abordagens REJEITADAS pelo Flávio

Arquivado em 2026-05-07 após decisão de resgatar a Direction D existente.

Histórico das tentativas que **não funcionaram** e por quê — pra próxima
sessão não cair no mesmo buraco.

## O que foi tentado

| Phase | Abordagem técnica | Por que rejeitou |
|---|---|---|
| **A** | vtracer fragmentando foto inteira em paths SVG, recolor por CSS variable | "absolutamente péssimo" — vira blocos sólidos coloridos, perde fotorrealismo |
| **B** (v1/v2/v3/v3.1) | polígonos SVG por cima da foto + `mix-blend-mode: multiply` | "polígono é reto, o pino é torto" — fronteira rígida não segue curva do objeto |
| **C** | máscaras binárias PNG + HSL shift dos pixels | "esquece a abordagem de máscara, não dá certo" — mesmo problema conceitual da Phase B mas reformulado |
| **D** | SVG schematic top-down hand-drawn (15 peças como elementos vetoriais) | "qualidade péssima, nem lembra a outra" — sem habilidade artística, vira diagrama técnico cru |
| **E** | GrabCut → camadas PNG transparentes (Photoshop-style) + HSL shift por camada | abandonado em favor da Direction D que ele já tinha aprovado antes |

## Erros técnicos importantes (pra não repetir)

- "spring-RL" e "spring-RR" do Phase B v1-v3 estavam mascarando os **CINTOS Sparco vermelhos** do banco, não os coilovers. O coilover real está atrás do pneu RR, parcialmente oculto.
- "tire-FL" do Phase B estava mascarando a **grade do front bumper** (preta), não um pneu. Os pneus dianteiros não são visíveis nessa angulação do exploded view (cobertos pelo bumper).
- `cv2.fillPoly` + `floodFill` pra fill_internal_holes precisa de check `if mask.max() == 0: return mask` — sem isso, máscaras esparsas viram all-white.
- cairosvg ignora `width="X" height="Y"` no SVG mesmo com `--output-width` — precisa stripar os attrs antes pra render no tamanho desejado.
- Regex `<svg xmlns=.*?</svg>` com non-greedy quebra quando há SVG aninhado (Direction D tem o Celta vector embedded). Use greedy `<svg xmlns=.*</svg>` com `re.S`.

## Conclusão (decisão Flávio 2026-05-07)

A abordagem certa **já existia** em `assets/command-box/premium-styles/direction-D-live.svg`:
- Top-down view do Celta como SVG vetorizado fiel à foto
- Dados sobrepostos via dots + leader lines + callouts nas bordas
- Cor por threshold de cada canal (verde ok / amber atenção / red crítico)

Esse mockup foi parametrizado em `_design-reference/celta-cockpit-D.html` como
demo interativo. **Esse é o caminho.** Não é polígono, não é máscara, não
é redesenhar — é **dado SOBRE o carro vetorizado**.
