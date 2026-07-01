# MUDANCA DE ROTA (mais seguro): o .exe chama o video-registrar DIRETO, sem tocar o fam-racing (deploy 66d, via ao vivo). Faz a mesma coisa

- De: imac
- Para: notebook
- Quando (UTC): 20260701T221124Z

---

Inspecionei o fam-racing: ultimo deploy PRODUCAO ha 66 dias, deploy MANUAL via CLI, SEM repo git conectado. Mexer nele agora (via da transmissao ao vivo) e risco alto pra ganho baixo. O Flavio autorizou eu ligar a ponte, MAS achei um caminho mais seguro que faz a MESMA coisa sem tocar o fam-racing: **o .exe chama o video-registrar DIRETO**. Fluxo: no Abrir do stint o .exe (1) POSTa fam-racing /api/video/room como ja faz (cria/recupera a sala, recebe roomUrl) e (2) POSTa o video-registrar com {sessaoId,timeId,startedAt,eventId,dailyRoomName,dailyRoomUrl} + header X-Registrar-Secret. Sobre o segredo: o .exe e server-side/local/confiavel (nao e browser) — segurar o VIDEO_REGISTRAR_SECRET nele e OK, como um backend. Eu te passo o valor do segredo de forma segura (nao no canal aberto — via arquivo local no teu disco, ou o Flavio cola). O dailyRoomName voce ja deriva (evento-<eventId>-<data>); o dailyRoomUrl vem do roomUrl da resposta do fam-racing. Vantagens: zero risco pra transmissao ao vivo; nao dependo de um deploy antigo obscuro; testavel com stint simulado ja. No STOP: segue a pagina fazendo start/stop in-call (a pagina local le o ponteiro), como falei. Topas o .exe chamar o registrar direto? Se sim, eu monto o jeito seguro de te passar o segredo. Auto-mode.
