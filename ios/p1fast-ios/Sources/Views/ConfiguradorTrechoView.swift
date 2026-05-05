// ═══════════════════════════════════════════════════════════
// ConfiguradorTrechoView — MS-1.4 (configurador visual de pista)
// ═══════════════════════════════════════════════════════════
// PR-B da MS-1.4 (PR-A foi a foundation com SegmentGeometry).
//
// Função: definir os 4 pontos canônicos do trecho (entry, braking,
// apex, exit) sobre o path da pista. Cadastro / configuração — não
// análise. Análise pós-stint vira tela separada (pós MS-2).
//
// Layout (proposta Flávio aprovada 2026-05-04):
//   [header — nome do trecho + parcial]
//   [seletor segmentado: 4 pills (Entry / Brake / Apex / Exit)]
//   [zoom focal do trecho — pista corredor + 4 marcadores perp +
//    chevrons direção; ATIVO destacado, outros dimmed]
//   [help text — descrição do ponto ATIVO]
//   [toolbar: Cancelar | Salvar 4 pontos]
//
// Seleção explícita: tap pill → ativa ponto. Drag no mapa move só
// o ponto ativo. Snap no path mantém o ponto sempre sobre o traçado.

import SwiftUI
import P1FastCore

struct ConfiguradorTrechoView: View {
    @EnvironmentObject private var repo: TrackRepository
    @State private var segmentId: String
    let onClose: (() -> Void)?

    /// Pontos cadastrados pelo configurador. `braking` é EXCLUÍDO — é
    /// derivado retroativamente a cada passada (após o piloto cruzar o
    /// ápice, o sistema identifica a melhor passagem e volta gravando o
    /// ponto de frenagem + velocidade). Configurador nunca escreve em
    /// `brakingPoint` — só preserva o valor existente no DB.
    enum CanonicalPointKind: Int, CaseIterable, Identifiable {
        case entry, apex, exit
        var id: Int { rawValue }
        var index: Int { rawValue + 1 }
        var shortName: String {
            switch self {
            case .entry: return "Entrada"
            case .apex:  return "Ápice"
            case .exit:  return "Saída"
            }
        }
        var helpTitle: String { shortName }
        var helpText: String {
            switch self {
            case .entry: return "Vmáx pré-freio — define o início do trecho."
            case .apex:  return "Ponto mais lento da curva — alvo de referência."
            case .exit:  return "Início da reta seguinte — define o fim do trecho."
            }
        }
    }

    @State private var entry: P1FastCore.TrackPoint?
    @State private var apex: P1FastCore.TrackPoint?
    @State private var exitP: P1FastCore.TrackPoint?
    /// Apenas leitura no configurador — preservado no save.
    @State private var existingBraking: P1FastCore.TrackPoint?

    @State private var active: CanonicalPointKind = .entry
    @State private var saving = false
    @State private var didLoad = false
    @State private var lookup: PathMapper.Lookup?

    /// Estado do drag em curso: âncora capturada no início do gesto.
    /// `drag.translation` é cumulativa desde o start, então só dá pra
    /// converter pra nova posição se preservarmos o ponto inicial.
    /// Sem isso, cada onChanged adicionava translação SOBRE o ponto já
    /// movido — marcador acelerava / pulava.
    @State private var dragAnchorPoint: P1FastCore.TrackPoint?
    @State private var dragAnchorTangent: (Double, Double)?

    init(segmentId: String, onClose: (() -> Void)? = nil) {
        self._segmentId = State(initialValue: segmentId)
        self.onClose = onClose
    }

    private let trackWidth: Double = 25
    private let trackBorderWidth: Double = 28
    private let tickLength: Double = 56
    private let tickThickness: Double = 5
    private let focusWindow: Double = 280

    private func color(for kind: CanonicalPointKind) -> Color {
        switch kind {
        case .entry: return Color.success
        case .apex:  return Color.rec
        case .exit:  return Color.accent
        }
    }

    private func point(for kind: CanonicalPointKind) -> P1FastCore.TrackPoint? {
        switch kind {
        case .entry: return entry
        case .apex:  return apex
        case .exit:  return exitP
        }
    }

    private func setPoint(_ p: P1FastCore.TrackPoint, for kind: CanonicalPointKind) {
        switch kind {
        case .entry: entry = p
        case .apex:  apex = p
        case .exit:  exitP = p
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.horizontal, 20)
                .padding(.top, 16)

            selector
                .padding(.horizontal, 12)
                .padding(.top, 12)

            mapCanvas
                .padding(.horizontal, 12)
                .padding(.top, 12)

            helpText
                .padding(.horizontal, 20)
                .padding(.top, 12)

            Spacer()

            toolbar
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
        }
        .background(Color.surface)
        .preferredColorScheme(.dark)
        .navigationBarBackButtonHidden(true)
        .onAppear { if !didLoad { loadPoints(); buildLookup() } }
        .onChange(of: segmentId) { _ in
            // Troca de trecho via Anterior/Próximo: rehidrata pontos +
            // lookup do novo segment, reseta active pra Entrada.
            didLoad = false
            lookup = nil
            entry = nil; apex = nil; exitP = nil; existingBraking = nil
            active = .entry
            loadPoints()
            buildLookup()
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text("CONFIGURADOR DE TRECHO")
                    .font(.system(size: 11, weight: .medium))
                    .tracking(2)
                    .foregroundStyle(Color.textMuted)
                Spacer()
                Text(pagerCounter)
                    .font(.system(size: 11, weight: .medium))
                    .tracking(2)
                    .foregroundStyle(Color.textMuted)
            }
            Text(segmentName)
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text(parcialLabel)
                .font(.system(size: 13))
                .foregroundStyle(Color.textMuted)
            pagerDots
                .padding(.top, 6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// "Trecho X de N" calculado sobre os trechos `ehTrecho=true` em ordem.
    private var pagerCounter: String {
        let trechos = orderedTrechos
        guard let i = trechos.firstIndex(where: { $0.id == segmentId }) else {
            return ""
        }
        return "TRECHO \(i + 1) DE \(trechos.count)"
    }

    /// N mini-bolinhas no header. Sólida = `apexCalibration == "CONFIRMED"`,
    /// vazada = ainda no DEFAULT. Atual ganha contorno destacado.
    private var pagerDots: some View {
        let trechos = orderedTrechos
        let activeIdx = trechos.firstIndex(where: { $0.id == segmentId })
        return HStack(spacing: 6) {
            ForEach(Array(trechos.enumerated()), id: \.element.id) { idx, seg in
                let configured = isConfigured(seg)
                let isCurrent = idx == activeIdx
                Circle()
                    .fill(configured ? Color.accent : Color.clear)
                    .frame(width: 8, height: 8)
                    .overlay(
                        Circle().stroke(
                            isCurrent ? Color.text : Color.textFaint,
                            lineWidth: isCurrent ? 1.5 : 1
                        )
                    )
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: - Selector (4 pills)

    private var selector: some View {
        HStack(spacing: 6) {
            ForEach(CanonicalPointKind.allCases) { kind in
                pill(kind: kind)
            }
        }
    }

    private func pill(kind: CanonicalPointKind) -> some View {
        let isActive = active == kind
        let c = color(for: kind)
        return Button {
            active = kind
        } label: {
            HStack(spacing: 6) {
                Text("\(kind.index)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(isActive ? Color.surface : c)
                    .frame(width: 16, height: 16)
                    .background(
                        Circle().fill(isActive ? c : c.opacity(0.18))
                    )
                Text(kind.shortName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(isActive ? Color.text : Color.textMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isActive ? Color.surfaceHover : Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isActive ? c : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Map

    private var mapCanvas: some View {
        GeometryReader { geo in
            let xform = transform(in: geo.size)

            ZStack(alignment: .topLeading) {
                // Pista corredor
                trackPath(xform: xform)
                    .stroke(
                        Color.textFaint.opacity(0.35),
                        style: StrokeStyle(lineWidth: trackBorderWidth * xform.zoom, lineCap: .round, lineJoin: .round)
                    )
                trackPath(xform: xform)
                    .stroke(
                        Color.surfaceRaised,
                        style: StrokeStyle(lineWidth: trackWidth * xform.zoom, lineCap: .round, lineJoin: .round)
                    )

                // Chevrons direção (cinzas, ao longo do path no entorno do focus)
                directionChevrons(xform: xform)

                // Marcadores — desenhados em ordem inversa de prioridade pra
                // que o ATIVO (último) fique por cima.
                ForEach(CanonicalPointKind.allCases) { kind in
                    if kind != active, let p = point(for: kind) {
                        perpTick(point: p, kind: kind, xform: xform, isActive: false)
                    }
                }
                if let p = point(for: active) {
                    perpTick(point: p, kind: active, xform: xform, isActive: true)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .aspectRatio(1.0, contentMode: .fit)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.surfaceRaised.opacity(0.4))
        )
    }

    private func trackPath(xform: ViewTransform) -> Path {
        var p = Path()
        let pts = PathMapper.parsePath(layoutSvgPath ?? "")
        guard let first = pts.first else { return p }
        p.move(to: xform.apply(P1FastCore.TrackPoint(x: first.x, y: first.y)))
        for pt in pts.dropFirst() {
            p.addLine(to: xform.apply(P1FastCore.TrackPoint(x: pt.x, y: pt.y)))
        }
        return p
    }

    /// Chevrons cinzas indicando direção do tráfego ao longo do path,
    /// dentro da janela focal. Posicionados a cada ~50 unidades viewBox.
    @ViewBuilder
    private func directionChevrons(xform: ViewTransform) -> some View {
        if let lookup {
            let halfWindow = focusWindow * 0.6
            let n = lookup.points.count
            let chevronSpacing = 50.0  // unidades viewBox entre chevrons
            ForEach(Array(stride(from: 0.0, to: lookup.totalLength, by: chevronSpacing).enumerated()), id: \.offset) { _, off in
                let frac = off / lookup.totalLength
                let idx = max(1, min(n - 2, Int((Double(n - 1) * frac).rounded())))
                let p = lookup.points[idx]
                // Skip se fora da janela focal (otimização visual)
                let dx = p.x - focusCenter.x
                let dy = p.y - focusCenter.y
                if abs(dx) <= halfWindow && abs(dy) <= halfWindow {
                    let prev = lookup.points[idx - 1]
                    let next = lookup.points[idx + 1]
                    let tdx = next.x - prev.x
                    let tdy = next.y - prev.y
                    let len = (tdx * tdx + tdy * tdy).squareRoot()
                    let angle = len > 1e-6 ? atan2(tdy, tdx) : 0
                    let pos = xform.apply(P1FastCore.TrackPoint(x: p.x, y: p.y))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.textMuted.opacity(0.6))
                        .rotationEffect(.radians(angle))
                        .position(pos)
                }
            }
        }
    }

    private func perpTick(
        point p: P1FastCore.TrackPoint,
        kind: CanonicalPointKind,
        xform: ViewTransform,
        isActive: Bool
    ) -> some View {
        let c = color(for: kind)
        let opacity: Double = isActive ? 1.0 : 0.45
        let scale: Double = isActive ? 1.25 : 1.0
        let tangent = pathTangent(at: p) ?? (1, 0)
        let perp = (-tangent.1, tangent.0)
        let halfL = tickLength * scale / 2
        let p1 = xform.apply(P1FastCore.TrackPoint(x: p.x + perp.0 * halfL, y: p.y + perp.1 * halfL))
        let p2 = xform.apply(P1FastCore.TrackPoint(x: p.x - perp.0 * halfL, y: p.y - perp.1 * halfL))
        let center = xform.apply(p)
        let labelPos = xform.apply(P1FastCore.TrackPoint(
            x: p.x + perp.0 * (halfL / scale + 22),
            y: p.y + perp.1 * (halfL / scale + 22)
        ))

        return ZStack(alignment: .topLeading) {
            // Glow pra ATIVO
            if isActive {
                Path { pp in
                    pp.move(to: p1)
                    pp.addLine(to: p2)
                }
                .stroke(c.opacity(0.35), style: StrokeStyle(lineWidth: tickThickness * 3, lineCap: .round))
                .blur(radius: 4)
            }

            // Tick line
            Path { pp in
                pp.move(to: p1)
                pp.addLine(to: p2)
            }
            .stroke(c.opacity(opacity), style: StrokeStyle(lineWidth: tickThickness * (isActive ? 1.1 : 1.0), lineCap: .round))

            // Núcleo central com numeração
            ZStack {
                Circle().fill(c.opacity(opacity))
                Text("\(kind.index)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.surface)
            }
            .frame(width: isActive ? 18 : 14, height: isActive ? 18 : 14)
            .position(center)

            // Label
            Text(kind.shortName.uppercased())
                .font(.system(size: 9, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(c.opacity(opacity))
                .position(labelPos)

            // Hit-area só pra o ATIVO captura drag — generosa (80×60)
            // pra perdoar tap impreciso.
            if isActive {
                Capsule()
                    .fill(Color.clear)
                    .frame(width: tickLength * xform.zoom + 60, height: 60)
                    .rotationEffect(.radians(atan2(tangent.1, tangent.0)))
                    .position(center)
                    .contentShape(Capsule())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { drag in
                                // Captura âncora no PRIMEIRO onChanged
                                if dragAnchorPoint == nil {
                                    dragAnchorPoint = p
                                    dragAnchorTangent = tangent
                                }
                                guard let anchor = dragAnchorPoint,
                                      let anchorTan = dragAnchorTangent else { return }
                                let dx = drag.translation.width / xform.zoom
                                let dy = drag.translation.height / xform.zoom
                                let amount = dx * anchorTan.0 + dy * anchorTan.1
                                let next = P1FastCore.TrackPoint(
                                    x: anchor.x + amount * anchorTan.0,
                                    y: anchor.y + amount * anchorTan.1
                                )
                                if let lookup, let snapped = snapToPath(next, lookup: lookup) {
                                    setPoint(snapped, for: kind)
                                } else {
                                    setPoint(next, for: kind)
                                }
                            }
                            .onEnded { _ in
                                dragAnchorPoint = nil
                                dragAnchorTangent = nil
                            }
                    )
            }
        }
    }

    // MARK: - Help text

    private var helpText: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Circle()
                    .fill(color(for: active))
                    .frame(width: 8, height: 8)
                Text(active.helpTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text("—")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
                Text(active.helpText)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
                Spacer(minLength: 0)
            }
            Text("Frenagem é derivada retroativamente após cada passada — não cadastrada aqui.")
                .font(.system(size: 11))
                .foregroundStyle(Color.textFaint)
        }
    }

    // MARK: - Toolbar (footer com 3 botões: Anterior · Cancelar · Salvar e próximo)

    private var toolbar: some View {
        HStack(spacing: 10) {
            // ← Anterior — disabled no primeiro trecho
            Button {
                navigatePrev()
            } label: {
                Text("← Anterior")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(canGoPrev ? Color.text : Color.textFaint)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.surfaceRaised)
                    )
            }
            .disabled(!canGoPrev || saving)

            Button {
                onClose?()
            } label: {
                Text("Cancelar")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.text)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.surfaceRaised)
                    )
            }
            .disabled(saving)

            // Salvar e próximo → / Salvar e voltar à lista (no último)
            Button {
                saveAndAdvance()
            } label: {
                Text(saving ? "Salvando…" : (canGoNext ? "Salvar e próximo →" : "Salvar e voltar"))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.surface)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.accent)
                    )
            }
            .disabled(saving)
        }
    }

    // MARK: - Navegação trecho-a-trecho

    /// Trechos pedagógicos do layout em ordem ascendente (`ehTrecho=true`).
    /// Filtra pelo layout do segment atual; se não achar, devolve só ele.
    private var orderedTrechos: [TrackSegmentRow] {
        guard let row = findRow() else { return [] }
        let layoutSegs = repo.trechos(forLayoutId: row.layoutId)
        return layoutSegs.sorted { $0.ordem < $1.ordem }
    }

    private var currentIndex: Int? {
        orderedTrechos.firstIndex(where: { $0.id == segmentId })
    }

    private var canGoPrev: Bool {
        guard let i = currentIndex else { return false }
        return i > 0
    }

    private var canGoNext: Bool {
        guard let i = currentIndex else { return false }
        return i < orderedTrechos.count - 1
    }

    /// "Configurado" quando `apexCalibration == "CONFIRMED"` no blob.
    private func isConfigured(_ row: TrackSegmentRow) -> Bool {
        let blob = P1FastCore.SegmentGeometry.decode(row.geometria)
        return blob?.apexCalibration == "CONFIRMED"
    }

    private func navigatePrev() {
        guard let i = currentIndex, i > 0 else { return }
        segmentId = orderedTrechos[i - 1].id
    }

    private func navigateNext() {
        guard let i = currentIndex, i < orderedTrechos.count - 1 else { return }
        segmentId = orderedTrechos[i + 1].id
    }

    // MARK: - Helpers

    private var segmentName: String {
        guard let row = findRow() else { return "Trecho" }
        return row.nome ?? "Trecho \(row.ordem)"
    }

    private var parcialLabel: String {
        guard let row = findRow(), let pid = row.parcialId else { return "" }
        if let p = repo.parciaisBrasilia[pid], let apelido = p.apelido {
            return "Parcial \(pid) · \(apelido)"
        }
        return "Parcial \(pid)"
    }

    private var layoutSvgPath: String? {
        guard let row = findRow(),
              let layout = repo.layouts(forTrackId: repo.tracks.first?.id ?? "")
            .first(where: { $0.id == row.layoutId })
        else { return nil }
        return layout.svgPath
    }

    private var focusCenter: P1FastCore.TrackPoint {
        if let blob = repo.geometria(forSegmentId: segmentId) {
            return P1FastCore.TrackPoint(x: blob.x, y: blob.y)
        }
        let pts = [entry, apex, exitP].compactMap { $0 }
        guard !pts.isEmpty else { return P1FastCore.TrackPoint(x: 412, y: 400) }
        let cx = pts.map(\.x).reduce(0, +) / Double(pts.count)
        let cy = pts.map(\.y).reduce(0, +) / Double(pts.count)
        return P1FastCore.TrackPoint(x: cx, y: cy)
    }

    struct ViewTransform {
        let focus: P1FastCore.TrackPoint
        let zoom: Double
        let canvas: CGSize
        func apply(_ p: P1FastCore.TrackPoint) -> CGPoint {
            CGPoint(
                x: (p.x - focus.x) * zoom + canvas.width / 2,
                y: (p.y - focus.y) * zoom + canvas.height / 2
            )
        }
    }

    private func transform(in size: CGSize) -> ViewTransform {
        let canvasMin = min(size.width, size.height)
        let zoom = canvasMin / focusWindow
        return ViewTransform(focus: focusCenter, zoom: zoom, canvas: size)
    }

    private func findRow() -> TrackSegmentRow? {
        for (_, segs) in repo.segmentsByLayout {
            if let s = segs.first(where: { $0.id == segmentId }) {
                return s
            }
        }
        return nil
    }

    private func loadPoints() {
        defer { didLoad = true }
        let blob = repo.geometria(forSegmentId: segmentId)
        let cx = blob?.x ?? 412
        let cy = blob?.y ?? 400
        entry = blob?.entryPoint ?? P1FastCore.TrackPoint(x: cx - 60, y: cy - 60)
        apex = blob?.apexReference ?? P1FastCore.TrackPoint(x: cx, y: cy)
        exitP = blob?.exitPoint ?? P1FastCore.TrackPoint(x: cx + 50, y: cy + 50)
        existingBraking = blob?.brakingPoint  // só preserva, não edita
    }

    private func buildLookup() {
        guard let svg = layoutSvgPath else { return }
        // Resolução dobrada (4000 samples) → spacing menor, snap mais fino,
        // tremor reduzido em drag lento.
        lookup = PathMapper.buildLookup(svg, samples: 4000)
    }

    /// Snap "limpo" — O(N) sobre todas as amostras, sem mexer no cache
    /// `lookup.lastIdx`. CRÍTICO pra independência entre os 3 marcadores:
    /// `PathMapper.snap` mantém estado compartilhado (lastIdx) entre
    /// chamadas, e como cada perpTick chama snap durante render, mover
    /// um ponto polui o cache e influencia o snap dos outros. Aqui
    /// ignoramos o cache totalmente.
    private func snapClean(at lookup: PathMapper.Lookup, x: Double, y: Double) -> (offset: Double, x: Double, y: Double, idx: Int) {
        var bestD2 = Double.infinity
        var bestIdx = 0
        let pts = lookup.points
        for i in 0..<pts.count {
            let dx = pts[i].x - x
            let dy = pts[i].y - y
            let d2 = dx * dx + dy * dy
            if d2 < bestD2 {
                bestD2 = d2
                bestIdx = i
            }
        }
        let p = pts[bestIdx]
        return (p.offset, p.x, p.y, bestIdx)
    }

    /// Tangente unitária smoothed sobre janela de ±`window` amostras
    /// vizinhas. Sem smoothing, vértices do SVG path geram pulos bruscos
    /// na direção e a perpendicular tick treme. Snap usa `snapClean` pra
    /// não compartilhar estado entre marcadores.
    private func pathTangent(at p: P1FastCore.TrackPoint, window: Int = 5) -> (Double, Double)? {
        guard let lookup else { return nil }
        let s = snapClean(at: lookup, x: p.x, y: p.y)
        let n = lookup.points.count
        let idx = max(window, min(n - 1 - window, s.idx))
        let prev = lookup.points[idx - window]
        let next = lookup.points[idx + window]
        let dx = next.x - prev.x
        let dy = next.y - prev.y
        let len = (dx * dx + dy * dy).squareRoot()
        if len < 1e-6 { return (1, 0) }
        return (dx / len, dy / len)
    }

    private func snapToPath(_ p: P1FastCore.TrackPoint, lookup: PathMapper.Lookup) -> P1FastCore.TrackPoint? {
        let s = snapClean(at: lookup, x: p.x, y: p.y)
        return P1FastCore.TrackPoint(x: s.x, y: s.y)
    }

    private func save() {
        guard !saving else { return }
        saving = true
        Task { @MainActor in
            do {
                // Configurador só toca em entry/apex/exit. brakingPoint
                // é derivado retroativamente — preservamos o que tiver
                // no DB (pode ser nil se nunca foi calculado ainda).
                try await repo.updateCanonicalPoints(
                    segmentId: segmentId,
                    entry: entry, braking: existingBraking, apex: apex, exit: exitP,
                    markCalibrated: true
                )
                saving = false
                onClose?()
            } catch {
                saving = false
            }
        }
    }

    /// Salva o trecho atual e avança pro próximo (ou fecha se for o último).
    private func saveAndAdvance() {
        guard !saving else { return }
        saving = true
        Task { @MainActor in
            do {
                try await repo.updateCanonicalPoints(
                    segmentId: segmentId,
                    entry: entry, braking: existingBraking, apex: apex, exit: exitP,
                    markCalibrated: true
                )
                saving = false
                if canGoNext {
                    navigateNext()
                } else {
                    onClose?()
                }
            } catch {
                saving = false
            }
        }
    }
}
