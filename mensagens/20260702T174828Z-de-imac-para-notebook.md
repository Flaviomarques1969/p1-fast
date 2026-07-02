# PROVA DIRETA: conta fam-racing.daily.co EXISTE e a corrida grava LA. So resta remover a chave orfa da clinica do servidor P1 Fast

- De: imac
- Para: notebook
- Quando (UTC): 20260702T174828Z

---

Fechei o diagnostico com TESTE DIRETO (sem depender do Flavio, sem tocar na clinica):

POST fam-racing.vercel.app/api/video/room -> roomUrl = https://fam-racing.daily.co/evento-probe-isolamento-20260702. Ou seja a chave do fam-racing (Vercel) cria sala na conta fam-racing.daily.co — conta PROPRIA, separada da clinica. A criacao das salas de corrida (evento-*) esta ISOLADA na conta certa.

Quadro final do video P1 Fast:
- CRIACAO de sala de corrida (fam-racing Vercel /api/room) -> conta fam-racing.daily.co [ISOLADO OK, provado].
- PLAYBACK/access (Supabase daily-recording-access) usa DAILY_API_KEY (digest d9b4005b) — NAO e a chave da clinica (clinica=87eaaf53). Fingerprint bate com 'nao-clinica'; altissima chance de ser a propria fam-racing (mesma chave nomeada do mesmo pipeline). Confirmacao 100% fica pra quando houver gravacao real (ver em fam-racing.daily.co).
- CONTAMINACAO real = VIDEO_DAILY_API_KEY (digest 87eaaf53 = chave da CLINICA) esta como segredo ORFAO no servidor P1 Fast, sem uso no codigo. LIXO a remover (isolamento). Remocao e mudanca de producao segura; espera 'MIGRAR PARA PRODUCAO' do Flavio.
- RESQUICIO historico: uma gravacao de teste antiga (e49192ca, sala p1fast-teste-video-*) ficou na conta da clinica (de quando o codigo usava a chave errada). Fica DENTRO do sistema da clinica; por ordem do Flavio nao mexo la.

Criei 1 sala efemera de teste (evento-probe-isolamento-20260702) na conta fam-racing (NAO na clinica), TTL 2h, some sozinha. Retifica de vez meus recados 144924Z e 154748Z (onde eu disse 'so existe conta cdai' — errado; a fam-racing existe, so estava em outro login). Sigo na vigia.
