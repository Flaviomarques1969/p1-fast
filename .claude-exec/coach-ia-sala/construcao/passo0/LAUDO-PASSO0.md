# LAUDO — PASSO 0 da Fase 1 (Construtora CÉREBRO) — limites de trecho × freada

> Investigação (leitura/execução determinística, produção intocada) exigida antes de qualquer código da Fase 1 (SOLUCAO-FINAL §7 passo 0; janela-2 §7.2). **Este é o PORTÃO:** o mandato manda parar e acionar o Fable se o achado for defeito de **registro no produto**. Gerado 2026-07-10.

## Pergunta do §7.2
As **linhas ao vivo** que o produto usa (`segments-loader.js` → `track_segments` → migration viva **0029_seed_brasilia_segments_v2.sql**) colocam a **freada DENTRO** do segmento (→ defeito só do **dado de teste**) ou a freada fica **FORA** (→ defeito de **registro no produto**)?

## Método (real, sem tocar produção)
1. Extraí os 8 segmentos REAIS da migration viva 0029 v2 (entrada/ápice/saída GPS).
2. Rodei o **`TrechoDetector` REAL** (`web/cockpit/trecho-detector.js`, o mesmo do produto) sobre o **traço GPS cru contínuo** `volta-real-gps-23-05-rodando.json` (1 Hz, ~5 voltas da sessão 23/05), com km/h derivado das posições (aproximação declarada — a conclusão geométrica não depende da calibração do km/h).
3. Conferi, por curva, se `freada-iniciou` (desaceleração ≥0,5 g, só dispara entre entrada e ápice) cai dentro do segmento; e onde o **Vmin** cai dentro do segmento (0=entrada, 1=saída) + quanto o carro freou ANTES vs DEPOIS da linha de entrada.
4. Prova cruzada: o fixture `passagens-bubi-brasilia.v1.json` usa as MESMAS linhas 0029?

Scripts + saídas reais nesta pasta: `passo0-linhas-vivas.mjs` / `RESULTADO-passo0-detector-linhas-vivas.txt` · `passo0-fixture-vs-0029.mjs` / `RESULTADO-passo0-fixture-vs-0029.txt`.

## Achado 1 — as linhas VIVAS 0029 colocam a freada FORA do segmento nas curvas rápidas
Detector real + linhas vivas 0029 sobre o traço cru:

| Curva | `freada-iniciou` dentro | Vmin (0=entrada) | freou ANTES vs DEPOIS da entrada |
|---|---|---|---|
| CURVA 01 | **0/4** | 0.17 | 26 vs **1** km/h |
| RETA OPOSTA | 3/5 | 0.14 | 39 vs 27 km/h |
| CURVA 2 | 1/5 | **0.00** | 68 vs **0** km/h |
| CURVA DA JUNÇÃO | **0/5** | 0.38 | 2 vs 2 km/h |
| CURVA DA BRUXA | 1/5 | 0.19 | 64 vs 17 km/h |
| CURVA DO PLACAR | **0/3** | (sem passagem completa) | — |
| CURVA "S" | 2/5 | 0.45 | 53 vs 23 km/h |
| CURVA DA VITÓRIA | **0/1** | 0.20 | 12 vs 2 km/h |

Leitura: a janela da 0029 é **apex±30 m (60 m)**. Nas curvas rápidas a freada real começa **muito antes** de 30 m do ápice — quando o carro cruza a linha de entrada já está no ponto lento (Vmin≈0.00 em Curva 2; freou 68 km/h ANTES e 0 DEPOIS). `freada-iniciou` **nunca dispara** em Curva 01, Junção, Placar e Vitória; nas demais dispara **tarde** (15-21 m adentro, já a 56-77 km/h — pega só o rabo da freada). **Não é "a freada está dentro" — está fora, com as linhas do PRODUTO.**

## Achado 2 — o fixture de teste usa uma segmentação DIFERENTE da viva (só reaproveita os IDs)
- Os 8 `segment_id` do fixture **existem** na 0029 (rótulos canônicos). Bboxes se sobrepõem (mesmo registro GPS, sem offset).
- **Mas os PONTOS das passagens não caem nas linhas 0029:** 5/8 passagens nunca chegam a <60 m do ápice 0029 (CURVA 01 min 102 m, BRUXA 73 m, PLACAR 220 m, "S" 106 m, VITÓRIA 69 m); só Reta Oposta (3 m), Junção (7 m) e Curva 2 (11 m) passam perto. E os `tempo_trecho_s` do fixture (8-21 s; Curva 2 = 21 s ≈ 580 m) são **grandes demais** pra janela de 60 m da 0029.
- Conclusão: `passagens-bubi-brasilia.v1.json` foi fatiado por uma **segmentação antiga/diferente** (segmentos longos), só rotulada com os IDs da 0029. Casa com o achado da J5 (§2: ápice-semente diverge 4/8) — **mesma causa-raiz: bases de limites de trecho desencontradas.**

## VEREDITO
**MISTO, com componente de REGISTRO NO PRODUTO → o portão do PASSO 0 ACIONA.**
- (B, produto) As linhas vivas 0029 v2 (janela fixa apex±30 m) são **curtas demais** para conter a freada das curvas rápidas → o `freada-iniciou` do detector é inatribuível nessas curvas **mesmo no produto**, não só no fixture. Corrigir isso = mexer no registro de segmentos (migration/geometria) = **mudança de produto, exige autorização**.
- (A, dado de teste) O fixture ainda usa segmentação antiga e não serve, cru, pra validar atribuição de sub contra as linhas vivas.

## Consequência para o Coach (o sistema NÃO quebra)
O "onde-fino" (freio/entrada/saída) **não é confiável na Fase 1** — nem pelo fixture, nem pelas linhas vivas. O caminho honesto já previsto (J2 §5.4; SOLUCAO-FINAL §10 risco 1) é **`subTrecho:null` (curva inteira)**: o coach ensina a curva inteira ("você perde Xs NESTA curva") e **silencia o "onde"**, sem inventar. A vitrine C1 (Curva "S", ~1,0 s/volta, curva inteira) **funciona nesse caminho**.

## Decisão que ESCALO (não decido — Fable/Flávio)
1. **[Recomendado] Seguir a construção do lado do dado no caminho `subTrecho:null` AGORA** (passos 1-3: `tempoAtualS`, acumulador de stint, pacote de 3 estados). É trabalho de DEV, não depende do conserto de registro, não toca produção e entrega valor real (curva inteira). O "onde-fino" entra depois, sem mudar contrato, quando (2) e/ou captura 25 Hz existirem.
2. **Conserto de registro de segmentos (produto)** — janela de trecho que comece antes da freada nas curvas rápidas (ou por-curva, não fixa em 30 m) + regerar o fixture a partir das linhas vivas. É **tarefa de produto separada, com autorização** — não parte desta sala sem o "vai".

**Enquanto o Fable/Flávio não decidir, o CÉREBRO PARA no passo 0** (mandato: "se o PASSO 0 acusar defeito de registro no PRODUTO, pare e me acione").

## Limitações declaradas
- km/h do traço cru é **derivado das posições** (o iPhone ao vivo dá `CLLocation.speed`, menos ruidoso). A conclusão geométrica (posição do Vmin vs linha de entrada) é robusta a isso; a contagem exata de `freada-iniciou` pode variar com a fonte de velocidade.
- Traço de **uma sessão** (23/05). O `-rodando` é subconjunto do `-23-05`; deram saída idêntica → consistência, não replicação independente.
