# Prompt #23 — HTTP transports + Reachability + SyncCoordinator (Sprint 1A.6 sub-C)

> Cole DEPOIS de Sprint 1A.5 fechado (#19 + #20 + #21 + #22).
> **Pré-requisito Flávio (manual antes do build):** popular `.env.xcconfig` com creds reais
> do Supabase prod. Project ref `fvhwltzhytpnhlqbttmd`, vide HANDOFF.

---

```
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #23 (Sprint 1A.6 sub-C — HTTP transport)

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
- **Commitar `.env.xcconfig` com creds reais** — apenas o `.example`
- Tocar Edge Functions (`supabase/functions/`) — já estão prontas (sub-prompt A entregue)
- Tocar SyncDrainer/PullExecutor/TelemetryUploader em p1fast-core — lógica pura, congelada

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
git log --oneline origin/main | head -10
# Esperado: ver merges Sprint 1A.5 (#19-#22)

ls ios/p1fast-core/Sources/P1FastCore/Persistence/SyncDrainer.swift \
   ios/p1fast-core/Sources/P1FastCore/Persistence/PullExecutor.swift \
   ios/p1fast-core/Sources/P1FastCore/Persistence/TelemetryUploader.swift
# Esperado: 3 arquivos existem
```

## TAREFA

**Branch:** `feat/1A6-http-transport`
**Base:** `main` (após Sprint 1A.5)

### Files a criar

- `ios/p1fast-ios/Sources/Sync/URLSessionSyncTransport.swift` — implementa `SyncTransport` (protocol em p1fast-core) usando URLSession. Auth: header `Authorization: Bearer {anon-or-jwt}`. Endpoint: `{SUPABASE_URL}/functions/v1/sync`.
- `ios/p1fast-ios/Sources/Sync/URLSessionPullTransport.swift` — implementa `PullTransport`. Endpoint: `{SUPABASE_URL}/functions/v1/pull`.
- `ios/p1fast-ios/Sources/Sync/URLSessionTelemetryTransport.swift` — transport pra `TelemetryUploader`. Endpoint: `{SUPABASE_URL}/functions/v1/ingest`.
- `ios/p1fast-ios/Sources/Sync/Reachability.swift` — wrapper `NWPathMonitor` com `@Published var isReachable: Bool`.
- `ios/p1fast-ios/Sources/Sync/SyncCoordinator.swift` — orquestra os 3 drainers (sync + pull + telemetry). Acordado por:
  - Timer fixo (30s)
  - Reachability change (offline → online)
  - Trigger explícito após mutation (NotificationCenter ou observação)
- `ios/p1fast-ios/Sources/Configuration.swift` — lê `SUPABASE_URL` + `SUPABASE_ANON_KEY` de `Bundle.main.object(forInfoDictionaryKey:)`.
- `ios/p1fast-ios/.env.xcconfig.example` — template (placeholders, sem creds reais).

### Files a editar

- `ios/p1fast-ios/p1fast-ios/Info.plist` — adicionar `SUPABASE_URL = $(SUPABASE_URL)` e `SUPABASE_ANON_KEY = $(SUPABASE_ANON_KEY)`.
- `ios/p1fast-ios/.gitignore` — confirmar `.env.xcconfig` listado. Se não estiver, adicionar.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — instanciar `SyncCoordinator` no boot, injetar como `@EnvironmentObject` na hierarchy.
- `ios/p1fast-ios/p1fast-ios.xcodeproj/project.pbxproj` — adicionar referência ao `.env.xcconfig` como Build Configuration File (Debug + Release).

### Decisões pré-baked

1. **Auth simplificada V1**: usuário insere SUPABASE_URL + ANON_KEY em `.env.xcconfig`. JWT real via `supabase.auth.signIn` fica pra Sprint posterior. V1 usa só anon key (RLS ainda não bloqueia).

2. **Cadência de drains**:
   - sync (mutations) — 30s + reachability change + on mutation
   - pull (catch-up) — boot + 5min idle
   - telemetry — 60s + on stint termina

3. **Backoff já implementado** (`BackoffPolicy.swift`) — usar conforme.

4. **Erro silencioso V1**: log + retry. Sem alert UI nesse PR (UI vem em #24).

5. **Single user / single time** (V1): hardcoded `local-default-team`.

### Verificação obrigatória

```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0 (mocks, não toca transport real)
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build  # SUCCEEDED com .env.xcconfig presente

# Smoke E2E manual (com creds reais em .env.xcconfig):
# 1. Cadastrar 1 piloto pelo simulator
# 2. Aguardar 30s
# 3. Conferir no Supabase REST:
curl -H "apikey: $SUPABASE_ANON_KEY" \
  "${SUPABASE_URL}/rest/v1/pilotos?select=*&order=created_at.desc&limit=1"
# Esperado: row recém-criada

# .env.xcconfig real NÃO commitado:
git ls-files | grep "\.env\.xcconfig$"
# Esperado: vazio (só .example)

git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved
# Esperado: vazio
```

### Screenshots em `/tmp/p1-sync/`
- `app-boot-coordinator.png`
- `network-online-trigger.png`
- `mutation-trigger.png`

### PR

**Title:** `feat(1A6-C): URLSession transports + Reachability + SyncCoordinator — Prompt #23`

**Body:**
```markdown
## Sprint 1A.6 — Sub-prompt C

### Transports
- URLSessionSyncTransport / PullTransport / TelemetryTransport
- Conformam aos protocols em p1fast-core (sem duplicar lógica)

### SyncCoordinator
- Orquestra 3 drainers (sync 30s, pull boot+5min, telemetry 60s)
- Acordado por timer + reachability + mutation
- Backoff via BackoffPolicy existente
- Erro silencioso V1 (log + retry)

### Configuração
- Configuration.swift lê SUPABASE_URL + SUPABASE_ANON_KEY do Info.plist
- .env.xcconfig gitignored, .example versionado
- Build SUCCEEDED com creds vazias (degrada graciosamente)

### Verificação
- swift-smoke: 158/0
- xcodebuild: SUCCEEDED
- Smoke E2E manual: piloto cadastrado aparece no Supabase em <30s
- .env.xcconfig real NÃO commitado
- Package.resolved intacto

### Out-of-scope (próximo PR)
- UI de status + dead-letter → #24
```

### Comando final
`gh pr create --title "..." --body "..."` — terminar com o link.
```
