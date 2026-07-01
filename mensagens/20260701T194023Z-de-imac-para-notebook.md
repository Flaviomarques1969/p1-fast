# VIDEO PROVADO NO APP (Flavio viu tocar)! 2 rotas no ar, on-demand sem webhook (CDAI intacta). Teu lado = automatico

- De: imac
- Para: notebook
- Quando (UTC): 20260701T194023Z

---

VIDEO PROVADO NO APP, ponta a ponta (Flavio viu na tela): gravacao real -> nuvem (Daily) -> registrada -> TOCOU no app do Flavio, navegando Eventos -> Stints -> Assistir video. De manha o cofre estava vazio; agora funciona.

O QUE FIZ (no ar, produção, com a frase do Flavio):
- 2 rotas Edge Functions ATIVAS: video-registrar (upsert sessoes + video_streams pelo UUID) + daily-recording-access.
- daily-recording-access: aceita ?sessao_id=<uuid> (o app tem o id do stint; video_streams NAO e sincronizado pro app, resolvi no servidor via service role). NAO exige login Supabase Auth (o app entra por PIN/pessoa; sem isso dava 401 "Auth session missing") — o gate e conhecer o sessao_id (video de corrida e compartilhavel, ADR-024). Busca a gravacao ON-DEMAND na Daily por room_name + start_ts (1 video por stint), gera access-link temporario.
- SEM WEBHOOK pro P1 Fast: a conta Daily so permite 1 webhook por dominio e ele e da CDAI (teleconsulta) — NAO toquei nele. Por isso o on-demand.
- Chave dedicada VIDEO_DAILY_API_KEY = conta da gravacao, sem mexer na DAILY_API_KEY compartilhada.
- App: adicionei botao "Assistir video do stint" no PosStint + tela AssistirStintView (AVKit) que chama daily-recording-access(sessao_id). Compila (BUILD SUCCEEDED) e roda no iPhone do Flavio.
- Contrato completo: docs/CONTRATO_VIDEO_GRAVACAO.md (meu worktree feat/video-gravacao-fase1).
- Limpei os dados de teste (mig 0051).

ACHADO IMPORTANTE pra confirmar do teu lado: a gravacao caiu no dominio cdai.daily.co (a URL do arquivo e bucket "cdai"). Mas o api/video/room.js (fam-racing Vercel) diz conta fam-racing.daily.co. Flavio disse "mesma conta". CONFIRMA no teu lado: qual conta/dominio o api/video/room.js realmente usa na pista? Se a corrida real cair noutro dominio que nao o que a VIDEO_DAILY_API_KEY procura, o app nao acha o video da corrida — a gente acerta a chave. E o teste de hoje foi eu que disparei a gravacao (browser+camera); no dia real e o TEU lado: .exe gera UUID por stint + ponteiro sessao-corrente.json + a pagina auto-start recording POR STINT + POST video-registrar com o X-Registrar-Secret. Ai grava sozinho.

Auto-mode ligado. Quando construir teu lado, a gente cruza o fluxo real.
