# `daily-recording-ready` — webhook da Daily.co

Recebe o aviso da Daily.co quando uma gravação fica pronta. Atualiza
`video_streams` com `recording_id`, `s3_key`, duração, etc.

## O que é

Quando um stint termina e a Daily.co finaliza a gravação na nuvem deles,
ela manda automaticamente um aviso (webhook) pra essa rota. Sem essa
rota, a aplicação não saberia que a gravação ficou pronta nem onde
buscar.

## Variáveis de ambiente necessárias

Configurar no painel do Supabase em **Project Settings → Edge Functions → Secrets**:

| Variável | Onde vem | Valor |
|---|---|---|
| `SUPABASE_URL` | Já configurada | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Já configurada | — |
| `DAILY_WEBHOOK_SECRET` | **Painel Daily.co → Webhooks → ao criar webhook** | base64 |

**Atenção:** `DAILY_WEBHOOK_SECRET` é **diferente** de `DAILY_API_KEY`. O webhook secret é só usado pra validar que o aviso veio mesmo da Daily.co. A API key (que já temos) é pra criar salas e gerenciar gravações.

## Como configurar o webhook no painel da Daily.co

Passo a passo:

1. Acesse o painel da Daily.co em https://dashboard.daily.co.
2. Vá em **Developers → Webhooks**.
3. Clique em **Create Webhook**.
4. **URL:** `https://fvhwltzhytpnhlqbttmd.functions.supabase.co/daily-recording-ready`
5. **Event types:** marque `recording.ready-to-download`.
6. Clique **Create**.
7. **Copie o segredo (base64) que a Daily.co gera.** Esse é o `DAILY_WEBHOOK_SECRET`.
8. Cole esse segredo no painel do Supabase em **Project Settings → Edge Functions → Secrets** com o nome `DAILY_WEBHOOK_SECRET`.
9. Volte ao painel da Daily.co e clique em **Send test event** pra confirmar que tudo funciona.

## Como implantar a função (depois da aprovação do Flávio)

```bash
supabase functions deploy daily-recording-ready
```

Depois disso, a função fica disponível na URL acima.

## Como o frontend usa o resultado

Quando o piloto entra na tela de triagem de vídeo (`TriagemVideoView`), ela consulta `video_streams` filtrando pelos campos:

- `recording_id IS NOT NULL` → existe gravação na nuvem da Daily.co
- `recording_ready_at` → quando a Daily.co terminou de processar
- `recording_duration_s` → duração total em segundos (pra validar offsets)

Pra reproduzir o vídeo (que ainda **não está nesta tarefa**), o frontend chama uma rota futura `/video-link?stream_id=xxx` que vai gerar URL temporária (1h) chamando a API da Daily.co.

## Limites e observações

- **A URL de download direta NÃO vem no webhook.** Daily.co manda só `recording_id` + `s3_key`. URL final é gerada on-demand chamando `GET /v1/recordings/:id/access-link` (escopo futuro).
- **Replay protection:** rejeita avisos mais antigos que 5 minutos pra evitar reenvio malicioso.
- **Idempotência:** se o mesmo `recording_id` chegar 2 vezes, a 2ª é no-op.
- **Eventos não-recording são ignorados com 200** pra a Daily.co não reentregar em loop.

## Custo

O webhook em si é gratuito. O custo continua sendo da gravação na Daily.co (Q25: teto US$ 50/mês acordado).
