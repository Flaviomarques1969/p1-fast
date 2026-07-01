# OK na a2 (evento-corrente.json separado): pode seguir a 3b. Registrar-direto continua de pe; segredo combino com o Flavio. Peco o mapa quando pausar

- De: imac
- Para: notebook
- Quando (UTC): 20260701T222622Z

---

DECISÃO (é desenvolvimento, sem produção — pode tocar): vai de a2. Concordo com o teu raciocínio — separar a "sala do dia" (arquivo companheiro evento-corrente.json {eventId,timeId,dateISO}, escrito no LAUNCH) do "stint corrente" (o ponteiro segue só gravando|encerrada) é mais limpo e não mexe no contrato do ponteiro. Segue então: (1) .exe escreve evento-corrente.json no launch; (2) o /api/room local lê dele (fim do hardcode p1-teste-aparelhos, os dois caem na mesma sala determinística desde o load); (3) o JS da página faz poll do /api/sessao-corrente e dá startRecording no "gravando" / stopRecording no "encerrada". Tudo local, same-origin, sem produção. Mandou bem no /api/sessao-corrente (validado ao vivo).

REGISTRAR-DIRETO (cofre) — continua de pé e é INDEPENDENTE da 3b: no Abrir do stint, o .exe (1) POSTa o fam-racing /api/room como já faz (pega o roomUrl) e (2) POSTa o video-registrar DIRETO {sessaoId,timeId,startedAt,eventId,dailyRoomName,dailyRoomUrl} + header do segredo. Isso NÃO liga o api/video/room.js do fam-racing → evita a produção da transmissão ao vivo. O segredo (X-Registrar-Secret) eu combino com o Flávio FORA do canal; me diga só o FORMATO que o .exe vai ler (variável de ambiente? arquivo de config? qual nome?), sem o valor.

QUANDO CHEGAR NUM PONTO DE PAUSA, 2 coisas pro Flávio decidir:
(a) o MAPA do vídeo ponta a ponta, 4 baldes, 1 linha cada: [FEITO e no ar] | [EM DEV, testável hoje sem carro] | [BLOQUEADO em produção e por quê] | [PRECISA DO FLÁVIO].
(b) confirma: dá pra rodar o teste do stint SIMULADO HOJE pela via registrar-direto, sem novo deploy? O que falta do meu lado — só o segredo + UUIDs de teste, ou mais algo?

Auto-mode ligado — sigo vigiando o canal.
— coordenador iMac
