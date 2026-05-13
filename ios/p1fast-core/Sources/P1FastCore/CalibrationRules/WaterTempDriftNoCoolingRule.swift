// ═══════════════════════════════════════════════════════════
// WaterTempDriftNoCoolingRule — MS-16.3 (rule #2 do MVP)
// ═══════════════════════════════════════════════════════════
// docs/COMMAND_BOX_ENGENHARIA.md §5.1 catálogo Camada 2.
// Paridade com CrossValidation V-005 (drift de temperatura água).
//
// Dispara quando: drift sustentado > 3°C/min na janela rolling 5 min
// (waterTempSeries do VehicleContextAggregator) E motor não está em
// padrão de carga alta (TPS>70 + MAP>0.8 + RPM>4000 dominando a lap
// corrente — mesmo critério da rule fuel-lean). Indica problema de
// arrefecimento (ventoinha, radiador, bomba) e NÃO sintoma de uso.
//
// Gate 1 — fase térmica .warming (motor ainda aquecendo da partida)
// nunca dispara: drift natural.
// Gate 2 — proporção `leanLoadSamples/samplesCount > 0.5` na lap
// corrente: motor passou a maior parte do tempo em alta carga, drift
// é atribuível a uso, não falha mecânica.
//
// Quality.t4000=.ok é pré-requisito (gating no VehicleContextAggregator).
//
// Risco: alto se ignorado (overheat → dano motor). Mas ajuste mecânico
// é fora do escopo digital — recomendação é "investigar arrefecimento".

import Foundation

public struct WaterTempDriftNoCoolingRule: CalibrationRule {
    public let id = "water-temp-drift-no-cooling"
    public let cooldownMs: Double

    /// Drift sustentado mínimo (°C/min) pra disparar.
    public let minDriftCPerMin: Double
    /// Janela mínima de tempo (ms) com drift sustentado — paridade V-005.
    public let minWindowMs: Double

    /// Razão `leanLoadSamples/samplesCount` que caracteriza lap dominada
    /// por alta carga (acima → drift é atribuível a uso, não falha mecânica).
    public let maxHighLoadRatio: Double

    public init(
        cooldownMs: Double = 120_000,
        minDriftCPerMin: Double = 3.0,
        minWindowMs: Double = 60_000,
        maxHighLoadRatio: Double = 0.5
    ) {
        self.cooldownMs = cooldownMs
        self.minDriftCPerMin = minDriftCPerMin
        self.minWindowMs = minWindowMs
        self.maxHighLoadRatio = maxHighLoadRatio
    }

    public func evaluate(context: VehicleContext, now: () -> Double) -> EngineeringFinding? {
        let series = context.stint.waterTempSeries
        if series.count < 2 { return nil }
        guard let first = series.first, let last = series.last else { return nil }

        let windowMs = last.tMono - first.tMono
        if windowMs < minWindowMs { return nil }

        let dT = last.tempC - first.tempC
        let driftPerMin = dT / (windowMs / 60_000)
        if driftPerMin < minDriftCPerMin { return nil }

        // Gate 1 — fase warming: motor ainda aquecendo da partida, drift natural.
        if context.thermalPhase == .warming { return nil }

        // Gate 2 — alta carga dominando a lap corrente → drift é uso, não falha.
        if context.lap.samplesCount > 0 {
            let highLoadRatio = Double(context.lap.leanLoadSamples) / Double(context.lap.samplesCount)
            if highLoadRatio > maxHighLoadRatio { return nil }
        }

        // Estado térmico mostrando atTemp ou overheat torna o achado
        // mais grave; warming inicial é benigno (motor aquecendo normal).
        let severidade: FindingSeveridade =
            (context.thermalPhase == .overheat) ? .alta :
            (context.thermalPhase == .atTemp) ? .atencao : .info

        // Confiança ata se a janela é > 2 min e drift é > 4°C/min
        let confianca: FindingConfianca
        if windowMs > 120_000 && driftPerMin > 4.0 {
            confianca = .alta
        } else if windowMs > 60_000 && driftPerMin > 3.0 {
            confianca = .media
        } else {
            confianca = .baixa
        }

        return EngineeringFinding(
            id: newFindingId(),
            ruleId: id,
            severidade: severidade,
            titulo: "Temperatura água subindo (\(String(format: "%.1f", driftPerMin)) °C/min)",
            descricao: "Drift de \(String(format: "%.1f", driftPerMin)) °C/min sustentado em " +
                       "\(Int(windowMs / 1000))s. Temp atual \(String(format: "%.1f", last.tempC)) °C. " +
                       "Fase térmica: \(context.thermalPhase.rawValue).",
            escopo: .stint,
            segmentId: nil,
            lapNumero: nil,
            evidencia: [
                "drift_c_per_min": driftPerMin,
                "window_ms": windowMs,
                "temp_inicial_c": first.tempC,
                "temp_final_c": last.tempC,
            ],
            evidenciaTexto: [
                "Drift \(String(format: "%.1f", driftPerMin)) °C/min em \(Int(windowMs / 1000))s",
                "Temp inicial \(String(format: "%.1f", first.tempC)) °C, atual \(String(format: "%.1f", last.tempC)) °C",
                "Fase térmica: \(context.thermalPhase.rawValue)",
            ],
            confianca: confianca,
            t: Int64(Date().timeIntervalSince1970 * 1000),
            tMono: now()
        )
    }

    public func proposeRecommendation(
        from finding: EngineeringFinding,
        context: VehicleContext
    ) -> EngineeringRecommendation? {
        let drift = finding.evidencia["drift_c_per_min"] ?? 0
        let tempFinal = finding.evidencia["temp_final_c"] ?? 0

        return EngineeringRecommendation(
            id: newRecommendationId(),
            findingIds: [finding.id],
            ruleId: id,
            titulo: "Investigar sistema de arrefecimento",
            racional: "Drift sustentado de \(String(format: "%.1f", drift)) °C/min em " +
                      "padrão NÃO ligado a carga sugere problema mecânico " +
                      "(ventoinha não acionando, baixo nível de fluido, ou bomba comprometida).",
            prioridade: "arrefecimento",
            ajustes: [
                Ajuste(
                    campo: "arrefecimento",
                    de: "—",
                    para: "inspeção",
                    motivo: "drift > \(String(format: "%.1f", drift)) °C/min em janela " +
                            "\(Int((finding.evidencia["window_ms"] ?? 0) / 1000))s",
                    risco: "Overheat → dano motor"
                ),
            ],
            naoMexer: [
                "mapa de combustível (sintoma é mecânico, não calibração)",
                "ponto de ignição (idem)",
            ],
            comoValidar: "Verificar ventoinha em bancada, nível de fluido, e bomba " +
                         "d'água. Próximo stint, mesmo padrão de carga, drift deve cair " +
                         "abaixo de 1°C/min. Temp atual: \(String(format: "%.1f", tempFinal)) °C.",
            confianca: finding.confianca,
            risco: .alto,
            evidencia: finding.evidenciaTexto,
            t: finding.t,
            tMono: finding.tMono
        )
    }
}
