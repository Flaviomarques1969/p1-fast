# Prompt #17 — Stint selectors (Sprint 1A.4)

> Cole DEPOIS do PR #16 (#47) mergeado. Paralelizável com #18.

---

```
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #17 (Sprint 1A.4 — stint selectors)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-stint-selectors feat/1A4-stint-selectors`
- Branchar de `main` (depois de #16 mergeado)
- Editar arquivos no escopo, rodar build/smoke/sqlite, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- Mexer em Migrations.swift, DB.swift ou criar SQL nova — #16 já fez tudo
- Mexer em `StintRepository.pilotoFlavioId/pilotoBrunoId` — #16 já removeu
- Aplicar migration em prod Supabase
- Tocar arquivos fora do escopo

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
grep -c "v2a_columns" ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift
# Esperado: >= 1. Se 0: ABORTAR.
```

## TAREFA

**Branch:** `feat/1A4-stint-selectors`
**Base:** `main` (após #16)

### Files a criar
- `ios/p1fast-ios/Sources/Views/PneuPickerView.swift` — selector escopado por `carroId`. Mockup: `_design-reference/mockup-pneu-lista.html` COM radio + footer "Voltar/Confirmar".
- `ios/p1fast-ios/Sources/Views/CombustivelPickerView.swift` — selector. Quantidade fica no StintModal. Mockup: `mockup-combustivel-lista.html`.

### Files a editar
- `ios/p1fast-ios/Sources/Views/StintModalView.swift` — 2 campos novos na seção Configuração (mockup-stint.html linhas 303-323):
  - "Combustível abastecido" — input qty (L, 1 decimal, opcional) + tap abre CombustivelPickerView
  - "Pneu montado" — tap abre PneuPickerView
- `ios/p1fast-ios/Sources/Persistence/StintRepository.swift` — 3 métodos novos:
  ```swift
  func setPneu(stintId: String, pneuId: String?) async throws
  func setCombustivel(stintId: String, combustivelId: String?, litros: Double?) async throws
  func incrementarCiclos(pneuId: String, by voltas: Int) async throws
  ```
  + `finalizarStint(...)` chama `incrementarCiclos` quando `stint.pneuId != nil`.

### Decisões pré-baked
1. Pneu picker escopado por carroId; empty state → CTA pra PneuCadastroView.
2. Combust picker NÃO escopado (combustível é per-time_id); empty → CTA pra CombustivelCadastroView.
3. Qty combust opcional. Sem combust selecionado mas com qty: salva qty + combustivel_id NULL.
4. Ciclos auto-increment 1x no finalizarStint (soma voltas.count). pneu_id NULL = no-op.
5. Stint 'completa' = pickers read-only no UI.
6. Sem migration nova.

### Verificação
```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build  # SUCCEEDED

DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)
sqlite3 "$DBPATH" "SELECT id, pneu_id, combustivel_id, qt_combustivel_litros FROM sessoes WHERE status='planejada' ORDER BY created_at DESC LIMIT 1;"
PNEU_ID=$(sqlite3 "$DBPATH" "SELECT pneu_id FROM sessoes WHERE id='<stint_id>';")
sqlite3 "$DBPATH" "SELECT ciclos FROM pneus WHERE id='$PNEU_ID';"
git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved
git diff main..HEAD --stat -- ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift
# Últimos 2: vazios
```

### Screenshots em `/tmp/p1-stint-selectors/`
- stint-modal-pickers-vazio, pneu-picker-empty, pneu-picker-com-2, combust-picker-com-2, stint-modal-preenchido

### PR
**Title:** `feat(1A4): stint selectors (pneu + combust) + ciclos auto-increment — Prompt #17`

`gh pr create ...` — terminar com o link.
```
