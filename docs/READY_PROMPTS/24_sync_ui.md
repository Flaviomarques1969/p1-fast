# Prompt #24 — UI Sincronização (Sprint 1A.6 sub-D)

> Cole DEPOIS do #23 mergeado. Depende do `SyncCoordinator` injetado.
> **Último PR da Phase 1A.** Quando este mergear, Phase 1A 100% e parte 1B.

---

```
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #24 (Sprint 1A.6 sub-D — UI Sincronização)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-sync-ui feat/1A6-sync-ui`
- Branchar de `main` (após #23 mergeado)
- Editar arquivos no escopo, rodar build/smoke, commit, push, `gh pr create`
- Expandir API do `SyncCoordinator` se a do #23 não bater (commit pequeno separado neste mesmo PR)

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`
- Tocar transports (URLSessionSync/Pull/Telemetry — congelados em #23)
- Tocar Edge Functions
- Migrations / SQL

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
git log --oneline origin/main | head -5
# Esperado: ver "feat(1A6-C): URLSession transports... — Prompt #23"

ls ios/p1fast-ios/Sources/Sync/SyncCoordinator.swift
# Esperado: existe
```

## TAREFA

**Branch:** `feat/1A6-sync-ui`
**Base:** `main` (após #23 mergeado)

### Files a criar

- `ios/p1fast-ios/Sources/Views/SincronizacaoView.swift` — tela de status + dead-letter:
  - Header: "Sincronização" + status pill (Verde "Sincronizado" / Amarelo "Sincronizando..." / Vermelho "Offline" / Cinza "N pendentes")
  - Seção "Pendentes" — lista de items na sync_queue não-drainados (table_name + op + age)
  - Seção "Falhas" — lista de items dead-letter, com botão "Tentar de novo" individual
  - Botão "Sincronizar agora" no header (força drain manual)
  - Stat cards: "Última sync OK", "Próxima tentativa", "Items pendentes"

- `ios/p1fast-ios/Sources/Views/SyncStatusBadge.swift` — badge pra Home/header. Mostra:
  - 🟢 Verde dot — sincronizado e online
  - 🟡 Amarelo dot pulsando — sincronizando OU pending > 0
  - 🔴 Vermelho dot — offline OU dead-letter > 0
  - ⚪ Cinza dot — idle, queue vazia
  - Tap abre SincronizacaoView

### Files a editar

- `ios/p1fast-ios/Sources/Views/HomeView.swift` — adicionar `SyncStatusBadge` no canto superior direito do header.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — entrypoint pra SincronizacaoView (botão "Sincronização" no header da Home).
- (Se necessário) `ios/p1fast-ios/Sources/Sync/SyncCoordinator.swift` — expandir API se #23 não tinha tudo (vide spec abaixo).

### API esperada do SyncCoordinator

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

    func syncNow() async
    func retryItem(_ id: String) async
    func dropItem(_ id: String) async
}

enum SyncStatus: Equatable { case idle, syncing, offline, hasFailures }
```

Se a API atual do #23 não bate, **expandir lá** (commit separado neste PR).

### Decisões pré-baked

1. **Status visual**:
   - 🟢 Verde: queue vazia + reachable + última sync < 60s
   - 🟡 Amarelo: drain em andamento OU pending > 0 (sem falhas)
   - 🔴 Vermelho: offline OU dead-letter > 0
   - ⚪ Cinza: idle, queue vazia, sem evento recente

2. **Re-tentar dead-letter**: tap chama `retryItem(id)` — reseta `attempts=0` + re-enfileira.

3. **Limpar dead-letter**: swipe-to-delete com alert "Apagar definitivamente? Não dá pra desfazer." → `dropItem(id)`.

4. **Sem auto-refresh**: usar `@StateObject`/`@EnvironmentObject` observando coordinator. UI atualiza on-publish.

5. **Empty state explícito**: "Tudo sincronizado." quando vazia (princípio nunca-fabricar-dados).

### Verificação

```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build  # SUCCEEDED

# Smoke manual:
# 1. Desativar wifi do simulator → cadastrar piloto → badge VERMELHO, pending=1
# 2. Reativar wifi → drain dispara → badge VERDE, pending=0
# 3. Apontar URL pra inválida → ver dead-letter aparecer
# 4. Tap "Tentar de novo" → item volta pra pending
# 5. Swipe-to-delete em dead-letter → alert → confirma → some

git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved
# Esperado: vazio
```

### Screenshots em `/tmp/p1-sync-ui/`
- `home-badge-verde.png`
- `home-badge-amarelo.png`
- `home-badge-vermelho.png`
- `sync-view-pendentes.png`
- `sync-view-deadletter.png`
- `sync-view-tudo-ok.png`

### PR

**Title:** `feat(1A6-D): SincronizacaoView + SyncStatusBadge — Prompt #24`

**Body:**
```markdown
## Sprint 1A.6 — Sub-prompt D

### SyncStatusBadge
- Badge no header da Home, 4 estados visuais
- Tap abre SincronizacaoView

### SincronizacaoView
- Status pill + 3 stat cards
- Seção Pendentes (sync_queue not-drained)
- Seção Falhas (dead-letter) com botão "Tentar de novo" individual
- Swipe-to-delete em dead-letter (com confirmação)
- Botão "Sincronizar agora"
- Empty state explícito

### SyncCoordinator API
- (Se expandida) novos @Published + retryItem/dropItem

### Verificação
- swift-smoke: 158/0
- xcodebuild: SUCCEEDED
- Smoke manual: 5 cenários (offline → online → falha → retry → drop)
- Package.resolved intacto

### 🎉 Phase 1A 100% completa após este merge
- Próximo: Sprint 1B (cockpit ao vivo) — destravar 5 decisões abertas em SPRINT_1B_COCKPIT_DESIGN.md
```

### Comando final
`gh pr create --title "..." --body "..."` — terminar com o link.
```
