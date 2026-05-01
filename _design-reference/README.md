# Design Reference — mockups canônicos

Esta pasta contém os mockups visuais canônicos do P1 Fast. **NÃO É CÓDIGO
VIVO** — são arquivos HTML+CSS+JS auto-contidos, sem dependência do resto
do projeto, que servem como **contrato visual** quando você for construir
a UI nova.

## Princípio durável

Estes arquivos são fonte canônica de verdade visual. Quando construir a
UI do P1 Fast, **copie do mockup ao código real, sem inventar**: mesmos
tokens, mesmos seletores, mesmos números (px / cores / pesos /
letter-spacing / animation timings). Inventar variações em cima do
mockup gerou drift no projeto anterior.

## Os mockups

| Arquivo | Tela / componente | Padrão visual |
|---|---|---|
| `mockup-cockpit-piloto.html` | Display do piloto (956×440 landscape) | DNA cockpit (preto puro · accents semânticos) |
| `mockup-cockpit-comparacao.html` | Comparação halo recorde-stint vs pior-stint | DNA cockpit |
| `mockup-evento.html` | Modal Evento — form com 7 campos (Nome / Autódromo / Quando / Janela / Tipo) | Padrão B |
| `mockup-home-cheio.html` | HOME do hub mobile · 4 gauges · stint em andamento · próximo evento · sugestão · eventos recentes · FAB | Padrão B |
| `mockup-home-vazio.html` | HOME empty state — hero + 3 bullets + CTA | Padrão B |
| `mockup-pendencias-cascata.html` | Tab Pendências em cascata · header contextual · summary card · chip rail · groups colapsáveis | Padrão B |
| `mockup-stint-objetivo.html` | Modal Stint — objetivo do stint + toggle P1 Coach + fase de foco + pickers de lição e trecho | Padrão B |
| `mockup-licao-lista.html` | Lista de seleção de lição específica (7 lições MVP) — abre a partir do picker em `mockup-stint-objetivo.html` | Padrão B |
| `mockup-trecho-lista.html` | Lista de seleção de trecho específico (8 trechos de Brasília agrupados nas 4 parciais) — abre a partir do picker em `mockup-stint-objetivo.html` | Padrão B |
| `mockup-carro.html` | Modal Carro — cadastro (apelido + modelo + categoria + cor) e setup base (14 overrides em PNEUS / ALINHAMENTO / SUSPENSÃO / FREIOS / MOTOR · TRANSMISSÃO) | Padrão B |
| `mockup-garagem.html` | Tab Garagem — eyebrow + summary 3-stats (total / prontos / manutenção) + cards de carro com swatch, apelido, modelo, categoria e tags de status. FAB + bottom-nav | Padrão B |
| `mockup-pos-stint.html` | Modal pós-stint (debrief do piloto) — hero da volta-recorde + cards de objetivo, lição praticada, trecho-foco e sugestão pro próximo stint | Padrão B |
| `mockup-stint-override.html` | Modal de overrides do stint — lista de overrides ativos com diff base→stint (PRESSÃO, BIAS, MAPA) e CTA "Adicionar override" | Padrão B |
| `historico-evento/` | 7 linhas iteradas (A-G) do Modal Evento + comparativo lado-a-lado | Memória de design |

## Padrão B — tokens canônicos do hub

Vale pra TODO o hub do P1 Fast (Modal Evento, HOME cheio, HOME vazio,
Pendências, e tudo que vier — Eventos, Dias, Garagem, modais).

```css
:root {
  --bg: oklch(20% 0.005 240);
  --surface: oklch(24% 0.005 240);
  --surface-2: oklch(28% 0.005 240);
  --hairline: oklch(33% 0.005 240);
  --text: oklch(95% 0.003 240);
  --text-2: oklch(75% 0.01 240);
  --text-3: oklch(58% 0.012 240);
  --accent: oklch(78% 0.13 235);          /* AZUL primário */
  --accent-2: oklch(82% 0.10 235 / .15);  /* azul translúcido */
  --green: oklch(78% 0.16 150);
  --radius: 12px;
}
body {
  background: linear-gradient(160deg,
    oklch(22% 0.005 240) 0%,
    oklch(18% 0.005 240) 100%);
  font-family: 'Inter', system-ui, sans-serif;
}
```

Spring pra chips/tipos: `cubic-bezier(.34, 1.56, .64, 1)` em transições de
220ms. Bordas pill `999px` só em chips/tipos/botões — cards, inputs e
pickers usam `var(--radius)` (12px).

## Tokens canônicos do cockpit (NÃO seguem padrão B)

```css
:root {
  --bg: oklch(0% 0 0);
  --ink: oklch(100% 0 0);
  --bom: oklch(80% 0.22 145);          /* verde — ganhou tempo */
  --erro: oklch(68% 0.26 27);          /* vermelho — perdeu tempo */
  --sistema: oklch(78% 0.16 225);      /* cyan — comunicação */
  --foco: oklch(82% 0.19 70);          /* laranja — frase pedagógica */
  --ouro: oklch(74% 0.16 73);          /* dourado — recorde all-time */
  --halo-recorde: oklch(78% 0.18 65 / .42);
  --halo-pior:    oklch(56% 0.22 305 / .42);
  --ls-tight: -0.045em;
  --lh-dom: 0.88;
  --ease-msg: cubic-bezier(0.16, 1, 0.3, 1);
}
```

Os cockpits mantêm DNA próprio (preto puro, accents semânticos). Não
trocar pelo padrão B — a leitura sob vibração no carro depende dos
contrastes específicos.

## Como usar

```bash
# Visualizar localmente
python3 -m http.server 8767
# Abrir http://localhost:8767/_design-reference/mockup-evento.html
```

## Princípios visuais do padrão B

- **Sem aurora gradient** — fundo é gradient simples 160deg neutro
- **Sem glassmorphism** (`backdrop-filter: blur`) em cards do conteúdo
  (apenas bottom-nav usa blur sutil)
- **Sem `!important`**
- **Sem gradient text** (`-webkit-background-clip: text`)
- **Sentence case** em labels descritivos (Nome, Autódromo, Quando)
- **Tabular nums** em valores numéricos (datas, horas, contagens)
- **Bordas 12px** (`--radius`) em inputs/cards/pickers
- **Bordas pill 999px** apenas em chips/tipo-pills/botões/FAB

## Antipadrões (proibidos no padrão B)

- Aurora double gradient (era do BC magenta-cyan, abandonado)
- Glassmorphism `backdrop-filter: blur(20px)` em cards de conteúdo
- Gradient text `linear-gradient(135deg, magenta, cyan)` em títulos
- Cores oklch hue 285-320 (magenta) — abandonado
- Cores oklch hue 200 (cyan) — abandonado
- `[data-severidade]` aliasing CSS — usar classes literais
  (`.bom`, `.erro`, `.atencao`)
- ALL CAPS em labels descritivos (B usa sentence case)
- Ícones decorativos (regra durável de tom — texto puro)

## Regra durável (lição custosa)

Ao implementar uma tela nova, **abra o mockup correspondente no preview
ao lado da página real**. Cada divergência exige justificativa explícita.
Não invente token, gap, !important, alias `[data-attr]`, classe nova.
Se a estrutura do mockup não couber no consumidor JS, **adapte o JS**,
não o mockup.

— Origem: regra `feedback_canonico_eh_contrato.md` em
`~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/`,
extraída em 2026-04-30 após várias rodadas de drift no projeto anterior.
