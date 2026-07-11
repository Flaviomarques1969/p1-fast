# TASK_DONE FINAL — Fase 1 multi-aparelho NO AR E PROVADA (25/06 ~19:46)
```
TASK_DONE:
- Pedido original conferido: sim (retomar login → incorporar login + Fase 1 multi-aparelho)
- Ambiente trabalhado: desenvolvimento + PRODUÇÃO (Flávio "autorizado" em resposta direta ao pedido de publicação)
- Produção foi alterada: sim (Supabase p1-fast: migration 0049 aplicada + Edge Functions sync/pull deployadas)
- Se produção foi alterada, autorização explícita registrada: sim ("autorizado", resposta direta ao pedido que citava a frase exata)
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim (smoke 575/1 + node-smoke sync 21/0 e pull 19/0 + REST 3 tabelas 200 + PROVA AO VIVO no iPhone)
- Resultado: CONCLUÍDO E PROVADO. equipe_membros 4/4 com synced_at preenchido (nuvem aceitou), fila vazia. Login + Fase 1 no ar.
- Pendências reais: prova visual num 2º aparelho (cloud→device; mecanismo deployado, falta um 2º celular logado); Fase 2 (convite) e Fase 3 (TestFlight)
```
### PROVA AO VIVO (iPhone 16 Pro Max 2D6E7A3B, banco puxado do aparelho)
equipe_membros: 4 total / 4 subiram. Allan Mesquita(engenheiro), Bubi(piloto), Dri(convidado), Flávio(chefe_equipe), todos time c027a716, estado "subiu". sync_queue dessas 3 tabelas: vazia. → device→cloud→servidor-aceitou provado ao vivo em produção.
### O que entrou em produção (autorizado)
- Migration 0049: tabelas equipe_membros/stint_check/dia_check no p1-fast, RLS por time. Aplicada via `supabase db push --linked` (dry-run mostrou só a 0049).
- Edge Functions sync + pull deployadas (`functions deploy --project-ref fvhwltzhytpnhlqbttmd`). Validação REST anon: 3 tabelas HTTP 200 vazio (existem; RLS esconde).
### O que entrou na versão oficial (iOS)
- ContentView/GaragemView/HubMockLauncher (login) + HubMockLauncher (8 enqueueRecord) + SyncCoordinator (pullTables +3) + SyncBackfill (+3, sobe o que já existe).
### Rollback disponível
- Migração: drop das 3 tabelas (no próprio 0049). Functions: redeploy da versão anterior. iOS: ambiente isolado login-pessoa/multiaparelho-fase1 preservados.

---

# TASK_INIT — RETOMAR LOGIN · incorporar login por pessoa na oficial + começar Fase 1 multi-aparelho — 25/06/2026

- **Pedido original de Flávio**: "retomar login". No card respondeu **"Testei e aprovo"** (login funcionou no iPhone → autorizou incorporar na versão oficial).
- **Objetivo (1 frase)**: incorporar o login por pessoa na `main` local de forma cirúrgica (sem reverter o que a oficial avançou) e começar a Fase 1 do multi-aparelho no lado iOS (enfileirar equipe/checklist), SEM tocar na nuvem/produção.
- **Critérios de conclusão**: ContentView/GaragemView/HubMockLauncher incorporados com login funcionando; nada da main revertido (HomeView +71, stint ao vivo, assistir-demo preservados); BUILD SUCCEEDED + smoke 575/1; Fase 1 iOS = equipe_membros/stint_check/dia_check passam a enfileirar (SyncQueue) sem ligar a nuvem.
- **Leitura confirmada**: ~/.claude/CLAUDE.md (sim), padroes.md (sim, vazio), FLAVIO_EXECUTION_PROTOCOL/DONE_CHECKLIST/ENVIRONMENT_RULES/COMMUNICATION_RULES (sim), CLAUDE.md do projeto + RETOMAR-LOGIN-E-CONVITE.md (sim).
- **Plano (≤5)**: 1) trazer GaragemView+HubMockLauncher da login-pessoa (só elas mudaram esses arquivos desde o ancestral); 2) aplicar merge 3-way limpo do ContentView (validado em scratchpad, conflito zero); 3) BUILD + smoke, reportar saída real; 4) registrar na main local (commit auditado, SEM push/deploy); 5) começar Fase 1 multi-aparelho lado iOS, isolado, SEM tocar servidor.
- **Áreas**: ios/p1fast-ios/Sources/Views/{ContentView,GaragemView,HubMockLauncher}.swift; SyncQueue.swift/SyncDrainer.swift; EquipeStore/StintCheckStore/DiaCheckStore.
- **Ambiente alvo**: desenvolvimento (app iOS + main LOCAL).
- **Produção protegida**: sim. **Autorização para produção**: não. **Evidência**: "não recebida" (nuvem = Edge Functions sync/pull + migrações + RLS; Fase 1 server-side fica PARADA aguardando "MIGRAR PARA PRODUÇÃO:").
- **Riscos**: login-pessoa está 22 commits atrás da main (auto-saves) → incorporar no chute reverteria HomeView/stint ao vivo/assistir-demo (mitigado: cirúrgico + merge 3-way validado); auto-save commitando no meio (conferir diff); NÃO trazer Package.resolved (ADR-022).
- **Status inicial**: iniciado.

## TASK_DONE — login INCORPORADO; Fase 1 iOS PRONTA (isolada); servidor BLOQUEADO
```
TASK_DONE:
- Pedido original conferido: sim ("retomar login" → incorporar login aprovado + começar Fase 1)
- Ambiente trabalhado: desenvolvimento (app iOS + main LOCAL + worktree isolado)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a (servidor NÃO tocado)
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim (BUILD SUCCEEDED 2x + smoke núcleo 575/1)
- Resultado: PARCIAL — login incorporado e provado; Fase 1 iOS construída e isolada; Fase 1 servidor = produção, BLOQUEADA aguardando "MIGRAR PARA PRODUÇÃO"
- Pendências reais: liberar o servidor (3 tabelas Postgres + RLS + ALLOWED_TABLES no sync + TEAM_TABLES no pull + deploy) = produção; depois incorporar o iOS na main e instalar no iPhone; Fase 2 (convite) e Fase 3 (TestFlight)
```
### Arquivos alterados
- **Incorporado na main** (commit b0fdab0e + auto-saves 17:31–17:37): ContentView.swift (merge 3-way: login + stint ao vivo + assistir-demo), GaragemView.swift e HubMockLauncher.swift (versão login-pessoa, superset). `.claude-exec/ultima-tarefa.md`.
- **Ramo isolado `multiaparelho-fase1`** (NÃO na main, NÃO no iPhone): HubMockLauncher.swift (8 enqueueRecord nos 3 stores), SyncCoordinator.swift (3 tabelas no pullTables).
### O que foi preservado
- HomeView.swift (+71 da oficial), stint ao vivo, assistir-demo, checklist do stint — tudo intacto. Worktree login-pessoa preservada. Nada removido.
### Validação executada
- main: `xcodebuild ... iPhone 17` = BUILD SUCCEEDED; `swift run p1fast-smoke` = 575 ok / 1 fail (PERSIST-03 pré-existente, tabela evento_pendencias_extra).
- multiaparelho-fase1: `xcodebuild ... iPhone 17` = BUILD SUCCEEDED.
### Checagem contra o pedido original
- Incorporar login (aprovado "Testei e aprovo"): FEITO e provado. Começar Fase 1 multi-aparelho: lado iOS FEITO (isolado); lado servidor identificado e BLOQUEADO por ser produção.
### Pendências ou riscos
- Fase 1 só funciona ponta a ponta com o servidor liberado (produção). Enquanto isso, NÃO incorporar o iOS na main nem instalar (senão o app do Flávio acumula falhas de sincronização "tabela não permitida" e erro de pull em tabela inexistente). Aguardando "MIGRAR PARA PRODUÇÃO: Fase 1 multi-aparelho servidor".

### PROD_RELEASE_PLAN (servidor Fase 1 — pronto, aguardando autorização)
- O que será migrado: criar no Postgres da nuvem (p1-fast) as tabelas `equipe_membros`, `stint_check`, `dia_check` (colunas dos modelos locais, sem `synced_at` que é client-only) + índices + RLS por time (padrão `is_member`/`is_admin`, ver 0046_estoque_unificado_sync.sql); liberar as 3 no `ALLOWED_TABLES` (supabase/functions/sync/index.ts) e no `TEAM_TABLES` (supabase/functions/pull/index.ts); deploy das 2 Edge Functions.
- Origem em desenvolvimento: ramo `multiaparelho-fase1` (iOS) + nova migration a escrever.
- Destino em produção: Supabase p1-fast (Postgres + Edge Functions sync/pull).
- Banco afetado: sim (3 tabelas NOVAS; não altera tabela existente). Migration necessária: sim. Risco de perda de dados: não (só cria).
- Plano de rollback: DROP das 3 tabelas + reverter as 2 funções pro deploy anterior.
- Teste feito em desenvolvimento: iOS compila; ponta a ponta só dá pra provar depois do deploy (canal/banco de teste primeiro, se quiser).
- Validação pós-deploy: 2 aparelhos com o mesmo time → editar equipe num, aparecer no outro; marcar checklist num, aparecer no outro.

---

# TASK — CHECKLIST DO STINT · "faça todas" (carro voltou + PIN no checklist; Command Box bloqueado) — 25/06/2026

```
TASK_DONE:
- Pedido original conferido: sim ("faça todas" = carro saiu/voltou + Command Box + login PIN)
- Ambiente trabalhado: desenvolvimento (worktree passo2-final → incorporado na versão oficial)
- Produção foi alterada: não
- Arquivos reais inspecionados: sim (CONTRATO_DADOS, cérebro web, StintRepository/SyncQueue, mockups)
- Alterações feitas: sim (1 arquivo: HubMockLauncher.swift)
- Testes/validação executados: sim (BUILD SUCCEEDED + smoke 575/1 + screenshots /tmp/prova-passo2-final/)
- Resultado: 2 das 3 FEITAS e INCORPORADAS; a 3ª (Command Box) BLOQUEADA por infra (sem ponte celular→nuvem)
- Pendências reais: (d) Command Box exige a ponte celular→nuvem (sprint futuro); opcional: PIN na porta do app (só sob ordem)
```
FEITO E INCORPORADO: (e) **carro voltou pro box** = controle manual do chefe (marca `_carro_voltou` em stint_check; aviso grande some sozinho — provado: pessoa entra direto nos itens); (3) **login por PIN DENTRO do checklist** ("Quem é você?" → marca PIN por pessoa → toca o nome → "Confirme que é você" + teclado 4 díg → `PinSeguranca.confere`; aditivo; NÃO toca a porta do app/tela inicial — regra dura). NÃO FEITO + motivo honesto: (d) **Command Box** — o app não sincroniza stint_check com a nuvem (ponte celular→nuvem é sprint futuro) e a TV/cérebro só leem o canal de telemetria; forçar = furar a arquitetura ou inventar. Incorporado cirúrgico (1 arquivo, conflito zero). Worktree `passo2-final` preservada como rollback.

> Decisão tomada por mim (Flávio "faça todas"): sinal carro = manual do chefe (funciona hoje; automatizável depois). PIN ficou no checklist, não na porta do app (regra dura da tela inicial).

---

# TASK — CHECKLIST DO STINT · passo 2 (pendência grande + vibra + visão do chefe) — 25/06/2026

```
TASK_DONE:
- Pedido original conferido: sim ("vá para o passo 2" + escolha "Lista do chefe (no app)" + "sim" pra incorporar)
- Ambiente trabalhado: desenvolvimento (worktree pendencia-grande-stint → incorporado na versão oficial)
- Produção foi alterada: não
- Arquivos reais inspecionados: sim (mockup onda2-checklist-EXECUCAO-FINALIZAR.html + contrato)
- Alterações feitas: sim (1 arquivo: HubMockLauncher.swift)
- Testes/validação executados: sim (BUILD SUCCEEDED + smoke 575/1 + screenshots /tmp/prova-pendencia/)
- Resultado: concluído (3 de 5 partes do passo 2) e INCORPORADO na versão oficial (Flávio: "sim")
- Pendências reais: (d) espelho no Command Box (TV/nuvem); (e) sinal "carro saiu/voltou" (decisão do Flávio); passo 3 = login PIN
```
Feito e provado: (a) pendência grande na 1ª tela da pessoa (mockup painel C); (b) vibra ≥2× ao abrir com obrigatório pendente (só no aparelho); (c) Visão do chefe (lista pendências = obrigatórios pré não feitos + responsável; atalho dev `--p1-visao-chefe`). Incorporado cirúrgico (1 arquivo, conflito zero). Giro/tela inicial intactos. Worktree `pendencia-grande-stint` preservada como rollback.

> NOTA: este arquivo está sendo escrito por mais de uma sessão (Command Box em paralelo). Bloco do checklist do stint acrescentado no topo, sem apagar o resto.

---

# TASK_DONE — ETAPA 1 do fluxo do usuário: "Stint ao vivo" na primeira tela — 25/06/2026

- **Pedido**: Flávio aprovou o mapa do fluxo e escolheu começar pela PRIMEIRA TELA — o stint ativo aparecer sozinho na home e abrir ao clicar.
- **Feito (app iOS, DEV)**: card "STINT AO VIVO" no topo da home quando há stint rodando; some quando finaliza; toca → tela de espectador (rota `.assistir`, a mesma do botão "Assistir ao vivo" que já existe).
- **Arquivos (3, todos já-membros do projeto — sem arquivo novo, pra não esbarrar no empacotamento iOS)**:
  - `ios/p1fast-ios/Sources/Persistence/StintRepository.swift` — `@Published stintAtivo` + `carregarStintAtivo()` (consulta status='ativa', data_fim NULL, não cancelado, mais recente); recarrega ao criar/finalizar stint.
  - `ios/p1fast-ios/Sources/Views/HomeView.swift` — `HomeData.stintAoVivo` + `StintAoVivoInfo` + componentes `StintAoVivoCard`/`AoVivoDot` + render no topo do FilledContent (NavigationLink → `.assistir`).
  - `ios/p1fast-ios/Sources/Views/ContentView.swift` — mapeia `stintRepo.stintAtivo` no `realHomeState`; dispara `carregarStintAtivo()` no bootstrap E quando a Home aparece (`.task`) — conserta o caso do bootstrap rodar antes do time do usuário estar pronto.
- **Validação executada (provas reais)**:
  - BUILD SUCCEEDED 2x (xcodebuild, simulador iPhone 17, 0 erros).
  - Consulta de detecção provada correta no banco real do app (acha o stint ativo certo do time logado).
  - App rodando no simulador: card "STINT AO VIVO · Treino · 0 voltas" aparece no topo da home (screenshot); ausente quando não há stint ativo (comportamento correto).
- **Estado**: mudanças salvas no ramo LOCAL (auto-save commitou 16:13); NÃO enviado pra versão oficial remota; produção intocada. Estado de demonstração no simulador (1 evento movido pro time logado) — reverter depois.
- **Limitação honesta**: não consegui demonstrar o CLIQUE via automação (toque por coordenada impreciso); a navegação reusa a rota `.assistir` já existente e testada (botão Assistir). Reatividade "ao vivo entre aparelhos" (aparecer quando OUTRO piloto inicia, via nuvem) = refinamento posterior; no MVP o card reage ao stint do time local + ao criar/finalizar.
- **Resultado**: concluído (Etapa 1 em DEV, compila e provado visualmente). Pendência: validar o clique e a reatividade entre aparelhos; Etapas 2 (tela vídeo+mapa) e 3 (rever) seguem.

---

# TASK_INIT — RETOMAR COMMAND BOX · levantar gravação na nuvem + plano curto — 25/06/2026

- **Pedido original de Flávio**: "siga o command box" (gatilho RETOMAR COMMAND BOX).
- **Objetivo (1 frase)**: levantar o que JÁ existe de gravação do dado e de envio pra nuvem (sem inventar) e trazer um plano curto do que falta pra "a nuvem guardar o dado pra replay/análise", separando o que é da minha mão do que depende do Flávio/da pista.
- **Critérios objetivos de conclusão**: levantamento feito a partir de código real (não só memória) + plano curto entregue em linguagem de gestor, aguardando aprovação. NÃO construir nada nesta etapa.
- **Confirmação de leitura**: RETOMAR-COMMAND-BOX-NA-NUVEM.md (sim, inteiro), 4 memórias de gravação/envio (sim), ~/.claude/CLAUDE.md (sim), CLAUDE.md do projeto (sim).
- **Ambiente alvo**: desenvolvimento. **Produção protegida**: sim. **Autorização para produção**: não. **Evidência**: não recebida.
- **Levantamento (verificado no código real)**:
  - Caminho AO VIVO do Command Box (`LivePublisher.cs` → canal `cockpit-bubi-live`) = broadcast puro. NÃO grava na nuvem (grep de insert/telemetry = vazio). Tem fila de reenvio pra oscilação de internet, mas a nuvem não retém nada.
  - Prateleira de gravar telemetria JÁ EXISTE e roda em produção: função `supabase/functions/ingest` → `insert` em `public.telemetry_samples` (lote). Hoje abastecida SÓ pelo iPhone (`TelemetryUploader.swift`). Nenhuma peça do Command Box chama `ingest`.
  - Replay já existe do lado local (`tools/nuvem-replay-gps.mjs`, `?replay=23-05`); falta a fonte vir da nuvem.
- **Riscos**: gravar na nuvem de PRODUÇÃO toca produção (protegida) → construir/provar em ambiente de teste primeiro; só ir pra produção com "MIGRAR PARA PRODUÇÃO". Não publicar dev/replay no canal `cockpit-bubi-live`.
- **Status**: APROVADO pelo Flávio ("sim") → construí e provei a gravação na nuvem em ambiente de teste.

```
TASK_DONE:
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (rede real Supabase Realtime em CANAL DE TESTE; banco de produção INTOCADO)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (ingest, telemetry_samples, LivePublisher, tools nuvem-*, cloud-bridge)
- Alterações feitas: sim (3 arquivos novos + 1 linha no package.json)
- Testes/validação executados: sim
- Resultado: concluído (esta etapa — gravação na nuvem provada em teste). Falta: ligar destino de produção (precisa "MIGRAR PARA PRODUÇÃO") + carro na pista.
- Pendências reais: produção (telemetry_samples via ingest) só liga com autorização; prova com carro real só no dia de pista.
```

Arquivos criados/alterados:
- `tools/nuvem-gravador.mjs` (NOVO) — gravador da nuvem: escuta o ao vivo e guarda append-only sem perda; prateleira trocável (Arquivo/Memória = teste; Ingest = produção, TRAVADA por padrão); trava de canal de produção igual aos outros tools.
- `tools/prova-cadeia-gravacao-nuvem.mjs` (NOVO) — prova ponta a ponta pela rede real, canal de teste `cb-prova-gravacao`. VERDE: 60 publicados → 60 guardados sem perda → releitura recuperou a volta inteira (arco 0.004..0.997).
- `tests/node-smoke-nuvem-gravador.mjs` (NOVO) — 8/8 verde; entra na catraca (`npm run smoke` + `smoke:nuvem-gravador`). Cobre sem-perda, alarme-recupera, e a trava dura contra produção.
- `package.json` — gravador anexado à bateria `smoke` + atalho `smoke:nuvem-gravador`.

Validação executada (resultados reais):
- `node tests/node-smoke-nuvem-gravador.mjs` → 8 ok / 0 fail.
- `node tools/prova-cadeia-gravacao-nuvem.mjs` → VERDE (60/60, contígua, volta inteira).
- `node tests/node-smoke-arquitetura-dado.mjs` → 31 ok / 1 fail (o 1 = iPhone pré-existente, sem relação).

D1 — FEITO 25/06 (autorização literal "publique"): TV publicada SEM SENHA em https://command-box-tv.vercel.app (demonstração `?replay=23-05`). Projeto Vercel próprio `command-box-tv`, separado do p1t4000 (intocado). Pacote enxuto por `tools/montar-tv-publi.mjs` (crawler de dependências; 34 arquivos/728K; não expõe o resto do código; remove ferramenta de autor). Provado: 34/34 servíveis local + público 200 sem login/SSO. Decisão de retenção registrada (guardar tudo pra sempre; exclusão manual por volta/stint/evento; cascata de exclusão precisa ajuste pra ligar produção).

O que falta (próximo): ligar o destino de produção `ingest`/`telemetry_samples` (precisa "MIGRAR PARA PRODUÇÃO" + ajuste de exclusão em cascata) + C1 (carro na pista publicando ao vivo = dia de pista).

---

# TASK_INIT — RETOMAR CHECKLIST DO STINT · execução do STINT no app real — 25/06/2026

- **Pedido original de Flávio**: "RETOMAR CHECKLIST DO STINT" (ele já tinha dito "segue"). Continuar a amarração final: ligar a **execução do checklist do STINT** no app REAL, ancorada ao **stint real** (`sessao.id` / `Stint.id` — decisão fechada, card 20260624-021010), gravando de verdade em `stint_check`.
- **Objetivo (1 frase)**: checklist do STINT executável dentro do app real, preso a um stint real, gravando marcações no banco, com distribuição por papel da equipe real.
- **Critérios objetivos de conclusão**:
  - `StintCheckStore` com a fila (queue) REAL + âncora = `Stint.id` real (não "stint-demo").
  - Ponto de entrada REAL (não atalho `--p1-*`) pra abrir o checklist do stint.
  - Marcações persistem em `stint_check` entre aberturas (provado).
  - Distribuição por papel com a equipe REAL da Garagem; pessoa atual define feitoPor/papel.
  - BUILD SUCCEEDED + smoke verde (575 ok / 1 fail = PERSIST-03 pré-existente).
  - Giro (cockpit/pista) e tela inicial INTACTOS.
  - Nada na versão oficial (`main`) sem ordem do Flávio.
- **Confirmação de leitura**: `~/.claude/CLAUDE.md` (sim), `~/.claude-decisoes/padroes.md` (ler antes de fechar), `FLAVIO_*` (existem — confirmar), RETOMAR-CHECKLIST-STINT.md (sim, autossuficiente), CLAUDE.md do projeto + docs/CONTRATO_DADOS.md (sim/parcial), memória dos 2 caminhos (sim).
- **Plano (≤5 passos)**:
  1. Cópia isolada da `main` (worktree `exec-checklist-stint`).
  2. Expor `StintCheckStore` + `ExecucaoStintView` pro app real; criar a partir da fila real e do `Stint.id` real.
  3. Ponto de entrada real no fluxo do stint (EventoDetalheView) + seletor temporário "quem é você" (equipe real → papel).
  4. BUILD + smoke + screenshot (marcar item → reabrir → persistiu).
  5. Mostrar pro Flávio; incorporar na `main` só com ordem.
- **Arquivos/áreas**: HubMockLauncher.swift, EventoDetalheView.swift, PendenciasView.swift (padrão do DIA), StintRepository.swift (modelo Stint/sessoes), ChecklistStint.swift, StintCheck.swift, Equipe.swift.
- **Ambiente alvo**: desenvolvimento.
- **Produção protegida**: sim.
- **Autorização para produção**: não.
- **Evidência da autorização para produção**: não recebida.
- **Riscos**: projeto iOS usa lista explícita de arquivos (pbxproj) — `.swift` novo solto NÃO compila (manter tipos em arquivo já-membro). Não tocar giro/tela inicial. Auto-save commita no meio de incorporação (conferir marcadores). Placement do ponto de entrada é decisão de UX do Flávio (registro marca "Provável") — construir o mais fiel ao padrão do DIA e mostrar; ajustar se ele pedir.
- **Status inicial**: iniciado.

## TASK_DONE — concluído em DEV (25/06)
```
TASK_DONE:
- Pedido original conferido: sim (ligar a execução do checklist do STINT no app real)
- Ambiente trabalhado: desenvolvimento (worktree exec-checklist-stint, base main)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim (BUILD SUCCEEDED + smoke núcleo 575/1 + 6 screenshots, incl. prova na versão oficial)
- Resultado: concluído e INCORPORADO na versão oficial (Flávio: "pode incorporar") — cirúrgico só os 2 arquivos, conflito zero, build+smoke verdes na main. Worktree exec-checklist-stint preservada como rollback. Nada em produção.
- Pendências reais: pendência grande + Command Box + vibra + sinal carro (passo 2); login PIN na entrada (passo 3)
```
### Arquivos alterados (worktree exec-checklist-stint)
- ios/p1fast-ios/Sources/Views/EventoDetalheView.swift — `@Environment(\.databaseQueue)`; novo destino `.checklistStint(stintId:label:)`; botão "Checklist do stint" por stint REAL.
- ios/p1fast-ios/Sources/Views/HubMockLauncher.swift — `ExecucaoStintView` ganhou seletor pré/pós + `semearDemo`/`membroId`/`stintLabel`; novo `ExecucaoStintRealView` ("Quem é você?" → itens da pessoa, grava em stint_check); atalhos só-dev de prova (`--p1-checklist-stint-real`, `--p1-execucao-stint-real`, `--p1-auto-pessoa`) + fila guardada + semente da equipe no init.
### O que foi preservado
- Núcleo (ChecklistStint/StintCheck/Equipe) intocado; giro (cockpit/pista) e tela inicial intactos; main intocada.
### Validação executada
- `xcodebuild ... iPhone 17` = BUILD SUCCEEDED. `swift run p1fast-smoke` = 575 ok / 1 fail (PERSIST-03 pré-existente). Screenshots em /tmp/prova-checklist-stint/.
### Checagem contra o pedido original
- StintCheckStore com fila real + âncora Stint.id real: sim. Entrada real (não atalho): sim (botão na tela do evento). Persiste entre aberturas: sim (provado: marcar→trocar→voltar mantém). Distribuição por papel da equipe real: sim. Build+smoke: sim. Giro/tela inicial intactos: sim. Main intocada: sim.
### Pendências ou riscos
- Falta passo 2 (pendência grande/Command Box/vibra/sinal carro) e passo 3 (login PIN). Incorporação na main só sob ordem do Flávio.

---

# TASK_INIT — RETOMAR COMMAND BOX (parte A: tela exibe o painel da nuvem) — 24/06/2026 (pós-clear)

- **Pedido original de Flávio**: "RETOMAR COMMAND BOX" → continuar a execução do ponto salvo em
  `.claude-exec/RETOMAR-COMMAND-BOX-NA-NUVEM.md` (TV do box ligada na nuvem).
- **Objetivo (1 frase)**: fazer a tela aprovada do Command Box EXIBIR o pacote pronto da nuvem
  (posição já provada; agora o 'painel' do cérebro), com blocos honestos, sem mexer no layout aprovado.
- **Critérios objetivos de conclusão da parte A**:
  - A1: a bolinha anda pela POSIÇÃO da nuvem na tela (canal de teste), provado.
  - A2: a tela consome o 'painel' da nuvem (ponte ganha `onPainel`; cérebro do navegador deixa de ser a
    fonte primária — vira fallback). Provado por dados (cérebro→canal→tela) e aberto no navegador real.
  - A3: combustível = CONTA viva da nuvem no gauge (decisão Flávio 24/06); blocos sem sensor seguem inativos honestos.
- **Confirmação de leitura**: `~/.claude/CLAUDE.md` (sim), `~/.claude-decisoes/padroes.md` (existe; sim),
  `FLAVIO_EXECUTION_PROTOCOL.md` (sim), `FLAVIO_DONE_CHECKLIST.md` (sim), `FLAVIO_ENVIRONMENT_RULES.md` (sim),
  `FLAVIO_COMMUNICATION_RULES.md` (sim) + `RETOMAR-COMMAND-BOX-NA-NUVEM.md` + memória dos 2 caminhos.
- **Plano (≤5 passos)**:
  1. `web/cockpit/cloud-bridge.js`: adicionar `onPainel` + listener do evento 'painel' (espelho do `onPosicao`, aditivo).
  2. Mockup aprovado: novo script assina `onPainel` → aplica painel da nuvem (stint/ritmo/meta + combustível); marca frescor.
  3. Mockup: cérebro-vivo do navegador só aplica quando a nuvem NÃO está fresca (fallback); combustível do gauge pela conta da nuvem.
  4. Provar por dados: `tools/prova-cadeia-painel-command-box.mjs` (cérebro→canal→tela) + trava de arquitetura segue 31/1.
  5. Subir replay+posição+cérebro no canal de teste e abrir a tela no navegador real (A1/A2 visual).
- **Arquivos/áreas a inspecionar**: `web/cockpit/cloud-bridge.js`, `_design-reference/mockup-command-box-vista-piloto.html`,
  `tools/nuvem-cerebro.mjs`, `tools/nuvem-posicao.mjs`, `tools/nuvem-replay-gps.mjs`, `tools/prova-cadeia-command-box.mjs`.
- **Ambiente alvo**: desenvolvimento.
- **Produção protegida**: sim.
- **Autorização para produção**: não.
- **Evidência da autorização para produção**: não recebida.
- **Riscos**: mexer no mockup aprovado (regra dura: só FONTE do número, nunca layout); publicar em canal de produção
  (proibido — só canal de teste 'cb-dev'); quebrar o fallback de demonstração. Mitigação: edição cirúrgica + provas.
- **Status inicial**: iniciado.

## TASK_DONE — parte A concluída (24/06, pós-clear)
```
TASK_DONE:
- Pedido original conferido: sim (RETOMAR COMMAND BOX → parte A do ponto salvo)
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: não se aplica
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim
- Resultado: concluído (parte A: A1+A2+A3). B1 DECIDIDO 25/06. Falta C1 (carro na pista) + D1 (publicar TV) + gravar na nuvem.
- Pendências reais: C1 carro publicando ao vivo; D1 publicar a TV sem senha; NOVO = gravar o dado na nuvem pra replay/análise
- B1 (decisão Flávio 25/06, card cb-calculo-sempre-ligado): AO VIVO o NOTEBOOK faz a conta e manda pronto (exceção à "nuvem processa");
  a NUVEM passa a GUARDAR o dado pra análise posterior (replay/revisão/outras voltas). Registro em ~/.claude-decisoes/respostas/p1-fast/.
```
Feito e provado nesta sessão:
- `web/cockpit/cloud-bridge.js`: +`onPainel` + listener do evento 'painel' (aditivo, espelho do `onPosicao`).
- `_design-reference/mockup-command-box-vista-piloto.html`: tela EXIBE o 'painel' da nuvem (novo bloco assina `onPainel`);
  cérebro do navegador virou fallback (guarda `__painelNuvemTs`); combustível do gauge pela CONTA da nuvem + bloco
  acende "ao vivo" quando a conta chega. Layout aprovado intocado (só fonte do número).
- `tools/prova-cadeia-painel-command-box.mjs` (novo): prova de rede do painel → VERDE (volta 8, ritmo 1:31.89, combust 33.44L).
- Prova viva no canal de teste `cb-dev` (replay-gps + nuvem-posicao + nuvem-cerebro): a tela recebe POSIÇÃO (245 distintas)
  + PAINEL (volta 9/12, 64 pacotes) no mesmo canal; aberta no navegador `http://localhost:8078/?canal=cb-dev`.
- Limitação honesta: no replay acelerado 8× o RITMO (delta por volta) sai distorcido (relógio do replay corre 8× mais
  rápido → tempo de volta comprimido). Voltas, posição e combustível ficam corretos. Na pista (tempo real) o ritmo é correto.

---

# FECHAMENTO 24/06 (pré-clear) — Flávio vai dar clear e pediu pra finalizar

PONTO DE RETOMADA COMPLETO: `.claude-exec/RETOMAR-COMMAND-BOX-NA-NUVEM.md` (gatilho "RETOMAR COMMAND BOX").
Memória do projeto atualizada (índice + `p1-fast-command-box-na-nuvem-2026-06-24.md`).

Provado a mais nesta rodada (além do cérebro+combustível):
- **Caminho da nuvem PONTA A PONTA na infra real de canais** (canal de teste, sem produção):
  `node tools/prova-cadeia-command-box.mjs` → VERDE. gps(volta gravada)→nuvem(calcularPosicao)→posicao→tela:
  60 pontos, 56 posições distintas (frac 0.004..0.997), todas na pista. Rede da nuvem funciona daqui.
- `web/cockpit/cloud-bridge.js` aceita `?canal=` (override SÓ dev/teste; padrão produção intocado). Trava 31/1 (o 1 = iPhone, pré-existente).

Falta finalizar: A) na minha mão (provar na tela + tela exibir 'painel' da nuvem + blocos honestos);
B) DECISÃO do Flávio (onde o cálculo fica sempre-ligado — custo/arquitetura); C) FÍSICO (carro na pista); D) publicar a TV sem senha.

---

# Última tarefa — HOSPEDAR O CÉREBRO (serviço na nuvem) + auditoria das 4 peças — 24/06/2026

Pedido Flávio: "a tv não terá senha. só logar no endereço web. pode hospedar o cérebro. faça tudo."
Autorização literal registrada: TV sem senha + "pode hospedar o cérebro" + "faça tudo".

## Investigação (4 agentes, leitura real) — achados que mudam o plano
- O cérebro (`web/command-box/cerebro/*`) é código PURO, pronto pra virar serviço; estava órfão (só testes usavam).
- A conta da POSIÇÃO da bolinha JÁ TEM CASA e serviço: `tools/nuvem-posicao.mjs` (`calcularPosicao` → frac via
  `web/command-box/pista-cb-polyline.js fracDe` + `geoParaCommandBox`). NÃO criar conta nova. Replay de ensaio: `tools/nuvem-replay-gps.mjs`.
- A tela `web/command-box/replay-hoje.html` é só o mapa+bolinha de ENSAIO. A tela de verdade da TV ainda NÃO existe
  como design aprovado (memória: Command Box = "visão da equipe", tela mais simples, separada do painel do piloto).
- Canal `cockpit-bubi-live` = PRODUÇÃO (trava `PERMITIR_PROD_CANAL`). Brain só ESCUTA; publica saída em canal NOVO.

## FEITO E PROVADO nesta sessão (dev, nada em produção)
- **Serviço do cérebro hospedável**: `tools/nuvem-cerebro.mjs` — espelha o padrão seguro do `nuvem-posicao.mjs`:
  conta PURA exportada (`criarProcessadorCerebro`) + laço de rede que só liga com CANAL definido + trava dura
  (recusa entrada=produção sem PERMITIR_PROD_CANAL; recusa SAÍDA=produção sempre). Escuta 'sample'/'gps'/'evento',
  alimenta `criarOrquestradorVivo`, publica 'painel' (PainelPronto) num canal de SAÍDA separado ("<CANAL>-pronto").
- **Teste**: `tools/nuvem-cerebro.smoke.mjs` — alimenta o serviço com a volta REAL gravada (formato do canal) e
  confere o PainelPronto. VERDE (5/5): stint/ritmo/meta corretos (volta 8/12, melhor stint 1:31.89 = volta real).
- **Trava de arquitetura**: 31 ok / 1 fail. O 1 fail é `ios/.../pista-oficial-brasilia.js` (cópia do iPhone, alterada
  às 12:14 hoje no trabalho do iPhone — PRÉ-EXISTENTE, não é meu; meus arquivos não têm conta de GPS). Cérebro
  original intocado (smoke segue verde). Restaurei o arquivo do iPhone após uma comparação (sem regressão; idêntico ao oficial).
- `@supabase/supabase-js` instalado → o serviço PODE rodar de verdade num canal de teste quando for ligar a cadeia.

## DIRETRIZES DE BLOCO (Flávio 24/06) — absorvidas
- **COMBUSTÍVEL = CONTA, sempre**: quanto havia no tanque − consumo × voltas. NÃO depende de sensor (sai do balde
  "travado por sensor"). Casa única JÁ EXISTE: `src/domain/fuel-calc.js` (`calcularCombustivel(env, voltas)` →
  restanteL, voltasRestantes, pctTanque; devolve "parcial" honesto sem consumo). Modelo confirmado no fixture
  (tankMaxL 40, consumo ref 0.82 L/volta, crítico 15%) e idêntico ao que a Vista Piloto já exibe.
  FEITO: liguei o combustível na SAÍDA do cérebro hospedado (`nuvem-cerebro.mjs` usa a casa + as voltas que o
  cérebro já conta). Provado no smoke: 40 − 0.82×8 = 33.44L, 84%, ~40 voltas. NÃO criei conta nova.
  Entrada que falta na operação: a "quantidade no tanque no início" (combustivelInicialL) — hoje padrão = cheio (40L);
  na operação vem do planejamento do stint. Consumo real por volta (medido) substitui o 0.82 quando confiável.
- **BLOCOS SEM SENSOR = INATIVOS (não falsos), ativar aos poucos**: as grandezas que ainda não temos sensor no carro
  (temp pneu, temp/pressão câmbio, pressão pneu — os marcados `source:"cadastro"` no fixture `limits.channels`) ficam
  INATIVAS na tela, e a gente ativa progressivamente conforme instala. Os que temos (motor/T4000: temp motor, pressão
  óleo, rpm, bateria + combustível-conta + posição) ficam ativos. Regra ao ligar a tela: gate por origem do dado.

## CORREÇÃO (Flávio 24/06): a tela do Command Box JÁ EXISTE, aprovada e versionada — NÃO inventar
Telas em `_design-reference/`: principal = `mockup-command-box-vista-piloto.html` (8260 linhas, a que ele abre),
+ `mockup-command-box-vista-engenheiro.html`, vistas de engenharia (lambda/saúde-carro/motor/pace), `selecao-command-box.html`,
e versões em `_design-reference/command-box-versoes/` + `_backups/` + snapshots `APROVADO-*`. Eu tinha olhado só `web/command-box/`.
Estado real da Vista Piloto (lido no código):
- JÁ assina a PONTE da nuvem `cloud-bridge.js` (linha ~7899-7913): `cb.onSample`, `cb.onPosicao` (bolinha) e `cb.startCloudBridge()`.
- Bloco PLANO·STINT já fala com o cérebro (cerebro-painel, linha ~8005-8067) MAS alimentado por FIXTURE e rodando NO NAVEGADOR.
- Mantém DEMONSTRAÇÃO (preview-local ~7886, FAKE_LAPS ~4716) como fallback quando aberto sem servidor.

## PENDENTE (próximos passos) — buraco mais estreito do que as 4 peças sugeriam
1. Plugar a SAÍDA do cérebro hospedado ('painel') na tela: criar `onPainel` na ponte `cloud-bridge.js` (espelho do `onPosicao`),
   e a Vista Piloto passa a EXIBIR o painel pronto (window.__aplicarPainelStint já existe) em vez de rodar a conta no navegador.
   Preservar o layout aprovado (só troca de FONTE do número) e manter o fallback de demonstração.
2. Bolinha: já tem `onPosicao` ligado — provar com a cadeia replay→nuvem-posicao→tela (canal de teste).
3. Blocos honestos: ligar os que têm fonte; "sem dado" nos sem fonte; combustível/temp pneu/câmbio = sensor no carro (físico).
4. Hospedar o serviço sempre-ligado (onde rodar na operação) + publicar a tela num endereço sem senha.
5. "Acende de verdade" só com o notebook publicando ao vivo na pista (dia de pista, em andamento) — não dá pra forçar.

## Ambiente: desenvolvimento. Produção/main/canal cockpit-bubi-live NÃO tocados. Nada publicado.

---

# Última tarefa — MAPA "TV do box: o que falta" (4 peças) — 24/06/2026

Pedido: "vá em frente" sobre a oferta de transformar a análise das 4 peças que faltam pra TV do box
(Command Box / Fire TV) num MAPA VISUAL priorizado. Recomendação minha era o mapa; memória reforça
entregar visual e confirmar o conceito ANTES de propor execução.

Feito (dev, nada em produção, nada publicado):
- Verifiquei no código real: cérebro = `web/command-box/cerebro/` (11 arquivos), nenhuma tela de verdade
  importa (só testes) = órfão. Protótipo da TV = `web/command-box/replay-hoje.html`. Posição/bolinha existe
  em `web/cockpit/cloud-bridge.js` (evento posicao) mas a tela não consome ao vivo. Canal de produção = cockpit-bubi-live.
- Criei o mapa: `_design-reference/mapa-tv-box-o-que-falta.html` (largura total, sem emoji, linguagem de gestor,
  sem jargão). 3 colunas: DECISÃO SUA (hospedar o cérebro na nuvem = maior peça; + login? recomendo sem) ·
  SÓ LIGAR (publicar a tela + tirar andaime; bolinha andar; ligar blocos com fonte / "sem dado") ·
  DEPENDE DE SENSOR/PISTA (combustível, temp pneu/câmbio; frenagem/curva mín/passagem c/ volta de referência;
  notebook publicando ao vivo = dia de pista). Banda final "o que amarra tudo". Abri no navegador.
- Próximo: confirmar com o Flávio o entendimento do conceito e ele dizer por onde começar (recomendação:
  a decisão de hospedar o cérebro na nuvem é o que destrava o resto). NÃO executei nada além do mapa.

---

# Última tarefa — DIA DE PISTA: despachar 17 luzes pro WinUI + PARAR central de cálculos — 24/06/2026

## Decisões do Flávio nesta sessão (retomada via /voltei)
- Central de cálculos: **PARADA** por decisão dele (auditei e mostrei que o pior — distância em 16
  lugares — já está resolvido e a trava está verde 31/0, não piora sozinho). Estado preservado em
  `CONTINUAR-central-calculos.md`. Foco vai pro dia de pista.
- Dia de pista: ele aprovou portar a luz de marcha do WinUI de **12 → 17 luzes** (versão aprovada 22/06)
  ANTES de empacotar.

## O que fiz (Mac)
- Auditei os dois lados (WinUI 12 luzes acende do centro p/ fora, tiers 1–6; aprovado 17 luzes pirâmide
  1→9→1). Confirmei as peças exatas a mexer (MainWindow.xaml Led01..12; .xaml.cs LedTierByPosition/_leds/
  ColorForTier/guarda !=12; CockpitState.ShiftDotsForLevel). Evidência por leitura real do código.
- Como WinUI só compila/prova no Windows, montei a INSTRUÇÃO pra sessão do notebook:
  `.claude-exec/BRIEFING-NOTEBOOK-17-LUZES.md` (objetivo, fonte canônica do visual, peças exatas+linhas,
  o que preservar, regras duras, e como provar). Fiel ao painel aprovado.

## Ambiente: desenvolvimento. Produção/main NÃO tocadas. Nada publicado.

## Próximo passo
- Flávio cola o briefing na sessão do notebook (Windows). Ela porta as 17, roda os testes (hoje 262/262),
  prova a olho contra o aprovado e relata. Pendência de decisão visual (direção de acender) já está
  instruída a SEGUIR o aprovado, não escolher sozinha.

---

# Última tarefa — Pista no FUNDO + bolinha do piloto (tela do iPhone) — 24/06/2026

## Pedido: no fundo da tela do iPhone aparecer a PISTA + a bolinha mostrando onde o piloto está.
- Ambiente: desenvolvimento (cockpit-app.html, só iPhone). Produção/notebook intocados.
- REGRA DURA respeitada: NÃO redesenhei a pista — reusei o traçado OFICIAL de Brasília (path id=track do
  mockup vista-piloto), gerado em `Resources/Cockpit/track-brasilia.js` (TRACK_PATH_D/VIEWBOX/TRANSFORM).
  Orientação canônica -106° mantida; só ajustei escala/posição (scale 0.66, sem o translate do quadro antigo)
  pra centralizar e caber neste quadro 2,17:1. Memória mapa-oficial-brasilia diz que escala/pos é ajustável.
- Como ficou: SVG `.track-bg` (quadrado central, faint) como 1ª camada dentro do #device (atrás das peças);
  `#pilotDot` (bolinha azul) anda no traçado via getPointAtLength(frac*len). `window.setPilotFrac(frac)` move
  e revela; sem frac = some (sem carro não inventa lugar). DEMO só no navegador `?demo=1` (nunca no app).
- Provado no navegador (Chrome 812×375 ?demo=1): pista oficial reconhecível no fundo + bolinha rodando.
- Build + instalado no iPhone 16 (no aparelho: pista no fundo; bolinha só com carro real).
- PRÓXIMO (depois do OK do visual): ligar a bolinha à posição REAL do carro = mapear GPS ao vivo → frac do
  traçado oficial (alinhar início/sentido). Hoje só a DEMO move; live ainda não chama setPilotFrac.
- Pendência: OK do Flávio sobre o visual (tamanho/posição/intensidade da pista).

## Ajuste de layout (pedido Flávio 24/06, SÓ no iPhone):
- Pista → DIREITA (right:6px, mesmo tamanho/scale 0.66). Delta+frenagem+mensagens → coluna ESQUERDA (left ~250px
  no canvas 956): delta top 35%, mensagens top 50%, frenagem top 64% (subi pra não bater no FREIO). Fontes 50%:
  info__delta/brake-result__num 180→90; info__acao/brake-result__word/ultima-volta 32→16; alert__msg 34→17;
  critico-overlay__msg 89→44 (alinhada à esquerda). TUDO via !important no bloco de estilo do cockpit-app.html
  (notebook/cockpit-volta-real.html intocado). Provado no navegador (estado normal); estados de mensagem/crítico
  posicionados à esquerda por CSS mas ainda NÃO vistos disparados — conferir quando aparecer um ao vivo.
- Build + instalado no iPhone 16. Aguardando OK visual do Flávio.

## VERIFICAÇÃO "todos os canônicos + mapa funcionam?" (Flávio 24/06) — SIM, após achar+consertar 1 bug:
- BUG REAL achado pela verificação: `aplicarMotor` escrevia em hRpm/hTps/hAgua/hLam, que NÃO existem nesta tela
  (campos de depuração removidos) → `$(id).textContent` em null → THROW. Quebraria a luz de marcha/água/lambda
  ASSIM QUE O CARRO REAL mandasse dado de motor. Conserto: helper `setTxt(id,v)` que só escreve se o elemento existe.
- Verificação: adicionei REPLAY da sessão real gravada (pista + motor) no script principal alimentando
  aplicarGps/aplicarMotor/aplicarMotorStatus + setPilotPos (DEMO_REPLAY=true, TEMPORÁRIO). Capturei no navegador:
  sensores MOTOR verdes, GPS verde, delta "REGISTRANDO", frenagem "REFERÊNCIA", ápice ENTRADA/SAÍDA 101km/h, bolinha
  na pista, mapa fixo. CHASSI vermelho = sensores não instalados (correto). TUDO funcionando.
- ⚠️ DEMO_REPLAY=true faz a sessão gravada rodar no aparelho (Flávio vê tudo junto). TROCAR pra false = FINAL (só ao vivo).

## BUG "mapa balança quando a bolinha passa" — CORRIGIDO (Flávio 24/06):
- Causa: `.track-transformed` usava `transform-box: fill-box; transform-origin: 50% 50%` — a fill-box INCLUI a
  bolinha (filha do grupo); quando a bolinha andava, a caixa mudava e a origem da rotação se mexia → o mapa balançava.
- Conserto: origem FIXA no CENTRO do traçado (calc bbox = 426.1, 430.3 do viewBox) com `transform-box: view-box`.
  Independe da bolinha. Conferido com 2 capturas (bolinha em posições diferentes) = traçado no MESMO lugar.
- Efeito colateral: a origem nova reposicionou o mapa → re-tunei translate. Atual: translate(-10px, 8px) (alto,
  puxado do canto direito pra não cortar). Origem fixa fica; só translate(x,y) muda no ajuste fino.

## Bolinha ligada à POSIÇÃO REAL (Flávio "sim" 24/06):
- REUSEI o que já existia (não reinventei): `web/cockpit/pista-oficial-brasilia.js` (geoParaDesenho: GPS→desenho
  oficial 17/05, validado erro ~5,7px) + `suavizador-bolinha.js` (desliza a bolinha em fração entre leituras).
  Copiados pro bundle Resources/Cockpit (entram no .app — folder reference, conferido).
- Faltava 1 peça: alinhar o desenho-oficial (823×799) com o MEU traçado da tela (SVG vista-piloto). Calculei
  com `_calc-alinhamento.mjs` (Procrustes similar c/ reflexão + busca de offset/sentido): MAP_M/CD/CS, RMS ~14px.
- Cadeia no cockpit-app.html: ngps(p) → window.setPilotPos(lat,lng) → geoParaDesenho → desenhoParaSvg(MAP) →
  fracMaisProxima (amostra o path) → suavizador → tick(rAF) → setPilotFrac → getPointAtLength. Sem leitura >2,5s = some.
- VERIFICADO no navegador `?demo=1&trace=1`: o rastro de TODOS os pontos da volta real cai EM CIMA da pista (alinhamento ok).
  Pulo de GPS na gravação aparece como linha solta no trace, mas a bolinha real usa fracMaisProxima (gruda na pista).
- ⚠️ TEMPORÁRIO: `DEMO_NO_APARELHO = true` no cockpit-app.html faz a volta gravada rodar NO APARELHO pro Flávio ver.
  TROCAR PRA false = versão FINAL (bolinha só com carro AO VIVO, sem replay na tela). Fazer após o OK dele.
- `_calc-alinhamento.mjs` fica como ferramenta (documenta o cálculo); não é carregado pelo app.

## Ajuste 2 (foto do aparelho, Flávio 24/06): centralizar a pista na VERTICAL + organizar espaços.
- Pista subia/cortava no topo: a `.track-transformed` ganhou `translateY(28px)` ANTES do rotate(-106)/scale(0.66)
  pra descer ao centro vertical (iterado no navegador: 0=cortava topo, 100=baixo demais, 28≈centro). 
- Esquerda reorganizada: delta top 38%, frenagem top 63% (par mais centrado/balanceado), mensagem 50%.
- Provado no navegador (812×375). Build + instalado. Aguardando OK do Flávio.

---

# Última tarefa — Tela do iPhone (formato próprio) preenchendo a tela — 24/06/2026

## TASK_INIT
- Protocolo carregado: sim · Padrões carregados: sim
- Ambiente alvo: desenvolvimento (app iOS no iPhone 16 do Flávio) · Produção protegida: sim · Autorização produção: não (n/a)
- Pedido entendido: criar uma tela EXCLUSIVA do iPhone, mesmas funções do painel, só o FORMATO diferente — preenchendo a tela, sem as faixas pretas.
- Critério de conclusão: o painel do app preenche a tela do iPhone deitado com TODAS as funções; tela aprovada do notebook intocada; OK visual do Flávio.

### Como foi feito (SÓ layout — lógica/dados/peças intactos)
- A tela fixa do painel (#device 956×440) já tem a MESMA proporção do iPhone (~2,17:1). O preenchimento travava porque o flexbox encolhia o #device ANTES do ajuste (sobrava preto, "521 de largura").
- cockpit-app.html: reescrito SÓ o bloco de layout (.stage cobre a tela inteira `inset:0` + recuo pela zona segura `env()`; `#device { flex:0 0 auto }` pra não encolher). fit() inalterado.
- Provado no navegador (Chrome headless 812×375): painel preenche edge-to-edge, todas as peças presentes (cluster sensores, luz de marcha, delta, FREADA, ENTRADA/FREIO/ÁPICE/SAÍDA, luzes de freio, status de conexão).
- Build assinado OK + instalado no iPhone 16.

### Pendências
- OK visual do Flávio no aparelho. No iPhone sobra ~53px preto de cada lado = zona da ILHA/câmera (legítimo); dá pra recuperar o lado SEM ilha se ele quiser mais largura (depende de saber landscapeLeft/Right — fazer só se pedir).
- A partir de agora iPhone (cockpit-app.html) e notebook (web/cockpit/cockpit-volta-real.html) são DUAS telas — melhoria de função entra nas DUAS.

### Status: CONCLUÍDO — Flávio aprovou no aparelho ("excelente", 24/06 ~02:05).

## TASK_DONE
- Pedido original conferido: sim · Ambiente: desenvolvimento · Produção alterada: não
- Arquivos inspecionados: sim · Alterações: sim (cockpit-app.html, só layout) · Validação: navegador 812×375 + build + instalado + OK do Flávio
- Resultado: concluído. Pendência aberta (só se ele pedir): recuperar o lado sem ilha. Servidor de visualização (8079) encerrado.

---

# Última tarefa — Alinhamento da lição do cérebro ETAPA (a): conta do delta na casa neutra — 24/06/2026

## Pedido original de Flávio
"sim. pode seguir com o alinhamento." (após estudo profundo + junta de 5 checadores aprovarem).

## Contexto (regras travadas pela junta + ADRs)
- 6 canônicos por trecho (CONCEITOS_TRECHO_PRODUTO.md): entrada, frenagem, vmin, ápice, pace, saída.
- Delta (tempo perdido) SÓ nas curvas; reta = rótulo; reta mais longa = tempo de volta.
- Comparação SEMPRE vs melhor passagem histórica. NUNCA inventar nota/progresso.
- ADR-005 (unidade = trecho), ADR-008 (IA só pedagogia, crítico é determinístico),
  ADR-023 amd6 (processa em 2 lugares: notebook + nuvem), ADR-015 (delta em relógio à prova de salto).
- Condição DURA da junta: a conta do delta tem de morar na CASA NEUTRA (src/domain) pra os 2
  processadores consumirem a mesma — o cérebro NÃO pode depender da pasta da tela.

## O que foi feito (etapa a)
- Movido `web/cockpit/delta-calculator.js` → `src/domain/delta-calculator.js` (casa neutra, conteúdo
  preservado; imports geo.js/velocidade.js resolvem nas casas neutras vizinhas).
- `web/cockpit/delta-calculator.js` virou REEXPORTAÇÃO (`export *`). Consumidores intactos.
- Trava estendida (regra 8): casa neutra do delta existe + exporta calcularDelta; cockpit só reexporta.
- Contrato atualizado: docs/CONTRATO_DADOS.md (nova linha "Delta por trecho").

## Validação
- Trava: 31 ok / 0 fail. Testes do delta (delta-calculator, bridge-delta, catalogo-treinos): verdes.
- Bateria teste-por-teste: 74 verde / 1 vermelho (schema-parity = dívida antiga do banco).

## Ambiente: desenvolvimento. Produção NÃO tocada. iPhone NÃO tocado. Canal ao vivo NÃO tocado.

## PRÓXIMAS ETAPAS do alinhamento (a fazer)
- (b) Cérebro da nuvem (cerebro-coach.js) passar a usar o DELTA por trecho (sai a régua antiga de
  km/h) + falar pelas mensagens canônicas (FREOU/VIROU/ACELEROU/PISOU), comparar vs melhor histórica,
  sem nota. PRECISA: levar o delta por trecho até o painel (o canal/cerebro-vivo hoje NÃO carrega).
- (c) Ligar o coach no painel consolidado (cerebro-painel.js, tirar o coach=null) — VALIDAR ANTES com Flávio.

## Status: etapa (a) concluída.

---

# Última tarefa — Cockpit ao girar: TELA PRETA na virada, painel entra centralizado depois — 24/06/2026

## TASK_INIT
- Protocolo carregado: sim
- Padrões carregados: sim
- Ambiente alvo: desenvolvimento (app iOS, build local no iPhone 16 Pro Max do Flávio; NÃO há produção de app aqui)
- Produção protegida: sim
- Autorização para produção: não (não se aplica — é app interno em desenvolvimento)
- Evidência de autorização para produção: não recebida
- Pedido entendido: ao girar o celular, em vez de tentar mostrar a tela já aparecendo (e nunca centralizar), o celular fica PRETO durante a virada; assentou na horizontal, o painel entra preenchendo o espaço, centralizado, como qualquer app.
- Critério de conclusão: na virada a tela fica preta; ao assentar, o cockpit aparece centralizado preenchendo a tela; sem o painel "saltando" torto durante a rotação. Verificação final = foto do Flávio no aparelho.

### Plano (≤5 passos)
1. CockpitPilotoView: cobrir com PRETO enquanto a tela está girando; só revelar quando o tamanho PARA de mudar (virada assentada).
2. No momento de revelar, recalcular o ajuste do painel (fit) contra a geometria JÁ estável (window.p1Refit).
3. cockpit-app.html: expor window.p1Refit = fit.
4. Build simulador (compila) + build assinado + instalar no iPhone 16 (conectado no cabo agora).
5. Flávio testa girando e manda foto; medir centralização se ainda houver desvio.

### Arquivos a inspecionar/alterar
- ios/p1fast-ios/Sources/Views/CockpitPilotoView.swift
- ios/p1fast-ios/Resources/Cockpit/cockpit-app.html
- (leitura) ContentView.swift, OrientationGate.swift, AppDelegate.swift

### Riscos
- Se o desvio de ~196px for CONSTANTE (independente do tempo de virada), o preto-e-revela esconde a virada feia mas pode não centralizar sozinho — nesse caso re-medir com a régua. Não prometer que zerou sem foto.
- Não reabrir a "rotação na mão" (descartada). A virada nativa já funciona.

### Status inicial: iniciado

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (app iOS no iPhone 16 do Flávio)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (CockpitPilotoView, OrientationGate, AppDelegate, ContentView, cockpit-app.html)
- Alterações feitas: sim (CockpitPilotoView.swift + cockpit-app.html)
- Testes/validação executados: build simulador (BUILD SUCCEEDED) + build assinado (BUILD SUCCEEDED) + instalado no iPhone 16 (App installed)
- Resultado: CONCLUÍDO (centralização) — causa raiz achada por medição (viewport width=956 vs tela visível 812 = 72px) e zerada (width=device-width); foto do Flávio confirmou DESVIO 0 px / painel 146-146 simétrico; régua removida; versão limpa reinstalada.
- Pendências reais: OK visual final do Flávio do conjunto. Aberto (não-bug, decisão dele): preto nas laterais (~146px) por proporção do painel aprovado — só mexer se ele pedir. Dev arg --p1-force-landscape segue presente (inerte).

### Arquivos alterados
- ios/p1fast-ios/Sources/Views/CockpitPilotoView.swift (preto na virada + revela ao assentar + p1Refit + WebHolder)
- ios/p1fast-ios/Resources/Cockpit/cockpit-app.html (expõe window.p1Refit)

### O que foi preservado
- OrientationGate/AppDelegate (virada nativa intocada). Backup do ultima-tarefa em .claude-exec/ultima-tarefa.backup-2026-06-24-giro-preto.md. Replay preservado (cockpit-app-replay.html).

---

# Última tarefa — Alerta de temperatura ligado (frente 2, item 3 / Onda 5) — 24/06/2026

## Pedido original de Flávio
"pode seguir" (continuar a frente 2). Item 2 (lições/atraso por trecho) é decisão dele,
então segui no item que faço sozinho: o alerta de temperatura.

## O que foi feito
- Liguei a Onda 5 (alerta preditivo de temperatura) no painel do cérebro
  (`web/command-box/cerebro/cerebro-painel.js`), que antes saía sempre nulo ("pendente").
- A conta já existia (`cerebro-preditivo.js`); só faltava plugar. Agora o painel acumula o
  pico de temperatura (`waterTempC`) por volta e projeta em quantas voltas estoura o limite.
- Limite crítico default = 80°C (Bubi, decisão Flávio 27/05; a nuvem passa o do carro real).
- Honesto: sem dado de temperatura, continua nulo (não inventa). 'preditivo' saiu de "pendentes".
- Teste estendido (`cerebro-painel.smoke.mjs`): cenário com água subindo 50→70°C dispara
  "crítico em ~2 voltas / +15°C"; e cenário sem temperatura = nulo.

## Critério de conclusão: ATENDIDO
- Onda 5 ligada e provada no teste do painel (verde).
- Bateria teste-por-teste: 74 verde / 1 vermelho (schema-parity = dívida antiga, pré-existente).
- Smokes do cérebro (painel/extras/coach): verde.

## Ambiente: desenvolvimento. Produção NÃO tocada. iPhone não tocado.
## Status: concluído. Frente 2 restante: lições/atraso por trecho (DECISÃO do Flávio),
## o iPhone, e por fim ligar o cérebro numa tela de verdade.

---

# Última tarefa — Velocidade numa casa só (frente 2, item 1) — 24/06/2026

## Pedido original de Flávio
Pós-retomada, escolha clicável: "velocidade numa casa só".

## Objetivo (1 frase)
Juntar a conta de velocidade num lugar único, igual ao que foi feito com o GPS (geo.js).

## O que foi feito
- Criada a casa neutra `src/domain/velocidade.js`: `FATOR_KMH` (3,6), `msParaKmh`, `kmhParaMs`
  e `velocidadesDaVolta` (velocidade do GPS, movida do cérebro). Aritmética pura — mesmos números.
- `web/cockpit/velocidade.js` reexporta da casa; `cerebro-velocidade.js` virou reexportação
  (preserva `velocidadesDaVolta`/`distanciaM`/default).
- 10 arquivos que faziam a conta solta (fator 3,6) passaram a usar a casa: delta-calculator,
  live-data-bridge, freio-trecho, shift-light-bridge, trail-cockpit-motor (4x), trecho-detector,
  mobile-telemetry, classificador-trecho, snapshot, cross-validation.
- Trava de arquitetura estendida (regra 7): reprova `* 3.6`/`/ 3.6` fora da casa. iPhone (espelhos
  em JS) entra no VEL_BASELINE (migra na sincronia do app, só encolhe).
- Contrato atualizado: `docs/CONTRATO_DADOS.md` (linha da Velocidade + item 7 da trava).

## Critério de conclusão: ATENDIDO
- Casa existe e exporta a conta: sim. Cockpit e cérebro reexportam: sim.
- Trava: 29 ok / 0 fail (nenhum arquivo pego com conta solta — todos ligados).
- Bateria teste-por-teste: 74 verde / 1 vermelho (schema-parity = dívida antiga do banco,
  pré-existente, idêntico a antes). Shift light: verde.

## Ambiente: desenvolvimento (versão oficial local). Produção NÃO tocada (sem envio ao
## repositório oficial, sem canal cockpit-bubi-live, sem colocar no ar). iPhone não tocado.

## Status: concluído. Frente 2 restante: lições/atraso por trecho (decisão do Flávio),
## alerta de temperatura, iPhone, ligar o cérebro numa tela de verdade.

---

> ↪ SESSÃO 23/06 (noite, central de cálculos): "continue em p1 fast" → escolha do Flávio no card
> = "Incorporar o cérebro-maestro na oficial". Registro desta tarefa logo abaixo. O resto preservado.

# Última tarefa — Incorporar o cérebro-maestro (8 arquivos) na versão oficial — 23/06/2026

## Pedido original de Flávio
"continue em p1 fast" + escolha clicável: "Incorporar o cérebro-maestro na oficial".

## Objetivo (1 frase)
Trazer pra versão oficial o trabalho já pronto/testado do ambiente isolado `cerebro-maestro`
(casa neutra `src/domain/geo.js` + cérebro e detectores consumindo ela), de forma cirúrgica.

## Critérios objetivos de conclusão
- Os 8 arquivos do cérebro/geo passam a existir/atualizados na oficial (HEAD).
- O trabalho do iPhone na oficial NÃO é tocado (não regredir).
- `src/domain/geo.js` existe na oficial; `web/cockpit/geo.js` reexporta dela; trava com GEO_HOME.
- Bateria de testes + trava de arquitetura rodadas e resultado reportado (esperado 80/81, schema-parity pré-existente).

## Leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim · ~/.claude-decisoes/padroes.md: sim
- FLAVIO_EXECUTION_PROTOCOL / DONE_CHECKLIST / ENVIRONMENT_RULES / COMMUNICATION_RULES: confirmados (existem)
- .claude-exec/CONTINUAR-central-calculos.md: sim · P1 Fast/CLAUDE.md: sim

## Plano (<=5 passos)
1. (feito) Confirmar autoria real do isolado = 8 arquivos geo/cérebro; iPhone é avanço da oficial.
2. Trazer cirúrgico só os 8: `git checkout cerebro-maestro -- <8 arquivos>`. iPhone intocado.
3. Rodar trava de arquitetura (`npm run smoke:arquitetura`) + bateria de testes.
4. Conferir geo.js neutro existe, web/cockpit/geo.js reexporta, trava verde.
5. Reportar TASK_DONE. Worktrees preservados como rollback. Sem push remoto (não pedido).

## Arquivos a inspecionar / trazer
src/domain/geo.js, src/domain/trajectory-monitor.js, src/telemetry/projector.js,
tests/node-smoke-arquitetura-dado.mjs, web/cockpit/chegada-detector.js, web/cockpit/geo.js,
web/command-box/cerebro/cerebro-velocidade.js, web/command-box/cerebro/chegada-gps.js

## Ambiente alvo: desenvolvimento (versão oficial do projeto, NÃO produção)
## Produção protegida: sim
## Autorização para produção: não (não é produção — main local; remoto não recebe push; canal cockpit-bubi-live não é tocado)
## Evidência da autorização: incorporar na OFICIAL autorizado pela escolha clicável do Flávio. Produção (deploy/push/canal) NÃO incluída.

## Riscos
- NÃO trazer os 8 arquivos do iPhone do isolado (são versão antiga lá) — seria regressão. Por isso cirúrgico.
- Auto-save vai registrar a mudança na linha wip/ (fluxo normal, mesmo da incorporação da distância).
- Worktrees `cerebro-maestro` e `central-distancia` ficam preservados como rollback.

## Status inicial: iniciado

## TASK_DONE (concluído 23/06 noite)
- Pedido original conferido: sim (incorporar o cérebro-maestro na oficial)
- Ambiente trabalhado: desenvolvimento (versão oficial local, NÃO produção)
- Produção foi alterada: não (sem push remoto; canal cockpit-bubi-live intocado)
- Arquivos reais inspecionados: sim (merge-base, diff, grep, leitura)
- Alterações feitas: sim (8 arquivos do cérebro/geo trazidos cirúrgico; iPhone intocado)
- Testes/validação executados: sim (trava 28/0; bateria 74 verde / 1 vermelho isolado)
- Resultado: concluído. 1 vermelho = schema-parity, dívida antiga do banco, PROVADO pré-existente e sem relação
- Pendências reais: nenhuma desta tarefa. Frente 2 segue (velocidade/lições/temperatura/iPhone) quando o Flávio quiser.

---

> ↪ SESSÃO MAIS RECENTE (23/06 noite): "RETOMAR DIA DE PISTA" → ver
> `.claude-exec/tarefa-retomar-dia-de-pista-2026-06-23-noite.md` (bateria 262/262 verde +
> GUIA-BANCADA-DIA-DE-PISTA.md criado). O registro abaixo ("tela que se transforma") é anterior,
> preservado.

# Última tarefa — Tela que se transforma: STATUS (parado) ⟷ COCKPIT do piloto (andando) — 23/06/2026

## Pedido original de Flávio
Resposta dele à pergunta "monto o checar antes de rodar?":
"Na tela de mostrar os status, se o carro não está andando, mostra a tela com todos os status,
como é que eles estão, o que está funcionando, pode colocar até o dado debaixo do ícone, o título
dele em cima, na tela toda a gente pode usar para... se o carro estiver andando, aí mostra a tela
que é a réplica, a cópia do que o piloto está vendo."

## Objetivo (1 frase)
UMA tela que, com o carro PARADO, mostra todos os status dos aparelhos em tela cheia (ícone, título em
cima, dado embaixo, cor por estado) e, quando o carro ANDA, vira a réplica do painel do piloto.

## Critérios objetivos de conclusão
- Parado: grade de status em tela cheia, com os MESMOS aparelhos do painel aprovado (Motor/Movimento/Chassi),
  título em cima, dado/estado embaixo, cor verde(comunicando)/vermelho(sem sinal)/amarelo(falha)/cinza(a instalar).
- Destaque do que decide a gravação: GPS e MOTOR chegando (sim/não).
- Andando: a tela vira o painel do piloto APROVADO (cockpit-volta-real.html), sem alterá-lo.
- A troca parado⟷andando acontece sozinha pela velocidade (histerese, sem botão).
- Provado no navegador com a volta real (replay): para→status, anda→cockpit.

## Leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim · ~/.claude-decisoes/padroes.md: sim
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md / DONE_CHECKLIST / ENVIRONMENT_RULES / COMMUNICATION_RULES: existem (confirmados)
- docs/COCKPIT_FONTE_DA_VERDADE.md: sim · P1 Fast/CLAUDE.md: sim
- memórias: cockpit-metodo-web-primeiro, captura-automatica-movimento, app-tela-cockpit-piloto, cockpit-bubi-live-nao-publicar: sim

## Plano (<=5 passos)
1. (feito) Ler o painel aprovado e mapear os 14 sensores + de onde vem a velocidade.
2. Criar web/cockpit/checar-antes-de-rodar.html: embute o painel aprovado (iframe, intocado) + overlay de status.
3. Overlay lê o estado REAL dos sensores e a velocidade do painel (mesma origem) — sem duplicar lógica.
4. Troca por velocidade com histerese (anda>=15, para<=6 por 12s) — mesma régua da captura automática.
5. Servir na raiz do projeto + abrir no navegador pro Flávio ver a transição. Sim/não.

## Arquivos/áreas a inspecionar
- web/cockpit/cockpit-volta-real.html (painel APROVADO — só leitura, NÃO alterar)
- web/cockpit/cockpit-state.js / cockpit-renderer.js / live-data-bridge.js (peças do painel)

## Ambiente alvo: desenvolvimento
## Produção protegida: sim
## Autorização para produção: não
## Evidência da autorização: não recebida (é web/dev; nada publicado no canal cockpit-bubi-live)

## Riscos
- NÃO tocar no painel aprovado (cockpit-volta-real.html) — usar por embute (iframe). Regra dura.
- Não publicar nada no canal de produção cockpit-bubi-live. É tela local de demonstração.
- Limiares de velocidade (anda/para) são defaults — calibrar na pista.
- Sensores de chassi são "a instalar": marcar cinza/"A instalar", NUNCA vermelho de falha (sem alarme falso).

## Status inicial: iniciado

---

## EXECUÇÃO 23/06 (tarde) — DADO REAL na tela do cockpit do app (andando = cockpit ao vivo)
Foco redefinido pelo Flávio: a tela que abre ao girar o celular tem que ser tela de app DE VERDADE,
com CONEXÃO REAL e DADO REAL (não o replay = "imagem simulada"). Primeiro o caso ANDANDO=cockpit.

FEITO:
- Achada a raiz: a tela no app (`Resources/Cockpit/cockpit-app.html`) era REPLAY 100% local (volta 24/05) = a "imagem simulada".
- Preservado o replay como backup: `Resources/Cockpit/cockpit-app-replay.html` (não apaguei nada).
- Trocado o MOTOR DE DADOS no `cockpit-app.html`: saiu o replay, entrou a ESCUTA do canal real `cockpit-bubi-live`
  (via `cloud-bridge.js` onSample/onGpsPoint/startCloudBridge). SÓ ESCUTA — nunca publishSample/publishEvento
  (regra dura: não publicar no canal de produção). Reusa as funções reais que já existiam (aplicarGps/aplicarMotor/
  aplicarMotorStatus); mapeia lng→lon e os campos do stripSample. Sem carro = overlay "AGUARDANDO O CARRO" (nunca número
  inventado). Import dinâmico da ponte: se faltar internet, o painel ainda aparece.
- Empacotadas no bundle (pasta Cockpit = folder reference, entra tudo): cloud-bridge.js, supabase-config.js,
  t3000-usb-parser.js. supabase-js carrega do endereço oficial (esm.sh) em runtime (não veio bundle autossuficiente).
- PROVADA a conexão real (Node + supabase-js, só ouvir): assinou cockpit-bubi-live = SUBSCRIBED/online; 0 amostras em 6s
  (= sem carro transmitindo agora, esperado). A chave anon funciona, o canal é alcançável.
- BUILD do app: SUCEEDED. 1ª instalação no iPhone 16 (2D6E7A3B) OK; 2ª instalação FALHOU = aparelho ficou "unavailable"
  (tela apagou/bloqueou).

PENDENTE:
- App pronto em /tmp/p1fast-dd/Build/Products/Debug-iphoneos/p1fast-ios.app — instalar quando o iPhone 16 voltar ao alcance
  (Flávio desbloquear/manter aceso). Comando: xcrun devicectl device install app --device 2D6E7A3B-1449-5BE6-8D82-18F969ED0CCB <app>
- Flávio TESTAR no aparelho: girar → tela do cockpit como app (sem zoom), mostrando "CONECTADO — AGUARDANDO O CARRO" (sem carro).
- Prova com NÚMEROS reais correndo = só com carro na pista transmitindo.
- DEPOIS: caso PARADO = status (outra sessão) — fundir na mesma tela.

## CONSERTO DE APRESENTAÇÃO 23/06 (tarde) — PREENCHER A TELA + verificação por MIM no simulador
- Flávio (foto) viu a tela ENCOLHIDA, com muito preto sobrando e cortada. Causa achada no código:
  CockpitPilotoView.safeMargin devolvia ~59pt (recorte da ilha) em TODOS os lados → espremia o painel ~120pt/eixo.
  O painel tem a MESMA proporção da tela (≈2,17:1) → margem ZERO preenche inteiro. FIX: safeMargin = 0.
- Flávio (com razão) mandou eu parar de usá-lo como testador e verificar EU MESMO no simulador. FEITO:
  build pro simulador (iPhone 17 Pro Max), instalei, abri --p1-cockpit, capturei e girei a imagem (/tmp/cockpit-upright.png).
  RESULTADO VERIFICADO POR MIM: PREENCHE o quadro inteiro; leiaute aprovado completo; sensores vermelhos "sem sinal";
  selo "CONECTADO — AGUARDANDO O CARRO NA PISTA" = a conexão real fechou DENTRO do app (WebView assinou o canal).
- O iPhone 16 do Flávio JÁ TEM esta versão (build de device com margem 0, instalada pelo cabo).
- Obs: botão "‹ Voltar" só aparece no atalho de teste --p1-cockpit; no fluxo por GIRO não existe.
- Próximo após o ok dele: (a) número real = carro na pista; (b) decidir web-embutido (agora preenche/sem zoom/ao vivo) x reescrever nativo; (c) caso PARADO=status.

---

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (web, navegador)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (painel aprovado + peças do cockpit)
- Alterações feitas: sim (1 arquivo NOVO; nada existente alterado)
- Testes/validação executados: sim (servidor local + 2 prints por navegador automático)
- Resultado: concluído (1ª versão) — aberto no navegador, aguardando seu sim/não
- Pendências reais: força-G aparece "sem sinal" no replay (a volta gravada era só GPS+motor; com o carro real ele chega); limiares de velocidade (anda 15 / para 8) são defaults pra calibrar na pista; valores numéricos por aparelho (RPM, °, V) entram com o feed real na bancada

### Arquivos alterados
- NENHUM existente alterado. Painel aprovado (cockpit-volta-real.html) intocado — usado por embute.

### O que foi acrescentado
- web/cockpit/checar-antes-de-rodar.html (tela nova: status em tela cheia quando parado; vira o painel do piloto quando anda; troca sozinha pela velocidade; ?modo=parado|andando trava pra inspecionar)

### Validação executada
- Servidor local raiz do projeto (python http.server 8091): checar-antes-de-rodar.html 200, cockpit-volta-real.html 200, curvas 200, volta-real 200, state/renderer/bridge/css 200.
- Print automático modo auto: replay a 98 km/h -> tela mostrou o PAINEL DO PILOTO (transição "andando" OK).
- Print automático ?modo=parado: grade de status completa, GPS+motor verdes "Comunicando", selo "PRONTO PRA GRAVAR", chassi "A instalar" cinza, força-G "Sem sinal".

### Checagem contra o pedido original
- "carro parado -> todos os status, como estão" -> grade dos 14 aparelhos, cor por estado: OK
- "dado embaixo do ícone, título em cima" -> cartões com título em cima, ícone, dado/estado embaixo: OK
- "tela toda" -> layout largura total: OK
- "carro andando -> réplica do que o piloto vê" -> embute o painel aprovado, aparece ao andar: OK

### Pendências ou riscos
- Aguardando o ok visual do Flávio. Limiares de velocidade a calibrar na pista. Força-G/valores numéricos dependem do feed real.

## Investigação profunda das cópias preservadas — 23/06/2026
- Removidas a mais (0 código exclusivo; trabalho nomeado já na oficial): cerebro-nuvem-tripa, determined-beaver-390de9 (esta tinha só Package.resolved sujo = lockfile regenerável; branch persiste = reversível).
- TRABALHO DE CÓDIGO SOLTO (arquivos que NÃO existem na oficial — preservadas firme):
  * infallible-bardeen-dedc29: ios/.../ProntidaoPendencia.swift
  * classificador-trail: supabase/migrations/0043_tipos_curva_vivos.sql + web/cockpit/tipos-curva-vivos-{loader,persister}.js (ATENÇÃO: memória diz 0043 aplicada em PROD 14/06, mas o arquivo não está na oficial — revisar)
  * cockpit-treino-trail: src/telemetry/racebox-*.js (5, integração RaceBox/GPS) + web/cockpit/revisao-treino.{html,js}
  * revisao-treino-freio: web/cockpit/revisao-treino.{html,js}
- Preservadas por trabalho NOMEADO não incorporado: friendly-hopper, hardcore-nightingale, infallible-liskov (editor de pista GPS), infallible-snyder (telas iOS de Stint S2-S8), rodada1-s1 (telas iOS de Stint), vista-engenheiro/command-box-mockup-recovery (Vista Engenheiro do Command Box).
- Preservada por mudança não salva: hardcore-napier (só Package.resolved? não — recusou no modo seguro; manter).
- RESULTADO: 18 cópias -> 7 removidas -> 11 restantes, todas com trabalho potencialmente não incorporado. Nenhuma branch (linha de trabalho) apagada.

---

# TASK_INIT — Análise profunda do Command Box (conselho de agentes) — 23/06/2026

## Pedido original
"Em P1 Fast faça análise profunda com um conselho de agentes para avaliar o Command Box. A situação atual. O que precisa ser feito para atingir o objetivo dele ser real em todos os seus componentes com dados ao vivo da pista. Nas visões piloto e engenharia com lambda, sensores, pneus, amortecedores, e visão geral dos sensores."

## Objetivo (1 frase)
Classificar componente a componente cada visão do Command Box (real ao vivo / real gravado / demo-fake / aguardando ligação / ausente) com evidência, expor bloqueios físicos de sensor e entregar o plano para virar real ao vivo.

## Critérios de conclusão
- Cada visão diagnosticada com evidência (arquivo:linha), verificação adversarial das afirmações "é ao vivo".
- Bloqueios físicos (sensor inexistente) explicitados — não prometer dado que o carro não capta hoje.
- Plano em ondas. Linguagem de gestor.

## Ambiente: desenvolvimento (SOMENTE LEITURA / ANÁLISE). Produção protegida: sim. Autorização produção: não (não aplicável; não altera nada).

## Riscos: só de imprecisão — mitigado por verificação adversarial. Não escreve código, não toca produção, não publica no canal cockpit-bubi-live.

## Status: conselho concluído (15 agentes). Plano em ondas entregue.

---

# TASK_DONE — Trava de arquitetura do dado (uma entrada, um cérebro) — 23/06/2026

## Pedido
Flávio cobrou garantia ESTRUTURAL (não promessa) de que o dado parte de um lugar só, processa num lugar só, todos consomem o mesmo recurso, e novo trabalho segue isso — sem eu espalhar conexão/conta por tela.

## Feito (ambiente isolado, branch `guard-arquitetura`, oficial `main` INTOCADA)
- `tests/node-smoke-arquitetura-dado.mjs` — trava automática (catraca): reprova tela com conexão própria (`createClient`), dado falso (`preview-local`/`FAKE_LAPS`) ou tela nova não registrada. Baseline = dívida legada (Vista Piloto, Vista Engenheiro), só encolhe. Ignora cópias/arquivos (APROVADO/BACKUP/data).
- `docs/CONTRATO_DADOS.md` — registro único: fonte (canal `cockpit-bubi-live` + ponte `cloud-bridge.js`), contrato de campos (stripSample, inclui lambda), casa de cada conta (cérebro), telas que só exibem.
- `package.json` — liga a trava em `npm run smoke` + `npm run smoke:arquitetura`.
- `CLAUDE.md` — regra dura em "Decisões já fechadas".
- Memória: `feedback-arquitetura-uma-fonte-um-processamento-todos-consomem.md` + índice.

## Validação executada (real)
- Estado atual: 28 ok / 0 fail (verde).
- Violação nova (tela com createClient): 28 ok / 1 fail (vermelho) — reprovou.
- Removida: verde de novo.
- `npm run smoke:arquitetura` roda pelo comando oficial; `package.json` é JSON válido.
- `main` (oficial) confirmada sem a trava (0) — só na linha isolada.

## Resultado: concluído (estrutura construída e provada). 

---

# TASK_DONE — Incorporação à oficial + migração da Vista Piloto (conexão) — 23/06/2026

## Feito
1. **Incorporado à versão oficial (main):** trava + registro + regra + ligação no `npm run smoke`. Cirúrgico (só os 4 arquivos, via `git checkout` da branch — não arrastei a divergência do auto-save). Trava roda verde na oficial.
2. **Ampliada a ponte única `web/cockpit/cloud-bridge.js` (+ espelho iOS):** vários ouvintes na MESMA conexão + eventos `evento` (volta) e `posicao` (posição da nuvem). Aditivo, compatível com os consumidores atuais (main-t3000, checar, app). Sintaxe ok.
3. **Migrada a Vista Piloto — conexão:** as DUAS conexões próprias (HUD + cérebro) viraram UMA, pela ponte única. `createClient` na tela = 0 (era 2). Mesma fonte de produção (supabase-config = fvhwltzhytpnhlqbttmd). Backup: `_design-reference/_backups/...BACKUP-migracao-fonte-unica-20260623-164139.html`.
4. **Catraca apertada:** baseline da Vista Piloto perdeu `conexao-propria` (dívida quitada); trava agora EXIGE a tela sem conexão própria e passa (27 ok / 0 fail).

## Validação
- Trava verde após quitar (27 ok / 0 fail). Se a tela tivesse conexão, reprovaria (catraca não mente).
- 8078 serve a ponte e dependências (200). Tela aberta pro Flávio ver carregando com o arranjo dele.
- Limite honesto: a prova de DADO ao vivo correndo só com carro na pista. Sem carro: selo "AO VIVO · aguardando o carro" (esperado). Reversível pelo backup.

## Pendências reais
- Ok visual do Flávio (layout intacto / sem erro).
- Vista Piloto: resta a dívida do feed de demonstração (preview-local/FAKE_LAPS) — próximo passo.
- Vista Engenheiro: ainda toda em demonstração — migrar depois.
- `?canal=` (canal de dev por URL) não passa mais pela ponte (ela usa o canal canônico cockpit-bubi-live); se precisar de canal de teste, adicionar na ponte (um lugar só).

---

# TASK_INIT — Central de Cálculos: mapa ANTES/DEPOIS (visual) — 23/06/2026

## Pedido original
"RETOMAR CENTRAL DE CÁLCULOS" + escolha no card: entregar como **comparação antes/depois** (visual, lado a lado, focada no ganho).

## Objetivo (1 frase)
Mostrar visualmente, em linguagem de gestor, como as contas funcionam hoje (cada tela/cérebro refaz a sua) versus como ficam com a central (uma conta, uma casa, todos consomem).

## Critérios de conclusão
- HTML de tela cheia, sem emoji, duas colunas: HOJE × COM A CENTRAL.
- Cada afirmação concreta apoiada por arquivo real verificado.
- Abre no navegador do Flávio.
- Nada do sistema é alterado (é desenho pra decidir).

## Leitura obrigatória
~/.claude/CLAUDE.md, padroes.md, FLAVIO_EXECUTION_PROTOCOL/DONE_CHECKLIST/ENVIRONMENT_RULES/COMMUNICATION_RULES, P1 Fast/CLAUDE.md, CONTINUAR-central-calculos.md: todos lidos nesta sessão.

## Evidência verificada por grep/ls (sessão 23/06)
- Continha de distância no GPS copiada em 8 arquivos: passagem-real.js, cerebro-velocidade.js, trail-cockpit-motor.js, trecho-detector.js, classificador-trecho.js, freio-trecho.js, ios/.../trecho-detector.js, trajectory-monitor.js.
- Marcha em 2 lugares: src/domain/gear-estimation.js (velho) × web/cockpit/gear-detector-online.js (produção).
- Ponto de troca da luz em 2: src/domain/shift-target.js × web/cockpit/shift-light-orquestrador.js.
- Freio com 1 motor só: web/cockpit/freio-trecho.js (exemplo do que já está bom).
- Casas reais que o cérebro ignora: delta-calculator.js, src/domain/p1-coach.js, src/domain/score.js (existem).
- Cérebro (web/command-box/cerebro/*) só é importado por mockup da Vista Piloto, testes e scripts de scratch — nenhuma tela de app de verdade.

## Ambiente: desenvolvimento. Produção protegida: sim. Autorização produção: não (não se aplica — desenho local).

## Riscos
Baixo. Cria 1 HTML novo de referência. Não altera código/banco/produção. Único risco = afirmar algo não verificado; mitigado pela verificação acima.

## Status: concluído (2 desenhos entregues e abertos)

## TASK_DONE (Central de Cálculos — mapas)
- Pedido conferido: sim (antes/depois + depois o raio-x completo que ele pediu)
- Ambiente: desenvolvimento. Produção alterada: não.
- Arquivos inspecionados: sim (~130 listados; 3 agentes Explore + greds meus; números cravados)
- Alterações: 2 arquivos NOVOS de referência; 1ª mapa corrigido (8→16). Nada existente removido.
- Validação: abertos no navegador; cada número conferido em código real (grep).
- Resultado: concluído. Pendência: decisão do Flávio sobre por onde começar a execução.
- Acrescentado: _design-reference/mapa-central-calculos-antes-depois.html, _design-reference/mapa-central-calculos-raiox.html

---

# EXECUTADO — Central de Cálculos FRENTE 1: distância GPS vira casa única — 23/06/2026
- Casa única `web/cockpit/geo.js`; 12 arquivos migrados; trava ganhou regra (GEO_BASELINE). 80/81 testes verdes (o fail é schema-parity, pré-existente). INCORPORADO na oficial (autorizado "Incorporar na oficial"). Worktree `central-distancia` preservado p/ rollback. Detalhe em `.claude-exec/CONTINUAR-central-calculos.md`.

---

# TASK_INIT — Central de Cálculos FRENTE 2: cérebro vira maestro — 23/06/2026

## Pedido original
Flávio escolheu (card) a frente "1 — o furo maior: ligar o cérebro como maestro (a maior alavanca de domínio)".

## Objetivo (1 frase)
Fazer o cérebro (web/command-box/cerebro/*) USAR as casas reais (atraso/delta, nota/score, lições/p1-coach, linha de referência) em vez de refazer, rumo a ligá-lo numa tela.

## Critérios de conclusão (desta etapa)
- Plano em passos, linguagem de gestor, com risco e fronteira clara (refatorar o cérebro × ligar numa tela), na frente do Flávio ANTES de tocar código.

## Leitura obrigatória: feita nesta sessão (CLAUDE.md global, padroes, protocolos, P1 Fast/CLAUDE.md, CONTINUAR-central-calculos).

## Ambiente: desenvolvimento. Produção protegida: sim. Autorização produção: não.

## Riscos (a confirmar no mapeamento)
- O cérebro hoje NÃO está ligado em tela real → refatorá-lo é baixo risco (nada vivo depende). Ligar numa tela = risco maior (muda o que a tela mostra; exige ok visual do Flávio).
- Casas reais órfãs (score, reference-line) podem ter interface diferente do que o cérebro produz — mapear antes.

## Status: Etapa 1 FEITA no ambiente isolado, NÃO incorporada (Flávio: "Deixa no ambiente isolado")

## TASK_DONE — Frente 2 Etapa 1 (distância + chegada na casa única)
- Pedido conferido: sim (etapa 1 das duas seguras, plano aprovado; SEM inventar função nova)
- Ambiente: desenvolvimento (worktree cerebro-maestro). Produção/oficial alterada: NÃO.
- Arquivos inspecionados: sim (cérebro + detectores, fórmula a fórmula)
- Alterações: 6 arquivos (casa neutra src/domain/geo.js nova; web/cockpit/geo.js reexporta; cerebro-velocidade, chegada-gps, chegada-detector usam a casa; trava ajustada). Cópia espelho eliminada.
- Testes: 80/81 verdes (o fail schema-parity já falhava na main); trava 28/0; 5 smokes do cérebro OK.
- Resultado: concluído no isolado; Flávio escolheu NÃO incorporar agora.
- Pendências: incorporar quando ele quiser; etapas 2-4 + ligar numa tela (etapa final, ok visual).

## TASK_DONE — "Terminar a distância numa casa só" (mesma linha isolada cerebro-maestro)
- Pedido conferido: sim (Flávio: "Terminar a distância numa casa só"). Verifiquei antes: velocidade já era 1 casa (não inventei trabalho).
- Ambiente: worktree cerebro-maestro. Oficial alterada: NÃO.
- Alterações: trajectory-monitor + projector usam src/domain/geo.js; mock-provider marcado fora-da-conta; trava atualizada.
- NÃO migrados (dívida marcada, motivo real): apice (curvatura aprovada/sensível), cross-validation ({lon}), iOS ×3 (bundle do app).
- Testes: 80/81 verde (schema-parity pré-existente); trava 28/0.
- Resultado: concluído no isolado até onde é seguro provar; Flávio escolheu NÃO incorporar agora.
- Honestidade: NÃO é "100% dos lugares" — 5 ficaram por motivo declarado, não por esquecimento.

---

## TASK_INIT — RETOMAR COMMAND BOX (ETAPA 2) — 2026-06-25 17:20
1. Pedido original: "RETOMAR COMMAND BOX" → seguir a ETAPA 2 do fluxo do stint ao vivo (vídeo em cima + mapa/telemetria embaixo), conforme RETOMAR-COMMAND-BOX-NA-NUVEM.md (Flávio autorizou seguir pra ETAPA 2 em 25/06).
2. Objetivo: ter a tela do stint ao vivo (espectador) com vídeo em cima e mapa/telemetria embaixo, viva e demonstrável em DEV.
3. Critérios de conclusão: tela montada e ligada ao dado ao vivo (ou demonstrada com volta gravada); build no simulador; nada enviado pra versão oficial; produção intocada.
4. Lidos: ~/.claude/CLAUDE.md, ~/.claude-decisoes/padroes.md, FLAVIO_EXECUTION_PROTOCOL, FLAVIO_ENVIRONMENT_RULES, FLAVIO_DONE_CHECKLIST, FLAVIO_COMMUNICATION_RULES, CLAUDE.md do projeto, RETOMAR-COMMAND-BOX-NA-NUVEM.md, memórias de Command Box.
5. Plano (<=5): (a) levantar AssistirView + fluxo de dados [FEITO]; (b) confirmar formato do painel rico [FEITO: deitado/congelado]; (c) decidir com Flávio o que vai EMBAIXO (card ux); (d) executar a escolha em DEV; (e) provar no simulador.
6. Áreas inspecionadas: ios/.../Views/AssistirView.swift, HomeView.swift (StintAoVivoCard), CockpitPilotoView.swift (WebView do painel), StintRepository.swift, Resources/Cockpit/cockpit-app.html.
7. Ambiente alvo: desenvolvimento.
8. Produção protegida: sim.
9. Autorização para produção: não.
10. Evidência da autorização para produção: não recebida.
11. Riscos: (a) embutir o painel deitado/congelado numa tela em pé quebra UX e mexe em formato protegido; (b) "ao vivo de verdade" depende do carro na pista (C1, físico).
12. Status inicial: iniciado — ACHADO: a tela da ETAPA 2 já existe; bifurcação real de UX levada ao Flávio no card 20260625-172034-cb-etapa2-tela-de-baixo.

## TASK_DONE — RETOMAR COMMAND BOX (ETAPA 2) — 2026-06-25 17:36
- Pedido original conferido: sim (seguir a ETAPA 2 do stint ao vivo)
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (AssistirView, HomeView, CockpitPilotoView, StintRepository, ContentView, PistaBrasilia, project.yml, fixture da volta)
- Alterações feitas: sim (modo de demonstração na tela de espectador)
- Testes/validação executados: sim (xcodebuild simulador iPhone 17 = BUILD SUCCEEDED; app instalado e aberto; 2 fotos provam a bolinha andando 118→171 km/h; trava de arquitetura 31/1 = igual ao pré-existente)
- Resultado: concluído (a fatia desta sessão)
- Pendências reais: ao vivo de verdade depende do carro na pista (C1, físico); validar clique do card + reatividade entre aparelhos quando houver stint real; ETAPA 3 (rever vídeo+dados gravados).

### Decisão registrada
- Card 20260625-172034-cb-etapa2-tela-de-baixo (ux): "Manter simples (mapa + bolinha + ritmo)". Registrado em .claude-perguntas/respostas, ~/.claude-decisoes/respostas/p1-fast e index.jsonl.

### Arquivos alterados/criados
- ios/p1fast-ios/Sources/Views/AssistirView.swift (modo demo: status .demonstracao, init(demo:), motor que toca a volta gravada, avisos honestos) — ALTERADO
- ios/p1fast-ios/Sources/Views/AssistirDemoVolta.swift (volta real gravada embutida, 881 amostras) — NOVO
- ios/p1fast-ios/Sources/Views/ContentView.swift (rota .assistirDemo + atalho --p1-assistir-demo) — ALTERADO
- .claude-exec/RETOMAR-COMMAND-BOX-NA-NUVEM.md (estado da ETAPA 2) — ATUALIZADO

### O que foi preservado
- Layout aprovado da AssistirView (vídeo em cima / velocidade no meio / mapa embaixo) intocado; o caminho ao vivo via sala Daily intocado; o painel congelado do piloto (cockpit-app.html) não foi tocado.

### Validação executada
- xcodegen --spec project.yml (regenerou o projeto com o arquivo novo)
- xcodebuild ... -destination 'iPhone 17' build → ** BUILD SUCCEEDED **
- xcrun simctl install/launch --args --p1-assistir-demo → app abriu na tela de espectador em demonstração
- 4 fotos no scratchpad (assistir-demo-1..4.png): bolinha andou na pista, velocidade 118→171 km/h
- node tests/node-smoke-arquitetura-dado.mjs → 31 ok / 1 fail (o 1 é pista-oficial-brasilia.js pré-existente)
- build-sim removido (artefato regenerável, não fica na linha de trabalho)

## TASK_INIT — ETAPA 3 (rever vídeo+dados sincronizado) — 2026-06-25 17:42
1. Pedido: "siga" → ETAPA 3 do fluxo do stint (rever vídeo + dados gravados juntos, "gameplay").
2. Objetivo: provar em DEV o motor de SINCRONIZAÇÃO (tempo da gravação → posição/dado), base do "tocar vídeo+dados juntos".
3. Conclusão: demonstração "rever a volta" com linha do tempo que move junto o ponto do vídeo (placeholder) e a bolinha+velocidade; build no simulador; nada na versão oficial.
4. Lidos: protocolos Flávio + CLAUDE.md projeto + RETOMAR doc + migrações 0015/0016/0044 + funções de vídeo + TriagemVideoView.
5. Plano (<=5): (a) levantar fundação [FEITO: volta_video liga vídeo↔volta por offset; triagem só abre URL, sem dados]; (b) motor de sincronização (tempo→posição) sobre a volta gravada; (c) demonstração "rever a volta" reusando o mapa aprovado; (d) atalho + build + provar no simulador; (e) registrar.
6. Áreas: AssistirDemoVolta.swift, PistaBrasilia.swift, ContentView.swift, TriagemVideoView.swift, supabase/migrations 0015/0016/0044.
7. Ambiente: desenvolvimento. 8. Produção protegida: sim. 9. Autorização produção: não. 10. Evidência: não recebida.
11. Riscos: não inventar tela nova de produção (regra do projeto) — isto é DEMONSTRAÇÃO/andaime, reusa layout aprovado; vídeo real depende do dia de pista; player final pede mockup aprovado.
12. Status: iniciado.

## TASK_DONE — ETAPA 3 (motor de sincronização vídeo+dados) — 2026-06-25 17:51
- Pedido original conferido: sim ("siga" → ETAPA 3)
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Arquivos reais inspecionados: sim (migrações 0015/0016/0044, funções de vídeo, TriagemVideoView, VoltaVideoIndexer/Repository)
- Alterações feitas: sim (demonstração "rever a volta" + motor de sincronização)
- Testes/validação executados: sim (BUILD SUCCEEDED sim iPhone 17; fotos rever-volta-1..4 provam tempo/bolinha/velocidade juntos 0:15→2:04, 17→123 km/h; trava arquitetura 31/1; build-sim removido)
- Resultado: concluído (a fatia provável agora: o motor de sincronização)
- Pendências reais: (1) vídeo real gravado pareado com os dados = dia de pista (físico); (2) player final de produção pede mockup aprovado pelo Flávio (regra: não inventar tela); a demo escopa por gravação inteira, o player real escoparia por volta (offsets do volta_video).

### Arquivos alterados/criados
- ios/p1fast-ios/Sources/Views/ReverVoltaDemoView.swift — NOVO (demo + motor estadoEm + tela rever a volta)
- ios/p1fast-ios/Sources/Views/ContentView.swift — ALTERADO (rota .reverVoltaDemo + atalho --p1-rever-volta-demo)
- .claude-exec/RETOMAR-COMMAND-BOX-NA-NUVEM.md — ATUALIZADO (estado ETAPA 3)

### O que foi preservado
- TriagemVideoView, VoltaVideoIndexer/Repository, migrações de vídeo, AssistirView intocados. Reuso de PistaBrasilia (aprovado).

### Validação executada
- xcodegen + xcodebuild iPhone 17 → BUILD SUCCEEDED (2x)
- simctl launch --args --p1-rever-volta-demo → tela abriu tocando
- fotos: rever-volta-1.png (0:15, 17 km/h) … rever-volta-4.png (2:04, 123 km/h) — sincronização provada
- node tests/node-smoke-arquitetura-dado.mjs → 31 ok / 1 fail (pré-existente)

## ETAPA 3 — mockup do player + decisão aberta — 2026-06-25 17:57
- Mockup gerado e autoconferido (render Chrome): _design-reference/mockup-rever-volta-player-2026-06-25.html (traçado real de Brasília, sem emoji, largura total; variantes A simples / B análise + lista de voltas).
- Card de decisão (ux) aberto: 20260625-175721-rever-volta-dados — "o que o lado dos dados mostra: A simples (recomendado) | B análise | Outra".
- Aguardando resposta do Flávio ("fiz") pra registrar e, se aprovado, construir quando houver vídeo real (dia de pista).

## ETAPA 3 — decisão registrada — 2026-06-25 17:59
- Card 20260625-175721-rever-volta-dados: escolha "A — dados simples (mapa + bolinha + velocidade)". Registrado nos 3 destinos + index.jsonl; card arquivado em respostas.
- Desenho do player APROVADO (opção A). A demonstração ReverVoltaDemoView já é a opção A.
- BLOQUEADO pra produção: precisa de vídeo real gravado (dia de pista) pra construir/provar o player de produção. Não construir tela de produção sem dado pra provar.
- Resultado da rodada: concluído até o limite físico (desenho aprovado + miolo provado em DEV).
