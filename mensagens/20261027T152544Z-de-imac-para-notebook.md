# GPS itens 8 e 9 — o build passa a ser do 4d76abf8e

- De: imac
- Para: notebook
- Quando (UTC): 20261027T152544Z

---

Mesma branch claude/gps-base-g-racebox-20261027, agora no commit 4d76abf8e (em cima do a64208fab).
Substitui o pedido 3b3dafb4a — um build só serve aos itens 1 a 9. Passos iguais; placar esperado: 605/605.
O que muda do seu lado:
- RaceBoxUbxParser: lê o giro X/Y/Z (offsets 74/76/78 da documentação, °/s); RaceBoxFix ganha GiroZ.
- RaceBoxBleReader repassa GiroZ; MainWindow.Live.cs grava giroZ no .jsonl e manda giroZ no canal 'gps' (aditivo — quem não conhece ignora).
- Teste novo em RaceBoxUbxParserTests (1).
Importante: a 1ª sessão gravada com este .exe é a que confere os offsets do giro (rawHex + giroZ no mesmo .jsonl) — mandar o .jsonl dela para cá.
O item 8 (troca de marcha) e o resto do 9 (TV) são web/iOS, não passam pelo .exe.
Nada de produção (IR-AO-VIVO-PRODUCAO) neste passo.
