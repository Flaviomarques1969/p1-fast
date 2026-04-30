# Design Reference — mockups canônicos

Esta pasta contém os mockups visuais canônicos iterados antes do P1 Fast
nascer. **NÃO É CÓDIGO VIVO** — são arquivos HTML+CSS+JS auto-contidos,
sem dependência do resto do projeto, que servem como **contrato visual**
quando você for construir a UI nova.

## Princípio durável

Estes 6 arquivos são fonte canônica de verdade visual. Quando construir
a UI do P1 Fast, **copie do mockup ao código real, sem inventar**:
mesmos tokens, mesmos seletores, mesmos números (px / cores / pesos /
letter-spacing / animation timings). Inventar variações em cima do
mockup gerou drift no projeto anterior.

## Os 6 mockups

| Arquivo | Tela / componente | Estado mostrado |
|---|---|---|
| `mockup-cockpit-piloto.html` | Display do piloto (956×440 landscape) | Apex 4 pontos · delta gigante · stint bar · slide 3D da mensagem · halo radial |
| `mockup-cockpit-comparacao.html` | Comparação halo recorde-stint vs pior-stint | 2 instâncias do cockpit lado-a-lado pra contraste |
| `mockup-evento-BC.html` | Modal Evento (DNA BC = aurora + glassmorphism + magenta-cyan) | Form com 7 campos preenchidos |
| `mockup-home-cheio.html` | HOME do hub mobile | 4 gauges · card próximo evento · card stint em andamento · sugestão proativa · eventos recentes · FAB |
| `mockup-home-vazio.html` | HOME empty state | Hero "Vamos começar" + 3 bullets + CTA |
| `mockup-pendencias-cascata.html` | Tab Pendências em cascata | Header contextual · summary card · chip rail filtros · pend rows agrupadas |

## Tokens BC compartilhados pelos 4 mockups do hub

```css
--bg: oklch(12% 0.020 290);
--aurora-a: oklch(60% 0.18 320 / .35);
--aurora-b: oklch(72% 0.14 200 / .28);
--surface: oklch(22% 0.030 290 / .8);
--surface-2: oklch(28% 0.025 290 / .6);
--hairline: oklch(35% 0.025 290 / .6);
--ink: oklch(98% 0.005 290);
--ink-soft: oklch(78% 0.020 290);
--ink-faint: oklch(58% 0.025 290);
--accent-a: oklch(76% 0.18 320);  /* magenta */
--accent-b: oklch(82% 0.14 200);  /* cyan */
--glow-a: oklch(76% 0.18 320 / .35);
--r-md: 18px;
--r-pill: 999px;
--spring: cubic-bezier(.34, 1.56, .64, 1);
--dur-2: 220ms;
```

## Tokens canônicos do cockpit (mockup-cockpit-piloto)

```css
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
--ease-msg: cubic-bezier(0.16, 1, 0.3, 1);  /* expo-out muito suave */
```

## Como usar

```bash
# Visualizar localmente
python3 -m http.server 8766
# Abrir http://localhost:8766/_design-reference/mockup-cockpit-piloto.html
```

## Regra durável (lição custosa)

Ao implementar uma tela nova, **abra o mockup correspondente no preview
ao lado da página real**. Cada divergência exige justificativa explícita.
Não invente token, gap, !important, alias `[data-attr]`, classe nova.
Se a estrutura do mockup não couber no consumidor JS, **adapte o JS**, não o mockup.

— Origem: regra `feedback_fam_canonico_eh_contrato.md` do FAM Racing,
extraída em 2026-04-30 após várias rodadas de drift.
