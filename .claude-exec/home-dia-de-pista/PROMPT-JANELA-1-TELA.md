> ⚠️ SUPERSEDIDO 2026-07-11: Flávio replanejou para 5 janelas. Use os mandatos PROMPT-J1..J5. Mantido só como histórico.

# MANDATO — JANELA 1 (Opus 4.8) — CONSTRUTORA DA TELA HOME "DIA DE PISTA"

Você é a construtora da NOVA tela principal do app iPhone P1 Fast. Coordenador: janela Fable 5.
Leia antes: `~/.claude/CLAUDE.md`, `CLAUDE.md` do projeto, `.claude-exec/registro-correcoes.md`,
`.claude-exec/home-dia-de-pista/COORDENACAO.md`.

## Ambiente
- Crie ambiente isolado (worktree, ADR-021) na linha `claude/home-dia-de-pista`, a partir da versão oficial LOCAL.
- NUNCA incorpore à versão oficial. Produção intocada.

## O que construir
Reescrever o ESTADO CHEIO da Home (`ios/p1fast-ios/Sources/Views/HomeView.swift`) seguindo 1:1 a
referência aprovada pelo Flávio: `_design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html`.

Hierarquia nova (de cima pra baixo):
1. **Cabeçalho** "P1 Fast" (P1 branco + Fast azul) + avatar/conta discreto.
2. **Herói do evento**: cartão do próximo evento (ou evento ativo hoje) com pista, data, apelido do
   autódromo, selo âmbar "EM N DIAS" (ou "HOJE" em azul), **anel de prontidão** (arco SVG âmbar com %
   real = pendências resolvidas/total do próximo evento), linha de pendências ("N pendências antes da
   pista" → toca e abre Pendências) e **botão grande primário "Iniciar Stint"** (mesma ação do onStintTap atual).
3. **Linha "Ao vivo"**: cartão fino elegante que abre AssistirView (SEM borda vermelha — ponto verde discreto + "Assistir").
4. **Sua melhor volta**: cartão com mini traçado da pista (SVG de traço; reutilize `PistaBrasilia.swift` se couber),
   tempo grande tabular (dado real do `stintRepo.resumoVoltas()`; "—" se não houver) e evolução em verde só com dado real.
5. **Seus carros**: linhas compactas (swatch, apelido, nº stints) → CarroHubView. Link "Garagem" à direita do título.
6. **Números secundários** (eventos · voltas · stints) numa linha pequena no rodapé do conteúdo, cada um clicável
   como hoje (eventos/voltasResumo/stintsLista).
7. **REMOVER da Home**: botões "ASSISTIR AO VIVO"/"TESTE AO VIVO" antigos e a caixa "ATALHOS DEV".
   NÃO apague `TesteAoVivoView`, `AssistirView` nem o atalho de telemetria — as telas ficam; a Janela 2 dá porta na Garagem.
   (Preserve os structs antigos comentando a chamada ou movendo — nada de deletar tela.)

Manter intactos: estado vazio (EmptyContent), navegação (NavRouter, HomeNavTarget, BottomNav fixo Home/Eventos/Pendências/Garagem),
telas dos números, PendenciasProximoEventoLauncher, e o comportamento do botão Stint.
Tokens só de `Theme.swift` — se faltar token (âmbar), acrescente lá sem mudar os existentes.

## Regras duras
- Sem emoji; ícones de traço. Vermelho SÓ crítico; atenção = âmbar. Tratamento "você". Dado real primeiro ("—" honesto).
- Prontidão: usar PendenciaRepository do próximo evento; sem evento futuro → herói vira "Sem eventos planejados" + botão "Criar evento".
- Não quebrar o que funciona; preservar tudo; nada de dado inventado.

## Prova (obrigatória na entrega)
1. Empacotamento verde do projeto iOS.
2. Rodar no simulador **P1-Zoom375** (375×812) e **iPhone 16 Pro Max**; tirar FOTO das duas (estado cheio e vazio).
3. Testes automáticos existentes do projeto verdes.
4. Relatório em `.claude-exec/home-dia-de-pista/entregas/janela-1.md`: o que mudou, onde, fotos, comandos e saídas REAIS, pendências.
5. TASK_INIT/TASK_DONE no `.claude-exec/ultima-tarefa.md` (preservando o histórico) + registro-correcoes se corrigir erro.

Fronteira: NÃO toque em `GaragemView` (é da Janela 2). Não mexa em web/, cockpit, cérebro, Supabase.
