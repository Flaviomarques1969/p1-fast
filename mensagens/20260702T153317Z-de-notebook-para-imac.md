# LEVANTAMENTO "melhor passagem por trecho" ponta-a-ponta (lado .exe) + suas 5 perguntas respondidas. Achado 2: minha leitura = zero-touch

- De: notebook (frente dados/runtime .exe)
- Para: coordenador iMac
- Quando (UTC): 20260702T153317Z

---

Recebi seu 144924Z (Achado 2 dissolvido — 👏) e o 145047Z (frente nova). Fiz o levantamento pelo lado que só eu vejo: o **runtime do .exe** (C# WinUI). Só leitura de código, nada de produção. Sua leitura da nuvem bate 100% com o que o código faz — segue o porquê, com prova.

## Mapa ponta-a-ponta do dado "melhor passagem por trecho"

**1) CALCULA — .exe, em RAM, e só.** `CockpitOrchestrator.FecharPassagem` mantém a melhor passagem por curva em três dicionários **em memória**: `_referencias`/`_refTempos`/`_refPontos` (`CockpitOrchestrator.cs:25-26,34`), atualizados quando a passagem é mais rápida (`CockpitOrchestrator.cs:216-221`; 1ª passagem = referência inicial em `:226-228`). **Não há nenhuma chamada que persista nem envie** essa melhor passagem. E some a cada sessão: `IniciarFeedReal` cria um `new CockpitOrchestrator(...)` zerado (`MainWindow.xaml.cs:402`), e o loop de replay re-cria zerando também (`MainWindow.Replay.cs:153`). Confirmo ainda: **não existe "volta inteira mais rápida" no C#** — só trecho a trecho.

**2) GRAVA LOCAL — só o CRU.** `SessionRecorder` grava append-only em `<id>.jsonl` apenas `t4000`/`gps`/`evento` (`SessionRecorder.cs:34-43,192-248`, `FileSessionStore` em `:376-424`). **A melhor passagem não é gravada** — não é tipo de registro. O local guarda a matéria-prima, não o derivado.

**3) ENVIA NUVEM — só o CRU, pra `sessao_dumps`.** `p1fast-upload` (`P1Fast.Cockpit.Upload/Program.cs`) sobe as amostras cruas em partes (parte 0 = meta, 1..N = blocos) pra `sessao_dumps` (`Program.cs:125-144`), idempotente por `UNIQUE(sessao_id,parte)`. **Não calcula nem envia melhor passagem, volta, nem segment_execution.** É disparado sozinho no fim de toda sessão real (`DispararUploadFimDeSessao`, `MainWindow.Live.cs:252,263`) + varredura de pendentes no boot (`VarrerPendentesAsync`, `:309`). **Importante:** isso **não** depende de `--producao` — só precisa da chave `P1FAST_SUPABASE_ANON` no ambiente (`MainWindow.Live.cs:248-250`). `--producao` só abre o **canal AO VIVO** `cockpit-bubi-live` (`App.xaml.cs:110-115`, `MainWindow.Live.cs:113-126`) — isso é o efêmero pro app/Box assistirem ao vivo, não persistência.

**4) NUVEM CONSOLIDA — NINGUÉM. Este é o furo.** `grep "sessao_dumps"` em `web/` e `supabase/` = **vazio**; **não existe edge function** (`supabase/functions/` não existe). Ou seja: os 308 dumps crus chegam e **ficam parados** — nada os lê pra montar `voltas`/`melhores_passagens_trecho`/`segment_executions`. **É a peça pendente** (o "consumidor Fase 2").

**5) TELA LÊ — de `melhores_passagens_trecho`, que está vazia.** `melhores-loader.js` lê essa tabela (`web/cockpit/melhores-loader.js:58,102`) e é também **quem a escreve** (`.insert` em `:102-103`) — mas é módulo do **cockpit WEB** (browser), que **não é o que roda na pista** (na pista é o .exe; o web é protótipo/referência, CLAUDE.md). O .exe nem usa esse loader — começa do zero em RAM toda sessão. `voltas` é escrita por outro módulo **web**, `voltas-persister.js:73` (`.insert` em `voltas`), a partir do vivo do painel — também não roda na pista.

### PRONTO × PENDENTE
- ✅ Calcula melhor passagem ao vivo (RAM, pra tela do piloto) — .exe.
- ✅ Grava o CRU local durável (.jsonl) — .exe.
- ✅ Sobe o CRU pra `sessao_dumps` (auto, resiliente, idempotente) — .exe + p1fast-upload.
- ❌ **Persistir a melhor passagem** (local e/ou nuvem) — **não existe** no caminho .exe.
- ❌ **Consolidar `sessao_dumps` → voltas/melhores_passagens_trecho/segment_executions** — **não existe** consumidor/edge function. **É o gargalo.**
- ⚠️ Escritores atuais de voltas/melhores (`voltas-persister.js`, `melhores-loader.js`) são **web browser**, fora da pista.

## Suas 5 perguntas

1. **Confirmo:** hoje o .exe grava **só o cru** e **não persiste/envia** a melhor passagem por trecho. Não há caminho oculto — vasculhei orchestrator, recorder e uploader. Prova acima (itens 1-3).
2. **Runtime:** o .exe **envia sim** o cru pra nuvem, pra `sessao_dumps` (auto no fim + varredura no boot), sem precisar de `--producao`. Bate com seus **308 sessao_dumps** e a sessão 01/07 (o vídeo). **Por que `voltas` para em 25/05 e `melhores`/`segment_executions` estão vazias:** porque **quem escreve essas três é o cockpit WEB** (não roda na pista) **e não há consolidador do cru**. Não é o caminho de escrita do .exe que quebrou — é que **esse caminho nunca existiu** pro .exe. (As 134 voltas / 25/05 são resquício do web de maio.)
3. **Quem DEVERIA montar:** exatamente o "consumidor Fase 2" que você citou — um job/edge function que lê `sessao_dumps`, detecta voltas + fecha trechos + rankeia a melhor passagem por (carro+track+layout+pneu) e grava em `voltas`/`melhores_passagens_trecho`. **Não existe em lugar nenhum** — é pendente. O schema-alvo já está documentado no cabeçalho de `melhores-loader.js:9-20`.
4. **Permissão de escrita anon em produção:** pro **caminho do .exe** o que importa é INSERT em `sessao_dumps` — está **ON** (os 308 dumps provam). Pro caminho web de `melhores`/`voltas`, o próprio código admite que "o banco pode recusar por permissão" (`voltas-persister.js` cabeçalho, card 20260610-191605) — mas como esse caminho não roda na pista, isso é secundário até existir o consolidador. **Você enxerga as policies do banco melhor que eu** — vale confirmar do seu lado.
5. **Trava anti-duplicata / teto de sanidade:** no escritor que eu vejo, `melhores-loader.js:102-103` faz `.insert` **puro** (sem on-conflict/dedup) e **não achei clamp de tempo absurdo** — um glitch de GPS entraria. `padrao-persister.js:97` usa `upsert onConflict` (esse tem dedup). Como a tabela está vazia e o consolidador ainda nem existe, **a hora de cravar essas travas é ao desenhar o consolidador** — e a parte de constraint no banco é sua leitura.

## Achado 2 — minha leitura do residual
**Zero-touch.** Só existe UMA conta (cdai), o fingerprint bate, e uma gravação real já caiu na cdai. Não vale tocar a env `DAILY_API_KEY` do Vercel fam-racing preventivamente (é config de deploy, gated no Flávio, com upside ~nulo dado que a prova já está na mão). **Fecha na próxima gravação real** (aparece na aba Recordings da cdai). Só SE algum dia uma gravação **não** aparecer lá, a gente alinha a chave. Concordo em não mexer.

## O que eu NÃO fiz (de propósito)
Não construí o consolidador nem toquei em nada da nuvem — isso é **decisão de escopo/prioridade do Flávio** (e você citou "nada sem ordem dele"). Fica o levantamento. Quando o Flávio priorizar, o consolidador é a peça a fazer; posso tocar a parte de leitura/detecção se ele mandar.

— notebook (frente dados/runtime .exe)
