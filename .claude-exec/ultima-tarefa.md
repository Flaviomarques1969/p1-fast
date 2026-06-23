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

---

## ANDAMENTO — chegaram +2 pedidos durante a execução
3. "em convidado... incluir uma opção: + convidados — pra cadastrar um convidado novo ali na tela." → FEITO.
4. "lição praticada não deveria estar dentro de treinar habilidade?" → DECIDIDO por Flávio (card): "Só em 'Treinar habilidade'". FEITO — a Lição praticada agora só aparece dentro do propósito "Treinar habilidade"; ao sair desse propósito, a lição é limpa. Seção fixa antiga (sectionLicao) removida (conteúdo migrado pra dentro do bloco treinar).

## TASK_DONE (itens 1, 2 e 3)
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Autorização de produção registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim (BUILD SUCCEEDED, simulador, derivedData isolado /tmp/p1fast-build-stint)
- Resultado: itens 1-3 concluídos; item 4 = pergunta aberta (decisão)
- Pendências reais: item 4 (decisão de UX da lição) + validação visual no iPhone (cert dev pode ter vencido ~22/06)

### Arquivos alterados
- ios/p1fast-ios/Sources/Views/StintModalView.swift
- ios/p1fast-ios/Sources/Views/PilotoCadastroView.swift (onCreated opcional, retrocompatível)

### O que foi preservado
- Lógica do piloto padrão (você) — só renomeada de hidratarPilotoDefault → hidratarDefaults.
- Combustível/pneu seguem opcionais; auto-seleção só quando há exatamente 1.
- PilotoCadastroView: callers antigos não mudam (onCreated tem default nil).
- Backup da tarefa anterior: .claude-exec/ultima-tarefa-COCKPIT-2026-06-22.bak.md

### O que foi acrescentado
- Auto-seleção de item único (combustível com 1 tipo, pneu com 1 no carro).
- Reordenação: piloto → voltas → paradas → (combustível+pneu) → propósito → lição → assistência.
- Opção "+ Convidado" no picker de convidado, cadastrando piloto/pessoa novo na hora e já selecionando.

### Validação executada
- xcodebuild ... -scheme p1fast-ios -destination 'generic/platform=iOS Simulator' → BUILD SUCCEEDED (3x, sem erros).
- REINSTALADO no iPhone do Flávio (00008140-000E2D611E6A801C) 23/06: empacotado assinado (Apple Development: flaviomarques@me.com, perfil com.flaviomarques.p1fast) em /tmp/p1fast-device-build → devicectl install OK → devicectl launch OK (app abriu). Renova +7 dias. Aviso "No provider was found" é inofensivo (instala/abre mesmo assim).
- FALTA: Flávio olhar os 4 ajustes na tela ao vivo e dar o ok.
