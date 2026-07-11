# Entrega — JANELA 4 — "Ferramentas de teste" dentro da Garagem

Papel: JANELA 4 (trava atômica `travas/janela-4`).
Ambiente isolado: worktree `.claude/worktrees/home-j4-garagem`, linha `claude/garagem-ferramentas-teste`, a partir de `main` (68813c12). NÃO incorporado à versão oficial.
Data: 2026-07-11.

## 1. O que foi feito (e onde)

### a) Seção "Ferramentas de teste" no FIM da Garagem — `GaragemView.swift`
Última seção do `garagemHome` (a home premium v6 da Garagem, lista de grupos), depois do grupo "Conta":
- **Eyebrow** `grupoLabel("Ferramentas de teste")` — o MESMO cabeçalho de grupo (11pt, uppercase, apagado, com filete) que os demais grupos da Garagem (Carros/Checklist/Equipe/Pessoas/Materiais/Pista/Conta). Padrão preservado, não inventei estilo novo.
- **Duas linhas-lista** no visual EXATO das "peças" da Garagem (`ftileLabel`: nome + sub-rótulo + seta `›` num quadradinho):
  - **"Teste ao vivo"** · sub "validação de campo" → abre `TesteAoVivoView` (espelhamento notebook + GPS).
  - **"Gravar telemetria"** · sub "grava sessão de teste" → abre a `TelemetriaView` de teste.
- **Navegação por PUSH** via `NavigationLink(value: HomeNavTarget.testeAoVivo)` e `...telemetriaDemo` — o MESMO mecanismo que os cards de carro já usam. Isso mantém o **menu inferior visível** (ele fica fora da pilha, na HomeView) e o **voltar volta UMA tela** (`voltarUmaTela` da HomeView). As telas são resolvidas pelo `navigationDestination(for: HomeNavTarget.self)` da HomeView, que também injeta o builder da Telemetria vindo do ContentView.
- **Gate `syncCoordinator != nil`**: a seção aparece só no app real (igual ao grupo "Conta"); nos launchers de screenshot que montam a Garagem sem pilha de navegação ela fica oculta pra não haver porta morta.

Refatoração mínima no mesmo arquivo, sem mudar visual: extraí `ftileLabel(nome,ctx)` de dentro do `ftileButton` pra reusar o MESMO visual num `NavigationLink` (o `ftileButton` continua idêntico, só passou a chamar `ftileLabel`).

### b) Fiação declarada (fronteira) — dependência que a J5 precisa preservar
A seção da Garagem **reusa** a fiação que hoje existe na Home. Portanto, ao remover os botões de teste da Home, a **J5 deve preservar** na `HomeView.swift`:
1. os casos `.testeAoVivo` e `.telemetriaDemo` no `destinationView(for:)`;
2. o parâmetro `telemetriaDevView` (builder injetado pelo `ContentView`) e sua injeção.
Só o **UI dos botões** sai da Home; o **roteamento + builder** continua e passa a ser consumido pela Garagem. `ContentView.swift` NÃO foi tocado (conferido: idêntico a `main`).

### c) Harness de prova por foto (SÓ-DEV) — `HubMockLauncher.swift`
Minha build de worktree não tem credenciais Supabase (login indisponível → nunca chega no app autenticado), então usei o harness de screenshot SEM login que o projeto já tem (`--p1-hub-mock`, tratado ANTES do portão de auth). Acrescentei:
- `--p1-garagem-ferramentas`: monta a Garagem numa pilha própria que resolve os MESMOS `HomeNavTarget` das portas de teste + um `SyncCoordinator` "de mentira" só pra a seção aparecer (o gate `!= nil`).
- `--p1-goto-teste` / `--p1-goto-telemetria`: pré-empilham o destino (equivale ao toque na linha) pra fotografar a tela abrindo POR ELA.
- `--p1-scroll-ferramentas` (em `GaragemView`, dev-only): rola até a seção pra a foto (ela fica no fim da lista).
Isso é dev-only, isolado, e reversível — não muda o app real.

## 2. Regras do mandato conferidas
- Sem emoji; ícone de traço (seta `›`); vermelho só crítico (não usei vermelho); tratamento "você" (sub-rótulos neutros); nada de tela nova (só portas pras telas existentes); preservei tudo que a Garagem já tem, inclusive **Conta/Sair** (continua no grupo "Conta", intacto).
- Fundo escuro preservado (padrão do Flávio).

## 3. Prova real (comandos + saídas)

### Empacotamento (P1-Zoom375 = iPhone 11 Pro, 375×812, iOS 26.4)
```
cd ios/p1fast-ios && xcodegen generate
xcodebuild -project p1fast-ios.xcodeproj -scheme p1fast-ios \
  -destination 'platform=iOS Simulator,id=1BC2F7A1-222E-44A5-A117-1314F6FA2623' \
  -derivedDataPath build-sim build
→ ** BUILD SUCCEEDED **
```

### Fotos (simulador P1-Zoom375-J4, clone do P1-Zoom375 pra não colidir com as outras janelas no mesmo device)
`.claude-exec/home-dia-de-pista/entregas/fotos-j4/`:
- `1-garagem-secao.png` — a seção "FERRAMENTAS DE TESTE" como último grupo da Garagem, com as duas linhas ("Teste ao vivo · validação de campo" e "Gravar telemetria · grava sessão de teste") no mesmo visual dos demais grupos.
- `2-teste-ao-vivo.png` — "Teste ao vivo" abriu a `TesteAoVivoView` ("AO VIVO" · "Esperando o vídeo do notebook…").
- `3-telemetria.png` — "Gravar telemetria" abriu a `TelemetriaView` ("Telemetria — captura ao vivo" · STOP · INICIAR · Sessão UUID). A seta de voltar (‹) no topo confirma o PUSH (voltar volta uma tela).

Comandos das fotos:
```
xcrun simctl launch <J4> com.flaviomarques.p1fast --p1-hub-mock --p1-garagem-ferramentas --p1-scroll-ferramentas   # foto 1
xcrun simctl launch <J4> com.flaviomarques.p1fast --p1-hub-mock --p1-garagem-ferramentas --p1-goto-teste           # foto 2
xcrun simctl launch <J4> com.flaviomarques.p1fast --p1-hub-mock --p1-garagem-ferramentas --p1-goto-telemetria      # foto 3
```

### Testes existentes (smoke do P1FastCore — o harness de teste do projeto)
```
cd ios/p1fast-core && swift run p1fast-smoke
→ 575 ok / 1 fail
```
O único fail é **PERSIST-03** (`tabela evento_pendencias_extra deve ter synced_at`) — falha de **schema/persistência** no P1FastCore, **pré-existente** e **sem relação** com esta tarefa (mexi só em telas). Prova de que é alheia: o `git diff --stat main -- ios/` mostra que só `GaragemView.swift` e `HubMockLauncher.swift` mudaram — nenhum arquivo do core/persistência foi tocado. (Não há alvo XCTest neste projeto Xcode; o smoke é o teste que existe.)

## 4. Fronteira (conferida)
- `git diff --name-only main -- ios/` (fontes rastreadas) = **só** `GaragemView.swift` + `HubMockLauncher.swift`.
- `ContentView.swift`: idêntico a `main` (toquei durante a investigação e revertei 100%).
- `Package.resolved`: o `xcodegen`/build havia mexido (72 linhas) — **restaurado de `main`** (ADR-022: é tracked, não deletar). Confere com `main` agora.
- NÃO toquei: `HomeView.swift` (J5), `Theme.swift` (J1), componentes novos das J1–J3, web/, cockpit, cérebro, Supabase, `cockpit-app.html`.
- `ios/p1fast-ios/build-sim/` é derivado de build (untracked) — não faz parte da mudança.

## 5. Proposta ao coordenador (integração)
Na montagem final, a J4 entra assim: manter os 2 arquivos meus. Ao integrar a J5 (que remove os botões da Home), garantir que a `HomeView` preserve os casos `.testeAoVivo`/`.telemetriaDemo` no `destinationView` e o `telemetriaDevView` (ver §1b). O harness de `HubMockLauncher` é opcional — pode ficar (é dev-only) ou ser podado na versão final; a seção da Garagem funciona no app real sem ele.

## 6. Pendências
Nenhuma na minha fatia. O único fail de smoke (PERSIST-03) é pré-existente e de outra área.
