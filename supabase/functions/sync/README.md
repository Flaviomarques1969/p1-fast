# Edge Function — `sync`

Drainer de mutations (insert / update / delete) do GRDB local pra Supabase.
**Sprint 1A.6 — sub-prompt A** (ver `docs/SPRINT_1A6_SYNC_DRAINER_DESIGN.md`).

Diferente do `ingest` (que recebe telemetry_samples append-only), o `sync`
processa mutations em tabelas com `time_id` e implementa Last-Write-Wins
por `client_updated_at`.

## Auth

`Authorization: Bearer <JWT>`. JWT validado contra `auth.users`. User
precisa ser membro do `time_id` envolvido em cada row.

## Body

```json
{
  "rows": [
    { "table_name": "carros",       "op": "insert", "payload": { "time_id": "uuid", "apelido": "Celta" } },
    { "table_name": "sessoes",      "op": "update", "row_id": "uuid", "payload": { "status": "finalizada" }, "client_updated_at": 1714693200000 },
    { "table_name": "pneus",        "op": "delete", "row_id": "uuid" }
  ]
}
```

### Whitelist de tabelas (12)

`carros`, `configuracoes`, `pilotos`, `passageiros`, `pneus`,
`combustiveis`, `eventos`, `sessoes`, `voltas`, `segment_executions`,
`mensagens`, `retas_especiais`.

Excluídas intencionalmente:
- `telemetry_samples` — append-only, ADR-014, vai por `ingest`
- `times` — só via RPC `public.create_team(nome)`
- `usuarios_time` — admin only, via Studio ou RPC futura
- `trofeus_ganhos` — server-awarded, sem mutation cliente
- `tracks`, `track_layouts`, `track_segments`, `marcos` — catálogo global, write via service_role

### Operações

- `insert`: requer `payload` com `time_id`
- `update`: requer `row_id` + `payload` + `client_updated_at` (ms epoch)
- `delete`: requer `row_id`

## Resposta

```json
{
  "accepted": ["uuid_1", "uuid_2"],
  "rejected": [
    { "row_id": "uuid_3", "table_name": "sessoes", "reason": "stale-write",
      "detail": { "server_updated_at": 1714693300000, "client_updated_at": 1714693200000 } },
    { "row_id": "uuid_4", "table_name": "carros", "reason": "not-member-of-time" }
  ]
}
```

### Códigos de `reason`

| reason | quando |
|---|---|
| `row-nao-objeto`, `table-nao-permitida`, `op-invalida` | validação do shape |
| `insert-sem-payload`, `insert-sem-time_id` | insert mal-formado |
| `update-sem-row_id`, `update-sem-payload`, `update-sem-client_updated_at` | update mal-formado |
| `delete-sem-row_id` | delete sem id |
| `row-not-found` | update/delete em row inexistente |
| `not-member-of-time` | user não pertence ao time da row |
| `stale-write` | LWW: cliente mais antigo que server |
| `db-error` | erro Postgres (foreign key, check, etc) — `detail` traz a mensagem |

## Limites

- `MAX_ROWS_PER_REQUEST = 500` rows por request → 413 se excedido
- Cliente deve agrupar e re-enviar em chunks

## Conflict resolution — LWW

Para `update`:
1. Cliente envia `client_updated_at` (timestamp local quando a mutation foi enfileirada)
2. Edge Function lê `server.updated_at` da row atual
3. Se `client_updated_at < server.updated_at` → `409 stale-write` virtual (rejected, não 409 HTTP — vai no array)
4. Cliente recebe e decide: descartar localmente, ou pull + re-enqueue

Para `insert` e `delete`: sem LWW (insert é idempotente por id; delete é absoluto).

## Testar local

```sh
supabase functions serve sync --env-file supabase/.env.local

# Em outro terminal:
curl -X POST http://localhost:54321/functions/v1/sync \
  -H "Authorization: Bearer $SUPABASE_TEST_JWT" \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"table_name":"carros","op":"insert","payload":{"time_id":"<uuid>","apelido":"Celta 1.4","modelo":"Chevrolet Celta","categoria":"Turismo","cor":"#0044aa"}}]}'
```

`.env.local` precisa de `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Smoke

`tests/node-smoke-sync-edge.mjs` — 19 testes: validator (12), source guards (6), whitelist size + paridade (1).

E2E real (com Supabase rodando) está documentado acima — manual no momento.

## Pré-requisitos pra usar

Ver `docs/PRE_LAUNCH_CHECKLIST.md` — projeto Supabase criado, migrations
aplicadas, user + time existindo, secrets do Edge configurados.

## O que falta (Sprint 1A.6 sub-prompts B-E)

- B: `SyncDrainer.swift` em p1fast-core (cliente HTTP que chama esta função)
- C: HTTP + Reachability injection em p1fast-ios
- D: UI "Sincronização" (status + dead-letter)
- E: Pull inicial no boot
