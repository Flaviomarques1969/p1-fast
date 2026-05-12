# Stream Edge Functions — MS-11.2

Três rotas do servidor que cuidam do ciclo de vida do vídeo ao vivo via Daily.co:
- **stream-start**: cria room no Daily.co, registra `video_streams`, retorna URL pro app
- **stream-end**: encerra room, marca `status='encerrado'`
- **stream-heartbeat**: keep-alive (5s), aplica regras de bateria (Q26)

## Variáveis de ambiente necessárias

Configurar no painel do Supabase em **Project Settings → Edge Functions → Secrets**:

| Variável | Onde vem | Sensibilidade |
|---|---|---|
| `SUPABASE_URL` | Já configurada (Supabase preenche) | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Já configurada (Supabase preenche) | Alta — não compartilhar |
| `DAILY_API_KEY` | Painel Daily.co → Developers → API Keys | **Alta — não expor** |

A `DAILY_API_KEY` fica **só no servidor**. O aplicativo iOS jamais vê esse valor — ele só recebe a URL pública da room Daily.co (que é segura por design: cada room tem token e expira em 4h).

## Como publicar no servidor

```bash
supabase functions deploy stream-start
supabase functions deploy stream-end
supabase functions deploy stream-heartbeat
```

## Como o app iOS chama

```swift
// stream-start
POST /functions/v1/stream-start
Headers: Authorization: Bearer {user_jwt}
Body: { "sessao_id": "uuid", "bateria_inicio": 87 }
Response: { "video_stream_id", "daily_room_url", "daily_room_name" }

// stream-heartbeat (a cada 5s)
POST /functions/v1/stream-heartbeat
Body: { "video_stream_id": "uuid", "bateria": 45 }
Response: { "ok": true, "status": "ao_vivo", "aviso"?: "bateria_baixa" }

// stream-end
POST /functions/v1/stream-end
Body: { "video_stream_id": "uuid", "motivo": "manual", "bateria_fim": 32 }
Response: { "ok": true }
```

## Custos esperados (Q25 — teto US$ 50/mês)

- Daily.co cobra por minuto. Plano básico ~US$ 0.004/min de stream.
- 1 stint de 20 min: ~US$ 0.08
- 10 stints/dia × 4 eventos/mês = ~US$ 3.20/mês de uso pesado
- Gravação cloud (Q18) custa adicional — incluída no teto

## Idempotência

- **stream-start**: se já existe stream pra sessao, retorna o existente (não duplica)
- **stream-end**: se já encerrado, retorna ok
- **stream-heartbeat**: heartbeat de stream encerrado é no-op
