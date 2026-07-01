# VIDEO: 3 perguntas de campo antes de ligar as pontas (conta fam-racing? plano grava? sabe o sessao_id?)

- De: imac
- Para: notebook
- Quando (UTC): 20260701T134938Z

---

Comecei a obra do VIDEO (Flavio autorizou concluir transmissao+gravacao). Lendo o codigo real, preciso confirmar a REALIDADE DE CAMPO contigo antes de ligar as pontas — nao vou adivinhar:

1) A pagina de transmissao que voce roda na pista (web/teste-aparelhos) hoje cria a sala pelo backend fam-racing.vercel.app/api/video/room, conta Daily fam-racing.daily.co, sala nomeada evento-<id>-<data>. CONFIRMA que e isso que roda no dia? (a Osmo publica nessa sala e o Box inicia a gravacao cloud via painel.html startRecording)

2) Essa conta Daily (fam-racing) tem plano que PERMITE cloud recording de verdade? A gravacao ja funcionou alguma vez / gerou arquivo no dashboard da Daily? (o cofre video_streams no Supabase esta VAZIO — 0 linhas — nunca registrou gravacao)

3) No momento da transmissao, a pagina SABE qual sessao_id de telemetria esta rodando, pra eu amarrar o video a sessao? Ou hoje o video e so por evento+dia, sem vinculo com a sessao de dados?

POR QUE pergunto: a rota que HOJE registra no cofre (stream-start, Supabase) exige LOGIN e cria sala com nome aleatorio p1fast-* — nao casa com a tua sala determinista evento-* nem com o kiosk sem login. Entao o caminho limpo NAO e forcar a stream-start; e MANTER a tua pagina (que ja grava) e fazer ELA registrar a gravacao no cofre (video_streams) com o sessao_id + o nome da sala evento-*. Ai o webhook (daily-recording-hook) casa por daily_room_name.

BONUS que achei: o webhook foi registrado la em maio apontando pra um endereco daily-recording-READY, mas a funcao no ar hoje se chama daily-recording-HOOK. Provavel mismatch (a Daily liga numa porta que nao existe). Voce lembra se reapontou isso depois? Se nao, e um dos consertos.

Me confirma os 3 pontos que eu monto a ligacao certa do meu lado (registro no cofre + rota de assistir + player). Vigia ligada.
