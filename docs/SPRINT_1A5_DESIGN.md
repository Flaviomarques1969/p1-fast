> ⚠️ **DOCUMENTO OBSOLETO** — preservado pra histórico (auditoria 2026-05-12).
>
> A nomenclatura "Sprint 1A.X" foi substituída em 2026-05-03 pelo esquema
> "MS-X" do `docs/PLANO_FASE_1.md`. O escopo descrito aqui foi entregue e
> mergeado faz tempo. Não usar como guia pra trabalho novo.
>
> Referência canônica vigente: `STATUS.md` + `docs/PLANO_FASE_1.md`.

---

# Sprint 1A.5 — Trechos + Lições + Pendências + Setup Avançado

> Status: **proposta**, baked após Sprint 1A.3/1A.4. Documento pré-prompt
> pra travar escopo ANTES do Cloud Code começar. Todos os 4 prompts abaixo
> são executáveis autônomos com preâmbulo de execução completa.

## Contexto

Após Sprint 1A.3 (cadastros básicos) + 1A.4 (stint flow integrado), restam
4 telas do "hub iOS" que cobrem aprendizado pedagógico, manutenção e setup:

1. **#19 — Trechos da pista** — UI de curvas com tags (Lenta/Média/Rápida + Apex). Schema `tracks`/`track_layouts`/`track_segments` já existe em v1.
2. **#20 — Catálogo de lições** — porta as 12 lições canônicas do JS (`src/data/lesson-library.js`) pra Swift. Schema novo (`licoes`).
3. **#21 — Pendências cascata** — porta os 6 grupos de checklist do JS (`src/data/schemas.js` → `SEED_PEND_TIPOS`). Schema novo (`pendencias_template`, `evento_pendencias`).
4. **#22 — Setup avançado dedicado** — visualização agrupada dos 14 overrides já existentes em `configuracoes.overrides` (CarroSetupOverrides). Sem schema novo.

**Sequência sugerida**: #19 → #20 e #21 em paralelo → #22 (depende de nada novo, só refactor visual).

**Schema delta v3** (necessário pra #20 + #21):
```sql
-- Lições canônicas (catálogo, não por usuário)
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

-- Templates de pendência (catálogo de checklist items)
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

-- Instâncias de pendência por evento (checadas/não checadas)
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
CREATE INDEX idx_evento_pendencias_evento ON evento_pendencias(evento_id);
```

---

# Prompt #19 — Trechos UI + seed Brasília

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #19 (Sprint 1A.5)

## CONTRATO DE EXECUÇÃO

Pré-autorizado pelo Flávio Marques. Execute do início ao fim sem perguntar.
Se ambíguo, escolha conservador, documente, continue.
Se teste falhar, debugue e re-rode até passar (max 3x mesma raiz).
Se fundamentalmente impossível, abra `[DRAFT]` com erro detalhado.

### Autorizado
- `git worktree add ../p1-fast-trechos feat/1A5-trechos`
- Branchar de `main` (depois de Sprint 1A.4 fechado — confirmar com `git log --oneline main | head -5`)
- Editar arquivos no escopo, rodar build/smoke/sqlite, commit, push, `gh pr create`

### NÃO autorizado
- Force push, merge em main, trocar branch no checkout principal
- Tocar `Package.resolved`, `.gitignore`, settings, CI
- Tocar arquivos fora do escopo
- Adicionar funcionalidade nova além de listar trechos + seed Brasília

### Pré-requisito (verificar antes de começar)
```bash
cd /Users/imac/Projetos/P1\ Fast
git fetch origin
git log --oneline origin/main | head -10
# Esperado: ver merges de #16 + #17 + #18 (Sprint 1A.4). Se não vir, ABORTAR.
```

## TAREFA

**Branch:** `feat/1A5-trechos` (worktree `../p1-fast-trechos`)
**Base:** `main` (após Sprint 1A.4 mergeado)

### Files a criar

- `ios/p1fast-ios/Sources/Views/TrechoListaView.swift` — lista de trechos do layout ativo, agrupados por parcial. Reusar visual de `mockup-trecho-lista.html` em modo CRUD-readonly (sem radio, sem footer — selector de stint vem depois).
- `ios/p1fast-ios/Sources/Persistence/TrackRepository.swift` — CRUD básico: list tracks, list layouts por track, list segments por layout.
- `ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift` (já existe! ESTENDER) — adicionar seed de tracks/layouts/segments do circuito Brasília. Não criar novo arquivo.

### Files a editar

- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — adicionar structs `Track`, `TrackLayout`, `TrackSegment`, `Marco` (Codable + GRDB), seguindo padrão de `Carro` e `Combustivel`.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — adicionar entrypoint pra TrechoListaView (sub-tab dentro de Cadastros OU acessível via botão na GaragemView). Decisão pré-baked: **botão "Trechos da pista" no header da Garagem** (1 toque, não polui sub-tabs).

### Mockup canônico

`_design-reference/mockup-trecho-lista.html`. Notar: original é stint-selector (radio + footer "Voltar"). Em 1A.5 entra como **CRUD readonly**:
- Sem radio
- Sem footer
- Header eyebrow "Trechos da pista" + título "Brasília" + sub "8 trechos"
- Group heads "Parcial 1 · Saída do box" / "Parcial 2 · Junção" / etc. (do seed)
- `trecho-row` mostra nome + tags (Lenta/Média/Rápida + Apex tardio/neutro/precoce)
- Botão "Sem trecho específico" omitido (só faz sentido como selector)

### Decisões pré-baked

1. **Surface**: botão "Trechos da pista" no header da `GaragemView` (acima do FAB "Novo carro"). Tap abre `TrechoListaView` em push (NavigationStack). Sem sub-tab.

2. **Seed Brasília** em `SeedBrasilia.swift` — track + 1 layout "Padrão" + 8 segments distribuídos em 3 parciais. Nomes canônicos: "Curva 01", "Mergulho da Bruxa", "Curva 2", "Junção", "S das Quebradas", "Curva 6", "Cotovelo", "Última Curva". Tags por curva (categoria + apex) num comentário inline pra v1; campo `tags` no schema fica pra v2.

3. **Sem CRUD de criar/editar/deletar trecho neste PR**. Trecho é vinculado a layout, layout a track — toda essa hierarquia precisa UI maior. v1 é só readonly do que tá seedado.

4. **Multi-track** sai do escopo. Brasília é a única pista por enquanto. Se outras tracks forem cadastradas, listar todas no header do TrechoListaView com picker.

5. **Tags como derivação**: como o schema atual não tem `tags`, derivar visual das tags a partir de heurística simples no view (ex: nome contém "Curva 0X" + ordem mostra Lenta/Média/Rápida; "Mergulho" = Rápida; "Cotovelo" = Lenta). Documentar como hack temporário no PR, real impl em v2.

### Files a NÃO tocar
- Outros views (Stint, Carro, Pneu, etc)
- Tabela `retas_especiais` (não é UI deste PR)
- `Package.resolved`, `.gitignore`, CI
- `src/data/` (mantém JS legacy intacto)

### Verificação

```bash
cd ios/p1fast-core && swift run p1fast-smoke
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build

# Persistência
DBPATH=$(find ~/Library/Developer/CoreSimulator/Devices -name "*.sqlite" -path "*p1fast*" 2>/dev/null | head -1)
sqlite3 "$DBPATH" "SELECT t.apelido, l.nome, COUNT(s.id) FROM tracks t JOIN track_layouts l ON l.track_id=t.id JOIN track_segments s ON s.layout_id=l.id GROUP BY t.id, l.id;"
# Esperado: Brasília | Padrão | 8

# Package.resolved intacto
git diff main -- ios/p1fast-core/Package.resolved
```

### Screenshots em `/tmp/p1-trechos/`
- `garagem-com-botao.png` — header da Garagem mostrando botão "Trechos"
- `trechos-lista.png` — lista de 8 trechos agrupados em 3 parciais
- `trechos-empty-track.png` — caso edge: track sem layout cadastrado

### Launch arg novo
- `--p1-trechos` → abre `TrechoListaView` direto

### PR title
```
feat(1A5): trechos da pista (lista readonly + seed Brasília) — Prompt #19
```

`gh pr create ...` — terminar com link.
````

---

# Prompt #20 — Catálogo de lições

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #20 (Sprint 1A.5)

## CONTRATO DE EXECUÇÃO
[mesmo de #19]

**blockedBy:** schema v3 (criado neste mesmo PR — primeira coisa)
**Paralelizável com:** #21 (zonas independentes)

## TAREFA

**Branch:** `feat/1A5-licoes` (worktree `../p1-fast-licoes`)
**Base:** `main` (após Sprint 1A.4)

### Files a criar

- `ios/p1fast-ios/Sources/Views/LicaoListaView.swift` — catálogo de lições agrupadas por categoria/nível. Reusar visual de `mockup-licao-lista.html`.
- `ios/p1fast-ios/Sources/Persistence/LicaoRepository.swift` — CRUD readonly + seed do JS canônico.

### Files a editar

- `ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift` — método `static func v4_licoes(_ migrator:)` adicionando tabela `licoes` (após v3 que já está em main, vide PR #43). Registrar em `DB.swift`.
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — struct `Licao` (Codable + GRDB).
- `supabase/migrations/0004_licoes.sql` — espelho Postgres.
- `ios/p1fast-ios/Sources/Views/ContentView.swift` — entrypoint (decisão: sub-tab "Lições" dentro de Cadastros).

### Schema delta

```sql
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
```

### Seed canônico

Portar **as 12 lições** de `src/data/lesson-library.js` pra Swift como seed idempotente em `LicaoRepository.bootstrap()`:
- 7 MVP **ativas** (`ativa=1`)
- 5 Fase 2 **inativas** (`ativa=0`)

Nomes/categorias/níveis copiados literalmente do JS — não inventar.

### Decisões pré-baked

1. **Catálogo readonly** em v1. Sem add/edit/delete pelo usuário (lições são curadas pelo dev).
2. **Filtro visual**: toggle "Só ativas" no header (default ON). "Todas" mostra também as 5 Fase 2 com badge "Fase 2".
3. **Detalhe da lição**: tap no row abre sheet com descrição completa, sinais requeridos, fase/tipo curva. Sem editar.
4. **Surface**: sub-tab "Lições" dentro de "Cadastros" (renomear BottomNav slot 3 já feito em #15).
5. **Seed roda 1x**: bootstrap checa se table tem N=12 rows; se sim, no-op. Se diferente (drift), upsert por `id` mantendo ativa flag.

### Verificação
```bash
cd ios/p1fast-core && swift run p1fast-smoke
xcodebuild ... build

DBPATH=$(...)
sqlite3 "$DBPATH" "SELECT COUNT(*), SUM(ativa) FROM licoes;"
# Esperado: 12 | 7
sqlite3 "$DBPATH" "SELECT titulo, categoria, ativa FROM licoes ORDER BY ativa DESC, categoria;"
# Esperado: 7 ativas + 5 inativas, em ordem por categoria

git diff main -- ios/p1fast-core/Package.resolved
```

### Launch arg novo
- `--p1-licoes` → LicaoListaView aberta

### Screenshots em `/tmp/p1-licoes/`
- `licoes-ativas.png` — 7 lições MVP, toggle ON
- `licoes-todas.png` — 12 lições, badge "Fase 2" nas inativas
- `licao-detalhe.png` — sheet de detalhe

### PR title
```
feat(1A5): catálogo de lições (12 do JS canônico) — Prompt #20
```
````

---

# Prompt #21 — Pendências cascata

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #21 (Sprint 1A.5)

## CONTRATO DE EXECUÇÃO
[mesmo de #19]

**Paralelizável com:** #20 (zonas independentes)

## TAREFA

**Branch:** `feat/1A5-pendencias` (worktree `../p1-fast-pendencias`)
**Base:** `main` (após Sprint 1A.4)

### Files a criar

- `ios/p1fast-ios/Sources/Views/PendenciasView.swift` — checklist cascata por evento. Reusar visual de `mockup-pendencias-cascata.html`.
- `ios/p1fast-ios/Sources/Persistence/PendenciaRepository.swift` — CRUD: seed templates + criar instâncias por evento + toggle checado.

### Files a editar

- `ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift` — método `static func v5_pendencias(_ migrator:)` (após v3 RLS fix e v4 lições). Registrar em `DB.swift`.
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — structs `PendenciaTemplate`, `EventoPendencia`.
- `supabase/migrations/0005_pendencias.sql` — espelho Postgres.
- `ios/p1fast-ios/Sources/Views/EventoDetalheView.swift` — adicionar seção "Pendências" no detalhe do evento (linkando pra `PendenciasView`).

### Schema delta

```sql
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
CREATE INDEX idx_evento_pendencias_evento ON evento_pendencias(evento_id);
CREATE UNIQUE INDEX idx_evento_pendencias_unique ON evento_pendencias(evento_id, template_id);
```

### Seed canônico

Portar **6 grupos** de `src/data/schemas.js` (`SEED_PEND_TIPOS`) — Motor & Fluidos, Freios, Pneus & Susp., Elétrica, Segurança, Torques Susp., Combustível (na verdade são 7 grupos pelo grep — confirmar). Cada grupo tem N itens com `titulo`, `observacao` opcional, `obrigatorio` boolean. Total estimado: ~30 itens.

### Decisões pré-baked

1. **Templates seedados 1x** no boot (`PendenciaRepository.bootstrap()` verifica count, no-op se já populado).
2. **Instâncias por evento** criadas automaticamente quando usuário abre PendenciasView pela 1ª vez pra esse evento. Cria N rows em `evento_pendencias` (1 por template).
3. **Visual cascata**: grupos colapsáveis. Header mostra "{X}/{N} checadas" + cor (verde se 100%, ouro se >0, faint se 0). Itens com checkbox visual + label + observacao opcional.
4. **Obrigatórios destacados**: itens com `obrigatorio=1` ganham asterisco vermelho ou tag "obrig.". Bloqueia "marcar evento como pronto" se algum obrig. não checado (UI hint, sem enforcement no banco).
5. **Editar nota**: tap longo no item → sheet com textarea pra nota livre.

### Verificação
```bash
cd ios/p1fast-core && swift run p1fast-smoke
xcodebuild ... build

DBPATH=$(...)
sqlite3 "$DBPATH" "SELECT COUNT(*) FROM pendencias_template;"
# Esperado: ~30 (depende do count real do JS)

# Criar 1 evento + abrir PendenciasView → checar instâncias
sqlite3 "$DBPATH" "SELECT COUNT(*) FROM evento_pendencias WHERE evento_id='<id>';"
# Esperado: igual ao count de templates

# Marcar 1 item checado pelo simulator
sqlite3 "$DBPATH" "SELECT checado FROM evento_pendencias WHERE evento_id='<id>' AND template_id='<tid>';"
# Esperado: 1

git diff main -- ios/p1fast-core/Package.resolved
```

### Launch arg novo
- `--p1-pendencias` → cria evento demo + abre PendenciasView

### Screenshots em `/tmp/p1-pendencias/`
- `pendencias-vazias.png` — primeira vez, 0/N checadas, todos grupos colapsados
- `pendencias-meio.png` — alguns grupos com checks, header dourado
- `pendencias-completo.png` — 100% checadas, todos verdes
- `pendencias-nota.png` — sheet de nota num item

### PR title
```
feat(1A5): pendências cascata (templates + instâncias por evento) — Prompt #21
```
````

---

# Prompt #22 — Setup avançado dedicado

````markdown
# 🤖 EXECUÇÃO AUTÔNOMA — Prompt #22 (Sprint 1A.5)

## CONTRATO DE EXECUÇÃO
[mesmo de #19]

**Sem dependência nova.** Refactor visual de overrides já existentes.

## TAREFA

**Branch:** `feat/1A5-setup-avancado` (worktree `../p1-fast-setup-avancado`)
**Base:** `main` (após Sprint 1A.4)

### Files a criar

- `ios/p1fast-ios/Sources/Views/SetupAvancadoView.swift` — visualização dedicada dos 14 overrides do `CarroSetupOverrides`, agrupados por sistema. Reusar visual de `mockup-setup-avancado.html`.

### Files a editar

- `ios/p1fast-ios/Sources/Views/CarroModalView.swift` — botão "Setup avançado" no header (push pra SetupAvancadoView com `carroId`). O modal atual mantém os 14 inputs inline; a tela dedicada é uma view alternativa pra leitura cômoda + edição focada.

### Files a NÃO tocar

- `CarroSetupOverrides.swift` (já tem o modelo dos 14 overrides)
- Migrations (sem schema novo)
- Repositories (CarroRepository já tem upsert/load)
- Outras views

### Mockup canônico

`_design-reference/mockup-setup-avancado.html`. 5 grupos canônicos:
- PNEUS (4 inputs: pressão DE/DD/TE/TD)
- ALINHAMENTO (3 inputs: cambagem D/T, convergência T)
- SUSPENSÃO (3 inputs: mola D/T, altura D)
- FREIOS (1 input: bias dianteiro)
- MOTOR · TRANSMISSÃO (3 inputs: combustível, mapa, diferencial)

### Decisões pré-baked

1. **SetupAvancadoView lê e escreve o mesmo `configuracoes.overrides`** que o CarroModalView (CarroSetupOverrides JSON). Não duplicar persistência.

2. **Modo de uso**: o CarroModalView original (form inline com 14 inputs) continua funcionando. SetupAvancadoView é um **modo focado** com layout grande + setas de navegação entre grupos. Botão "Setup avançado" no header do CarroModal abre.

3. **Tipografia maior** (default 18pt vs 16pt do modal inline) — usuário tá num momento de tweaking concentrado, não num cadastro rápido.

4. **Sem edição de overrides novos**. Os 14 são canônicos.

5. **Discardable changes**: SetupAvancadoView tem footer "Cancelar / Salvar". Cancelar volta sem persistir; Salvar grava no `configuracoes.overrides` e fecha. Idêntico ao padrão do CarroModalView.

### Verificação
```bash
cd ios/p1fast-core && swift run p1fast-smoke
xcodebuild ... build

DBPATH=$(...)
# Editar override pelo modo avançado, conferir que reflete no JSON
sqlite3 "$DBPATH" "SELECT overrides FROM configuracoes WHERE carro_id='<id>';"
# Esperado: JSON atualizado

# Editar override pelo modal inline, abrir avançado — deve refletir
git diff main -- ios/p1fast-core/Package.resolved
```

### Launch arg novo
- `--p1-setup-avancado` → abre SetupAvancadoView do primeiro carro

### Screenshots em `/tmp/p1-setup-avancado/`
- `setup-grupo-pneus.png` — grupo PNEUS expandido, 4 wheel inputs
- `setup-grupo-suspensao.png` — grupo SUSPENSÃO
- `setup-todos.png` — visão geral, todos grupos
- `setup-edit-flow.png` — antes/depois de editar 1 valor

### PR title
```
feat(1A5): setup avançado dedicado (visualização agrupada dos 14 overrides) — Prompt #22
```
````

---

# Sprint 1A.6 — Sketch (não baked, próxima rodada)

Após 1A.5 fechado, restam 3 frentes pra completar Phase 1A antes de 1B (cockpit ao vivo):

### #23 — Sync drainer ativação
Já temos `SyncDrainer.swift`, `SyncQueue.swift`, `PullExecutor.swift` em `p1fast-core/Persistence/`. Falta:
- Wire-up no boot do app
- Configuração de Supabase URL + anon key (via `.env.xcconfig`, gitignored)
- Backoff visual (badge "sincronizando..." no header da Home)
- Testes E2E de drainer com fake server

### #24 — Edge Function ingest end-to-end
`supabase/functions/ingest/index.ts` já existe. Falta:
- Configurar projeto Supabase real (você cria, dá URL+keys)
- Aplicar migrations 0001 + 0002 + 0003 + 0004 + 0005
- Smoke E2E: app → sync queue → drainer → Edge Function → Postgres
- Verificar latência e RLS

### #25 — Pessoas v2 + Reações + Shift cards (tabelas faltantes)
- Tabela `reacoes_aprendidas` (mockup-reacoes-aprendidas) — pilot reaction profiles
- Tabela `shift_events` (mockup-shift-cards) — eventos de shift light Fase 2
- Ambas dependem de telemetria real → fica DORMENTE até 1B

Sprint 1A.6 fechado = Phase 1A 100%. Pronto pra Sprint 1B (cockpit ao vivo).

---

## Ordem ótima de execução

```
Sprint 1A.5:
  #19 Trechos          (independente)
  #20 Lições           (paralelo com #21)
  #21 Pendências       (paralelo com #20)
  #22 Setup avançado   (independente)
  → 4 PRs em ~2 dias se rodar 2 em paralelo

Sprint 1A.6:
  #23 Sync drainer wire-up
  #24 Edge Function setup (depende de Supabase prod, ação tua)
  #25 Pessoas v2 + tabelas dormentes
  → 3 PRs

Total restante até Phase 1A done: ~7 PRs.
Depois: Sprint 1B = cockpit ao vivo (o produto de verdade).
```
