// ═══════════════════════════════════════════════════════════
// VminProgressiveLossSegmentRule — MS-16.3 (rule #3 do MVP)
// ═══════════════════════════════════════════════════════════
// docs/COMMAND_BOX_ENGENHARIA.md §5.1 catálogo Camada 2.
//
// Dispara quando: Vmin de um trecho cai progressivamente > 1 km/h por
// volta em ≥3 voltas consecutivas (sinal de degradação — pneu/composto
// ou térmica). Sem evidência forte pra causa única — recomendação é
// "investigar pneu/composto + correlacionar com IAT".
//
// Princípio §"setup nunca antes de excluir pilotagem" — antes de
// recomendar mexer no carro, sugere conferir se piloto está mantendo
// linha consistente no trecho (consultando ApexClassification).
// Aqui apenas alertamos a tendência e propomos investigação.

import Foundation

public struct VminProgressiveLossSegmentRule: CalibrationRule {
    public let id = "vmin-progressive-loss-segment"
    public let cooldownMs: Double

    /// Mínimo de voltas consecutivas analisadas pra disparar.
    public let minConsecutiveLaps: Int
    /// Queda mínima de Vmin por volta (km/h) pra contar como progressivo.
    public let minDropPerLapKmh: Double

    public init(
        cooldownMs: Double = 90_000,
        minConsecutiveLaps: Int = 3,
        minDropPerLapKmh: Double = 1.0
    ) {
        self.cooldownMs = cooldownMs
        self.minConsecutiveLaps = minConsecutiveLaps
        self.minDropPerLapKmh = minDropPerLapKmh
    }

    public func evaluate(context: VehicleContext, now: () -> Double) -> EngineeringFinding? {
        // Procura o trecho com a maior queda absoluta atendendo critério.
        var worstSegment: String?
        var worstDeltaPerLap: Double = 0
        var worstStreak: [SegmentVminRecord] = []

        for (segmentId, records) in context.stint.vminBySegmentLap {
            if records.count < minConsecutiveLaps { continue }
            let recent = Array(records.suffix(minConsecutiveLaps))
            // Verifica que cada volta tem Vmin estritamente menor que a anterior
            var monotonic = true
            for i in 1..<recent.count {
                if recent[i].vminKmh >= recent[i - 1].vminKmh {
                    monotonic = false
                    break
                }
            }
            if !monotonic { continue }

            let delta = recent.last!.vminKmh - recent.first!.vminKmh
            let perLap = delta / Double(recent.count - 1)
            // perLap é negativo (queda); critério é > 1 km/h por volta de queda
            if perLap > -minDropPerLapKmh { continue }

            if abs(perLap) > abs(worstDeltaPerLap) {
                worstDeltaPerLap = perLap
                worstSegment = segmentId
                worstStreak = recent
            }
        }

        guard let segmentId = worstSegment else { return nil }

        let firstVmin = worstStreak.first!.vminKmh
        let lastVmin = worstStreak.last!.vminKmh
        let lastLap = worstStreak.last!.lapNumero

        // Confiança alta se queda > 1.5 km/h/volta sustentada; média se ~1.
        let confianca: FindingConfianca =
            abs(worstDeltaPerLap) > 1.5 ? .alta : .media

        return EngineeringFinding(
            id: newFindingId(),
            ruleId: id,
            severidade: .atencao,
            titulo: "Vmin caindo progressivamente no trecho \(segmentId)",
            descricao: "Vmin caiu de \(String(format: "%.1f", firstVmin)) km/h pra " +
                       "\(String(format: "%.1f", lastVmin)) km/h em " +
                       "\(worstStreak.count) voltas consecutivas " +
                       "(\(String(format: "%.2f", worstDeltaPerLap)) km/h/volta). " +
                       "Possível degradação de pneu / composto / térmica.",
            escopo: .segment,
            segmentId: segmentId,
            lapNumero: lastLap,
            evidencia: [
                "vmin_inicial_kmh": firstVmin,
                "vmin_final_kmh": lastVmin,
                "delta_por_volta_kmh": worstDeltaPerLap,
                "voltas_consecutivas": Double(worstStreak.count),
            ],
            evidenciaTexto: worstStreak.map { rec in
                "v\(rec.lapNumero): Vmin \(String(format: "%.1f", rec.vminKmh)) km/h" +
                (rec.iatAvgC.map { " · IAT \(String(format: "%.1f", $0)) °C" } ?? "")
            },
            confianca: confianca,
            t: Int64(Date().timeIntervalSince1970 * 1000),
            tMono: now()
        )
    }

    public func proposeRecommendation(
        from finding: EngineeringFinding,
        context: VehicleContext
    ) -> EngineeringRecommendation? {
        let delta = finding.evidencia["delta_por_volta_kmh"] ?? 0
        let segmentId = finding.segmentId ?? "—"

        return EngineeringRecommendation(
            id: newRecommendationId(),
            findingIds: [finding.id],
            ruleId: id,
            titulo: "Investigar degradação no trecho \(segmentId)",
            racional: "Queda sustentada de \(String(format: "%.2f", abs(delta))) km/h por " +
                      "volta no Vmin. Antes de mexer no setup, conferir se piloto " +
                      "manteve linha (apex classificação) e cruzar com IAT/temperatura " +
                      "motor pra distinguir degradação de pneu × térmica.",
            prioridade: "trecho \(segmentId)",
            ajustes: [
                Ajuste(
                    campo: "investigação",
                    de: "—",
                    para: "rever ApexClassification + IAT + composto pneu",
                    motivo: "Vmin caindo \(String(format: "%.2f", abs(delta))) km/h/volta",
                    risco: "Mexer setup sem excluir pilotagem é prematuro"
                ),
            ],
            naoMexer: [
                "pressão de pneu (sem evidência de drift de aderência específico)",
                "geometria (mesmo motivo)",
            ],
            comoValidar: "Próximo stint, mesmo trecho — se piloto repete linha e " +
                         "Vmin volta a estabilizar, problema era pneu/térmica. " +
                         "Se continua caindo, escalar pra inspeção mecânica.",
            confianca: finding.confianca,
            risco: .baixo,
            evidencia: finding.evidenciaTexto,
            t: finding.t,
            tMono: finding.tMono
        )
    }
}
