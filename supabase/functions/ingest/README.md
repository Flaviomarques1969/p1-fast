# Edge Function — `ingest`

Recebe samples do iPhone (cockpit-mobile) e persiste em
`public.telemetry_samples`. Substitui `api/ingest/iphone.js` (Vercel).

## Auth

`Authorization: Bearer <JWT do Supabase Auth>`. O JWT é validado contra
`auth.users`; o user precisa ser membro do `time_id` da sessão.

## Body

```json
{
  "sessionId": "ses_abc123",
  "chunkId": "chk_001",
  "samples": [
    { "t": 1714693200000, "tMono": 12345.67, "source": "cockpit-mobile",
      "signalQuality": "GOOD", "lat": -15.77, "lng": -47.92, "speed": 32.4 }
  ]
}
```

Sample shape canônico definido em `src/pipeline/mobile-telemetry.js`.
Campos obrigatórios: `t`, `tMono`, `source`, `signalQuality`. Resto vai
no `payload` jsonb.

Limite: `MAX_SAMPLES_PER_REQUEST = 5000` por request, batches de 1000
no insert (evita timeout).

## Resposta

```json
{ "accepted": 1000, "rejected": 0, "errors": [], "sessionId": "ses_abc123" }
```

Em caso de sample inválido:
```json
{ "accepted": 999, "rejected": 1, "errors": [{ "index": 17, "reason": "sample-sem-tMono" }] }
```

## Configurar URL no app iOS

Ver `docs/SUPABASE_SETUP.md`. Resumo: a URL é
`https://<ref>.supabase.co/functions/v1/ingest`. App iOS guarda em
`Configuration.swift` lendo de `.env.xcconfig` (gitignored).

## Testar local

```sh
supabase functions serve ingest --env-file supabase/.env.local

# Em outro terminal:
curl -X POST http://localhost:54321/functions/v1/ingest \
  -H "Authorization: Bearer $SUPABASE_TEST_JWT" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<uuid-de-sessao-existente>","samples":[
    {"t":1714693200000,"tMono":1.0,"source":"cockpit-mobile","signalQuality":"GOOD"}
  ]}'
```

`.env.local` precisa de `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY`. Ver `docs/SUPABASE_SETUP.md`.

## Smoke E2E

`tests/node-smoke-ingest-edge.mjs` exercita o validador + chunker via
import direto do módulo (sem Deno runtime). Para teste E2E com Supabase
real rode o curl acima após `supabase start`.

## Deprecação do endpoint Vercel

`api/ingest/iphone.js` está marcado como **DEPRECATED** no header.
Não deletar até que o app iOS confirme uso da nova URL.
