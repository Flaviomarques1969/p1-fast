# MANDATO — J3 (Opus 4.8) — CONSTRUTORA CARROS + NÚMEROS

Você é a J3 do plano de 5 janelas da nova Home "Dia de Pista". Coordenador: janela Fable 5.
Leia antes, nesta ordem: `.claude-exec/home-dia-de-pista/COORDENACAO.md` (contrato + regras + fronteiras),
`~/.claude/CLAUDE.md`, `CLAUDE.md` do projeto, `.claude-exec/registro-correcoes.md`.
Referência visual aprovada: `_design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html` (blocos "Seus carros" e rodapé de números).

## Ambiente
Ambiente isolado (worktree, ADR-021), linha `claude/home-j3-carros-numeros`, a partir da versão oficial LOCAL. Nunca incorporar.

## Entregáveis
1. `ios/p1fast-ios/Sources/Components/CarroRowCompacta.swift` — assinatura EXATA do contrato. Linha compacta:
   ícone/swatch de cor arredondado com carro em traço, apelido semibold, sub (modelo/último stint), nº de stints
   à direita em tabular ("31" grande + "STINTS" mínimo), seta ›. `onTap nil` = linha estática.
2. `ios/p1fast-ios/Sources/Components/NumerosRodape.swift` — assinatura EXATA do contrato. UMA linha discreta
   "12 EVENTOS · 158 VOLTAS · 47 STINTS" (números claros, rótulos apagados), cada segmento tocável.
3. `#Preview` de cada um (2+ carros; números zerados e cheios).

## Prova e entrega
Empacotamento verde; fotos dos previews (ou simulador P1-Zoom375); testes existentes verdes.
Relatório `.claude-exec/home-dia-de-pista/entregas/janela-3.md` (o que fez, onde, fotos, comandos+saídas reais, pendências).
TASK_INIT/TASK_DONE no `ultima-tarefa.md` preservando histórico.

## Fronteira dura
Só os 2 arquivos novos. NÃO toque Theme.swift (J1), HomeView (J5), GaragemView (J4), componentes das outras,
web/, cockpit, cérebro, Supabase. Contrato não serve? Proponha na entrega e PARE.
