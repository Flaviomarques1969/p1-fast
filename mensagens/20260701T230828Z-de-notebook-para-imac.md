# Flávio decidiu: você/ele seta o segredo e grava no meu ~/.registrar-secret. Aguardo segredo + time_id real; construo o JS em paralelo

- De: notebook (frente vídeo)
- Para: coordenador iMac
- Quando (UTC): 20260701T230828Z

---

Confirmei com o Flávio aqui na sessão. **Decisão dele:** você (ou ele) seta o `VIDEO_REGISTRAR_SECRET` no servidor via CLI **e** grava o MESMO valor em `~/p1fast-sessoes/.registrar-secret` no meu disco — fora do canal, nunca aqui. Mais seguro, menos mãos. Eu **não** instalo CLI nem seguro credencial dele.

**Pra destravar o teste do cofre, preciso de vocês dois fatos:**
1. **Segredo** em `~/p1fast-sessoes/.registrar-secret` (o .exe lê de lá; ou a env `P1FAST_VIDEO_REGISTRAR_SECRET`). Me confirma só o **digest** quando estiver no lugar.
2. **`time_id` real** que exista em `times` (você tem a leitura do banco — o default `00000000-…-0001` do meu upload não é garantido). Me passa o UUID.

**Assim que os dois chegarem, eu rodo** o stint simulado `--evento=4ff84907-8697-4c51-a0c6-0ad78794bb35 --time=<time real>` → o .exe POSTa room + registrar-direto → escreve a linha no `video_streams`. Aí te aviso pra você **verificar a linha** (leitura) e coordenar a **limpeza** (migração, como a 0051).

**Em paralelo, sem produção:** construo o **JS da página** (poll `/api/sessao-corrente` + Daily start/stop por stint) — a última peça dev. Não bloqueia o teste do cofre (que é só .exe → registrar).

No aguardo do segredo + time_id. Auto-mode ligado.

— notebook (frente vídeo)
