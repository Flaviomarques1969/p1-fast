# DIAGNÓSTICO — Vídeo (Osmo) não foi gravado: causa-raiz no código (29/06/2026)

Pedido do Flávio: dia de pista no fim de semana (sáb/dom 27-28/06); cobrou o vídeo. "Descubra onde está a falha, analise o código."

## Sintoma
- Tabela `video_streams` (índice de gravações de vídeo) **VAZIA** — 0 registros, de qualquer data.
- `volta_video` também vazia. Nenhum vídeo catalogado no sistema.

## CAUSA-RAIZ (verificada no código)
O fluxo de vídeo (Daily.co) **liga o AO VIVO mas nunca INICIA a gravação**. Falta o gatilho "começar a gravar". Habilitar ≠ iniciar.

Evidência:
1. **Caminho Osmo (Central web) → `api/video/room.js` (linhas 97-108):** cria a sala Daily SEM `enable_recording` nas properties. Por esse caminho a gravação nem é habilitada.
2. **Caminho app iOS → `supabase/functions/stream-start/index.ts:68`:** cria a sala COM `enable_recording: "cloud"` — mas isso só PERMITE gravar. Não há disparo de início.
3. **Nenhum cliente inicia a gravação:** grep por `startRecording|start_cloud_recording|/recordings (start)|auto_start_recording|recordings_template` em `web/`, `ios/p1fast-ios/Sources/`, `api/`, `supabase/functions/` → **VAZIO**. `ios/.../StreamCoordinator.swift` chama `stream-start` e dá `client.join(...)` (linha ~280) mas NÃO chama startRecording depois.
4. **A recepção existe e foi testada com FAKE:** `supabase/functions/admin-test-video-cycle/index.ts` (TESTE 7, linhas 146-164) simula o webhook `recording.ready-to-download` com `fakeRecordingId`/`evt_test_` — ou seja, a indexação (`daily-recording-hook` → `video_streams`) foi provada apenas com um evento fabricado, nunca com gravação real.

## Cadeia da falha
ao vivo OK (publish/join funciona) → gravação NUNCA iniciada → Daily nunca grava → webhook `daily-recording-hook` nunca é chamado de verdade → `video_streams` vazio.

## Observação (possível confusão de UI)
Em `web/teste-aparelhos/index.html` o selo "GRAVAÇÃO · gravando" (verde) é da TELEMETRIA (GPS+motor, IndexedDB local), NÃO do vídeo. Pode ter passado a impressão de que o vídeo gravava.

## Onde o vídeo do fim de semana PODE estar (o sistema não gravou)
1. Cartão microSD da câmera Osmo Action 6 (se apertaram REC nela) — físico.
2. (improvável) iniciado à mão no painel do Daily.co — só confirma com `DAILY_API_KEY` (no servidor de publicação, não no ambiente local do iMac).

## Conserto proposto (DEV — não recupera o passado)
1. No caminho da Osmo: incluir `enable_recording: "cloud"` na criação da sala (`api/video/room.js`).
2. Disparar o início da gravação quando a transmissão começa (Daily: `POST /v1/rooms/{name}/recordings/start` ou `start_cloud_recording`/auto-start na sala/token) e parar no fim.
3. Teste real ponta a ponta (não só evento simulado) antes do próximo dia de pista.

Limitação: não acessei o Daily.co (chave fora do ambiente local) nem o cartão físico. Diagnóstico baseado no código + estado das tabelas na nuvem.
