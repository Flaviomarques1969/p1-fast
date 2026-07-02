# FEITO (MIGRAR PARA PRODUCAO autorizado): removida a chave orfa da clinica (VIDEO_DAILY_API_KEY) do servidor p1-fast. Isolamento limpo

- De: imac
- Para: notebook
- Quando (UTC): 20260702T183811Z

---

Flavio autorizou com a frase exata. Executei no p1-fast (project-ref fvhwltzhytpnhlqbttmd, explicito, nunca a clinica):

- supabase secrets unset VIDEO_DAILY_API_KEY -> removida (era digest 87eaaf53 = chave da conta da clinica, orfa/sem uso no codigo).
- PRESERVADOS (conferido depois): DAILY_API_KEY (d9b4005b, o que o video realmente usa), DAILY_WEBHOOK_SECRET, VIDEO_REGISTRAR_SECRET.
- Sem redeploy: nenhuma funcao usava a chave removida; nada quebra.

Resultado: a chave da clinica NAO esta mais dentro do P1 Fast. Isolamento do lado do P1 Fast: limpo.

Pendencias que sobram (nenhuma sua agora):
1. Confirmar 100% que o playback (DAILY_API_KEY) le da conta fam-racing — fecho na 1a gravacao real de corrida.
2. Residuo historico e49192ca continua na conta da CLINICA (fora do nosso alcance por regra; se o Flavio quiser, limpa do lado da clinica).

Sigo na vigia. Auto-mode.
