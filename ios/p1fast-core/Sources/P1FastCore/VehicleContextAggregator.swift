// ═══════════════════════════════════════════════════════════
// VehicleContextAggregator — modelo contextual evolutivo do carro
// ═══════════════════════════════════════════════════════════
// MS-16.2 (Command Box Engenharia — Camada 1 Engine Core, Modelo Contextual).
// docs/COMMAND_BOX_ENGENHARIA.md §4 (Vehicle Context Model) e §5.1.
// Resolve gap G2 do mesmo doc: o Snapshot é por-instante; este aggregador
// mantém estado evolutivo (lap rolling window + stint history + segments
// + fase térmica) que as Camadas 2 (Calibration Engine, MS-16.3) e 3
// (Senior Advisor IA, MS-16.4) consomem.
//
// NÃO-objetivos:
//   • NÃO persiste (estado em memória; checkpointing pra Supabase é
//     decisão MS-16.4/5; samples brutos continuam em SQLite — ADR-014).
//   • NÃO emite hipóteses (Camada 2 faz isso a partir do contexto).
//   • NÃO chama IA (Camada 3 isolada por contrato — ADR-008).
//   • NÃO computa células RPM×MAP completas (MS-16.9 gate D5).
//
// Princípio: consome Snapshots a 10 Hz + eventos do Detector. Atualiza
// janelas rolling + agregados por trecho. Em qualquer instante, expõe
// `currentContext()` snapshot do estado evolutivo.

import Foundation

/// Fase térmica do motor — state machine simples baseada em water_temp.
public enum ThermalPhase: String, Codable, Sendable, CaseIterable {
    case cold       // < 60°C — partida fria
    case warming    // 60-95°C — aquecendo
    case atTemp     // 95-105°C — janela operacional Celta 1.4
    case overheat   // > 105°C — risco térmico
    case cooling    // descendente sustentado (>3°C/min queda)
}

/// Snapshot pontual do contexto evolutivo do carro.
public struct VehicleContext: Sendable {
    public let lastSnapshotTMono: Double?
    public let lap: LapWindow
    public let stint: StintWindow
    public let lastSegment: SegmentEndRecord?
    public let thermalPhase: ThermalPhase
    public let snapshotsConsumed: Int

    public init(
        lastSnapshotTMono: Double?,
        lap: LapWindow,
        stint: StintWindow,
        lastSegment: SegmentEndRecord?,
        thermalPhase: ThermalPhase,
        snapshotsConsumed: Int
    ) {
        self.lastSnapshotTMono = lastSnapshotTMono
        self.lap = lap
        self.stint = stint
        self.lastSegment = lastSegment
        self.thermalPhase = thermalPhase
        self.snapshotsConsumed = snapshotsConsumed
    }
}

/// Janela rolling da volta corrente. Reset em cada `onLapEnd`.
public struct LapWindow: Sendable {
    public let lapNumero: Int?
    public let samplesCount: Int
    /// Contagem de samples atendendo critério de mistura pobre sob carga
    /// (TPS > 70, MAP > 0.8, RPM > 4000, λ > 1.0). Alimenta rule
    /// `fuel-lean-sustained-load` (MS-16.3).
    public let leanLoadSamples: Int
    public let waterTempStart: Double?
    public let waterTempEnd: Double?
    public let iatStart: Double?
    public let iatEnd: Double?
    public let accelLongMax: Double?
    public let rpmMax: Double?

    public static let empty = LapWindow(
        lapNumero: nil, samplesCount: 0, leanLoadSamples: 0,
        waterTempStart: nil, waterTempEnd: nil,
        iatStart: nil, iatEnd: nil,
        accelLongMax: nil, rpmMax: nil
    )

    public init(
        lapNumero: Int?, samplesCount: Int, leanLoadSamples: Int,
        waterTempStart: Double?, waterTempEnd: Double?,
        iatStart: Double?, iatEnd: Double?,
        accelLongMax: Double?, rpmMax: Double?
    ) {
        self.lapNumero = lapNumero
        self.samplesCount = samplesCount
        self.leanLoadSamples = leanLoadSamples
        self.waterTempStart = waterTempStart
        self.waterTempEnd = waterTempEnd
        self.iatStart = iatStart
        self.iatEnd = iatEnd
        self.accelLongMax = accelLongMax
        self.rpmMax = rpmMax
    }
}

/// Histórico agregado do stint corrente.
public struct StintWindow: Sendable {
    public let lapHistory: [LapWindow]
    public let bestLapMs: Double?
    public let lastNLapTimesMs: [Double]
    /// Janela rolling de (tMono, water_temp). Alimenta rule
    /// `water-temp-drift-no-cooling` (MS-16.3). Mantida em 5 minutos.
    public let waterTempSeries: [(tMono: Double, tempC: Double)]
    /// `segmentId → [(lapNum, vminKmh, iatAtLap)]` indexado por trecho.
    /// Alimenta rule `vmin-progressive-loss-segment` (MS-16.3).
    public let vminBySegmentLap: [String: [SegmentVminRecord]]

    public static let empty = StintWindow(
        lapHistory: [], bestLapMs: nil, lastNLapTimesMs: [],
        waterTempSeries: [], vminBySegmentLap: [:]
    )

    public init(
        lapHistory: [LapWindow],
        bestLapMs: Double?,
        lastNLapTimesMs: [Double],
        waterTempSeries: [(tMono: Double, tempC: Double)],
        vminBySegmentLap: [String: [SegmentVminRecord]]
    ) {
        self.lapHistory = lapHistory
        self.bestLapMs = bestLapMs
        self.lastNLapTimesMs = lastNLapTimesMs
        self.waterTempSeries = waterTempSeries
        self.vminBySegmentLap = vminBySegmentLap
    }
}

public struct SegmentVminRecord: Sendable, Equatable {
    public let lapNumero: Int
    public let vminKmh: Double
    /// IAT médio da volta em que o Vmin foi capturado — pra correlacionar
    /// queda progressiva com aquecimento do ar de admissão.
    public let iatAvgC: Double?

    public init(lapNumero: Int, vminKmh: Double, iatAvgC: Double?) {
        self.lapNumero = lapNumero
        self.vminKmh = vminKmh
        self.iatAvgC = iatAvgC
    }
}

public struct SegmentEndRecord: Sendable {
    public let segmentId: String
    public let lapNumero: Int?
    public let tempoMs: Double
    public let velMinimaKmh: Double?
    public let velEntradaKmh: Double?
    public let velSaidaKmh: Double?
    public let apexActual: PathMapper.Point?

    public init(
        segmentId: String, lapNumero: Int?, tempoMs: Double,
        velMinimaKmh: Double?, velEntradaKmh: Double?, velSaidaKmh: Double?,
        apexActual: PathMapper.Point?
    ) {
        self.segmentId = segmentId
        self.lapNumero = lapNumero
        self.tempoMs = tempoMs
        self.velMinimaKmh = velMinimaKmh
        self.velEntradaKmh = velEntradaKmh
        self.velSaidaKmh = velSaidaKmh
        self.apexActual = apexActual
    }
}

/// Critérios de mistura pobre sob carga — paridade com a regra
/// `fuel-lean-sustained-load` proposta em `docs/COMMAND_BOX_ENGENHARIA.md` §5.1.
/// Limites são heurísticos do Celta 1.4 (NEEDS_CALIBRATION via Flávio em pista).
public struct LeanLoadCriteria: Sendable {
    public let tpsMin: Double      // %
    public let mapMin: Double      // bar
    public let rpmMin: Double      // rpm
    public let lambdaMin: Double   // λ

    public static let `default` = LeanLoadCriteria(
        tpsMin: 70, mapMin: 0.8, rpmMin: 4000, lambdaMin: 1.0
    )

    public init(tpsMin: Double, mapMin: Double, rpmMin: Double, lambdaMin: Double) {
        self.tpsMin = tpsMin; self.mapMin = mapMin
        self.rpmMin = rpmMin; self.lambdaMin = lambdaMin
    }
}

/// Janela rolling do `waterTempSeries` em ms (default 5 min).
public let VEHICLE_CTX_WATER_TEMP_WINDOW_MS: Double = 5 * 60 * 1000

/// Limite de tempos guardados em `lastNLapTimesMs` (rolling) — paridade
/// com `repeatability.js`.
public let VEHICLE_CTX_LAP_TIMES_WINDOW: Int = 12

/// Limite de samples Vmin por segment (mais que isso, fifo). 1 entrada/volta.
public let VEHICLE_CTX_VMIN_PER_SEGMENT_MAX: Int = 30

/// Aggregator central. Caller bombeia Snapshots e eventos do Detector.
public final class VehicleContextAggregator {

    private var leanCriteria: LeanLoadCriteria
    private var snapshotsConsumed: Int = 0
    private var lastSnapshotTMono: Double?

    // Lap rolling window
    private var lapNumero: Int?
    private var lapSamplesCount: Int = 0
    private var lapLeanLoadSamples: Int = 0
    private var lapWaterTempStart: Double?
    private var lapWaterTempEnd: Double?
    private var lapIatStart: Double?
    private var lapIatEnd: Double?
    private var lapIatSum: Double = 0
    private var lapIatCount: Int = 0
    private var lapAccelLongMax: Double?
    private var lapRpmMax: Double?

    // Stint history
    private var lapHistory: [LapWindow] = []
    private var lapTimesMs: [Double] = []
    private var bestLapMs: Double?
    private var waterTempSeries: [(tMono: Double, tempC: Double)] = []
    private var vminBySegmentLap: [String: [SegmentVminRecord]] = [:]

    // Last segment cache
    private var lastSegment: SegmentEndRecord?

    // Thermal phase
    private var thermalPhase: ThermalPhase = .cold
    private var lastWaterTempSampleForCooling: Double?
    private var lastWaterTempTMonoForCooling: Double?

    public init(leanCriteria: LeanLoadCriteria = .default) {
        self.leanCriteria = leanCriteria
    }

    /// Bombeia um Snapshot consolidado.
    public func ingestSnapshot(_ snap: Snapshot) {
        snapshotsConsumed += 1
        lastSnapshotTMono = snap.tMono

        // Engine fields (T4000)
        let e = snap.engine

        // 1. Lean-load tracking (paridade rule fuel-lean-sustained-load)
        if let tps = e.tps, let map = e.map, let rpm = e.rpm, let lambda = e.lambda,
           snap.quality.t4000 == .ok,
           tps > leanCriteria.tpsMin,
           map > leanCriteria.mapMin,
           rpm > leanCriteria.rpmMin,
           lambda > leanCriteria.lambdaMin {
            lapLeanLoadSamples += 1
        }

        // 2. Lap counters
        lapSamplesCount += 1
        if lapWaterTempStart == nil, let w = e.waterTemp { lapWaterTempStart = w }
        if let w = e.waterTemp { lapWaterTempEnd = w }

        // IAT — alimenta a correlação Vmin × IAT da CR3 (vmin-progressive-loss-segment).
        // Gating quality.t4000=.ok pra evitar contaminar com leitura ruim do CAN.
        if let iat = e.iat, snap.quality.t4000 == .ok {
            if lapIatStart == nil { lapIatStart = iat }
            lapIatEnd = iat
            lapIatSum += iat
            lapIatCount += 1
        }

        if let r = e.rpm {
            lapRpmMax = max(lapRpmMax ?? -Double.infinity, r)
        }
        if let a = snap.dynamics.accelLongitudinal {
            lapAccelLongMax = max(lapAccelLongMax ?? -Double.infinity, abs(a))
        }

        // 3. Water-temp drift series (mantém janela de 5 min)
        if let w = e.waterTemp, snap.quality.t4000 == .ok {
            waterTempSeries.append((tMono: snap.tMono, tempC: w))
            let cutoff = snap.tMono - VEHICLE_CTX_WATER_TEMP_WINDOW_MS
            while let first = waterTempSeries.first, first.tMono < cutoff {
                waterTempSeries.removeFirst()
            }
            updateThermalPhase(currentTemp: w, tMono: snap.tMono)
        }
    }

    /// Bombeia um evento de fim de volta do Detector.
    public func onLapEnd(_ event: DetectorLapEvent) {
        let lapWindow = LapWindow(
            lapNumero: event.numero,
            samplesCount: lapSamplesCount,
            leanLoadSamples: lapLeanLoadSamples,
            waterTempStart: lapWaterTempStart,
            waterTempEnd: lapWaterTempEnd,
            iatStart: lapIatStart,
            iatEnd: lapIatEnd,
            accelLongMax: lapAccelLongMax,
            rpmMax: lapRpmMax
        )
        lapHistory.append(lapWindow)

        // Atualiza tempos de volta
        lapTimesMs.append(event.tempoMs)
        if lapTimesMs.count > VEHICLE_CTX_LAP_TIMES_WINDOW {
            lapTimesMs.removeFirst()
        }
        if let current = bestLapMs {
            if event.tempoMs < current && event.tempoMs > 0 {
                bestLapMs = event.tempoMs
            }
        } else if event.tempoMs > 0 {
            bestLapMs = event.tempoMs
        }

        // IAT da volta corrente (média) — armazena pra correlação Vmin×IAT
        let lapIatAvg = lapIatCount > 0 ? lapIatSum / Double(lapIatCount) : nil

        // Persiste Vmin de cada trecho dessa volta com IAT correlato
        // (chamadas onSegmentEnd anteriores nesta mesma volta ficaram em
        // `vminBySegmentLap` SEM iatAvg — preenchemos retroativamente).
        for (seg, records) in vminBySegmentLap {
            vminBySegmentLap[seg] = records.map { rec in
                rec.lapNumero == event.numero && rec.iatAvgC == nil
                    ? SegmentVminRecord(lapNumero: rec.lapNumero, vminKmh: rec.vminKmh, iatAvgC: lapIatAvg)
                    : rec
            }
        }

        // Reset lap window
        lapNumero = event.numero + 1
        lapSamplesCount = 0
        lapLeanLoadSamples = 0
        lapWaterTempStart = nil
        lapWaterTempEnd = nil
        lapIatStart = nil
        lapIatEnd = nil
        lapIatSum = 0
        lapIatCount = 0
        lapAccelLongMax = nil
        lapRpmMax = nil
    }

    /// Bombeia um evento de fim de segmento do Detector.
    public func onSegmentEnd(_ event: DetectorSegmentEndEvent) {
        let velMinKmh = event.velMinima.map { $0 * 3.6 }
        let velEntradaKmh = event.velEntrada.map { $0 * 3.6 }
        let velSaidaKmh = event.velSaida.map { $0 * 3.6 }

        lastSegment = SegmentEndRecord(
            segmentId: event.segmentId,
            lapNumero: event.lapNumero,
            tempoMs: event.tempoMs,
            velMinimaKmh: velMinKmh,
            velEntradaKmh: velEntradaKmh,
            velSaidaKmh: velSaidaKmh,
            apexActual: event.apexActual
        )

        // Persiste Vmin georef do trecho — alimenta rule vmin-progressive-loss-segment
        if let vmin = velMinKmh, let lap = event.lapNumero {
            var records = vminBySegmentLap[event.segmentId] ?? []
            records.append(SegmentVminRecord(lapNumero: lap, vminKmh: vmin, iatAvgC: nil))
            // FIFO de proteção
            if records.count > VEHICLE_CTX_VMIN_PER_SEGMENT_MAX {
                records.removeFirst()
            }
            vminBySegmentLap[event.segmentId] = records
        }
    }

    /// Snapshot do contexto evolutivo.
    public func currentContext() -> VehicleContext {
        let currentLap = LapWindow(
            lapNumero: lapNumero,
            samplesCount: lapSamplesCount,
            leanLoadSamples: lapLeanLoadSamples,
            waterTempStart: lapWaterTempStart,
            waterTempEnd: lapWaterTempEnd,
            iatStart: lapIatStart,
            iatEnd: lapIatEnd,
            accelLongMax: lapAccelLongMax,
            rpmMax: lapRpmMax
        )
        let stint = StintWindow(
            lapHistory: lapHistory,
            bestLapMs: bestLapMs,
            lastNLapTimesMs: lapTimesMs,
            waterTempSeries: waterTempSeries,
            vminBySegmentLap: vminBySegmentLap
        )
        return VehicleContext(
            lastSnapshotTMono: lastSnapshotTMono,
            lap: currentLap,
            stint: stint,
            lastSegment: lastSegment,
            thermalPhase: thermalPhase,
            snapshotsConsumed: snapshotsConsumed
        )
    }

    /// Taxa de drift do water_temp (°C/minuto) calculada sobre `waterTempSeries`.
    /// Retorna nil se < 2 pontos ou janela < 30 s. Positivo = aquecendo;
    /// negativo = resfriando.
    public func waterTempDriftPerMinute() -> Double? {
        if waterTempSeries.count < 2 { return nil }
        guard let first = waterTempSeries.first, let last = waterTempSeries.last else {
            return nil
        }
        let windowMs = last.tMono - first.tMono
        if windowMs < 30_000 { return nil }
        let dT = last.tempC - first.tempC
        let minutes = windowMs / 60_000
        return dT / minutes
    }

    /// Trend de Vmin nos últimos N laps por trecho. Retorna
    /// `[segmentId: deltaPerLapKmh]` — negativo significa Vmin caindo.
    public func vminTrend(lastNLaps: Int = 3) -> [String: Double] {
        var out: [String: Double] = [:]
        for (seg, records) in vminBySegmentLap {
            let last = records.suffix(lastNLaps)
            if last.count < lastNLaps { continue }
            let pairs = Array(last)
            // Trend = (último - primeiro) / (N-1) — métrica simples
            let delta = pairs.last!.vminKmh - pairs.first!.vminKmh
            let perLap = delta / Double(lastNLaps - 1)
            out[seg] = perLap
        }
        return out
    }

    /// Limpa estado — útil em testes e na transição stint→stint.
    public func reset() {
        snapshotsConsumed = 0
        lastSnapshotTMono = nil
        lapNumero = nil
        lapSamplesCount = 0
        lapLeanLoadSamples = 0
        lapWaterTempStart = nil
        lapWaterTempEnd = nil
        lapIatStart = nil
        lapIatEnd = nil
        lapIatSum = 0
        lapIatCount = 0
        lapAccelLongMax = nil
        lapRpmMax = nil
        lapHistory.removeAll()
        lapTimesMs.removeAll()
        bestLapMs = nil
        waterTempSeries.removeAll()
        vminBySegmentLap.removeAll()
        lastSegment = nil
        thermalPhase = .cold
        lastWaterTempSampleForCooling = nil
        lastWaterTempTMonoForCooling = nil
    }

    // ── Privado: state machine térmica ─────────────────────────

    private func updateThermalPhase(currentTemp: Double, tMono: Double) {
        // Detecta cooling se queda > 3°C/min sustentada
        var cooling = false
        if let prevT = lastWaterTempSampleForCooling,
           let prevTMono = lastWaterTempTMonoForCooling {
            let windowMs = tMono - prevTMono
            if windowMs > 30_000 {
                let rate = (currentTemp - prevT) / (windowMs / 60_000)
                if rate < -3.0 { cooling = true }
                // Atualiza marcador a cada 30s
                lastWaterTempSampleForCooling = currentTemp
                lastWaterTempTMonoForCooling = tMono
            }
        } else {
            lastWaterTempSampleForCooling = currentTemp
            lastWaterTempTMonoForCooling = tMono
        }

        if cooling {
            thermalPhase = .cooling
        } else if currentTemp > 105 {
            thermalPhase = .overheat
        } else if currentTemp > 95 {
            thermalPhase = .atTemp
        } else if currentTemp > 60 {
            thermalPhase = .warming
        } else {
            thermalPhase = .cold
        }
    }
}
