# Sprint 1A.6 — Prompts finais (C + D)

> Design completo em `docs/SPRINT_1A6_SYNC_DRAINER_DESIGN.md` (227 linhas).
> Status real do sprint: **5 de 7 sub-prompts já entregues** (A=Edge `sync`,
> B=SyncDrainer core, E=Pull, BackoffPolicy, TelemetryUploader). Restam só
> sub-prompts **C (HTTP transport)** e **D (UI Sincronização)**.
>
> Este doc tem os 2 prompts autônomos prontos pra disparar.

## Pré-requisito GLOBAL pros 2 prompts

Você (Flávio) precisa fornecer ao Cloud Code antes de qualquer um dos 2:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_PROJECT_REF=xxxxx
```

E ter:
- ✅ Projeto Supabase real criado
- ✅ Migrations 0001 + 0002 + 0003a + 0003b aplicadas (depois de 1A.5)
- ✅ 1 user via Supabase Auth + 1 time via `create_team` RPC

Sem esses 3, o smoke E2E não roda — só com mocks (que já estão nos sub-prompts B/E).

---

# Prompt #23 — Sub-prompt C — HTTP Transport + Reachability

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #23 (Sprint 1A.6 — sub-prompt C)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-sync-transport feat/1A6-http-transport`
- Branchar de `main` (após Sprint 1A.5 fechado)
- Editar arquivos no escopo, rodar build/smoke, commit, push, `gh pr create`
- Adicionar `.env.xcconfig` ao `.gitignore` se ainda não estiver

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`
- Commitar `.env.xcconfig` com creds reais (deve ficar gitignored)
- Tocar Edge Functions (`supabase/functions/`) — já estão prontas

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
git log --oneline origin/main | head -5
# Confirmar que Sprint 1A.5 mergeou (#19, #20, #21, #22)

# Confirmar SyncDrainer + PullExecutor existem em p1fast-core
ls ios/p1fast-core/Sources/P1FastCore/Persistence/SyncDrainer.swift
ls ios/p1fast-core/Sources/P1FastCore/Persistence/PullExecutor.swift
ls ios/p1fast-core/Sources/P1FastCore/Persistence/TelemetryUploader.swift
# Esperado: 3 arquivos existem
```

## TAREFA

**Branch:** `feat/1A6-http-transport`
**Base:** `main` (após Sprint 1A.5)

### Files a criar

- `ios/p1fast-ios/Sources/Sync/URLSessionSyncTransport.swift` — implementa `SyncTransport` (protocol em p1fast-core) usando URLSession. Auth via JWT do Supabase Auth (header `Authorization: Bearer {jwt}`). Endpoint: `{SUPABASE_URL}/functions/v1/sync`.
- `ios/p1fast-ios/Sources/Sync/URLSessionPullTransport.swift` — implementa `PullTransport` (protocol em p1fast-core). Endpoint: `{SUPABASE_URL}/functions/v1/pull`.
- `ios/p1fast-ios/Sources/Sync/URLSessionTelemetryTransport.swift` — implementa transport pra `TelemetryUploader`. Endpoint: `{SUPABASE_URL}/functions/v1/ingest`.
- `ios/p1fast-ios/Sources/Sync/Reachability.swift` — wrapper `NWPathMonitor` com `@Published var isReachable: Bool`.
- `ios/p1fast-ios/Sources/Sync/SyncCoordinator.swift` — orquestra os 3 drainers (sync + pull + telemetry). Acordado por:
  - Timer fixo (30s)
  - Reachability change (offline → online)
  - Trigger explícito após mutation (chamado por repos via NotificationCenter ou observação)
- `ios/p1fast-ios/Sources/Configuration.swift` — lê `SUPABASE_URL` + `SUPABASE_ANON_KEY` de `Info.plist` (que vem do `.env.xcconfig`).
- `ios/p1fast-ios/.env.xcconfig.example` — template (sem creds reais).

### Files a editar

- `ios/p1fast-ios/p1fast-ios/Info.plist` — adicionar `SUPABASE_URL = $(SUPABASE_URL)` e `SUPABASE_ANON_KEY = $(SUPABASE_ANON_KEY)`.
- `ios/p1fast-ios/.gitignore` — confirmar `.env.xcconfig` está listado. Se não estiver, adicionar.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — instanciar `SyncCoordinator` no boot, injetar como `@EnvironmentObject` na hierarchy.
- `ios/p1fast-ios/p1fast-ios.xcodeproj/project.pbxproj` — adicionar referência ao `.env.xcconfig` como Build Configuration File (Debug + Release).

### Files a NÃO tocar

- `p1fast-core/Persistence/SyncDrainer.swift` (lógica pura, não deve mudar)
- `p1fast-core/Persistence/PullExecutor.swift` (lógica pura)
- `p1fast-core/Persistence/TelemetryUploader.swift` (lógica pura)
- Edge Functions
- Repositories existentes (sem mudança)

### Decisões pré-baked

1. **Auth simplificada V1**: usuário insere SUPABASE_URL + ANON_KEY em `.env.xcconfig`. JWT vem do `supabase.auth.signIn` (futuramente — V1 usa só anon key, RLS ainda não bloqueia). Documentar no PR.

2. **Cadência de drains**:
   - sync (mutations) — a cada 30s + on reachability change + on mutation
   - pull (catch-up) — só no boot do app + a cada 5min se idle
   - telemetry — a cada 60s + on stint termina

3. **Backoff já implementado** (`BackoffPolicy.swift`) — usar conforme.

4. **Erro silencioso V1**: se sync falhar, log + retry. Sem alert UI nesse PR (UI vem no #24).

5. **Single user / single time** (V1): hardcoded em `local-default-team` no source. Quando autenticação real entrar, trocar.

### Verificação

```bash
cd ios/p1fast-core && swift run p1fast-smoke
# Esperado: 158/0 (smoke não testa transport real, só mocks)

xcodebuild ... build
# Esperado: BUILD SUCCEEDED com .env.xcconfig presente

# Smoke E2E manual (com creds reais em .env.xcconfig):
# 1. Cadastrar 1 piloto pelo simulator
# 2. Aguardar 30s
# 3. Conferir no Supabase: SELECT * FROM pilotos WHERE time_id='local-default-team';
# Esperado: row apareceu

# Verificar .env.xcconfig NÃO foi commitado:
git ls-files | grep "\.env\.xcconfig$"
# Esperado: vazio (só o .example deve aparecer)

# Package.resolved intacto
git diff main -- ios/p1fast-core/Package.resolved
```

### Screenshots em `/tmp/p1-sync/`
- `app-boot-coordinator.png` — console log mostrando "SyncCoordinator started"
- `network-online-trigger.png` — log de drain disparado por reachability
- `mutation-trigger.png` — log de drain após cadastro

### PR title

```
feat(1A6-C): URLSession transports + Reachability + SyncCoordinator — Prompt #23
```
````

---

# Prompt #24 — Sub-prompt D — UI Sincronização

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #24 (Sprint 1A.6 — sub-prompt D)

## CONTRATO DE EXECUÇÃO
[mesmo de #23]

**blockedBy:** #23 (precisa do `SyncCoordinator` injetado)

## TAREFA

**Branch:** `feat/1A6-sync-ui`
**Base:** `main` (após #23 mergeado)

### Files a criar

- `ios/p1fast-ios/Sources/Views/SincronizacaoView.swift` — tela de status + dead-letter:
  - Header: "Sincronização" + status pill (Verde "Sincronizado" / Amarelo "Sincronizando..." / Vermelho "Offline" / Cinza "N pendentes")
  - Seção "Pendentes" — lista de items na sync_queue não-drainados (table_name + op + age)
  - Seção "Falhas" — lista de items com `attempts >= maxAttempts` (dead-letter), com botão "Tentar de novo" individual
  - Botão "Sincronizar agora" no header (força drain manual)
  - Stat cards: "Última sync OK", "Próxima tentativa", "Items pendentes"

- `ios/p1fast-ios/Sources/Views/SyncStatusBadge.swift` — pequena badge pra Home/header. Mostra:
  - Verde dot quando sincronizado e online
  - Amarelo dot pulsando quando sincronizando
  - Vermelho dot quando offline ou falhas
  - Tap abre SincronizacaoView

### Files a editar

- `ios/p1fast-ios/Sources/Views/HomeView.swift` — adicionar `SyncStatusBadge` no canto superior direito do header.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — adicionar entrypoint pra SincronizacaoView (sub-tab dentro de "Cadastros" OU botão dedicado em "Configurações"). Decisão pré-baked: **botão "Sincronização" no header da Home** (acesso rápido + badge visual).

### Files a NÃO tocar

- `SyncCoordinator.swift` (já foi entregue em #23)
- Transports
- Repositories
- Edge Functions
- Migrations

### Decisões pré-baked

1. **Status visual**:
   - 🟢 Verde: queue vazia + reachable + última sync < 60s
   - 🟡 Amarelo: drain em andamento OU pending > 0 (mas sem falhas)
   - 🔴 Vermelho: offline OU dead-letter > 0
   - ⚪ Cinza: idle, queue vazia, sem evento recente

2. **Re-tentar dead-letter**: tap no botão chama `SyncCoordinator.retryItem(id)` que reseta `attempts=0` + `last_error=NULL` e re-enfileira.

3. **Limpar dead-letter**: swipe-to-delete em items dead-letter (com confirmação alert "Apagar definitivamente? Não dá pra desfazer."). Chama `SyncCoordinator.dropItem(id)`.

4. **Sem auto-refresh**: usar `@StateObject` observando o coordinator. UI atualiza on-publish.

5. **Empty state explícito**: "Tudo sincronizado." quando vazia (princípio nunca-fabricar-dados).

### API esperada do SyncCoordinator (extender o de #23)

```swift
@MainActor
final class SyncCoordinator: ObservableObject {
    @Published private(set) var status: SyncStatus = .idle
    @Published private(set) var pendingCount: Int = 0
    @Published private(set) var deadLetterCount: Int = 0
    @Published private(set) var lastSuccessAt: Date?
    @Published private(set) var nextAttemptAt: Date?
    @Published private(set) var pendingItems: [SyncQueueItem] = []
    @Published private(set) var deadLetterItems: [SyncQueueItem] = []

    func syncNow() async  // força drain
    func retryItem(_ id: String) async
    func dropItem(_ id: String) async
}

enum SyncStatus: Equatable {
    case idle
    case syncing
    case offline
    case hasFailures
}
```

Se a API atual do #23 não bate, **expandir lá** (commit pequeno separado neste mesmo PR).

### Verificação

```bash
cd ios/p1fast-core && swift run p1fast-smoke
xcodebuild ... build

# Smoke manual:
# 1. Desativar wifi do simulator
# 2. Cadastrar 1 piloto → status badge fica vermelho, pending=1
# 3. Reativar wifi → drain dispara, badge fica verde, pending=0
# 4. Forçar erro (apontar URL pra inválida temporariamente) → ver dead-letter
# 5. Tap "Tentar de novo" → item volta pra pending

git diff main -- ios/p1fast-core/Package.resolved
```

### Screenshots em `/tmp/p1-sync-ui/`
- `home-badge-verde.png` — Home com badge verde
- `home-badge-amarelo.png` — drain em andamento
- `home-badge-vermelho.png` — offline
- `sync-view-pendentes.png` — lista de pendentes
- `sync-view-deadletter.png` — dead-letter com botão re-tentar
- `sync-view-tudo-ok.png` — empty state

### PR title

```
feat(1A6-D): SincronizacaoView + SyncStatusBadge — Prompt #24
```

`gh pr create ...` — terminar com link.
````

---

## Sequência ótima

```
Pré-requisito (você): criar projeto Supabase + aplicar migrations 0001-0003b
                     + cadastrar 1 user + 1 time + colocar creds em .env.xcconfig

Disparar #23 → após merge → disparar #24 → após merge → Sprint 1A.6 fechado
                                         → Phase 1A 100% completa
                                         → pronto pra Sprint 1B (cockpit ao vivo)
```

Estimativa: 2 PRs daqui pra Phase 1A 100%. Sem dependência cruzada além do #23 vir antes do #24.
