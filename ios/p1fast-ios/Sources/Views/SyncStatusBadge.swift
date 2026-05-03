// ═══════════════════════════════════════════════════════════
// SyncStatusBadge — pílula compacta de status da sync
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — Prompt #24. Pequeno dot colorido + label opcional.
// Aparece no header da Home, tap abre SincronizacaoView.
//
// Cores:
//   🟢 syncOk       — pendingCount==0 && deadLetterCount==0 && reachable
//   🟡 syncing      — status==.syncing OU pendingCount>0 sem falhas
//   🔴 offline/falha — !reachable OU deadLetterCount>0
//   ⚪ notConfigured — Configuration.isConfigured==false (.env vazio)
//
// Uso: passa SyncCoordinator opcional via init pra preview funcionar
// sem precisar criar instância completa.

import SwiftUI

struct SyncStatusBadge: View {
    @ObservedObject var coordinator: SyncCoordinator
    var compact: Bool = false
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Circle()
                    .fill(dotColor)
                    .frame(width: 8, height: 8)
                    .overlay {
                        if isPulsing {
                            Circle()
                                .stroke(dotColor.opacity(0.4), lineWidth: 1)
                                .scaleEffect(pulseScale)
                                .opacity(2 - pulseScale)
                                .animation(.easeOut(duration: 1.2).repeatForever(autoreverses: false),
                                           value: pulseScale)
                                .onAppear { pulseScale = 2.2 }
                        }
                    }
                if !compact {
                    Text(label)
                        .font(.system(size: 11, weight: .medium))
                        .tracking(0.4)
                        .foregroundStyle(Color.text)
                }
            }
            .padding(.horizontal, compact ? 4 : 10)
            .padding(.vertical, compact ? 4 : 6)
            .background(
                Capsule().fill(Color.surface.opacity(0.001))
            )
            .overlay(
                Capsule()
                    .stroke(Color.text.opacity(compact ? 0 : 0.12), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Status de sincronização: \(label)")
    }

    @State private var pulseScale: CGFloat = 1.0

    private var dotColor: Color {
        switch coordinator.status {
        case .notConfigured: return Color.textFaint
        case .offline:       return Color.erro
        case .hasFailures:   return Color.erro
        case .syncing:       return Color.atencao
        case .idle:
            if coordinator.deadLetterCount > 0 { return Color.erro }
            if coordinator.pendingCount > 0    { return Color.atencao }
            return Color.success
        }
    }

    private var isPulsing: Bool {
        coordinator.status == .syncing
    }

    private var label: String {
        switch coordinator.status {
        case .notConfigured: return "Sem nuvem"
        case .offline:       return "Offline"
        case .syncing:       return "Sincronizando…"
        case .hasFailures:   return "\(coordinator.deadLetterCount) falha\(coordinator.deadLetterCount == 1 ? "" : "s")"
        case .idle:
            if coordinator.deadLetterCount > 0 {
                return "\(coordinator.deadLetterCount) falha\(coordinator.deadLetterCount == 1 ? "" : "s")"
            }
            if coordinator.pendingCount > 0 {
                return "\(coordinator.pendingCount) pendente\(coordinator.pendingCount == 1 ? "" : "s")"
            }
            return "Sincronizado"
        }
    }
}
