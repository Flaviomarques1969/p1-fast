# MANDATO — J5 (Opus 4.8) — CONSTRUTORA DA ESTRUTURA DA HOME (executa JÁ, em paralelo)

(Revisado 2026-07-11: a J5 NÃO espera mais a onda 1 — todas as 5 executam juntas; a montagem final e a
auditoria são do coordenador Fable quando o Flávio disser "janela N ok".)

Você é a J5 do plano de 5 janelas. Leia antes: `.claude-exec/home-dia-de-pista/COORDENACAO.md` (contrato +
regras + fronteiras), `~/.claude/CLAUDE.md`, `CLAUDE.md` do projeto, `.claude-exec/registro-correcoes.md`.
Referência visual aprovada: `_design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html`.

## Ambiente
Ambiente isolado (worktree, ADR-021), linha `claude/home-j5-estrutura`, a partir da versão oficial LOCAL. Nunca incorporar.

## Entregável — reescrever o ESTADO CHEIO de `HomeView.swift` CONTRA O CONTRATO
As janelas 1–3 estão construindo, em paralelo, os componentes com as assinaturas EXATAS do
COORDENACAO.md §CONTRATO. Você programa a Home chamando essas assinaturas como se já existissem e cria
UM arquivo provisório `ios/p1fast-ios/Sources/Views/HomeDiaDePistaStubs.swift` com implementações
mínimas dessas mesmas assinaturas (caixas simples com o dado passado), marcado no topo:
`// PROVISÓRIO — o coordenador substitui pelos componentes reais das J1–J3 na integração e apaga este arquivo.`

Hierarquia do estado cheio (de cima pra baixo):
1. Cabeçalho "P1 Fast" (P1 branco + Fast azul) + acesso à conta discreto.
2. `HeroEventoCard` com DADO REAL: próximo evento/evento de hoje (EventoRepository); prontidão % = pendências
   resolvidas/total do próximo evento (PendenciaRepository; nil sem dado); onStint = onStintTap atual;
   onPendencias → aba Pendências. Sem evento futuro → herói "Sem eventos planejados" + botão "Criar evento".
3. `AoVivoRow` → AssistirView.
4. `MelhorVoltaCard` com `stintRepo.resumoVoltas()` (nil → "—"; evolução SÓ com dado real) → MelhorVoltaView.
5. `CarroRowCompacta` (até 3 carros reais) → CarroHubView; link "Garagem" no título da seção.
6. `NumerosRodape` → eventos/voltasResumo/stintsLista.
7. REMOVER da Home: botões antigos "ASSISTIR AO VIVO"/"TESTE AO VIVO" e caixa "ATALHOS DEV" (as telas ficam —
   a J4 dá porta na Garagem). Preserve os structs antigos sem chamada (nada de deletar tela).
Manter intactos: estado vazio, NavRouter/HomeNavTarget/BottomNav fixo, telas dos números,
PendenciasProximoEventoLauncher, comportamento do botão Stint. Tokens só do Theme; se faltar token novo
(âmbar é da J1), use o mais próximo existente e ANOTE na entrega para o coordenador trocar.

## Prova e entrega
Empacotamento verde COM os provisórios; app no simulador **P1-Zoom375** (375×812) e **iPhone 16 Pro Max**;
FOTOS do estado cheio e vazio (mesmo com peças provisórias — o que se avalia aqui é estrutura, dado real e
navegação); testes existentes verdes. Relatório `.claude-exec/home-dia-de-pista/entregas/janela-5.md`
(mudanças, fotos, comandos+saídas reais, anotações para a integração, pendências).
TASK_INIT/TASK_DONE no `ultima-tarefa.md` preservando histórico + registro-correcoes se corrigir erro.

## Fronteira dura
NÃO crie os componentes definitivos (são das J1–J3) — só os provisórios no arquivo marcado. NÃO toque
GaragemView (J4), Theme.swift (J1), web/, cockpit, cérebro, Supabase. Integração final: só o coordenador,
só com ordem do Flávio.
