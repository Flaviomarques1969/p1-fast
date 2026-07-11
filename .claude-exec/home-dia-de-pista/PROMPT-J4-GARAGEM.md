# MANDATO — J4 (Opus 4.8) — CONSTRUTORA "FERRAMENTAS DE TESTE" NA GARAGEM

Você é a J4 do plano de 5 janelas da nova Home "Dia de Pista". Coordenador: janela Fable 5.
Leia antes, nesta ordem: `.claude-exec/home-dia-de-pista/COORDENACAO.md`, `~/.claude/CLAUDE.md`,
`CLAUDE.md` do projeto, `.claude-exec/registro-correcoes.md`.

## Ambiente
Ambiente isolado (worktree, ADR-021), linha `claude/garagem-ferramentas-teste`, a partir da versão oficial LOCAL. Nunca incorporar.

## Contexto
Decisão do Flávio (2026-07-11): os itens de teste que hoje poluem a Home ganham casa dentro da Garagem.
NADA é apagado — só muda a porta. Quem remove os botões da Home é a J5; você cria a casa nova.

## Entregável
Em `GaragemView`, no FIM da tela, seção discreta:
1. Eyebrow "FERRAMENTAS DE TESTE" (11pt uppercase apagado).
2. Linhas-lista no padrão visual das linhas existentes (borda sutil, seta ›):
   - **"Teste ao vivo"** → abre `TesteAoVivoView` (espelhamento notebook + GPS). Sub-rótulo "validação de campo".
   - **"Gravar telemetria"** → abre a TelemetriaView de teste (hoje a Home recebe esse builder injetado pelo
     ContentView — mova/replique a fiação para a Garagem; declare na entrega exatamente o que fiou).
3. Navegação no padrão da Garagem (menu inferior visível; voltar volta UMA tela).

Regras: sem emoji; ícones de traço; vermelho só crítico; "você"; nada de tela nova de teste — só portas para as
telas EXISTENTES; preservar tudo que a Garagem já tem (inclusive Conta/Sair).

## Prova e entrega
Empacotamento verde; rodar no simulador **P1-Zoom375** (375×812); FOTO da Garagem com a seção nova e das duas telas
abrindo por ela; testes existentes verdes. Relatório `.claude-exec/home-dia-de-pista/entregas/janela-4.md`
(o que fez, onde, fotos, comandos+saídas reais, pendências). TASK_INIT/TASK_DONE no `ultima-tarefa.md` preservando histórico.

## Fronteira dura
NÃO toque `HomeView.swift` (J5), `Theme.swift` (J1), componentes novos das J1–J3, web/, cockpit, cérebro, Supabase.
Fiação no ContentView: o MÍNIMO necessário, declarada na entrega (a J5 também mexe lá na onda 2 — o coordenador integra).
