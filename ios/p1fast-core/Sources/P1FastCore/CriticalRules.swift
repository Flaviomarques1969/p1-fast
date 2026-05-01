// ═══════════════════════════════════════════════════════════
// CriticalRules — port do motor determinístico de alertas críticos
// ═══════════════════════════════════════════════════════════
// Port de src/pipeline/critical-rules.js.
// docs/raceops/ALERT_HIERARCHY.md governa.
//
// REGRAS NÃO NEGOCIÁVEIS (ALERT_HIERARCHY §"Regras críticas"):
//  1. CRÍTICO e BOX_AGORA são DETERMINÍSTICOS. Nunca IA.
//  2. CRÍTICO e BOX_AGORA NUNCA são silenciados por filtro.
//  3. Toda regra crítica é cadastrada explicitamente em código.
//  4. Toda regra crítica tem teste automatizado.
//  5. CRÍTICO precisa Quality.OK no canal (DATA_QUALITY Regra 4).

import Foundation

public enum AlertLevel: String, Codable, Sendable, CaseIterable {
    case informativo = "INFORMATIVO"
    case atencao = "ATENCAO"
    case critico = "CRITICO"
    case boxAgora = "BOX_AGORA"
}

public struct Alert: Codable, Sendable, Equatable {
    public let id: String
    public let nivel: AlertLevel
    public let descricao: String
    public let causaProvavel: String
    public let acaoImediata: String
    public let quemAge: String         // "piloto" | "engenheiro"
    public let urgencia: String
    public let confianca: String       // "Alta" garantida em CRÍTICO/BOX_AGORA
    public let canais: [String]
    public let regra: String
    public let t: Int64
    public let tMono: Double
}

/// Engine determinística — caller alimenta snapshots; engine emite alertas.
public final class CriticalRulesEngine {
    public typealias OnAlert = (Alert) -> Void

    private var onAlert: OnAlert?
    private var lastFiredAt: [String: Double] = [:]
    private var poorStartedAt: [String: Double] = [:]   // contexto p/ regras com janela

    public init(onAlert: OnAlert? = nil) {
        self.onAlert = onAlert
    }

    public func reset() {
        lastFiredAt.removeAll()
        poorStartedAt.removeAll()
    }

    public func consume(_ snap: Snapshot) {
        if snap.tMono <= 0 { return }
        for rule in CRITICAL_RULES {
            evaluateRule(rule, snap: snap)
        }
    }

    /// Dispara alerta manual (botão Box).
    public func fireManual(id: String) {
        guard let rule = MANUAL_RULES.first(where: { $0.id == id }) else { return }
        let t = Clock.now
        let tMono = Clock.nowMono
        emit(Alert(
            id: rule.id,
            nivel: rule.nivel,
            descricao: rule.descricao,
            causaProvavel: rule.causaProvavel,
            acaoImediata: rule.acaoImediata,
            quemAge: rule.quemAge,
            urgencia: rule.urgencia,
            confianca: "Alta",
            canais: ["manual"],
            regra: rule.id,
            t: t, tMono: tMono
        ))
    }

    private func evaluateRule(_ rule: CriticalRule, snap: Snapshot) {
        guard let nivel = rule.evaluate(snap, &poorStartedAt) else { return }
        if let last = lastFiredAt[rule.id], snap.tMono - last < rule.cooldownMs {
            return
        }
        lastFiredAt[rule.id] = snap.tMono
        emit(Alert(
            id: rule.id,
            nivel: nivel,
            descricao: rule.descricao,
            causaProvavel: rule.causaProvavel,
            acaoImediata: rule.acaoImediata,
            quemAge: rule.quemAge,
            urgencia: rule.urgencia,
            confianca: "Alta",
            canais: [rule.canal],
            regra: rule.id,
            t: snap.t, tMono: snap.tMono
        ))
    }

    private func emit(_ alert: Alert) {
        // Validação dos 7 campos obrigatórios — ALERT_HIERARCHY §"Estrutura obrigatória"
        let mandatoryNonEmpty: [String] = [
            alert.descricao, alert.causaProvavel, alert.acaoImediata,
            alert.quemAge, alert.urgencia, alert.confianca,
        ]
        if mandatoryNonEmpty.contains("") { return }
        // CRÍTICO/BOX_AGORA exigem confiança Alta — reprovação automática
        if (alert.nivel == .critico || alert.nivel == .boxAgora) && alert.confianca != "Alta" { return }
        onAlert?(alert)
    }
}

// ── Regra catalogada ────────────────────────────────────────
public struct CriticalRule {
    public let id: String
    public let canal: String
    public let descricao: String
    public let cooldownMs: Double
    public let quemAge: String
    public let urgencia: String
    public let causaProvavel: String
    public let acaoImediata: String
    /// Avaliador. Retorna o nível a disparar, ou nil se a regra não aplica neste snap.
    public let evaluate: (_ snap: Snapshot, _ ctx: inout [String: Double]) -> AlertLevel?
}

public struct ManualRule {
    public let id: String
    public let nivel: AlertLevel
    public let descricao: String
    public let causaProvavel: String
    public let acaoImediata: String
    public let quemAge: String
    public let urgencia: String
}

// ── Catálogo determinístico ─────────────────────────────────
public let CRITICAL_RULES: [CriticalRule] = [
    // Pressão óleo baixa
    CriticalRule(
        id: "press-oleo-baixa",
        canal: "engine.oil_pressure",
        descricao: "Pressão óleo abaixo do limite seguro",
        cooldownMs: 10_000,
        quemAge: "piloto",
        urgencia: "agora — abortar volta se necessário",
        causaProvavel: "Vazamento ou falha de bomba",
        acaoImediata: "Box agora — não completar volta",
        evaluate: { snap, _ in
            guard let p = snap.engine.oilPressure, let rpm = snap.engine.rpm else { return nil }
            if snap.quality.t4000 != .ok { return nil }
            if rpm > 1000 && p < 1.0 { return .boxAgora }
            return nil
        }
    ),
    // Temperatura motor extrema
    CriticalRule(
        id: "temp-motor-extrema",
        canal: "engine.water_temp",
        descricao: "Temperatura motor extrema",
        cooldownMs: 30_000,
        quemAge: "piloto",
        urgencia: "agora",
        causaProvavel: "Falha de arrefecimento ou desligamento de ventoinha",
        acaoImediata: "Reduzir ritmo, voltar ao box no fim desta volta",
        evaluate: { snap, _ in
            guard let t = snap.engine.waterTemp else { return nil }
            if snap.quality.t4000 != .ok { return nil }
            if t > 115 { return .boxAgora }
            if t > 105 { return .critico }
            if t > 100 { return .atencao }
            return nil
        }
    ),
    // Bateria baixa
    CriticalRule(
        id: "bateria-baixa",
        canal: "engine.battery_voltage",
        descricao: "Tensão bateria baixa",
        cooldownMs: 30_000,
        quemAge: "piloto",
        urgencia: "próximo trecho",
        causaProvavel: "Alternador falhando ou correia",
        acaoImediata: "Reduzir consumo (luzes/ventiladores), voltar pro box",
        evaluate: { snap, _ in
            guard let v = snap.engine.batteryVoltage, let rpm = snap.engine.rpm else { return nil }
            if snap.quality.t4000 != .ok { return nil }
            if rpm < 1500 { return nil }
            if v < 10.5 { return .critico }
            if v < 11.5 { return .atencao }
            return nil
        }
    ),
]

public let MANUAL_RULES: [ManualRule] = [
    ManualRule(
        id: "bandeira-vermelha",
        nivel: .boxAgora,
        descricao: "Bandeira vermelha",
        causaProvavel: "Acidente / interrupção do treino",
        acaoImediata: "Voltar ao box imediatamente",
        quemAge: "piloto",
        urgencia: "agora"
    ),
    ManualRule(
        id: "bandeira-amarela",
        nivel: .atencao,
        descricao: "Bandeira amarela",
        causaProvavel: "Carro/objeto na pista",
        acaoImediata: "Reduzir ritmo, sem ultrapassagens",
        quemAge: "piloto",
        urgencia: "agora"
    ),
    ManualRule(
        id: "pista-molhada",
        nivel: .atencao,
        descricao: "Pista molhada",
        causaProvavel: "Chuva ou óleo",
        acaoImediata: "Reduzir ritmo, calibrar entrada",
        quemAge: "piloto",
        urgencia: "agora"
    ),
]
