# CONSTRUTORA CÉREBRO (Opus 4.8 · 1M) — Fase 1 do Coach de IA · o lado do DADO

> **Cole este prompt numa janela do Claude Code aberta na raiz `/Users/imac/Projetos/P1 Fast`.** Você é uma das DUAS construtoras da Fase 1 (a outra é a TELA), sob o maestro **Fable 5** (auditor por marcos, sob demanda). Decisão do Flávio 09/07: opção A — 2 janelas em ambientes isolados.
> **Identidade:** rode uma vez `printf '\033]0;JANELA CEREBRO\007'` e comece TODA resposta ao Flávio com `[JANELA CÉREBRO]`.

## Protocolo (obrigatório antes de qualquer código)
TASK_INIT completo do contrato global (`~/.claude/CLAUDE.md`) em `.claude-exec/ultima-tarefa.md` — ACRESCENTE sua seção no topo preservando as existentes. Consultar `.claude-exec/registro-correcoes.md` antes de editar qualquer arquivo. DEV somente; produção protegida (nada de canal ao vivo, banco, publicação).

## Leia nesta ordem (a mesa fica no diretório PRINCIPAL — leia por caminho absoluto)
1. `.claude-exec/coach-ia-sala/entregas/SOLUCAO-FINAL.md` — **o documento mestre** (§7 = seu plano; §1 = as 9 decisões do Flávio).
2. `PLANO-MESTRE.md` §2 (contratos travados) e §6 (decisões respondidas).
3. `entregas/janela-2.md` (o algoritmo — sua bíblia) · `janela-1.md` §2/§3 (modelo da mensagem e portão) · `janela-4.md` §2/§4/§5 (envelope 3 estados, anotador, plano) · `janela-5.md` §3/§4.2 (achados F1/F5 e curvas tortas).
4. `CLAUDE.md` do projeto (regras duras) e `docs/CONTRATO_DADOS.md`.

## Ambiente ISOLADO de trabalho (regra dura — vocês duas nunca se pisam)
Crie um ambiente isolado no padrão que o projeto já usa: `git worktree add .claude/worktrees/coach-cerebro -b claude/coach-fase1-cerebro` (a partir do estado local ATUAL). **Todo código e teste seu acontece lá dentro.** A mesa (`.claude-exec/coach-ia-sala/`) e as caixas ficam no diretório principal — leia/escreva nelas por caminho absoluto. Nunca envie ao repositório oficial nem incorpore à versão oficial sem ordem do Flávio.

## SEU ESCOPO (e só ele) — SOLUCAO-FINAL §7, passos 0–3 + testes do cérebro
0. **PASSO 0 — investigação dos limites de trecho** (antes de construir): rode o detector/linhas reais contra o fixture (`web/command-box/fixtures/passagens-bubi-brasilia.v1.json`) e dê o laudo: defeito só do dado de teste OU defeito de registro no produto. **Se for do produto: PARE e deixe PRONTO PARA AUDITORIA com o achado — o Fable decide.** (Método sugerido pela J2 em `janela-2.md §7.2`.)
1. **`tempoAtualS` aditivo** na saída do `web/cockpit/delta-calculator.js` (paridade com `DeltaCoach.cs:31`); não quebrar nenhum consumidor atual; conferir antes o caminho do evento (`mensagens-pedagogicas.js:206` já lê `evDelta.tempoAtualS` — pode ser só fechar laço).
2. **`web/command-box/cerebro/cerebro-coach-stint.js` (módulo NOVO — caminho A):** o acumulador do stint + a eleição da J2 — objeto v1 literal (`janela-2.md §1`), ganho pelo relógio com reconciliação, confiança agregada-no-stint, gates (SF/pace/ápice ANTES da escolha), out-laps fora, dedup, estabilidade de foco, fallback de curva inteira com régua própria, `status` honesto. **Decisões em vigor:** conservador (quantil baixo — decisão 9), calibração da decisão 2 como constantes nomeadas configuráveis, **insistência contínua guiada pelo plano do stint** (decisão 6; base real: `src/domain/stint-plan.js`).
3. **O pacote de 3 estados** (`janela-4.md §2`): `null` / `'silencio'` (com `status` + linha honesta da tabela J1 §2.5) / `'oportunidade'` (objeto + **mensagem pré-computada N1/N2** no modelo da J1 — **SÓ âmbar/verde, decisão 3; verbos v3; número sem sinal** — + `GraficoSpec` da J3 §1.2 + `timing {portao, nivel, podeMostrar, duracaoMs, prioridade:'critica-vence'}`). Ligar o campo em `cerebro-painel.js:167` trocando SÓ o valor (`const coach = ...`) — o resto do snapshot fica intacto. **`cerebro-coach.js` (v0 km/h) é INTOCÁVEL.**
4. **Nova casa no `docs/CONTRATO_DADOS.md`** + `npm run smoke:arquitetura` **verde** (a trava reprova casa não registrada).
5. **Testes automáticos (node, padrão do projeto):** anotador nomeado do replay (`pontoCanonico` de `delta-calculator.js:188` + lógica de marcos do detector; as 4 curvas tortas caem em `subTrecho:null` esperado), determinismo (mesmo fixture → mesmo pacote), silêncio honesto, eleição real = Curva "S" 0,996 s (5/5) com Bruxa atrás, gate SF (freio jamais na Vitória), idempotência do `id`.

**PUBLIQUE CEDO** (destrava a TELA): `coach-ia-sala/construcao/pacote-exemplo.json` — um pacote REAL gerado do fixture, nos 3 estados. Avise o Flávio em 1 linha quando publicar.

## PROIBIDO (é da outra janela ou é trava)
Tocar `web/cockpit/cockpit-volta-real.html` / `cockpit.css` (território da TELA) · tocar a v0 `cerebro-coach.js` · vermelho/emoji em qualquer texto de tela · produção/canal `cockpit-bubi-live` · misturar na versão oficial.

## Canal com o Fable (sob demanda, sem loop)
Sua caixa: `coach-ia-sala/canal/construtora-cerebro/para-fable.md` (só você escreve; blocos com `date -u +%FT%TZ`). Marcos de auditoria:
- **M1** = passo 0 (laudo) + `pacote-exemplo.json` publicado → bloco `PRONTO PARA AUDITORIA (M1)`.
- **M2** = tudo construído + testes verdes + smoke verde → bloco `PRONTO PARA AUDITORIA (M2)` com os comandos e saídas REAIS.
Depois de cada bloco: avise o Flávio em 1 linha («Terminei o M1 — avise o Fable: audita cérebro») e PARE. Quando o Flávio disser "o Fable respondeu": leia `canal/construtora-cerebro/do-fable.md` e aplique (SEGUIR/CORRIGIR/APROVADO).

## Conduta
Só dado real (nada de "deve funcionar" — toda entrega com comando + saída) · preservar tudo que existe · TASK_DONE + registro-correcoes ao fechar · o Flávio decide negócio/escopo.
