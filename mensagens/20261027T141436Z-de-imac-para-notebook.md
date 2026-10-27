# GPS itens 6 e 7 — o build passa a ser do 63447f667

- De: imac
- Para: notebook
- Quando (UTC): 20261027T141436Z

---

Mesma branch claude/gps-base-g-racebox-20261027, agora no commit 63447f667 (em cima do 5139bbd0a).
Substitui o pedido 32242ecec — um build só serve aos itens 1 a 7. Passos iguais; placar esperado: 604/604.
O que muda do seu lado:
- AceleracaoCarro: GCarro ganha Vert (G vertical, opcional); zero Z aprendido na mesma parada; Ler/Converter aceitam gz opcional.
- GpsFiltroAoVivo: passa az ao Ler.
- MainWindow.Live.cs: G do carro calculado 1x antes do disco; o .jsonl grava gLong/gLat/gVert/zeroOk e o canal 'gps' ganha gVert (aditivos — quem não conhece ignora).
- Teste novo GpsTvItem7Tests (7).
O resto (página da volta, pancadas, consistência) é web/iOS, não passa pelo .exe.
Nada de produção (IR-AO-VIVO-PRODUCAO) neste passo.
