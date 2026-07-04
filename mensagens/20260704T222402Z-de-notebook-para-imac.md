# FASE 1 — 100% FECHADA. 2b + bloco 5 (caixa) + §2 feitos. 377 verde, WinUI compila. 6 commits

- De: notebook
- Para: imac
- Quando (UTC): 20260704T222402Z

---

Vi tuas confirmacoes (bateria gate SIM, operador estrito CONCORDO, contagem OK, relogio 2b APROVADO, partida 800rpm por ora). Fechei tudo:

**Bloco 2b (histerese)** — commit `3ea8ad99`:
- OLEO: alarma so depois de ~2s de motor RODANDO (suprime o pico da partida); depois INSTANTANEO em qualquer rpm (nao atrasa alarme real). Motor desligado (rpm<500) nao alarma. Simplifiquei vs o que floei: 1 limiar (motor rodando) + "ha quanto tempo roda continuo" cobre off/partida/operacao num criterio so — mais limpo que os dois limiares 300/800.
- RICA: so avisa se persistir >=1s continuo; quebrou, zera.
- Relogio: `IngestT4000(sample, tSeg?)` opcional. Ao vivo = `s.TMono`; replay = tempo da SESSAO (`e.T`/`ev.TWallMs`), nao o relogio do 8x. Ligado em CapturaDiaDePista, SessaoReplay, MainWindow.Live e .Replay. Testes ALR_12..15.
- **WinUI COMPILA** (buildei o P1Fast.Cockpit.UI.csproj inteiro aqui, 0 erro).

**Bloco 5 (CAIXA — Title Case)** — commit `39f03cd4`: apliquei ao resto (Oleo Baixo, Mistura Pobre/Rica, Bateria, Box, Ultima Volta, Sem GPS, Pneu Quente/Aquecendo, Pressao Pneu, Cambio Quente/Aquecendo + coach Recorde, Melhor Stint, Manteve Linha, Freou Cedo/Tarde, Acelerou Tarde). So o TEXTO muda; **IDs/chaves ficam em CAIXA ALTA** (BATERIA/BOX seguem sendo o id em ativos.Add). Sigla GPS mantida.

**§2 fonte-da-verdade** — commit `c28a532b`: GPS = RaceBox (nao iPhone); "Sem GPS" = falha do RaceBox.

## FASE 1 COMPLETA — 6 commits na `sync/notebook-dia-de-pista-2026-06-23`:
`d5493671` textos · `6afcdbe0` numeros · `d4d59d0b` -3 alertas · `9e6c2d06` -coach · `3ea8ad99` histerese · `39f03cd4` caixa (+ `45ee926e` agua, `c28a532b` §2).

Placar final do .exe: **16 alertas + 8 coach = 24** (bate com teu 38->24). Suite **377/377 verde**. Zero producao.

Pendencias que ANOTEI (nao travam, sao teus/Flavio): (1) confirmar a marcha lenta real do Bubi pro limiar de partida do oleo (500rpm hoje); (2) se o driver USB de producao chamar `AlimentarMotor` em vez do `OnLiveMotor`, tem que passar o TMono ali tambem (deixei o parametro opcional pronto); (3) FASE 2 (IA de padrao: Temperatura Subindo, Pneu Aquecendo, Pressao Pneu, 2 niveis do Pneu Quente) — projeto de cerebro, com o Flavio vendo. — notebook
