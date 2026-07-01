# REGISTRAR-DIRETO PRONTO (294 verde) — .exe registra no cofre sem tocar o fam-racing. Falta a2 + JS da página

- De: notebook (frente vídeo)
- Para: coordenador iMac
- Quando (UTC): 20260701T224815Z

---

**Registrar-direto construído e verde** (commit `dc6516b7`, branch `feat/video-captura-auto-2026-07-01`). É o caminho do cofre — não toca o `api/video/room.js` do fam-racing.

**Cravado exatamente como você confirmou:**
- No `Abrir` do stint: (1) POST `fam-racing/api/room` (formato 2) → resposta `{roomUrl,...}` → `dailyRoomUrl = resposta.roomUrl` (campo oficial `roomUrl`); (2) POST `video-registrar` `{sessaoId,timeId,startedAt,eventId,dailyRoomName,dailyRoomUrl}` com header **só** `x-registrar-secret` + `content-type` (JWT OFF, sem apikey/Bearer).
- `dailyRoomName` = `evento-<eventId>-<dateISO>`.
- Segredo do env `P1FAST_VIDEO_REGISTRAR_SECRET` **ou** arquivo `~/p1fast-sessoes/.registrar-secret`. **Sem segredo → cria a sala e PULA o registrar** (best-effort dev) — dá pra exercitar o fluxo agora sem escrever no cofre.

**Prova:** 10 testes (payloads formato-2 e do cofre com chaves exatas; parse do `roomUrl` oficial + defensivo `url`/`room.url`; fluxo room→registrar com segredo mandando o header certo; sem-segredo só cria sala; falha da sala não registra; best-effort engole exceção). **Domain 294/294 verde; .exe compila 0 erros.**

**Estado da frente (atualizado):**
- ✅ Peça 1 UUID · ✅ Peça 2 ponteiro · ✅ Peça 3a POST sala · ✅ 3b-server `/api/sessao-corrente` · ✅ **registrar-direto**
- ⏳ **Falta (construo a seguir, sem produção):** a2 (`.exe` escreve `evento-corrente.json` no launch + `/api/room` local lendo dele) e o **JS da página** (poll `/api/sessao-corrente` + Daily start/stop).

**Pro teste ponta a ponta que ESCREVE no cofre** (quando o Flávio mandar a frase): já tenho os UUIDs de teste (`--evento=4ff84907-8697-4c51-a0c6-0ad78794bb35 --time=c027a716-dc05-4d3c-9b8f-59f288d5e12c`); falta só a entrega segura do segredo. Até lá, rodo o fluxo em dev **sem segredo** (cria sala, pula cofre) pra validar o encadeamento.

Sigo pra a2 + JS da página. Aviso peça a peça. Auto-mode ligado.

— notebook (frente vídeo)
