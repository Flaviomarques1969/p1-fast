# Prompt #18 — Pessoas schema v2 forms (Sprint 1A.4)

> Cole DEPOIS do PR #16 (#47) mergeado. Paralelizável com #17 (worktree separado).

---

```
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #18 (Sprint 1A.4 — pessoas v2)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-pessoas-v2 feat/1A4-pessoas-v2`
- Branchar de `main` (depois de #16 mergeado)
- Editar arquivos no escopo, rodar build/smoke/sqlite, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- Mexer em Migrations.swift, DB.swift ou criar SQL nova — #16 já fez
- Mexer em Models.swift — #16 já adicionou alturaCm/pesoKg/nascimento em Piloto/Passageiro
- Aplicar migration em prod Supabase
- Tocar arquivos fora do escopo

### Pré-requisito
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
grep -E "alturaCm|pesoKg|nascimento" ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift | head -5
# Esperado: aparecer em Piloto e Passageiro
```

## TAREFA

**Branch:** `feat/1A4-pessoas-v2`
**Base:** `main` (após #16)

### Files a editar
- `ios/p1fast-ios/Sources/Views/PilotoCadastroView.swift` — 3 campos opcionais abaixo de "Nome":
  - "Altura (cm)" — input number
  - "Peso (kg)" — input number 1 decimal
  - "Data de nascimento" — DatePicker `.date`
  - REMOVER HelperNote "altura/peso/idade virão depois" se existir.
- `ios/p1fast-ios/Sources/Views/PassageiroCadastroView.swift` — mesma coisa.
- `ios/p1fast-ios/Sources/Persistence/PilotoRepository.swift` — `upsert` aceita os 3 campos.
- `ios/p1fast-ios/Sources/Persistence/PassageiroRepository.swift` — idem.

### Mockups
- `_design-reference/mockup-piloto-cadastro.html`
- `_design-reference/mockup-passageiro-cadastro.html`

### Decisões pré-baked
1. Todos os 3 opcionais. Submit sem eles funciona (NULL).
2. Idade armazenada como timestamp Unix (segundos) do dia 00:00:00 UTC.
3. Tipos: altura `Int` (cm), peso `Double` (kg, 1 decimal), nascimento `Int64` (segundos epoch).
4. Edição pré-preenche; NULL → input vazio (não chutar default).
5. Validação: altura 100-230, peso 30-200, nascimento 1900-hoje. Inválido = border red + msg, bloqueia submit. Vazio = válido.

### Verificação
```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build  # SUCCEEDED

DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)
sqlite3 "$DBPATH" "SELECT nome, altura_cm, peso_kg, nascimento FROM pilotos ORDER BY created_at DESC LIMIT 1;"
sqlite3 "$DBPATH" "SELECT altura_cm FROM pilotos WHERE id='piloto-mock-flavio';"
sqlite3 "$DBPATH" "SELECT altura_cm, peso_kg, nascimento FROM passageiros ORDER BY created_at DESC LIMIT 1;"
git diff main..HEAD --stat -- ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift ios/p1fast-core/Package.resolved
# Esperado: vazio
```

### Screenshots em `/tmp/p1-pessoas-v2/`
- piloto-cadastro-3-campos, piloto-cadastro-preenchido, piloto-cadastro-validacao (altura=300), passageiro-cadastro-3-campos

### PR
**Title:** `feat(1A4): pessoas schema v2 forms (altura/peso/nascimento) — Prompt #18`

`gh pr create ...` — terminar com o link.
```
