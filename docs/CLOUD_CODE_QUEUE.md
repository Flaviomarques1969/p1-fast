# Cloud Code — Fila de Trabalho

**Repo:** `Flaviomarques1969/p1-fast`
**Branch base:** `main`
**Plano completo:** [`docs/PLANO_FASE_1A_1B.md`](PLANO_FASE_1A_1B.md)

---

## Como executar esta fila

Cada prompt abaixo é uma tarefa autocontida → 1 PR. Execute em ordem respeitando `blockedBy`. Se uma tarefa falha em smoke, **PARA** e comenta no PR; não continua a próxima.

**Convenção de branch:** `feat/<sprint>-<slug>` (ex: `feat/1A1-schema-audit`).

**Após cada PR aberto:** comente com link no thread original do disparo. Aguarde review do Flávio antes de mergear (a menos que `auto-merge: true` esteja explícito).

**Princípios INEGOCIÁVEIS** (tratam todos os PRs):
1. Mockup canônico em `_design-reference/*.html` é contrato 1:1. Não inventar token/cor/gap/aliases.
2. Tratamento "você" — nunca "tu/te/ti/teu/tua".
3. Sem ícones decorativos — texto puro em botões/labels/títulos.
4. Sem `mkdir` antes de `Write` (diretório já existe ou Write cria).
5. Smoke verde obrigatório antes de abrir PR. Sem exceção.
6. "Nunca fabricar dados" — quando faltar dado, mostrar estado vazio explícito.

---

## SPRINT 1A.1 — Fundação ✅

**Progresso:** ✅ #1 · ✅ #2 · ✅ #3 · ✅ #4 · ✅ #5 · ✅ #6
(merges em main: `86a3c58`, `0a07473`, `3fd3a94`, `de45ae7`, `31bcc4e`, `aff721a`)

## SPRINT 1A.2 — Hub iOS

**Progresso:** ✅ #7 · ✅ #8 · ⏳ #9 · ⏳ #10
(merges: `75335ae`, `4f689eb`, —, —)

---

### Prompt #1 — Auditar `src/data/schemas.js` e fechar campos do ghost-map ✅

**Branch:** `feat/1A1-schema-audit`
**blockedBy:** —
**Files:** `src/data/schemas.js`, `tests/node-smoke-contracts.mjs`, `ARCHITECTURE_DECISIONS.md`

**Tarefa:**
Auditar `src/data/schemas.js`. Adicionar campos faltantes que estão na spec do ghost-map (decisões 2026-05-01) mas ainda não no schema:

- `sessoes.voltas_planejadas` (integer, nullable) — plano de stint
- `configuracoes.temperatura_ideal_range` (json `{motor:{min,max}, pneu:{min,max}}`, nullable)
- `carros.fonte_temperatura` (enum `motor|pneu|ambos`, default `motor`)
- Tabela nova `marcos` com flag `tipo` aceitando `pit-in|pit-out` além dos atuais
- Tabela nova `retas_especiais` (campos: `track_id`, `segment_id`, `tempo_medio_ms`, `auto_detectada` boolean)

NÃO tocar em `telemetrySamples` (ADR-014).

Atualizar `tests/node-smoke-contracts.mjs` pra cobrir os novos campos. Documentar em `ARCHITECTURE_DECISIONS.md` se houver decisão nova (provavelmente ADR-019 sobre retas_especiais).

**Aceitação:**
- `npm run smoke` retorna `129/0` (ou mais com novos contracts)
- `node-smoke-contracts.mjs` cobre todos os 5 campos
- Diff explica cada campo no PR description

---

### Prompt #2 — Migration Dexie v13 ✅

**Branch:** `feat/1A1-dexie-v13`
**blockedBy:** #1
**Files:** `src/data/schemas.js` (bump version), `src/core/db.js`

**Tarefa:**
Implementar migration Dexie v12 → v13 que adiciona os campos do prompt #1 sem quebrar dados existentes. Versão atual está em `src/data/schemas.js` (Dexie v12 após shift-light).

Migration deve:
- Adicionar colunas novas como `null` em registros existentes
- Criar tabelas `marcos` e `retas_especiais` (vazias)
- Manter compatibilidade com fake-indexeddb usado nos smokes
- Ter teste de upgrade explícito em `tests/node-smoke-migration.mjs`

**Aceitação:**
- `npm run smoke` retorna `129/0` mínimo (idealmente +1 teste)
- Teste de upgrade prova que dado v12 sobrevive em v13
- README do schema atualizado se existir

---

### Prompt #3 — Schema Supabase Postgres inicial (espelho do Dexie) ✅

**Branch:** `feat/1A1-supabase-schema`
**blockedBy:** #2
**Files:** `supabase/migrations/0001_initial.sql`, `supabase/config.toml`, `docs/SUPABASE_SETUP.md`

**Tarefa:**
Criar pasta `supabase/` com Supabase CLI. Migration SQL inicial que espelha o schema Dexie v13 em Postgres:

- Tabelas: `times`, `usuarios_time`, `tracks`, `track_segments`, `marcos`, `retas_especiais`, `carros`, `configuracoes`, `pilotos`, `passageiros`, `pneus`, `combustiveis`, `eventos`, `sessoes`, `stints`, `voltas`, `segment_executions`, `telemetry_samples` (append-only), `mensagens`, `troféus_ganhos`
- RLS habilitada em **todas** as tabelas
- Política RLS: `auth.uid() IN (SELECT user_id FROM usuarios_time WHERE time_id = row.time_id)` — workspace aberto por time
- Política especial pra `mensagens`: além do RLS, usar `visivel_no_box BOOLEAN` pra filtragem cliente-side
- Função `auth.is_admin(time_id)` pra checar admin
- `created_at` / `updated_at` automáticos via trigger
- IDs como `uuid` com `gen_random_uuid()` default

Documentar em `docs/SUPABASE_SETUP.md`:
- Como criar projeto Supabase novo (URL, anon key, service key)
- Como aplicar migration (`supabase db push`)
- **AVISO BIG**: projeto Supabase do P1 Fast é **isolado** do CDAI Imunoterapia. Nunca compartilhar credentials, nunca cross-reference.

NÃO aplicar em prod ainda. Migration fica versionada no repo, Flávio aplica manualmente quando criar o projeto Supabase.

**Aceitação:**
- `supabase db lint` passa
- Migration inclui comentários SQL explicando cada tabela
- `docs/SUPABASE_SETUP.md` tem checklist de setup
- README diz que projeto Supabase é separado do CDAI

---

### Prompt #4 — GRDB iOS schema (espelho do Postgres) ✅

**Branch:** `feat/1A1-grdb-schema`
**blockedBy:** #3
**Files:** `ios/p1fast-core/Sources/P1FastCore/Persistence/`

**Tarefa:**
Adicionar GRDB ao `ios/p1fast-core` como dependência SPM. Criar módulo `Persistence` que espelha as tabelas do Supabase em SQLite local.

- `DatabaseQueue` factory em `Persistence/DB.swift`
- Migration v1 inicial via `DatabaseMigrator` que cria as mesmas tabelas do `supabase/migrations/0001_initial.sql`
- Tipos Swift `Codable` + `FetchableRecord` + `PersistableRecord` pra cada tabela
- Coluna `synced_at: TIMESTAMP NULL` em **todas** as tabelas (exceto `telemetry_samples`) — marca o que foi sincronizado pra Supabase
- Tabela `sync_queue` local com `(table_name, row_id, op, payload, attempts)` — replay pendente
- Smoke `swift run p1fast-smoke` cobre: criar registro, marcar synced, listar pendentes

NÃO implementar o sync drainer ainda — ele virá no Sprint 1A.6. Aqui só o schema + helpers de marcação.

**Aceitação:**
- `swift run p1fast-smoke` retorna `97+/0` (idealmente +N testes)
- README do `p1fast-core` atualizado com doc de Persistence
- Schemas Postgres ↔ SQLite têm 1:1 nas colunas (mesmas chaves, mesmos tipos compatíveis)

---

### Prompt #5 — Inicializar projeto Xcode `p1fast-ios` ✅

**Branch:** `feat/1A1-xcode-app`
**blockedBy:** #4
**Files:** `ios/p1fast-ios/`, `ios/p1fast-ios/p1fast-ios.xcodeproj`, `ios/p1fast-ios/Package.swift`, `ios/README.md`

**Tarefa:**
Criar app SwiftUI `p1fast-ios` em `ios/p1fast-ios/`. App vazio (uma tela "Hello P1 Fast") que:

- Importa `p1fast-core` (path local) + `GRDB.swift` + `Daily-co/daily-client-ios` + `supabase-swift` via SPM
- Bundle ID: `com.flaviomarques.p1fast`
- Suporte iOS 17+
- Schemes `p1fast-ios` (debug + release)
- Boots o `DatabaseQueue` do `p1fast-core` na inicialização
- Mostra na tela: versão do app, status do DB, contador de tabelas
- Splash com nome P1 Fast (texto puro, sem ícone)

Documentar em `ios/README.md` como abrir no Xcode, rodar no simulator, dependências necessárias (Xcode 15+, Swift 5.9+).

NÃO incluir credenciais Supabase/Daily.co no código. Usar `Configuration.swift` que lê de Info.plist + arquivo `.env.xcconfig` (gitignored).

**Aceitação:**
- App compila no simulator (iPhone 15 Pro, iOS 17+)
- Tela inicial mostra "P1 Fast vX.Y.Z · DB: ok · Tabelas: N"
- `.gitignore` do iOS configurado (DerivedData, xcuserdata, .env.xcconfig)
- README tem screenshot do simulator

---

### Prompt #6 — Endpoint ingest migrado pra Supabase Edge Function ✅

**Branch:** `feat/1A1-ingest-edge-function`
**blockedBy:** #3
**Files:** `supabase/functions/ingest/index.ts`, `api/ingest/iphone.js` (deprecate)

**Tarefa:**
Migrar `api/ingest/iphone.js` (Vercel serverless) pra Supabase Edge Function em `supabase/functions/ingest/index.ts` (Deno).

Função aceita:
- POST com Authorization header (JWT do Supabase Auth)
- Body: array de samples no schema canônico `mobile-telemetry.js` (Sample shape: `t, tMono, lat, lon, accuracy, speed, heading, ax, ay, az, gx, gy, gz, ...`)
- Validação: extrair `time_id` do JWT, garantir que o usuário pertence ao time
- Insert em batch em `telemetry_samples` (1000 rows por chunk pra evitar timeout)
- Resposta: `{accepted: N, rejected: N, errors: [...]}`

Incluir teste local com `supabase functions serve` + curl simulando 100 samples. Smoke E2E em `tests/node-smoke-ingest-edge.mjs`.

Marcar `api/ingest/iphone.js` como deprecated (header de comentário) mas não deletar até que app iOS confirme uso da nova URL.

**Aceitação:**
- `supabase functions serve` aceita POST e devolve 200 com payload válido
- Smoke E2E passa
- Doc explica como configurar URL da função no app iOS

---

## SPRINT 1A.2 — Hub iOS (4 primeiros)

---

### Prompt #7 — `Theme.swift` + componentes base SwiftUI ✅

**Branch:** `feat/1A2-theme-base`
**blockedBy:** #5
**Files:** `ios/p1fast-ios/Sources/Theme/`, `ios/p1fast-ios/Sources/Components/`

**Tarefa:**
Implementar tokens visuais do **Padrão B** (canônico em `_design-reference/historico-evento/mockup-evento-B.html`) em SwiftUI.

`Theme.swift` deve expor:
- Cores: `accent`, `accentDim`, `surface`, `surfaceRaised`, `surfaceHover`, `border`, `borderStrong`, `text`, `textMuted`, `textFaint`, `success`, `warning`, `danger`, `gold`
  - **Converter OKLCH do mockup pra sRGB usando fórmula correta** (não chutar)
- Tipografia: `display`, `title`, `body`, `caption`, `mono` (fontes do sistema)
- Espaçamento: `xs(4)`, `sm(8)`, `md(16)`, `lg(24)`, `xl(32)`, `xxl(48)`
- Raio: `sm(8)`, `md(12)`, `lg(16)`, `pill(999)`

Componentes base em `Components/`:
- `EyebrowHeader` — eyebrow text uppercase + título grande + summary stats
- `SummaryStats` — grid horizontal de stats com valor grande + label small
- `Card` — surface com border, padding md, raio md
- `Chip` — pill com background surfaceRaised, label, tap action
- `BottomNav` — barra inferior fixa com 3-4 itens, item ativo destacado
- `FAB` — floating action button accent, label texto puro

Cada componente com Preview SwiftUI mostrando estados (default, hover, pressed, disabled).

REGRAS:
- Sem ícones decorativos. Texto puro em todos labels.
- Tratamento "você" em qualquer string.
- Comparar com mockup-evento-B.html lado a lado — visual diff <2%.

**Aceitação:**
- App compila, Previews renderizam
- Screenshots dos Previews anexados no PR
- Comentário no PR explicando como cor OKLCH foi convertida pra sRGB
- README de `Components/` lista cada componente com mini-screenshot

---

### Prompt #8 — Tela Home (cheio + vazio)

**Branch:** `feat/1A2-home`
**blockedBy:** #7
**Files:** `ios/p1fast-ios/Sources/Views/HomeView.swift`, fixtures de mock

**Tarefa:**
Portar `_design-reference/mockup-home-cheio.html` e `mockup-home-vazio.html` para SwiftUI.

Estado **vazio**: nenhum carro, nenhum evento → CTA "Cadastrar primeiro carro" + "Criar primeiro evento". Mensagem pedagógica curta.

Estado **cheio**: lista de carros (até 3 mais recentes), evento ativo hoje destacado em accent, próximo evento, summary 3-stats no topo (carros / eventos / stints totais).

Dados mockados (não Supabase ainda):
- 2 carros: "Celta 1.4 turismo" Chevrolet azul + "Honda Civic" cinza
- Evento ativo hoje: Brasília 2026-05-01
- Próximo evento: Brasília 2026-05-15
- 47 stints totais

REGRAS:
- 1:1 com mockup. Comparar lado a lado.
- Tokens só de `Theme.swift`. Não inventar cor.
- Sem ícones.
- BottomNav com Home ativo.

**Aceitação:**
- 2 telas (cheio + vazio) compilam e renderizam no simulator
- Screenshots de ambas no PR
- Visual diff <2% vs mockup HTML

---

### Prompt #9 — Tela Garagem + Modal Carro + form Carro Novo

**Branch:** `feat/1A2-garagem`
**blockedBy:** #7
**Files:** `ios/p1fast-ios/Sources/Views/GaragemView.swift`, `Views/CarroModalView.swift`, `Views/CarroNovoFormView.swift`

**Tarefa:**
Portar 3 mockups: `mockup-garagem.html`, `mockup-carro.html`, `mockup-carro-novo.html`.

**Garagem:** lista de carros (swatch de cor, apelido, modelo + categoria, tags status, contagem de stints). Header eyebrow + summary 3-stats. FAB "Novo carro". BottomNav com Garagem ativo.

**Modal Carro:** cadastro completo (apelido, modelo, categoria, cor) + setup base com 14 overrides em 5 grupos: PNEUS, ALINHAMENTO, SUSPENSÃO, FREIOS, MOTOR · TRANSMISSÃO. Seção "Pneus cadastrados" com lista + CTA "Adicionar pneu". CRUD via GRDB.

**Form Carro Novo:** form mínimo (apelido + modelo + categoria + cor). Submit → cria registro no GRDB → fecha → volta pra Garagem com novo carro.

Persistência: usar `p1fast-core/Persistence/Carros.swift`. Não usar Supabase ainda — só local.

REGRAS:
- 1:1 com 3 mockups.
- Tratamento "você".
- Sem ícones.
- Categorias: usar `seed-tracks.js` ou similar pra hardcode da lista atual.

**Aceitação:**
- 3 telas compilam e renderizam
- CRUD via GRDB funciona (criar, editar, deletar carro persiste entre relaunches)
- Screenshots no PR
- Smoke `swift run p1fast-smoke` continua verde

---

### Prompt #10 — Tela Eventos lista + detalhe

**Branch:** `feat/1A2-eventos`
**blockedBy:** #7
**Files:** `ios/p1fast-ios/Sources/Views/EventosListaView.swift`, `Views/EventoDetalheView.swift`

**Tarefa:**
Portar `mockup-eventos-lista.html` e `mockup-evento-detalhe.html`.

**Lista:** seção "Próximo" (evento ativo hoje destacado em accent) + seção "Passados" (eventos anteriores com summary: stints/voltas/melhor volta). FAB "Novo evento". BottomNav com Eventos ativo.

**Detalhe:** top bar "‹ Eventos" + "Editar". Summary 4-stats (stints / voltas / melhor volta em ouro / % completo). Lista de stints do evento com piloto, lição praticada, tags (PB do dia em ouro, Desvio < 0.4s em verde). CTA "Novo stint" dashed inline.

Dados mockados pra preview:
- Brasília 2026-05-01 (próximo)
- Brasília 2026-04-25 com 4 stints / 47 voltas / 1:42.318
- Brasília 2026-03-28 com 3 stints / 32 voltas / 1:43.847

CRUD via GRDB (criar/editar evento). Stints só leitura por enquanto (criação será no Sprint 1A.3).

REGRAS:
- 1:1 com 2 mockups.
- "Você" em strings.
- Sem ícones.

**Aceitação:**
- 2 telas compilam e renderizam
- Lista mostra 1 ativo + 2 passados
- Detalhe mostra 4 stints com tags
- Screenshots no PR
- Visual diff <2% vs mockups

---

## Como acompanhar progresso

Após cada PR mergeado, atualizar **este arquivo** marcando o prompt como ✅ no topo da seção correspondente. Próximo prompt da fila herda o que foi feito.

Quando todos os 10 estiverem ✅, abrir issue "Sprint 1A.1 + 1A.2 done — pronto pra Sprint 1A.3" mencionando @Flaviomarques1969.
