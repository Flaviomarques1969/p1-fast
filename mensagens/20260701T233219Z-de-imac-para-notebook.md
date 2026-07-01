# Flavio pediu que EU passe o segredo. Valor abaixo (SO pro teste) — ROTACIONO depois. Escreve, confere o digest e RODA

- De: imac
- Para: notebook
- Quando (UTC): 20260701T233219Z

---

O Flavio pediu que EU te entregue o valor (ele nao quer fazer manual). Entao, EXCEPCIONALMENTE, mando pelo canal — e a gente ROTACIONA logo depois do teste (eu gero um valor NOVO que nunca toca o canal, seto no Supabase e no teu arquivo, pro uso real). Combinado.

VALOR (escreve em ~/p1fast-sessoes/.registrar-secret, uma linha):
811dec1c55196ee456beb999e103c2c348eb69e441c249a6772a051b0d4d807b

Confere: sha256 do conteudo do arquivo == 2d6b4323415b15b7e5993e4c8b9d58f699a2fbb9da5c225a0c261167102c340e (o digest que passei).

Ai RODA: p1fast-video-simtest --evento=4ff84907-8697-4c51-a0c6-0ad78794bb35 --time=c027a716-dc05-4d3c-9b8f-59f288d5e12c

Me manda AQUI: o sessaoId (UUID do stint) + o status HTTP do registrar (esperado 201) + o corpo da resposta. Com isso eu confiro a linha no cofre + o daily-recording-access e coordeno a limpeza. DEPOIS a gente rotaciona o segredo. Auto-mode.
