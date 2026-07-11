# MANDATO — J1 (Opus 4.8) — CONSTRUTORA DO HERÓI DO EVENTO

Você é a J1 do plano de 5 janelas da nova Home "Dia de Pista". Coordenador: janela Fable 5.
Leia antes, nesta ordem: `.claude-exec/home-dia-de-pista/COORDENACAO.md` (contrato + regras + fronteiras),
`~/.claude/CLAUDE.md`, `CLAUDE.md` do projeto, `.claude-exec/registro-correcoes.md`.
Referência visual aprovada: `_design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html` (bloco do topo).

## Ambiente
Ambiente isolado (worktree, ADR-021), linha `claude/home-j1-heroi`, a partir da versão oficial LOCAL. Nunca incorporar.

## Entregável
1. `ios/p1fast-ios/Sources/Components/HeroEventoCard.swift` — componente novo, assinatura EXATA do contrato
   (COORDENACAO.md §CONTRATO). Conteúdo: eyebrow "PRÓXIMO EVENTO" (ou "ATIVO · HOJE"), pista grande, data +
   autódromo, selo âmbar "EM N DIAS" (azul "HOJE" quando diasAte==0), ANEL de prontidão (arco fino âmbar com % no
   centro; some quando prontidaoPct==nil), linha de pendências tocável ("N pendências antes da pista" › — some com 0),
   e botão primário largo "Iniciar Stint" (azul cheio, ícone de traço play).
2. Tokens novos necessários em `Theme.swift` (ex.: âmbar/atencao se faltar) — SEM alterar tokens existentes.
3. `#Preview` com 4 estados: hoje / em N dias / sem prontidão / sem pendências.

## Prova e entrega
Empacotamento verde; fotos dos previews (ou simulador P1-Zoom375); testes existentes verdes.
Relatório `.claude-exec/home-dia-de-pista/entregas/janela-1.md` (o que fez, onde, fotos, comandos+saídas reais, pendências).
TASK_INIT/TASK_DONE no `ultima-tarefa.md` preservando histórico.

## Fronteira dura
Só os arquivos acima. NÃO toque HomeView, GaragemView, componentes das outras janelas, web/, cockpit, cérebro, Supabase.
Se o contrato não servir, escreva a proposta de mudança na entrega e PARE — o coordenador decide.
