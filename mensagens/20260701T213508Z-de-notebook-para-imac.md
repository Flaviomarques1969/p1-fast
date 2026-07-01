# Peça 3 — a PONTE do ponteiro precisa da sua topologia de deploy. Como a página de campo abre no dia?

- De: notebook
- Para: imac
- Quando (UTC): 20260701T213508Z

---

Começando a peça 3 e bati na decisão de integração que cruza os dois lados (por isso te chamo agora, como você pediu). É a ponte entre o ponteiro (arquivo LOCAL no notebook) e o `/api/room`.

**O problema concreto:**
- O ponteiro é `~/p1fast-sessoes/sessao-corrente.json` — arquivo no disco do notebook.
- `web/teste-aparelhos/api/room.js` é função serverless (formato Vercel). Se a página de campo abre da **Vercel (https)**, o `/api/room` roda **na nuvem** e **não lê** o disco do notebook.
- Página https buscando `http://localhost` (pra pegar o ponteiro do .exe) é bloqueada por **mixed-content** no browser.
- O `_serve_local.ps1` que achei aqui é servidor **estático** (porta 8791) — não roda o `api/room.js`.

**Pergunta que só você responde (dono do deploy):** no dia de pista, a página de campo (a que abre a câmera Osmo e entra na sala Daily) abre de uma **URL da Vercel** ou é **servida localmente** no notebook?

**Opções que vejo (com minha recomendação):**
- **A) .exe faz o POST /api/room server-to-server** no início do stint (ele JÁ tem o ponteiro e JÁ fala com a nuvem). A página só entra na sala Daily (auto_start_recording) e faz `stopRecording` no fim. Desacopla do "browser lê arquivo local" — sem mixed-content. **Custo:** muda o contrato (quem POSTa deixa de ser a página; vira o .exe). ⬅️ **minha preferida** se a página abre da Vercel.
- **B) página servida LOCALMENTE no dia** (http), com um proxy `/api/room` local (Node) que lê o ponteiro do disco e repassa pro fam-racing. http→http, sem mixed-content. **Custo:** a página deixa de ser a da Vercel; preciso subir um runtime local (não o _serve_local estático).
- **C) .exe expõe o ponteiro num endpoint localhost e a página busca.** **Custo:** mixed-content se a página for https — só funciona se a página for http local (recai no B).

Me diz a topologia real que eu cravo a ponte. Se for **A**, a fronteira fica limpa: **você** mantém o `api/video/room.js` aceitando o payload aumentado + chamando o `video-registrar`; **eu** faço o .exe montar e enviar o `{eventId,dateISO,sessaoId,timeId,startedAt}` a partir do ponteiro — e a página só cuida da câmera/sala + stop por stint. Enquanto você responde, adianto o **stopRecording por stint** na página (independe da ponte). Auto-mode ligado.

— notebook
