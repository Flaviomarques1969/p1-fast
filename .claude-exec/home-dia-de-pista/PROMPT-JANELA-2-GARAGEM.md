> ⚠️ SUPERSEDIDO 2026-07-11: Flávio replanejou para 5 janelas. Use os mandatos PROMPT-J1..J5. Mantido só como histórico.

# MANDATO — JANELA 2 (Opus 4.8) — CONSTRUTORA "FERRAMENTAS DE TESTE" NA GARAGEM

Você é a construtora da área "Ferramentas de teste" dentro da Garagem do app iPhone P1 Fast.
Coordenador: janela Fable 5. Leia antes: `~/.claude/CLAUDE.md`, `CLAUDE.md` do projeto,
`.claude-exec/registro-correcoes.md`, `.claude-exec/home-dia-de-pista/COORDENACAO.md`.

## Ambiente
- Crie ambiente isolado (worktree, ADR-021) na linha `claude/garagem-ferramentas-teste`, a partir da versão oficial LOCAL.
- NUNCA incorpore à versão oficial. Produção intocada.

## Contexto
Decisão do Flávio (2026-07-11): os itens de teste que hoje poluem a Home saem de lá e ganham casa
dentro da Garagem. NADA é apagado — só muda a porta. A remoção na Home é da Janela 1; você cria a casa nova.

## O que construir
Em `GaragemView` (ios/p1fast-ios/Sources/Views/…), no FIM da tela, uma seção discreta:
1. Título de seção "FERRAMENTAS DE TESTE" (eyebrow 11pt, uppercase, cor apagada).
2. Linhas-lista finas (padrão visual das linhas existentes do app, borda sutil, seta ›):
   - **"Teste ao vivo"** → abre `TesteAoVivoView` (espelhamento notebook + GPS). Sub-rótulo: "validação de campo".
   - **"Gravar telemetria"** → abre a TelemetriaView de teste (mesmo builder que hoje a Home injeta —
     mova a injeção pra Garagem ou replique o acesso; combine a fiação com o que o ContentView já fornece).
3. Navegação consistente com o padrão da Garagem (menu inferior continua visível; voltar volta UMA tela).

Regras: sem emoji; ícones de traço; vermelho só crítico; "você"; nada de tela nova de teste — só portas
para as telas EXISTENTES; preservar tudo que a Garagem já tem (inclusive Conta/Sair).

## Prova (obrigatória na entrega)
1. Empacotamento verde do projeto iOS.
2. Rodar no simulador **P1-Zoom375** (375×812); FOTO da Garagem com a seção nova e das duas telas abrindo por ela.
3. Testes automáticos existentes verdes.
4. Relatório em `.claude-exec/home-dia-de-pista/entregas/janela-2.md`: o que mudou, onde, fotos, comandos e saídas REAIS, pendências.
5. TASK_INIT/TASK_DONE no `.claude-exec/ultima-tarefa.md` (preservando histórico) + registro-correcoes se corrigir erro.

Fronteira: NÃO toque em `HomeView.swift` (é da Janela 1). Não mexa em web/, cockpit, cérebro, Supabase.
