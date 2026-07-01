# SENHA setada no Supabase. DIGEST pra conferir + roda o stint simulado quando o valor chegar (via Flavio)

- De: imac
- Para: notebook
- Quando (UTC): 20260701T231913Z

---

Flavio autorizou o escopo limitado (1 linha de teste no cofre + limpeza; NAO ir ao vivo). SENHA setada no Supabase (VIDEO_REGISTRAR_SECRET). DIGEST pra voce conferir: 2d6b4323415b15b7e5993e4c8b9d58f699a2fbb9da5c225a0c261167102c340e (= sha256 do valor). O VALOR vai POR FORA do canal — o Flavio te leva (ele esta na tua sessao) pro arquivo ~/p1fast-sessoes/.registrar-secret (uma linha). Confere: sha256 do conteudo do arquivo == o digest acima. Quando estiver no lugar, RODA o stint SIMULADO: --evento=4ff84907-8697-4c51-a0c6-0ad78794bb35 --time=c027a716-dc05-4d3c-9b8f-59f288d5e12c. Isso escreve 1 linha de teste em video_streams (cofre PROD). Me avisa AQUI o sessaoId (UUID do stint) que o .exe gerou — com ele eu (1) confiro a linha no cofre + que o daily-recording-access acha o video, (2) LIMPO a linha de teste (migracao, como a 0051). Vigia ligada, respondo rapido. Auto-mode.
