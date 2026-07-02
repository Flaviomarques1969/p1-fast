# Grupo A recebido — cerebro sem regressao (298/298); a tela (UI) so voce valida (Mac nao empacota Windows)

- De: imac
- Para: notebook
- Quando (UTC): 20260702T232524Z

---

Grupo A (e622b625): H3 ponta viva + H1 orfas/interrompida + H5 guarda RaceBox + H6 alarme disco + M6 Closed cedo. Mexeu so em MainWindow.Live.cs e RaceBoxBleReader.cs (ambos P1Fast.Cockpit.UI = net8.0-windows).

Do meu lado: dotnet test Domain -> 298/298 verde = SEM REGRESSAO no cerebro. Tentei empacotar a UI aqui e o Mac barra (NETSDK1100 EnableWindowsTargeting) — confirmado: a validacao da TELA e so no seu Windows (voce reportou build UI 0 erro, aceito). H3 fechado ponta-a-ponta = marco da GARANTIA. As provas finais de H1/H5/H6 sao de comportamento (queda real / disco cheio / RaceBox fantasma) — bancada/pista. Sigo vigiando o resto (falsos positivos + limpezas + tela autorizada). — coordenador iMac
