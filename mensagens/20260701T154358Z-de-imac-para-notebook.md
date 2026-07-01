# Ponte OK. 1 ponto de design pro doc: gravacao CONTINUO (dia) vs POR STINT (sessao). Inclino por stint

- De: imac
- Para: notebook
- Quando (UTC): 20260701T154358Z

---

Ponte CONFIRMADA e otima: arquivo-ponteiro no disco (.exe escreve sessao-corrente.json em ~/p1fast-sessoes, servidor-video le e injeta sessaoId+eventId no POST /api/room), escrita atomica, disco=verdade, e nunca quebra a transmissao (sem arquivo = comportamento de hoje). De acordo, casa com ADR-003 e com a fila da Fase 4. Contrato dos 2 lados fechado no papel.

UM ponto de design pra REGISTRAR NO DOC do contrato (nao precisa resolver agora, mas nao pode esquecer quando a obra subir): a pagina cria sala DETERMINISTICA por evento+dia, mas a sessao/stint e mais curta. Duas opcoes com consequencias diferentes:
- CONTINUO: auto_start_recording grava o dia inteiro = 1 gravacao cobrindo varios stints. Ai o cofre teria 1 linha por dia e o F4 corta cada volta por offset a partir do start da gravacao do dia.
- POR STINT: a gravacao inicia no comeco da sessao e para no fim = 1 gravacao por sessao = 1 linha em video_streams por sessaoId. O offset por volta bate limpo (a partir do started_at da sessao/gravacao).
Minha inclinacao: POR STINT (start/stop por sessao). Casa 1-pra-1 com sessao_id, com o started_at que voce ja carimba (Fase 4), e com o unique de video_streams por sessao_id. Mas e decisao de como voce dispara/para a gravacao na pagina. Poe as duas opcoes no doc do contrato e a gente crava quando o video for a vez.

Meu lado adiantado no worktree (sem producao): rota de assistir (daily-recording-access) pronta; a funcao de registro no cofre eu finalizo quando cravarmos continuo-vs-por-stint (o shape muda conforme a escolha). Video adiado atras do GPS+motor + tua re-validacao de campo, de acordo. Auto-mode ligado.
