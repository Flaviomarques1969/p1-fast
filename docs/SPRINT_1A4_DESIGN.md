# Sprint 1A.4 — Stint Selectors + Schema v2 + Cleanup

> Status: **proposta**, baked após Sprint 1A.3 (#11-#15). Documento pré-prompt
> pra travar escopo ANTES do Cloud Code começar. Todos os 3 prompts abaixo
> são executáveis autônomos com preâmbulo de execução completa.

## Contexto

Sprint 1A.3 entregou cadastros isolados (Pilotos/Passageiros/Pneus/Combustíveis)
sem ainda integrar com o fluxo de stint. Sprint 1A.4 fecha essa ponte:

1. **#16 — Schema migration v2** — adiciona FKs em `sessoes` pra pneu/combust
   + remove aliases de back-compat herdados do #11.
2. **#17 — Stint Selectors** — implementa pickers de pneu + combust no
   `StintModalView` (mockup-stint.html linhas 303-323), porta lista mockups
   como selectors reais, incrementa `pneus.ciclos` automaticamente quando
   stint termina.
3. **#18 — Pessoas Schema v2** — adiciona `altura_cm`/`peso_kg`/`nascimento`
   em `pilotos` e `passageiros`, estende forms com esses 3 campos
   (resgatando o que ficou de fora em #12+#13).

Cada prompt = 1 branch = 1 PR. **Sequência obrigatória**: #16 → #17 (FK
existir antes de UI usar). #18 é paralelizável a qualquer um (zona
isolada em `pilotos`/`passageiros`).

## Decisões pré-baked (transversais aos 3 prompts)

- **Convenção de paths** (validada em #15): structs em `p1fast-core/Models.swift`,
  repos em `p1fast-ios/Sources/Persistence/`, views em `p1fast-ios/Sources/Views/`.
- **Migration**: `Migrations.swift` ganha método `static func v2(_ migrator:)` —
  registrado em `DB.swift` após `v1`. Não recriar tabelas existentes; usar
  `ALTER TABLE ADD COLUMN` (SQLite suporta).
- **Sem seed novo**: pneu/combust em `sessoes` ficam NULL pra stints existentes.
  Pessoas migrating: novos campos NULL nos seedados (Flavio/Bruno).
- **`Package.resolved` NÃO tocado** (lição PR #34).
- **Worktree obrigatório** pra evitar autosave race no checkout principal.

## Schema delta v2

```sql
-- sessoes (stints)
ALTER TABLE sessoes ADD COLUMN pneu_id TEXT REFERENCES pneus(id) ON DELETE SET NULL;
ALTER TABLE sessoes ADD COLUMN combustivel_id TEXT REFERENCES combustiveis(id) ON DELETE SET NULL;
ALTER TABLE sessoes ADD COLUMN qt_combustivel_litros REAL;
CREATE INDEX idx_sessoes_pneu ON sessoes(pneu_id);
CREATE INDEX idx_sessoes_combustivel ON sessoes(combustivel_id);

-- pilotos
ALTER TABLE pilotos ADD COLUMN altura_cm INTEGER;
ALTER TABLE pilotos ADD COLUMN peso_kg REAL;
ALTER TABLE pilotos ADD COLUMN nascimento INTEGER;  -- unix timestamp dia

-- passageiros
ALTER TABLE passageiros ADD COLUMN altura_cm INTEGER;
ALTER TABLE passageiros ADD COLUMN peso_kg REAL;
ALTER TABLE passageiros ADD COLUMN nascimento INTEGER;
```

Espelhar mesma migration em `supabase/migrations/0002_v2_schema.sql` (não aplicar em prod nesse PR — só versionar).

---

# Prompt #16 — Schema migration v2 + StintRepository cleanup

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #16 (Sprint 1A.4)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode até passar (max 3x mesma raiz).
Se fundamentalmente impossível, abra PR como `[DRAFT]` com erro.

### Autorizado
- `git worktree add ../p1-fast-schema-v2 feat/1A4-schema-v2`
- Branchar de `main`
- Editar arquivos no escopo, rodar build/smoke/sqlite, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- Aplicar migration em prod Supabase (só versionar arquivo)
- Tocar arquivos fora do escopo

## TAREFA

**Branch:** `feat/1A4-schema-v2` (worktree `../p1-fast-schema-v2`)
**Base:** `main` (após #14 Pneus mergeado — confirmar antes)

### Files a editar

- `ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift` —
  adicionar método `static func v2(_ migrator: inout DatabaseMigrator)`.
- `ios/p1fast-core/Sources/P1FastCore/Persistence/DB.swift` —
  registrar `Migrations.v2(&migrator)` após `Migrations.v1`.
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` —
  adicionar campos opcionais nas structs `Sessao`, `Piloto`, `Passageiro`:
  - `Sessao`: `var pneuId: String?`, `var combustivelId: String?`, `var qtCombustivelLitros: Double?`
  - `Piloto`/`Passageiro`: `var alturaCm: Int?`, `var pesoKg: Double?`, `var nascimento: Int64?`
  - Atualizar `CodingKeys` enum.
- `ios/p1fast-ios/Sources/Persistence/StintRepository.swift` —
  remover aliases `pilotoFlavioId`/`pilotoBrunoId` (linhas 39-40).
- `ios/p1fast-ios/Sources/Views/ContentView.swift` linha 252 —
  trocar `StintRepository.pilotoFlavioId` → `PilotoRepository.pilotoFlavioId`.
- `ios/p1fast-ios/Sources/Views/StintModalView.swift` linha 231 —
  mesma troca.

### Files a criar

- `supabase/migrations/0002_v2_schema.sql` —
  espelho do migration v2 em SQL Postgres. NÃO aplicar.

### Schema delta v2 (executar exatamente)

```sql
-- 1. sessoes
ALTER TABLE sessoes ADD COLUMN pneu_id TEXT REFERENCES pneus(id) ON DELETE SET NULL;
ALTER TABLE sessoes ADD COLUMN combustivel_id TEXT REFERENCES combustiveis(id) ON DELETE SET NULL;
ALTER TABLE sessoes ADD COLUMN qt_combustivel_litros REAL;
CREATE INDEX idx_sessoes_pneu ON sessoes(pneu_id);
CREATE INDEX idx_sessoes_combustivel ON sessoes(combustivel_id);

-- 2. pilotos
ALTER TABLE pilotos ADD COLUMN altura_cm INTEGER;
ALTER TABLE pilotos ADD COLUMN peso_kg REAL;
ALTER TABLE pilotos ADD COLUMN nascimento INTEGER;

-- 3. passageiros
ALTER TABLE passageiros ADD COLUMN altura_cm INTEGER;
ALTER TABLE passageiros ADD COLUMN peso_kg REAL;
ALTER TABLE passageiros ADD COLUMN nascimento INTEGER;
```

GRDB equivalente em `Migrations.swift`:
```swift
static func v2(_ migrator: inout DatabaseMigrator) {
    migrator.registerMigration("v2_schema") { db in
        try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN pneu_id TEXT REFERENCES pneus(id) ON DELETE SET NULL;")
        try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN combustivel_id TEXT REFERENCES combustiveis(id) ON DELETE SET NULL;")
        try db.execute(sql: "ALTER TABLE sessoes ADD COLUMN qt_combustivel_litros REAL;")
        try db.execute(sql: "CREATE INDEX idx_sessoes_pneu ON sessoes(pneu_id);")
        try db.execute(sql: "CREATE INDEX idx_sessoes_combustivel ON sessoes(combustivel_id);")
        try db.execute(sql: "ALTER TABLE pilotos ADD COLUMN altura_cm INTEGER;")
        try db.execute(sql: "ALTER TABLE pilotos ADD COLUMN peso_kg REAL;")
        try db.execute(sql: "ALTER TABLE pilotos ADD COLUMN nascimento INTEGER;")
        try db.execute(sql: "ALTER TABLE passageiros ADD COLUMN altura_cm INTEGER;")
        try db.execute(sql: "ALTER TABLE passageiros ADD COLUMN peso_kg REAL;")
        try db.execute(sql: "ALTER TABLE passageiros ADD COLUMN nascimento INTEGER;")
    }
}
```

### Verificação obrigatória

```bash
# 1. Smoke Swift (deve passar com migration v2 aplicada)
cd ios/p1fast-core && swift run p1fast-smoke
# Esperado: 158/0 (mantido — testes existentes não dependem de v2)

# 2. Build iOS
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj \
  -scheme p1fast-ios \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' \
  build

# 3. Migration upgrade test (apagar simulator data, relaunch — confirmar v2 aplicado)
DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)
sqlite3 "$DBPATH" ".schema sessoes" | grep -E "pneu_id|combustivel_id|qt_combust"
# Esperado: 3 linhas matching

sqlite3 "$DBPATH" ".schema pilotos" | grep -E "altura_cm|peso_kg|nascimento"
# Esperado: 3 linhas matching

# 4. Confirmar Package.resolved intacto
git diff main -- ios/p1fast-core/Package.resolved
# Esperado: vazio

# 5. Confirmar nenhum caller dos aliases removidos
grep -rn "StintRepository.pilotoFlavioId\|StintRepository.pilotoBrunoId" ios/ --include="*.swift"
# Esperado: vazio
```

### PR title + description

```
feat(1A4): schema v2 + StintRepository alias cleanup — Prompt #16
```

```markdown
## Sprint 1A.4 — Prompt #16

### Schema v2 aplicado
- `sessoes`: +pneu_id, +combustivel_id, +qt_combustivel_litros (FKs SET NULL)
- `pilotos`/`passageiros`: +altura_cm, +peso_kg, +nascimento (todos NULL pra rows existentes)
- Índices em pneu_id e combustivel_id

### Cleanup
- Removidos aliases `StintRepository.pilotoFlavioId/pilotoBrunoId` (commit `5447864` débito)
- Migrados 2 callers: `ContentView.swift:252`, `StintModalView.swift:231`
- Agora referenciam `PilotoRepository.*` direto

### Verificação
- Smoke Swift: 158/0 (mantido)
- Build iOS: SUCCEEDED
- Migration upgrade verificado: relaunch após apagar data → schema v2 aplicado
- Package.resolved intacto
- Zero callers órfãos dos aliases

### Out-of-scope
- Aplicar migration em Supabase prod (só versionado em supabase/migrations/0002)
- UI pra novos campos (#17 stint selectors, #18 pessoas form extension)
```

### Comando final
`gh pr create --title "..." --body "..."` — terminar com link do PR.
````

---

# Prompt #17 — Stint Selectors (pneu + combust) + ciclos auto-increment

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #17 (Sprint 1A.4)

## CONTRATO DE EXECUÇÃO
[mesmo de #16]

**blockedBy:** #16 (precisa das colunas v2 em `sessoes`)

## TAREFA

**Branch:** `feat/1A4-stint-selectors` (worktree `../p1-fast-stint-selectors`)
**Base:** `main` (após #16 mergeado — confirmar)

### Files a criar

- `ios/p1fast-ios/Sources/Views/PneuPickerView.swift` — selector de pneu pro stint, escopado por `carroId`. Reusar visual de `_design-reference/mockup-pneu-lista.html` AGORA com radio + footer "Voltar/Confirmar" (esse era o uso original).
- `ios/p1fast-ios/Sources/Views/CombustivelPickerView.swift` — selector de combust + input de quantidade (litros). Reusar `mockup-combustivel-lista.html` com radio + footer.

### Files a editar

- `ios/p1fast-ios/Sources/Views/StintModalView.swift` — adicionar 2 campos novos (linhas ~315 atual, na seção "Configuração"):
  - "Combustível abastecido" — input qty (L) + picker que abre `CombustivelPickerView`
  - "Pneu montado" — picker que abre `PneuPickerView` escopado pelo carro do stint
  - Layout 1:1 com `mockup-stint.html` linhas 303-323
- `ios/p1fast-ios/Sources/Persistence/StintRepository.swift` — métodos novos:
  ```swift
  func setPneu(stintId: String, pneuId: String?) async throws
  func setCombustivel(stintId: String, combustivelId: String?, litros: Double?) async throws
  func incrementarCiclos(pneuId: String, by voltas: Int) async throws
  ```
  + chamada de `incrementarCiclos` automática quando `finalizarStint(...)` é chamado (somar `voltas.count` do stint).

### Mockups canônicos

- **Picker pneu**: `mockup-pneu-lista.html` AGORA portado COM radio + footer (uso original era selector). Adicionar `selectedId: Binding<String?>` + footer "Voltar / Confirmar".
- **Picker combust**: `mockup-combustivel-lista.html` mesmo padrão. Quantidade fica num input separado no `StintModalView`, picker só pega o `combustivel_id`.
- **Stint UI**: `mockup-stint.html` linhas 303-323 (campos Combustível + Pneu na seção Configuração).

### Decisões pré-baked

1. **Pneu picker escopado por `carroId`**. Se carro não tem pneu cadastrado, picker mostra empty state grande do mockup ("Cadastre os pneus do {apelido}") + CTA que abre `PneuCadastroView` (já existe do #14).

2. **Combust picker NÃO escopado** (combustível é per-`time_id`, vide schema #15). Se nenhum cadastrado, empty state + CTA pra `CombustivelCadastroView`.

3. **Quantidade combust**: input number (litros, 1 casa decimal). Pode ficar vazio (NULL no banco). Se preenchido sem combust selecionado, salva qty mas combustivel_id NULL — não bloquear.

4. **Ciclos auto-increment**: chamado UMA vez quando `finalizarStint(...)` roda. Soma `voltas.count` ao `pneus.ciclos` atual. Se `pneu_id` do stint é NULL, no-op.

5. **Edição de stint planejado** (status='planejada'): pneu/combust podem ser trocados livremente. Stint finalizado ('completa'): pneu/combust ficam read-only no UI (não bloquear no banco — pode mudar via debug).

6. **Sem migration nova** (#16 já criou as colunas).

### Verificação obrigatória

```bash
# 1. Smoke + Build
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild ... build  # SUCCEEDED

# 2. Persistência completa
DBPATH=$(...)

# Criar stint via simulator com pneu + combust + qty selecionados
sqlite3 "$DBPATH" "SELECT id, pneu_id, combustivel_id, qt_combustivel_litros FROM sessoes WHERE status='planejada' ORDER BY created_at DESC LIMIT 1;"
# Esperado: row com FKs preenchidas

# Finalizar stint com 5 voltas — ciclos do pneu deve incrementar
PNEU_ID=$(sqlite3 "$DBPATH" "SELECT pneu_id FROM sessoes WHERE id='<stint_id>';")
sqlite3 "$DBPATH" "SELECT ciclos FROM pneus WHERE id='$PNEU_ID';"
# Esperado: ciclos += 5

# 3. Visual diff vs mockup-stint.html linhas 303-323

# 4. Package.resolved intacto
```

### Screenshots em `/tmp/p1-stint-selectors/`
- `stint-modal-pickers-vazio.png` — campos novos sem seleção
- `pneu-picker-empty.png` — carro sem pneus, com CTA cadastrar
- `pneu-picker-com-2.png` — 2 pneus, 1 selecionado (radio on)
- `combust-picker-com-2.png` — idem
- `stint-modal-preenchido.png` — tudo preenchido + qty=25

### PR title

```
feat(1A4): stint selectors (pneu + combust) + ciclos increment — Prompt #17
```

`gh pr create ...` — terminar com link.
````

---

# Prompt #18 — Pessoas Schema v2 (altura/peso/idade)

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #18 (Sprint 1A.4)

## CONTRATO DE EXECUÇÃO
[mesmo de #16]

**blockedBy:** #16 (colunas v2 em pilotos/passageiros)
**Paralelizável com:** #17 (zonas independentes)

## TAREFA

**Branch:** `feat/1A4-pessoas-v2` (worktree `../p1-fast-pessoas-v2`)
**Base:** `main` (após #16)

### Files a editar

- `ios/p1fast-ios/Sources/Views/PilotoCadastroView.swift` —
  adicionar 3 campos opcionais abaixo de "Nome":
  - "Altura (cm)" — input number, opcional
  - "Peso (kg)" — input number 1 decimal, opcional
  - "Data de nascimento" — DatePicker (apenas dia, sem hora), opcional
  - Remover HelperNote "altura/peso/idade virão depois" se existir.
- `ios/p1fast-ios/Sources/Views/PassageiroCadastroView.swift` — mesma coisa.
- `ios/p1fast-ios/Sources/Persistence/PilotoRepository.swift` —
  método `upsert` aceita os 3 campos novos, salva no GRDB.
- `ios/p1fast-ios/Sources/Persistence/PassageiroRepository.swift` — idem.

### Mockups canônicos

- `_design-reference/mockup-piloto-cadastro.html` — campos altura/peso/idade já desenhados ali.
- `_design-reference/mockup-passageiro-cadastro.html` — idem.

### Decisões pré-baked

1. **Todos os 3 campos opcionais**. Submit sem eles funciona (NULL no banco).

2. **Idade**: armazenar como timestamp Unix (segundos) do dia de nascimento.
   UI mostra DatePicker `.date` mode (sem hora). Calcular idade exibida em runtime se precisar (não armazenar idade calculada).

3. **Altura como Int (cm)**, **peso como Double (kg, 1 decimal)**.

4. **Edição de piloto/passageiro existente**: form pré-preenche com valores atuais; se NULL no banco, fica vazio no input (não chutar default).

5. **Validação**: alturaCm entre 100 e 230, pesoKg entre 30 e 200, nascimento entre 1900-01-01 e hoje. Se inválido, marcar input com border red e bloquear submit. Mensagem inline "{campo} parece fora do esperado".

### Verificação obrigatória

```bash
# Smoke + Build
cd ios/p1fast-core && swift run p1fast-smoke  # 158/0
xcodebuild ... build  # SUCCEEDED

# Persistência
DBPATH=$(...)

# Cadastrar piloto novo com altura/peso/data
sqlite3 "$DBPATH" "SELECT nome, altura_cm, peso_kg, nascimento FROM pilotos ORDER BY created_at DESC LIMIT 1;"
# Esperado: row com 3 valores não-NULL

# Editar piloto seedado (Flavio Marx) — adicionar altura
sqlite3 "$DBPATH" "SELECT altura_cm FROM pilotos WHERE id='piloto-mock-flavio';"
# Esperado: valor preenchido

# Cadastrar piloto sem nenhum dos 3 — todos NULL
sqlite3 "$DBPATH" "SELECT altura_cm, peso_kg, nascimento FROM pilotos WHERE nome='<nome>';"
# Esperado: NULL | NULL | NULL

# Package.resolved intacto
```

### Screenshots em `/tmp/p1-pessoas-v2/`
- `piloto-cadastro-3-campos.png` — form com 3 inputs novos visíveis
- `piloto-cadastro-preenchido.png` — todos preenchidos, válidos
- `piloto-cadastro-validacao.png` — altura=300, mostrando border red + msg
- `passageiro-cadastro-3-campos.png` — equivalente

### PR title

```
feat(1A4): pessoas schema v2 (altura/peso/nascimento) — Prompt #18
```

`gh pr create ...` — terminar com link.
````

---

# Review Playbook — PRs #33, #34, #14

## PR #33 (Pessoas, commit `5447864`)

**Status:** OPEN, mergeable, CI ✅ verde, sem review.

**Checklist:**
- [ ] PR description tem screenshots dos 4 launch args (`--p1-pessoas`, `--p1-pessoas-passageiros`, `--p1-piloto-novo`, `--p1-passageiro-novo`)?
- [ ] Renomeação BottomNav "Pessoas" funciona em todas as 4 views (Home, Eventos, Garagem, ThemeShowcase)?
- [ ] `seedPilotosIfEmpty()` removido de StintRepository — ✅ confirmado.
- [ ] Aliases `pilotoFlavioId`/`pilotoBrunoId` em StintRepository — débito documentado, cleanup planejado pro #16.
- [ ] HelperNote "altura/peso/idade" mencionada nos forms — débito documentado, cleanup pro #18.
- [ ] Smoke 158/0 — ✅.
- [ ] Build iOS SUCCEEDED — ✅.

**Decisão:** mergeável agora. Merge primeiro pra estabilizar base.

## PR #34 (Combustíveis, commit `fe61cbb`)

**Status:** OPEN, mergeable, CI ⏳ rodando (recém-aberto).

**🔴 Bug encontrado:**
- `ios/p1fast-core/Package.resolved` foi DELETADO (-72 linhas).
- Em main é tracked, sem entrada em .gitignore.
- Ação: pedir Cloud Code restaurar antes do merge:
  ```bash
  cd <worktree-combustiveis>
  git checkout main -- ios/p1fast-core/Package.resolved
  git add ios/p1fast-core/Package.resolved
  git commit -m "fix: restore Package.resolved (deleted by mistake)"
  git push
  ```

**🟡 Atenção:**
- `docs/CLOUD_CODE_QUEUE.md` (+160 linhas) entrou no PR via autosave race. Não bloqueia merge mas reviewer vê edits unrelated.
- Renomeação "Pessoas → Cadastros" em BottomNav — verificar se conflita com #33 (mesmas 4 views tocadas). Esperado: rebase trivial após #33 mergear.

**Checklist:**
- [ ] Package.resolved restaurado.
- [ ] CI verde (esperar ~1-2 min).
- [ ] Mapeamento mockup→schema implementado (nome, tipo=Observação, octanagem fora) — ✅ confirmado no diff.
- [ ] Sub-tab "Combustíveis" dentro de "Cadastros" — ✅ confirmado.
- [ ] Smoke 158/0 — esperado.
- [ ] Persistência sqlite — confirmada no PR description.

**Decisão:** mergear DEPOIS do #33 (rebase) E DEPOIS do fix Package.resolved.

## PR #14 (Pneus) — quando voltar

**Checklist visual diff:**
- [ ] `mockup-carro.html` linhas 213-231 (tire-list + tire-item + add-tire dashed) — visual <2%.
- [ ] `mockup-pneu-cadastro.html` — input + medida + 3-button rail + apelido omitido — visual <2%.

**Checklist estrutural:**
- [ ] Path: struct `Pneu` em `core/Models.swift`, repo em `ios/Persistence/PneuRepository.swift` (NÃO em core).
- [ ] `CarroModalView.sectionPneusCadastrados` (linhas 196-208 originais) substituído por lista real.
- [ ] `EmptyTireHint` e `AddTireButton` placeholders REMOVIDOS.
- [ ] Comentário "CRUD virá no Sprint 1A.4" REMOVIDO.

**Checklist mapeamento:**
- [ ] `Marca / composto` → `marca` (cru, sem parsear).
- [ ] `Medida` → `medida`.
- [ ] `Tipo` (Radial/Slick/Rua) → `composto` enum.
- [ ] `Apelido` omitido limpo (sem HelperNote).
- [ ] `ciclos` display formato `"{medida} · {composto} · {ciclos} voltas"` ou `"... · novo"`.

**Checklist persistência:**
- [ ] sqlite SELECT mostrando 2 pneus pro mesmo `carro_id`.
- [ ] Edit/delete confirmados.

**Checklist riscos:**
- [ ] `Package.resolved` NÃO tocado (lição #34).
- [ ] `StintRepository.swift` NÃO tocado (out of scope).
- [ ] Sem migration nova.
- [ ] Repo escopa por `carroId`.

**Decisão:** mergear DEPOIS de #33 + #34, branchando de main já com ambos aplicados.

---

## Sequência ótima de merge

1. **Agora**: você dispara #14 (worktree). Eu finalizo este doc.
2. **Em ~15min** (CI #34 termina): pedir Cloud Code restaurar Package.resolved no #34.
3. **Reviews**: você revisa #33 → merge. Pede rebase de #34 em main → merge.
4. **#14 volta** (~30-60min): aplicar checklist acima → merge.
5. **Sprint 1A.3 fechado**: disparar #16 (worktree).
6. **#16 mergeado**: disparar #17 e #18 em paralelo (worktrees separados).
7. **Sprint 1A.4 fechado**: pronto pra 1B (cockpit ao vivo).
