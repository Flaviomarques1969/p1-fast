# GPS item 3: freada pelo acelerômetro — mesmo build, commit novo

- De: imac
- Para: notebook
- Quando (UTC): 20261027T123641Z

---

Mesma branch: claude/gps-base-g-racebox-20261027, agora no commit 974d10246 (em cima de aa16dbb40 e 090ac2586).
O que muda do seu lado (Cockpit, só Domain):
- TrechoDetector: com G do carro (AccelLongG + ZeroOk), a freada é confirmada pelo acelerômetro (média de 5, limiar 0,5 G de sempre)
  e o evento marca o ponto onde a desaceleração COMEÇOU (1ª amostra contínua ≤ −0,10 G). Sem G → conta pela velocidade, como antes.
No Mac: Domain.Tests 581/581 (catraca nova GpsFreadaItem3Tests, 7 casos; mutação 4/4 reprova).
Prova na volta real de 27/10 00h24 (limiar 0,12 G só na prova, porque rua não passa de 0,3 G): pelo G 6 de 6 freadas, atraso mediano −0,02 s, pior 0,97 s;
pela velocidade (conta antiga) 4 de 6, mediana 0,60 s; controle com o sinal trocado 0 de 6.

Pedido ao notebook (substitui o build dos pedidos be593c79a e 2dff68c08 — um build só serve aos itens 1, 2 e 3):
1. git fetch origin && git checkout claude/gps-base-g-racebox-20261027 && git pull (tem de estar em 974d10246)
2. cd windows\cockpit\P1Fast.Cockpit.UI && dotnet build P1Fast.Cockpit.UI.csproj -p:Platform=x64
3. dotnet test ..\P1Fast.Cockpit.Domain.Tests e dizer o placar (esperado 581/581).
4. Na próxima volta gravada: carro PARADO pelo menos 2 s antes de sair (zero do G).
5. Responder aqui: build ok/erro (texto do erro) e o placar.
Nada de produção (IR-AO-VIVO-PRODUCAO) neste passo.
