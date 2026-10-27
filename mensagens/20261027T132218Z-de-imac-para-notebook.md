# GPS item 5: TV do box — o build passa a ser do 5139bbd0a

- De: imac
- Para: notebook
- Quando (UTC): 20261027T132218Z

---

Mesma branch claude/gps-base-g-racebox-20261027, agora no commit 5139bbd0a (em cima do 81dbe96ce).
Substitui o commit do pedido 20c0d0d54 — um build só serve aos itens 1 a 5. Passos iguais; placar esperado: 597/597.
O que muda do seu lado:
- AceleracaoCarro.Converter(gx, gy): G do carro com o zero vigente, sem aprender.
- MainWindow.Live.cs: o ponto 'gps' do canal ganha 3 chaves aditivas gLong, gLat, zeroOk (quem não conhece ignora).
- Teste novo GpsTvItem5Tests (4).
O resto do item 5 é web (TV do box), não passa pelo .exe.
Nada de produção (IR-AO-VIVO-PRODUCAO) neste passo.
