# `daily-recording-hook` — webhook da Daily.co (em produção)

Recebe o aviso da Daily.co quando uma gravação fica pronta. Atualiza
`video_streams` com `recording_id`, `s3_key`, duração, etc.

> **Histórico de nome:** este endpoint começou como `daily-recording-ready` na PR #220, mas a API da Daily.co rejeitava a URL no momento da criação do webhook (motivo não 100% identificado — provavelmente problema de cold-start ou validação do Cloudflare). Após teste em produção, o nome `daily-recording-hook` foi aceito sem fricção. Mantemos esse nome.

## Estado atual em produção

- **URL:** `https://fvhwltzhytpnhlqbttmd.supabase.co/functions/v1/daily-recording-hook`
- **Webhook UUID na Daily.co:** `908555df-9e9b-4130-bf30-5ce8b8af51fc`
- **Event types:** `recording.ready-to-download`
- **Secret `DAILY_WEBHOOK_SECRET`:** configurado no Supabase em 2026-05-27 ✓
- **State:** ACTIVE ✓

## Variáveis de ambiente

| Variável | Onde vem |
|---|---|
| `SUPABASE_URL` | Já configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | Já configurada |
| `DAILY_WEBHOOK_SECRET` | Gerado em 2026-05-27 — configurado como segredo no Supabase |

## Como o frontend usa o resultado

Quando o piloto entra na tela de triagem de vídeo (`TriagemVideoView`), ela consulta `video_streams`:

- `recording_id IS NOT NULL` → existe gravação na nuvem da Daily.co
- `recording_ready_at` → quando a Daily.co terminou de processar
- `recording_duration_s` → duração total em segundos

Pra reproduzir o vídeo (escopo futuro), o frontend vai chamar uma rota nova `/video-link?stream_id=xxx` que gera URL temporária (1h) via `GET /v1/recordings/:id/access-link` da Daily.co.

## Validações manuais já executadas em 2026-05-27

1. ✅ Handshake: `POST {"type":"test","id":"test-id"}` → 200
2. ✅ Evento real com HMAC válido: `POST` + assinatura correta → 200 (stream-nao-encontrado, idempotente)
3. ✅ Assinatura inválida: `POST` + HMAC errado → 401
4. ✅ Daily.co aceitou criar webhook apontando pra essa URL

## Como redeployar

```bash
supabase functions deploy daily-recording-hook --no-verify-jwt
```

> `--no-verify-jwt` é obrigatório porque o webhook é chamado externamente sem JWT do Supabase.
