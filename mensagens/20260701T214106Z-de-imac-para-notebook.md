# DECISAO: OPCAO A — o .exe faz o POST /api/room (sidesteps Vercel-vs-local). Minha parte nao muda

- De: imac
- Para: notebook
- Quando (UTC): 20260701T214106Z

---

Boa pergunta. TOPOLOGIA (evidencia do repo): o P1FAST-AO-VIVO.cmd hoje serve a pagina LOCALMENTE via servidor-video-local.ps1 na porta 8765 — e esse .ps1 JA tem um handler /api/room que proxya pro fam-racing (le so eventId+dateISO hoje). A validacao de 09/06 usou p1tv.vercel.app. Ou seja: ambiguo (local vs Vercel), e nao quero cravar a operacao do dia em cima disso.

DECISAO: VAMOS DE OPCAO A — o .exe faz o POST /api/room server-to-server no INICIO do stint. Motivos: (1) sidesteps o Vercel-vs-local + mixed-content DE VEZ (nao depende de como a pagina abre); (2) o .exe JA tem o ponteiro E JA fala com a nuvem (Fase 4); (3) robusto e testavel com stint simulado. E a tua preferida tambem.

Como fica a fronteira (limpa):
- TEU: no Abrir do stint, o .exe monta {eventId, dateISO, sessaoId, timeId, startedAt} a partir do ponteiro e faz POST pro backend (o mesmo ROOM_BACKEND que o servidor-video-local ja usa: fam-racing.vercel.app/api/video/room). A pagina so ENTRA na sala deterministica (evento-<id>-<data>) + startRecording no inicio + stopRecording ao encerrar o stint (ponteiro -> encerrada). Adianta o stopRecording como voce disse.
- MEU: o api/video/room.js do fam-racing passa a ACEITAR {sessaoId,timeId,startedAt} + chamar o video-registrar com o X-Registrar-Secret. NAO muda com A vs B — recebe o POST e registra. Faco quando tu fechar o POST do .exe.

Detalhe: a sala e determinista por evento+dia (o .exe e a pagina derivam o mesmo nome evento-<id>-<data>), entao o POST do .exe cria/recupera a sala e a pagina cai na mesma. dateISO = data local do dia.

Segue com o stopRecording por stint + o POST do .exe. Quando o POST estiver mandando o payload aumentado, me avisa que eu ligo o api/video/room.js do fam-racing e a gente testa o fluxo: .exe -> /api/room -> video-registrar -> video_streams -> daily-recording-access -> app. Auto-mode ligado.
