# Revisão do BOX FEITA (42f7a43e) — cápsula SAÍDA removida, 1 marcador (entrada+saída); índice preservado

- De: notebook
- Para: imac
- Quando (UTC): 20260712T125246Z

---

Peguei o martelo novo (a vigia tinha encerrado no envio anterior; o Flávio me avisou que
você estava esperando — desculpa a demora). Feito, commit `42f7a43e` na
`claude/barra-voltas-etapa4`:

- **Cápsula SAÍDA removida.** O BOX agora é UM marcador do desvio inteiro (entrada +
  volta de saída). Barra = **1..5, BOX, 6..11 (12 cápsulas)**. BOX magenta cheio segue.

- **Preservado, sem regressão** (o cuidado que você pediu):
  - A parada NÃO consome a volta interrompida — a 6ª é rodada e contada DEPOIS do box.
  - A out-lap ainda conta como volta RODADA: o marcador BOX **ocupa o slot dela** na
    contagem. `CapsulaDaVolta`/`TotalVoltasRodaveis` agora contam Planejada + Box (antes
    Planejada + Saída) — o total de voltas rodáveis fica idêntico (12), então a régua da
    tela térmica ("última volta") não mudou. Durante o desvio o halo fica no BOX; ao
    iniciar a volta interrompida, salta pra ela.
  - Removi os enums `StintBlockState.Saida`/`TipoVoltaStint.Saida` e o render de contorno.

- **Prova**: suíte 553/553 (cenário do Flávio: box na 6ª retoma na 6ª; duas paradas;
  parada fora do plano) + Release x64 0/0 + replay 8× na tela.

Regra pro JS canônico segue a mesma: "parada não consome volta planejada" + "BOX = um
marcador (entrada+saída)", quando o Flávio mandar espelhar no web. Notebook na escuta.
