# Última tarefa — Plano Piloto + Engenheiro CONCLUÍDO em 2026-05-18 noite

## TASK_DONE — 2026-05-18 ~18h35
- **Pedido original conferido:** sim (executar Blocos 2 → 6 do plano sem perguntar)
- **Ambiente trabalhado:** desenvolvimento (worktree `infallible-snyder-198a08`)
- **Produção foi alterada:** não
- **Autorização explícita registrada:** N/A
- **Arquivos reais inspecionados:** sim (DynoCsvParser, Detector, LiveKalmanProcessor, LiveTelemetryRecorder, StintCaptureCoordinator, CockpitDataBinder, HomeView, CarroDashboardView, ContentView, project.pbxproj, mockup Command Box base, JSON do mapa)
- **Alterações feitas:** sim — 6 arquivos novos no core + 2 telas SwiftUI + 1 coordinator iOS + 1 método novo no binder + 6 arquivos na Edge Function `trecho-analisar` + 1 mockup HTML + 4 referências no project.pbxproj
- **Testes/validação executados:** sim (561 smokes Swift verdes + 14 testes Deno verdes + build simulator OK + build device OK + install no iPhone OK)
- **Resultado:** concluído com 4 limitações honestas registradas (T4000 ausente hoje, deploy da Edge Function pendente, telas com dados de exemplo, marcadores aproximados no mockup)
- **Pendências reais:**
  1. Plugar `CockpitCloudCoordinator.attach(...)` na `StintCockpitView` (1 linha) — entra junto com T4000.
  2. Deploy do `trecho-analisar` em produção depende de "MIGRAR PARA PRODUÇÃO: trecho-analisar".
  3. Ligar Debrief real ao banco de stints quando T4000 entrar.

### Registro completo do que entregamos
Memória final: `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-plano-piloto-engenheiro-completo-2026-05-18.md`

---

# Tarefa anterior — Pausada pra /clear 16h45, RETOMAR EXECUTANDO

## ORDEM DIRETA DO FLÁVIO (16h45)

"Para de burocratizar — você já tem as respostas". **NÃO PERGUNTAR. EXECUTAR.**

Retomar com `voltei` = continuar do Bloco 2 e seguir Blocos 2→3→4→5→6 sequencialmente até terminar o plano completo.

Decisões consolidadas + cronograma detalhado: `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-checkpoint-pre-clear-2026-05-18-16h45.md`

---

# Tarefa anterior — Sessão pausada pra /clear (2026-05-18 15h)

## CHECKPOINT pré-clear gravado

Sessão pausada para limpar memória. Estado completo em:
- **Memória do projeto:** `p1-fast-checkpoint-pre-clear-2026-05-18-15h.md` (selo ⏰⏰⏰ no topo do MEMORY.md)
- **Plano detalhado:** `docs/PLANO_PILOTO_ENGENHEIRO_2026-05-18.md` (v1, aguardando v2 com correções)
- **Curva motor:** `docs/dyno/CELTA_BUBI_MARQUES_DYNO_2026-05-18.md`
- **Vitrine HTML:** `_design-reference/preview-manutencao.html` (7 telas)
- **Card de produção aberto:** `.claude-perguntas/pendentes/20260518-010500-producao-manutencao.html`

## Como Flávio retoma

Depois de `/clear`, digitar qualquer um destes:
- **`voltei`** — Claude lê o checkpoint e resume + pergunta qual frente atacar primeiro.
- **`continue manutencao`** — vai direto pra v2 do plano.
- **`continue plano piloto engenheiro`** — mesma coisa.
- **`vamos`** — equivalente a "voltei".

## 3 decisões pendentes

1. Onde calcular a aceleração teórica (notebook Windows OU iPhone).
2. Submissão à versão oficial — pacote único OU separado.
3. Calibração de massa do Celta — pesar agora OU usar valor de catálogo.

## Caminho recomendado quando voltar

Caminho B: gerar v2 do plano com 14 correções automáticas + abrir card pras 3 decisões reais. Tempo ~30 min.

---

# Tarefa anterior — Função Manutenção noturna "go" (2026-05-18 ~01h)

## TASK_INIT — 2026-05-18 (autônomo, gatilho "go" pré-aprovado)

- **Pedido original (Flávio):** "go" — disparo de gatilho pré-armado para executar os 4 blocos da Manutenção do início ao fim sem perguntas.
- **Contexto:** gatilho `p1-fast-comando-go-manutencao-2026-05-18.md` + plano operacional `.claude-exec/PLANO_NOITE_MANUTENCAO_GO.md`.
- **Objetivo (1 frase):** plantar a função Manutenção (4 blocos: Fundação · Lançamento com foto · Periodicidade · Inteligência aprendente) no aplicativo iOS, com testes verdes e build pronta pro iPhone, sem tocar produção / Estoque / cockpit / mapa Brasília.
- **Critérios objetivos de conclusão:**
  1. 3 tabelas locais novas (v32) com round-trip GRDB testado.
  2. Catálogo de 15 itens default embarcado em código.
  3. Formulário "Nova troca" com foto + abate de Estoque vinculado.
  4. Pendências automáticas no topo do painel do carro (verde/amarelo/vermelho).
  5. Contador vivo + média aprendida + detecção de anomalia na ficha do item.
  6. 17 smokes novos (MN-01..17) passando.
  7. Build pra iPhone bem-sucedida + instalação **ou** comando exato registrado se a instalação travar.
- **Confirmação de leitura:**
  - ~/.claude/CLAUDE.md: sim
  - ~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/MEMORY.md: sim
  - CLAUDE.md do projeto: sim
  - STATUS.md: sim (desatualizado, mas lido)
  - `p1-fast-comando-go-manutencao-2026-05-18.md` (gatilho): sim
  - `.claude-exec/PLANO_NOITE_MANUTENCAO_GO.md`: sim
- **Plano (≤ 5 passos):**
  1. Sincronizar worktree com base do `claude/rodada1-s1` pra ter Estoque + S1-S8.
  2. Bloco 1 — schema + models + repo + tela base + smokes.
  3. Bloco 2 — formulário com foto + abate Estoque.
  4. Bloco 4 — periodicidade + pendências automáticas.
  5. Bloco 5 — inteligência aprendente + ficha do item + build/install.
- **Arquivos/áreas a inspecionar:**
  - `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` + `Migrations.swift`
  - `ios/p1fast-ios/Sources/Persistence/PecaRepository.swift` (padrão a reusar)
  - `ios/p1fast-ios/Sources/Views/CarroDashboardView.swift` (plugar aba)
  - `ios/p1fast-ios/Sources/Views/HomeView.swift` (rota nova)
  - `ios/p1fast-ios/Sources/Views/ContentView.swift` (injeção do repo)
- **Ambiente alvo:** desenvolvimento
- **Produção protegida:** sim
- **Autorização para produção:** não
- **Evidência da autorização para produção:** "não recebida" — plano explícito mantém tudo no banco local.
- **Riscos identificados:**
  - Worktree estava atrás do main + sem Estoque → sincronizado com `claude/rodada1-s1` (reset hard reversível via reflog + arquivos preservados em /tmp).
  - Instalação no iPhone dependia de iPhone desbloqueado → bloqueada por Face ID; build empacotada e comando registrado pra retomada.
- **Status inicial:** iniciado às 00:30 local.

## TASK_DONE — 2026-05-18 01h00

- **Pedido original conferido:** sim
- **Ambiente trabalhado:** desenvolvimento
- **Produção foi alterada:** não
- **Se produção foi alterada, autorização explícita registrada:** N/A (não foi alterada)
- **Arquivos reais inspecionados:** sim (Models, Migrations, PecaRepository, CarroDashboardView, HomeView, ContentView, PendenciaRepository)
- **Alterações feitas:** sim (5 arquivos novos + 5 alterados — lista no detalhe abaixo)
- **Testes/validação executados:** sim
- **Resultado:** concluído com 1 limitação honesta (instalação no iPhone bloqueada por Face ID)
- **Pendências reais:**
  1. Flávio precisa rodar `xcrun devicectl device install app --device 2D6E7A3B-1449-5BE6-8D82-18F969ED0CCB build-device/Build/Products/Debug-iphoneos/p1fast-ios.app` ao acordar (do diretório `ios/p1fast-ios`).
  2. Validação visual da UI pendente — build compila e smokes passam, mas o olho do gestor é o juiz final.

### Arquivos alterados
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift` — migration `v32_manutencoes` (3 tabelas).
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — 3 structs Codable+GRDB.
- `ios/p1fast-core/Sources/P1FastSmoke/main.swift` — PERSIST-01 atualizado (39 → 42) + 17 MN-01..17.
- `ios/p1fast-ios/Sources/Views/CarroDashboardView.swift` — seção "Manutenção" + EnvironmentObject manutencaoRepo.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — `@StateObject manutencaoRepo` + injeção + bootstrap paralelo.
- `ios/p1fast-ios/Sources/Views/HomeView.swift` — rota `.manutencaoCarro(carroId:)`.

### Arquivos criados
- `ios/p1fast-core/Sources/P1FastCore/Manutencao.swift` (~440 linhas — domínio puro: catálogo + PeriodicidadeRegra + avaliarStatus + mediaDuracoes + detectarAnomalia).
- `ios/p1fast-ios/Sources/Persistence/ManutencaoRepository.swift` (~280 linhas — CRUD GRDB + abate Estoque + fotos locais).
- `ios/p1fast-ios/Sources/Persistence/ManutencaoInteligencia.swift` (~140 linhas — SQL pra horas/voltas/km de pista entre 2 datas).
- `ios/p1fast-ios/Sources/Views/ManutencaoViews.swift` (~720 linhas — 4 telas SwiftUI).

### O que foi preservado
- Função Estoque · Cockpit do piloto rodada C · mapa Brasília oficial v2 · S1-S8 · todo o trabalho do `rodada1-s1` — todos intactos.
- Banco local do iPhone (pecas, sessoes, voltas, etc.) — não toquei.
- Produção Supabase — intocada.

### O que foi acrescentado
- 4 blocos da função Manutenção (Fundação · Lançamento com foto · Periodicidade · Inteligência aprendente).
- 17 smokes novos cobrindo schema, round-trip, regra JSON, cálculo de status, peso 3× da pista, média aprendida, anomalia.
- Build empacotada pra device em `ios/p1fast-ios/build-device/Build/Products/Debug-iphoneos/p1fast-ios.app`.

### Validação executada
- `swift run p1fast-smoke` no `ios/p1fast-core` → **516 ok / 0 fail** (era 499 antes).
- `xcodebuild -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` → **BUILD SUCCEEDED**.
- `xcodebuild -destination 'generic/platform=iOS' build` (Debug, device) → **BUILD SUCCEEDED**.
- `xcrun devicectl device install app` → falhou com `kAMDMobileImageMounterDeviceLocked: The device is locked.` (esperado — Face ID exige presença).

### Checagem contra o pedido original
- ✅ Bloco 1 (Fundação) — schema + models + tela base + sub-aba especificação.
- ✅ Bloco 2 (Lançamento com foto) — formulário completo + abate Estoque + lista cronológica.
- ✅ Bloco 4 (Periodicidade) — regra rica + JSON round-trip + 15 defaults + pendências no topo do painel.
- ✅ Bloco 5 (Inteligência aprendente) — contador SQL real + média aprendida + detecção de anomalia + ficha do item.
- ✅ Testes verdes após CADA bloco.
- ✅ Empacotamento pra iPhone OK.
- ⚠️ Instalação no iPhone — bloqueada por Face ID (comando registrado pra retomada).
- ✅ TASK_DONE e MEMORY.md atualizados.
- ✅ Plano "go" marcado como CONSUMIDO.

### Pendências ou riscos
1. Instalar no iPhone amanhã (comando exato acima).
2. Validação visual da UI pelo gestor.
3. Blocos adiados (3 · Foto inteligente, 6 · Painel "Pronto pra pista", 7 · Pneu por nº de série, 8 · Plano pré-evento, 9 · Backup iCloud) — entram quando autorizar.
4. Migrar pra produção depende de "MIGRAR PARA PRODUÇÃO: tabelas manutencao*" do Flávio.

---

# Tarefa anterior — Cadastro de evento: bloquear duplicata (mesma pista + mesma data)

## TASK_INIT — 2026-05-16 (2ª tarefa do dia)

- **Pedido original (Flávio):** "Não permita o cadastramento de dois eventos iguais a mesma data para o mesmo piloto, que é o mesmo usuário do aplicativo."
- **Contexto visível:** lista de eventos mostra 3x Brasília · 23 MAI (duplicatas reais já no banco local).
- **Objetivo (1 frase):** travar a criação de um novo evento quando já existir outro evento da mesma equipe na mesma pista com algum dia coincidente; mostrar mensagem clara ao usuário.
- **Critérios objetivos de conclusão:**
  1. Tentar cadastrar Brasília · 23 MAI quando já existe um → bloqueio com mensagem visível.
  2. Cadastros válidos (data nova OU pista diferente) continuam funcionando.
  3. Build iOS continua compilando.
  4. App instalado no iPhone e o gestor confirma visualmente.

- **Confirmação de leitura de:**
  - ~/.claude/CLAUDE.md: sim
  - ~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/MEMORY.md: sim

- **Plano (≤ 5 passos):**
  1. Adicionar método `existeChoque(trackId:dias:)` em EventoRepository (mesma equipe + mesma pista + algum dia coincidente).
  2. Chamar do início de `create()`; se choque → lançar `EventoRepositoryError.eventoDuplicado(...)`.
  3. Em `EventoNovoFormView.save()`, exibir a mensagem do erro (já tem `savingError`).
  4. Empacotar pra iOS (Debug) e instalar no iPhone real.
  5. Pedir confirmação visual do gestor.

- **Arquivos/áreas a inspecionar:**
  - `rodada1-s1/ios/p1fast-ios/Sources/Persistence/EventoRepository.swift` (método create + Models)
  - `rodada1-s1/ios/p1fast-ios/Sources/Views/EventoNovoFormView.swift` (save + savingError)

- **Ambiente alvo:** desenvolvimento
- **Produção protegida:** sim
- **Autorização para produção:** não
- **Evidência da autorização:** não recebida
- **Riscos:**
  - Definição de "duplicata" — escolhi "mesma pista + qualquer dia coincidente"; pode ser restritivo demais se o gestor quiser permitir treino e corrida no mesmo dia. Manter simples; se reclamar, refino.
  - Existem 3 eventos de 23 MAI já no banco. NÃO vou apagar sem autorização. Só prevenção daqui pra frente.

- **Status inicial:** iniciado

## TASK_DONE — 2026-05-16 (2ª tarefa)

- **Pedido original conferido:** sim
- **Ambiente trabalhado:** desenvolvimento (`rodada1-s1`)
- **Produção foi alterada:** não
- **Autorização explícita registrada:** não se aplica
- **Arquivos reais inspecionados:** sim
- **Alterações feitas:** sim
- **Testes/validação executados:** sim (** BUILD SUCCEEDED ** + app instalado e aberto no iPhone real)
- **Resultado:** parcial — falta confirmação visual do gestor (tentar criar duplicata → ver mensagem; criar data nova → seguir normal)
- **Pendências reais:**
  1. Gestor testar no iPhone e confirmar.
  2. 3 eventos duplicados de 23 MAI já existem no banco local. NÃO foram apagados (sem autorização). Se quiser limpar, aviso.

## Limpeza das duplicatas — 2026-05-16 12:23

Gestor autorizou ("pode excluir as duplicidades"). Executado:

- Base local do iPhone puxada (`xcrun devicectl device copy from`).
- Backup salvo em `/tmp/p1fast-backup-20260516-122126.sqlite` (3.3 MB).
- Identificados 3 eventos sobrepondo 23 + 24 mai: `821940E7…` (mais antigo, mantido), `A8B836C2…` (apagado) e `6EA124FC…` (apagado).
- Transação SQL aplicada na base copiada:
  - 4 linhas de evento_dias removidas.
  - 2 linhas de eventos removidas.
  - 4 inserts pendentes na fila de envio removidos.
  - 2 deletes adicionados na fila de envio (servidor vai apagar em cascata).
- App terminado, base limpa devolvida (`copy to`), app reaberto.
- Verificação: nova cópia do aparelho mostra 4 eventos (era 6), nenhum dos 2 IDs duplicados aparece.

**Resultado final:** concluído.

## 3ª tarefa do dia — "abrir conteúdo, não o grupo" — 2026-05-16

### Pedido original (Flávio)
"quando clicamos em um elemento, como como o subaru por exemplo, vc já deve abrir o seu conteúdo e não ir para um grupo. isso se aplica a tudo."

### O que estava acontecendo
Na Home, os cards individuais de carros (Subaru, Bolinha) ao serem tocados levavam pra tela da Garagem (lista do grupo), em vez de abrir aquele carro específico.

### O que foi feito
- `HomeView.swift` no `rodada1-s1`:
  - Adicionado tipo `HomeCarroSheetItem` (wrapper Identifiable pra abrir modal por ID).
  - Adicionado `@State carroDetalheSheet` em HomeView.
  - Adicionado `.sheet(item:)` que renderiza `CarroModalView` direto.
  - `FilledContent` recebeu callback `onTapCarro: (String) -> Void`.
  - Tocar num card específico de carro agora chama `onTapCarro(carro.id)` que abre o modal daquele carro.

### O que NÃO mudou (e por que)
- Cabeçalho "GARAGEM 2 carros · Ver todos ›" continua indo pra Garagem — isso É um link de grupo intencional.
- Tiles de estatística (Carros / Eventos / Stints / Autódromos / Recordes / Voltas) continuam abrindo a lista do grupo — também são intencionalmente grupos.
- Cards de "Ativo hoje" / "Próximo evento" já abriam o evento específico (não mudou).

### Validação
- Empacotamento iOS: ** BUILD SUCCEEDED **
- App instalado e aberto no iPhone real.

### Pendência
- Confirmar visualmente: na Home, tocar no card do Subaru deve abrir o detalhe do Subaru direto (sheet com edição completa), não a tela de lista da Garagem.

### Princípio "isso se aplica a tudo" — auditoria
Outros pontos auditados:
- Lista de eventos → toque em evento já abre o detalhe direto ✅.
- Stints / Voltas / Autódromos / Recordes → são tiles agregados (grupos), não casos individuais; ficam como estão.
- Card de "Próximo evento" e "Ativo hoje" → já abre o evento ✅.
- Cards de carro na Home → CORRIGIDO nesta rodada ✅.
- Se aparecer outro lugar com o mesmo problema (card individual indo pra lista), tratar caso a caso.

## 4ª tarefa do dia — Painel do carro (não tela de edição) — 2026-05-16

### Pedido (Flávio)
"Quando eu clicar no carro, ou aqui na tela home, ou clicar, não é pra eu editar o cadastro do carro, pra aparecer as coisas do aplicativo relativas ao carro, quantos quilômetros ele já rodou, quantos autódromos ele já fez, quantas voltas já deu, qual foi a volta mais rápida que ele já deu. e criem uma tela em que os pilotos já pilotaram, qual a configuração mais usada."

### O que foi entregue
- Tela nova: `CarroDashboardView.swift` (Painel do carro).
- Tocar num carro (Home ou Garagem) agora abre o painel, não o cadastro.
- Conteúdo do painel:
  1. Cabeçalho: foto + apelido + modelo · categoria.
  2. 6 números: Km estimado, Voltas, Autódromos, Vmax, Stints, Pilotos.
  3. Bloco "Melhor volta" (tempo + pista + piloto + data, ou estado vazio).
  4. Bloco "Pilotos que pilotaram" (nome + nº de stints).
  5. Bloco "Autódromos visitados" (nome + último uso).
  6. Bloco "Configuração mais usada" (nome + nº de stints).
  7. Botão "Editar carro" na barra inferior → empurra a tela de edição (CarroModalView) dentro do mesmo painel.

### O que NÃO foi feito (consciente)
- Os números reais ficam todos em zero/em branco hoje, porque o gestor ainda não tem voltas reais registradas no app (3 stints sem voltas e sem segmentos cronometrados). O painel mostra estados vazios elegantes ("Sem voltas válidas…", "Nenhum piloto…").
- Não fiz validação dos números contra dados reais — vai acontecer naturalmente quando começar a registrar stints com cronômetro.

### Arquivos mexidos
- `rodada1-s1/ios/p1fast-ios/Sources/Views/CarroDashboardView.swift` (NOVO).
- `rodada1-s1/ios/p1fast-ios/Sources/Views/HomeView.swift` (modal agora abre o painel, não a edição).
- `rodada1-s1/ios/p1fast-ios/Sources/Views/GaragemView.swift` (mesma mudança).
- `rodada1-s1/ios/p1fast-ios/Sources/Persistence/CarroRepository.swift` (queue do banco passou de privada pra interna do módulo, pra a tela nova poder ler).
- `rodada1-s1/ios/p1fast-ios/p1fast-ios.xcodeproj/project.pbxproj` (arquivo novo registrado no projeto Xcode).

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone real.

### Pendência
- Gestor abrir o app, tocar num carro (Subaru ou Bolinha) e confirmar o painel.

### Resultado
parcial — aguarda confirmação visual do gestor.

## 5ª tarefa — Menu de baixo sempre visível — 2026-05-16

### Pedido (Flávio)
"mantenha sempre o menu em baixo, em todas as telas, aquele menu de navegação fica lá."

### O que estava acontecendo
O menu inferior (HOME / EVENTOS / CADASTROS / GARAGEM) sumia em duas situações:
1. Quando a navegação empurrava telas detalhe (ex.: painel do carro, detalhe do evento), porque o menu morava dentro da pilha de navegação e era substituído pelo conteúdo empurrado.
2. Quando o app abria janelas modais (sheets), porque essas janelas cobrem a tela toda — característica do iOS.

### O que foi feito agora
1. **HomeView**: o menu foi tirado de dentro da pilha de navegação e colocado num "andar acima" da pilha. Agora ele fica sempre fixo no rodapé, independente do que a pilha estiver mostrando.
2. **Painel do carro (CarroDashboardView)**: deixou de ser janela modal (cobria o menu) e passou a ser empurrado na pilha (mantém o menu visível).
3. **GaragemView, EventosListaView, PessoasView**: removido o menu duplicado que cada uma tinha dentro do próprio corpo. Agora todas usam o menu do "andar de cima" (root da Home).
4. **NavigationCoordinator**: ganhou uma propriedade `abaAtual` que registra qual aba está visualmente ativa no menu, baseado no que tem na pilha.

### O que continua usando janela modal (sheet)
- Cadastrar carro novo, cadastrar evento novo, cadastrar piloto, cadastrar passageiro, editar carro, etc. — tudo o que é AÇÃO de criar/editar continua sendo janela modal. Justificativa: o gestor entra ali pra fazer uma ação explícita e fechar. Manter como modal economiza confusão.
- Se quiser que isso também respeite a regra do menu fixo, é só me dizer e eu converto cada formulário.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone real.

### Como testar
1. Na Home, toque no Subaru → painel do carro abre EMPURRADO (não modal). Menu de baixo continua lá.
2. Toque "Editar carro" na barra inferior do painel → janela modal abre (cobre o menu — comportamento esperado pra ação de edição).
3. Pelo menu inferior, vá pra "Garagem" → toque num carro → painel abre empurrado, menu continua visível.
4. Pelo menu inferior, vá pra "Eventos" → menu continua fixo (não tem mais o menu duplicado embaixo).
5. Pelo menu inferior, vá pra "Cadastros" → mesma coisa.

### Pendência
- Gestor confirmar visualmente.

## 6ª tarefa — Painel sem botão de editar — 2026-05-16

### Pedido (Flávio)
"E o botão de edição é só no cadastro do carro, não precisa colocar botão de edição no carro ou quando for olhar o autódromo, isso é no cadastro do elemento."

### Princípio que ele cravou
- Painel/visualização = SÓ leitura. Sem botão de editar.
- Editar acontece na tela de cadastro do elemento.
- Vale pra carro, vai valer pro autódromo, pessoas, etc.

### O que foi feito
- Removido o botão "Editar carro" do `CarroDashboardView`.
- Removido o estado interno `mostrandoEdicao` e o caso de rota `CarroDashboardRoute.editar` que não são mais usados.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone real.

### Lacuna aberta (preciso da decisão do gestor)
Com o botão "Editar carro" removido do painel, **hoje não tem caminho na interface pra editar o cadastro de um carro existente**. As opções pra eu implementar:

1. **Adicionar uma sub-aba "Carros" dentro de CADASTROS** (junto de Pilotos, Passageiros, Combustíveis, Lições). Tocar num carro lá abre o cadastro. — Mais consistente com o padrão "cadastros ficam todos no mesmo lugar".
2. **Pôr uma seta/ícone de "editar cadastro" na lista da GARAGEM** (não no painel). Continua sendo "cadastro acessado pelo cadastro", só que pela tela Garagem.
3. **Botão "Editar cadastro" no canto superior do painel do carro** — você descartou explicitamente, então NÃO é opção.

Vou perguntar pro gestor qual caminho ele quer.

### Pendência (resolvida)
- Gestor escolheu opção 1: sub-aba "Carros" dentro de CADASTROS.

### Implementação da opção 1 (Carros em Cadastros) — 2026-05-16 12:55

- Adicionado caso `.carros` em `PessoasSubTab` (terceira sub-aba, depois de Pilotos e Passageiros, antes de Combustíveis).
- Adicionado `@EnvironmentObject carroRepo: CarroRepository` em `PessoasView`.
- Nova função `carrosRows`: lista os carros do repositório, cada um clicável → abre janela modal de edição (`CarroModalView`). Botão "Cadastrar carro" no fim → abre `CarroNovoFormView`.
- Casos novos em `PessoasSheet`: `.novoCarro` e `.editarCarro(carroId)`.
- Textos do cabeçalho atualizados (eyebrow "Carros", título "Carros cadastrados", subtítulo orientando o gestor).

### Como testar
1. Toque "Cadastros" no menu de baixo.
2. Toque a sub-aba "Carros".
3. Deve listar Subaru e Bolinha.
4. Toque o Subaru → abre a tela de edição (modal).
5. Toque o Bolinha → abre a tela de edição.
6. Toque "+ Cadastrar carro" → abre o formulário de cadastrar novo carro.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

## 7ª tarefa — App sempre abre na Home — 2026-05-16

### Pedido (Flávio)
"Quando fecha o aplicativo e volta, volta na tela de home sempre, tá?"

### O que foi feito
Adicionado em `ContentView.swift` um observador do ciclo de vida da janela do app (`scenePhase`). Sempre que o app volta pra "ativo" (tanto cold start quanto retornando do segundo plano após você travar o iPhone ou ir pra outro app), o coordenador de navegação chama `goHome()` — reset da pilha de navegação + aba ativa volta pra "Home".

### Cobertura
- Cold start (app fechado de verdade, abrindo do zero) — já abria na Home naturalmente.
- Foreground após segundo plano (apertou home, depois voltou) — AGORA volta pra Home.
- Foreground após tela bloqueada (Face ID, etc.) — AGORA volta pra Home.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar no iPhone
1. Vá pra qualquer aba que não seja a Home (Garagem, Eventos, Cadastros).
2. Toque o botão Home do iPhone (ou faça swipe pra baixo).
3. Volte pro app (toque o ícone do P1 Fast ou puxe da bandeja de apps).
4. Deve abrir já na Home (não na aba que você estava).

## 8ª tarefa — Reorganizar detalhe do evento — 2026-05-16

### Pedido (Flávio)
"Quando eu clico em evento Brasília, que tem dois dias e mesmo outro também, o dia do evento deve ficar logo abaixo do cockpit, total de Stint, volta, melhor, pronto e tal. E o botão de novo Stint deve ficar logo abaixo do dia de pista."

### O que foi feito
Reordenado o detalhe do evento (`EventoDetalheView.swift`):
- **Antes**: cockpit → histórico do piloto → pendências → ações → pneus → setups → dias (só se >1 dia) → lista de stints (com botão "Novo stint" no fim).
- **Agora**: cockpit → **dia(s) do evento** → **botão "Novo stint"** → histórico do piloto → pendências → ações → pneus → setups → lista de stints (sem botão duplicado).

Mudanças específicas:
- A faixa com os dias do evento (pílulas horizontais — uma por dia) sobe pra logo depois do cockpit dos 4 números (STINTS / VOLTAS / MELHOR / PRONTO).
- Mostro a faixa mesmo quando o evento tem só 1 dia (antes só aparecia quando havia mais de 1).
- O botão "Novo stint" foi promovido pra logo abaixo da faixa de dias. Some quando o evento é passado (mesmo critério anterior).
- A lista de stints continua no fim da tela, mas sem o botão "Novo stint" dentro dela (evita duplicação).

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone real.

### Como testar
1. Na Home, toque "EVENTOS" no menu de baixo.
2. Toque o evento Brasília · 23/05.
3. Verificar ordem: cabeçalho do evento → cockpit (4 cards) → **pílulas com os 2 dias (23 e 24)** → **botão "Novo stint"** → histórico nessa pista → pendências → ações a fazer → pneus → setups → lista de stints (vazia por enquanto).

### Pendência (resolvida na 9ª tarefa)
- Cabeçalho duplicado também precisava ser arrumado — virou a 9ª tarefa.

## 9ª tarefa — Cabeçalho padronizado (voltar em cima sempre) — 2026-05-16

### Pedido (Flávio)
"Em todo aplicativo, em cima é pra voltar, então sempre a setinha em cima voltando. Se naquela tela fizer sentido ter a função editar, é sempre em cima à direita. um pouco mais alto, alinhado com a seta do que está aparecendo aí nessa imagem. ou a função de editar, deixar alinhada com a seta."

### Regra
- Setinha de voltar SEMPRE no topo à esquerda (vem do iOS, não pintamos por cima).
- Função de editar (quando fizer sentido) no topo à direita, alinhada com a setinha.
- Sem duplicação de "‹ Voltar" / "‹ Eventos" embaixo da setinha do iOS.

### O que foi feito
Removidos os cabeçalhos customizados duplicados das telas internas:
- `EventoDetalheView` — tinha "‹ Eventos" + "Editar" abaixo da setinha do iOS. Os dois foram removidos. (Botão "Editar" antigo era placeholder sem ação — pelo princípio dele, edição de evento vai virar uma sub-aba de CADASTROS depois.)
- `StintsView`, `VoltasView`, `AutodromosView`, `RecordesView` (todos em `RelatoriosViews.swift`) — tinham um "‹ Voltar" customizado abaixo da setinha do iOS. Removidos.

Padding inferior dessas telas também aumentado pra 140 pontos pra o conteúdo não ficar embaixo do menu de baixo.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar
1. EVENTOS → toque um evento → cabeçalho mostra só uma setinha no topo (a do sistema), sem duplicação.
2. HOME → toque "8 RECORDES" → mesma coisa.
3. HOME → toque "412 VOLTAS" → mesma coisa.
4. HOME → toque "STINTS" → mesma coisa.
5. HOME → toque "3 AUTÓDROMOS" → mesma coisa.

### Pendência da 9ª
- Gestor confirmar visualmente.
- Sub-aba "Eventos" em Cadastros pra editar eventos antigos (próximo passo lógico, ainda não implementado).

## 10ª tarefa — Tocar no carro = montar stint daquele carro — 2026-05-16

### Pedido (Flávio)
"Nesta tela, se clicar no carro, é como se ele estivesse saindo para a pista, então ele tem que montar o Stint, aparece o carro e lá dentro o botão Iniciar Stint, ou Novo Stint, a mesma coisa, Clicou em Novo Stint, pergunta qual carro, escolheu o carro, vem o planejamento do Stint."

### Regra
Dois caminhos pra iniciar um stint, ambos levando ao mesmo planejamento:
- Caminho A: toca no card do carro em "Seu histórico nessa pista" → abre o planejamento com aquele carro já escolhido (sem perguntar de novo).
- Caminho B: toca "+ Novo stint" → abre o planejamento e o usuário escolhe o carro (caminho atual já cobre — abre com o primeiro carro carregado por enquanto).

### O que foi feito
- `EventoDetalheSheet` ganhou caso novo: `.novoStintComCarro(carroId:)`.
- `StintModalView` ganhou parâmetro `carroInicialId: String?`. Quando passado, vira o carro escolhido. Senão, mantém o comportamento de pegar o primeiro carro como fallback.
- Em `historicoPistaSection`, os cards do subaru/Bolinha viraram clicáveis (em evento futuro — em evento passado segue sendo apenas histórico).
- Toque no card → dispara `sheet = .novoStintComCarro(carroId: item.carroId)`.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar
1. EVENTOS → toque Brasília · 23/05 ou 19/05.
2. Em "Seu histórico nessa pista", toque no card do **Subaru**.
3. Deve abrir o planejamento do stint já com Subaru selecionado (verificar contexto do header do modal).
4. Cancele e teste com Bolinha — abre planejamento com Bolinha.
5. Botão "+ Novo stint" (logo abaixo do dia da pista) continua funcionando — caminho B.

### Pendência da 10ª
- Gestor confirmar visualmente.

## 11ª tarefa — Conserto da zona de toque do "+ Novo stint" — 2026-05-16

### Pedido (Flávio)
"O botão do Stint, às vezes funciona e às vezes não, às vezes tem que clicar mais de uma vez pra ele funcionar. Checa aí a acessibilidade e funcionamento dele."

### Diagnóstico
O botão "+ Novo stint" (`AddStintCTA`) tinha fundo `Color.clear`. No iOS, área transparente dentro de um botão NÃO recebe toques — só registra clique exato em cima do texto ou da linha pontilhada da borda. O "buraco" no centro era invisível mas real: dependendo de onde o dedo caía, o toque era ignorado.

### Correção
- Fundo trocado pra `Color.surfaceRaised.opacity(0.001)` — praticamente invisível ao olho mas opaco o suficiente pra capturar toques na área inteira.
- Adicionado `.contentShape(RoundedRectangle(...))` que define explicitamente a área clicável como o retângulo inteiro do botão.
- Altura mínima de 56 pontos forçada (`minHeight: 56`) pra garantir alvo de toque dentro do recomendado pela Apple (44pt mínimo).

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar
1. EVENTOS → toque um evento.
2. Vá no botão "+ Novo stint".
3. Toque em qualquer ponto do retângulo (não só em cima do texto) — deve abrir o planejamento na primeira tentativa.

### Resultado
parcial — aguarda gestor confirmar.

## 17ª tarefa (rodada 2) — Cockpit canônico do mockup — 2026-05-16

### Pedido (Flávio, complemento)
"Não, o cockpit do piloto não é esse não, o cockpit do piloto foi desenvolvido com você um mês atrás, está bem detalhado, eu quero a nossa tela que a gente fechou como cockpit piloto."

### Correção
Joguei fora o cockpit minimalista (volta + tempo) e troquei pelo **mockup canônico oficial** que foi fechado em 2026-05-15 (Vista Piloto versão 04).

### O que foi feito
1. Copiei o arquivo `mockup-command-box-vista-piloto.html` do ambiente isolado `vista-engenheiro` (302 KB, 7352 linhas) pra dentro do pacote do app, com nome `cockpit-piloto.html`.
2. Refiz a tela `StintCockpitView` pra carregar esse arquivo num navegador embutido (WKWebView). Ocupa a tela inteira.
3. Por cima do mockup, fica o botão grande **ENCERRAR STINT** e o "Cancelar (sem encerrar)".
4. Registrei o arquivo no pacote do app (project.pbxproj) — vai junto na instalação.

### O que continua nesta rodada (estático)
- O mockup tem todos os elementos visuais fechados (velocímetro premium, mapa da pista de Brasília com path id="track", marcação dos PAces, stint bar, painel do carro vivo com zonas dinâmicas, alertas críticos estilo shift-light wash branco, gauge de combustível, etc.) — TODOS estão lá visualmente.
- Os valores que aparecem são os DO PRÓPRIO MOCKUP (massa de teste já embutida).
- A captura dos dados continua rodando por trás normalmente (REC).

### Próxima rodada (ainda não feito)
- **Conexão dos dados ao vivo do iPhone → cockpit**: criar uma ponte JavaScript ↔ Swift (WKScriptMessageHandler) pra que o coordenador de captura publique velocidade, posição na pista, volta atual etc. dentro do navegador embutido, e o mockup pinte ao vivo em vez de mostrar a massa de teste.
- Antes disso o piloto vê o cockpit todo certinho mas com os números da simulação. Pra dado ao vivo, falta a ponte.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar
1. EVENTOS → toque um evento → toque "+ Novo stint" (ou no card de um carro).
2. Configure e toque "Iniciar stint".
3. Tela "Pronto pra começar" abre.
4. Escolha "Cockpit do piloto" → toque START.
5. Agora deve abrir EXATAMENTE o cockpit canônico que fechamos na semana passada: velocímetro premium, mapa de Brasília com trecho destacado, painel do carro, alertas, gauge de combustível, etc.
6. O botão "ENCERRAR STINT" fica visível por cima do cockpit, embaixo.

### Pendência
- Gestor confirmar visualmente que o cockpit canônico está abrindo.

## 17ª tarefa (rodada 1) — Tela START + cockpit do piloto — 2026-05-16

### Pedido (Flávio)
"Quando monta o Stint, você deve liberar uma tela para ele apertar o start do Stint e ele deve ter a opção de deixar só na tela de captura de dados e a transmissão da imagem ou deixar na tela do cockpit do piloto para o celular, também captando os dados todos."

Gestor escolheu (via card): "Cockpit completo do mockup" — entendendo que vem em várias rodadas.

### O que foi feito nesta rodada (rodada 1)
1. Nova tela **StintReadyView** ("Pronto pra começar"): aparece **depois** do "Iniciar stint" do planejamento e **antes** da captura. Tem dois cartões pra escolher a vista (Tela de dados ou Cockpit do piloto) e um botão grande START.
2. Nova tela **StintCockpitView**: vista alternativa pra mostrar pro piloto durante o stint. Nesta rodada mostra:
   - Indicador REC piscando.
   - Número da volta atual em fonte gigante.
   - Tempo decorrido do stint (mm:ss).
   - Última volta e melhor volta (em cartões).
   - Botão ENCERRAR STINT.
3. Fluxo no `EventoDetalheView`: criou `.readyStint`, `.cockpitAtivo` no enum. Depois do "Iniciar stint", abre StintReadyView → START → StintCaptureView (dados) OU StintCockpitView (cockpit). Os dois encerram igual: vão pra TriagemVideo → PosStint.
4. Arquivos novos registrados no projeto Xcode.

### O que NÃO entra nesta rodada (próximas)
- **Velocímetro ao vivo**: o iPhone hoje não publica velocidade em tempo real do processador Kalman. Precisa de uma alteração no processador pra emitir velocidade a cada amostra. Próxima rodada.
- **Mapa da pista com posição ao vivo**: precisa receber as coordenadas do processador + desenhar SVG da pista (Brasília) com bolinha animada.
- **Marcha** (gear): sem sinal hoje. Precisa OBD/T4000 ou dedução por RPM.
- **Delta vs melhor volta**: precisa que o detector publique tempo parcial por trecho.
- **Alertas críticos** (motor, câmbio, óleo, pneus, combustível): precisa que o telemetria publique cada sensor; hoje só temos IMU+GPS.
- **Gauge de combustível**: precisa de sensor / cálculo de consumo.
- **Stint bar comparativa**: precisa de histórico de melhor volta.

Cada um vira uma rodada separada.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone real.

### Como testar
1. EVENTOS → toque um evento → "+ Novo stint" (ou toque num carro).
2. Configure e toque "Iniciar stint" no planejamento.
3. Tem que abrir a tela "Pronto pra começar" com dois cartões: Tela de dados / Cockpit do piloto.
4. Toque "Cockpit do piloto" pra destacar esse cartão → toque o botão START.
5. Vai abrir o cockpit com volta gigante, tempo decorrido, REC.
6. Volte (cancelar sem encerrar). Refaça e desta vez escolha "Tela de dados" → vai pra vista antiga.

### Pendência
- Gestor confirmar visualmente.
- Decidir prioridade entre velocímetro, mapa, alertas, etc. pra próximas rodadas.

## 16ª tarefa — Padrão único pra todos os seletores — 2026-05-16

### Pedido (Flávio)
"As opções devem ser abertas sempre no mesmo padrão. Vamos usar esse padrão aqui [seletor de combustível em tela cheia]. Então, corrigem os demais. Aqui está do jeito, ali no próximo canto está diferente. Use o mesmo padrão e pode ser esse aqui que estamos vendo."

### Padrão escolhido
Tela cheia com:
- Cabeçalho (eyebrow + título + subtítulo de contexto).
- "CADASTRADOS · N" + lista de opções (cada uma é um cartão clicável, sem bolinha).
- "+ Cadastrar novo" no fim da lista (linha pontilhada).
- "Voltar" no rodapé.
- Toque na opção = seleciona e fecha.

### O que foi feito
- Criada `PilotoPickerView.swift` (novo arquivo) — seguindo exatamente o mesmo padrão do seletor de combustível.
- Suporta tanto "Piloto" (sem opção "Sem piloto") quanto "Convidado" (com opção "Sem convidado" no topo).
- Inclui o "+ Cadastrar novo piloto" no fim da lista; cadastrar abre o formulário e auto-escolhe o novo.
- Em `StintModalView`:
  - Removidos os dois menus suspensos antigos (Piloto e Convidado).
  - As barras agora abrem `PilotoPickerView` em tela cheia.
- Arquivo registrado no projeto Xcode.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar
1. EVENTOS → toque um evento → "+ Novo stint".
2. Toque a barra "Piloto" → abre a tela cheia no MESMO padrão do seletor de combustível.
3. Toque a barra "Convidado" → mesma tela cheia, com "Sem convidado" como primeira opção.
4. Em qualquer das duas, "Cadastrar novo piloto" no fim abre o formulário e auto-escolhe o novo ao salvar.

### Pendência
- Gestor confirmar visualmente.

## 15ª tarefa — Sem bolinhas (rádio) nos seletores — 2026-05-16

### Pedido (Flávio)
"No sistema como um todo, não quer que você clique botões que tenham bolinhas no botão, não tem necessidade, é um botão que eu clico nele e já seleciono. Ajusta isso o sistema todo."

### Princípio
Em qualquer seletor, NÃO usar bolinha de rádio do lado da opção. A opção inteira é o botão; tocar = seleciona; o estado escolhido aparece por destaque de fundo/borda, não por bolinha.

### O que foi feito
- Seletor de **combustível** (`CombustivelPickerView`): removida a bolinha à esquerda de cada tipo.
- Seletor de **pneu** (`PneuPickerView`): mesma remoção.

Eram os únicos dois lugares com bolinha de rádio no sistema (busca confirmou). Os outros seletores (pista, piloto, convidado, lição) já usavam menus suspensos do iOS, sem bolinha.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar
1. EVENTOS → toque um evento → "+ Novo stint".
2. Toque na barra "Combustível abastecido" → seletor abre **sem bolinhas** ao lado de "Etanol".
3. Mesma coisa em "Pneu montado".

### Pendência
- Gestor confirmar visualmente.

## 14ª tarefa — "Cadastrar novo" dentro do seletor — 2026-05-16

### Pedido (Flávio)
"No convidado, assim como nas demais funções, você pode escolher uma das opções ou adicionar uma nova daquela área. Em todo o sistema."

### Princípio cravado
Todo seletor de lista oferece duas coisas:
1. Escolher uma das opções existentes.
2. Cadastrar uma opção nova **dentro do próprio seletor**, sem precisar sair pra outra tela.

### O que foi feito
- Seletor de **Piloto** (no planejamento do stint): adicionada opção "Cadastrar novo piloto" no fim do menu. Toca → abre a tela de cadastro de piloto → ao salvar, o novo piloto é automaticamente escolhido como piloto do stint.
- Seletor de **Convidado** (mesma tela): adicionada a mesma opção, com o novo piloto sendo escolhido como convidado depois de salvar.

### O que já estava certo
- Seletor de **combustível** já tinha "+ Cadastrar outro tipo".
- Seletor de **pneu** já tinha cadastro embutido.
- Seletor de **pista** (no cadastrar evento) já permitia "Cadastrar novo autódromo".

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar
1. EVENTOS → toque um evento → "+ Novo stint".
2. Toque na barra de "Piloto" → menu deve mostrar os pilotos cadastrados + "Cadastrar novo piloto" no fim.
3. Toque "Cadastrar novo piloto" → tela de cadastro abre.
4. Preencha um nome e salve → volta pro planejamento já com o novo piloto escolhido.
5. Faça o mesmo no "Convidado".

### Pendência
- Gestor confirmar visualmente.

## 13ª tarefa — Selecionar é tocar (sem botão Confirmar) — 2026-05-16

### Pedido (Flávio)
"Quando você clicar em alguma opção, já seleciona, não precisa clicar nela e clicar no botão Confirmar. Ajusta isso em todo o sistema."

### Princípio cravado
- Em qualquer seletor de UMA opção (radio): tocar na opção = escolheu + fechou o seletor.
- O rodapé tem só "Voltar" (caso o usuário queira sair sem escolher).
- Não tem mais botão "Confirmar" separado.

### O que foi feito
- **Seletor de combustível** (`CombustivelPickerView`): tocar no tipo de combustível agora confirma e fecha. Botão "Confirmar" do rodapé removido. Rodapé só com "Voltar".
- **Seletor de pneu** (`PneuPickerView`): mesma mudança — tocar no pneu confirma e fecha. Rodapé só com "Voltar".

### O que já estava certo (verificado, sem mudança)
- **Seletor de pista** (cadastrar evento, `EscolherAutodromoSheet`): já era tocar pra escolher.
- **Seletores de Piloto / Convidado / Lição** no planejamento do stint: usam o menu suspenso nativo do iOS, que já fecha sozinho ao tocar.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar
1. EVENTOS → toque um evento → "+ Novo stint".
2. Em "Combustível abastecido", toque a barra → abre o seletor.
3. Toque em "Etanol" → deve fechar e voltar pro planejamento já com Etanol escolhido.
4. Em "Pneu montado", mesma coisa.

### Pendência
- Gestor confirmar visualmente.

## 12ª tarefa — Combustível só com tipo, sem litros — 2026-05-16

### Pedido (Flávio)
"Se esse 'L' em combustível abastecido é de litros, não precisa. A gente só usa litros, só precisa colocar o tipo de combustível mesmo."

### O que foi feito
- Removida a caixinha de quantidade em litros (`qtCombustivelField`) da linha "Combustível abastecido" no planejamento do stint.
- A linha agora mostra apenas o seletor de tipo (Etanol, Gasolina, etc.) ocupando largura total.
- Estado interno `qtCombustivelTexto` ficou no código mas nunca é mostrado/preenchido — o gravar do stint continua salvando vazio sem quebrar nada.

### Validação
- Empacotamento: ** BUILD SUCCEEDED **.
- App instalado e aberto no iPhone.

### Como testar
1. EVENTOS → toque um evento.
2. Toque "+ Novo stint" (ou toque num carro).
3. Na seção "Combustível abastecido (opcional)" só deve aparecer a barra do tipo — sem caixinha pequena de L do lado.

### Resultado
parcial — aguarda gestor confirmar.

### Arquivos alterados
- `rodada1-s1/ios/p1fast-ios/Sources/Persistence/EventoRepository.swift`
  - `create()` agora chama uma verificação no início.
  - Nova função `proximoEventoChocando(teamId:trackId:dias:)` que consulta o banco local procurando outro evento da mesma equipe + mesma pista + algum dia coincidente.
  - Função auxiliar `dataChoqueFormatada(ms:)` pra mostrar a data conflitante no formato dd/MM/yyyy.
- `rodada1-s1/ios/p1fast-ios/Sources/Views/EventoNovoFormView.swift`
  - `save()` agora reconhece erros de validação (domain `EventoRepository`) e mostra a mensagem sem o prefixo genérico "Não consegui salvar:".

### O que foi preservado
- Todo o fluxo de cadastro (calendário, dias, rótulo, tipo) continua igual.
- Eventos válidos (pista nova ou data nova) seguem sendo cadastrados normalmente.
- Eventos duplicados que já existem no banco não foram tocados.

### O que foi acrescentado
- Trava de duplicata pré-insert.
- Mensagem clara ao usuário quando cair na trava.

### Validação executada
- `xcodebuild ... build` → ** BUILD SUCCEEDED **
- `xcrun devicectl device install app` → App instalado no iPhone 16 Pro Max.
- `xcrun devicectl device process launch` → App aberto.

### Checagem contra o pedido original
- "Não permitir cadastramento de dois eventos iguais a mesma data" → travado: se já existe outro evento na mesma pista com algum dia coincidente, bloqueia com mensagem ✅.
- "mesmo piloto, mesmo usuário do aplicativo" → escopo = equipe atual (`TeamContext.currentTeamId`), que em desenvolvimento equivale a 1 usuário = 1 equipe ✅.

### Pendências ou riscos
- "Mesma pista + algum dia coincidente" pode ser restritivo demais se o gestor quiser permitir, por ex., treino livre de manhã e classificatória à tarde no mesmo dia. Se reclamar, posso afrouxar (ex.: deixar passar quando `tipo` for diferente).
- Os 3 eventos duplicados de 23 MAI já existentes continuam no banco — aguardam decisão do gestor sobre apagar.

---

## CHECKPOINT FINAL DO DIA — 2026-05-16 fim de tarde

Flávio vai limpar a conversa. Ponto de retomada salvo em:
- **Memória dedicada:** `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-checkpoint-cockpit-iphone-2026-05-16.md`
- **Índice MEMORY.md:** topo, com marcação ⏰⏰ (primeiro arquivo a ler ao receber "voltei").

**Próxima ação no retorno:** rodada A do cockpit do piloto. Trocar `rodada1-s1/ios/p1fast-ios/Resources/cockpit-piloto.html` pelo canônico SHA `408a5b1f…`, empacotar, instalar no iPhone, pedir visto visual do Flávio. Roteiro completo no checkpoint.

---

## Tarefa 2026-05-17 noite — Página de comparação do mapa de Brasília

### TASK_INIT
- **Pedido original (Flávio):** "Abro a sessão no meu browser e para eu ver" — execução dos próximos passos do checkpoint pré-clear da noite anterior (mapa do autódromo).
- **Objetivo (1 frase):** preservar o desenho oficial de Brasília como artefato base + criar página HTML com 4 versões do desenho lado a lado para você comparar e decidir qual filtro aplicar.
- **Confirmação de leitura:** ~/.claude/CLAUDE.md, MEMORY.md, checkpoint pré-clear noite 2026-05-17.
- **Ambiente alvo:** desenvolvimento. **Produção alterada:** não.
- **Arquivos inspecionados:** ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift (linhas 1-111).
- **Status inicial:** iniciado.

### TASK_DONE
- **Pedido original conferido:** sim.
- **Ambiente trabalhado:** desenvolvimento.
- **Produção foi alterada:** não.
- **Arquivos reais inspecionados:** sim (`SeedBrasilia.swift`).
- **Alterações feitas:** sim (2 arquivos novos, nenhum arquivo existente alterado).
- **Validação executada:** sim (página aberta no navegador via `open`, painel de preview confirmou visibilidade).
- **Resultado:** concluído.
- **Pendências reais:** aguardar decisão do Flávio entre as 4 versões.

### Arquivos criados
- `_design-reference/_history/brasilia-track-base/brasilia-track-v1-20260517.md` (artefato base congelado: path SVG oficial + viewBox + linha de chegada + 2 âncoras geográficas + 4 parciais + 12 trechos).
- `_design-reference/mapa-brasilia-comparacao-suavizacao.html` (4 versões lado a lado: bruto / filtro leve eps 1,5 / filtro agressivo eps 4 / ressampleamento a cada 8 px; seletor de região: Brasília inteira / Curva da Bruxa / Mergulho da Bruxa / Curva 01; toggle de vértices visíveis; apex da Bruxa marcado em rosa).

### O que foi preservado
- O aplicativo iOS no iPhone do Flávio não foi tocado (continua com o filtro leve já instalado).
- `SeedBrasilia.swift` não foi alterado.

### O que foi acrescentado
- Pasta nova `_design-reference/_history/brasilia-track-base/` com a versão de partida congelada.
- Página de comparação visual em `_design-reference/`.

### Pendências ou riscos
- Aguardando você ver a página e decidir entre: filtro leve atual / filtro agressivo / ressampleamento / refazer Brasília a partir de imagem de satélite.

---

## Tarefa 2026-05-17 noite (2ª parte) — Aplicar desenho corrigido no aplicativo

### TASK_INIT
- **Pedido original (Flávio):** colou o caminho SVG do desenho corrigido (425 pontos, ajustado manualmente na página de edição) e pediu "aplica isso no aplicativo" (mensagem "continue" depois de "feita").
- **Objetivo:** trocar o `svgPath` em `SeedBrasilia.swift` pelo novo desenho, empacotar e instalar no iPhone.
- **Ambiente:** desenvolvimento (`rodada1-s1`). Produção: NÃO tocada.

### TASK_DONE
- **Pedido conferido:** sim.
- **Arquivos inspecionados:** `rodada1-s1/ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift`.
- **Cópia de segurança:** `_design-reference/_history/brasilia-track-base/SeedBrasilia.swift.backup-v1-20260517` + `brasilia-track-v2-20260517-flavio-corrigido.md`.
- **Alteração:** linha 33 do `SeedBrasilia.swift` substituída pelo novo `svgPath` de 425 pontos.
- **Empacotamento (xcodebuild Debug iOS device):** `** BUILD SUCCEEDED **`.
- **Instalação:** `xcrun devicectl device install app` retornou `App installed` (bundleID `com.flaviomarques.p1fast`, container `18483BE6-C523-4773-8CCC-B11117017FFB`).
- **Abertura:** `xcrun devicectl device process launch` retornou `Launched application`.
- **Captura de tela:** FALHOU — `idevicescreenshot` e `idevicepair` retornaram "No device found". Pareamento do `libimobiledevice` provavelmente perdido. Não consegui validar visualmente.
- **Resultado:** parcialmente concluído — falta confirmação visual do Flávio.

### Arquivos alterados
- `rodada1-s1/ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift` (linha 33: svgPath substituído).

### O que foi preservado
- `SeedBrasilia.swift` original em `_history/brasilia-track-base/SeedBrasilia.swift.backup-v1-20260517`.
- Caixa de desenho, linha de chegada, âncoras GPS, parciais e lista de 12 trechos: sem alteração.

### Pendências reais
1. Flávio precisa abrir o aplicativo no iPhone (já está aberto) e confirmar se o desenho da pista (em especial a Curva da Bruxa) parece correto agora.
2. Captura de tela do iPhone bloqueada pelo problema de pareamento — a partir da próxima sessão, vale reparear (`idevicepair pair`) se quisermos voltar a tirar print remoto.

---

## Selo final 2026-05-17 23h15 — Pista oficial congelada (v2 Flávio)

### Confirmação do Flávio
"Use essa como padrão, mas não perca ela."

### Decisão
- Versão oficial e definitiva = **v2** (495 pontos arrumados manualmente pelo Flávio em 2026-05-17 noite, SEM suavização).
- v3 suavizada foi REJEITADA por criar degraus em vez de melhorar.
- Nenhum filtro automático pode ser aplicado por cima sem autorização explícita.

### Cópias salvas (5 lugares para garantia)
1. `ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift` (código vivo).
2. `_design-reference/_history/brasilia-track-base/SeedBrasilia.swift.backup-v2-20260517` (backup do arquivo Swift inteiro).
3. `ios/p1fast-core/Sources/P1FastCore/PISTA-OFICIAL-brasilia.txt` (texto puro perto do código).
4. `_design-reference/PISTA-OFICIAL-brasilia.txt` (texto puro na raiz dos mockups).
5. `_design-reference/_history/brasilia-track-base/PISTA-OFICIAL-brasilia-flavio-aprovado.txt` (texto puro no histórico).

### Documentação
- `_design-reference/_history/brasilia-track-base/PISTA-OFICIAL-LEIA-AQUI.md` — regra dura escrita.
- `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-pista-oficial-brasilia-NAO-SUAVIZAR.md` — memória pra sessões futuras.
- MEMORY.md atualizado com marcador 🔒🔒🔒 no topo.

### TASK_DONE final
- Pedido conferido: sim.
- Ambiente: desenvolvimento (rodada1-s1).
- Produção alterada: não.
- Validação: aplicativo reinstalado e aberto no iPhone com a v2.
- Resultado: concluído.
- Pendência: nenhuma relacionada à pista; aguardando próximos passos do Flávio (página de marcação E/S/A já está pronta, esperando ele preencher).

---

## Selo final 2026-05-17 23h30 — E/S/A aprovados + "Curva da Reta Oposta"

### Confirmação do Flávio
"ficou top."

### Decisão
- Posições E/S/A das 8 curvas aprovadas em definitivo.
- "Mergulho da Bruxa" (ordem 2) → renomeado para "Curva da Reta Oposta". O mergulho em si NÃO é trecho pedagógico.
- Curva "S" mantém os 2 ápices (ápice duplo).

### Alterações aplicadas
- `SeedBrasilia.swift`: nome do segmento ordem 2 atualizado + posição (x,y) de cada um dos 8 segmentos atualizada + 25 faixas E/S/A com coordenadas novas.
- `TrackRepository.swift`: passou a sempre re-sincronizar nome/parcial/ordem/ehTrecho/geometria do segmento + coordenadas das faixas (antes só inseria).
- Aplicativo empacotado, reinstalado e aberto no iPhone Pro Max.

### Resultado
- Concluído (aprovação visual do Flávio no iPhone).

---

## Tarefa 2026-05-17 madrugada — Planejamento da função "Manutenção"

### TASK_INIT
- **Pedido original (Flávio):** "crie um planejamento para a função de manutenção. Nós queremos gerenciar quando nós trocamos cada um dos itens com a data, o que foi colocado, filtro, óleo, fluido, suspensão, velas e outros itens. Para os itens, sempre coloca lá a foto, quando tira a foto você já lê e já insere os dados."
- **Objetivo (1 frase):** entregar documento de planejamento da função Manutenção, amarrando com Estoque/Carro/Pendências e com o pedido original de 2026-05-10.
- **Critérios de conclusão:** documento `docs/PLANO_MANUTENCAO.md` cobrindo escopo, lista de itens, tela, foto vira dado, periodicidade gerando pendência automática, blocos de execução, riscos e decisões pendentes em cards.
- **Confirmação de leitura:** `~/.claude/CLAUDE.md` ✓, `CLAUDE.md` do projeto ✓, MEMORY.md ✓, STATUS.md ✓, memória da função Peças/Estoque entregue 2026-05-17 ✓, audit-2026-05-10/respostas-flavio.json (pedido original sobre manutenção/periodicidade/especificação) ✓.
- **Ambiente:** desenvolvimento. **Produção alterada:** não.
- **Status inicial:** iniciado.

### TASK_DONE
- **Pedido original conferido:** sim.
- **Ambiente trabalhado:** desenvolvimento (worktree `infallible-snyder-198a08`).
- **Produção foi alterada:** não.
- **Autorização explícita registrada:** não se aplica (só documento de plano, sem código).
- **Arquivos reais inspecionados:** sim (`docs/audit-2026-05-10/respostas-flavio.json`, `STATUS.md`, memória do Estoque, lista de áreas de `PecaArea`, existência de `PendenciaRepository.swift`).
- **Alterações feitas:** 1 arquivo novo (`docs/PLANO_MANUTENCAO.md`).
- **Testes/validação executados:** não se aplica (documento). Estrutura interna do plano confere com convenções do projeto (PT-BR, sem jargão, integra com funções existentes, respeita ADRs).
- **Resultado:** concluído.
- **Pendências reais:**
  1. Flávio lê o plano e diz "fechado" (ou aponta correções).
  2. Após aprovação, abrir cards de decisão sequencialmente (6 cards listados na seção 12 do plano).
  3. Implementação só começa depois dos cards fechados.

### Arquivos criados
- `docs/PLANO_MANUTENCAO.md` (planejamento, ~250 linhas, 14 seções).

### O que foi preservado
- Plano mestre `docs/PLANO_FASE_1.md` segue como autoridade — o plano de Manutenção é função-específica e não disputa arquitetura.
- Estoque/Peças, Carro, Pendências, eventos: nada tocado, só descrito como ponto de integração.
- ADRs 1–25: nenhuma reaberta.

### O que foi acrescentado
- Documento de planejamento estruturado pronto pra decisão em cards.

### Checagem contra o pedido original
- "Gerenciar quando trocamos cada item com data" → seção 5 (data + km + horas + foto + observação).
- "Filtro, óleo, fluido, suspensão, velas e outros itens" → seção 4 (lista por 14 áreas) cobre todos.
- "Sempre coloca foto" → seção 7 (foto como entrada padrão, leitor do iPhone extrai e preenche).
- "Quando tira foto, já lê e já insere os dados" → seção 7 (Apple Vision como motor de extração, com fallback manual; fallback de nuvem deixado fora da versão inicial pra evitar custo recorrente).
- Plus do audit 2026-05-10: especificação padrão por carro (seção 6 sub-aba) + periodicidade vencida vira pendência automática (seção 8).

### Pendências ou riscos
- 6 decisões pendentes do gestor antes de implementar (seção 12 do plano).
- Modelo de visão na nuvem como fallback fica fora dessa versão pra não introduzir custo recorrente sem autorização.

---

## Auditoria 2026-05-17 (continuação) — Versão premium do plano de Manutenção

### TASK_INIT
- **Pedido (Flávio):** "audite suas idéias e soluções. quero uma solução super premium."
- **Objetivo:** apontar honestamente onde o plano v1 é mediano e propor versão premium.
- **Ambiente:** desenvolvimento. **Produção:** não tocada.

### TASK_DONE
- **Pedido conferido:** sim.
- **Alterações:** 1 arquivo novo (`docs/PLANO_MANUTENCAO_AUDIT.md`, auditoria + 9 saltos premium + cronograma de 8 blocos refeito).
- **15 pontos fracos auditados no v1**, 9 saltos premium propostos, 8 pontos não-negociáveis pra versão premium, 7 decisões pendentes refeitas.
- **Resultado:** concluído.
- **Pendências:** aguardar Flávio decidir quais saltos topa; se aprovar, reescrever `PLANO_MANUTENCAO.md` consolidando o premium e arquivar o v1.

### Diferença crítica entre v1 e premium
- v1 = caderno bonito de trocas.
- Premium = foto resolve tudo (3 camadas), painel "pronto pra pista" semáforo, periodicidade cruzada com telemetria de stint, plano pré-evento automático, custo financeiro embutido, pneu por nº de série já na v1, backup no iCloud pessoal, comando de voz pra emergência.

### Arquivos
- `docs/PLANO_MANUTENCAO.md` (v1, mediano — fica até Flávio aprovar reescrita).
- `docs/PLANO_MANUTENCAO_AUDIT.md` (auditoria + premium — esse documento).

---

## ARMADO 2026-05-18 madrugada — Gatilho "go" Manutenção noturna

### Pedido (Flávio)
"monte um plano de trabalho para eu dar um clear e eu vou usar o comando go para você ir no início ao fim e plantar enquanto eu vou dormir"

### Decisão tomada honestamente
9 sessões em uma noite seria mentira. Escopo noturno reduzido aos 4 blocos do MIOLO LÓGICO: Fundação (B1), Lançamento manual com foto simples (B2), Periodicidade que entende pista (B4), Inteligência aprendente (B5). ~5,5h estimadas. Outros 5 blocos (foto inteligente plena, painel "Pronto pra pista", pneu nº de série, plano pré-evento, backup iCloud) ficam pra revisão diurna porque dependem de chave de serviço pago ou de visto visual do Flávio.

### Artefatos criados
- `.claude-exec/PLANO_NOITE_MANUTENCAO_GO.md` — plano operacional detalhado (escopo · arquivos · critérios de sucesso · validação sem screenshot · plano de contingência · checklist de prontidão).
- `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-comando-go-manutencao-2026-05-18.md` — memória gatilho status ARMADO.
- `MEMORY.md` atualizado com selo 🟢🟢🟢 no topo apontando pro gatilho.

### Travas absolutas registradas
- NÃO tocar produção (Supabase oficial, Vercel, DNS, autenticação, integrações).
- NÃO subir as 3 tabelas novas pro servidor Supabase — banco fica só no iPhone (mesma regra do Estoque entregue 17/05).
- NÃO apagar dados existentes (Subaru, Bolinha, eventos, stints, peças do Estoque).
- NÃO alterar cockpit do piloto, mapa de Brasília v2 (495 pontos, regra dura), Estoque, qualquer função fora de Manutenção.
- NÃO pular hooks/validações.

### Como vou validar sem o gestor acordado (screenshot remoto quebrado)
1. Testes automáticos (`swift run p1fast-smoke`) precisam continuar verdes a cada bloco.
2. Empacotamento + instalação + abertura sem crash.
3. Banco local do iPhone puxado via `devicectl device copy from` e tabelas inspecionadas diretamente.

### Plano de contingência
Trava num bloco → paro nesse bloco, registro motivo, instalo o que tá pronto, salvo memória detalhada. Não chuto. Não desfaço trabalho dos blocos anteriores. Não apago nada.

### Como Flávio dispara
Depois do `/clear`, digitar simplesmente `go`. Memória gatilho + plano operacional fazem o resto.

### Estado
ARMADO. Aguardando `/clear` + `go`.

---

## Selo DEFINITIVO 2026-05-17 23h35 — Mapa de Brasília congelado como fonte de verdade

### Pedido textual de Flávio
"salva a versão deste mapa como definitiva para usarmos sempre que precisarmos"

### Resposta
- Criado `MAPA-BRASILIA-DEFINITIVO.json` consolidando TUDO em um único documento estruturado:
  - Metadados da pista (apelido, sentido, extensão, lap time, viewBox, linha de chegada, âncoras GPS).
  - Desenho SVG (495 pontos — apontamento para arquivo .txt).
  - 4 parciais (P1 a P4).
  - 12 segmentos (8 curvas pedagógicas + 4 retas) com nome, parcial, centroide, estratégia de ápice, tipo de curva, comprimento da reta seguinte e tempo na volta.
  - 25 marcações E/S/A (com posições decimais).
  - 2 marcos (largada e chegada).
  - Renomeação "MERGULHO DA BRUXA → CURVA DA RETA OPOSTA" explicitamente registrada.

### 3 cópias para segurança
1. `_design-reference/MAPA-BRASILIA-DEFINITIVO.json`
2. `_design-reference/_history/brasilia-track-base/MAPA-BRASILIA-DEFINITIVO.json`
3. `ios/p1fast-core/Sources/P1FastCore/MAPA-BRASILIA-DEFINITIVO.json`

### Documentação
- `_design-reference/_history/brasilia-track-base/PISTA-OFICIAL-LEIA-AQUI.md` atualizado com o selo "DEFINITIVO".
- Memória pessoal atualizada (`p1-fast-pista-oficial-brasilia-NAO-SUAVIZAR.md`).

### Resultado
- Concluído.
- Mapa pronto pra ser usado em qualquer parte do sistema sem risco de perda.
