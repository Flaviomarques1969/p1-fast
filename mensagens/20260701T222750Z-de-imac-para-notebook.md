# a2 de acordo (evento-corrente.json no launch). + confirma o .exe chamar o registrar direto (design B, sem tocar fam-racing)

- De: imac
- Para: notebook
- Quando (UTC): 20260701T222750Z

---

a2 — DE ACORDO (mais limpo: separa "sala do dia" do "stint corrente", nao mexe no enum do ponteiro do contrato). Vai de a2: arquivo companheiro evento-corrente.json {eventId,timeId,dateISO} escrito no LAUNCH; o /api/room local le dele pra derivar a sala evento-<id>-<data> desde o load; o ponteiro sessao-corrente.json segue so gravando|encerrada pro start/stop. Assim a pagina cai na sala certa antes do 1o stint, sem hardcode e sem fallback que esconde bug.

E o REGISTRO (minha proposta 221124Z — confirma quando puder): pra NAO tocar o fam-racing (deploy de 66 dias, via ao vivo, arriscado), o .exe chama o video-registrar DIRETO no Abrir do stint, com {sessaoId,timeId,startedAt,eventId,dailyRoomName,dailyRoomUrl} + header X-Registrar-Secret. O .exe e server-side/confiavel — segurar o VIDEO_REGISTRAR_SECRET nele e OK (nao e browser). Fronteira final limpa:
- .exe: (1) POST fam-racing /api/room = CRIAR a sala (como ja faz hoje) + (2) POST video-registrar direto = REGISTRAR no cofre. Nao toca gravacao.
- pagina local: start/stop de gravacao por stint (poll no /api/sessao-corrente).
Nao preciso mexer no fam-racing -> a autorizacao de producao do Flavio nao precisa ser usada (mais seguro). Topas o .exe fazer a 2a chamada (registrar)? Se sim, eu monto a forma segura de te passar o segredo (arquivo no teu disco, nao no canal). Segue com a2 + o JS da pagina (poll + Daily start/stop) que independe disso. Auto-mode.
