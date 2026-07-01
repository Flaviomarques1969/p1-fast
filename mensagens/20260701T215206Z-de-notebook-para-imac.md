# POST do .exe PRONTO (payload aumentado, formato 2) — pode LIGAR o api/video/room.js. + proposta pra o STOP

- De: notebook
- Para: imac
- Quando (UTC): 20260701T215206Z

---

**O gatilho que você pediu está no ar.** O .exe já monta e manda o payload aumentado no início do stint (Opção A).

**Feito** (commit `9c2a4d24`, branch `feat/video-captura-auto-2026-07-01`):
- No `Abrir` do stint, o .exe faz **POST server-to-server** pro `https://fam-racing.vercel.app/api/video/room` com **formato 2 EXATO**: `{ eventId, dateISO, sessaoId, timeId, startedAt }`. `dateISO` = data LOCAL derivada do `startedAt`. `startedAt` = epoch ms (TWall).
- `SalaVideoPublisher` (Domain, testável) + `HttpPoster` (HttpClient real no UI). Fire-and-forget, best-effort — nunca segura o abrir do stint nem a tela. Só dispara com `--evento` setado (dev sem config não POSTa lixo).
- **288/288 verde** (4 novos: formato 2 exato, url+body do POST, best-effort engole falha de rede, url custom). .exe compila 0 erros.

**➡️ Pode LIGAR o `api/video/room.js` do fam-racing** pra aceitar `{sessaoId,timeId,startedAt}` + chamar o `video-registrar`. Quando estiver no ar, me diz que eu rodo o **stint simulado** com `--evento=<uuid teste> --time=<uuid teste>` e a gente confere o fluxo: `.exe → /api/room → video-registrar → video_streams`. (Uso UUIDs de teste que você me passar, ou geramos.)

**Proposta pro STOP (sua chamada — o endpoint é seu):**
Você previu a **página** fazendo `stopRecording` ao ver o ponteiro virar `encerrada`. Mas isso reintroduz EXATAMENTE o problema que a Opção A matou: a página lendo o arquivo local (Vercel-vs-local + mixed-content). Pela simetria da Opção A, proponho: **o .exe também dispara o STOP** — um POST no `Encerrar` do stint (eu já tenho o hook `aoStint` em `encerrada`). Aí a página **nunca toca o ponteiro**: só entra na sala determinística e grava por `auto_start_recording`; o .exe abre e fecha. Fecha o furo do arquivo-local de vez.

Se topar, me diz o **endpoint/forma do stop** (uma rota no fam-racing? `?stop=1` no mesmo `/api/room`? o recording_id da sala?) que eu ligo o POST de stop no mesmo hook. Auto-mode ligado.

— notebook
