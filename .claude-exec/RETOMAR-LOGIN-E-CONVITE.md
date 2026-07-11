# ▶️ RETOMAR — LOGIN POR PESSOA + CONVIDAR (multi-aparelho) · P1 Fast

> **Gatilho do Flávio:** "continua" / "RETOMAR LOGIN" / "RETOMAR CONVITE" / "multi-aparelho" → LER ESTE ARQUIVO PRIMEIRO e continuar exatamente daqui. Escrito 2026-06-25 pra sobreviver a um /clear. Autossuficiente.
>
> Projeto: `/Users/imac/Projetos/P1 Fast` (com espaço). Versão oficial = branch `main`. App iOS Swift em `ios/p1fast-ios/`, núcleo em `ios/p1fast-core/`. Supabase do projeto = **p1-fast** (CLI autentica via Keychain — NÃO pedir senha ao Flávio).

## ═══ ONDE PAREI (LER PRIMEIRO) — ATUALIZADO 25/06 17:45 ═══
**LOGIN POR PESSOA: INCORPORADO NA MAIN** (Flávio respondeu "Testei e aprovo" no card). Merge cirúrgico: GaragemView/HubMockLauncher = versão login-pessoa (superset); ContentView = merge 3-way limpo (login + stint ao vivo + assistir-demo preservados). BUILD SUCCEEDED + smoke 575/1. Commit b0fdab0e + auto-saves.

**FASE 1 MULTI-APARELHO (lado iOS): CONSTRUÍDA E ISOLADA** no ramo `multiaparelho-fase1` (NÃO na main, NÃO no iPhone). Os 3 stores (EquipeStore/StintCheckStore/DiaCheckStore em HubMockLauncher.swift) passam a chamar `SyncQueue.enqueueRecord` (8 pontos) + SyncCoordinator.pullTables ganhou `equipe_membros/stint_check/dia_check`. BUILD SUCCEEDED.

**LADO SERVIDOR: APLICADO EM PRODUÇÃO (25/06, Flávio "autorizado").** Migration 0049 aplicada no p1-fast (`supabase db push --linked`, dry-run mostrou só a 0049; tudo 0001–0048 já estava no remoto; 48 arquivos/48 números, sem duplicados órfãos hoje) → tabelas equipe_membros/stint_check/dia_check criadas com RLS por time. Validado por REST (anon): as 3 dão HTTP 200 vazio (existem; RLS esconde). Edge Functions sync + pull deployadas: `supabase functions deploy <nome> --project-ref fvhwltzhytpnhlqbttmd` (NÃO aceita --linked). iOS incorporado na main (3 stores enfileiram + pullTables +3 + SyncBackfill +3) + app assinado instalado no iPhone 16 Pro Max (2D6E7A3B). Commits na main: server (peças + 0049), iOS (HubMock+SyncCoordinator), backfill.

**PROVADO AO VIVO (25/06 19:46):** Flávio destravou, abri o app no iPhone 16 Pro Max, puxei `p1fast.sqlite` do aparelho → `equipe_membros` 4/4 com `synced_at` preenchido (Allan/Bubi/Dri/Flávio, time c027a716) + `sync_queue` dessas 3 tabelas VAZIA = device→cloud→servidor-aceitou confirmado em PRODUÇÃO.

**PRÓXIMA AÇÃO = prova VISUAL num 2º aparelho (cloud→device):** o puxar (pull) já está deployado e libera as 3 tabelas; falta um 2º celular logado no MESMO time pra ver a equipe aparecer sozinha. iPhone 15 (A89E6EDD) apareceu pareado — possível 2º aparelho (confirmar com Flávio antes de instalar nele). DEPOIS: **Fase 2 = convite** (modelo `usuarios_time` já existe; falta RPC de convite + tela) e **Fase 3 = TestFlight**. Reversão de produção: drop das 3 tabelas (rollback no próprio 0049) + redeploy anterior das 2 functions.

## ═══ CORREÇÃO CRÍTICA (eu estava errado antes) ═══
**A ponte pra nuvem JÁ EXISTE e FUNCIONA.** Eu disse 2× pro Flávio que não existia — ERRADO, já me corrigi com ele. Verificado no iPhone dele: **59 stints + 2 carros já estão na nuvem** (synced_at preenchido). O que sincroniza: a maior parte (sessoes, carros, eventos, pilotos, pneus, combustiveis, etc.). Infra real no repo:
- `ios/p1fast-core/Sources/P1FastCore/Persistence/SyncQueue.swift` (fila) + `SyncDrainer.swift` (envia).
- `ios/p1fast-ios/Sources/Sync/SyncCoordinator.swift` (orquestra: sync 30s, pull 5min, telemetry 60s) + `URLSessionTransports.swift` (POST `/functions/v1/sync`, `/pull`, `/ingest` no Supabase; auth JWT + apikey).
- Edge Functions no repo: `supabase/functions/sync/index.ts` (whitelist `ALLOWED_TABLES` linha 27), `pull/index.ts`.
- Time na nuvem JÁ existe: tabelas `times` + `usuarios_time` (membro × time + papel admin/membro/chefe_equipe), RLS `is_member/is_admin/is_chefe_equipe`, RPC `ensure_personal_team` (define o time no login). Migrações em `supabase/migrations/`.
- **NÃO sincroniza (LOCAL-ONLY, é o que falta):** `equipe_membros` (lista da equipe + PIN), `stint_check`, `dia_check` (marcações do checklist). Travado no iPhone: 43 itens `track_segments` ("table-nao-permitida") = problema antigo/menor, NÃO é nosso.

## ═══ PLANO MULTI-APARELHO (a continuar) ═══
**Modo escolhido (minha decisão por "faça a melhor forma"):** UMA conta do time + cada pessoa entra por PIN no aparelho dela + a equipe e o checklist passam a sincronizar. (Alternativa: conta separada por pessoa = mais segura/mais passos; só se o Flávio pedir.)
- **FASE 1 — equipe + checklist sincronizam (COMEÇAR AQUI):** (a) iOS enfileira mudanças de `equipe_membros`/`stint_check`/`dia_check` (`SyncQueue.enqueueRecord` no EquipeStore.salvar/remover + StintCheckStore/DiaCheckStore.alternar — hoje NÃO enfileiram); (b) servidor: adicionar essas tabelas em `ALLOWED_TABLES` (sync/index.ts) + nas tabelas de pull (SyncCoordinator.pullTables) + RLS no Supabase. Resultado: mesma equipe + mesmo checklist em todos os celulares.
- **FASE 2 — convite:** trazer o celular da pessoa pro mesmo time (modelo `usuarios_time` já existe; falta RPC de convite + tela). 
- **FASE 3 — TestFlight:** levar o app pro celular dela (operacional; precisa conta de desenvolvedor Apple).
- **REGRA DURA:** servidor/nuvem (Edge Functions, migrações, RLS) = **PRODUÇÃO**. Construir isolado, testar, e **só ligar na nuvem com "ok"/"MIGRAR PARA PRODUÇÃO" do Flávio**. Nada vai pro ar sozinho.

## ═══ LOGIN POR PESSOA — FEITO, AINDA NÃO INCORPORADO ═══
Worktree (ambiente isolado): `.claude/worktrees/login-pessoa` (branch `login-pessoa`, base = main). **NÃO incorporado na `main`** — aguarda o Flávio testar no iPhone e aprovar. Já INSTALADO no iPhone dele pra teste.
- **O que faz:** app abre → se a equipe tem gente com PIN e ninguém logado → tela **"Quem está usando?"** → escolhe nome + PIN → o app LEMBRA quem é. O **checklist não pergunta mais "quem é você"** (usa quem está logado). **"Trocar pessoa"** em Garagem→Conta.
- **Arquivos (worktree login-pessoa):** `ContentView.swift` (gate `precisaLoginPessoa` + `conteudoComLogin` na ReadyRoot; injeta `currentPerson`), `GaragemView.swift` (botão "Trocar pessoa" no grupo Conta), `HubMockLauncher.swift` (`CurrentPersonStore` [pessoa atual, lembra via UserDefaults + Notification `.pessoaAtualMudou`], `PersonLoginView` [nome+PIN], `ExecucaoStintRealView` usa `CurrentPersonStore.idSalvo`). Não tocou giro/cockpit nem tela inicial (só o gate). BUILD SUCCEEDED + smoke 575/1.
- **PIN = SHA256("{id_do_membro}:{pin}")** (`PinSeguranca.hash`). PINs decididos: Flávio=1313, Bubi=2222, Marcos=4242, João=5555, Alan/Visita=9999.
- **Provado no simulador:** abrir → "Quem está usando?" (Alan/Bubi/Flávio/João/Marcos) → toquei Flávio → 1313 → entrou como Flávio (chefe) e LEMBROU. Provas `/tmp/prova-login/`.
- **iPhone do Flávio JÁ TEM equipe real com PIN:** Flávio(chefe), Bubi(piloto), Allan Mesquita(engenheiro), Dri(convidado) + 59 stints. Time dele = `c027a716-dc05-4d3c-9b8f-59f288d5e12c`. Ele abre o app → login aparece → entra com o PIN DELE (não sei os PINs dele, são hash).

## ═══ CHECKLIST DO STINT — FEITO E INCORPORADO NA MAIN ═══
Já na versão oficial (`main`), provado: execução do stint (escolhe pessoa → itens → grava `stint_check`, âncora `Stint.id`), pendência grande na 1ª tela, vibra 2×, Visão do chefe (lista obrigatórios pendentes + responsável), "Carro voltou" (controle manual do chefe → some o aviso), PIN dentro do checklist. Em `HubMockLauncher.swift` + `EventoDetalheView.swift`. Atalhos dev: `--p1-hub-mock` + `--p1-checklist-stint-real` / `--p1-execucao-stint-real [--p1-auto-pessoa|--p1-visao-chefe|--p1-carro-voltou|--p1-pin-gate]`. Detalhe em [[project_p1fast_checklist_stint_amarracao]].

## ═══ FATOS / COMANDOS / ARMADILHAS ═══
- **iPhone do Flávio:** `2D6E7A3B-1449-5BE6-8D82-18F969ED0CCB` (iPhone 16 Pro Max, "iPhone Pro Max (7)"). Puxar dados: `xcrun devicectl device copy from --device <id> --domain-type appDataContainer --domain-identifier com.flaviomarques.p1fast --source / --destination /tmp/...`. Empacotar+instalar: `xcodebuild ... -destination 'platform=iOS,id=<id>' -allowProvisioningUpdates build` + `xcrun devicectl device install app --device <id> <app>`. Assinatura: Apple Development flaviomarques@me.com.
- **Simulador iPhone 17:** `35488C07-3F73-41C2-9F19-3840B3116C9D`. Login por pessoa testado nele (semei equipe `c-flavio`/`c-bubi`/... com PIN sob c027a716). Banco do app no sim: `Documents/p1fast.sqlite` no container (`xcrun simctl get_app_container <sim> com.flaviomarques.p1fast data`).
- **Cliques no simulador:** a janela às vezes vai pra outra tela (x negativo/1481) e o cliclick erra → reposicionar a janela (`set position of window 1 to {60,30}`) e reativar; se os cliques pararem de registrar, **reiniciar o Simulator** (killall Simulator + open -a Simulator) resolve. **Menu de baixo NÃO responde a toque automático** (usar elementos do meio). Senha do Flávio = 1212.
- **Empacotar (simulador):** `xcodebuild -project "ios/p1fast-ios/p1fast-ios.xcodeproj" -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath /tmp/<x> build`. Teste núcleo: `cd ios/p1fast-core && swift run p1fast-smoke` (esperado 575 ok/1 fail = PERSIST-03 pré-existente). Worktree precisa do `Config/.env.xcconfig` (copiar de main; NÃO é versionado).
- **CUIDADO:** auto-save commita no meio de incorporação; trazer cirúrgico só os arquivos certos (`git checkout <branch> -- <arquivos>`), conferir marcadores de conflito, NÃO trazer Package.resolved. Time do servidor (c027a716) ≠ time local AA "Equipe pessoal" (descasamento pré-existente; o app reverte pro c027a716 no login).

## AO RETOMAR, fazer:
1. Ler este arquivo + `CLAUDE.md` do projeto + protocolo Padrão Flávio (TASK_INIT) + a memória dos 2 caminhos.
2. Confirmar com o Flávio se ele testou o login no iPhone (e se aprova incorporar na main) — pendência aberta.
3. Começar a FASE 1 do multi-aparelho (equipe + checklist sincronizam), em cópia isolada, SEM tocar na nuvem/produção sem "ok".
4. Registrar TASK_INIT antes de alterar código.
