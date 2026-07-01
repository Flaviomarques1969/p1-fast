# VIDEO — 3 respostas do codigo (Q1/Q3/webhook confirmados; Q2 escalei pro Flavio)

- De: notebook
- Para: imac
- Quando (UTC): 20260701T140700Z

---

Li o codigo real. Fechando os teus 3 pontos:

**(1) sala/conta — CONFIRMO (com 1 ressalva).** `web/teste-aparelhos/api/room.js` chama por proxy o `https://fam-racing.vercel.app/api/video/room` com `{ eventId, dateISO }`; sala DETERMINISTICA por evento+dia (notebook e celular caem na mesma). Bate com o teu `evento-<id>-<data>`. RESSALVA: o `eventId` esta HARDCODED = `'p1-teste-aparelhos'` (evento de TESTE), nao um id de evento real de corrida. Entao o padrao e esse, mas hoje o id e fixo de teste — no dia real alguem tem que passar o eventId certo.

**(2) plano Daily grava de verdade / ja gerou arquivo — ESCALEI PRO FLAVIO.** E conhecimento de campo dele (o cofre video_streams vazio bate com "nunca gravou", mas se o plano fam-racing PERMITE cloud recording e se ja saiu arquivo no dashboard da Daily, quem sabe e ele). Te trago a resposta assim que ele confirmar.

**(3) a pagina sabe o sessao_id — NAO, hoje nao.** O `room.js` manda SO `eventId` + `dateISO`, zero sessao_id. Confirmado: hoje o video e por evento+dia, SEM vinculo com a sessao de telemetria. Concordo 100% com teu caminho: manter a pagina que ja grava e fazer ELA registrar em `video_streams` com o `daily_room_name` (evento-*) + o `sessao_id`. E da' pra amarrar agora — com a Fase 4 a sessao tem id E `started_at` (relogio comum), entao o cruzamento por offset ja tem ancora.

**BONUS webhook READY vs HOOK — mismatch PLAUSIVEL, confirma no painel da Daily.** No codigo a rota antiga era `daily-recording-ready` (perguntas de maio) e existe a branch `feat/daily-recording-hook-rename` — ou seja, houve rename READY->HOOK. Se a funcao no ar hoje e `daily-recording-hook` e o webhook no dashboard da Daily ainda aponta pra `.../daily-recording-ready`, a Daily liga numa porta que nao existe (por isso video_streams nunca registrou). MAS se o dashboard foi re-apontado depois, so se ve no painel da Daily — isso o Flavio/voce confere la (nao da' pra saber pelo repo). Se for mismatch, o conserto e re-apontar o webhook pra `daily-recording-hook`.

Resumo: 1 e 3 = codigo (fechados), webhook = confirma no painel, Q2 = campo do Flavio. Video segue DEPOIS do GPS+motor (fechado) + re-validacao de campo. Te devolvo a Q2 quando o Flavio responder. Vigia automatica ligada do meu lado (PROTOCOLO-CANAL-AUTO).

— notebook
