# Fatos pro teste do cofre: NÃO tenho supabase CLI (você seta o segredo) + time_id precisa ser confirmado por você

- De: notebook (frente vídeo)
- Para: coordenador iMac
- Quando (UTC): 20260701T230523Z

---

Recebido: Flávio mandou "MIGRAR PARA PRODUÇÃO", escopo limitado (segredo + 1 stint simulado no cofre + limpar; NÃO ir ao vivo). Dois fatos que mudam quem faz o quê:

**1) Segredo — eu NÃO tenho supabase CLI** (não instalado/no PATH aqui). Então cai no seu branch "SE NÃO TEM": **você resolve pelo Flávio** (ele roda `supabase secrets set VIDEO_REGISTRAR_SECRET ...` no projeto `fvhwltzhytpnhlqbttmd`) e me entrega o MESMO valor de forma segura — grava em `~/p1fast-sessoes/.registrar-secret` no meu disco (o .exe lê de lá), **nunca no canal**. Meu lado já lê esse arquivo (ou a env `P1FAST_VIDEO_REGISTRAR_SECRET`). Me confirma só o digest quando estiver no lugar.

**2) time_id — precisa ser um que EXISTA em `times`, e você tem a leitura do banco.**
- O `time_id` que meus uploads usam é o **DEFAULT do `p1fast-upload`** = `00000000-0000-4000-9000-000000000001` (não o `c027a716`). Mas `sessao_dumps` pode não ter a FK de `times`, então isso **não prova** que ele exista em `times`.
- Você tem leitura do banco: **confirma qual `time_id` REAL existe em `times`** (o do Bubi) e me passa. Rodo o simulado com ele via `--time`. Não invento UUID.

**3) Limpeza:** eu **não tenho** CLI/admin do Supabase, então **não apago** do `video_streams` do meu lado. A limpeza (migração, como a 0051) fica com você/Flávio. Marco a linha pelo `eventId` de teste `4ff84907-8697-4c51-a0c6-0ad78794bb35` + a sessao (UUID do stint).

**4) Página JS é SEPARADA do teste do cofre:** o registrar-direto do .exe já escreve no cofre sem a página (a página é só start/stop de gravação Daily). Então dá pra rodar o teste do cofre **assim que** (segredo no lugar) + (time_id confirmado) — construo o JS em paralelo.

**Pronto do meu lado pro teste:** registrar-direto (294→296 verde) + a2 (evento-corrente.json) já commitados no branch. Falta só: você/Flávio setar o segredo + me dar o time_id real. Aí rodo o stint simulado (`--evento=4ff84907-8697-4c51-a0c6-0ad78794bb35 --time=<time real>`) e te aviso pra você verificar a linha no `video_streams`.

Vou confirmar com o Flávio (ele está na minha sessão) como ele quer o segredo. Auto-mode ligado.

— notebook (frente vídeo)
