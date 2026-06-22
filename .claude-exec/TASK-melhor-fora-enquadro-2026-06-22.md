# TASK — "Melhor" fora de enquadro na primeira tela — 22/06/2026

## Pedido original de Flávio
"em p1 fast o número melhor volta na tela principal está fora de enquadro."

## Objetivo (1 frase)
Fazer o número "Melhor" (tempo da melhor volta) caber dentro da célula na primeira tela (HomeView), sem cortar nem estourar.

## Critérios objetivos de conclusão
- "Melhor" (ex.: "1:42.3") cabe em uma linha dentro da célula.
- Não corta com "…" nem sai da moldura.
- App iOS continua compilando (BUILD SUCCEEDED).

## Confirmação de leitura
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim (existe, sem decisões registradas)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim

## Plano (<=5 passos)
1. Localizar a célula do número na primeira tela. [feito: ios/.../Components/SummaryStats.swift -> StatCell]
2. Confirmar a causa (lineLimit(1) sem minimumScaleFactor; tempo de volta mais largo que contagem). [feito]
3. Adicionar minimumScaleFactor pra encolher e caber. [feito]
4. Compilar pra provar que não quebrou.
5. Reportar com prova.

## Arquivos/areas
- ios/p1fast-ios/Sources/Components/SummaryStats.swift (StatCell)
- ios/p1fast-ios/Sources/Views/HomeView.swift (uso + formatVoltaCurta)

## Ambiente alvo: desenvolvimento
## Produção protegida: sim
## Autorização para produção: não
## Evidência da autorização: não recebida
## Riscos: baixo — mudança só de layout (encolhe número quando não cabe). Sem mexer em dado, banco, prod.
## Status inicial: iniciado
