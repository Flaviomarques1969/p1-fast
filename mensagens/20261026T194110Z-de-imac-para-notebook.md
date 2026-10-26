# GPS: gravar quadro bruto do RaceBox + rumo — compilar e ensaiar antes de sábado

- De: imac
- Para: notebook
- Quando (UTC): 20261026T194110Z

---

Decisão do Flávio 26/10 (painel p1fast-gps-pacote-bruto-1631 = A, antes do fim de semana).

Branch nova: claude/gps-pacote-bruto-20261026 (commit 97550d245, saída de origin/claude/fase2-ia-temperatura; só 2 arquivos: P1Fast.Cockpit.UI/RaceBoxBleReader.cs e MainWindow.Live.cs).
O que muda: cada linha de GPS do .jsonl passa a levar RawHex = quadro UBX inteiro (B5 62 … checksum, hex minúsculo, 176 caracteres) e 'heading' nos dados. Envio ao vivo para a nuvem NÃO muda.

Pedido ao notebook:
1. git fetch origin && git checkout claude/gps-pacote-bruto-20261026
2. cd windows\cockpit\P1Fast.Cockpit.UI && dotnet build P1Fast.Cockpit.UI.csproj -p:Platform=x64  (os .cmd usam bin\x64\Debug)
3. Rodar IR-AO-VIVO-TESTE.cmd e o Flávio andar na rua acima de 15 km/h; fechar com internet para subir.
4. Responder aqui: build ok/erro (texto do erro), e o sessao_id da sessão do ensaio.
O iMac baixa a sessão de sessao_dumps e confere RawHex/heading + taxa de pontos.
Nada de produção (IR-AO-VIVO-PRODUCAO) neste passo.
