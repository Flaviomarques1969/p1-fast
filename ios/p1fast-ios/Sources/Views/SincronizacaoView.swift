// ═══════════════════════════════════════════════════════════
// SincronizacaoView — tela completa de status + dead-letter
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — Prompt #24. Aberta via tap no SyncStatusBadge da Home.
//
// Layout:
//   - Status pill grande (verde/amarelo/vermelho/cinza)
//   - 3 stat cards: Última sync OK / Próxima tentativa / Items pendentes
//   - Seção "Pendentes" com lista de items na sync_queue (table+op+age)
//   - Seção "Falhas" com items dead-letter + botão retry individual +
//     swipe-to-delete confirmado por alert
//   - Botão "Sincronizar agora" no toolbar
//
// Empty state explícito ("Tudo sincronizado.") — princípio nunca-fabricar.

import SwiftUI
import P1FastCore

struct SincronizacaoView: View {
    @EnvironmentObject private var coordinator: SyncCoordinator
    @EnvironmentObject private var session: SessionManager
    @Environment(\.dismiss) private var dismiss
    @State private var pendingDelete: SyncQueueItem?
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    statusBlock
                    statCards
                    pendingSection
                    deadLetterSection
                    contaSection
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)
            .preferredColorScheme(.dark)
            .navigationTitle("Sincronização")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Fechar") { dismiss() }
                        .foregroundStyle(Color.text)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: triggerSyncNow) {
                        if isWorking {
                            ProgressView().tint(Color.text)
                        } else {
                            Text("Sincronizar")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.accent)
                        }
                    }
                    .disabled(isWorking || coordinator.status == .notConfigured)
                }
            }
            .refreshable { await coordinator.refresh() }
            .alert(item: $pendingDelete) { item in
                Alert(
                    title: Text("Apagar definitivamente?"),
                    message: Text("\(item.tableName) · \(item.op.rawValue) — não dá pra desfazer."),
                    primaryButton: .destructive(Text("Apagar")) {
                        Task {
                            if let id = item.id { await coordinator.dropItem(id) }
                        }
                    },
                    secondaryButton: .cancel(Text("Cancelar"))
                )
            }
            .task { await coordinator.refresh() }
        }
    }

    // MARK: - Subviews

    private var statusBlock: some View {
        Card(style: pillStyle) {
            HStack(spacing: Spacing.sm) {
                Circle().fill(pillColor).frame(width: 12, height: 12)
                VStack(alignment: .leading, spacing: 2) {
                    Text(pillTitle)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Color.text)
                    if let detail = pillDetail {
                        Text(detail)
                            .font(.system(size: 13, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    }
                }
                Spacer()
            }
        }
    }

    private var statCards: some View {
        HStack(spacing: Spacing.sm) {
            StatPill(label: "Última sync", value: lastSuccessLabel)
            StatPill(label: "Próxima", value: nextAttemptLabel)
            StatPill(label: "Pendentes", value: "\(coordinator.pendingCount)")
        }
    }

    @ViewBuilder
    private var pendingSection: some View {
        if !coordinator.pendingItems.isEmpty {
            sectionHeader("Pendentes (\(coordinator.pendingItems.count))")
            VStack(spacing: Spacing.xs) {
                ForEach(coordinator.pendingItems, id: \.id) { item in
                    QueueItemRow(item: item, isDeadLetter: false, onRetry: {}, onDelete: {})
                }
            }
        }
    }

    @ViewBuilder
    private var deadLetterSection: some View {
        if !coordinator.deadLetterItems.isEmpty {
            sectionHeader("Falhas (\(coordinator.deadLetterItems.count))")
            VStack(spacing: Spacing.xs) {
                ForEach(coordinator.deadLetterItems, id: \.id) { item in
                    QueueItemRow(
                        item: item,
                        isDeadLetter: true,
                        onRetry: {
                            guard let id = item.id else { return }
                            Task { await coordinator.retryItem(id) }
                        },
                        onDelete: { pendingDelete = item }
                    )
                }
            }
        } else if coordinator.pendingItems.isEmpty {
            EmptyState()
        }
    }

    /// MS-10 A.3: identidade do user logado + botão Sair. UI minimalista
    /// — Padrão B (surfaceRaised + border). Logout volta pro LoginView
    /// via troca do estado em SessionManager.
    @ViewBuilder
    private var contaSection: some View {
        if case let .authenticated(_, email) = session.state {
            sectionHeader("Conta")
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text(email ?? "Sem email")
                    .font(Font.bodyP1)
                    .foregroundStyle(Color.text)
                Button(action: {
                    Task { await session.signOut() }
                }) {
                    Text("Sair")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.rec)
                        .padding(.vertical, 10)
                        .padding(.horizontal, 14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.surfaceRaised)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .stroke(Color.border, lineWidth: 1)
                        )
                        .cornerRadius(Radius.md)
                }
                .buttonStyle(.plain)
                .disabled(session.isWorking)
            }
            .padding(.horizontal, Spacing.xs)
        }
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.54)
            .foregroundStyle(Color.textFaint)
            .padding(.horizontal, Spacing.xs)
            .padding(.top, Spacing.sm)
    }

    private func triggerSyncNow() {
        guard !isWorking else { return }
        isWorking = true
        Task {
            await coordinator.syncNow()
            isWorking = false
        }
    }

    // MARK: - Status helpers

    private var pillStyle: CardStyleKind {
        switch coordinator.status {
        case .hasFailures, .offline: return .accent
        default: return .raised
        }
    }
    private var pillColor: Color {
        switch coordinator.status {
        case .notConfigured: return Color.textFaint
        case .offline, .hasFailures: return Color.erro
        case .syncing: return Color.atencao
        case .idle:
            if coordinator.deadLetterCount > 0 { return Color.erro }
            if coordinator.pendingCount > 0 { return Color.atencao }
            return Color.success
        }
    }
    private var pillTitle: String {
        switch coordinator.status {
        case .notConfigured: return "Nuvem não configurada"
        case .offline: return "Offline"
        case .syncing: return "Sincronizando…"
        case .hasFailures: return "Há falhas"
        case .idle:
            if coordinator.deadLetterCount > 0 { return "Há falhas" }
            if coordinator.pendingCount > 0 { return "\(coordinator.pendingCount) pendente\(coordinator.pendingCount == 1 ? "" : "s")" }
            return "Tudo sincronizado"
        }
    }
    private var pillDetail: String? {
        switch coordinator.status {
        case .notConfigured: return "Configure SUPABASE_URL/ANON_KEY em .env.xcconfig pra ativar."
        case .offline: return "Aguardando conexão pra drenar a fila."
        case .syncing: return "Drenando \(coordinator.pendingCount) item\(coordinator.pendingCount == 1 ? "" : "s")…"
        case .hasFailures: return "\(coordinator.deadLetterCount) item\(coordinator.deadLetterCount == 1 ? "" : "s") em dead-letter."
        case .idle:
            if let last = coordinator.lastSuccessAt {
                return "Última sync OK há \(SincronizacaoView.relativeShort(last))."
            }
            return nil
        }
    }
    private var lastSuccessLabel: String {
        guard let last = coordinator.lastSuccessAt else { return "—" }
        return SincronizacaoView.relativeShort(last)
    }
    private var nextAttemptLabel: String {
        guard let next = coordinator.nextAttemptAt else { return "—" }
        let secs = max(0, Int(next.timeIntervalSinceNow))
        if secs < 60 { return "\(secs)s" }
        return "\(secs / 60)m"
    }

    static func relativeShort(_ date: Date) -> String {
        let secs = max(0, Int(-date.timeIntervalSinceNow))
        if secs < 60 { return "\(secs)s" }
        if secs < 3600 { return "\(secs / 60)m" }
        return "\(secs / 3600)h"
    }
}

// MARK: - Pieces

private struct StatPill: View {
    let label: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.0)
                .foregroundStyle(Color.textFaint)
            Text(value)
                .font(.system(size: 20, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Color.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: 10).fill(Color.text.opacity(0.04))
        )
    }
}

private struct QueueItemRow: View {
    let item: SyncQueueItem
    let isDeadLetter: Bool
    let onRetry: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: Spacing.sm) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(item.tableName) · \(item.op.rawValue)")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text("\(ageString) · \(item.attempts) tentativa\(item.attempts == 1 ? "" : "s")")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                if let err = item.lastError, !err.isEmpty {
                    Text(err)
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Color.erro)
                        .lineLimit(2)
                        .padding(.top, 2)
                }
            }
            Spacer()
            if isDeadLetter {
                Button(action: onRetry) {
                    Text("Tentar de novo")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.accent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .overlay(
                            Capsule().stroke(Color.accent, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .foregroundStyle(Color.erro)
                        .padding(8)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Apagar \(item.tableName)")
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: 10).fill(Color.text.opacity(0.04))
        )
    }

    private var ageString: String {
        let secs = max(0, Int(Date().timeIntervalSince1970 - Double(item.createdAt) / 1000))
        if secs < 60 { return "\(secs)s atrás" }
        if secs < 3600 { return "\(secs / 60)min atrás" }
        if secs < 86400 { return "\(secs / 3600)h atrás" }
        return "\(secs / 86400)d atrás"
    }
}

private struct EmptyState: View {
    var body: some View {
        VStack(spacing: Spacing.sm) {
            Text("Tudo sincronizado.")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.text)
            Text("Mutações locais aparecem aqui antes de subir.")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textFaint)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xl)
    }
}

// SyncQueueItem precisa ser Identifiable pro alert(item:) — id é Int64?
// e SyncQueueItem é Codable, então adicionamos Identifiable via extension.
extension SyncQueueItem: @retroactive Identifiable {}
