# Sprint DYNO — Cadastro do dinamômetro + Shift Light DYNO_CALIBRATED

> Status: **proposta**, baked após Phase 1A. Spec pra disparar pelo Cloud Code
> em uma sessão (DYNO-1 + DYNO-2 = MVP) ou três sessões separadas (com DYNO-3
> trazendo o algoritmo refinado com engine drag + tempo de troca).
>
> Pré-requisitos:
> - Phase 1A 100% (precisa `Modal Carro` existir, sync funcional, schema estável)
> - `docs/hardware/DINAMOMETRO_REQUISITOS.md` (formato CSV definido)
> - `docs/SHIFT_LIGHT_IMPLEMENTATION_PLAN.md` Bloco 6 (algoritmo MVP em JS)

## Contexto

O dono do carro leva o carro ao dinamômetro. Volta com 1 CSV (curva torque +
potência por RPM) + 1 anotação (gear ratios + final drive + diâmetro pneu).

O app precisa:
1. Receber o CSV via UI
2. Parsear em estrutura tipada
3. Calcular RPM ótimo de troca por marcha (não pico de torque — vide Bloco 6)
4. Persistir no `carros.dyno_curve` JSON
5. Mostrar resultado: tabela "RPM ótimo de troca por marcha" + tolerância

Quando feito, o `shift-target.js` (Bloco 1-5 do Shift Light, em hibernação até
Fase 2) passa a retornar `source: 'dyno'` em vez de `source: 'safe'`.
Cockpit mostra LED verde no RPM correto por marcha.

## ⚠ Princípio fundador: dyno é OPCIONAL

**O app P1 Fast funciona 100% sem dados de dinamômetro.** Todo carro nasce sem
dyno (incluindo o Celta seedado). Subir CSV é uma melhoria, não pré-requisito.

### Matriz feature × com_dyno × sem_dyno

| Feature | Com dyno | Sem dyno |
|---|---|---|
| Cadastrar carro | ✅ idem | ✅ idem (badge "Sem dyno" cinza) |
| Iniciar stint | ✅ idem | ✅ idem |
| Cockpit ao vivo (Sprint 1B) | ✅ shift point por marcha calculado da curva | ✅ shift point fixo = 0.9 × redline (modo SAFE) ou aprendido por telemetria (Bloco 2-5 do Shift Light) |
| Pós-stint / análise | ✅ ganha "% do tempo dentro da janela útil" | ✅ funciona sem essa métrica |
| Cockpit do engenheiro (Fase 2) | ✅ overlay de mapa ECU + alerta "fora da banda útil" | ✅ versão simplificada (RPM puro sem contexto da curva) |
| Sync com Supabase | ✅ idem (colunas extras serializadas em JSON) | ✅ idem (colunas NULL) |

### Implicações de design

1. **Toda coluna `dyno_*` é NULL-able** (já refletido no schema delta — usa `ALTER TABLE ADD COLUMN` sem NOT NULL).
2. **`ShiftPointCalculator.compute(curve:gearSpec:)` tem fallback**: sem `gearSpec` → `0.9 × redline` em todas marchas com `reason: "fallback_no_gear_ratios"`. Sem curve → não chama o calculator (UI não mostra tabela).
3. **Cockpit (Sprint 1B) consome `shift-target`** que já tem hierarquia `dyno > learned > safe` (vide `SHIFT_LIGHT_IMPLEMENTATION_PLAN.md` Bloco 2 — `source` enum). Carros sem dyno caem em `safe` ou `learned` automaticamente. Zero código condicional novo no cockpit.
4. **UI não bloqueia ações** quando falta dyno. Modal Carro mostra badge "Sem dyno" em cinza (sem urgência), não em vermelho (sem alarme falso).
5. **Onboarding implícito**: ao tap no badge "Sem dyno", oferece "Briefing pro técnico" (pra marcar o dyno) E "Cadastrar dyno" (pra subir CSV se já tem). Sem forçar nenhum dos dois.
6. **Seed Celta** (`SeedBrasilia.swift`) NÃO popula campos `dyno_*` — fica NULL. Quando Flávio levar o Celta ao dyno e subir o CSV, vira o primeiro carro com dyno do app.

### O que isso bloqueia (pra revisões futuras)

- **Não criar requirement em outras telas** "precisa ter dyno cadastrado pra usar X". Se aparecer regra desse tipo no futuro, refatorar a regra ou criar fallback explícito antes.
- **Não rodar query SQL com `WHERE dyno_curve_json IS NOT NULL`** sem fallback claro pro caso vazio.
- **Não mostrar erro/aviso "carro sem dyno"** em telas que não são o Modal Carro. Outras telas tratam ausência como estado normal.

## Decisões pré-baked

### Persistência: JSON em coluna, não tabela separada

`carros.dyno_curve_json TEXT NULL` — JSON serializado. Trade-off escolhido: mais
simples (1 migration, 1 row por carro), aceita penalidade de não poder fazer
SELECT em pontos individuais (não precisa). Mesma decisão pra
`engine_drag_json` (DYNO-3).

### Algorithm V1 (DYNO-1): power crossover (igual Bloco 6 MVP)

```
alvo_rpm(N → N+1) = primeiro RPM onde power_at_wheel(rpm * gear_N+1/gear_N, N+1) > power_at_wheel(rpm, N)
```

Sem engine drag, sem shift time. Documentar como simplificação. Fallback se
falta gear_ratios: 90% do redline detectado.

### Algorithm V2 (DYNO-3, opcional): adiciona engine drag + tempo de troca

Refina o V1 considerando que durante o intervalo de troca (X ms, configurável
por carro, default 250ms) o motor cai de RPM segundo a curva de drag.
**Não no MVP** — entra em PR separado depois que MVP funcionar.

### Tolerância: auto 5% da janela útil

Janela útil = RPM onde power ≥ 95% pico. Tolerance = largura * 0.05.
Clamp [80, 250 RPM]. Editável manualmente.

### Onde fica a UI

Modal Carro ganha aba "Dinamômetro" (mockup-carro.html linhas a definir, mas
respeitando padrão B). Sem tela dedicada — está conceitualmente atrelado ao
carro.

### Formato CSV aceito (V1)

Apenas o canônico: `rpm,torque_nm,power_kw` (header obrigatório). Auto-detecção
Dynojet/Mustang/Dynapack fica fora do MVP — o técnico/dono do carro converte
antes de subir. Validação: 3 colunas, ≥ 5 pontos, RPM crescente, sem nulos.

### Smoke tests obrigatórios

Mesmas validações do `dyno-target-calculator.spec.js` JS, portadas pra Swift:
parser feliz, parser inválido, calculator com fallback, calculator com
gear_ratios, tolerância clamping. Fixtures: 1 CSV de exemplo Celta plausível
(adultere os valores ali, não use dyno real ainda).

## Schema delta

```sql
-- Migration 0007 (Postgres) + GRDB v6_dyno
ALTER TABLE carros ADD COLUMN gear_ratios TEXT;            -- JSON: {"1":3.18,"2":1.78,...,"final":4.93}
ALTER TABLE carros ADD COLUMN final_drive REAL;            -- duplicado em gear_ratios.final pra query rápida
ALTER TABLE carros ADD COLUMN tire_diameter_cm REAL;
ALTER TABLE carros ADD COLUMN dyno_curve_json TEXT;        -- JSON: [{"rpm":2000,"torque_nm":82.4,"power_kw":17.3},...]
ALTER TABLE carros ADD COLUMN dyno_uploaded_at INTEGER;    -- epoch ms
ALTER TABLE carros ADD COLUMN dyno_redline_rpm INTEGER;    -- auto-detectado, editável
ALTER TABLE carros ADD COLUMN dyno_tolerance_rpm INTEGER;  -- auto-calculado, editável
-- Reservado pra DYNO-3 (não criar agora):
-- ALTER TABLE carros ADD COLUMN engine_drag_json TEXT;
-- ALTER TABLE carros ADD COLUMN shift_time_up_ms INTEGER;
-- ALTER TABLE carros ADD COLUMN shift_time_down_ms INTEGER;
```

---

# Prompt DYNO-1 — Parser + Calculator + Schema (sem UI)

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt DYNO-1 (módulo dinamômetro core)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-dyno-core feat/dyno-1-core`
- Branchar de `main` (após Phase 1A 100%)
- Editar arquivos no escopo, rodar build/smoke, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- Aplicar migration em prod Supabase — não rodar `supabase db push`/`supabase link`
- Tocar UI (DynoUploadView fica pra DYNO-2)
- Implementar engine drag ou shift time — explicitamente fora do MVP (DYNO-3)
- Tocar arquivos fora do escopo

### Convenções de nome
- Migration GRDB: `m.registerMigration("v6_dyno")` no `register(into:)`, DEPOIS de outras v* já registradas
- Migration Postgres: `supabase/migrations/0007_dyno_carros.sql`

## TAREFA

**Branch:** `feat/dyno-1-core` (worktree `../p1-fast-dyno-core`)
**Base:** `main` (após Phase 1A fechada)

### Files a criar

- `ios/p1fast-core/Sources/P1FastCore/Dyno/DynoCurve.swift` — struct `DynoCurve` (Codable):
  ```swift
  public struct DynoPoint: Codable, Equatable {
      public let rpm: Int
      public let torqueNm: Double
      public let powerKw: Double
  }
  public struct DynoCurve: Codable, Equatable {
      public let points: [DynoPoint]
      public var redlineRpm: Int { get }   // last point's rpm
      public var peakPowerRpm: Int { get } // rpm of max powerKw
      public var peakTorqueRpm: Int { get }// rpm of max torqueNm
      public func powerAt(rpm: Int) -> Double  // linear interpolation
      public func torqueAt(rpm: Int) -> Double // linear interpolation
  }
  ```

- `ios/p1fast-core/Sources/P1FastCore/Dyno/GearSpec.swift` — struct `GearSpec`:
  ```swift
  public struct GearSpec: Codable, Equatable {
      public let ratios: [Int: Double]  // {1: 3.18, 2: 1.78, ...}
      public let finalDrive: Double
      public let tireDiameterCm: Double
  }
  ```

- `ios/p1fast-core/Sources/P1FastCore/Dyno/DynoCsvParser.swift` — parser puro:
  ```swift
  public enum DynoCsvParseError: Error {
      case missingHeader, invalidColumns, tooFewPoints, nonMonotonicRpm, nullValue(line: Int)
  }
  public enum DynoCsvParser {
      public static func parse(_ text: String) throws -> DynoCurve
      // Header obrigatório: "rpm,torque_nm,power_kw" (case-insensitive, espaços ignorados)
      // ≥ 5 pontos
      // RPM estritamente crescente
      // Sem nulos / strings não-numéricas
      // Suporta separadores , ou ; (auto-detect pela 1ª linha)
      // Suporta . ou , como decimal (auto-detect pela primeira célula numérica)
  }
  ```

- `ios/p1fast-core/Sources/P1FastCore/Dyno/ShiftPointCalculator.swift` — algoritmo:
  ```swift
  public struct ShiftPoint: Codable, Equatable {
      public let fromGear: Int
      public let toGear: Int
      public let optimalRpm: Int
      public let toleranceRpm: Int
      public let reason: String  // "power_crossover" ou "fallback_no_gear_ratios"
  }
  public enum ShiftPointCalculator {
      // V1 algorithm: power crossover (sem engine drag, sem shift time)
      public static func compute(curve: DynoCurve, gearSpec: GearSpec?) -> [ShiftPoint]
      // Se gearSpec == nil → fallback: cada marcha 1..5 retorna 0.9 * redlineRpm com reason="fallback_no_gear_ratios"
  }

  public enum ToleranceCalculator {
      public static func compute(curve: DynoCurve, percent: Double = 0.05) -> Int
      // Janela útil = RPM onde power ≥ 95% pico
      // Tolerance = janela_largura * percent, clamp [80, 250]
  }
  ```

- `supabase/migrations/0007_dyno_carros.sql` — espelho Postgres:
  ```sql
  ALTER TABLE carros ADD COLUMN gear_ratios text;
  ALTER TABLE carros ADD COLUMN final_drive numeric;
  ALTER TABLE carros ADD COLUMN tire_diameter_cm numeric;
  ALTER TABLE carros ADD COLUMN dyno_curve_json text;
  ALTER TABLE carros ADD COLUMN dyno_uploaded_at bigint;
  ALTER TABLE carros ADD COLUMN dyno_redline_rpm integer;
  ALTER TABLE carros ADD COLUMN dyno_tolerance_rpm integer;
  ```

### Files a editar

- `ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift` — adicionar
  `m.registerMigration("v6_dyno")` no `register(into:)`:
  ```swift
  m.registerMigration("v6_dyno") { db in
      try db.execute(sql: "ALTER TABLE carros ADD COLUMN gear_ratios TEXT;")
      try db.execute(sql: "ALTER TABLE carros ADD COLUMN final_drive REAL;")
      try db.execute(sql: "ALTER TABLE carros ADD COLUMN tire_diameter_cm REAL;")
      try db.execute(sql: "ALTER TABLE carros ADD COLUMN dyno_curve_json TEXT;")
      try db.execute(sql: "ALTER TABLE carros ADD COLUMN dyno_uploaded_at INTEGER;")
      try db.execute(sql: "ALTER TABLE carros ADD COLUMN dyno_redline_rpm INTEGER;")
      try db.execute(sql: "ALTER TABLE carros ADD COLUMN dyno_tolerance_rpm INTEGER;")
  }
  ```

- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — `Carro` ganha
  campos opcionais:
  ```swift
  public var gearRatios: String?           // JSON serializado de GearSpec.ratios
  public var finalDrive: Double?
  public var tireDiameterCm: Double?
  public var dynoCurveJson: String?        // JSON serializado de DynoCurve
  public var dynoUploadedAt: Int64?
  public var dynoRedlineRpm: Int?
  public var dynoToleranceRpm: Int?
  ```
  + atualizar CodingKeys com snake_case mapping.

- `ios/p1fast-core/Sources/P1FastSmoke/main.swift` — adicionar suite "DYNO":
  ```
  DYNO-01: parser CSV válido → DynoCurve com pontos corretos
  DYNO-02: parser CSV com header errado → throws missingHeader
  DYNO-03: parser CSV com < 5 pontos → throws tooFewPoints
  DYNO-04: parser CSV com RPM não-monotônico → throws nonMonotonicRpm
  DYNO-05: parser CSV com vírgula decimal (formato BR) → parseia ok
  DYNO-06: parser CSV com separador ; → parseia ok
  DYNO-07: DynoCurve.powerAt interpola entre pontos
  DYNO-08: ShiftPointCalculator com gear_ratios → power crossover correto
  DYNO-09: ShiftPointCalculator sem gear_ratios → fallback 0.9*redline
  DYNO-10: ToleranceCalculator com janela útil ampla → clamp 250
  DYNO-11: ToleranceCalculator com janela útil estreita → clamp 80
  DYNO-12: Round-trip — DynoCurve → JSON → DynoCurve preserva todos os pontos
  ```

### Fixtures

- `ios/p1fast-core/Sources/P1FastCore/Dyno/Fixtures/celta-plausivel.csv` — 30
  linhas plausíveis pra um Celta 1.4 turismo:
  ```csv
  rpm,torque_nm,power_kw
  2000,82.4,17.3
  2200,85.1,19.6
  2400,88.7,22.3
  ...
  6800,71.2,50.7
  ```
  (Não use dyno real — é fixture pra teste, não baseline calibrado.)

### Decisões pré-baked

1. **JSON em coluna, não tabela separada**. `dyno_curve_json` é TEXT.
2. **V1 sem engine drag / shift time** — DYNO-3 trará. Documentar `reason: "power_crossover"` em ShiftPoint.
3. **Fallback**: sem gear_ratios → 0.9 * redline em todas marchas, `reason: "fallback_no_gear_ratios"`.
4. **Tolerance clamp [80, 250]**.
5. **CSV V1 = só formato canônico** `rpm,torque_nm,power_kw`. Dynojet/Mustang/Dynapack auto-detect fica pra V2.
6. **Sem UI neste PR** — DYNO-2 traz.

### Verificação obrigatória

```bash
cd ios/p1fast-core && swift run p1fast-smoke  # esperado: 158 + 12 = 170/0
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build  # SUCCEEDED

# Verificar migration aplicada
DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)
sqlite3 "$DBPATH" ".schema carros" | grep -cE "gear_ratios|final_drive|tire_diameter_cm|dyno_curve_json|dyno_uploaded_at|dyno_redline_rpm|dyno_tolerance_rpm"
# Esperado: 7

# Round-trip JSON
swift -e '
import Foundation
let json = """[{"rpm":2000,"torque_nm":82.4,"power_kw":17.3},{"rpm":4000,"torque_nm":110.5,"power_kw":46.3}]"""
// (decodifica + recodifica no smoke)
'

git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved
# Esperado: vazio
```

### PR

**Title:** `feat(dyno-1): parser CSV + ShiftPointCalculator + schema v6 — Prompt DYNO-1`

**Body:**
```markdown
## Sprint DYNO — Prompt DYNO-1 (core, sem UI)

### Schema v6_dyno (GRDB) + 0007_dyno_carros.sql (Postgres)
- carros: +gear_ratios, +final_drive, +tire_diameter_cm, +dyno_curve_json, +dyno_uploaded_at, +dyno_redline_rpm, +dyno_tolerance_rpm

### Módulos novos (p1fast-core/Dyno/)
- DynoCurve.swift (struct + interpolação)
- GearSpec.swift
- DynoCsvParser.swift (formato canônico rpm,torque_nm,power_kw)
- ShiftPointCalculator.swift (V1 power crossover)
- Fixtures/celta-plausivel.csv

### Smoke (12 testes novos)
- 6 do parser (header, count, monotonicidade, vírgula decimal BR, separador ;)
- 5 do calculator/tolerance
- 1 round-trip JSON

### Verificação
- swift-smoke: 170/0 (158 + 12)
- xcodebuild: SUCCEEDED
- sqlite: 7 colunas novas em carros
- Package.resolved intacto

### Out-of-scope (próximos PRs)
- UI cadastro: DYNO-2
- Engine drag + shift time: DYNO-3
```

### Comando final
`gh pr create --title "..." --body "..."` — terminar com o link.
````

---

# Prompt DYNO-2 — UI cadastro no Modal Carro

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt DYNO-2 (UI upload + display)

## CONTRATO DE EXECUÇÃO
[mesmo de DYNO-1]

**blockedBy:** DYNO-1 (precisa Models + Parser + Calculator)

## TAREFA

**Branch:** `feat/dyno-2-ui` (worktree `../p1-fast-dyno-ui`)
**Base:** `main` (após DYNO-1 mergeado)

### Files a criar

- `ios/p1fast-ios/Sources/Views/DynoBriefingView.swift` — tela "Briefing pro técnico":
  - Header: "Briefing pro técnico do dinamômetro"
  - Sub: "Copie o texto abaixo e envie pro técnico via WhatsApp/email antes de levar o {apelido}."
  - Block de texto formatado pré-preenchido com nome do carro + modelo + categoria. Conteúdo extraído de `DynoBriefingText.swift` (vide abaixo).
  - 3 botões no footer:
    - **"Copiar texto"** → `UIPasteboard.general.string = texto` + toast "Copiado"
    - **"Enviar via WhatsApp"** → `UIApplication.shared.open(URL(string: "whatsapp://send?text=\(encoded)")!)` com fallback `https://wa.me/?text=...` se WhatsApp não instalado
    - **"Outras opções"** → `UIActivityViewController` (share sheet padrão — Email, Mensagens, qualquer app)
  - Acesso: botão "Briefing pro técnico" no header da DynoUploadView (quando ainda não há CSV) E na seção Dinamômetro do Modal Carro (qualquer momento).

- `ios/p1fast-core/Sources/P1FastCore/Dyno/DynoBriefingText.swift` — constante
  com template do briefing (versão WhatsApp-friendly do `docs/hardware/DINAMOMETRO_REQUISITOS.md`):
  ```swift
  public enum DynoBriefingText {
      public static func generate(carroApelido: String, carroModelo: String?) -> String {
          // Template definido na seção "Conteúdo do briefing" abaixo.
          // Substitui {apelido} e {modelo} dinamicamente.
      }
  }
  ```

- `ios/p1fast-ios/Sources/Views/DynoUploadView.swift` — sheet acionado pelo
  Modal Carro:
  - Botão "Carregar CSV" (`.fileImporter` → .commaSeparatedText)
  - Após pick: roda `DynoCsvParser.parse(text)` → mostra preview
    - "12 pontos · redline 6800 RPM · pico 50.7 kW @ 5400 RPM"
    - Lista colapsável de pontos (RPM | Nm | kW)
  - Form: gear_ratios (1ª-5ª + ré + final + diâmetro pneu)
  - Botão "Calcular shift points" → roda `ShiftPointCalculator.compute(...)` ao vivo, mostra tabela:
    | De → Para | RPM ótimo | Tolerância |
    | 1 → 2 | 6200 | ±150 |
    | 2 → 3 | 6400 | ±150 |
    ...
  - Erros do parser mostrados inline em vermelho com linha do CSV (quando disponível)
  - Botão "Salvar" → `DynoRepository.upsertDyno(carroId:curve:gearSpec:)` + fecha sheet
  - Footer "Cancelar / Salvar" igual padrão dos outros forms

- `ios/p1fast-ios/Sources/Persistence/DynoRepository.swift` — async CRUD:
  ```swift
  func upsertDyno(carroId: String, curve: DynoCurve, gearSpec: GearSpec?, redlineRpm: Int?, toleranceRpm: Int?) async throws
  func loadDyno(carroId: String) async throws -> (curve: DynoCurve, gearSpec: GearSpec?, redlineRpm: Int, toleranceRpm: Int)?
  func deleteDyno(carroId: String) async throws  // limpa colunas dyno_*
  ```

- `ios/p1fast-ios/Sources/Views/DynoResultadoView.swift` — visualização
  read-only (acessível por tap no badge "Dyno" do Modal Carro):
  - Header: "Dinamômetro" + data do upload
  - Cards: "Pico de potência X kW @ Y RPM", "Pico de torque X Nm @ Y RPM", "Redline Z RPM"
  - Tabela "RPM ótimo de troca" (conforme acima)
  - Botão "Re-carregar" → abre DynoUploadView com valores atuais pré-preenchidos
  - Botão "Apagar dados do dinamômetro" (destrutivo, com alert)

### Files a editar

- `ios/p1fast-ios/Sources/Views/CarroModalView.swift` — adicionar:
  - Aba/seção "Dinamômetro" no header
  - Se carro NÃO tem dyno: badge cinza "Sem dyno" + 2 CTAs:
    - "Briefing pro técnico" → DynoBriefingView (pra mandar antes de ir ao dyno)
    - "Cadastrar dyno" → DynoUploadView (depois que voltar com o CSV)
  - Se carro TEM dyno: badge verde "Dyno · pico X kW" + tap → DynoResultadoView
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — launch args novos:
  - `--p1-dyno-briefing` → abre DynoBriefingView do primeiro carro
  - `--p1-dyno-upload` → abre DynoUploadView do primeiro carro
  - `--p1-dyno-resultado` → abre DynoResultadoView (carro com dyno seedado pra preview)

### Mockup canônico

(A criar — escopo paralelo do design.) Por enquanto: seguir padrão B + reusar
componentes do `mockup-carro.html` (mesma estética header, cards, tabelas).

### Conteúdo do briefing (template literal pra `DynoBriefingText.generate`)

```
Olá! Vou levar o {apelido} ({modelo}) pro dinamômetro. Estou usando um app de
telemetria pessoal pra track day e preciso de dados crus pra alimentar o app.
O técnico não precisa entregar relatório formatado — só os arquivos CSV.

==== ESSENCIAL (sem isto não consigo usar nada no app) ====

1) Curva torque + potência (run wide-open throttle)
   Formato CSV com 3 colunas, 1 linha por amostra:
   rpm,torque_nm,power_kw
   Granularidade: 200 RPM ou menos. Range: do RPM mínimo confiável (~2000)
   até o redline real. Torque em N·m, potência em kW (não cv).

==== IMPORTANTE (destrava cálculo refinado de Shift Light) ====

2) Tempo médio de troca de marcha (subir e descer) — referência observada do
   técnico, ou eu meço depois com vídeo
3) Engine drag / motoring run — torque negativo × RPM (motor girando sem
   combustão pra medir perdas internas):
   rpm,drag_torque_nm
4) Gear ratios + final drive + diâmetro do pneu (não é dyno data, mas anote junto)

==== ÚTIL pra Fase 2 (ECU live) ====

Se a ECU Injepro estiver conectada durante o run, pedir export bruto de:
5) AFR / Lambda × RPM
6) EGT (temperatura escapamento) × RPM
7) Pressão de óleo + temperatura de óleo × RPM
8) Mapas da ECU exportados (avanço de ignição, tempo de injeção, lambda alvo)
9) Log de eventos de detonação (knock detection)

==== NÃO PRECISA ====

- Relatório PDF "bonito" (use o tempo em mais runs ou granularidade fina)
- Conversão pra cv/HP — kW é o canônico do app
- Análise comparativa com outros carros
- Mapa "otimizado pelo dyno" — tunagem é decisão minha

==== FORMATO ====

Salvar tudo em CSV bruto numa pasta. Posso levar pen drive vazio. Anotar:
modelo do dyno (Bosch/Mustang/etc), nome do técnico pra dúvidas posteriores,
temperatura do óleo no início e fim de cada run.

Obrigado!
```

(Manter texto puro — sem markdown, sem emojis. WhatsApp renderiza só texto +
quebras de linha.)

### Decisões pré-baked

1. **Sheet, não NavigationLink.** Upload é momento focado, não fluxo.
2. **`.fileImporter` SwiftUI nativo** — sem libs.
3. **Preview ao vivo enquanto edita gear_ratios** — recálculo síncrono, não persiste até "Salvar".
4. **Erros legíveis** — usar `DynoCsvParseError` description, mostrar linha do CSV se disponível.
5. **Edit = re-upload**. Sem editor inline de pontos no MVP.
6. **Delete confirma** com alert "Apagar dados do dinamômetro do {apelido}? Não dá pra desfazer."
7. **Briefing texto puro** — sem markdown, sem emojis. WhatsApp renderiza só texto e quebras de linha. Princípio "sem ícones decorativos" da memória do P1 Fast aplica também na mensagem que sai do app.
8. **WhatsApp deeplink primeiro, share sheet como fallback.** Botão "Enviar via WhatsApp" tenta `whatsapp://send?text=...`; se WhatsApp não está instalado, cair em `https://wa.me/?text=...` (abre browser → site web do WhatsApp). Se nem isso, mostrar share sheet padrão. Botão separado "Outras opções" sempre abre share sheet.
9. **Briefing template per-car** — `DynoBriefingText.generate(carroApelido, carroModelo)` substitui placeholders. Sem cache do texto gerado (cheap o suficiente pra rodar a cada abertura).
10. **Briefing acessível em 2 lugares**: header da DynoUploadView (quando ainda não tem CSV) E seção Dinamômetro do Modal Carro (sempre). Pra cobrir os dois fluxos: quem está prestes a marcar o dyno (Modal Carro) e quem já marcou e está revendo o que pedir (DynoUploadView).

### Verificação obrigatória

```bash
cd ios/p1fast-core && swift run p1fast-smoke  # 170/0 mantido
xcodebuild ... build  # SUCCEEDED

# Smoke E2E manual:
# 1. Abrir simulator com --p1-dyno-upload
# 2. File picker abre, escolher fixture celta-plausivel.csv
# 3. Preview mostra 30 pontos · redline 6800 · pico ~50 kW
# 4. Preencher gear ratios (3.18, 1.78, 1.18, 0.85, 0.69, final 4.93, pneu 56.5)
# 5. Tabela de shift points popula
# 6. Salvar → fecha sheet → badge no Modal Carro vira verde "Dyno · pico 50 kW"
# 7. Tap no badge → DynoResultadoView mostra mesmo conteúdo

# Persistência
DBPATH=$(...)
sqlite3 "$DBPATH" "SELECT dyno_curve_json IS NOT NULL, dyno_redline_rpm, dyno_tolerance_rpm FROM carros WHERE apelido='Celta';"
# Esperado: 1|6800|XXX

# Re-upload sobrescreve sem duplicar
sqlite3 "$DBPATH" "SELECT COUNT(*) FROM carros WHERE apelido='Celta';"
# Esperado: 1 (não duplicou row)

git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved
```

### Screenshots em `/tmp/p1-dyno-ui/`
- `modal-carro-sem-dyno.png` (badge cinza + 2 CTAs: briefing + cadastrar)
- `dyno-briefing.png` (texto pré-preenchido + 3 botões no footer)
- `dyno-upload-vazio.png` (sheet inicial com link "Briefing pro técnico" no header)
- `dyno-upload-preview.png` (CSV carregado, preview + form gear)
- `dyno-upload-erro-csv.png` (CSV inválido, erro inline)
- `modal-carro-com-dyno.png` (badge verde após salvar)
- `dyno-resultado.png` (view read-only)

### Verificação extra (briefing)

```bash
# Smoke E2E manual:
# 1. Abrir simulator com --p1-dyno-briefing
# 2. Tela mostra texto começando "Olá! Vou levar o {apelido} ({modelo}) pro dinamômetro..."
# 3. Tap "Copiar texto" → toast "Copiado" + clipboard contém ~1500 caracteres
# 4. Tap "Enviar via WhatsApp" → abre WhatsApp com texto pré-preenchido (testar com WhatsApp instalado E não-instalado no simulator pra cobrir fallback)
# 5. Tap "Outras opções" → share sheet padrão iOS aparece
# 6. Acessar mesmo briefing via Modal Carro → "Briefing pro técnico" CTA
```

### PR

**Title:** `feat(dyno-2): UI upload + briefing técnico via WhatsApp + DynoResultadoView — Prompt DYNO-2`

**Body:**
```markdown
## Sprint DYNO — Prompt DYNO-2 (UI completa)

### DynoBriefingView (novo)
- Texto template per-car com lista do que pedir/não pedir ao técnico
- Botão "Copiar texto" (UIPasteboard)
- Botão "Enviar via WhatsApp" (deeplink whatsapp:// com fallback wa.me)
- Botão "Outras opções" (UIActivityViewController padrão)
- Acessível: header DynoUploadView + Modal Carro seção Dinamômetro

### DynoUploadView (novo)
- File picker .commaSeparatedText
- Preview ao vivo: pontos + redline + pico
- Form gear ratios + final drive + diâmetro pneu
- Tabela "RPM ótimo de troca" recalculada ao vivo
- Botão Salvar + footer Cancelar/Salvar

### DynoResultadoView (novo)
- Visualização read-only após upload
- Cards de pico + tabela shift points
- Botão Re-carregar + Apagar

### CarroModalView (estendido)
- Aba Dinamômetro: badge cinza/verde + CTAs

### Verificação
- swift-smoke: 170/0 mantido
- xcodebuild: SUCCEEDED
- Smoke manual E2E: briefing copia+envia, upload+preview+save, badge atualiza
- Persistência sqlite: 7 colunas dyno_* preenchidas após save
- Package.resolved intacto
```
````

---

# Prompt DYNO-3 — Engine drag + tempo de troca (algorithm V2)

> **Opcional / Fase 2.** Não rodar até MVP (DYNO-1 + DYNO-2) estar mergeado e
> validado em pista (Flávio confirma "shift point ótimo bate com sensação real").
>
> O que adiciona ao algorithm V1:
>
> 1. Schema delta: `engine_drag_json TEXT`, `shift_time_up_ms INTEGER`, `shift_time_down_ms INTEGER` (já reservados no design, vide acima).
> 2. Parser pra CSV de engine drag (`rpm,drag_torque_nm`).
> 3. Algoritmo V2 em `ShiftPointCalculator.computeV2(...)` que considera:
>    - Durante shift_time_up_ms, motor cai de RPM segundo curva de drag
>    - Alvo = RPM onde, APÓS a queda durante a troca, o motor cai EXATAMENTE no RPM onde a power crossover original ocorreria
>    - Resultado: shift point levemente MAIS ALTO que V1 (pra compensar a queda)
> 4. UI nova no DynoUploadView: 2ª aba "Engine drag + tempo de troca" com upload do drag CSV + 2 inputs de tempo
> 5. Smoke V2: 5 testes adicionais (drag interpolação, queda calculada, shift point V2 ≥ V1, fallback sem drag = V1)

Spec completa fica pra quando MVP validado. Não bake agora pra evitar
over-engineering antes de feedback real.

---

## Ordem ótima

```
Pré-requisito Flávio: levar carro ao dyno + ter CSV em mãos
                       (vide docs/hardware/DINAMOMETRO_REQUISITOS.md)

Disparar DYNO-1 (core sem UI)              ~1 PR
  → mergear → migration 0007 aplicada manualmente em prod Supabase
Disparar DYNO-2 (UI no Modal Carro)        ~1 PR
  → mergear → upload do CSV real do Celta no app
  → validar shift points sugeridos vs sensação em pista (3-5 stints)

Se shift points fazem sentido em pista:
  Disparar DYNO-3 (algorithm V2 com drag)  ~1 PR (opcional, refino)

Se shift points estão errados:
  Investigar: gear ratios certos? CSV com pontos suficientes?
  Eventualmente DYNO-3 vira mandatório
```

## Estimativa de tamanho

- DYNO-1: ~600 LOC (4 arquivos novos + 2 editados + 12 testes + 1 fixture). Sessão Cloud Code: ~30-45 min.
- DYNO-2: ~400 LOC (3 arquivos novos + 2 editados). Sessão Cloud Code: ~25-35 min.
- DYNO-3: ~300 LOC adicionais. Sessão futura.

## Pré-requisitos antes de bakear pra Cloud Code

- [ ] Phase 1A 100% (todos os 8 PRs restantes mergeados)
- [ ] Migration 0006 aplicada em prod ✅ (já feito 2026-05-03)
- [ ] CSV do dyno em mãos (Flávio leva o carro)
- [ ] Gear ratios + final drive + diâmetro pneu confirmados (consultar oficina ou ficha)
- [ ] Decisão: bakear DYNO-1 e DYNO-2 separados ou bundle único? Recomendação: separados (PR menor = audit mais rápido + risco menor de rebase).
