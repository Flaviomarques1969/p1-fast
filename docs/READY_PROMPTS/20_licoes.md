# Prompt #20 — Catálogo de lições (Sprint 1A.5)

> Cole DEPOIS de Sprint 1A.4 fechado. Paralelizável com #21 (zonas independentes).
> Cria migration nova: `supabase/migrations/0004_licoes.sql` + GRDB `v4_licoes`.
> Template SQL pré-baked em `docs/_templates/0004_licoes.sql` — Cloud Code pode copiar.

---

```
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #20 (Sprint 1A.5 — lições)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-licoes feat/1A5-licoes`
- Branchar de `main` (após Sprint 1A.4 fechado)
- Editar arquivos no escopo, rodar build/smoke/sqlite, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- **Aplicar migration em prod Supabase** — não rodar `supabase db push`/`supabase link`. Flávio aplica manualmente após merge.
- Tocar arquivos fora do escopo

### ⚠️ Convenção de nome (estado atual de main, NÃO mudar)

- **Migration GRDB**: registrar como `"v4_licoes"` (DEPOIS de `v2_pull_cursor` e `v2a_columns` no `register(into:)` em Migrations.swift). NÃO usar `v3` (reservado) nem `v4_*` outro nome.
- **Migration Postgres**: arquivo `supabase/migrations/0004_licoes.sql`. NÃO usar `0006` (já é do #16).

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
git log --oneline origin/main | head -10
# Esperado: ver merges Sprint 1A.4 (#16, #17, #18). Se não, ABORTAR.
```

## TAREFA

**Branch:** `feat/1A5-licoes` (worktree `../p1-fast-licoes`)
**Base:** `main` (após Sprint 1A.4)

### Files a criar

- `ios/p1fast-ios/Sources/Views/LicaoListaView.swift` — catálogo de lições agrupadas por categoria/nível. Reusar visual de `_design-reference/mockup-licao-lista.html`.
- `ios/p1fast-ios/Sources/Persistence/LicaoRepository.swift` — CRUD readonly + seed do JS canônico.
- `supabase/migrations/0004_licoes.sql` — copiar template de `docs/_templates/0004_licoes.sql` SEM alteração estrutural.

### Files a editar

- `ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift` — dentro de `register(into:)`, ADICIONAR um `m.registerMigration("v4_licoes")` após `v2a_columns`:
  ```swift
  m.registerMigration("v4_licoes") { db in
      try db.execute(sql: """
          CREATE TABLE licoes (
              id TEXT PRIMARY KEY,
              titulo TEXT NOT NULL,
              descricao TEXT,
              categoria TEXT NOT NULL,
              nivel TEXT NOT NULL,
              fase TEXT,
              tipo_curva TEXT,
              sinais_requeridos TEXT,
              ativa INTEGER NOT NULL DEFAULT 1,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              synced_at INTEGER
          );
      """)
      try db.execute(sql: "CREATE INDEX idx_licoes_ativa ON licoes(ativa);")
      try db.execute(sql: "CREATE INDEX idx_licoes_categoria ON licoes(categoria);")
  }
  ```
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — struct `Licao` (Codable + GRDB). CodingKeys com snake_case.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — entrypoint sub-tab "Lições" + launch arg `--p1-licoes`.

### Seed canônico (12 lições)

Portar **as 12 lições** de `src/data/lesson-library.js` (LESSONS_MVP + LESSONS_FASE_2) pra Swift como seed idempotente em `LicaoRepository.bootstrap()`:
- 7 MVP **ativas** (`ativa=1`)
- 5 Fase 2 **inativas** (`ativa=0`)

Nomes/categorias/níveis literais do JS — não inventar.

### Decisões pré-baked

1. **Catálogo readonly** em v1. Sem add/edit/delete pelo usuário.
2. **Filtro visual**: toggle "Só ativas" no header (default ON). "Todas" mostra também as 5 Fase 2 com badge "Fase 2".
3. **Detalhe da lição**: tap no row abre sheet com descrição + sinais + fase/tipo curva. Read-only.
4. **Surface**: sub-tab "Lições" dentro de "Cadastros" (BottomNav slot 3, renomeado em #15).
5. **Seed idempotente**: bootstrap checa count==12 → no-op; diferente → upsert por `id` mantendo `ativa` flag.

### Verificação obrigatória

```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build  # SUCCEEDED

DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)
sqlite3 "$DBPATH" "SELECT COUNT(*), SUM(ativa) FROM licoes;"
# Esperado: 12|7

sqlite3 "$DBPATH" "SELECT titulo, categoria, ativa FROM licoes ORDER BY ativa DESC, categoria;"
# Esperado: 7 ativas + 5 inativas

git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved
# Esperado: vazio
```

### Screenshots em `/tmp/p1-licoes/`
- `licoes-ativas.png` (toggle ON, 7 rows)
- `licoes-todas.png` (12 rows, badges Fase 2)
- `licao-detalhe.png` (sheet)

### PR

**Title:** `feat(1A5): catálogo de lições (12 do JS canônico) — Prompt #20`

**Body:**
```markdown
## Sprint 1A.5 — Prompt #20

### Schema v4_licoes (GRDB) + 0004_licoes.sql (Postgres)
- Tabela `licoes` com 11 colunas (catálogo curado)
- 2 índices (ativa, categoria)
- RLS Postgres: public read, write só service_role

### LicaoListaView
- Sub-tab "Lições" dentro de "Cadastros"
- Toggle "Só ativas" no header (default ON)
- Tap → sheet de detalhe read-only

### Seed (12 lições)
- 7 MVP ativas + 5 Fase 2 inativas
- Bootstrap idempotente

### Verificação
- swift-smoke: 158/0
- xcodebuild: SUCCEEDED
- sqlite: 12|7 confirmado
- Package.resolved intacto

### Out-of-scope (próximo PR)
- Pendências cascata → #21 (paralelizável)
```

### Comando final
`gh pr create --title "..." --body "..."` — terminar com o link.
```
