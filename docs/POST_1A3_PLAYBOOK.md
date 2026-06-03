# Post-Sprint 1A.3 Playbook

> Sequência exata pra fechar Sprint 1A.3 dos 3 PRs em flight + fix CRUD-affordances.
> Tudo já está auditado e pronto. Você só executa.

## Estado atual (2026-05-03)

| PR | Branch | Status | Ação |
|---|---|---|---|
| **#33** | `feat/1A3-pessoas` | OPEN, mergeable, CI ✅, audit limpo | Review + merge |
| **#34** | `feat/1A3-combustiveis` | OPEN, mergeable, CI ✅, audit limpo | Review + rebase + merge |
| **#35** | `feat/1A3-pneus` | OPEN, mergeable, CI ✅, audit ✅ | Review + rebase + merge |

---

## Passo 1 — Mergear #33 Pessoas

No GitHub:
1. Abra https://github.com/Flaviomarques1969/p1-fast/pull/33
2. Review (audit já feito — `STATUS.md` snapshot tem detalhes)
3. **Squash and merge**
4. Delete branch (opcional)

Pull main local:
```bash
cd "/Users/imac/Projetos/P1 Fast"
git fetch origin
git checkout main
git pull origin main
```

---

## Passo 2 — Rebase + mergear #34 Combustíveis

```bash
cd "/Users/imac/Projetos/P1 Fast"
git fetch origin
git checkout feat/1A3-combustiveis
git pull origin feat/1A3-combustiveis
git rebase origin/main
```

**Conflito esperado:** 4 BottomNav views (Home, Eventos, Garagem, ThemeShowcase) + ContentView. Padrão do conflito: ambos tocam o array de `BottomNavItem`. Resolução: aceitar ambos os labels — slot 3 já é "Cadastros" (renome de #34), e #33 não muda label.

```bash
# Após resolver:
git add ios/p1fast-ios/Sources/Views/*.swift
git rebase --continue
git push --force-with-lease origin feat/1A3-combustiveis
```

No GitHub:
1. Abra https://github.com/Flaviomarques1969/p1-fast/pull/34
2. Verificar CI verde (re-rodou após force push)
3. **Squash and merge**

```bash
git checkout main
git pull origin main
```

---

## Passo 3 — Rebase + mergear #35 Pneus

```bash
cd "/Users/imac/Projetos/P1 Fast"
git checkout feat/1A3-pneus
git pull origin feat/1A3-pneus
git rebase origin/main
```

**Conflito esperado:** `ContentView.swift` (#35 tem +57 linhas, #33+#34 também tocaram). Resolução: aceitar ambos os blocos de launch args + injeção dos repos (PilotoRepository, PassageiroRepository, CombustivelRepository, PneuRepository).

```bash
git add ios/p1fast-ios/Sources/Views/ContentView.swift
git rebase --continue
git push --force-with-lease origin feat/1A3-pneus
```

No GitHub:
1. Abra https://github.com/Flaviomarques1969/p1-fast/pull/35
2. Verificar CI verde
3. **Squash and merge**

```bash
git checkout main
git pull origin main
```

---

## Passo 4 — Disparar prompt CRUD-affordances (escopo estendido pra Pneus)

Cole o bloco abaixo no Claude Code:

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Fix CRUD affordances v2 (Sprint 1A.3 — fechamento)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-crud-fix feat/1A3-crud-affordances`
- Branchar de `main` (DEPOIS de PRs #33, #34, #35 mergeados — confirmar)
- Editar arquivos no escopo, rodar build/smoke/sqlite, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- Tocar arquivos fora do escopo
- Adicionar funcionalidade nova além de delete affordance

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
git log --oneline origin/main | head -5
# Esperado: ver merge commits dos PRs #33, #34, #35.
# Se faltar algum, ABORTAR e responder "PRs faltam mergear".
```

## TAREFA

**Branch:** `feat/1A3-crud-affordances`
**Base:** `main` (após #33+#34+#35 mergeados)
**Escopo:** adicionar **delete affordance** em 4 listas CRUD que ficaram só Create+Read+Update na UI.

### Files a editar (4 zonas)

1. **Combustíveis** — `ios/p1fast-ios/Sources/Views/CombustivelListaView.swift`
   - `CombustivelRow` ganha swipe-to-delete via `.swipeActions(edge: .trailing) { Button("Apagar", role: .destructive) {...} }`
   - View recebe `onDelete: (Combustivel) -> Void`
   - Tap no row já abre edit (lista atual já tem? confirmar — se não, adicionar `onTap` também)

2. **Pilotos / Passageiros** — `ios/p1fast-ios/Sources/Views/PessoasView.swift`
   - Sub-tabs Pilotos e Passageiros: aplicar mesmo padrão swipe-to-delete + tap-to-edit (se faltar)

3. **Pneus** — `ios/p1fast-ios/Sources/Views/CarroModalView.swift`
   - Lista de tire rows ganha swipe-to-delete (mockup-carro original NÃO tem delete affordance, mas precisamos pra UX completa — é fix justificável)
   - Botão "Editar" inline já existe (PR #35) — manter
   - Confirmação via `.alert("Apagar pneu?", isPresented:)` — mesma do padrão dos 3 outros

4. **CadastroViews em modo edit** — `CombustivelCadastroView`, `PilotoCadastroView`, `PassageiroCadastroView`, `PneuCadastroView`
   - Quando aberto com `*ToEdit` não-nil, mostrar botão "Apagar X" no footer (style ghost vermelho), que dispara o mesmo alert + delete + close sheet

### Files a NÃO tocar
- Repositories (já têm `delete()`)
- Models.swift, Migrations.swift
- Outros views (Carro readonly, Stint, Eventos, Home, Garagem)
- Tests
- Package.resolved

### Decisões pré-baked

1. **Swipe-to-delete COM confirmação alert** em todas as 4 listas. Mensagem padrão: "Não dá pra desfazer." Botões: "Cancelar" + "Apagar" (role: .destructive).

2. **Botão "Apagar" inline no footer do CadastroView em modo edit** — alternativa ao swipe pra usuário que tá editando e decide apagar.

3. **Sem checagem de FK no delete** — Sprint 1A.4 vai trazer FKs em sessoes (#16). Por enquanto, delete livre.

4. **Edit dos seedados permitido** (Flavio, Bruno, Etanol, Gasolina canônica). Sem bloqueio.

5. **Sem feature flag.** Mudança visível pra todos.

### Verificação

```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild ... build  # SUCCEEDED

DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)

# Deletar combustível pelo swipe
sqlite3 "$DBPATH" "SELECT COUNT(*) FROM combustiveis;"

# Deletar pneu pelo swipe (escopo de carro)
sqlite3 "$DBPATH" "SELECT COUNT(*) FROM pneus WHERE carro_id='<id>';"

# Deletar piloto via botão no footer do edit
sqlite3 "$DBPATH" "SELECT COUNT(*) FROM pilotos;"

# Deletar passageiro via swipe
sqlite3 "$DBPATH" "SELECT COUNT(*) FROM passageiros;"

# Package.resolved intacto
git diff main -- ios/p1fast-core/Package.resolved
```

### Screenshots em `/tmp/p1-crud-affordances/`
- `combustivel-swipe.png`
- `combustivel-alert.png`
- `pneu-swipe.png`
- `pneu-edit-footer-delete.png`
- `piloto-swipe.png`
- `passageiro-swipe.png`

### PR title
```
fix(1A3): delete affordances em Combustíveis/Pilotos/Passageiros/Pneus
```

### PR body template
```markdown
## Sprint 1A.3 — Fix de delete affordances (fechamento)

### Bug
Listas de Combustíveis (PR #34), Pilotos+Passageiros (PR #33), Pneus (PR #35)
ficaram com Create+Read+Update na UI mas sem Delete. Repositories têm
`delete()` mas sem caller.

### Fix
- Swipe-to-delete em 4 listas (Combustível, Piloto, Passageiro, Pneu)
- Alert de confirmação "Não dá pra desfazer."
- Botão "Apagar" no footer dos 4 CadastroViews em modo edit (alternativa ao swipe)

### Decisões
- Sem checagem de FK (sessoes ganha FKs em #16)
- Edit dos seedados permitido (sem bloqueio)
- Sem feature flag

### Verificação
- Smoke Swift: 158/0
- Build iOS: SUCCEEDED
- Delete via UI verificado em sqlite (output abaixo)
- Screenshots em /tmp/p1-crud-affordances/

[paste sqlite outputs aqui]
```

`gh pr create --title "..." --body "..."` — terminar com link.
````

---

## Após o fix mergear

**Sprint 1A.3 fechado 100%.** Próxima ação: disparar **#16 Sprint 1A.4** (em `docs/SPRINT_1A4_DESIGN.md`).

```bash
# Atualizar STATUS.md (eu faço quando você avisar que mergearam)
git checkout main
git pull origin main
```

---

## Resumo: o que você executa de verdade

1. **3 reviews + merges no GitHub** (~15 min cada, ~45 min total)
2. **Os comandos de rebase** acima (~10 min cada se houver conflito, ~30 min total)
3. **1 colar do prompt CRUD-affordances v2** acima

Total estimado: **~2h de trabalho teu** pra fechar Sprint 1A.3 100%.

Tudo o resto (audit, prompts, docs, status) já está pronto.
