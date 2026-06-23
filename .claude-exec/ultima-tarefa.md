# Última tarefa — +STINT: auto-seleção de item único + reordenar voltas/paradas — 23/06/2026

> Backup da tarefa anterior (cockpit volta real): `.claude-exec/ultima-tarefa-COCKPIT-2026-06-22.bak.md`

## Pedido original de Flávio
1. "em p1 fast +stint se tem só um item naquele carro escolhido, ou se tem só um carro na garagem tudo já aparece selecionado destes itens ou carro. ou seja, seja se tem somente o bolinha, ele já aparece, se o bolinha usa etanol, já aparece selecionado, e assim por diante."
2. "o total de voltas e se para ou não no box deve ficar logo após no nome do piloto na tela de novo stint."

## Objetivo (1 frase)
Na tela de novo Stint (+Stint): (a) pré-selecionar automaticamente todo item que só tem uma opção; (b) mover "Voltas planejadas" e "Paradas no box" pra logo após o piloto.

## Critérios objetivos de conclusão
- Combustível com 1 só tipo cadastrado → já vem selecionado.
- Pneu com 1 só pneu no carro → já vem selecionado.
- Piloto único → já vem selecionado (já existia; conferido).
- "Voltas" e "Paradas no box" aparecem logo após o bloco do piloto, antes de combustível/pneu.
- App compila (BUILD SUCCEEDED).

## Leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim (vazio/sem padrões)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim

## Plano (≤5 passos)
1. Auto-selecionar item único (combustível/pneu) no onAppear, junto do piloto.
2. Reordenar a tela: piloto → voltas → paradas → combustível/pneu → propósito/lição/assistência.
3. Compilar o app iOS.
4. Reportar.

## Arquivos/áreas a inspecionar
- ios/p1fast-ios/Sources/Views/StintModalView.swift (tela viva do +Stint)
- Repos: CombustivelRepository, PneuRepository, CarroRepository (modelo de dados)

## Ambiente alvo: desenvolvimento
## Produção protegida: sim
## Autorização para produção: não
## Evidência da autorização: não recebida (mudança é só de tela/dev)

## Riscos
- Não há seletor de CARRO na tela (usa o primeiro carro). Com 1 carro já é o usado, mas não há campo pra "aparecer selecionado". Não vou inventar seletor — sinalizo.
- Combustível é por time (catálogo), não por carro. Seed padrão tem 2 (etanol + gasolina) → só auto-seleciona se houver exatamente 1.

## Status inicial: iniciado
