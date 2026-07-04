# BLOCOS 3 e 4 FEITOS (d4d59d0b, 9e6c2d06). FASE 1 = 4/5 blocos verdes+empurrados. So falta o 2b — proponho o desenho e 1 decisao de relogio

- De: notebook
- Para: imac
- Quando (UTC): 20260704T220322Z

---

**Bloco 3** (remocoes de alerta, A4) — commit `d4d59d0b`:
- Catalogo **19 -> 16**. Removi os que EXISTIAM no .exe: Combustivel Baixo (os 2) + Motor Esfriando (virou a chuva azul, ja existe). Tirei de: Todos, Automaticos, logica de combustivel no AvaliarT4000, estagio. Bits do T4000 seguem lidos (plumbing), so nao levantam alerta.
- **Achado honesto:** os outros 6 da spec A4 (Oleo Quente, Escape Quente, Detonacao, Roda Travou, Freio Quente, Pista Suja) **nunca foram portados** pro .exe — nao havia o que remover. A tua "de 38->24" e sobre o catalogo WEB de 38; o .exe ja vinha enxuto (19).

**Bloco 4** (remocoes de coach, B2) — commit `9e6c2d06`:
- Coach **13 -> 8 frases**. Removi BUSCAR LIMITE (delta~zero agora retorna null) + as 4 VIROU. Ramo "apice" em Decidir = null; apaguei ClassificarApice. **A BOLINHA do apice (visual, gap 5) FICA** — so a frase de volante saiu. ContextoApice segue na assinatura (orquestrador/replay ainda passam o angulo).

Tudo **373 verde**, SessaoReplay compila. Empurrado na `sync/notebook-dia-de-pista-2026-06-23`.

---

## SO FALTA O 2b (histerese) — proponho o desenho + 1 decisao tua

O `AvaliarT4000` e **puro por amostra**, e o `IngestMotor(rpm, alerta)` **nao carrega timestamp**. Pra "OLEO suprime ~2s de partida" e "RICA persiste >=1.0s" eu preciso de um **relogio monotonico** no ingest do motor. Desenho proposto:

1. **Estado vive na classe `AlertasCriticos`** (ela ja e stateful — guarda _ativos/_manuais). Passo o tempo via `IngestT4000(alerta, double tSeg)`.
2. **Relogio:** o replay ja tem `e.T`; o `CapturaDiaDePista` tem o sample. So o **ao vivo** (`MainWindow.Live.cs`) nao passa tempo — ali eu leio um Stopwatch (segundos desde o start). Faco `tSeg` **parametro opcional** (default) pra nao quebrar os call-sites de teste; os caminhos reais passam o relogio de verdade.
3. **OLEO (salvaguarda de partida):** detecto a PARTIDA = rpm cruza de ~0 pra rodando; suprimo OLEO_BAIXO por ~2s a partir dai. Fora dessa janela = **instantaneo** (nao atrasa alarme real, como voce frisou).
4. **RICA (persistencia):** so emito MISTURA_RICA se a condicao (lambda<0.74 + carga giro>3000 E tps>40) segurar **>=1.0s continuos**; se quebrar, zera o cronometro.

**Decisao que preciso de voce (ou do Flavio):** confirma o desenho do relogio (parametro opcional `tSeg` + Stopwatch no ao vivo)? E pra OLEO, o gatilho da janela de partida = "rpm subindo do zero" — defino PARTIDA como rpm passando de `<300` pra `>=800` (uma vez), janela de 2s. Serve, ou o Flavio tem um numero de rpm de partida do Bubi?

Assim que confirmar, fecho o 2b e a FASE 1 inteira. — notebook
