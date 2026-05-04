// ═══════════════════════════════════════════════════════════
// Detector — port Swift de src/telemetry/detector.js
// ═══════════════════════════════════════════════════════════
// Engine ao vivo: stream de samples → eventos lap / segmentStart /
// segmentEnd. Stateful, classe (referência) — listener pattern com
// closure de unsubscribe (paridade com JS Set<cb>).
//
// Entrada: consume(DetectorSample) ou consumeSnapshot(Snapshot).
// Sample carrega (x, y) já em coords do viewBox (snap acontece dentro).
//
// Apex tracking: durante segment, atualiza velMinima/apexT/apexOffset/
// apexActual sempre que speed cai. Frenagem detectada por queda > 3 m/s
// em < 1s (uma vez por segment).
//
// Transição de parcial: monitora `segment.parcialId` — quando muda,
// fecha tempo da parcial anterior em voltaAtual.temposPorParcial.

import Foundation

/// Sample mínimo aceito pelo Detector.
public struct DetectorSample: Sendable {
    public var x: Double?
    public var y: Double?
    public var t: Double           // timestamp wall (ms). Usado em entradaAt/saidaAt.
    public var tMono: Double?      // monotônico (ms). Usado em durações; default → t.
    public var speed: Double?      // m/s

    public init(x: Double?, y: Double?, t: Double, tMono: Double? = nil, speed: Double? = nil) {
        self.x = x; self.y = y; self.t = t; self.tMono = tMono; self.speed = speed
    }
}

public struct DetectorBrakingPoint: Sendable, Equatable {
    public let offset: Double
    public let t: Double
    public let velPre: Double
    public init(offset: Double, t: Double, velPre: Double) {
        self.offset = offset; self.t = t; self.velPre = velPre
    }
}

public struct DetectorLapEvent: Sendable {
    public let numero: Int
    public let inicioAt: Double
    public let fimAt: Double
    public let tempoMs: Double
    public let temposPorParcial: [String: Double]
    public let temposPorTrecho: [String: Double]
}

public struct DetectorSegmentStartEvent: Sendable {
    public let segmentId: String
    public let lapNumero: Int?
    public let entradaAt: Double
    public let velEntrada: Double?
    public let offset: Double
}

public struct DetectorSegmentEndEvent: Sendable {
    public let segmentId: String
    public let lapNumero: Int?
    public let entradaAt: Double
    public let saidaAt: Double
    public let tempoMs: Double
    public let velEntrada: Double?
    public let velMinima: Double?
    public let velSaida: Double?
    public let pontoFrenagem: DetectorBrakingPoint?
    public let apexT: Double?
    public let apexOffset: Double?
    public let apexActual: PathMapper.Point?
}

public struct DetectorStats: Sendable {
    public let lapCount: Int
    public let voltaAtualNumero: Int?
    public let currentParcial: String?
    public let segmentoAtualId: String?
}

public final class Detector {

    private let lookup: PathMapper.Lookup
    private let linhaChegada: LinhaChegada?
    private let segments: [TrackSegment]
    private let snapMaxDist: Double

    // Listeners
    public typealias LapHandler = @Sendable (DetectorLapEvent) -> Void
    public typealias SegmentStartHandler = @Sendable (DetectorSegmentStartEvent) -> Void
    public typealias SegmentEndHandler = @Sendable (DetectorSegmentEndEvent) -> Void

    private var lapListeners: [UUID: LapHandler] = [:]
    private var segStartListeners: [UUID: SegmentStartHandler] = [:]
    private var segEndListeners: [UUID: SegmentEndHandler] = [:]

    // Estado interno
    public private(set) var lapCount: Int = 0

    private struct VoltaAtual {
        var numero: Int
        var inicioAt: Double
        var inicioAtMono: Double
        var temposPorParcial: [String: Double]
        var temposPorTrecho: [String: Double]
    }
    private var voltaAtual: VoltaAtual?

    private struct UltimoPonto {
        var x: Double
        var y: Double
        var t: Double
        var tMono: Double?
        var speed: Double?
        var offset: Double
    }
    private var ultimoPonto: UltimoPonto?

    private struct SegmentoAtual {
        var segmentId: String
        var entradaAt: Double
        var velEntrada: Double?
        var velMinima: Double?
        var pontoFrenagem: DetectorBrakingPoint?
        var apexT: Double?
        var apexOffset: Double?
        var apexActual: PathMapper.Point?
    }
    private var segmentoAtual: SegmentoAtual?

    private var parcialTimestamps: [String: Double] = [:]
    private var currentParcial: String?

    public init(
        svgPath: String,
        linhaChegada: LinhaChegada?,
        segments: [TrackSegment] = [],
        snapMaxDist: Double = 80
    ) {
        self.lookup = PathMapper.buildLookup(svgPath, samples: 2000)
        self.linhaChegada = linhaChegada
        self.segments = segments
        self.snapMaxDist = snapMaxDist
    }

    // MARK: - Listeners

    @discardableResult
    public func onLap(_ cb: @escaping LapHandler) -> () -> Void {
        let id = UUID()
        lapListeners[id] = cb
        return { [weak self] in self?.lapListeners.removeValue(forKey: id) }
    }

    @discardableResult
    public func onSegmentStart(_ cb: @escaping SegmentStartHandler) -> () -> Void {
        let id = UUID()
        segStartListeners[id] = cb
        return { [weak self] in self?.segStartListeners.removeValue(forKey: id) }
    }

    @discardableResult
    public func onSegmentEnd(_ cb: @escaping SegmentEndHandler) -> () -> Void {
        let id = UUID()
        segEndListeners[id] = cb
        return { [weak self] in self?.segEndListeners.removeValue(forKey: id) }
    }

    private func emitLap(_ ev: DetectorLapEvent) { for cb in lapListeners.values { cb(ev) } }
    private func emitSegStart(_ ev: DetectorSegmentStartEvent) { for cb in segStartListeners.values { cb(ev) } }
    private func emitSegEnd(_ ev: DetectorSegmentEndEvent) { for cb in segEndListeners.values { cb(ev) } }

    // MARK: - Consumo

    /// Adapter pra Snapshot — espelha JS `consumeSnapshot`.
    /// Lê position.localX/Y, t/tMono, vehicle.speedFused ?? speedGnss.
    public func consumeSnapshot(_ snap: Snapshot) {
        guard let x = snap.position.localX, let y = snap.position.localY else { return }
        let speed = snap.vehicle.speedFused ?? snap.vehicle.speedGnss
        consume(DetectorSample(
            x: x, y: y,
            t: Double(snap.t),
            tMono: snap.tMono,
            speed: speed
        ))
    }

    public func consume(_ sample: DetectorSample) {
        guard let sx = sample.x, let sy = sample.y else { return }
        let snapped = PathMapper.snap(lookup, x: sx, y: sy)
        if snapped.dist > snapMaxDist { return }

        let point = UltimoPonto(
            x: sx, y: sy,
            t: sample.t, tMono: sample.tMono,
            speed: sample.speed,
            offset: snapped.offset
        )

        if let last = ultimoPonto, let lc = linhaChegada {
            let cruzou = PathMapper.segmentsIntersect(
                PathMapper.Point(x: last.x, y: last.y),
                PathMapper.Point(x: point.x, y: point.y),
                PathMapper.Point(x: lc.x1, y: lc.y1),
                PathMapper.Point(x: lc.x2, y: lc.y2)
            )
            if cruzou { onLineCross(point) }
        }

        updateSegment(point)

        ultimoPonto = point
    }

    // MARK: - Linha de chegada

    private func onLineCross(_ point: UltimoPonto) {
        let tRef = point.tMono ?? point.t
        lapCount += 1
        if var v = voltaAtual {
            // Fecha parcial corrente antes de emitir a volta
            if let cp = currentParcial, let inicioParcial = parcialTimestamps[cp] {
                v.temposPorParcial[cp] = tRef - inicioParcial
            }
            let lap = DetectorLapEvent(
                numero: v.numero,
                inicioAt: v.inicioAt,
                fimAt: point.t,
                tempoMs: tRef - v.inicioAtMono,
                temposPorParcial: v.temposPorParcial,
                temposPorTrecho: v.temposPorTrecho
            )
            emitLap(lap)
        }
        voltaAtual = VoltaAtual(
            numero: lapCount,
            inicioAt: point.t,
            inicioAtMono: tRef,
            temposPorParcial: [:],
            temposPorTrecho: [:]
        )
        parcialTimestamps = [:]
        currentParcial = nil
    }

    // MARK: - Parcial

    private func onParcialChange(_ parcialNova: String, tRef: Double) {
        if let cp = currentParcial, let inicioParcial = parcialTimestamps[cp], voltaAtual != nil {
            voltaAtual?.temposPorParcial[cp] = tRef - inicioParcial
        }
        parcialTimestamps[parcialNova] = tRef
        currentParcial = parcialNova
    }

    // MARK: - Segmento

    private func updateSegment(_ point: UltimoPonto) {
        guard !segments.isEmpty else { return }
        let pctOffset = (point.offset / lookup.totalLength) * 100.0
        let found = segments.first { s in
            guard let ps = s.pathStart, let pe = s.pathEnd else { return false }
            return pctOffset >= ps && pctOffset < pe
        }

        // Transição de parcial via parcialId do segmento
        if let f = found, !f.parcialId.isEmpty, f.parcialId != currentParcial {
            let tRef = point.tMono ?? point.t
            onParcialChange(f.parcialId, tRef: tRef)
        }

        let fechaSegmentoAtual: (UltimoPonto) -> Void = { [weak self] saidaPoint in
            guard let self, let seg = self.segmentoAtual else { return }
            let tempoMs = saidaPoint.t - seg.entradaAt
            let ev = DetectorSegmentEndEvent(
                segmentId: seg.segmentId,
                lapNumero: self.voltaAtual?.numero,
                entradaAt: seg.entradaAt,
                saidaAt: saidaPoint.t,
                tempoMs: tempoMs,
                velEntrada: seg.velEntrada,
                velMinima: seg.velMinima,
                velSaida: self.ultimoPonto?.speed,
                pontoFrenagem: seg.pontoFrenagem,
                apexT: seg.apexT,
                apexOffset: seg.apexOffset,
                apexActual: seg.apexActual
            )
            self.voltaAtual?.temposPorTrecho[seg.segmentId] = tempoMs
            self.emitSegEnd(ev)
        }

        if let f = found, segmentoAtual?.segmentId != f.id {
            // Entrada num novo segmento — fechar atual se houver
            if segmentoAtual != nil { fechaSegmentoAtual(point) }
            segmentoAtual = SegmentoAtual(
                segmentId: f.id,
                entradaAt: point.t,
                velEntrada: point.speed,
                velMinima: point.speed,
                pontoFrenagem: nil,
                apexT: point.t,
                apexOffset: point.offset,
                apexActual: PathMapper.Point(x: point.x, y: point.y)
            )
            emitSegStart(DetectorSegmentStartEvent(
                segmentId: f.id,
                lapNumero: voltaAtual?.numero,
                entradaAt: point.t,
                velEntrada: point.speed,
                offset: point.offset
            ))
        } else if found == nil, segmentoAtual != nil {
            // Saída de segmento pra "fora de qualquer trecho" (reta)
            fechaSegmentoAtual(point)
            segmentoAtual = nil
        } else if var seg = segmentoAtual {
            // Dentro do mesmo segmento — atualiza apex / pontoFrenagem
            if let sp = point.speed, let vm = seg.velMinima, sp < vm {
                seg.velMinima = sp
                seg.apexT = point.t
                seg.apexOffset = point.offset
                seg.apexActual = PathMapper.Point(x: point.x, y: point.y)
            }
            if let last = ultimoPonto, let sp = point.speed, let lp = last.speed, seg.pontoFrenagem == nil {
                let dv = lp - sp
                let dt = (point.t - last.t) / 1000.0
                if dv > 3 && dt > 0 {
                    seg.pontoFrenagem = DetectorBrakingPoint(
                        offset: point.offset,
                        t: point.t,
                        velPre: lp
                    )
                }
            }
            segmentoAtual = seg
        }
    }

    // MARK: - Stats / Snapshot público

    public func stats() -> DetectorStats {
        DetectorStats(
            lapCount: lapCount,
            voltaAtualNumero: voltaAtual?.numero,
            currentParcial: currentParcial,
            segmentoAtualId: segmentoAtual?.segmentId
        )
    }

    /// Source-of-truth pra trecho_id em tempo real (usado pelo trecho-resolver
    /// do shift-light). Síncrono — devolve o segment ativo agora.
    public func getCurrentSegmentId() -> String? {
        segmentoAtual?.segmentId
    }
}
