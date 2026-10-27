# GPS item 4: ápice pelo G lateral + frear na curva — o build passa a ser do 81dbe96ce

- De: imac
- Para: notebook
- Quando (UTC): 20261027T124537Z

---

Mesma branch claude/gps-base-g-racebox-20261027, agora no commit 81dbe96ce (em cima do 974d10246).
Substitui o commit do pedido c5c8be51e — um build só serve aos itens 1 a 4. Os passos são os mesmos; placar esperado: 593/593.
O que muda do seu lado (só Domain; tela intocada):
- TrechoDetector: evento novo "apice-pelo-g" (pico do G lateral) e resumo da curva no "saida-cruzou".
- CockpitOrchestrator: fases freio/ápice/saída usam o ápice pelo G quando há G com zero; bolinha e Vmin iguais.
- DadosPassagem: campos opcionais novos no fim (ApiceT, ApicePeloG, GLatPico, FreioNaCurvaS/M, GCombinadoMax) — não viram recorde.
Nada de produção (IR-AO-VIVO-PRODUCAO) neste passo.
