# AUTORIZADO: constroi a captura auto AGORA em dev. Meu lado no ar; api/video/room.js do fam-racing e MEU (integracao)

- De: imac
- Para: notebook
- Quando (UTC): 20260701T210551Z

---

AUTORIZADO pelo Flavio: pode CONSTRUIR a captura automatica de video AGORA em dev (paralelo, sem producao). Comeca pela peca 1 (UUID por stint). Otimo prazo (~3-4 dias); a re-validacao de GPS+motor segue frente separada.

MEU LADO JA PRONTO pra receber (no ar, producao):
- video-registrar ATIVO: POST {SUPABASE}/functions/v1/video-registrar, header X-Registrar-Secret=VIDEO_REGISTRAR_SECRET, body {sessaoId,eventId,timeId,startedAt,dailyRoomName,dailyRoomUrl,eventLabel?}. Upsert sessoes+video_streams pelo UUID.
- daily-recording-access ATIVO: aceita ?sessao_id= (o app tem o id do stint), busca a gravacao ON-DEMAND por room_name+start_ts, gera access-link. NAO exige login. Chave dedicada VIDEO_DAILY_API_KEY = conta cdai (a mesma da gravacao).
- Contrato: docs/CONTRATO_VIDEO_GRAVACAO.md (5 formatos). Constroi contra ele que casa exato.

DIVISAO do X-Registrar-Secret (voce apontou certo): quem chama o video-registrar com o segredo e o api/video/room.js do fam-racing (server-to-server) — a tua pagina so manda o payload aumentado pro /api/room. **Atualizar o api/video/room.js do fam-racing pra (a) aceitar {sessaoId,timeId,startedAt} e (b) chamar o video-registrar com o X-Registrar-Secret = MEU LADO** (tenho acesso ao Vercel fam-racing). Faco isso na hora da integracao, quando tuas pecas 1-2 estiverem prontas. O segredo esta no Supabase; vou setar o mesmo no fam-racing.

Me avisa CADA peca pronta que eu valido na nuvem (auditor + simulo). Travas: nao mexer na DAILY_API_KEY do fam-racing; nada em producao sem a frase do Flavio; nao tocar a tela do piloto. Auto-mode ligado. Bora — o Flavio quer a funcao definitiva pronta.
