> ⚠️ **DOCUMENTO OBSOLETO** — preservado pra histórico (auditoria 2026-05-12).
>
> A nomenclatura "Sprint 1A.X" foi substituída em 2026-05-03 pelo esquema
> "MS-X" do `docs/PLANO_FASE_1.md`. O design descrito aqui foi entregue e
> mergeado faz tempo. Não usar como guia pra trabalho novo.
>
> Referência canônica vigente: `STATUS.md` + `docs/PLANO_FASE_1.md`.

---

# Sprint 1A.6 — Sync drainer (design)

> Status: **proposta**, não implementado. Documento pré-prompt pra alinhar
> design ANTES do Cloud Code começar a codar. Decisões abertas no fim.

## O que é

Componente que drena `sync_queue` local (GRDB no iOS) → tabelas correspondentes
no Supabase, marca `synced_at` no source, e respeita os contratos arquiteturais
(ADR-009, ADR-014).

## Contexto: o que já existe

### GRDB local (`ios/p1fast-core/Sources/P1FastCore/Persistence/`)
- 20 tabelas mirror do Postgres + 1 `sync_queue` local-only
- `sync_queue(id, table_name, row_id, op, payload, attempts, last_error, created_at)` com `op IN ('insert','update','delete')`
- `synced_at INTEGER NULL` em **todas** as tabelas exceto `telemetry_samples` (ADR-014)
- `SyncQueue.swift` já expõe `enqueue/markSynced/listPending/drain` (drain é stub)

### Supabase remoto
- 20 tabelas com RLS por `time_id`
- Helpers `auth.is_member`, `auth.is_admin`
- RPC `public.create_team(nome)` pra onboarding inicial
- Edge Function `ingest` aceita batch de `telemetry_samples` com JWT + membership check

### Decisões arquiteturais (ADRs)
- **ADR-003**: SQLite local = source of truth durante sessão ao vivo. Cloud é backend pós-sync.
- **ADR-004**: Telemetria append-only.
- **ADR-009**: SyncQueue acumula sem drainer até Fase 20 (este sprint).
- **ADR-014**: Telemetry samples NÃO passam por sync_queue — sync por batch consolidado via Edge Function.

## Componentes a construir

### 1. `SyncDrainer.swift` (em `p1fast-core` ou `p1fast-ios`?)
Loop principal:
```
while queue não vazia E rede OK:
  pega lote de N pendentes (ordem: created_at)
  agrupa por table_name
  envia em batches por tabela ao Supabase
  on success: markSynced no source row + delete na queue
  on failure: increment attempts, store last_error, backoff
```

Opera em `Task` background. Acordado por:
- Push remoto (network reachability + queue não vazia)
- Timer fixo (ex: 30s)
- Trigger explícito após mutation grande

Sugestão: `p1fast-core` expõe a lógica; `p1fast-ios` injeta cliente HTTP +
Reachability + scheduling.

### 2. `TelemetryUploader.swift` (caminho separado, ADR-014)
Não usa `sync_queue`. Lê `telemetry_samples WHERE uploaded_at IS NULL`,
agrupa em chunks de ~1000 rows, envia via Edge Function `ingest`,
marca `uploaded_at = now()` no sucesso.

Sugestão: outra task em background, mesma cadência mas independente do
drainer principal — assim uma falha de telemetria não trava o drain de
outras mutations e vice-versa.

### 3. `ConflictResolver.swift`
Quando o servidor rejeita (UPDATE numa row que já foi alterada por outro
device):

**Estratégia recomendada — Last-Write-Wins por `updated_at`**:
- Cliente envia `updated_at` na payload do UPDATE.
- Edge Function compara com `updated_at` atual no Postgres.
- Se cliente.updated_at < server.updated_at → rejeita com `409 stale-write`.
- Cliente recebe a versão atual, descarta sua versão local, reagenda
  mutation se ainda fizer sentido.

Alternativa (mais cara): CRDT por campo. **Não recomendado pra V1** — a
maioria das mutations do P1 Fast é "criar registro novo" (carro novo, stint
novo); UPDATE concorrente é raro (1 piloto edita uma config por vez).

### 4. `BackoffPolicy.swift`
Exponencial com jitter:
- attempts 1: imediato
- attempts 2: 30s ± 10s
- attempts 3: 2min ± 30s
- attempts ≥ 4: 10min ± 2min, depois mover pra dead-letter local

`sync_queue` row com attempts ≥ 5 vira `failed` (estado novo) — não tenta
mais automaticamente, fica visível em uma tela admin pra Flávio re-enfileirar.

### 5. `SyncStatus` (UI affordance)
Indicador no canto da app: "sincronizado" / "X pendente" / "offline" /
"erro: Y dead-letters".

## Fluxos

### Fluxo feliz (mutation local → remote)
```
1. UI: usuário cria carro novo
2. p1fast-core: insert em GRDB.carros + insert em sync_queue
   (row_id=carro.id, table_name='carros', op='insert', payload=carro JSON)
3. SyncDrainer (loop):
   3a. fetch pending limit 50
   3b. POST batch pra Edge Function `sync` (a criar)
4. Edge Function `sync`:
   4a. valida JWT, lookup user_id
   4b. pra cada row: valida que row.time_id é do user
   4c. INSERT/UPDATE/DELETE no Postgres
   4d. responde {accepted: [ids], rejected: [{id, reason}]}
5. SyncDrainer:
   5a. accepted → UPDATE carros SET synced_at=now() WHERE id=…; DELETE sync_queue WHERE row_id=…
   5b. rejected → increment attempts + last_error
```

### Fluxo conflito (stale write)
```
1. SyncDrainer envia UPDATE com updated_at=T1
2. Edge Function vê server.updated_at=T2 > T1 → rejeita 409
3. Cliente: GET row atual do Supabase
4. Cliente: aplica merge — pra V1, sobrescreve local com server (LWW)
5. Re-enqueue se quiser persistir mudança (com confirmação UI?)
```

### Fluxo offline
```
1. Reachability: false
2. SyncDrainer: pausa loop, não faz polling
3. UI: "offline · X pendente"
4. Reachability: true → drain loop reativa
```

### Telemetria (caminho 2)
```
1. Sessão ativa: cockpit-mobile escreve telemetry_samples (10 Hz)
2. uploaded_at fica NULL
3. TelemetryUploader (loop independente):
   3a. fetch WHERE sessao_id=ses_atual AND uploaded_at IS NULL ORDER BY seq LIMIT 1000
   3b. POST pra Edge Function `ingest`
   3c. on accepted: UPDATE uploaded_at=now() WHERE id IN (…)
4. Sessão termina: TelemetryUploader continua até esgotar pendentes
```

## Edge Function `sync` (a criar)

Espelha `ingest` mas pra mutations genéricas. POST:
```json
{
  "rows": [
    { "table_name": "carros", "op": "insert", "payload": { … }, "client_updated_at": 1714693200000 },
    { "table_name": "configuracoes", "op": "update", "payload": { … }, "row_id": "uuid", "client_updated_at": 1714693201000 }
  ]
}
```

Resposta:
```json
{
  "accepted": ["row_id_1", "row_id_2"],
  "rejected": [{ "row_id": "row_id_3", "reason": "stale-write", "server_updated_at": 1714693300000 }]
}
```

Whitelist de tabelas que aceita: `carros, configuracoes, pilotos, passageiros, pneus, combustiveis, eventos, sessoes, voltas, segment_executions, mensagens, retas_especiais` (qualquer tabela com `time_id`). NÃO aceita: `telemetry_samples` (vai pelo `ingest`), `times` (só via RPC `create_team`), `usuarios_time` (admin only), `trofeus_ganhos` (server-awarded).

Validações:
- JWT → user_id
- Pra cada row: payload.time_id deve ser do user (membership check)
- `op=update`: requer `row_id` + `client_updated_at`; rejeita stale
- `op=delete`: requer `row_id`; verifica ownership; soft-delete? (decisão aberta)

## Smoke E2E

Mínimo:
- `node tests/node-smoke-sync.mjs` (validador + chunker do payload, paridade
  JS↔TS, mesmo padrão do `node-smoke-ingest-edge.mjs`)
- `swift run p1fast-smoke` ganha PERSIST tests pra:
  - `enqueue` → `listPending` retorna a row
  - `drain` (mock client) marca `synced_at` + remove da queue
  - `drain` com falha incrementa attempts
  - LWW: cliente com client_updated_at antigo é rejeitado

## Decisões abertas (precisam de Flávio)

1. **`SyncDrainer` em core ou ios?** — Recomendação: lógica em `p1fast-core` (testável sem iOS), HTTP/Reachability em `p1fast-ios`.

2. **Soft-delete vs hard-delete?** — Hoje GRDB faz hard. Postgres tem CASCADE. Mas se um device deleta enquanto offline e outro device tem updates pendentes pra mesma row, hard-delete perde dados. Soft-delete (`deleted_at`) é mais seguro mas exige refactor das queries.

3. **Conflict resolver — LWW ou pedir ao usuário?** — LWW é simples mas pode perder mudanças. Pra config de carro (raro mudar concorrente) é OK. Pra notas de stint (texto longo) talvez não. Sugestão V1: **LWW universal**, V2 (se necessário) UI de "merge manual" pra mensagens.

4. **Frequência do drain loop?** — 30s é razoável. Pode ser configurável via `Configuration.swift`.

5. **Dead-letter exposto na UI?** — Sim ou não? Sugestão: tela em "Configurações → Sincronização" com lista de pendentes e botão "Re-tentar" / "Descartar".

6. **Reachability — usar `Network.framework` (NWPathMonitor) ou polling HTTP?** — Sugestão: NWPathMonitor (nativo iOS, eficiente).

7. **Deve haver "sync inicial" no app boot?** — Pull do Supabase pra preencher GRDB local? Ou app começa vazio e só recebe o que o user digita? Importante: em iPad/segundo iPhone do mesmo user, esperaria ver os dados que outro device gerou. **Recomendação V1: pull no boot via `last_sync_at` (per-table cursor) + push do que estiver pending.**

## Não-objetivos (V1)

- Real-time / live presence (Supabase Realtime) — Sprint futuro.
- Sync seletivo por intervalo de datas — drain TUDO que está pending.
- Reconciliação multi-device com CRDT — overkill pro escopo (1 piloto, 1 device principal).
- Encryption at rest do payload local — SQLite já é sandboxed por iOS.

## Estimativa de esforço — 5 de 7 já implementados em paralelo

Pré-trabalho adiantado em paralelo ao Sprint 1A.2:

| # | Tarefa | Status | PR |
|---|---|---|---|
| A | Edge Function `sync` (Deno) + smoke validator/chunker | ✅ | #18 |
| B | `SyncDrainer.swift` em `p1fast-core` + smoke (mock client) | ✅ | #20 |
| C | HTTP client + Reachability em `p1fast-ios` + injection no SyncDrainer | ⏳ | — |
| D | UI "Sincronização" (status + dead-letter) | ⏳ | — |
| E | Pull inicial no boot (cursor `last_sync_at` por tabela) + Edge `pull` | ✅ | #22 |
| **+ BackoffPolicy** (extra) | exponencial com jitter, usado por C+drainer | ✅ | #24 |
| **+ TelemetryUploader** (extra) | drena telemetry_samples → Edge `ingest` | ✅ | #24 |

**5 de 7 prontos antes do Sprint começar formalmente.** Sub-prompts C+D só fazem sentido depois de p1fast-ios estar maduro (pós Sprint 1A.2 inteiro). Telemetria também já está coberta — falta só o adapter URLSession.

Quando Sprint 1A.6 iniciar, restará:
- C: criar `URLSessionSyncTransport` + `URLSessionTelemetryTransport` em p1fast-ios; integrar Reachability via `NWPathMonitor`; agendar drains por timer + reachability change
- D: tela em "Configurações → Sincronização" listando pendentes + dead-letters + botão "Re-tentar"

## Pré-requisitos antes de começar

- [ ] Projeto Supabase real criado e migrations 0001 + 0002 aplicadas
- [ ] Pelo menos 1 user real cadastrado via Supabase Auth + 1 time criado via `create_team`
- [ ] App iOS rodando com creds reais (`.env.xcconfig` configurado)

Sem esses 3, a Edge Function `sync` não pode ser testada E2E — só com mocks.
