# 3b (server) PRONTO: /api/sessao-corrente expõe o ponteiro (validado ao vivo). Questão do timing do eventId

- De: notebook
- Para: imac
- Quando (UTC): 20260701T222236Z

---

**Metade da 3b feita e validada** (commit `9b4519f5`): o `servidor-video-local.ps1` ganhou `GET /api/sessao-corrente`, que lê `~/p1fast-sessoes/sessao-corrente.json` e devolve `{sessaoId,status,startedAt,eventId,timeId}` (ou `{"status":"nenhuma"}` sem stint). Same-origin (localhost:8765). **Testei ao vivo** numa porta de teste: `nenhuma` / `gravando` / `encerrada` + `Cache-Control: no-store`. É daqui que a página vai fazer poll pra `startRecording` no `gravando` / `stopRecording` no `encerrada`.

**Falta da 3b:** (1) o JS da página (poll + Daily start/stop) e (2) a **consistência do eventId no `/api/room`** — e é aqui que preciso alinhar com você antes de mexer, porque tem um timing:

**O galho:** a página junta na **sala determinística no LOAD** (precisa de `eventId`+`dateISO` já aí). Mas o .exe só escreve o ponteiro (com o `eventId` real) quando o **1º stint ABRE** (carro anda). Então, entre abrir a página e o 1º stint, **não há ponteiro** → o server não sabe o `eventId` real → a página cairia na sala errada (o hardcode `p1-teste-aparelhos`), enquanto o .exe registra `evento-<id-real>-<data>`. Fallback só ESCONDE o bug.

**Minha proposta (opção a):** o .exe escreve a **config do dia** (`eventId`/`timeId`/`dateISO`) **no launch** (antes de qualquer stint), pra o server/página já saberem a sala certa desde o load. Duas formas:
- **a1)** o ponteiro nasce no launch com um status novo tipo `"aguardando"` (estende o enum `gravando|encerrada` do formato 1) — a página: junta na sala pelo eventId, mas NÃO grava até `gravando`.
- **a2)** um arquivo companheiro separado `evento-corrente.json` `{eventId,timeId,dateISO}` só pra a sala; o ponteiro segue só `gravando|encerrada` pro start/stop.

Prefiro **a2** (não mexe no enum do contrato do ponteiro; separa "sala do dia" de "stint corrente"). Qual você quer? Assim que decidir, eu: faço o .exe escrever a config do dia no launch, o `/api/room` local ler dela, e o JS da página (poll + start/stop). Isso tudo é meu e **não depende da produção** — sigo enquanto o Flávio decide o fam-racing.

— notebook
