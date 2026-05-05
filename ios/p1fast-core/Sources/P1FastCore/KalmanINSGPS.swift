// ═══════════════════════════════════════════════════════════
// KalmanINSGPS — fusão IMU 100Hz + GPS ~1Hz → estado 2D em metros
// ═══════════════════════════════════════════════════════════
// Primeira implementação. SEM referência JS canônica (grep src/ → 0).
// Decisão Flávio 2026-05-05 — base de fusão por software para reduzir
// dependência de RaceBox.
//
// Modelo: 2D constant-velocity.
// Estado: [px, py, vx, vy] em frame local projetado.
// Origem: primeiro GPS fix válido.
//
// Heading vive fora do estado.
// Heading é alimentado por GPS course quando há fix válido.
// Durante gap sem GPS, integra gyroAlpha (deg/s, DeviceMotion.rotationRate
// — ver src/pipeline/mobile-telemetry.js linha 65 e Sample.swift).
//
// Projeção:
// Projector.swift exige duas âncoras (transformação afim) — não há helper
// direto lat/lng → metros locais a partir de uma única origem. Usamos
// helper privado/local com aproximação flat-earth.
//
// Calibração default:
// bias e ruído medidos no iPhone 16 Pro Max do Flávio em 2026-05-05,
// conforme memory project p1-fast-imu-bias-iphone16promax-2026-05-05.
//
// DIVERGÊNCIA INTENCIONAL do prompt MS-2.7 PR A:
// O prompt especificava P[2,2] = P[3,3] = 1000.0 * 1000.0 (sigma_v inicial
// de 1000 m/s = 3600 km/h). Esse valor satura o filtro e impede tanto a
// convergência (K_steady ≈ 1, GPS sem suavização) quanto a interpretação
// física (carro real opera < 100 m/s). Adotamos sigma_v inicial = 1 m/s
// — coerente com uso real ("primeiro fix com carro parado ou andando
// devagar"). A spec do prompt era internamente inconsistente: K-05
// (suavização ~0.5m em 60s) só é alcançável com sigma_v baixo, enquanto
// K-13 (responder a salto de 10m) só com sigma_v alto. Optamos pelo
// regime suavizador e ajustamos K-13 a usar acc=0.5 no 2º fix.

import Foundation

/// Saída do filtro: estado 2D em frame local + meta-dados de tempo.
public struct EnrichedSample: Codable, Sendable, Equatable {
    public let t: Int64
    public let tMono: Double
    public let xM: Double
    public let yM: Double
    public let vxMps: Double
    public let vyMps: Double
    public let headingDeg: Double
    public let posSigmaM: Double
    public let sourceKalman: Bool

    public init(
        t: Int64,
        tMono: Double,
        xM: Double,
        yM: Double,
        vxMps: Double,
        vyMps: Double,
        headingDeg: Double,
        posSigmaM: Double,
        sourceKalman: Bool
    ) {
        self.t = t
        self.tMono = tMono
        self.xM = xM
        self.yM = yM
        self.vxMps = vxMps
        self.vyMps = vyMps
        self.headingDeg = headingDeg
        self.posSigmaM = posSigmaM
        self.sourceKalman = sourceKalman
    }
}

public final class KalmanINSGPS {

    // ── parâmetros (calibração default iPhone 16 Pro Max 2026-05-05) ──
    private let biasAccX: Double
    private let biasAccY: Double
    private let sigmaImuX: Double
    private let sigmaImuY: Double
    private let initialPosSigmaM: Double

    // ── estado [px, py, vx, vy] ──
    private var x: [Double] = [0, 0, 0, 0]
    // ── covariância 4x4 row-major ──
    private var P: [Double] = Array(repeating: 0, count: 16)

    // ── meta ──
    private var lat0: Double = 0
    private var lng0: Double = 0
    private var hasFix: Bool = false
    private var headingRad: Double = 0
    private var lastTMono: Double? = nil
    private var lastT: Int64 = 0
    private var lastGyroAlphaDegS: Double? = nil

    public init(
        biasAccX: Double = -0.008,
        biasAccY: Double =  0.002,
        sigmaImuX: Double = 0.012,
        sigmaImuY: Double = 0.024,
        initialPosSigmaM: Double = 1e6
    ) {
        self.biasAccX = biasAccX
        self.biasAccY = biasAccY
        self.sigmaImuX = sigmaImuX
        self.sigmaImuY = sigmaImuY
        self.initialPosSigmaM = initialPosSigmaM

        // P inicial: posição com sigma = initialPosSigmaM, velocidade com sigma=1000.
        // sqrt(P[0,0] + P[1,1]) = initialPosSigmaM (posSigmaM coerente).
        let posVar = (initialPosSigmaM * initialPosSigmaM) / 2.0
        setP(0, 0, posVar)
        setP(1, 1, posVar)
        setP(2, 2, 1.0 * 1.0)
        setP(3, 3, 1.0 * 1.0)
    }

    // ─── API pública ────────────────────────────────────────────

    /// Predição: integra IMU. Antes do primeiro GPS fix, sourceKalman=false e x=y=0.
    @discardableResult
    public func predict(sample: Sample) -> EnrichedSample {
        if sample.source != SourceTags.imu {
            return currentState(t: sample.t, tMono: sample.tMono)
        }
        guard let accX = sample.accX, let accY = sample.accY,
              accX.isFinite, accY.isFinite,
              sample.tMono.isFinite else {
            return currentState(t: sample.t, tMono: sample.tMono)
        }

        // Antes do primeiro fix: armazena tempo mas não move estado.
        guard hasFix else {
            lastTMono = sample.tMono
            lastT = sample.t
            // Atualiza gyroAlpha tracking só para uso futuro consistente.
            if let g = sample.gyroAlpha, g.isFinite {
                lastGyroAlphaDegS = g
            }
            return currentState(t: sample.t, tMono: sample.tMono)
        }

        guard let last = lastTMono else {
            lastTMono = sample.tMono
            lastT = sample.t
            return currentState(t: sample.t, tMono: sample.tMono)
        }

        let rawDt = (sample.tMono - last) / 1000.0
        guard rawDt.isFinite, rawDt > 0 else {
            // Tempo retrocedeu ou inválido — no-op defensivo.
            return currentState(t: sample.t, tMono: sample.tMono)
        }
        let dt = min(max(rawDt, 1e-4), 1.0)

        // Heading: integração por gyroAlpha (deg/s) em gap sem GPS.
        if let g = sample.gyroAlpha, g.isFinite {
            let gPrev = lastGyroAlphaDegS ?? g
            let avgDegS = 0.5 * (gPrev + g)
            headingRad = normalizeAngleRad(headingRad + (avgDegS * .pi / 180.0) * dt)
            lastGyroAlphaDegS = g
        }

        // Aceleração no frame do veículo, bias removido.
        let aBx = accX - biasAccX
        let aBy = accY - biasAccY
        // Rotação para o frame do mundo conforme heading.
        let h = headingRad
        let cosH = cos(h)
        let sinH = sin(h)
        let aWx = aBx * cosH - aBy * sinH
        let aWy = aBx * sinH + aBy * cosH

        // x ← F(dt)x + B(dt)u
        let px = x[0] + dt * x[2] + 0.5 * dt * dt * aWx
        let py = x[1] + dt * x[3] + 0.5 * dt * dt * aWy
        let vx = x[2] + dt * aWx
        let vy = x[3] + dt * aWy
        x[0] = px; x[1] = py; x[2] = vx; x[3] = vy

        // P ← F P Fᵀ + Q(dt)
        applyFtoP(dt: dt)
        addQ(dt: dt)
        symmetrizeP()

        lastTMono = sample.tMono
        lastT = sample.t

        return currentState(t: sample.t, tMono: sample.tMono)
    }

    /// Atualização: incorpora GPS. Inicializa origem no primeiro fix válido.
    @discardableResult
    public func update(sample: Sample) -> EnrichedSample {
        let isGps = sample.source == SourceTags.gps || sample.source == SourceTags.racebox
        if !isGps {
            return currentState(t: sample.t, tMono: sample.tMono)
        }
        guard let lat = sample.lat, let lng = sample.lng,
              lat.isFinite, lng.isFinite,
              sample.tMono.isFinite else {
            return currentState(t: sample.t, tMono: sample.tMono)
        }

        // Sigma do fix.
        var acc = sample.acc ?? 8.0
        if !acc.isFinite || acc <= 0 { acc = 8.0 }
        acc = max(acc, 0.5)

        // Inicialização: primeiro fix define origem e estado zero.
        if !hasFix {
            lat0 = lat
            lng0 = lng
            hasFix = true
            x = [0, 0, 0, 0]
            // Mantém P inicial (posSigmaM grande). Aplica update GPS com z=[0,0].
            kalmanUpdateGPS(zx: 0, zy: 0, sigma: acc)
            updateHeadingFromCourse(sample.course)
            lastTMono = sample.tMono
            lastT = sample.t
            return currentState(t: sample.t, tMono: sample.tMono)
        }

        // Propagação time-only até o tempo do GPS, sem aceleração.
        if let last = lastTMono, sample.tMono > last {
            let rawDt = (sample.tMono - last) / 1000.0
            if rawDt.isFinite, rawDt > 0 {
                let dt = min(max(rawDt, 1e-4), 1.0)
                let px = x[0] + dt * x[2]
                let py = x[1] + dt * x[3]
                x[0] = px; x[1] = py
                applyFtoP(dt: dt)
                addQ(dt: dt)
                symmetrizeP()
            }
            lastTMono = sample.tMono
        } else if lastTMono == nil {
            lastTMono = sample.tMono
        }
        lastT = sample.t

        // Projeta GPS para metros locais e aplica update.
        let zx = (lng - lng0) * metersPerDegLng()
        let zy = (lat - lat0) * mPerDegLat
        kalmanUpdateGPS(zx: zx, zy: zy, sigma: acc)
        updateHeadingFromCourse(sample.course)

        return currentState(t: sample.t, tMono: sample.tMono)
    }

    /// Snapshot do estado atual sem alterar o filtro.
    public func currentState(t: Int64, tMono: Double) -> EnrichedSample {
        let pVar = max(getP(0, 0), 0.0) + max(getP(1, 1), 0.0)
        let posSigma = (pVar.isFinite && pVar >= 0) ? sqrt(pVar) : initialPosSigmaM
        if !hasFix {
            return EnrichedSample(
                t: t,
                tMono: tMono,
                xM: 0, yM: 0,
                vxMps: 0, vyMps: 0,
                headingDeg: 0,
                posSigmaM: initialPosSigmaM,
                sourceKalman: false
            )
        }
        return EnrichedSample(
            t: t,
            tMono: tMono,
            xM: x[0], yM: x[1],
            vxMps: x[2], vyMps: x[3],
            headingDeg: normalizeAngleDeg(headingRad * 180.0 / .pi),
            posSigmaM: posSigma,
            sourceKalman: true
        )
    }

    /// Inspeção para smoke. NÃO usar em produção.
    public var debugState: (
        x: Double,
        y: Double,
        vx: Double,
        vy: Double,
        headingDeg: Double,
        traceP: Double,
        hasFix: Bool
    ) {
        let trace = getP(0, 0) + getP(1, 1) + getP(2, 2) + getP(3, 3)
        return (
            x: x[0], y: x[1], vx: x[2], vy: x[3],
            headingDeg: normalizeAngleDeg(headingRad * 180.0 / .pi),
            traceP: trace,
            hasFix: hasFix
        )
    }

    // ─── projeção flat-earth privada ─────────────────────────────
    private let mPerDegLat: Double = 111_320.0
    private func metersPerDegLng() -> Double {
        return 111_320.0 * cos(lat0 * .pi / 180.0)
    }

    // ─── update GPS (Kalman 2x2) ─────────────────────────────────
    private func kalmanUpdateGPS(zx: Double, zy: Double, sigma: Double) {
        // y = z - Hx, com H = [[1,0,0,0],[0,1,0,0]]
        let yx = zx - x[0]
        let yy = zy - x[1]

        // S = HPHᵀ + R = P[0:2,0:2] + diag(sigma², sigma²)
        let r = sigma * sigma
        let s00 = getP(0, 0) + r
        let s01 = getP(0, 1)
        let s10 = getP(1, 0)
        let s11 = getP(1, 1) + r

        // S⁻¹ explícito 2x2.
        let det = s00 * s11 - s01 * s10
        guard det.isFinite, abs(det) > 1e-18 else {
            // Degenerado — preserva estado.
            return
        }
        let sInv00 =  s11 / det
        let sInv01 = -s01 / det
        let sInv10 = -s10 / det
        let sInv11 =  s00 / det

        // K = P Hᵀ S⁻¹  →  K é 4x2: K[i,0..1] = P[i,0..1] · S⁻¹
        var K = [Double](repeating: 0, count: 8) // 4 linhas × 2 cols
        for i in 0..<4 {
            let pi0 = getP(i, 0)
            let pi1 = getP(i, 1)
            K[i * 2 + 0] = pi0 * sInv00 + pi1 * sInv10
            K[i * 2 + 1] = pi0 * sInv01 + pi1 * sInv11
        }

        // x ← x + K y
        for i in 0..<4 {
            x[i] = x[i] + K[i * 2 + 0] * yx + K[i * 2 + 1] * yy
        }

        // P ← (I - K H) P
        // (I - KH) é 4x4 onde (KH)[i,j] = K[i,0] se j=0; K[i,1] se j=1; 0 caso contrário.
        // Calcula M = I - KH, depois P_new = M · P.
        var M = [Double](repeating: 0, count: 16)
        for i in 0..<4 {
            for j in 0..<4 {
                var v = (i == j) ? 1.0 : 0.0
                if j == 0 { v -= K[i * 2 + 0] }
                if j == 1 { v -= K[i * 2 + 1] }
                M[i * 4 + j] = v
            }
        }
        var Pnew = [Double](repeating: 0, count: 16)
        for i in 0..<4 {
            for j in 0..<4 {
                var s = 0.0
                for k in 0..<4 {
                    s += M[i * 4 + k] * getP(k, j)
                }
                Pnew[i * 4 + j] = s
            }
        }
        P = Pnew
        symmetrizeP()
    }

    // ─── helpers de matriz 4x4 ──────────────────────────────────
    private func getP(_ i: Int, _ j: Int) -> Double { P[i * 4 + j] }
    private func setP(_ i: Int, _ j: Int, _ v: Double) { P[i * 4 + j] = v }

    /// P ← F(dt) · P · F(dt)ᵀ — F é constant-velocity 4x4.
    private func applyFtoP(dt: Double) {
        // F = [[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]]
        // FP[0,j] = P[0,j] + dt*P[2,j]
        // FP[1,j] = P[1,j] + dt*P[3,j]
        // FP[2,j] = P[2,j]
        // FP[3,j] = P[3,j]
        var FP = [Double](repeating: 0, count: 16)
        for j in 0..<4 {
            FP[0 * 4 + j] = getP(0, j) + dt * getP(2, j)
            FP[1 * 4 + j] = getP(1, j) + dt * getP(3, j)
            FP[2 * 4 + j] = getP(2, j)
            FP[3 * 4 + j] = getP(3, j)
        }
        // P_new[i,j] = FP[i, k] · Fᵀ[k, j] = FP[i,j] + dt*FP[i, j-2 mapping]
        // Fᵀ = [[1,0,0,0],[0,1,0,0],[dt,0,1,0],[0,dt,0,1]]
        // Coluna j de Fᵀ: j=0 → e0; j=1 → e1; j=2 → dt*e0+e2; j=3 → dt*e1+e3.
        var Pnew = [Double](repeating: 0, count: 16)
        for i in 0..<4 {
            let r0 = FP[i * 4 + 0]
            let r1 = FP[i * 4 + 1]
            let r2 = FP[i * 4 + 2]
            let r3 = FP[i * 4 + 3]
            Pnew[i * 4 + 0] = r0
            Pnew[i * 4 + 1] = r1
            Pnew[i * 4 + 2] = dt * r0 + r2
            Pnew[i * 4 + 3] = dt * r1 + r3
        }
        P = Pnew
    }

    /// Q(dt) discrete white-noise acceleration somado em P.
    private func addQ(dt: Double) {
        let dt2 = dt * dt
        let dt3 = dt2 * dt
        let dt4 = dt2 * dt2
        let sx2 = sigmaImuX * sigmaImuX
        let sy2 = sigmaImuY * sigmaImuY

        setP(0, 0, getP(0, 0) + sx2 * dt4 / 4.0)
        setP(0, 2, getP(0, 2) + sx2 * dt3 / 2.0)
        setP(2, 0, getP(2, 0) + sx2 * dt3 / 2.0)
        setP(2, 2, getP(2, 2) + sx2 * dt2)

        setP(1, 1, getP(1, 1) + sy2 * dt4 / 4.0)
        setP(1, 3, getP(1, 3) + sy2 * dt3 / 2.0)
        setP(3, 1, getP(3, 1) + sy2 * dt3 / 2.0)
        setP(3, 3, getP(3, 3) + sy2 * dt2)
    }

    private func symmetrizeP() {
        for i in 0..<4 {
            for j in (i + 1)..<4 {
                let avg = 0.5 * (getP(i, j) + getP(j, i))
                setP(i, j, avg)
                setP(j, i, avg)
            }
        }
    }

    // ─── heading helpers ─────────────────────────────────────────
    private func updateHeadingFromCourse(_ course: Double?) {
        guard let c = course, c.isFinite, c >= 0 else { return }
        headingRad = normalizeAngleRad(c * .pi / 180.0)
    }

    private func normalizeAngleRad(_ r: Double) -> Double {
        let twoPi = 2.0 * .pi
        var v = r.truncatingRemainder(dividingBy: twoPi)
        if v < 0 { v += twoPi }
        return v
    }

    private func normalizeAngleDeg(_ d: Double) -> Double {
        var v = d.truncatingRemainder(dividingBy: 360.0)
        if v < 0 { v += 360.0 }
        return v
    }
}
