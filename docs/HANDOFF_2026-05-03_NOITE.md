<!-- TODO [CLAUDE 2026-05-26 noite] obsoleto — confirmar com Flávio -->
# Handoff — sessão 2026-05-03 noite (pré-/clear)

> Doc específico pra próxima sessão Claude após `/clear`.
> **Próxima Claude: leia este arquivo PRIMEIRO**, depois `STATUS.md`,
> depois `~/.claude/projects/-Users-imac/memory/MEMORY.md`.

## TL;DR

- **Phase 1A.5 fechada.** 7 PRs mergeados na sessão (#16/#17 antes; #18-#22 hoje).
- **Sprint 1A.6 em flight:** PR #23 (HTTP transport) com 4 arquivos criados em worktree `../p1-fast-sync-transport`, **build NÃO verificado, NÃO commitado, NÃO pushado**.
- **#24 SyncView** ainda não começou (último PR pra Phase 1A 100%).
- 2 PRs pra fechar Phase 1A.

## Estado dos PRs mergeados nesta sessão

| PR | Sprint | Sha | UTC | Conteúdo |
|---|---|---|---|---|
| #47 | 1A.4 #16 | c5a5434 | 19:23 | schema v2 columns + alias cleanup |
| #48 | 1A.4 #17 | 361e101 | 20:36 | stint selectors (pneu + combust) |
| #49 | 1A.4 #18 | cc855f1 | 20:56 | pessoas v2 forms (altura/peso/nascimento) |
| #50 | 1A.5 #19 | 33f7e2a | 21:12 | trechos da pista |
| #52 | 1A.5 #20 | d84db5d | 21:25 | catálogo de lições (12) |
| #53 | 1A.5 #21 | b2c70be | 21:39 | pendências cascata (45 itens em 6 grupos) |
| #54 | 1A.5 #22 | 2f79d9d | 21:47 | setup avançado dedicado |

**Migrations aplicadas em prod Supabase** (project ref `fvhwltzhytpnhlqbttmd`):
- `0004_licoes.sql` ✅ aplicada
- `0005_pendencias.sql` ✅ aplicada
- `0006_v2_schema_columns.sql` ✅ aplicada (de #16)

## ⚠ Sprint 1A.6 #23 EM FLIGHT — STATE NÃO COMMITADO

**Worktree:** `/Users/imac/Projetos/p1-fast-sync-transport` (branch `feat/1A6-http-transport`, baseado em `origin/main` que está em `2f79d9d`).

**Arquivos criados (não commitados):**
- `ios/p1fast-ios/Sources/Sync/Configuration.swift` (~30 LOC) — lê SUPABASE_URL + SUPABASE_ANON_KEY do Info.plist
- `ios/p1fast-ios/Sources/Sync/Reachability.swift` (~40 LOC) — wrapper @Published do NWPathMonitor
- `ios/p1fast-ios/Sources/Sync/URLSessionTransports.swift` (~190 LOC) — 3 implementações HTTP dos protocols sync/pull/telemetry + helper SupabaseHTTP + TransportError enum
- `ios/p1fast-ios/Sources/Sync/SyncCoordinator.swift` (~170 LOC) — orquestra 3 drainers, timer + reachability, @Published status pra UI

**Sinais HTTP/auth:** anon key em header `apikey` + `Authorization: Bearer ${anon_key}`. Endpoints: `${SUPABASE_URL}/functions/v1/{sync,pull,ingest}`.

**Pré-requisito de runtime:** `.env.xcconfig` populado (já existe em main com creds reais — gitignored). Sem ele, app sobe mas Configuration.isConfigured == false e coordinator entra em status `.notConfigured`.

### O que falta pra fechar #23 (próxima sessão)

1. **Verificar build:**
   ```bash
   cd /Users/imac/Projetos/p1-fast-sync-transport
   xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios \
     -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build 2>&1 | grep -E "error:|BUILD "
   ```
   Esperado: erros de compilação (signatures dos drainers podem estar erradas — eu confirmei `SyncDrainer.drainBatch`, `PullExecutor.runOnce(queue, tables:, transport:)`, `TelemetryUploader.upload(queue, transport:)` mas não testei com xcodebuild ainda).

2. **Criar `.env.xcconfig.example`** (gitignored real `.env.xcconfig` continua intacto):
   ```
   SUPABASE_URL = https:/$()/SEU-PROJETO.supabase.co
   SUPABASE_ANON_KEY = SUA_CHAVE_AQUI
   DAILY_API_KEY = REPLACE_ME
   ```
   Path: `ios/p1fast-ios/.env.xcconfig.example`. Confirmar que `.env.xcconfig` (sem `.example`) está em `.gitignore`.

3. **Wire SyncCoordinator no ContentView:**
   - Adicionar `@StateObject private var reachability: Reachability` e `@StateObject private var syncCoordinator: SyncCoordinator` no `ReadyRoot`
   - Init: `_reachability = StateObject(wrappedValue: Reachability())` e `_syncCoordinator = StateObject(wrappedValue: SyncCoordinator(queue: queue, reachability: reachability))` — atenção que `reachability` é @MainActor, talvez precise de `await MainActor.run { ... }` ou inicialização via `init()` direta.
   - `.environmentObject(syncCoordinator)` na view chain.

4. **Registrar no `project.pbxproj`:** 4 arquivos novos (Configuration, Reachability, URLSessionTransports, SyncCoordinator). IDs sugeridos seguindo padrão E1A2B3C4D5E6F70819203B41/43/45/47 + B40/42/44/46. Adicionar:
   - 4 entradas em `PBXBuildFile`
   - 4 entradas em `PBXFileReference`
   - Pasta nova "Sync" no group `Sources` (criar PBXGroup) OU adicionar diretamente ao group `Views` se quiser evitar criar group novo
   - 4 entradas em `PBXSourcesBuildPhase.files`

5. **Smoke + build verification** (158/0 + BUILD SUCCEEDED).

6. **Commit:** `git reset --soft origin/main && git commit -m "..."` em UM bash call (race com autosave).

7. **Push + PR:** `gh pr create --title "feat(1A6-C): URLSession transports + SyncCoordinator — Prompt #23"`.

8. **Audit + merge** quando CI verde (autorização contínua, vide memória `feedback_deploy_rules.md`).

9. **Cleanup worktree:** `git worktree remove ../p1-fast-sync-transport --force`.

### Depois do #23, dispatch do #24

Prompt ready em `docs/READY_PROMPTS/24_sync_ui.md`. Cria `SincronizacaoView` + `SyncStatusBadge`. Edita `HomeView` pra mostrar badge no canto. Talvez precise estender API do `SyncCoordinator` (já criei `pendingCount`/`deadLetterCount`/`status`/`syncNow()`/`pullNow()` — falta `retryItem(_:)` e `dropItem(_:)` se #24 quiser).

Quando #24 mergear → **Phase 1A 100% completa**.

## Memórias críticas (no MEMORY.md, mas reforçando)

- **Cloud Code é sequencial** — UMA sessão por vez. Não propor dispatch paralelo.
- **Coordenação Cloud Code** — após cada merge, entregar bloco copiável do próximo prompt na MESMA mensagem (não apontar pra arquivo).
- **Claude executa direto** — Flávio autorizou que Claude rode prompts no terminal direto (ao invés de Cloud Code). Sequência: worktree → edit → smoke → squash autosaves → commit → push → PR. SEMPRE branchar e diffar de `origin/main`.
- **P1 Fast: autorização contínua pra mergear PRs auditados verdes em main** (não pedir autorização). Audit ainda obrigatório.
- **Aplicar migration em prod** TAMBÉM autorizado.
- **Graceful degradation** — toda feature opcional (dyno, ECU, etc.) precisa fallback. App funciona sem nada opcional.
- **Tiers de arquitetura** — Tier 0 só celular (iPhone V1, Android futuro). Tiers 1-3 incrementais (dyno → ECU Injepro → datalogger).

## Comando de retomada (Flávio cola após `/clear`)

```
Lê docs/HANDOFF_2026-05-03_NOITE.md primeiro. Depois retoma o PR #23 que parou no item 1 (verificar build no worktree ../p1-fast-sync-transport). Não pede autorização pra mergear (memória feedback_deploy_rules diz que P1 Fast tem autorização contínua). Depois do #23 mergear, executa #24 direto e fecha Phase 1A.
```

## Scripts úteis pra retomar rápido

```bash
# Estado dos PRs no GitHub
cd "/Users/imac/Projetos/P1 Fast"
gh pr list --state open --json number,title,mergeStateStatus

# Estado de worktrees locais
git worktree list

# Pull main local
git fetch origin main

# Migrations aplicadas em prod (REST: tabelas existem se retornar [])
curl -s -H "apikey: $ANON_KEY" "https://fvhwltzhytpnhlqbttmd.supabase.co/rest/v1/licoes?limit=1" | head -c 200
curl -s -H "apikey: $ANON_KEY" "https://fvhwltzhytpnhlqbttmd.supabase.co/rest/v1/pendencias_template?limit=1" | head -c 200
```

Anon key e password Supabase: ver `~/.claude/projects/-Users-imac/memory/feedback_deploy_rules.md` ou `ios/p1fast-ios/.env.xcconfig` (gitignored).
