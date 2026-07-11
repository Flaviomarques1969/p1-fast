# MANDATO — J2 (Opus 4.8) — CONSTRUTORA MELHOR VOLTA + AO VIVO

Você é a J2 do plano de 5 janelas da nova Home "Dia de Pista". Coordenador: janela Fable 5.
Leia antes, nesta ordem: `.claude-exec/home-dia-de-pista/COORDENACAO.md` (contrato + regras + fronteiras),
`~/.claude/CLAUDE.md`, `CLAUDE.md` do projeto, `.claude-exec/registro-correcoes.md`.
Referência visual aprovada: `_design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html` (blocos "Ao vivo" e "Sua melhor volta").

## Ambiente
Ambiente isolado (worktree, ADR-021), linha `claude/home-j2-volta-aovivo`, a partir da versão oficial LOCAL. Nunca incorporar.

## Entregáveis
1. `ios/p1fast-ios/Sources/Components/MelhorVoltaCard.swift` — assinatura EXATA do contrato. Conteúdo: eyebrow
   "SUA MELHOR VOLTA", mini traçado da pista em traço fino (reutilize `PistaBrasilia.swift` se couber; senão SVG/Path
   próprio de traço), tempo grande tabular (formato 1:42.3; `melhorMs nil` → "—"), linha de contexto
   (pista · carro · mês), evolução verde (ex. "↓ −0,8s") SÓ quando `evolucaoMs` vier de verdade.
2. `ios/p1fast-ios/Sources/Components/AoVivoRow.swift` — assinatura EXATA do contrato. Cartão fino: ponto verde
   discreto quando `aoVivoAgora`, título "Ao vivo agora"/"Ao vivo", subtítulo opcional, ação "Assistir ›" à direita.
   PROIBIDO borda vermelha (regra do Flávio: vermelho só crítico).
3. `#Preview` de cada um com estados: com dado / sem dado ("—") / ao vivo ligado e desligado.

## Prova e entrega
Empacotamento verde; fotos dos previews (ou simulador P1-Zoom375); testes existentes verdes.
Relatório `.claude-exec/home-dia-de-pista/entregas/janela-2.md` (o que fez, onde, fotos, comandos+saídas reais, pendências).
TASK_INIT/TASK_DONE no `ultima-tarefa.md` preservando histórico.

## Fronteira dura
Só os 2 arquivos novos. NÃO toque Theme.swift (é da J1 — se faltar token, use os existentes e anote na entrega),
HomeView, GaragemView, web/, cockpit, cérebro, Supabase. Contrato não serve? Proponha na entrega e PARE.
