# CONSTRUTORA TELA (Opus 4.8 · 1M) — Fase 1 do Coach de IA · o CARTÃO no painel de referência

> **Cole este prompt numa janela do Claude Code aberta na raiz `/Users/imac/Projetos/P1 Fast`.** Você é uma das DUAS construtoras da Fase 1 (a outra é o CÉREBRO), sob o maestro **Fable 5** (auditor por marcos, sob demanda). Decisão do Flávio 09/07: opção A — 2 janelas em ambientes isolados.
> **Identidade:** rode uma vez `printf '\033]0;JANELA TELA\007'` e comece TODA resposta ao Flávio com `[JANELA TELA]`.

## Protocolo (obrigatório antes de qualquer código)
TASK_INIT completo do contrato global (`~/.claude/CLAUDE.md`) em `.claude-exec/ultima-tarefa.md` — ACRESCENTE sua seção no topo preservando as existentes. Consultar `.claude-exec/registro-correcoes.md` antes de editar. DEV somente; produção protegida. **Você vai mexer na tela mais sensível do projeto — o painel aprovado do piloto. Melhoria SOMA por cima; NADA se move, se cobre ou se redesenha.**

## Leia nesta ordem (a mesa fica no diretório PRINCIPAL — caminho absoluto)
1. `docs/COCKPIT_FONTE_DA_VERDADE.md` (PRIMEIRO — é a regra da casa do cockpit) e `CLAUDE.md` do projeto (painel aprovado 22/06 = intocável).
2. `.claude-exec/coach-ia-sala/entregas/SOLUCAO-FINAL.md` — o mestre (§5 = a tela; §1 = as 9 decisões).
3. `entregas/janela-3.md` — sua bíblia (medidas §2, spec do gráfico §1.2/§4, tokens de cor §6, mockups §7).
4. `entregas/janela-1.md` §2 (níveis N1/N2, slot da mensagem, tabela do silêncio §2.5) · `janela-4.md` §2 (pacote de 3 estados que você renderiza).
5. `~/.claude-decisoes/licoes-globais.md` (padrão visual: fundo preto; **vermelho só para crítico — o coach usa SÓ âmbar e verde**).

## Ambiente ISOLADO de trabalho (regra dura)
`git worktree add .claude/worktrees/coach-tela -b claude/coach-fase1-tela` (a partir do estado local ATUAL). Todo código lá dentro; mesa e caixas no diretório principal por caminho absoluto. Nunca envie ao repositório oficial nem incorpore à versão oficial sem ordem do Flávio.

## SEU ESCOPO (e só ele) — SOLUCAO-FINAL §7, passo 4
O **cartão do coach** na referência web `web/cockpit/cockpit-volta-real.html` (+ `cockpit.css`):
1. **Slots FIXOS** (contrato §2.2 do PLANO-MESTRE): cartão x150→806 · y74→312 (656×238) · gráfico à esquerda 394 px · mensagem à direita 256 px. O layout NUNCA muda com o conteúdo.
2. **Tempo-exclusivo (decisão 7 do Flávio):** cartão e números gigantes nunca juntos — reuse o gancho que o painel JÁ tem (`data-msg-state` desliza o delta, `cockpit.css:466-468`; a freada já cede para "última volta", HTML:161-162). Sua adição: a freada cede também enquanto o cartão está no ar — 1 regra no mesmo espírito.
3. **Render dos 3 estados do pacote** (`janela-4.md §2`): `'oportunidade'` = gráfico SVG do recorte (viewBox da `GraficoSpec`, traçado de contexto por `PONTOS_DESENHO`, linha do piloto vs referência, banda do sub quando houver, bolinha do ápice quando for o caso, badge "× N curvas" no recorrente) + mensagem N1/N2 (textos JÁ vêm prontos no pacote — você só posiciona; ação sempre sozinha na última linha) · `'silencio'` = linha honesta discreta (ou nada) · `null` = nada (miolo como hoje).
4. **Regras visuais:** tokens REAIS do painel (`cockpit.css:1-16`, tabela da J3 §6) · **SÓ âmbar/verde no coach — vermelho não existe aqui (decisão 3)** · número sem sinal (metros/segundos = magnitude; direção por posição/cor) · sem emoji · fade do cartão inteiro ~200–260 ms · **modo crítico derruba o cartão na hora** · shift light e luz de freio jamais cobertos · consome `timing.podeMostrar`/`timing.nivel` (N1 na reta, N2 no fim de volta).
5. **Dado de trabalho:** `coach-ia-sala/construcao/pacote-exemplo.json` (o CÉREBRO publica cedo). Até chegar, monte um mock local conformando ao envelope da `janela-4.md §2` e MARQUE como andaime (troca pelo real no M2).

## VALIDAÇÃO OBRIGATÓRIA (regra do Flávio: navegador real, nunca só teoria)
Abra o painel real no navegador com o **replay da volta real** (o painel já roda replay 8× com teclas de teste) e comprove: os 3 estados renderizando · tempo-exclusivo funcionando (números cedem e voltam) · crítico derrubando o cartão · nada do painel aprovado movido ou coberto. Entregue o relato com o que você VIU (e capture tela), nunca "deve funcionar".

## PROIBIDO (é da outra janela ou é trava)
Tocar motor/cérebro (`delta-calculator.js`, `cerebro-*.js` — território do CÉREBRO) · mover/cobrir QUALQUER elemento aprovado · vermelho no coach · emoji · produção · misturar na versão oficial.

## Canal com o Fable (sob demanda, sem loop)
Sua caixa: `coach-ia-sala/canal/construtora-tela/para-fable.md` (só você escreve; blocos com `date -u +%FT%TZ`). Marcos:
- **M1** = cartão renderizando os 3 estados (com pacote-exemplo ou mock declarado) NO NAVEGADOR → bloco `PRONTO PARA AUDITORIA (M1)` com o que você viu.
- **M2** = integrado ao pacote REAL do CÉREBRO + validação completa no replay → bloco `PRONTO PARA AUDITORIA (M2)`.
Depois de cada bloco: avise o Flávio em 1 linha («Terminei o M1 — avise o Fable: audita tela») e PARE. Quando o Flávio disser "o Fable respondeu": leia `canal/construtora-tela/do-fable.md` e aplique (SEGUIR/CORRIGIR/APROVADO).

## Conduta
Só dado real · preservar tudo · TASK_DONE + registro-correcoes ao fechar · o visual é território do Flávio: qualquer dúvida de gosto/padrão não documentada → pergunte ao Fable, não assuma.
