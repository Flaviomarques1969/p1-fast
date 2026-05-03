// ═══════════════════════════════════════════════════════════
// TrechoListaView — port readonly de mockup-trecho-lista.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.5 — Prompt #19. Mostra os 8 trechos pedagógicos da
// pista ativa (Brasília hoje), agrupados por parcial. Sem radio,
// sem footer Voltar/Confirmar — esse mockup era originalmente
// stint-selector, aqui entra como CRUD readonly. Selector real
// (radio + footer) vira PR separado quando o stint precisar
// escolher trecho focado.
//
// Visual herda do padrão B do hub. Eyebrow + título + sub no header,
// cards de grupo (parcial) com header + lista de trecho-rows, cada
// row mostra nome + tags (Lenta/Média/Rápida + Apex tardio/neutro/
// precoce/duplo) derivadas da geometria persistida.
//
// Tags como derivação visual (não-canônica): o schema atual não tem
// `tags` em track_segments. As tags vêm do JSON de geometria
// (cornerType + apexStrategy) que TrackRepository persiste no seed.
// Hack temporário até `track_segments` ganhar coluna `tags` (V2).

import SwiftUI
import P1FastCore

struct TrechoListaView: View {
    @EnvironmentObject private var repo: TrackRepository
    let onClose: (() -> Void)?

    init(onClose: (() -> Void)? = nil) {
        self.onClose = onClose
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 40)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)
        }
        .preferredColorScheme(.dark)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let onClose {
                ToolbarItem(placement: .topBarLeading) {
                    Button("‹ Voltar", action: onClose)
                        .foregroundStyle(Color.text)
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            header
            if let track = repo.tracks.first, let layout = repo.layouts(forTrackId: track.id).first {
                trechosByParcial(layout: layout)
            } else {
                emptyState
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Trechos da pista")
            Text(headerTitle)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text(headerSubtitle)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, Spacing.sm)
    }

    private var headerTitle: String {
        repo.tracks.first?.apelido ?? "Sem pista cadastrada"
    }

    private var headerSubtitle: String {
        guard let track = repo.tracks.first,
              let layout = repo.layouts(forTrackId: track.id).first else {
            return "Cadastre uma pista pra começar."
        }
        let n = repo.trechos(forLayoutId: layout.id).count
        return "\(n) \(n == 1 ? "trecho" : "trechos")"
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Sem layout cadastrado pra pista atual.")
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Color.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func trechosByParcial(layout: TrackLayoutRow) -> some View {
        let trechos = repo.trechos(forLayoutId: layout.id)
        let porParcial = Dictionary(grouping: trechos, by: { $0.parcialId ?? "?" })
        let parcialIds = porParcial.keys.sorted()

        VStack(spacing: Spacing.md) {
            ForEach(parcialIds, id: \.self) { pid in
                if let segs = porParcial[pid], !segs.isEmpty {
                    parcialCard(parcialId: pid, trechos: segs)
                }
            }
        }
    }

    private func parcialCard(parcialId: String, trechos: [TrackSegmentRow]) -> some View {
        let parcial = repo.parciaisBrasilia[parcialId]
        let head = parcial.map { p -> String in
            if let apelido = p.apelido { return "\(p.nome) · \(apelido)" }
            return p.nome
        } ?? "Parcial \(parcialId)"

        return VStack(alignment: .leading, spacing: 0) {
            Text(head.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.22 * 11)  // --ls-caps-m
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, 10)

            VStack(spacing: 0) {
                ForEach(Array(trechos.enumerated()), id: \.element.id) { idx, seg in
                    if idx > 0 {
                        Rectangle()
                            .fill(Color.border)
                            .frame(height: 1)
                            .padding(.horizontal, Spacing.md)
                    }
                    trechoRow(seg)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func trechoRow(_ seg: TrackSegmentRow) -> some View {
        let geo = TrechoGeometriaTags.parse(seg.geometria)
        return HStack(alignment: .center, spacing: Spacing.sm) {
            VStack(alignment: .leading, spacing: 4) {
                Text(seg.nome ?? "Trecho")
                    .font(.system(size: 15, weight: .semibold))
                    .tracking(-0.075)
                    .foregroundStyle(Color.text)
                if !geo.tags.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(geo.tags, id: \.label) { tag in
                            TrechoTag(label: tag.label, kind: tag.kind)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
    }
}

// MARK: - Tags (derivadas da geometria do segment)

/// Decodifica o JSON em `track_segments.geometria` (escrito pelo
/// TrackRepository.encodeGeometria) e converte cornerType/apexStrategy
/// em tags visuais. Tags são derivação não-canônica — schema futuro
/// (V2) deve ter coluna `tags` própria, este parser sai.
enum TrechoGeometriaTags {
    struct Tag: Equatable {
        let label: String
        let kind: TagKind
    }

    enum TagKind {
        case neutral
        case bom
        case foco
        case sistema
        case ouro
    }

    struct Result {
        let tags: [Tag]
    }

    static func parse(_ json: String?) -> Result {
        guard let json,
              let data = json.data(using: .utf8),
              let blob = try? JSONDecoder().decode(GeomBlob.self, from: data)
        else {
            return Result(tags: [])
        }
        var tags: [Tag] = []
        if let ct = blob.cornerType {
            switch ct {
            case "lenta":  tags.append(Tag(label: "Lenta",  kind: .sistema))
            case "media":  tags.append(Tag(label: "Média",  kind: .neutral))
            case "rapida": tags.append(Tag(label: "Rápida", kind: .bom))
            default: break
            }
        }
        if let strat = blob.apexStrategy {
            switch strat {
            case "tardio":     tags.append(Tag(label: "Apex tardio",   kind: .foco))
            case "neutro":     tags.append(Tag(label: "Apex neutro",   kind: .neutral))
            case "precoce":    tags.append(Tag(label: "Apex precoce",  kind: .foco))
            case "antecipado": tags.append(Tag(label: "Apex antecipado", kind: .foco))
            case "duplo":      tags.append(Tag(label: "Apex duplo",    kind: .ouro))
            default: break
            }
        }
        return Result(tags: tags)
    }

    private struct GeomBlob: Decodable {
        let cornerType: String?
        let apexStrategy: String?
    }
}

private struct TrechoTag: View {
    let label: String
    let kind: TrechoGeometriaTags.TagKind

    var body: some View {
        Text(label)
            .font(.system(size: 10, weight: .semibold))
            .tracking(0.06 * 10)
            .foregroundStyle(textColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(bgColor)
            )
    }

    private var textColor: Color {
        switch kind {
        case .neutral: return Color.textMuted
        case .bom:     return Color.bom
        case .foco:    return Color.atencao
        case .sistema: return Color.accent
        case .ouro:    return Color.ouro
        }
    }

    private var bgColor: Color {
        switch kind {
        case .neutral: return Color.surfaceHover
        case .bom:     return Color.bom.opacity(0.15)
        case .foco:    return Color.atencao.opacity(0.15)
        case .sistema: return Color.accent.opacity(0.18)
        case .ouro:    return Color.ouro.opacity(0.15)
        }
    }
}

// MARK: - Preview

#Preview("TrechoListaView") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = TrackRepository(queue: queue)
    return NavigationStack {
        TrechoListaView()
    }
    .environmentObject(repo)
    .task { await repo.bootstrap() }
}
