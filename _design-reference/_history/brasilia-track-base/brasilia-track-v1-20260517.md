# ARTEFATO BASE — Desenho oficial do circuito de Brasília

Este é o desenho oficial do circuito de Brasília usado em todos os componentes do P1 Fast: aplicativo iOS, monitores de cockpit, Vista Piloto, PAce Advisor, mapa do autódromo. **Mudanças neste desenho afetam o sistema inteiro.** Versão de partida congelada em 2026-05-17.

- **Origem do traço:** volta 5 do Flávio, tempo de volta 171,038 s, calibrada pelo arquivo `src/domain/seed-tracks.js` (versão JavaScript original) e portada para `ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift`.
- **Identificador da pista:** `e8335412-3312-54fe-b634-db2d02c7fa81` (Autódromo Internacional Nelson Piquet — Brasília — anti-horário — 5476 m — 8 curvas).
- **Por que congelar:** antes de aplicar qualquer filtro de suavização ou redesenho a partir de imagem de satélite, o desenho atual fica preservado aqui como referência de reversão.

## Caixa de desenho (viewBox)

```
largura = 823
altura  = 799
```

## Linha de chegada

```
x1 = 415   y1 = 695
x2 = 415   y2 = 720
```

## Âncoras geográficas (GPS → tela)

| latitude   | longitude  | x   | y   |
|------------|------------|-----|-----|
| -15,77000  | -47,90000  | 410 | 707 |
| -15,77180  | -47,89800  | 630 | 400 |

## Parciais (4 setores por tempo igual)

| ID  | Nome       | Apelido            | Início % | Fim % |
|-----|------------|--------------------|----------|-------|
| P1  | Parcial 1  | Saída do box       | 0        | 25    |
| P2  | Parcial 2  | Junção             | 25       | 50    |
| P3  | Parcial 3  | Bruxa              | 50       | 75    |
| P4  | Parcial 4  | Placar → chegada   | 75       | 100   |

## Lista canônica de trechos (8 curvas + 4 retas)

| Ordem | Nome                       | Tipo  | Parcial | x   | y   | Tempo na volta (s) |
|-------|----------------------------|-------|---------|-----|-----|--------------------|
| 0     | CURVA 01                   | curva | P1      | 145 | 645 | 7,6                |
| 1     | RETA PRINCIPAL / BOX       | reta  | P1      | 390 | 630 | 98,0               |
| 2     | MERGULHO DA BRUXA          | curva | P1      | 315 | 305 | 16,5               |
| 3     | CURVA 2                    | curva | P1      | 290 | 85  | 21,1               |
| 4     | CURVA DA JUNÇÃO            | curva | P2      | 600 | 330 | 31,0               |
| 5     | PISCINA                    | reta  | P2      | 460 | 275 | 40,0               |
| 6     | CURVA DA BRUXA             | curva | P3      | 225 | 570 | 51,8               |
| 7     | RETA DO MILITAR            | reta  | P3      | 155 | 335 | 56,0               |
| 8     | CURVA DO PLACAR            | curva | P4      | 335 | 475 | 78,6               |
| 9     | CURVA "S"                  | curva | P4      | 630 | 525 | 89,2               |
| 10    | CURVA DA VITÓRIA           | curva | P4      | 645 | 650 | 93,5               |
| 11    | RETA OPOSTA                | reta  | P4      | 405 | 555 | 75,0               |

## Caminho SVG bruto (path oficial)

```
M 420.20 707.58 L 242.63 705.75 L 223.63 704.27 L 206.67 699.64 L 190.46 690.06 L 177.44 675.92 L 163.53 640.49 L 173.07 615.32 L 177.09 595.50 L 181.56 552.34 L 189.99 507.41 L 195.17 485.19 L 201.93 462.25 L 207.99 438.19 L 229.60 366.52 L 237.64 341.92 L 252.10 290.03 L 260.17 264.58 L 279.72 194.33 L 291.15 161.70 L 294.72 156.29 L 298.66 150.33 L 311.63 145.96 L 326.58 143.68 L 343.19 148.38 L 358.95 155.60 L 374.08 164.69 L 388.56 176.62 L 401.91 190.62 L 426.33 224.01 L 454.76 257.96 L 469.70 274.35 L 488.13 287.86 L 508.65 299.03 L 530.47 307.88 L 553.93 313.11 L 602.62 318.12 L 625.66 321.92 L 645.47 326.63 L 661.43 333.14 L 674.27 342.65 L 683.96 355.44 L 688.29 370.67 L 686.56 387.23 L 679.94 402.31 L 668.35 415.01 L 653.49 424.27 L 635.14 427.77 L 615.99 423.99 L 599.32 414.02 L 563.03 395.14 L 544.62 386.15 L 524.16 377.79 L 502.83 371.66 L 478.87 368.78 L 455.47 367.00 L 432.13 368.11 L 407.30 371.47 L 382.97 378.12 L 335.78 393.87 L 314.58 402.85 L 295.48 415.65 L 279.26 431.18 L 265.73 450.19 L 255.25 471.55 L 248.52 494.81 L 234.11 513.72 L 238.41 537.37 L 234.92 549.83 L 233.49 560.58 L 237.93 572.18 L 246.95 583.62 L 259.77 593.13 L 276.11 598.40 L 327.75 611.39 L 528.57 671.64 L 542.60 672.98 L 556.32 670.11 L 567.69 660.39 L 574.68 647.16 L 575.82 631.31 L 573.66 615.56 L 566.35 600.49 L 554.99 587.43 L 541.29 575.59 L 513.98 548.01 L 498.16 534.88 L 478.96 526.19 L 458.62 521.37 L 436.90 521.82 L 415.24 527.50 L 373.61 546.75 L 354.89 553.63 L 338.93 557.39 L 324.68 557.18 L 311.28 554.18 L 299.36 546.38 L 289.53 535.43 L 285.49 521.07 L 288.02 505.40 L 296.27 490.63 L 309.55 478.98 L 325.18 470.45 L 342.41 464.46 L 379.49 454.28 L 439.98 435.42 L 461.07 430.16 L 483.11 427.44 L 505.75 428.57 L 528.04 434.62 L 549.64 443.47 L 570.90 453.24 L 591.54 464.27 L 624.25 484.01 L 634.38 492.47 L 640.90 503.88 L 640.91 518.80 L 634.34 534.24 L 624.59 547.53 L 617.04 562.63 L 616.26 580.34 L 620.02 598.86 L 627.99 616.73 L 632.73 634.83 L 632.38 653.04 L 626.28 670.72 L 615.99 687.30 L 600.08 701.09 L 580.92 709.60 L 559.69 712.35 L 492.40 708.43 L 420.77 707.60 Z
```

## Onde este desenho é usado

1. **Aplicativo iOS** — `ios/p1fast-ios` (tela do mapa do autódromo, mapa modal, mapa em miniatura dos relatórios, mapa do trecho ampliado).
2. **Vista Piloto do Command Box** — `_design-reference/mockup-command-box-vista-piloto.html`.
3. **PAce Torque Delivery Advisor** — `_design-reference/mockup-command-box-engenharia-pace.html`.
4. **Lambda Track State Advisor** — `_design-reference/mockup-command-box-engenharia-lambda.html`.
5. **Monitores de cockpit (notebook + tela 10,5")** — referência executável em `web/cockpit/`.

## Como reverter para esta versão

Se uma nova suavização ou redesenho não funcionar, restaurar:

1. O `svgPath` no arquivo `ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift` para o caminho acima (linha 33 do arquivo).
2. Conferir que `viewBox`, `linhaChegada`, `geoAncoras` e a lista de trechos continuam idênticos à tabela deste documento.
3. Empacotar de novo o aplicativo e instalar no iPhone.

---

**Origem registrada por Flávio:** versão de partida congelada em 2026-05-17, antes de aplicar o filtro Douglas-Peucker mais agressivo, o ressampleamento de pontos intermediários ou o redesenho a partir de imagem de satélite.
