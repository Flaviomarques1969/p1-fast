// ═══════════════════════════════════════════════════════════
// TriagemVideoView — F4 etapa 4
// ═══════════════════════════════════════════════════════════
// Tela aparece ao encerrar um stint que teve gravação Daily.co. Lista
// as voltas já indexadas (via VoltaVideoIndexer da F4.3) e pede pra
// piloto/chefe decidir manter ou descartar cada uma.
//
// Visual segue Padrão B do projeto (`_design-reference/`) — escuro,
// accent azul, sem ícones. Lap por lap:
//   - número e tempo (volta) na esquerda
//   - "tocar" (abre URL Daily.co em browser, simples no Tier 0)
//   - "manter" / "descartar" toggles mutuamente exclusivos
//
// FootBar:
//   - Pular: fecha a tela sem persistir; voltas ficam pendentes
//     (F4.5 vai bloquear iniciar próximo stint até resolver).
//   - Confirmar: persiste decisões em `volta_video` via repo.triar().
//
// Permissão (F4.6 entra depois): piloto do stint + chefe da equipe.
// Por enquanto, qualquer member do time vê a tela — RLS do banco
// limita a escrita.

import SwiftUI
import P1FastCore

struct TriagemVideoView: View {
    @EnvironmentObject private var repo: VoltaVideoRepository
    let sessaoId: String
    let contextoLinha: String
    let onClose: () -> Void

    /// Snapshot local das decisões: voltaVideoId → status escolhido.
    /// Persistido em lote no botão "Confirmar triagem".
    @State private var decisoes: [String: TriagemStatus] = [:]
    @State private var saving = false
    @State private var loadError: String?

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: onClose,
                onSave: confirmar,
                saveLabel: "Confirmar triagem",
                canSave: !saving && !repo.voltasDoStint.isEmpty
            )
        }
        .preferredColorScheme(.dark)
        .task { await carregar() }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            headerSection
            if repo.voltasDoStint.isEmpty {
                emptyState
            } else {
                voltasSection
                resumoSection
            }
            if let erro = loadError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Triagem de vídeo")
            Text("Voltas gravadas")
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            if !contextoLinha.isEmpty {
                Text("\(contextoLinha) · \(repo.voltasDoStint.count) voltas")
                    .font(.system(size: 13, weight: .regular))
                    .monospacedDigit()
                    .foregroundStyle(Color.textMuted)
            }
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.sm)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Nenhuma volta indexada nesta gravação.")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.textMuted)
            Text("Pode ser que o stint não tenha gravação Daily.co ativa ou o stream foi muito curto pra registrar uma volta.")
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(Color.textFaint)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.vertical, Spacing.md)
    }

    // MARK: - Voltas

    private var voltasSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Voltas")
            ForEach(repo.voltasDoStint, id: \.id) { vv in
                voltaRow(vv)
            }
        }
    }

    private func voltaRow(_ vv: VoltaVideo) -> some View {
        let escolhida = decisoes[vv.id] ?? vv.status
        return HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Volta \(numeroLegivel(vv))")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                Text(duracaoLegivel(vv))
                    .font(.system(size: 15, weight: .semibold))
                    .monospacedDigit()
                    .tracking(-0.01)
                    .foregroundStyle(Color.text)
            }
            Spacer()
            // Tier 0: botão "tocar" é placeholder visual — abertura real do
            // vídeo no Daily.co fica pra integração futura (precisa do URL
            // + jump pra t_inicio_ms via player embed).
            triagemBtn("Manter", ativo: escolhida == .mantida, cor: Color.success) {
                decisoes[vv.id] = .mantida
            }
            triagemBtn("Descartar", ativo: escolhida == .descartada, cor: Color.erro) {
                decisoes[vv.id] = .descartada
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func triagemBtn(_ label: String, ativo: Bool, cor: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(ativo ? cor : Color.textMuted)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(ativo ? cor.opacity(0.15) : Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(ativo ? cor : Color.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Resumo

    private var resumoSection: some View {
        let mantidas = decisoesContendo(.mantida)
        let descartadas = decisoesContendo(.descartada)
        let pendentes = repo.voltasDoStint.count - mantidas - descartadas
        return VStack(alignment: .leading, spacing: 8) {
            sectionHead("Resumo")
            HStack(spacing: 14) {
                resumoChip(label: "Manter", valor: mantidas, cor: Color.success)
                resumoChip(label: "Descartar", valor: descartadas, cor: Color.erro)
                resumoChip(label: "Pendentes", valor: pendentes, cor: Color.textMuted)
            }
            if pendentes > 0 {
                Text("Voltas pendentes ficam pra triar depois — bloqueio do próximo stint se acumular (conforme regra do projeto).")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }

    private func resumoChip(label: String, valor: Int, cor: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .tracking(1.08)
                .foregroundStyle(Color.textFaint)
            Text("\(valor)")
                .font(.system(size: 20, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(cor)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    // MARK: - Helpers

    private func sectionHead(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.32)
            .foregroundStyle(Color.textFaint)
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, 2)
    }

    private func numeroLegivel(_ vv: VoltaVideo) -> String {
        // Sem acesso direto a `voltas.numero` aqui; loadByStint já ordena
        // por t_inicio_ms, então a posição na lista é o número da volta
        // gravada (1-indexed).
        if let idx = repo.voltasDoStint.firstIndex(where: { $0.id == vv.id }) {
            return "\(idx + 1)"
        }
        return "?"
    }

    private func duracaoLegivel(_ vv: VoltaVideo) -> String {
        let totalMs = vv.duracaoMs
        let min = totalMs / 60_000
        let seg = (totalMs % 60_000) / 1_000
        let ms = totalMs % 1_000
        return String(format: "%d:%02d.%03d", min, seg, ms)
    }

    private func decisoesContendo(_ status: TriagemStatus) -> Int {
        // Conta decisões locais + status persistido (caso já tenha sido triada antes).
        var count = 0
        for vv in repo.voltasDoStint {
            let escolhida = decisoes[vv.id] ?? vv.status
            if escolhida == status { count += 1 }
        }
        return count
    }

    // MARK: - Ações

    private func carregar() async {
        do {
            try await repo.loadByStint(sessaoId: sessaoId)
        } catch {
            loadError = "Não consegui carregar as voltas: \(error.localizedDescription)"
        }
    }

    private func confirmar() {
        saving = true
        loadError = nil
        let snapshot = decisoes
        // F4.6 vai trocar pelo userId do SessionManager. Por enquanto, nil
        // — Tier 0 funciona sem auditoria de quem triou.
        let triadaPor: String? = nil
        Task {
            do {
                for (voltaVideoId, status) in snapshot where status != .pendente {
                    try await repo.triar(voltaVideoId: voltaVideoId, status: status, triadaPor: triadaPor)
                }
                try await repo.loadByStint(sessaoId: sessaoId)
                saving = false
                onClose()
            } catch {
                saving = false
                loadError = "Não consegui gravar a triagem: \(error.localizedDescription)"
            }
        }
    }
}
