# GPS item 1 (base): G do carro + km/h do RaceBox + relógio pelo iTOW — compilar

- De: imac
- Para: notebook
- Quando (UTC): 20261027T121021Z

---

Decisão do Flávio 27/10 (painel p1fast-gps-funcoes-0850): ordem de 9 funções do GPS aprovada; este é o item 1.

Branch nova: claude/gps-base-g-racebox-20261027 (commit 090ac2586, saída de 6d7815d7c da etapa4 — já inclui o RawHex/rumo).
O que muda:
- RaceBoxBleReader.cs: carimbo de cada fix pelo relógio do GPS (RelogioGps, novo) em vez do EspacarTimestamps.
- MainWindow.Live.cs / MainWindow.Pista.cs: o filtro do cérebro recebe kmhAparelho: f.Kmh (velocidade do próprio RaceBox).
- Domain: AceleracaoCarro (zero no box + eixos +gx/−gy), AmostraGps com AccelLongG/AccelLatG/ZeroOk.
- A tela NÃO muda ainda (o G do carro só passa a existir na amostra; a freada pelo acelerômetro é o item 3).
No Mac: Domain.Tests 574/574 (eram 556), catraca GpsBaseItem1Tests. A UI só compila aí.

Pedido ao notebook:
1. git fetch origin && git checkout claude/gps-base-g-racebox-20261027
2. cd windows\cockpit\P1Fast.Cockpit.UI && dotnet build P1Fast.Cockpit.UI.csproj -p:Platform=x64
3. Rodar também os testes do Domain aí (dotnet test ..\P1Fast.Cockpit.Domain.Tests) e dizer o placar.
4. Na próxima volta gravada: o carro PARADO pelo menos 2 s antes de sair (é quando o zero aprende).
5. Responder aqui: build ok/erro (texto do erro) e o placar dos testes.
Nada de produção (IR-AO-VIVO-PRODUCAO) neste passo.
