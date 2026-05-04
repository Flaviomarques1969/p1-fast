# Prompt #19 — Trechos da pista + seed Brasília (Sprint 1A.5)

> Cole o bloco abaixo numa task nova do Cloud Code DEPOIS de Sprint 1A.4
> mergeado (#16, #17, #18). Independente dos outros 1A.5 — pode rodar
> isolado ou em paralelo com #20/#21/#22.

---

```
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #19 (Sprint 1A.5 — trechos)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-trechos feat/1A5-trechos`
- Branchar de `main` (após Sprint 1A.4 fechado)
- Editar arquivos no escopo, rodar build/smoke/sqlite, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- Aplicar migration em prod Supabase — não rodar `supabase db push`/`supabase link`
- Schema novo — `tracks`/`track_layouts`/`track_segments` JÁ existem em v1_initial
- Tocar arquivos fora do escopo

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
git log --oneline origin/main | head -10
# Esperado: ver merges #16, #17, #18 (Sprint 1A.4 fechado). Se não, ABORTAR.
```

## TAREFA

**Branch:** `feat/1A5-trechos` (worktree `../p1-fast-trechos`)
**Base:** `main` (após Sprint 1A.4 mergeado)

### Files a criar

- `ios/p1fast-ios/Sources/Views/TrechoListaView.swift` — lista de trechos do layout ativo, agrupados por parcial. Reusar visual de `_design-reference/mockup-trecho-lista.html` em modo CRUD-readonly (sem radio, sem footer — selector de stint vem depois).
- `ios/p1fast-ios/Sources/Persistence/TrackRepository.swift` — CRUD básico: list tracks, list layouts por track, list segments por layout.

### Files a editar

- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — adicionar structs `Track`, `TrackLayout`, `TrackSegment`, `Marco` (Codable + GRDB), seguindo padrão de `Carro` e `Combustivel`.
- `ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift` (já existe — ESTENDER, NÃO criar arquivo novo) — adicionar seed de tracks/layouts/segments do circuito Brasília.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — entrypoint pra TrechoListaView + launch arg `--p1-trechos`.
- `ios/p1fast-ios/Sources/Views/GaragemView.swift` — botão "Trechos da pista" no header (acima do FAB "Novo carro"). Tap abre `TrechoListaView` em push (NavigationStack).

### Mockup canônico

`_design-reference/mockup-trecho-lista.html`. Notar: original é stint-selector (radio + footer "Voltar"). Em 1A.5 entra como **CRUD readonly**:
- Sem radio
- Sem footer
- Header eyebrow "Trechos da pista" + título "Brasília" + sub "8 trechos"
- Group heads "Parcial 1 · Saída do box" / "Parcial 2 · Junção" / etc.
- `trecho-row` mostra nome + tags (Lenta/Média/Rápida + Apex)
- Botão "Sem trecho específico" omitido (só faz sentido como selector)

### Decisões pré-baked

1. **Surface**: botão "Trechos da pista" no header da `GaragemView`. Sem sub-tab.
2. **Seed Brasília** em `SeedBrasilia.swift` — track + 1 layout "Padrão" + 8 segments distribuídos em 3 parciais. Nomes canônicos: "Curva 01", "Mergulho da Bruxa", "Curva 2", "Junção", "S das Quebradas", "Curva 6", "Cotovelo", "Última Curva".
3. **Sem CRUD de criar/editar/deletar trecho neste PR**. v1 é só readonly do que tá seedado.
4. **Multi-track** sai do escopo. Brasília é a única pista por enquanto.
5. **Tags como derivação** (heurística simples no view) — schema atual não tem `tags`. Documentar como hack temporário.

### Verificação obrigatória

```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build  # SUCCEEDED

DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)
sqlite3 "$DBPATH" "SELECT t.apelido, l.nome, COUNT(s.id) FROM tracks t JOIN track_layouts l ON l.track_id=t.id JOIN track_segments s ON s.layout_id=l.id GROUP BY t.id, l.id;"
# Esperado: Brasília|Padrão|8

git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved
# Esperado: vazio

git diff main..HEAD --stat -- 'supabase/migrations/*' ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift
# Esperado: vazio (sem migration nova)
```

### Screenshots em `/tmp/p1-trechos/`
- `garagem-com-botao.png`
- `trechos-lista.png`
- `trechos-empty-track.png`

### PR

**Title:** `feat(1A5): trechos da pista (lista readonly + seed Brasília) — Prompt #19`

**Body:**
```markdown
## Sprint 1A.5 — Prompt #19

### Trechos UI
- TrechoListaView readonly agrupando 8 segments em 3 parciais
- Botão "Trechos da pista" no header da GaragemView

### Models + Repo
- Structs Track, TrackLayout, TrackSegment, Marco (Codable + GRDB)
- TrackRepository com list tracks/layouts/segments

### Seed Brasília
- 1 track, 1 layout "Padrão", 8 segments com nomes canônicos
- Estendido em SeedBrasilia.swift (não duplicado)

### Verificação
- swift-smoke: 158/0
- xcodebuild: SUCCEEDED
- sqlite: Brasília|Padrão|8 confirmado
- Sem migration nova (schema v1)
- Package.resolved intacto

### Out-of-scope
- CRUD de trechos (criar/editar/deletar) — v2
- Tags como coluna real — v2 (hoje é heurística no view)
- Multi-track — Brasília única por enquanto
```

### Comando final
`gh pr create --title "..." --body "..."` — terminar com o link do PR.
```
