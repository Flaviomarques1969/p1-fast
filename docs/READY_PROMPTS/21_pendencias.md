# Prompt #21 — Pendências cascata (Sprint 1A.5)

> Cole DEPOIS de Sprint 1A.4 fechado. Paralelizável com #20.
> Cria migration nova: `supabase/migrations/0005_pendencias.sql` + GRDB `v5_pendencias`.
> Template SQL pré-baked em `docs/_templates/0005_pendencias.sql` — Cloud Code pode copiar.

---

```
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #21 (Sprint 1A.5 — pendências)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-pendencias feat/1A5-pendencias`
- Branchar de `main` (após Sprint 1A.4 fechado)
- Editar arquivos no escopo, rodar build/smoke/sqlite, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- **Aplicar migration em prod Supabase** — não rodar `supabase db push`/`supabase link`
- Tocar arquivos fora do escopo

### ⚠️ Convenção de nome

- **Migration GRDB**: registrar como `"v5_pendencias"` no `register(into:)`. Ordem de registro relativo a `v4_licoes` não importa pra esquemas isolados.
- **Migration Postgres**: arquivo `supabase/migrations/0005_pendencias.sql`.

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
git log --oneline origin/main | head -10
# Esperado: ver merges Sprint 1A.4. Se não, ABORTAR.
```

## TAREFA

**Branch:** `feat/1A5-pendencias` (worktree `../p1-fast-pendencias`)
**Base:** `main` (após Sprint 1A.4)

### Files a criar

- `ios/p1fast-ios/Sources/Views/PendenciasView.swift` — checklist cascata por evento. Reusar visual de `_design-reference/mockup-pendencias-cascata.html`.
- `ios/p1fast-ios/Sources/Persistence/PendenciaRepository.swift` — CRUD: seed templates + criar instâncias por evento + toggle checado.
- `supabase/migrations/0005_pendencias.sql` — copiar template de `docs/_templates/0005_pendencias.sql` SEM alteração.

### Files a editar

- `ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift` — dentro de `register(into:)`, ADICIONAR `m.registerMigration("v5_pendencias")`:
  ```swift
  m.registerMigration("v5_pendencias") { db in
      try db.execute(sql: """
          CREATE TABLE pendencias_template (
              id TEXT PRIMARY KEY,
              grupo_id TEXT NOT NULL,
              grupo_titulo TEXT NOT NULL,
              grupo_num TEXT NOT NULL,
              titulo TEXT NOT NULL,
              observacao TEXT,
              obrigatorio INTEGER NOT NULL DEFAULT 0,
              ordem INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              synced_at INTEGER
          );
      """)
      try db.execute(sql: """
          CREATE TABLE evento_pendencias (
              id TEXT PRIMARY KEY,
              evento_id TEXT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
              template_id TEXT NOT NULL REFERENCES pendencias_template(id) ON DELETE CASCADE,
              checado INTEGER NOT NULL DEFAULT 0,
              checado_at INTEGER,
              nota TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              synced_at INTEGER
          );
      """)
      try db.execute(sql: "CREATE INDEX idx_evento_pendencias_evento ON evento_pendencias(evento_id);")
      try db.execute(sql: "CREATE UNIQUE INDEX idx_evento_pendencias_unique ON evento_pendencias(evento_id, template_id);")
  }
  ```
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — structs `PendenciaTemplate` + `EventoPendencia`.
- `ios/p1fast-ios/Sources/Views/EventoDetalheView.swift` — seção "Pendências" com link pra PendenciasView.

### Seed canônico

Portar **6-7 grupos** de `src/data/schemas.js` (`SEED_PEND_TIPOS`) — Motor & Fluidos, Freios, Pneus & Susp., Elétrica, Segurança, Torques Susp., Combustível. ~30 itens totais. Cada item com `titulo`, `observacao` opcional, `obrigatorio` boolean.

### Decisões pré-baked

1. **Templates seedados 1x** no boot (`PendenciaRepository.bootstrap()` checa count, no-op se já populado).
2. **Instâncias por evento** criadas auto na 1ª abertura da PendenciasView pra esse evento.
3. **Visual cascata**: grupos colapsáveis. Header "{X}/{N} checadas" + cor (verde 100%, ouro >0, faint 0).
4. **Obrigatórios destacados**: itens com `obrigatorio=1` ganham asterisco vermelho ou tag "obrig.". UI hint, sem enforcement no banco.
5. **Editar nota**: tap longo → sheet textarea pra `nota`.

### Verificação obrigatória

```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build  # SUCCEEDED

DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)
sqlite3 "$DBPATH" "SELECT COUNT(*) FROM pendencias_template;"
# Esperado: ~30 (depende do count real do JS)

EID=$(sqlite3 "$DBPATH" "SELECT id FROM eventos ORDER BY created_at DESC LIMIT 1;")
sqlite3 "$DBPATH" "SELECT COUNT(*) FROM evento_pendencias WHERE evento_id='$EID';"
# Esperado: igual ao count de templates

git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved
# Esperado: vazio
```

### Screenshots em `/tmp/p1-pendencias/`
- `pendencias-vazias.png`
- `pendencias-meio.png`
- `pendencias-completo.png`
- `pendencias-nota.png`

### PR

**Title:** `feat(1A5): pendências cascata (templates + instâncias por evento) — Prompt #21`

**Body:**
```markdown
## Sprint 1A.5 — Prompt #21

### Schema v5_pendencias (GRDB) + 0005_pendencias.sql (Postgres)
- pendencias_template (catálogo curado)
- evento_pendencias (instâncias por evento, UNIQUE evento_id+template_id)
- RLS Postgres: templates public read; instâncias por is_member do time do evento

### PendenciasView
- Cascata de grupos colapsáveis
- Header "{X}/{N} checadas" com cor por progresso
- Tap longo → sheet de nota

### Seed
- ~30 templates portados de schemas.js SEED_PEND_TIPOS
- Instâncias auto na 1ª abertura por evento

### Verificação
- swift-smoke: 158/0
- xcodebuild: SUCCEEDED
- sqlite: count templates + instâncias por evento confirmado
- Package.resolved intacto
```

### Comando final
`gh pr create --title "..." --body "..."` — terminar com o link.
```
