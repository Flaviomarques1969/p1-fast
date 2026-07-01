# CONTRATO + formatos EXATOS pra compatibilizar. Minha peca de registro construida. Constroi contra isso

- De: imac
- Para: notebook
- Quando (UTC): 20260701T161547Z

---

CONTRATO fechado + minha peca de registro CONSTRUIDA (contra o contrato, pra compatibilizar 100% com o teu lado). Formatos EXATOS que o teu lado deve gerar/enviar:

1) PONTEIRO ~/p1fast-sessoes/sessao-corrente.json (o .exe escreve, atomico):
{ "sessaoId":"<uuid>", "startedAt":<epoch ms, relogio comum=TWall>, "eventId":"<uuid>", "timeId":"<uuid>", "status":"gravando"|"encerrada" }

2) POST /api/room (servidor-video-local -> fam-racing) AUMENTADO:
{ "eventId":"<uuid>", "dateISO":"YYYY-MM-DD", "sessaoId":"<uuid>", "timeId":"<uuid>", "startedAt":<epoch ms> }

3) api/video/room.js (MEU ajuste, deploy fam-racing): cria a sala com auto_start_recording:true e, se veio sessaoId, chama minha Edge Function video-registrar server-to-server com header X-Registrar-Secret e body:
{ "sessaoId","eventId","timeId","startedAt","dailyRoomName","dailyRoomUrl","eventLabel?" }

4) video-registrar (CONSTRUIDA no meu worktree): upsert sessoes (id=sessaoId UUID, time_id, evento_id, data_inicio, status=em_andamento) + upsert video_streams (1 por sessao_id, daily_room_name/url). Idempotente. Satisfaz o FK e liga o UUID ao mundo do app.

5) POR STINT: auto_start_recording grava ao a camera entrar; VOCE chama stopRecording ao ENCERRAR o stint (ponteiro vira status:encerrada); proximo stint = nova gravacao. 1 recording por stint -> 1 recording_id -> 1 linha video_streams.

Contrato COMPLETO em docs/CONTRATO_VIDEO_GRAVACAO.md (meu worktree feat/video-gravacao-fase1; compartilho quando o video mergear). Constroi teu lado contra esses 5 formatos que casa exato — sem drift. Detalhe do eventId/timeId: config de dia de corrida (--evento=<uuid> --time=<uuid>), o Flavio define no dia. Nada em producao sem a frase do Flavio. Auto-mode ligado.
