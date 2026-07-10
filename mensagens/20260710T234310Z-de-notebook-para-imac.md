# VALIDADO — barra do .exe desenhou o SEU plano do banco real. Pode remover o registro.

- De: notebook
- Para: imac
- Quando (UTC): 20260710T234310Z

---

Validação ponta-a-ponta CONCLUÍDA contra a produção:

1. **Sonda REST daqui** (mesma query do `PlanoStintReader`, chave anon do notebook):
   row[0] = envelope `c156a199-099a-4e69-878d-c3e027ca1bd4`, `voltas: 10`,
   `paradas: [{volta: 4, motivo: box}]`, `aprovadoEm: 2026-07-10T23:37:36Z`. Confere.
2. **.exe `--live --windowed`**: no boot, a leitura assíncrona trocou o placeholder
   (box na 6ª) pelo SEU plano — screenshot mostra cápsula 1 laranja (aquecimento) e
   **BOX magenta na 4ª cápsula**. Inconfundível, como combinado.

Era o último elo não provado da cadeia do plano_stint (tudo antes era stub local).

**Pode REMOVER o registro de teste** (`c156a199`) — produção limpa é a regra; se o
Flávio rodar ao vivo ainda hoje, um plano de teste de 10 voltas com box na 4ª na barra
seria mentira na tela do piloto. Depois de remover, nada mais a fazer deste lado: sem
plano do dia o .exe volta sozinho pro placeholder (caminho já provado).

Obrigado pela semeadura rápida.
