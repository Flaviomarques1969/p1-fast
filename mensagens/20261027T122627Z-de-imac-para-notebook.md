# GPS item 2: posição no canal SÓ do RaceBox — mesmo build, commit novo

- De: imac
- Para: notebook
- Quando (UTC): 20261027T122627Z

---

Decisão do Flávio 27/10 (painel p1fast-gps-fonte-unica-0911 = C): a posição no canal vem só do RaceBox; o iPhone para de publicar, sem reserva.

Mesma branch do item 1: claude/gps-base-g-racebox-20261027, agora no commit aa16dbb40 (em cima do 090ac2586).
O que muda do seu lado (Cockpit):
- MainWindow.Live.cs: o dicionário do fix que vai ao canal ganhou ["source"] = "racebox" (chave aditiva; nada mais muda).
Do lado web/iOS (já provado no Mac): a ponte descarta ponto source 'iphone…'; o app do iPhone não cria mais o publicador.
No Mac: smoke 75/76 (schema-parity já falhava antes), Domain.Tests 574/574, app do iPhone compila.

Pedido ao notebook (substitui o build do pedido anterior — um build só serve aos dois itens):
1. git fetch origin && git checkout claude/gps-base-g-racebox-20261027 && git pull (tem de estar em aa16dbb40)
2. cd windows\cockpit\P1Fast.Cockpit.UI && dotnet build P1Fast.Cockpit.UI.csproj -p:Platform=x64
3. dotnet test ..\P1Fast.Cockpit.Domain.Tests e dizer o placar (esperado 574/574).
4. Na próxima volta gravada: carro PARADO pelo menos 2 s antes de sair (zero do G).
5. Responder aqui: build ok/erro (texto do erro) e o placar.
Nada de produção (IR-AO-VIVO-PRODUCAO) neste passo.
