# TESTE DO COFRE PASSOU (video_stream_id gravado) — mas peguei 2 achados: daily_room_name errado + domínio fam-racing vs cdai

- De: notebook (frente vídeo)
- Para: coordenador iMac
- Quando (UTC): 20260701T233845Z

---

Rodei o stint simulado (segredo conferido: `sha256(arquivo)==digest` ✓). **Escreveu no cofre.** Resultado bruto pra você validar/limpar:

- **sessaoId (UUID do stint):** `0539b12a-fcb9-4504-af61-3e09a9ba89ab`
- **POST `/api/room`** → HTTP **200**. resp: `roomName=evento-4ff84907-8697-4c51-a0c6-0ad78794-20260701`, `roomUrl=https://fam-racing.daily.co/evento-4ff84907-8697-4c51-a0c6-0ad78794-20260701`
- **POST `video-registrar`** → HTTP **200**, `{"ok":true,"sessao_id":"0539b12a-fcb9-4504-af61-3e09a9ba89ab","video_stream_id":"313bfbfb-cbd8-4b39-ab60-4d119a07181f"}`

Pipeline `.exe → /api/room → video-registrar → video_streams` **provado** (linha `video_stream_id=313bfbfb-cbd8-4b39-ab60-4d119a07181f`). Registrar respondeu **200** (não 201) com `ok:true` + os ids — write OK.

## 2 achados (o teste pegou — importante ANTES do uso real)

**1) `daily_room_name` que gravei está ERRADO (não bate com a sala real).**
- Eu **derivei** `dailyRoomName = evento-<eventId completo>-<2026-07-01>` = `evento-4ff84907-8697-4c51-a0c6-0ad78794bb35-2026-07-01`.
- Mas o fam-racing cria a sala como **`evento-4ff84907-8697-4c51-a0c6-0ad78794-20260701`** — eventId **truncado** (~30 chars) + data **sem hífens** (`YYYYMMDD`).
- Então a linha no cofre tem `daily_room_name` que **não corresponde à sala** → o `daily-recording-access` (que acha por room_name) não acharia a gravação real.
- **Correção (faço já):** paro de derivar e uso o **`roomName`/roomUrl da resposta** do `/api/room` (a fonte da verdade). O `daily_room_url` que gravei já está certo (veio do roomUrl); só o `daily_room_name` ficou derivado.

**2) Domínio: a sala saiu em `fam-racing.daily.co`** — não `cdai.daily.co` (onde caiu a sua gravação manual de mais cedo). Reacende a dúvida do começo: a `VIDEO_DAILY_API_KEY` (que o `daily-recording-access` usa pra achar a gravação) é da conta **fam-racing** ou **cdai**? Se a sala/gravação real cai em `fam-racing.daily.co`, a chave tem que ser dessa conta. **Confirma do seu lado** qual conta o `daily-recording-access` procura.

## Próximo
- **Corrijo o `dailyRoomName`** (usar o da resposta) — commit no branch. Isso muda o valor gravado numa próxima execução.
- **Re-teste?** Rodar de novo escreve OUTRA linha (a autorização era 1 linha). Você quer que eu re-rode com o nome corrigido (2ª linha de teste) pra você validar o nome certo, ou valida o fix de outra forma? Sua chamada.
- Limpeza: as linhas de teste = `sessao_id` `0539b12a-…89ab` (+ a 2ª se re-rodarmos). Marco pelo `eventId 4ff84907…`.

Segredo: combinado, **rotaciona** depois (você gera um novo fora do canal). Auto-mode ligado.

— notebook (frente vídeo)
