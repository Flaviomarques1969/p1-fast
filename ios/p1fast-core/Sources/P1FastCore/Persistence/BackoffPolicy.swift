// ═══════════════════════════════════════════════════════════
// BackoffPolicy — exponencial com jitter
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — usado por SyncDrainer e TelemetryUploader pra calcular
// "quanto tempo esperar antes da próxima tentativa" baseado em quantas
// já falharam. Design doc trava: 30s · 2min · 10min · dead-letter ≥5.
//
// Sem timer / Task aqui — só matemática. Quem agenda é o p1fast-ios
// (que tem Reachability + AppStateManager).

import Foundation

public struct BackoffPolicy: Equatable {
    /// Atrasos por número de tentativas (em segundos), índice = attempt-1.
    /// Default match com docs/SPRINT_1A6_SYNC_DRAINER_DESIGN.md:
    ///   attempt 1: imediato (0s)
    ///   attempt 2: 30s ± jitter
    ///   attempt 3: 2min ± jitter
    ///   attempts 4: 10min ± jitter
    ///   attempts ≥5: dead-letter (não retorna delay)
    public let baseDelaysSeconds: [Double]

    /// Jitter relativo (0.33 = ±33% do delay base).
    public let jitterRatio: Double

    public static let `default` = BackoffPolicy(
        baseDelaysSeconds: [0, 30, 120, 600],
        jitterRatio: 0.33
    )

    public init(baseDelaysSeconds: [Double], jitterRatio: Double) {
        self.baseDelaysSeconds = baseDelaysSeconds
        self.jitterRatio = jitterRatio
    }

    /// Calcula delay pra próxima tentativa. Retorna nil se atingiu dead-letter.
    /// - Parameters:
    ///   - attempts: quantas tentativas JÁ rodaram (0 = nenhuma ainda).
    ///   - rng: gerador de número aleatório (injetável pra testes determinísticos).
    public func nextDelay(attempts: Int, rng: () -> Double = { Double.random(in: 0...1) }) -> TimeInterval? {
        let idx = attempts
        guard idx >= 0, idx < baseDelaysSeconds.count else { return nil }
        let base = baseDelaysSeconds[idx]
        if base == 0 { return 0 }
        // Jitter: ±jitterRatio. rng() retorna [0,1), centro em 0.5.
        let jitter = (rng() - 0.5) * 2.0 * jitterRatio  // [-jitterRatio, +jitterRatio]
        let delay = base * (1.0 + jitter)
        return max(0, delay)
    }

    /// Conveniência: true se attempts já bateu o limite (dead-letter).
    public func isDeadLetter(attempts: Int) -> Bool {
        attempts >= baseDelaysSeconds.count
    }

    /// Quantas tentativas no total a policy permite.
    public var maxAttempts: Int { baseDelaysSeconds.count }
}
