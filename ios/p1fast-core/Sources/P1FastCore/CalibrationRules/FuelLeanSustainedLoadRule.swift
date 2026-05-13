// ═══════════════════════════════════════════════════════════
// FuelLeanSustainedLoadRule — MS-16.3 (rule #1 do MVP)
// ═══════════════════════════════════════════════════════════
// docs/COMMAND_BOX_ENGENHARIA.md §5.1 catálogo Camada 2.
//
// Dispara quando: λ > 1.0 sob TPS>70 + MAP>0.8 + RPM>4000 sustentado
// em ≥3 voltas consecutivas + ≥30 samples por volta. Quality.t4000=.ok
// é pré-requisito (gating no VehicleContextAggregator).
//
// Hipótese: mapa de combustível pobre na célula RPM × MAP correspondente.
// Risco médio (detonação se atrasar muito). Mexer só após confirmar
// piloto NÃO é causa via cross-check de comportamento (Diretor Técnico
// §"setup nunca antes de excluir pilotagem").
//
// Limites são DEFAULTS conservadores do Celta 1.4 — Flávio calibra em
// pista (NEEDS_CALIBRATION). Caller pode override via init.

import Foundation

public struct FuelLeanSustainedLoadRule: CalibrationRule {
    public let id = "fuel-lean-sustained-load"
    public let cooldownMs: Double

    /// Mínimo de samples consecutivos em estado lean por volta pra contar.
    public let minLeanSamplesPerLap: Int
    /// Mínimo de voltas consecutivas atendendo critério pra disparar.
    public let minConsecutiveLaps: Int
    /// Ajuste percentual proposto (default +4%, paridade com exemplo do doc).
    public let ajusteCombustivelPct: Double

    public init(
        cooldownMs: Double = 60_000,
        minLeanSamplesPerLap: Int = 30,
        minConsecutiveLaps: Int = 3,
        ajusteCombustivelPct: Double = 4.0
    ) {
        self.cooldownMs = cooldownMs
        self.minLeanSamplesPerLap = minLeanSamplesPerLap
        self.minConsecutiveLaps = minConsecutiveLaps
        self.ajusteCombustivelPct = ajusteCombustivelPct
    }

    public func evaluate(context: VehicleContext, now: () -> Double) -> EngineeringFinding? {
        let laps = context.stint.lapHistory
        if laps.count < minConsecutiveLaps { return nil }

        // Pega as últimas N voltas — todas devem atender o critério.
        let recent = laps.suffix(minConsecutiveLaps)
        let allLean = recent.allSatisfy { $0.leanLoadSamples >= minLeanSamplesPerLap }
        if !allLean { return nil }

        let leanCounts = recent.map { Double($0.leanLoadSamples) }
        let avgLean = leanCounts.reduce(0, +) / Double(leanCounts.count)
        let rpmMaxAvg: Double = {
            let rpms = recent.compactMap { $0.rpmMax }
            return rpms.isEmpty ? 0 : rpms.reduce(0, +) / Double(rpms.count)
        }()

        return EngineeringFinding(
            id: newFindingId(),
            ruleId: id,
            severidade: .atencao,
            titulo: "Mistura pobre sustentada sob carga",
            descricao: "λ acima de 1.0 sustentado em \(recent.count) voltas consecutivas " +
                       "(média \(Int(avgLean)) samples/volta atendendo critério TPS>70 + " +
                       "MAP>0.8 + RPM>4000). Indica mapa de combustível pobre na célula " +
                       "RPM~\(Int(rpmMaxAvg)) sob alta carga.",
            escopo: .stint,
            segmentId: nil,
            lapNumero: recent.last?.lapNumero,
            evidencia: [
                "voltas_consecutivas": Double(recent.count),
                "lean_samples_avg": avgLean,
                "rpm_max_avg": rpmMaxAvg,
            ],
            evidenciaTexto: [
                "λ > 1.0 em \(recent.count) voltas consecutivas",
                "TPS > 70%, MAP > 0.8 bar, RPM > 4000 (critério lean sob carga)",
                "Média \(Int(avgLean)) samples/volta atendendo critério",
            ],
            confianca: .alta,
            t: Int64(Date().timeIntervalSince1970 * 1000),
            tMono: now()
        )
    }

    public func proposeRecommendation(
        from finding: EngineeringFinding,
        context: VehicleContext
    ) -> EngineeringRecommendation? {
        let rpmAvg = finding.evidencia["rpm_max_avg"] ?? 0
        let rpmFaixa = "RPM \(Int(rpmAvg - 600))-\(Int(rpmAvg + 200))"

        return EngineeringRecommendation(
            id: newRecommendationId(),
            findingIds: [finding.id],
            ruleId: id,
            titulo: "Adicionar +\(Int(ajusteCombustivelPct))% combustível em alta carga",
            racional: "λ médio acima do alvo em alta carga sustentado por " +
                      "\(Int(finding.evidencia["voltas_consecutivas"] ?? 0)) voltas. " +
                      "Adicionar combustível na célula RPM × MAP correspondente reduz " +
                      "risco de detonação e melhora torque.",
            prioridade: rpmFaixa,
            ajustes: [
                Ajuste(
                    campo: "combustivel",
                    de: "0%",
                    para: "+\(Int(ajusteCombustivelPct))%",
                    motivo: "λ \(Int(ajusteCombustivelPct))% acima do alvo em alta carga",
                    risco: "Detonação se atrasar muito junto"
                ),
            ],
            naoMexer: [
                "ignição (sem evidência de avanço inadequado)",
                "pressão combustível (estável nesta janela)",
            ],
            comoValidar: "λ no mesmo trecho/RPM deve cair pra 0.90-0.95 no próximo stint. " +
                         "Acompanhar accel_long e temperatura motor.",
            confianca: .alta,
            risco: .medio,
            evidencia: finding.evidenciaTexto,
            t: finding.t,
            tMono: finding.tMono
        )
    }
}
