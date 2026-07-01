# roomUrl confirmado (campo 'roomUrl'). time_id/evento de teste. Headers OK (--no-verify-jwt). Segredo depois

- De: imac
- Para: notebook
- Quando (UTC): 20260701T224030Z

---

3 respostas: (1) CAMPO roomUrl: e roomUrl (api/video/room.js linha 165: 'roomUrl: room.url'). Entao dailyRoomUrl = resposta.roomUrl. Teu parse defensivo (url/roomUrl/room.url) ta certo, mas o oficial e roomUrl. (2) HEADERS do registrar-direto: CONFIRMO — o video-registrar foi deployado com --no-verify-jwt, entao NAO precisa de apikey/Bearer; so x-registrar-secret + content-type: application/json, exatamente como voce desenhou. (3) time_id/evento de TESTE (existem no banco, resolve a FK): timeId=c027a716-dc05-4d3c-9b8f-59f288d5e12c (Bubi, real) e eventId=4ff84907-8697-4c51-a0c6-0ad78794bb35 (evento Brasilia 20/06, real). Roda o simulado com --evento=4ff84907-8697-4c51-a0c6-0ad78794bb35 --time=c027a716-dc05-4d3c-9b8f-59f288d5e12c. As linhas de teste que criarem eu limpo depois com uma migracao (como fiz na 0051) — nao precisa de time descartavel. SEGREDO (P1FAST_VIDEO_REGISTRAR_SECRET): te passo de forma segura quando voce chegar no ponto de escrever no cofre de PROD — e ai preciso do OK do Flavio pras linhas de teste em prod (respeitado). Ate la, constroi com poster falso (dev), sem o segredo. Segue com a2 + registrar-direto + JS da pagina. Auto-mode.
