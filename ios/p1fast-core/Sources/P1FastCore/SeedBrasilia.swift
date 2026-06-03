// ═══════════════════════════════════════════════════════════
// SeedBrasilia — port das constantes hardcoded do JS
// ═══════════════════════════════════════════════════════════
// Port direto de src/domain/seed-tracks.js (variáveis BRASILIA_*).
// Mesmo path SVG calibrado (volta 5 do Flavio, 171.038s, viewBox 823×799).
// Mesmas 8 curvas + 4 retas + 4 parciais com apex DEFAULT.
//
// Pista de referência principal: única hoje no P1 Fast.

import Foundation

public enum SeedBrasilia {
    public static let lapTimeSec: Double = 171.038

    public static let viewBox = ViewBox(w: 823, h: 799)

    public static let linhaChegada = LinhaChegada(x1: 415, y1: 695, x2: 415, y2: 720)

    public static let geoAncoras: [GeoAncora] = [
        GeoAncora(lat: -15.77000, lng: -47.90000, x: 410, y: 707),
        GeoAncora(lat: -15.77180, lng: -47.89800, x: 630, y: 400),
    ]

    /// 4 parciais por tempo igual (0/25/50/75/100 %), apelidos descritivos.
    public static let parciais: [Parcial] = [
        Parcial(id: "P1", nome: "Parcial 1", apelido: "Saída do box",       tStart: 0,  tEnd: 25),
        Parcial(id: "P2", nome: "Parcial 2", apelido: "Junção",             tStart: 25, tEnd: 50),
        Parcial(id: "P3", nome: "Parcial 3", apelido: "Bruxa",              tStart: 50, tEnd: 75),
        Parcial(id: "P4", nome: "Parcial 4", apelido: "Placar → chegada",  tStart: 75, tEnd: 100),
    ]

    /// Path SVG v2 — correções manuais do Flávio em 2026-05-17 (495 pontos
    /// arrumados na página de edição). Suavização v3 foi REVERTIDA porque
    /// estava criando degraus em vez de melhorar. Voltamos pra versão exata
    /// que o Flávio aprovou.
    public static let svgPath = "M 420.20 707.58 L 412.48 707.50 L 404.76 707.42 L 397.04 707.34 L 389.32 707.26 L 381.60 707.18 L 373.88 707.10 L 366.16 707.02 L 358.44 706.94 L 350.72 706.86 L 343.00 706.78 L 335.28 706.70 L 327.55 706.63 L 319.83 706.55 L 312.11 706.47 L 304.39 706.39 L 296.67 706.31 L 288.95 706.23 L 281.23 706.15 L 273.51 706.07 L 265.79 705.99 L 258.07 705.91 L 250.35 705.83 L 242.63 705.75 L 236.30 705.26 L 230.26 704.61 L 224.07 703.88 L 217.98 702.73 L 212.32 701.18 L 206.79 699.22 L 201.27 696.45 L 195.86 693.25 L 190.70 689.52 L 186.12 685.35 L 181.78 680.63 L 178.17 675.31 L 174.66 668.83 L 171.88 661.75 L 169.09 654.66 L 167.66 647.36 L 167.04 640.29 L 167.56 634.15 L 168.79 627.53 L 169.94 620.44 L 171.24 612.76 L 172.76 605.51 L 173.56 599.11 L 174.98 592.82 L 175.81 586.36 L 176.80 579.73 L 178.03 572.95 L 179.42 566.07 L 180.44 559.16 L 181.56 552.34 L 182.97 544.85 L 184.37 537.36 L 185.78 529.88 L 187.18 522.39 L 188.59 514.90 L 189.99 507.41 L 191.72 500.00 L 193.44 492.60 L 195.17 485.19 L 197.42 477.54 L 199.68 469.90 L 201.93 462.25 L 203.44 456.24 L 204.96 450.22 L 206.48 444.20 L 207.99 438.19 L 210.15 431.02 L 212.31 423.86 L 214.47 416.69 L 216.63 409.52 L 218.80 402.36 L 220.96 395.19 L 223.12 388.02 L 225.28 380.85 L 227.44 373.69 L 229.60 366.52 L 231.61 360.37 L 233.62 354.22 L 235.63 348.07 L 237.64 341.92 L 239.71 334.51 L 241.77 327.09 L 243.84 319.68 L 245.90 312.27 L 247.97 304.86 L 250.03 297.44 L 252.10 290.03 L 254.12 283.67 L 256.13 277.30 L 258.15 270.94 L 260.17 264.58 L 262.13 257.56 L 264.08 250.53 L 266.04 243.50 L 267.99 236.48 L 269.95 229.45 L 271.90 222.43 L 273.86 215.41 L 275.81 208.38 L 277.77 201.36 L 279.72 194.33 L 282.01 187.80 L 284.29 181.28 L 286.58 174.75 L 288.86 168.23 L 291.15 161.70 L 294.72 156.29 L 299.47 151.49 L 305.14 148.15 L 311.63 145.96 L 319.42 143.70 L 326.62 143.72 L 332.25 144.93 L 337.65 146.81 L 343.35 148.56 L 348.44 150.79 L 353.70 153.19 L 358.95 155.60 L 363.99 158.63 L 369.04 161.66 L 374.08 164.69 L 378.91 168.67 L 383.73 172.64 L 388.56 176.62 L 393.01 181.29 L 397.46 185.95 L 401.91 190.62 L 405.98 196.19 L 410.05 201.75 L 414.12 207.31 L 418.19 212.88 L 422.26 218.44 L 426.33 224.01 L 431.07 229.67 L 435.81 235.33 L 440.54 240.98 L 445.28 246.64 L 450.02 252.30 L 454.76 257.96 L 459.74 263.42 L 464.72 268.89 L 469.70 274.35 L 475.84 278.85 L 481.99 283.36 L 488.13 287.86 L 494.97 291.58 L 501.81 295.31 L 508.65 299.03 L 515.92 301.98 L 523.20 304.93 L 530.47 307.88 L 536.34 309.19 L 542.20 310.50 L 548.06 311.80 L 553.93 313.11 L 560.89 313.83 L 567.84 314.54 L 574.80 315.26 L 581.75 315.97 L 588.71 316.69 L 595.66 317.40 L 602.62 318.12 L 610.30 319.39 L 617.98 320.65 L 625.66 321.92 L 632.26 323.49 L 638.87 325.06 L 645.47 326.63 L 650.79 328.80 L 656.11 330.97 L 662.30 334.01 L 668.45 338.08 L 674.27 342.65 L 677.50 346.91 L 680.73 351.18 L 684.00 356.65 L 686.13 363.06 L 687.78 369.79 L 687.71 376.19 L 687.14 381.71 L 686.56 387.23 L 684.35 392.26 L 682.15 397.28 L 679.94 402.31 L 676.08 406.54 L 672.21 410.78 L 667.86 414.69 L 663.40 418.10 L 658.44 421.18 L 653.31 423.67 L 647.37 425.44 L 641.26 426.60 L 635.14 426.89 L 628.76 426.51 L 622.37 425.25 L 615.97 423.22 L 610.43 420.67 L 604.88 417.34 L 599.32 414.02 L 593.27 410.87 L 587.22 407.73 L 581.17 404.58 L 575.13 401.43 L 569.08 398.29 L 563.03 395.14 L 556.89 392.14 L 550.76 389.15 L 544.62 386.15 L 537.80 383.36 L 530.98 380.58 L 524.16 377.79 L 517.05 375.75 L 509.94 373.70 L 502.83 371.66 L 496.84 370.94 L 490.85 370.22 L 484.86 369.50 L 478.87 368.78 L 471.07 368.19 L 463.27 367.59 L 455.47 367.00 L 447.69 367.37 L 439.91 367.74 L 432.13 368.11 L 425.92 368.95 L 419.72 369.79 L 413.51 370.63 L 407.30 371.47 L 401.22 373.13 L 395.13 374.80 L 389.05 376.46 L 382.97 378.12 L 376.23 380.37 L 369.49 382.62 L 362.75 384.87 L 356.00 387.12 L 349.26 389.37 L 342.52 391.62 L 335.78 393.87 L 328.71 396.86 L 321.65 399.86 L 314.58 402.85 L 308.21 407.12 L 301.85 411.38 L 295.48 415.65 L 290.07 420.83 L 284.67 426.00 L 279.26 431.18 L 274.75 437.52 L 270.24 443.85 L 265.73 450.19 L 261.34 456.17 L 257.28 462.73 L 253.95 468.32 L 251.39 472.82 L 248.99 477.89 L 246.48 483.49 L 243.58 490.08 L 240.43 497.94 L 238.15 504.71 L 235.84 511.17 L 234.14 518.24 L 233.32 523.73 L 232.56 529.68 L 232.61 536.25 L 233.03 542.43 L 232.91 548.53 L 232.98 554.72 L 233.49 560.58 L 235.71 566.38 L 237.93 572.18 L 242.44 577.90 L 246.95 583.62 L 253.36 588.38 L 259.77 593.13 L 265.22 594.89 L 270.66 596.64 L 276.11 598.40 L 283.49 600.26 L 290.86 602.11 L 298.24 603.97 L 305.62 605.82 L 313.00 607.68 L 320.37 609.53 L 327.75 611.39 L 335.19 613.62 L 342.63 615.85 L 350.06 618.08 L 357.50 620.32 L 364.94 622.55 L 372.38 624.78 L 379.81 627.01 L 387.25 629.24 L 394.69 631.47 L 402.13 633.70 L 409.57 635.94 L 417.00 638.17 L 424.44 640.40 L 431.88 642.63 L 439.32 644.86 L 446.75 647.09 L 454.19 649.33 L 461.63 651.56 L 469.07 653.79 L 476.51 656.02 L 483.94 658.25 L 491.38 660.48 L 498.82 662.71 L 506.26 664.95 L 513.69 667.18 L 521.13 669.41 L 528.32 671.26 L 535.59 672.31 L 542.50 672.56 L 549.40 671.22 L 556.38 668.66 L 561.88 664.88 L 567.19 659.61 L 571.18 653.77 L 574.07 646.60 L 575.25 639.23 L 575.82 631.31 L 574.74 623.43 L 573.29 616.35 L 571.22 610.54 L 568.79 605.51 L 566.03 600.81 L 562.56 596.14 L 558.78 591.78 L 554.99 587.43 L 550.42 583.48 L 545.86 579.54 L 541.29 575.59 L 535.83 570.07 L 530.37 564.56 L 524.90 559.04 L 519.44 553.53 L 513.98 548.01 L 508.71 543.63 L 503.43 539.26 L 498.03 535.33 L 491.76 531.98 L 485.36 529.09 L 478.91 526.80 L 472.18 524.58 L 465.40 522.98 L 458.65 521.92 L 451.38 521.52 L 444.01 521.46 L 436.98 522.16 L 429.68 523.71 L 422.46 525.61 L 415.50 527.84 L 408.30 530.71 L 401.36 533.92 L 394.43 537.13 L 387.49 540.33 L 380.55 543.54 L 373.61 546.75 L 367.37 549.04 L 361.13 551.34 L 354.89 553.63 L 349.57 554.88 L 344.25 556.14 L 338.38 557.09 L 331.81 557.28 L 324.81 557.17 L 317.64 556.04 L 311.34 553.72 L 304.95 550.76 L 299.33 546.20 L 293.91 541.20 L 290.04 534.94 L 287.51 528.25 L 286.40 521.13 L 286.75 513.24 L 288.65 505.88 L 290.77 500.48 L 293.52 495.55 L 296.87 490.93 L 300.70 486.75 L 305.12 482.86 L 309.82 479.10 L 314.76 476.14 L 319.97 473.29 L 325.18 470.45 L 330.92 468.45 L 336.67 466.46 L 342.41 464.46 L 349.83 462.42 L 357.24 460.39 L 364.66 458.35 L 372.07 456.32 L 379.49 454.28 L 387.05 451.92 L 394.61 449.56 L 402.17 447.21 L 409.74 444.85 L 417.30 442.49 L 424.86 440.13 L 432.42 437.78 L 439.98 435.42 L 447.01 433.67 L 454.04 431.91 L 461.07 430.16 L 468.42 429.25 L 475.76 428.35 L 483.39 427.68 L 490.73 427.54 L 498.62 427.81 L 506.09 428.54 L 513.00 429.96 L 520.57 432.15 L 528.04 434.62 L 535.24 437.57 L 542.44 440.52 L 549.64 443.47 L 556.73 446.73 L 563.81 449.98 L 570.90 453.24 L 577.78 456.92 L 584.66 460.59 L 591.54 464.27 L 598.08 468.22 L 604.62 472.17 L 611.17 476.11 L 617.71 480.06 L 623.65 484.08 L 629.32 488.24 L 634.10 493.13 L 638.23 497.82 L 641.35 504.47 L 642.29 511.55 L 641.53 518.20 L 639.73 523.95 L 637.40 529.13 L 634.34 534.24 L 631.09 538.67 L 627.84 543.10 L 624.97 547.60 L 622.07 552.56 L 619.56 557.60 L 617.98 562.91 L 616.78 568.53 L 616.52 574.44 L 616.61 580.23 L 617.51 586.51 L 618.77 592.69 L 620.68 599.13 L 622.68 604.82 L 625.33 610.77 L 627.71 616.87 L 629.57 622.76 L 631.15 628.80 L 632.38 634.90 L 632.61 640.90 L 632.50 646.97 L 632.06 652.79 L 631.13 659.25 L 629.19 664.87 L 627.11 670.53 L 623.72 676.20 L 620.06 681.40 L 615.80 687.02 L 610.69 691.90 L 605.38 696.49 L 600.01 700.72 L 594.24 704.52 L 587.99 707.17 L 580.92 709.60 L 573.75 711.25 L 566.37 712.42 L 559.07 713.33 L 551.14 713.16 L 544.39 713.20 L 537.16 712.69 L 530.05 712.00 L 522.76 711.18 L 515.13 710.33 L 507.72 709.51 L 499.92 708.93 L 492.40 708.63 L 484.44 708.34 L 476.48 708.25 L 468.52 708.15 L 460.56 708.06 L 452.61 707.97 L 444.65 707.88 L 436.69 707.78 L 428.73 707.69 L 420.77 707.60 Z"

    /// 8 curvas + 4 retas. Apex e centroides atualizados em 2026-05-17 23h30 pelo Flávio.
    /// IMPORTANTE: ordem 2 era "MERGULHO DA BRUXA" — Flávio renomeou para "CURVA DA
    /// RETA OPOSTA" (o ponto onde ele marcou E/S/A é a curva da reta oposta; o
    /// mergulho da bruxa em si não é considerado um trecho pedagógico).
    public static func segments(layoutId: String) -> [TrackSegment] {
        return [
            // P1
            seg(layoutId, ordem: 0, nome: "CURVA 01",              tipo: .curva, parcial: "P1", x: 177, y: 658, t: 7.6,  ehTrecho: true,  apex: (177, 658), strat: .tardio,  ct: .lenta,  next: 280),
            seg(layoutId, ordem: 1, nome: "RETA PRINCIPAL / BOX",  tipo: .reta,  parcial: "P1", x: 390, y: 630, t: 98.0, ehTrecho: false),
            seg(layoutId, ordem: 2, nome: "CURVA DA RETA OPOSTA",  tipo: .curva, parcial: "P1", x: 553, y: 664, t: 16.5, ehTrecho: true,  apex: (553, 664), strat: .neutro,  ct: .rapida, next: 80),
            seg(layoutId, ordem: 3, nome: "CURVA 2",               tipo: .curva, parcial: "P1", x: 313, y: 152, t: 21.1, ehTrecho: true,  apex: (313, 152), strat: .tardio,  ct: .media,  next: 220),
            // P2
            seg(layoutId, ordem: 4, nome: "CURVA DA JUNÇÃO",       tipo: .curva, parcial: "P2", x: 677, y: 395, t: 31.0, ehTrecho: true,  apex: (677, 395), strat: .neutro,  ct: .media,  next: 180),
            seg(layoutId, ordem: 5, nome: "PISCINA",               tipo: .reta,  parcial: "P2", x: 460, y: 275, t: 40.0, ehTrecho: false),
            // P3
            seg(layoutId, ordem: 6, nome: "CURVA DA BRUXA",        tipo: .curva, parcial: "P3", x: 244, y: 570, t: 51.8, ehTrecho: true,  apex: (244, 570), strat: .tardio,  ct: .lenta,  next: 380),
            seg(layoutId, ordem: 7, nome: "RETA DO MILITAR",       tipo: .reta,  parcial: "P3", x: 155, y: 335, t: 56.0, ehTrecho: false),
            // P4
            seg(layoutId, ordem: 8, nome: "CURVA DO PLACAR",       tipo: .curva, parcial: "P4", x: 293, y: 517, t: 78.6, ehTrecho: true,  apex: (293, 517), strat: .neutro,  ct: .media,  next: 120),
            seg(layoutId, ordem: 9, nome: "CURVA \"S\"",           tipo: .curva, parcial: "P4", x: 635, y: 510, t: 89.2, ehTrecho: true,  apex: (635, 510), strat: .duplo,   ct: .rapida, next: 60),
            seg(layoutId, ordem: 10, nome: "CURVA DA VITÓRIA",     tipo: .curva, parcial: "P4", x: 617, y: 674, t: 93.5, ehTrecho: true,  apex: (617, 674), strat: .tardio,  ct: .media,  next: 320),
            seg(layoutId, ordem: 11, nome: "RETA OPOSTA",          tipo: .reta,  parcial: "P4", x: 405, y: 555, t: 75.0, ehTrecho: false),
        ]
    }

    /// Helper compact pra reduzir verbosidade da tabela acima.
    private static func seg(
        _ layoutId: String, ordem: Int, nome: String, tipo: SegmentTipo,
        parcial: String, x: Double, y: Double, t: Double, ehTrecho: Bool,
        apex: (Double, Double)? = nil, strat: ApexStrategy? = nil,
        ct: CornerType? = nil, next: Double? = nil
    ) -> TrackSegment {
        TrackSegment(
            id: "seg_brasilia_\(ordem)",
            layoutId: layoutId,
            ordem: ordem,
            nome: nome,
            tipo: tipo,
            ehTrecho: ehTrecho,
            parcialId: parcial,
            x: x, y: y,
            tNaVolta: t,
            apexReference: apex.map { ApexReference(x: $0.0, y: $0.1) },
            apexStrategy: strat,
            cornerType: ct,
            nextStraightLength: next,
            apexCalibration: ehTrecho ? "DEFAULT" : nil,
            pathStart: nil, pathEnd: nil
        )
    }

    /// Faixas geográficas pré-calibradas (Onda 3 reformulação 2026-05-17).
    /// Cada CURVA dos 8 trechos pedagógicos ganha entrada / saída / ápice.
    /// Retas e transições NÃO têm faixas (decisão B2). Curvas com geometria
    /// dupla ("S" / Esses) ganham apice 0 e apice 1 (decisão B3, até 2).
    ///
    /// Coordenadas em frame SVG do path oficial (viewBox 823×799), pré-
    /// calibradas como aproximação inicial. Quando o editor visual
    /// estiver pronto, Flávio refina arrastando no app.
    ///
    /// Tuplas: (segmentOrdem, tipo, indice, x, y).
    public static let faixas: [(Int, String, Int, Double, Double)] = [
        // CURVA 01 (ordem 0) — lenta, apex tardio
        (0, "entrada", 0, 241.32, 705.29),
        (0, "saida",   0, 172.06, 614.00),
        (0, "apice",   0, 177.40, 658.23),
        // CURVA DA RETA OPOSTA (ordem 2 — renomeada do "MERGULHO DA BRUXA")
        (2, "entrada", 0, 494.13, 661.22),
        (2, "saida",   0, 549.19, 583.09),
        (2, "apice",   0, 552.81, 663.85),
        // CURVA 2 (ordem 3) — média, apex tardio
        (3, "entrada", 0, 285.03, 179.48),
        (3, "saida",   0, 378.71, 168.81),
        (3, "apice",   0, 312.64, 151.70),
        // CURVA DA JUNÇÃO (ordem 4) — média, apex neutro
        (4, "entrada", 0, 647.17, 327.90),
        (4, "saida",   0, 590.27, 409.42),
        (4, "apice",   0, 677.17, 395.16),
        // CURVA DA BRUXA (ordem 6) — lenta, apex tardio
        (6, "entrada", 0, 236.19, 511.50),
        (6, "saida",   0, 279.89, 600.20),
        (6, "apice",   0, 243.54, 570.08),
        // CURVA DO PLACAR (ordem 8) — média, apex neutro
        (8, "entrada", 0, 360.42, 550.90),
        (8, "saida",   0, 336.46, 468.96),
        (8, "apice",   0, 292.83, 517.09),
        // CURVA "S" (ordem 9) — rápida, ápice duplo (decisão B3 até 2)
        (9, "entrada", 0, 617.81, 480.51),
        (9, "saida",   0, 625.51, 613.99),
        (9, "apice",   0, 634.65, 509.61),
        (9, "apice",   1, 624.26, 571.22),
        // CURVA DA VITÓRIA (ordem 10) — média, apex tardio
        (10, "entrada", 0, 629.98, 621.13),
        (10, "saida",   0, 522.34, 712.51),
        (10, "apice",   0, 617.02, 674.35),
    ]

    /// Track + Layout + Segments completos prontos pra usar.
    public static func make() -> (track: Track, layout: TrackLayout, segments: [TrackSegment]) {
        let track = Track(
            id: "e8335412-3312-54fe-b634-db2d02c7fa81",
            nome: "Autódromo Internacional Nelson Piquet",
            apelido: "Brasília",
            pais: "BR",
            cidade: "Brasília",
            extensaoMetros: 5476,
            numeroCurvas: 8,
            sentido: "anti-horário",
            imagemFundo: "assets/pistas/brasilia.png",
            viewBox: viewBox,
            svgPath: svgPath,
            linhaChegada: linhaChegada,
            geoAncoras: geoAncoras,
            lapRefSeg: lapTimeSec
        )
        let layout = TrackLayout(
            id: "lay_brasilia_principal",
            trackId: track.id,
            nome: "Principal",
            linhaChegada: linhaChegada,
            parciais: parciais
        )
        let segs = segments(layoutId: layout.id)
        return (track, layout, segs)
    }
}
