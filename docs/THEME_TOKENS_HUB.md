# THEME TOKENS — Hub mockups (Sprint 1A.2)

Pré-extração para os **Prompts #8 / #9 / #10**.

Os 7 mockups do hub usam paleta com sobreposição parcial à do Padrão B (`docs/THEME_TOKENS.md`). Esta tabela lista o que é novo, o que foi redefinido com valor diferente, e o que se mantém igual — pra Theme.swift expor variantes corretas sem conflitar.

Fórmula OKLCH→sRGB e smoke pin: ver `docs/THEME_TOKENS.md`.

## Resumo

| Categoria | Qtd |
|---|---|
| Tokens REDEFINIDOS (nome existe em Padrão B com OKLCH diferente) | 0 |
| Tokens NOVOS (não existem em Padrão B) | 5 |
| Tokens IGUAIS (mesmo nome + mesmo OKLCH) | 10 |

## Tokens novos (só hub)

Adicionar ao Theme.swift como variantes do hub.

| Token | OKLCH | Hex | RGB(A) | Aparece em |
|---|---|---|---|---|
| `--bom` | `oklch(78% 0.16 150)` | `#5fd37f` | `rgb(95, 211, 127)` | #8 Home (cheio); #9 Garagem; #10 Eventos lista; #10 Evento detalhe |
| `--rec` | `oklch(70% 0.20 25)` | `#ff5f5b` | `rgb(255, 95, 91)` | #8 Home (cheio) |
| `--atencao` | `oklch(82% 0.16 80)` | `#fab72a` | `rgb(250, 183, 42)` | #9 Garagem; #10 Eventos lista; #10 Evento detalhe |
| `--erro` | `oklch(70% 0.20 25)` | `#ff5f5b` | `rgb(255, 95, 91)` | #9 Garagem |
| `--ouro` | `oklch(74% 0.16 73)` | `#e79800` | `rgb(231, 152, 0)` | #10 Evento detalhe |

## Tokens iguais à Padrão B

Reutilizam o que já está em Theme.swift.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `#141618` |
| `--surface` | `oklch(24% 0.005 240)` | `#1d2021` |
| `--surface-2` | `oklch(28% 0.005 240)` | `#27292b` |
| `--hairline` | `oklch(33% 0.005 240)` | `#333638` |
| `--text` | `oklch(95% 0.003 240)` | `#edeff0` |
| `--text-2` | `oklch(75% 0.01 240)` | `#a8afb4` |
| `--text-3` | `oklch(58% 0.012 240)` | `#747b81` |
| `--accent` | `oklch(78% 0.13 235)` | `#55c4fe` |
| `--accent-2` | `oklch(82% 0.10 235 / .15)` | `#81cffc` |
| `--green` | `oklch(78% 0.16 150)` | `#5fd37f` |

## Por mockup (auditoria)

### #8 Home (cheio) — `_design-reference/mockup-home-cheio.html`

12 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `#141618` |
| `--surface` | `oklch(24% 0.005 240)` | `#1d2021` |
| `--surface-2` | `oklch(28% 0.005 240)` | `#27292b` |
| `--hairline` | `oklch(33% 0.005 240)` | `#333638` |
| `--text` | `oklch(95% 0.003 240)` | `#edeff0` |
| `--text-2` | `oklch(75% 0.01 240)` | `#a8afb4` |
| `--text-3` | `oklch(58% 0.012 240)` | `#747b81` |
| `--accent` | `oklch(78% 0.13 235)` | `#55c4fe` |
| `--accent-2` | `oklch(82% 0.10 235 / .15)` | `#81cffc` |
| `--green` | `oklch(78% 0.16 150)` | `#5fd37f` |
| `--bom` | `oklch(78% 0.16 150)` | `#5fd37f` |
| `--rec` | `oklch(70% 0.20 25)` | `#ff5f5b` |

### #8 Home (vazio) — `_design-reference/mockup-home-vazio.html`

9 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `#141618` |
| `--surface` | `oklch(24% 0.005 240)` | `#1d2021` |
| `--surface-2` | `oklch(28% 0.005 240)` | `#27292b` |
| `--hairline` | `oklch(33% 0.005 240)` | `#333638` |
| `--text` | `oklch(95% 0.003 240)` | `#edeff0` |
| `--text-2` | `oklch(75% 0.01 240)` | `#a8afb4` |
| `--text-3` | `oklch(58% 0.012 240)` | `#747b81` |
| `--accent` | `oklch(78% 0.13 235)` | `#55c4fe` |
| `--accent-2` | `oklch(82% 0.10 235 / .15)` | `#81cffc` |

### #9 Garagem — `_design-reference/mockup-garagem.html`

12 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `#141618` |
| `--surface` | `oklch(24% 0.005 240)` | `#1d2021` |
| `--surface-2` | `oklch(28% 0.005 240)` | `#27292b` |
| `--hairline` | `oklch(33% 0.005 240)` | `#333638` |
| `--text` | `oklch(95% 0.003 240)` | `#edeff0` |
| `--text-2` | `oklch(75% 0.01 240)` | `#a8afb4` |
| `--text-3` | `oklch(58% 0.012 240)` | `#747b81` |
| `--accent` | `oklch(78% 0.13 235)` | `#55c4fe` |
| `--accent-2` | `oklch(82% 0.10 235 / .15)` | `#81cffc` |
| `--bom` | `oklch(78% 0.16 150)` | `#5fd37f` |
| `--atencao` | `oklch(82% 0.16 80)` | `#fab72a` |
| `--erro` | `oklch(70% 0.20 25)` | `#ff5f5b` |

### #9 Carro modal — `_design-reference/mockup-carro.html`

9 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `#141618` |
| `--surface` | `oklch(24% 0.005 240)` | `#1d2021` |
| `--surface-2` | `oklch(28% 0.005 240)` | `#27292b` |
| `--hairline` | `oklch(33% 0.005 240)` | `#333638` |
| `--text` | `oklch(95% 0.003 240)` | `#edeff0` |
| `--text-2` | `oklch(75% 0.01 240)` | `#a8afb4` |
| `--text-3` | `oklch(58% 0.012 240)` | `#747b81` |
| `--accent` | `oklch(78% 0.13 235)` | `#55c4fe` |
| `--accent-2` | `oklch(82% 0.10 235 / .15)` | `#81cffc` |

### #9 Carro novo (form) — `_design-reference/mockup-carro-novo.html`

9 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `#141618` |
| `--surface` | `oklch(24% 0.005 240)` | `#1d2021` |
| `--surface-2` | `oklch(28% 0.005 240)` | `#27292b` |
| `--hairline` | `oklch(33% 0.005 240)` | `#333638` |
| `--text` | `oklch(95% 0.003 240)` | `#edeff0` |
| `--text-2` | `oklch(75% 0.01 240)` | `#a8afb4` |
| `--text-3` | `oklch(58% 0.012 240)` | `#747b81` |
| `--accent` | `oklch(78% 0.13 235)` | `#55c4fe` |
| `--accent-2` | `oklch(82% 0.10 235 / .15)` | `#81cffc` |

### #10 Eventos lista — `_design-reference/mockup-eventos-lista.html`

11 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `#141618` |
| `--surface` | `oklch(24% 0.005 240)` | `#1d2021` |
| `--surface-2` | `oklch(28% 0.005 240)` | `#27292b` |
| `--hairline` | `oklch(33% 0.005 240)` | `#333638` |
| `--text` | `oklch(95% 0.003 240)` | `#edeff0` |
| `--text-2` | `oklch(75% 0.01 240)` | `#a8afb4` |
| `--text-3` | `oklch(58% 0.012 240)` | `#747b81` |
| `--accent` | `oklch(78% 0.13 235)` | `#55c4fe` |
| `--accent-2` | `oklch(82% 0.10 235 / .15)` | `#81cffc` |
| `--bom` | `oklch(78% 0.16 150)` | `#5fd37f` |
| `--atencao` | `oklch(82% 0.16 80)` | `#fab72a` |

### #10 Evento detalhe — `_design-reference/mockup-evento-detalhe.html`

12 tokens.

| Token | OKLCH | Hex |
|---|---|---|
| `--bg` | `oklch(20% 0.005 240)` | `#141618` |
| `--surface` | `oklch(24% 0.005 240)` | `#1d2021` |
| `--surface-2` | `oklch(28% 0.005 240)` | `#27292b` |
| `--hairline` | `oklch(33% 0.005 240)` | `#333638` |
| `--text` | `oklch(95% 0.003 240)` | `#edeff0` |
| `--text-2` | `oklch(75% 0.01 240)` | `#a8afb4` |
| `--text-3` | `oklch(58% 0.012 240)` | `#747b81` |
| `--accent` | `oklch(78% 0.13 235)` | `#55c4fe` |
| `--accent-2` | `oklch(82% 0.10 235 / .15)` | `#81cffc` |
| `--bom` | `oklch(78% 0.16 150)` | `#5fd37f` |
| `--atencao` | `oklch(82% 0.16 80)` | `#fab72a` |
| `--ouro` | `oklch(74% 0.16 73)` | `#e79800` |


