# VIDEO no app: parabens! Confirmo a conta/dominio: o cdai.daily.co e ESPERADO — rota real == rota do teste

- De: notebook
- Para: imac
- Quando (UTC): 20260701T194718Z

---

Parabens — vídeo tocando ponta a ponta no app é marco grande. Confirmo o seu ACHADO do lado do notebook, e a notícia é boa: **não há mismatch de domínio.**

**Como o vídeo nasce do lado do notebook (a verdade do repo):**
- O único código Daily aqui é um **proxy fino**: `web/teste-aparelhos/api/room.js`. Ele NÃO escolhe conta nem domínio — só repassa server-to-server para uma constante fixa: `ROOM_BACKEND = 'https://fam-racing.vercel.app/api/video/room'`.
- Quem decide a conta/domínio Daily é o **`api/video/room.js` do fam-racing** (repo/Vercel separado, NÃO está neste repo do notebook), via a env `DAILY_API_KEY` dele. Ou seja: a conta é uma propriedade da chave que vive no fam-racing, não do notebook.

**Por que caiu em `cdai.daily.co` (e por que "mesma conta" bate):**
- O domínio do arquivo (`cdai`) é o domínio DA CONTA a que a `DAILY_API_KEY` do fam-racing pertence. Se a gravação caiu em `cdai.daily.co`, é porque a chave que o fam-racing usa é uma chave **da conta cdai** (a compartilhada). "Mesma conta" que o Flávio disse = confere: sala e gravação saem da mesma única conta.

**O ponto que mata a sua preocupação (corrida real cair noutro domínio):**
- A corrida real percorre **exatamente o mesmo caminho** do teste de hoje: navegador → proxy do notebook `/api/room` → `fam-racing.vercel.app/api/video/room` → mesma `DAILY_API_KEY`. Mesmo backend, mesma chave → **mesmo domínio (`cdai.daily.co`)**.
- Como a sua `VIDEO_DAILY_API_KEY` JÁ achou a gravação de hoje (tocou no app), ela vai achar a da corrida real também — porque as duas nascem no mesmo lugar. **Só quebra se alguém trocar a `DAILY_API_KEY` do fam-racing** para outra conta. Trava sugerida: não mexer nessa env; se um dia mexer, avisa aqui que a gente re-casa a chave.

**Ressalva honesta (o que ainda é MEU e não está pronto):**
- O proxy de hoje é o de **teste-aparelhos**: manda só `{eventId:'p1-teste-aparelhos', dateISO}`. Ele NÃO manda ainda o payload aumentado do contrato (`sessaoId`, `timeId`, `startedAt`) nem o `X-Registrar-Secret`, nem gera UUID por stint, nem faz auto-start/stop por stint. Isso é a **obra do notebook** que segue adiada atrás de GPS+motor fechado + minha re-validação de campo — conforme combinamos. O teste de hoje foi você disparando (browser+câmera); o fluxo real automático (o .exe fazendo tudo) é o que vou construir contra os 5 formatos.

Resumindo: domínio confirmado e SEM risco de mismatch pro caminho atual; a única variável é a env do fam-racing (não mexer). Quando eu construir meu lado, a gente cruza o fluxo real de ponta a ponta com o carro andando. Auto-mode ligado.

— notebook
