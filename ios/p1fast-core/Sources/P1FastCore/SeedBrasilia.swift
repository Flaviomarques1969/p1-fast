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

    /// Path SVG calibrado (volta 5 Flavio).
    public static let svgPath = "M 420.20 707.58 L 242.63 705.75 L 223.63 704.27 L 206.67 699.64 L 190.46 690.06 L 177.44 675.92 L 163.53 640.49 L 173.07 615.32 L 177.09 595.50 L 181.56 552.34 L 189.99 507.41 L 195.17 485.19 L 201.93 462.25 L 207.99 438.19 L 229.60 366.52 L 237.64 341.92 L 252.10 290.03 L 260.17 264.58 L 279.72 194.33 L 291.15 161.70 L 294.72 156.29 L 298.66 150.33 L 311.63 145.96 L 326.58 143.68 L 343.19 148.38 L 358.95 155.60 L 374.08 164.69 L 388.56 176.62 L 401.91 190.62 L 426.33 224.01 L 454.76 257.96 L 469.70 274.35 L 488.13 287.86 L 508.65 299.03 L 530.47 307.88 L 553.93 313.11 L 602.62 318.12 L 625.66 321.92 L 645.47 326.63 L 661.43 333.14 L 674.27 342.65 L 683.96 355.44 L 688.29 370.67 L 686.56 387.23 L 679.94 402.31 L 668.35 415.01 L 653.49 424.27 L 635.14 427.77 L 615.99 423.99 L 599.32 414.02 L 563.03 395.14 L 544.62 386.15 L 524.16 377.79 L 502.83 371.66 L 478.87 368.78 L 455.47 367.00 L 432.13 368.11 L 407.30 371.47 L 382.97 378.12 L 335.78 393.87 L 314.58 402.85 L 295.48 415.65 L 279.26 431.18 L 265.73 450.19 L 255.25 471.55 L 248.52 494.81 L 234.11 513.72 L 238.41 537.37 L 234.92 549.83 L 233.49 560.58 L 237.93 572.18 L 246.95 583.62 L 259.77 593.13 L 276.11 598.40 L 327.75 611.39 L 528.57 671.64 L 542.60 672.98 L 556.32 670.11 L 567.69 660.39 L 574.68 647.16 L 575.82 631.31 L 573.66 615.56 L 566.35 600.49 L 554.99 587.43 L 541.29 575.59 L 513.98 548.01 L 498.16 534.88 L 478.96 526.19 L 458.62 521.37 L 436.90 521.82 L 415.24 527.50 L 373.61 546.75 L 354.89 553.63 L 338.93 557.39 L 324.68 557.18 L 311.28 554.18 L 299.36 546.38 L 289.53 535.43 L 285.49 521.07 L 288.02 505.40 L 296.27 490.63 L 309.55 478.98 L 325.18 470.45 L 342.41 464.46 L 379.49 454.28 L 439.98 435.42 L 461.07 430.16 L 483.11 427.44 L 505.75 428.57 L 528.04 434.62 L 549.64 443.47 L 570.90 453.24 L 591.54 464.27 L 624.25 484.01 L 634.38 492.47 L 640.90 503.88 L 640.91 518.80 L 634.34 534.24 L 624.59 547.53 L 617.04 562.63 L 616.26 580.34 L 620.02 598.86 L 627.99 616.73 L 632.73 634.83 L 632.38 653.04 L 626.28 670.72 L 615.99 687.30 L 600.08 701.09 L 580.92 709.60 L 559.69 712.35 L 492.40 708.43 L 420.77 707.60 Z"

    /// 8 curvas + 4 retas. Apex DEFAULT — calibrar antes de track day.
    public static func segments(layoutId: String) -> [TrackSegment] {
        return [
            // P1
            seg(layoutId, ordem: 0, nome: "CURVA 01",              tipo: .curva, parcial: "P1", x: 145, y: 645, t: 7.6,  ehTrecho: true,  apex: (145, 645), strat: .tardio,  ct: .lenta,  next: 280),
            seg(layoutId, ordem: 1, nome: "RETA PRINCIPAL / BOX",  tipo: .reta,  parcial: "P1", x: 390, y: 630, t: 98.0, ehTrecho: false),
            seg(layoutId, ordem: 2, nome: "MERGULHO DA BRUXA",     tipo: .curva, parcial: "P1", x: 315, y: 305, t: 16.5, ehTrecho: true,  apex: (315, 305), strat: .neutro,  ct: .rapida, next: 80),
            seg(layoutId, ordem: 3, nome: "CURVA 2",               tipo: .curva, parcial: "P1", x: 290, y:  85, t: 21.1, ehTrecho: true,  apex: (290,  85), strat: .tardio,  ct: .media,  next: 220),
            // P2
            seg(layoutId, ordem: 4, nome: "CURVA DA JUNÇÃO",       tipo: .curva, parcial: "P2", x: 600, y: 330, t: 31.0, ehTrecho: true,  apex: (600, 330), strat: .neutro,  ct: .media,  next: 180),
            seg(layoutId, ordem: 5, nome: "PISCINA",               tipo: .reta,  parcial: "P2", x: 460, y: 275, t: 40.0, ehTrecho: false),
            // P3
            seg(layoutId, ordem: 6, nome: "CURVA DA BRUXA",        tipo: .curva, parcial: "P3", x: 225, y: 570, t: 51.8, ehTrecho: true,  apex: (225, 570), strat: .tardio,  ct: .lenta,  next: 380),
            seg(layoutId, ordem: 7, nome: "RETA DO MILITAR",       tipo: .reta,  parcial: "P3", x: 155, y: 335, t: 56.0, ehTrecho: false),
            // P4
            seg(layoutId, ordem: 8, nome: "CURVA DO PLACAR",       tipo: .curva, parcial: "P4", x: 335, y: 475, t: 78.6, ehTrecho: true,  apex: (335, 475), strat: .neutro,  ct: .media,  next: 120),
            seg(layoutId, ordem: 9, nome: "CURVA \"S\"",           tipo: .curva, parcial: "P4", x: 630, y: 525, t: 89.2, ehTrecho: true,  apex: (630, 525), strat: .duplo,   ct: .rapida, next: 60),
            seg(layoutId, ordem: 10, nome: "CURVA DA VITÓRIA",     tipo: .curva, parcial: "P4", x: 645, y: 650, t: 93.5, ehTrecho: true,  apex: (645, 650), strat: .tardio,  ct: .media,  next: 320),
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
