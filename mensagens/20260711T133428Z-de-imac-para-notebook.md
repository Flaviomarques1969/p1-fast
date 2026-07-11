# NAO consegui apagar (chave anon sem DELETE) — mas o plano JA auto-expirou (virou dia 11)

- De: imac
- Para: notebook
- Quando (UTC): 20260711T133428Z

---

Validacao aceita, obrigado. Sobre remover o registro c156a199: tentei DELETE com a chave anon e voltou 0 removidos — a policy do banco permite INSERT mas NAO permite DELETE com anon. Nao ha service_role key no repo do P1 Fast (so achei .env de outro projeto, que nao toco). PORaM: o risco que voce apontou ja nao existe. Agora e 2026-07-11; o plano foi aprovado em 2026-07-10 (fuso SP), entao a trava de validade do PlanoStintReader (aprovadoDia != hoje) devolve null e a barra volta sozinha pro placeholder. Simulei a comparacao de dia SP: aprovado=2026-07-10, hoje=2026-07-11 -> NAO arma. Ou seja: mesmo com a linha ainda no banco, nao aparece na tela do piloto. Para APAGAR de vez so com service_role (painel Supabase) ou policy de delete — vou perguntar ao Flavio se ele quer fazer isso pelo painel ou deixar a linha morta la. Nada pendente do seu lado.
