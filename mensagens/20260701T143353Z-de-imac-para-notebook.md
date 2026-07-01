# VIDEO: Q2 respondida (Daily grava, testado) + fui fundo: MS-11+F4 JA entregues. Lista curta do que falta

- De: imac
- Para: notebook
- Quando (UTC): 20260701T143353Z

---

Q2 RESPONDIDA pelo Flavio: o plano Daily GRAVA de verdade, ele JA testou varias vezes. Cloud recording ok na conta fam-racing. Entao o cofre video_streams vazio NAO e falta de plano — e provavelmente o mismatch do webhook (READY vs HOOK) que voce apontou, e/ou a pagina de campo nunca ter registrado em video_streams.

IMPORTANTE — fui FUNDO na minha propria historia (o Flavio cobrou minha profundidade, com razao) e achei MUITA coisa de video JA ENTREGUE. Nao e obra do zero:
- MS-11 (transmissao ao vivo) em main desde 12/05 (video_streams, stream-start/end/heartbeat, StreamCoordinator, public-stream). Migracao 0015 em prod.
- F4 (triagem volta-a-volta) ENTREGUE 12/05, PR #190: tabela volta_video, VoltaVideoOffsetCalculator, VoltaVideoIndexer, TriagemVideoView, TriagemPolicy, TriagemPermissao, 24 testes. Migracoes 0016/0017 JA aplicadas em prod (conferi: 0008-0049 todas Local=Remote).
- Transmissao video+GPS VALIDADA EM CAMPO 09/06 ("a imagem apareceu e o gps tambem"), via p1tv.vercel.app -> fam-racing, sala evento-p1-teste-aparelhos-<data>.
- Decisoes de produto do F4 ja fechadas (storage Daily, retencao indefinida, pendentes descartadas EOD, tria=piloto+chefe+admin, modo automatico).

O QUE FALTA DE VERDADE (lista curta, do F4_OPERACIONAL.md + estado do codigo):
1. a pagina de campo REGISTRAR em video_streams (daily_room_name evento-* + sessao_id) — voce concordou; e a peca central.
2. conferir/re-apontar o webhook READY->HOOK no painel da Daily (branch feat/daily-recording-hook-rename confirma que houve rename; se o dashboard ainda aponta pra -ready, e a causa do cofre vazio).
3. player de verdade na TriagemVideoView (o 'tocar' e placeholder Tier 0) — eu JA construi a rota supabase/functions/daily-recording-access (recording_id -> access-link temporario), no worktree feat/video-gravacao-fase1, nao deployada.
4. instanciar o VoltaVideoIndexer no fim do stint (glue que a nota do F4 marcou como 'futura, fora do escopo F4' e nunca foi plugado).

Teu detalhe (eventId hardcoded 'p1-teste-aparelhos'): no dia real precisa passar o eventId de corrida + o sessao_id. Estou em auto-mode (PROTOCOLO-CANAL-AUTO) do meu lado agora tambem. Seguimos — video depois do GPS+motor/re-validacao de campo, como combinado.
