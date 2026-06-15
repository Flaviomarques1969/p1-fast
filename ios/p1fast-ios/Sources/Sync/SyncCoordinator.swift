// ═══════════════════════════════════════════════════════════
// SyncCoordinator — orquestra os 3 drainers (sync + pull + telemetry)
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — Prompt #23. Acordado por:
//   - Timer fixo (sync 30s, pull 5min, telemetry 60s)
//   - Reachability change (offline → online dispara drain imediato)
//   - syncNow() manual (UI sub-prompt D vai chamar)
//
// Estado @Published consumido pela UI (SyncStatusBadge, SincronizacaoView
// — sub-prompt D / Prompt #24).
//
// V1: silencioso em erro (log + retry no próximo tick). UI traz feedback
// no Prompt #24. Quando Configuration.isConfigured == false, coordinator
// fica em status .offline e nunca dispara drains.

import Foundation
import Combine
import P1FastCore
import GRDB

@MainActor
public final class SyncCoordinator: ObservableObject {
    // ─── Estado público observável ───────────────────────────
    public enum SyncStatus: Equatable {
        case idle, syncing, offline, hasFailures, notConfigured
    }

    @Published public private(set) var status: SyncStatus = .idle
    @Published public private(set) var pendingCount: Int = 0
    @Published public private(set) var deadLetterCount: Int = 0
    @Published public private(set) var lastSuccessAt: Date?
    @Published public private(set) var nextAttemptAt: Date?
    /// Itens da sync_queue ainda dentro do limite de attempts.
    @Published public private(set) var pendingItems: [SyncQueueItem] = []
    /// Itens da sync_queue que estouraram o limite (attempts >= 5).
    @Published public private(set) var deadLetterItems: [SyncQueueItem] = []

    /// Limite usado pra separar pending vs dead-letter (precisa bater com o
    /// SyncDrainer.maxAttempts default).
    private static let deadLetterThreshold = 5

    // ─── Internas ────────────────────────────────────────────
    private let queue: DatabaseQueue
    private let reachability: Reachability
    private var reachCancellable: AnyCancellable?
    private var timerSync: Timer?
    private var timerPull: Timer?
    private var timerTelemetry: Timer?
    private var draining = false
    /// Última vez que reabilitamos itens "parados" (dead-letter). Throttle pra
    /// não re-tentar um item de fato quebrado a cada volta ao primeiro plano.
    private var lastRehabAt: Date?
    private static let rehabCooldown: TimeInterval = 300  // 5 min

    private let syncTransport: SyncTransport
    private let pullTransport: PullTransport
    private let telemetryTransport: TelemetryTransport

    public init(
        queue: DatabaseQueue,
        reachability: Reachability,
        syncTransport: SyncTransport = URLSessionSyncTransport(),
        pullTransport: PullTransport = URLSessionPullTransport(),
        telemetryTransport: TelemetryTransport = URLSessionTelemetryTransport()
    ) {
        self.queue = queue
        self.reachability = reachability
        self.syncTransport = syncTransport
        self.pullTransport = pullTransport
        self.telemetryTransport = telemetryTransport
        self.status = Configuration.isConfigured ? .idle : .notConfigured

        // Observa reachability — transição offline → online dispara drain.
        reachCancellable = reachability.$isReachable.sink { [weak self] isOnline in
            guard let self else { return }
            Task { @MainActor in
                if isOnline {
                    if self.status == .offline { self.status = .idle }
                    await self.rehabilitateDeadLetters()
                    await self.syncNow()
                } else {
                    if self.status != .notConfigured { self.status = .offline }
                }
            }
        }

        scheduleTimers()
        Task {
            await self.refreshCounters()
            // No boot, dá uma chance fresca pros itens "parados" (ex.: ficaram
            // dead-letter numa versão antiga da nuvem que já foi corrigida).
            await self.rehabilitateDeadLetters(force: true)
        }
    }

    deinit {
        timerSync?.invalidate()
        timerPull?.invalidate()
        timerTelemetry?.invalidate()
    }

    /// Trigger manual (SincronizacaoView "Sincronizar agora" botão).
    public func syncNow() async {
        await drainSync()
        await refreshCounters()
    }

    /// Pull agendado também é triggerável manualmente.
    public func pullNow() async {
        await drainPull()
        await refreshCounters()
    }

    /// Re-tenta um item dead-letter (zera attempts e last_error, próximo drain pega).
    public func retryItem(_ id: Int64) async {
        do {
            try await queue.write { db in
                try db.execute(
                    sql: "UPDATE sync_queue SET attempts = 0, last_error = NULL WHERE id = ?",
                    arguments: [id]
                )
            }
            await refreshCounters()
            // Tenta drenar imediatamente — feedback visual rápido pra UI.
            await drainSync()
        } catch {
            print("SyncCoordinator.retryItem error: \(error)")
        }
    }

    /// Apaga definitivamente um item da fila (usado pelo swipe-to-delete
    /// na tela de dead-letters). Não há recovery — UI tem que confirmar.
    public func dropItem(_ id: Int64) async {
        do {
            try await queue.write { db in
                try db.execute(sql: "DELETE FROM sync_queue WHERE id = ?",
                               arguments: [id])
            }
            await refreshCounters()
        } catch {
            print("SyncCoordinator.dropItem error: \(error)")
        }
    }

    // MARK: - Internal drain helpers

    private func scheduleTimers() {
        // Cadência: sync 30s, telemetry 60s, pull 5min.
        timerSync = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.drainSync() }
        }
        timerTelemetry = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.drainTelemetry() }
        }
        timerPull = Timer.scheduledTimer(withTimeInterval: 300.0, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.drainPull() }
        }
        // Pull também roda no boot (catch-up).
        Task { @MainActor in await self.drainPull() }
    }

    /// Tabelas que entram no pull (catch-up de servidor). Inclui catálogos
    /// públicos (tracks, licoes, pendencias_template) + dados do time.
    private static let pullTables: [String] = [
        "times", "usuarios_time",
        "tracks", "track_layouts", "track_segments", "marcos", "retas_especiais",
        "carros", "configuracoes", "pilotos", "passageiros", "pneus", "combustiveis",
        "eventos", "sessoes", "voltas", "segment_executions",
        "licoes", "pendencias_template", "evento_pendencias",
        "mensagens", "trofeus_ganhos",
        "estoque_item",
    ]

    private func drainSync() async {
        guard Configuration.isConfigured, reachability.isReachable, !draining else { return }
        draining = true
        status = .syncing
        defer { draining = false }
        do {
            let outcome = try await Task.detached(priority: .background) { [queue, syncTransport] in
                try SyncDrainer.drainBatch(queue, transport: syncTransport)
            }.value
            if outcome.deadLetteredCount > 0 {
                self.status = .hasFailures
            } else {
                self.status = reachability.isReachable ? .idle : .offline
            }
            // `lastSuccessAt` só atualiza se NADA foi rejeitado neste ciclo —
            // antes estava marcando "OK há 11s" enquanto rows iam acumulando
            // attempts em silêncio. Honestidade é precondição da UX.
            if outcome.rejectedCount == 0 && outcome.deadLetteredCount == 0 {
                self.lastSuccessAt = Date()
            }
            self.nextAttemptAt = Date().addingTimeInterval(30)
            await refreshCounters()
        } catch {
            print("SyncCoordinator.drainSync error: \(error)")
            self.status = reachability.isReachable ? .idle : .offline
        }
    }

    private func drainPull() async {
        guard Configuration.isConfigured, reachability.isReachable else { return }
        do {
            let outcome = try await Task.detached(priority: .background) { [queue, pullTransport] in
                try PullExecutor.runOnce(queue, tables: Self.pullTables, transport: pullTransport)
            }.value
            print("SyncCoordinator pull: \(outcome.totalRowsApplied) rows in \(outcome.tables.count) tables")
        } catch {
            print("SyncCoordinator.drainPull error: \(error)")
        }
    }

    private func drainTelemetry() async {
        guard Configuration.isConfigured, reachability.isReachable else { return }
        do {
            let outcome = try await Task.detached(priority: .background) { [queue, telemetryTransport] in
                try TelemetryUploader.upload(queue, transport: telemetryTransport)
            }.value
            if outcome.acceptedCount > 0 {
                print("SyncCoordinator telemetry: uploaded \(outcome.acceptedCount) samples")
            }
        } catch {
            print("SyncCoordinator.drainTelemetry error: \(error)")
        }
    }

    private func refreshCounters() async {
        let threshold = Self.deadLetterThreshold
        do {
            let snap = try await queue.read { db -> (Int, Int, [SyncQueueItem], [SyncQueueItem]) in
                let pending = try Int.fetchOne(db,
                    sql: "SELECT COUNT(*) FROM sync_queue WHERE attempts < ?",
                    arguments: [threshold]) ?? 0
                let dead = try Int.fetchOne(db,
                    sql: "SELECT COUNT(*) FROM sync_queue WHERE attempts >= ?",
                    arguments: [threshold]) ?? 0
                let pendingRows = try SyncQueueItem.fetchAll(db,
                    sql: "SELECT * FROM sync_queue WHERE attempts < ? ORDER BY created_at ASC LIMIT 100",
                    arguments: [threshold])
                let deadRows = try SyncQueueItem.fetchAll(db,
                    sql: "SELECT * FROM sync_queue WHERE attempts >= ? ORDER BY created_at ASC LIMIT 100",
                    arguments: [threshold])
                return (pending, dead, pendingRows, deadRows)
            }
            self.pendingCount = snap.0
            self.deadLetterCount = snap.1
            self.pendingItems = snap.2
            self.deadLetterItems = snap.3
        } catch {
            print("SyncCoordinator.refreshCounters error: \(error)")
        }
    }

    /// Trigger público — UI da SincronizacaoView usa pra pull-to-refresh
    /// sem disparar drain.
    public func refresh() async {
        await refreshCounters()
    }
}
