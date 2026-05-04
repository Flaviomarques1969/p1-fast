# Prompt #22 — Setup avançado dedicado (Sprint 1A.5)

> Cole DEPOIS de Sprint 1A.4 fechado. Independente — refactor visual puro,
> zero schema novo, zero migration. Pode rodar paralelo com #19/#20/#21.

---

```
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #22 (Sprint 1A.5 — setup avançado)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-setup-avancado feat/1A5-setup-avancado`
- Branchar de `main` (após Sprint 1A.4 fechado)
- Editar arquivos no escopo, rodar build/smoke/sqlite, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- **Schema/migration novo** — usar `configuracoes.overrides` JSON existente
- Tocar `CarroSetupOverrides.swift` (modelo já existe)
- Tocar arquivos fora do escopo

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
git log --oneline origin/main | head -10
# Esperado: ver merges Sprint 1A.4. Se não, ABORTAR.
```

## TAREFA

**Branch:** `feat/1A5-setup-avancado` (worktree `../p1-fast-setup-avancado`)
**Base:** `main` (após Sprint 1A.4)

### Files a criar

- `ios/p1fast-ios/Sources/Views/SetupAvancadoView.swift` — visualização dedicada dos 14 overrides do `CarroSetupOverrides`, agrupados por sistema. Reusar visual de `_design-reference/mockup-setup-avancado.html`.

### Files a editar

- `ios/p1fast-ios/Sources/Views/CarroModalView.swift` — botão "Setup avançado" no header (push pra SetupAvancadoView com `carroId`). Modal atual mantém os 14 inputs inline; a tela dedicada é uma view alternativa pra leitura cômoda + edição focada.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — launch arg `--p1-setup-avancado` (abre SetupAvancadoView do primeiro carro).

### Mockup canônico

`_design-reference/mockup-setup-avancado.html`. 5 grupos canônicos:
- PNEUS (4 inputs: pressão DE/DD/TE/TD)
- ALINHAMENTO (3 inputs: cambagem D/T, convergência T)
- SUSPENSÃO (3 inputs: mola D/T, altura D)
- FREIOS (1 input: bias dianteiro)
- MOTOR · TRANSMISSÃO (3 inputs: combustível, mapa, diferencial)

### Decisões pré-baked

1. **SetupAvancadoView lê e escreve o MESMO `configuracoes.overrides`** que o CarroModalView (CarroSetupOverrides JSON). Não duplicar persistência.
2. **Modo de uso**: o CarroModalView original (form inline com 14 inputs) continua funcionando. SetupAvancadoView é um **modo focado** com layout grande + setas de navegação entre grupos. Botão "Setup avançado" no header do CarroModal abre.
3. **Tipografia maior** (default 18pt vs 16pt do modal inline) — usuário tá num momento de tweaking concentrado.
4. **Sem edição de overrides novos**. Os 14 são canônicos.
5. **Discardable changes**: SetupAvancadoView tem footer "Cancelar / Salvar". Cancelar volta sem persistir; Salvar grava no `configuracoes.overrides` e fecha.

### Verificação obrigatória

```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build  # SUCCEEDED

DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)

# Editar override pelo modo avançado:
sqlite3 "$DBPATH" "SELECT overrides FROM configuracoes WHERE carro_id='<id>';"
# Esperado: JSON atualizado

# Editar pelo modal inline → abrir avançado → reflete?
# (manual no simulator)

git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved
# Esperado: vazio

git diff main..HEAD --stat -- 'supabase/migrations/*' ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift
# Esperado: vazio (sem schema novo)
```

### Screenshots em `/tmp/p1-setup-avancado/`
- `setup-grupo-pneus.png`
- `setup-grupo-suspensao.png`
- `setup-todos.png`
- `setup-edit-flow.png` (antes/depois)

### PR

**Title:** `feat(1A5): setup avançado dedicado (visualização agrupada dos 14 overrides) — Prompt #22`

**Body:**
```markdown
## Sprint 1A.5 — Prompt #22

### SetupAvancadoView
- 5 grupos canônicos (PNEUS, ALINHAMENTO, SUSPENSÃO, FREIOS, MOTOR/TRANS)
- Tipografia 18pt + setas de navegação entre grupos
- Lê/escreve mesmo configuracoes.overrides JSON
- Footer Cancelar/Salvar

### CarroModalView
- Botão "Setup avançado" no header → push pra SetupAvancadoView

### Verificação
- swift-smoke: 158/0
- xcodebuild: SUCCEEDED
- sqlite: overrides JSON atualizado pelos 2 caminhos (modal inline + dedicado)
- Sem schema novo
- Package.resolved intacto
```

### Comando final
`gh pr create --title "..." --body "..."` — terminar com o link.
```
