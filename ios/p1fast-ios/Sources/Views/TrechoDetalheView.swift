// ═══════════════════════════════════════════════════════════
// TrechoDetalheView — ficha do trecho com 6 elementos (Onda 5)
// ═══════════════════════════════════════════════════════════
// Reformulação Autódromos (Flávio 2026-05-17). Q2 da clarificação:
// desenho ampliado do trecho + ficha numérica embaixo.
//
// 6 elementos por trecho:
//   • Geográficos (cadastrados): entrada, saída, ápice (1 ou 2)
//   • Dinâmicos (calculados): V-min, ponto de frenagem, PAce
//
// Pontos dinâmicos vêm de SegmentPontosDinamicos por carro+config.
// Quando não há dado suficiente (decisão E2: < 3 voltas), mostra
// mensagem curta "Aguardando mais informações pra ativar o cálculo
// dos pontos dinâmicos".

import SwiftUI
import P1FastCore
import GRDB

struct TrechoDetalheView: View {
    @EnvironmentObject private var trackRepo: TrackRepository
    let segmentId: String
    let carroId: String?
    let configuracaoId: String?

    @State private var pontos: SegmentPontosDinamicos?
    @State private var voltasContadas: Int = 0
    @State private var carregando = true
    @State private var modoAjuste = false
    @State private var tipoAjusteSelecionado: FaixaTipo = .entrada
    @State private var indiceAjusteSelecionado: Int = 0

    private var segmento: TrackSegmentRow? {
        for (_, segs) in trackRepo.segmentsByLayout {
            if let s = segs.first(where: { $0.id == segmentId }) { return s }
        }
        return nil
    }

    private var faixas: [TrackSegmentFaixa] {
        trackRepo.faixasPorSegmento[segmentId] ?? []
    }

    private var faixaEntrada: TrackSegmentFaixa? {
        faixas.first(where: { $0.tipoEnum == .entrada })
    }
    private var faixaSaida: TrackSegmentFaixa? {
        faixas.first(where: { $0.tipoEnum == .saida })
    }
    private var apices: [TrackSegmentFaixa] {
        faixas.filter { $0.tipoEnum == .apice }.sorted { $0.indice < $1.indice }
    }

    var body: some View {
        ScrollView {
            conteudo
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 100)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.surface)
        .navigationTitle(segmento?.nome ?? "Trecho")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .task(id: segmentId) { await carregar() }
        .task(id: carroId) { await carregar() }
        .task(id: configuracaoId) { await carregar() }
    }

    @ViewBuilder
    private var conteudo: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            cabecalho
            desenho
            secaoAjuste
            secaoPontos
            avisoVoltasInsuficientes
        }
    }

    /// Pendência 5 — qualquer piloto pode refinar entrada/saída/ápice.
    /// Quando em modo ajuste, tocar no desenho do trecho move o ponto
    /// selecionado pra coordenada tocada. Salva direto no banco local.
    private var secaoAjuste: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("AJUSTE DE PONTOS")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(Color.textFaint)
                Spacer()
                Button {
                    modoAjuste.toggle()
                } label: {
                    Text(modoAjuste ? "Concluir" : "Ajustar")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(modoAjuste ? Color.onAccent : Color.text)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(modoAjuste ? Color.accent : Color.surfaceHover)
                        )
                }
                .buttonStyle(.plain)
            }
            if modoAjuste {
                HStack(spacing: 8) {
                    pillTipo(.entrada, indice: 0, rotulo: "Entrada")
                    pillTipo(.saida, indice: 0, rotulo: "Saída")
                    pillTipo(.apice, indice: 0, rotulo: "Ápice 1")
                    if apices.count > 1 {
                        pillTipo(.apice, indice: 1, rotulo: "Ápice 2")
                    }
                }
                Text("Toque no desenho do trecho onde o \(tipoAjusteSelecionado.legivel.lowercased()) deve ficar.")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.textMuted)
            } else {
                Text("Toque em 'Ajustar' pra mover entrada, saída ou ápice por toque no desenho do trecho.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textMuted)
            }
        }
        .padding(14)
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

    private func pillTipo(_ tipo: FaixaTipo, indice: Int, rotulo: String) -> some View {
        let isOn = tipoAjusteSelecionado == tipo && indiceAjusteSelecionado == indice
        return Button {
            tipoAjusteSelecionado = tipo
            indiceAjusteSelecionado = indice
        } label: {
            Text(rotulo)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(isOn ? Color.onAccent : Color.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule().fill(isOn ? Color.accent : Color.surfaceHover)
                )
        }
        .buttonStyle(.plain)
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Trecho")
            Text(segmento?.nome ?? "—")
                .font(.system(size: 22, weight: .semibold))
                .tracking(-0.55)
                .foregroundStyle(Color.text)
            Text(tipoTexto)
                .font(.system(size: 12))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
    }

    private var tipoTexto: String {
        guard let g = SegmentGeometry.decode(segmento?.geometria) else { return "—" }
        var partes: [String] = []
        if let ct = g.cornerType {
            switch ct {
            case "lenta": partes.append("Curva lenta")
            case "media": partes.append("Curva média")
            case "rapida": partes.append("Curva rápida")
            default: break
            }
        }
        if !apices.isEmpty {
            partes.append("\(apices.count) ápice\(apices.count == 1 ? "" : "s")")
        }
        return partes.isEmpty ? "Geometria não calibrada" : partes.joined(separator: " · ")
    }

    /// Desenho ampliado SÓ do trecho com os 6 pontos marcados.
    /// Padrão visual baseado no Command Box Vista Piloto (Flávio
    /// 2026-05-17): fundo gradiente, asfalto cinza grosso, entrada/
    /// saída = barra dourada perpendicular à pista, ápice = pequena
    /// cabeça de alfinete creme.
    private var desenho: some View {
        let path = trackPath
        let viewBox = trackViewBox
        return ZStack {
            // Fundo gradiente igual Vista Piloto (#0a1018 → #030508).
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(LinearGradient(
                    colors: [Color(red: 10/255, green: 16/255, blue: 24/255),
                             Color(red: 3/255, green: 5/255, blue: 8/255)],
                    startPoint: .top, endPoint: .bottom
                ))
            if let p = path, let dims = viewBox, let zoom = zoomRect {
                GeometryReader { geo in
                    ZStack {
                        // Asfalto base — cinza grosso, sob o traçado fino.
                        TrackPathRecortado(
                            svgPath: p,
                            viewBoxW: dims.w,
                            viewBoxH: dims.h,
                            zoomRect: zoom
                        )
                        .stroke(Color(red: 0.20, green: 0.22, blue: 0.26),
                                style: StrokeStyle(lineWidth: 20, lineCap: .round, lineJoin: .round))

                        // Filete dourado central (rim) — referência visual.
                        TrackPathRecortado(
                            svgPath: p,
                            viewBoxW: dims.w,
                            viewBoxH: dims.h,
                            zoomRect: zoom
                        )
                        .stroke(Color(red: 0.83, green: 0.69, blue: 0.22).opacity(0.55),
                                style: StrokeStyle(lineWidth: 1, lineCap: .round, lineJoin: .round))

                        // Pendência 5 — em modo ajuste, captura toque na
                        // área pra mover o ponto selecionado.
                        if modoAjuste {
                            Color.clear
                                .contentShape(Rectangle())
                                .onTapGesture { local in
                                    let mapaCoord = telaParaMapa(
                                        x: local.x, y: local.y,
                                        dims: dims, zoom: zoom, geo: geo
                                    )
                                    Task {
                                        try? await trackRepo.moverFaixa(
                                            segmentId: segmentId,
                                            tipo: tipoAjusteSelecionado,
                                            indice: indiceAjusteSelecionado,
                                            x: mapaCoord.x, y: mapaCoord.y
                                        )
                                    }
                                }
                        }

                        // Entrada e Saída — barras douradas perpendiculares
                        // à pista (padrão Vista Piloto, decisão Flávio).
                        ForEach(faixas, id: \.id) { f in
                            switch f.tipoEnum {
                            case .entrada, .saida:
                                faixaBarra(f, dims: dims, zoom: zoom, geo: geo)
                            case .apice:
                                faixaApice(f, dims: dims, zoom: zoom, geo: geo)
                            case nil:
                                EmptyView()
                            }
                        }
                        // Pontos dinâmicos — bolinhas pequenas com letra
                        // sobre a pista (V/F/P), só aparecem com dado real.
                        if let pd = pontos {
                            if let vp = vminPosicaoFinal(pd, dims: dims, zoom: zoom, geo: geo) {
                                pontoDinamico("V", cor: .ouro, em: vp)
                            }
                            if let fp = frenagemPosicaoFinal(pd, dims: dims, zoom: zoom, geo: geo) {
                                pontoDinamico("F", cor: .erro, em: fp)
                            }
                            if let pp = pacePosicaoFinal(pd, dims: dims, zoom: zoom, geo: geo) {
                                pontoDinamico("A", cor: .bom, em: pp)
                            }
                        }
                    }
                }
            } else {
                Text("Mapa não cadastrado")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
            }
        }
        .frame(height: 220)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    /// Calcula a direção tangente do traçado no ponto da faixa, pra
    /// orientar a barra perpendicular. Como aproximação razoável,
    /// usa o vetor da faixa em direção ao ápice (que está sempre por
    /// dentro da curva). Pra ápice 1 / ápice 2, fallback é vertical.
    private func direcaoPista(em f: TrackSegmentFaixa) -> CGVector {
        // Se for entrada ou saída, mira no ápice 0 do mesmo trecho.
        if f.tipoEnum != .apice, let apice = apices.first {
            let dx = CGFloat(apice.x - f.x)
            let dy = CGFloat(apice.y - f.y)
            let len = sqrt(dx*dx + dy*dy)
            if len > 0.001 { return CGVector(dx: dx/len, dy: dy/len) }
        }
        // Fallback: vetor unitário pra cima (raramente vai cair aqui).
        return CGVector(dx: 0, dy: -1)
    }

    private var trackPath: String? {
        guard let layId = segmento?.layoutId else { return nil }
        return trackRepo.layouts(forTrackId: trackRepo.tracks.first?.id ?? "")
            .first(where: { $0.id == layId })?.svgPath
    }

    private var trackViewBox: (w: CGFloat, h: CGFloat)? {
        guard let layId = segmento?.layoutId,
              let lay = trackRepo.layouts(forTrackId: trackRepo.tracks.first?.id ?? "")
                .first(where: { $0.id == layId }),
              let json = lay.viewBox,
              let data = json.data(using: .utf8) else { return nil }
        struct V: Decodable { let w: Double; let h: Double }
        if let v = try? JSONDecoder().decode(V.self, from: data) {
            return (CGFloat(v.w), CGFloat(v.h))
        }
        return nil
    }

    /// Caixa do zoom (coordenadas do viewBox) — engloba todos os pontos
    /// (faixas + ápice geométrico) com folga de 50 unidades de cada lado.
    private var zoomRect: CGRect? {
        guard let seg = segmento, let g = SegmentGeometry.decode(seg.geometria) else { return nil }
        var xs: [CGFloat] = [CGFloat(g.x)]
        var ys: [CGFloat] = [CGFloat(g.y)]
        for f in faixas { xs.append(CGFloat(f.x)); ys.append(CGFloat(f.y)) }
        if let pd = pontos {
            if let vx = pd.vminX, let vy = pd.vminY { xs.append(CGFloat(vx)); ys.append(CGFloat(vy)) }
            if let fx = pd.frenagemX, let fy = pd.frenagemY { xs.append(CGFloat(fx)); ys.append(CGFloat(fy)) }
            if let px = pd.paceX, let py = pd.paceY { xs.append(CGFloat(px)); ys.append(CGFloat(py)) }
        }
        guard let minX = xs.min(), let maxX = xs.max(),
              let minY = ys.min(), let maxY = ys.max() else { return nil }
        let folga: CGFloat = 50
        return CGRect(
            x: minX - folga,
            y: minY - folga,
            width: (maxX - minX) + folga * 2,
            height: (maxY - minY) + folga * 2
        )
    }

    private func mapaParaTela(x: CGFloat, y: CGFloat,
                              dims: (w: CGFloat, h: CGFloat),
                              zoom: CGRect, geo: GeometryProxy) -> CGPoint {
        let scale = min(geo.size.width / zoom.width, geo.size.height / zoom.height)
        let offsetX = (geo.size.width - zoom.width * scale) / 2.0 - zoom.minX * scale
        let offsetY = (geo.size.height - zoom.height * scale) / 2.0 - zoom.minY * scale
        return CGPoint(x: offsetX + x * scale, y: offsetY + y * scale)
    }

    /// Inverso da mapaParaTela — converte toque na tela em coordenada do
    /// viewBox da pista. Usado pelo modo ajuste pra mover faixas com toque.
    private func telaParaMapa(x: CGFloat, y: CGFloat,
                              dims: (w: CGFloat, h: CGFloat),
                              zoom: CGRect, geo: GeometryProxy) -> CGPoint {
        let scale = min(geo.size.width / zoom.width, geo.size.height / zoom.height)
        let offsetX = (geo.size.width - zoom.width * scale) / 2.0 - zoom.minX * scale
        let offsetY = (geo.size.height - zoom.height * scale) / 2.0 - zoom.minY * scale
        return CGPoint(x: (x - offsetX) / scale, y: (y - offsetY) / scale)
    }

    /// Entrada e Saída — barra dourada PERPENDICULAR ao traçado da pista.
    /// Padrão Vista Piloto: linha amarelinha cruzando, igual à linha de
    /// chegada/largada. Comprimento ~22 unidades do viewBox (cobre o asfalto).
    @ViewBuilder
    private func faixaBarra(_ f: TrackSegmentFaixa,
                            dims: (w: CGFloat, h: CGFloat),
                            zoom: CGRect, geo: GeometryProxy) -> some View {
        let centro = mapaParaTela(x: CGFloat(f.x), y: CGFloat(f.y),
                                  dims: dims, zoom: zoom, geo: geo)
        let escala = min(geo.size.width / zoom.width, geo.size.height / zoom.height)
        // Comprimento da barra em unidades do viewBox, depois aplica escala
        // pra ficar do tamanho do asfalto na tela.
        let comprimentoMapa: CGFloat = 22
        let metade = comprimentoMapa * escala / 2.0
        // Vetor da pista no ponto (entrada→ápice ou saída→ápice).
        let dir = direcaoPista(em: f)
        // Perpendicular: gira 90°.
        let perpX = -dir.dy
        let perpY = dir.dx
        let p1 = CGPoint(x: centro.x + perpX * metade, y: centro.y + perpY * metade)
        let p2 = CGPoint(x: centro.x - perpX * metade, y: centro.y - perpY * metade)
        let cor = Color(red: 0.83, green: 0.69, blue: 0.22) // ouro Vista Piloto

        ZStack {
            Path { p in p.move(to: p1); p.addLine(to: p2) }
                .stroke(cor, style: StrokeStyle(lineWidth: 3, lineCap: .round))
            // Letra pequena ao lado da barra pra identificar (E ou S).
            let label = f.tipoEnum == .entrada ? "E" : "S"
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(cor)
                .position(x: centro.x + dir.dx * (metade + 8),
                          y: centro.y + dir.dy * (metade + 8))
        }
    }

    /// Ápice — cabeça de alfinete creme/dourada (pequena, por dentro
    /// da pista). Padrão canônico do Vista Piloto.
    @ViewBuilder
    private func faixaApice(_ f: TrackSegmentFaixa,
                            dims: (w: CGFloat, h: CGFloat),
                            zoom: CGRect, geo: GeometryProxy) -> some View {
        let pos = mapaParaTela(x: CGFloat(f.x), y: CGFloat(f.y),
                               dims: dims, zoom: zoom, geo: geo)
        let cremoso = Color(red: 0.96, green: 0.87, blue: 0.66)  // #F5DFA8
        let dourado = Color(red: 0.91, green: 0.79, blue: 0.48)  // #E8C97A
        ZStack {
            // Anel escuro (respiro pro glow)
            Circle().fill(Color.black.opacity(0.62))
                .frame(width: 14, height: 14)
            // Halo dourado pulsante
            Circle().stroke(dourado, lineWidth: 1.2)
                .frame(width: 11, height: 11)
            // Cabeça cremosa
            Circle().fill(cremoso)
                .frame(width: 7, height: 7)
            // Etiqueta "1" ou "2" pequena ao lado quando houver 2 ápices.
            if apices.count > 1 {
                Text("\(f.indice + 1)")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(cremoso)
                    .position(x: pos.x + 12, y: pos.y - 6)
            }
        }
        .position(x: pos.x, y: pos.y)
    }

    private func pontoDinamico(_ letra: String, cor: Color, em pos: CGPoint) -> some View {
        ZStack {
            Circle().fill(cor).frame(width: 22, height: 22)
            Text(letra)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.onAccent)
        }
        .position(x: pos.x, y: pos.y)
    }

    private func vminPosicaoFinal(_ pd: SegmentPontosDinamicos,
                                  dims: (w: CGFloat, h: CGFloat),
                                  zoom: CGRect, geo: GeometryProxy) -> CGPoint? {
        guard let x = pd.vminX, let y = pd.vminY else { return nil }
        return mapaParaTela(x: CGFloat(x), y: CGFloat(y), dims: dims, zoom: zoom, geo: geo)
    }
    private func frenagemPosicaoFinal(_ pd: SegmentPontosDinamicos,
                                      dims: (w: CGFloat, h: CGFloat),
                                      zoom: CGRect, geo: GeometryProxy) -> CGPoint? {
        guard let x = pd.frenagemX, let y = pd.frenagemY else { return nil }
        return mapaParaTela(x: CGFloat(x), y: CGFloat(y), dims: dims, zoom: zoom, geo: geo)
    }
    private func pacePosicaoFinal(_ pd: SegmentPontosDinamicos,
                                  dims: (w: CGFloat, h: CGFloat),
                                  zoom: CGRect, geo: GeometryProxy) -> CGPoint? {
        guard let x = pd.paceX, let y = pd.paceY else { return nil }
        return mapaParaTela(x: CGFloat(x), y: CGFloat(y), dims: dims, zoom: zoom, geo: geo)
    }

    // ── Ficha numérica dos 6 elementos ────────────────────────
    private var secaoPontos: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("6 PONTOS DO TRECHO")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.5)
                .foregroundStyle(Color.textFaint)

            linhaPonto(letra: "E", cor: .accent, titulo: "Entrada",
                       valor: faixaEntrada.map { coordTexto($0.x, $0.y) } ?? "Não cadastrada")
            linhaPonto(letra: "S", cor: .atencao, titulo: "Saída",
                       valor: faixaSaida.map { coordTexto($0.x, $0.y) } ?? "Não cadastrada")
            ForEach(Array(apices.enumerated()), id: \.element.id) { idx, ap in
                linhaPonto(letra: "A", cor: .text,
                           titulo: apices.count > 1 ? "Ápice \(idx + 1)" : "Ápice",
                           valor: coordTexto(ap.x, ap.y))
            }
            if apices.isEmpty {
                linhaPonto(letra: "A", cor: .text, titulo: "Ápice",
                           valor: "Não cadastrado")
            }
            linhaPonto(letra: "V", cor: .ouro, titulo: "V-min",
                       valor: pontos?.vminKmh.map { String(format: "%.0f km/h", $0) }
                       ?? "Aguardando dados")
            linhaPonto(letra: "F", cor: .erro, titulo: "Ponto de frenagem",
                       valor: pontos?.frenagemX != nil
                       ? coordTexto(pontos!.frenagemX!, pontos!.frenagemY ?? 0)
                       : "Aguardando dados")
            linhaPonto(letra: "P", cor: .bom, titulo: "PAce (volta a fundo)",
                       valor: pontos?.paceX != nil
                       ? coordTexto(pontos!.paceX!, pontos!.paceY ?? 0)
                       : "Aguardando dados")
        }
        .padding(14)
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

    private func linhaPonto(letra: String, cor: Color, titulo: String, valor: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(cor.opacity(0.18)).frame(width: 26, height: 26)
                Text(letra).font(.system(size: 11, weight: .bold)).foregroundStyle(cor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(titulo)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text(valor)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textMuted)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 6)
    }

    private func coordTexto(_ x: Double, _ y: Double) -> String {
        String(format: "x %.0f · y %.0f", x, y)
    }

    @ViewBuilder
    private var avisoVoltasInsuficientes: some View {
        if pontos == nil && carroId != nil && configuracaoId != nil {
            HelperNote(text: "Aguardando mais informações pra ativar o cálculo dos pontos dinâmicos. São necessárias \(PontosDinamicosCalculo.minVoltasParaCalcular) voltas válidas deste trecho com este carro + configuração (até agora: \(voltasContadas)).")
                .padding(.top, Spacing.sm)
        } else if carroId == nil || configuracaoId == nil {
            HelperNote(text: "Escolha um carro e uma configuração no autódromo pra ver os pontos dinâmicos (V-min, ponto de frenagem, PAce) deste trecho.")
                .padding(.top, Spacing.sm)
        }
    }

    @MainActor
    private func carregar() async {
        carregando = true
        guard let cid = carroId, let cfgId = configuracaoId else {
            pontos = nil
            voltasContadas = 0
            carregando = false
            return
        }
        let queue = trackRepo.queue
        let segId = segmentId
        do {
            let (pd, n) = try await queue.read { db -> (SegmentPontosDinamicos?, Int) in
                let p = try SegmentPontosDinamicos
                    .filter(Column("segment_id") == segId)
                    .filter(Column("carro_id") == cid)
                    .filter(Column("configuracao_id") == cfgId)
                    .fetchOne(db)
                let n = try Int.fetchOne(db, sql: """
                    SELECT COUNT(DISTINCT se.volta_id)
                    FROM segment_executions se
                    JOIN sessoes s ON s.id = se.sessao_id
                    JOIN voltas v ON v.id = se.volta_id
                    WHERE se.segment_id = ?
                      AND s.carro_id = ?
                      AND s.configuracao_id = ?
                      AND v.valida = 1
                """, arguments: [segId, cid, cfgId]) ?? 0
                return (p, n)
            }
            pontos = pd
            voltasContadas = n
        } catch {
            pontos = nil
            voltasContadas = 0
        }
        carregando = false
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - TrackPathRecortado (zoom no trecho)
// ═══════════════════════════════════════════════════════════

/// Renderiza o path SVG dentro de uma sub-região (`zoomRect`) do viewBox.
/// Cordas / inicial: mesmo parser do `CircuitoShape` mas mapeado pra
/// caixa de zoom, mostrando só a porção da pista perto do trecho.
struct TrackPathRecortado: Shape {
    let svgPath: String
    let viewBoxW: CGFloat
    let viewBoxH: CGFloat
    let zoomRect: CGRect

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let scale = min(rect.width / zoomRect.width, rect.height / zoomRect.height)
        let offsetX = (rect.width - zoomRect.width * scale) / 2.0 - zoomRect.minX * scale
        let offsetY = (rect.height - zoomRect.height * scale) / 2.0 - zoomRect.minY * scale

        var tokens = svgPath.split(whereSeparator: { $0 == " " || $0 == "," }).map(String.init)
        var i = 0
        var ultimo: Character = "M"
        while i < tokens.count {
            let t = tokens[i]
            let primeiro = t.first ?? Character("?")
            if "MLZmlz".contains(primeiro) {
                ultimo = primeiro
                if primeiro == "Z" || primeiro == "z" {
                    path.closeSubpath()
                    i += 1
                    continue
                }
                let resto = String(t.dropFirst())
                if !resto.isEmpty, let x = Double(resto), i + 1 < tokens.count, let y = Double(tokens[i + 1]) {
                    let p = CGPoint(x: offsetX + CGFloat(x) * scale, y: offsetY + CGFloat(y) * scale)
                    if ultimo == "M" || ultimo == "m" { path.move(to: p) }
                    else { path.addLine(to: p) }
                    i += 2
                    continue
                }
                i += 1
            } else if let x = Double(t), i + 1 < tokens.count, let y = Double(tokens[i + 1]) {
                let p = CGPoint(x: offsetX + CGFloat(x) * scale, y: offsetY + CGFloat(y) * scale)
                if ultimo == "M" { path.move(to: p); ultimo = "L" }
                else if ultimo == "m" { path.move(to: p); ultimo = "l" }
                else { path.addLine(to: p) }
                i += 2
            } else {
                i += 1
            }
        }
        return path
    }
}
