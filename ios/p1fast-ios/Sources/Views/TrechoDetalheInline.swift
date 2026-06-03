// ═══════════════════════════════════════════════════════════
// TrechoDetalheInline — ficha do trecho embutida (sem nav própria)
// ═══════════════════════════════════════════════════════════
// 2026-05-17 (Flávio "mapa em cima, dados embaixo"). Versão da
// TrechoDetalheView pra usar DENTRO de AutodromoDetalheView, sem
// header próprio e sem cabeçalho de navegação (já vivem no autódromo).
//
// Mesma lógica de:
//   - desenho ampliado do trecho com padrão Vista Piloto (asfalto
//     cinza + filete dourado + entrada/saída como barras + ápice
//     como cabeça de alfinete)
//   - ficha numérica dos 6 elementos
//   - modo "Ajustar" pra mover entrada/saída/ápice por toque
//   - aviso "Aguardando dados" quando faltam voltas
//
// Só muda: sem NavigationTitle, sem cabeçalho de página.

import SwiftUI
import P1FastCore
import GRDB

struct TrechoDetalheInline: View {
    @EnvironmentObject private var trackRepo: TrackRepository
    let segmentId: String
    let carroId: String?
    let configuracaoId: String?

    @State private var pontos: SegmentPontosDinamicos?
    @State private var voltasContadas: Int = 0
    @State private var modoAjuste = false
    @State private var tipoAjusteSelecionado: FaixaTipo = .entrada
    @State private var indiceAjusteSelecionado: Int = 0
    /// 2026-05-17 (Flávio cobrou 3× "ponto volta pra posição"):
    /// posição em curso e final de cada ponto sendo arrastado.
    /// Guardada em coordenadas DO MAPA. Sobrescreve f.x/f.y no render
    /// enquanto o arrasto está rolando E até o banco confirmar a nova
    /// posição.
    @State private var posicaoLocal: [String: CGPoint] = [:]

    /// 2026-05-17 (auditor externo): posição inicial do ponto (coord
    /// do mapa) no momento que o arrasto começa. Usado pra calcular
    /// nova posição via TRANSLATION (delta), evitando o bug de
    /// "location vira startLocation quando ScrollView cancela o gesto".
    @State private var inicioArrasto: [String: CGPoint] = [:]

    /// 2026-05-17 (Flávio "clico em cima e não enxerga"): id do ponto
    /// atualmente selecionado. Quando preenchido, mostra um anel grande
    /// ao redor do ponto + label "Arraste pra mover" — área de toque
    /// generosa que resolve o problema de "não pega o toque".
    @State private var pontoSelecionadoId: String? = nil

    /// Callback opcional pro pai saber quando o gestor está em modo
    /// Ajuste (pra travar a rolagem da página e evitar conflito).
    var onModoAjusteChange: ((Bool) -> Void)? = nil

    private var segmento: TrackSegmentRow? {
        for (_, segs) in trackRepo.segmentsByLayout {
            if let s = segs.first(where: { $0.id == segmentId }) { return s }
        }
        return nil
    }

    private var faixas: [TrackSegmentFaixa] {
        trackRepo.faixasPorSegmento[segmentId] ?? []
    }

    private var apices: [TrackSegmentFaixa] {
        faixas.filter { $0.tipoEnum == .apice }.sorted { $0.indice < $1.indice }
    }
    private var faixaEntrada: TrackSegmentFaixa? {
        faixas.first(where: { $0.tipoEnum == .entrada })
    }
    private var faixaSaida: TrackSegmentFaixa? {
        faixas.first(where: { $0.tipoEnum == .saida })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            tituloLocal
            desenho
            secaoAjuste
            secaoPontos
            avisoVoltasInsuficientes
        }
        .task(id: segmentId) { await carregar() }
        .task(id: carroId) { await carregar() }
        .task(id: configuracaoId) { await carregar() }
        // 2026-05-17 — quando o banco atualiza a posição da faixa,
        // remove o override local pra deixar a posição persistida
        // assumir. Tolerância pequena pra cobrir arredondamento.
        .onChange(of: faixas.map { [$0.id, $0.x, $0.y] as [AnyHashable] }) { _, _ in
            // Limpa overrides locais — banco confirmou nova posição.
            // Tolerância 16 unidades do mapa (arredondamento + retorno
            // do reload pode chegar com pequena diferença).
            var novoMapa = posicaoLocal
            for f in faixas {
                if let local = novoMapa[f.id] {
                    let dx = Double(local.x) - f.x
                    let dy = Double(local.y) - f.y
                    if (dx * dx + dy * dy) < 16.0 {
                        novoMapa.removeValue(forKey: f.id)
                    }
                }
            }
            if novoMapa.count != posicaoLocal.count { posicaoLocal = novoMapa }
        }
        // Limpa override quando troca de trecho (ou desseleciona).
        // 2026-05-17 (Flávio "ápice volta quando clica em outro"):
        // NÃO limpamos mais ao mudar `pontoSelecionadoId` — antes
        // limpávamos e isso fazia o ponto voltar pra coord antiga
        // enquanto o banco ainda não tinha confirmado a nova. Agora
        // só o `.onChange(of: faixas)` (que dispara quando o banco
        // atualiza) limpa o override.
        .onChange(of: segmentId) { _, _ in posicaoLocal = [:]; pontoSelecionadoId = nil }
    }

    private var tituloLocal: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(segmento?.nome ?? "Trecho")
                .font(.system(size: 19, weight: .semibold))
                .tracking(-0.4)
                .foregroundStyle(Color.text)
            Text(tipoTexto)
                .font(.system(size: 12))
                .foregroundStyle(Color.textMuted)
        }
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

    // ─────────────────────────────────────────────────────────
    // Desenho ampliado do trecho (padrão Vista Piloto)
    // ─────────────────────────────────────────────────────────
    private var desenho: some View {
        let path = trackPath
        let viewBox = trackViewBox
        return ZStack {
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(LinearGradient(
                    colors: [Color(red: 10/255, green: 16/255, blue: 24/255),
                             Color(red: 3/255, green: 5/255, blue: 8/255)],
                    startPoint: .top, endPoint: .bottom
                ))
            if path != nil, let dims = viewBox, let zoom = zoomRect {
                GeometryReader { geo in
                    ZStack {
                        // 2026-05-17 (Flávio cobrou 3 vezes): a pista é
                        // FIXA — desenhamos o traçado real do autódromo
                        // (o path SVG oficial), mas filtrando: cada
                        // pedaço do traçado é desenhado SÓ se o trecho
                        // mais próximo for o atual. Isso elimina os
                        // ressaltos de curvas vizinhas que apareciam
                        // dentro do retângulo do zoom, mantendo o desenho
                        // da pista INTACTO. Arrastar os pontos E/S/A não
                        // altera mais o desenho.
                        // 2026-05-17 (Flávio "tocar fora desmarca"):
                        // camada de toque no fundo do desenho — se o
                        // gesto for um toque sem arrastar e ninguém
                        // estiver com gesto de ponto, limpa a seleção.
                        Color.black.opacity(0.001)
                            .contentShape(Rectangle())
                            .onTapGesture { pontoSelecionadoId = nil }
                        TrechoFatiado(
                            zoomRect: zoom,
                            pontosTrecho: pistaDoTrecho.pontos,
                            indicesNoPath: pistaDoTrecho.indices
                        )
                            .stroke(Color(red: 0.20, green: 0.22, blue: 0.26),
                                    style: StrokeStyle(lineWidth: 32, lineCap: .round, lineJoin: .round))
                            .allowsHitTesting(false)
                        TrechoFatiado(
                            zoomRect: zoom,
                            pontosTrecho: pistaDoTrecho.pontos,
                            indicesNoPath: pistaDoTrecho.indices
                        )
                            .stroke(Color(red: 0.83, green: 0.69, blue: 0.22).opacity(0.55),
                                    style: StrokeStyle(lineWidth: 1, lineCap: .round, lineJoin: .round))
                            .allowsHitTesting(false)
                        // 2026-05-17 (Flávio "arrastar com o dedo, sem ser
                        // por linha X/Y"): cada ponto (E/S/A) recebe seu
                        // próprio DragGesture. Pílula de tipo selecionado
                        // sumiu — agora você toca direto no ponto e arrasta.
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
                        if let pd = pontos {
                            if let vp = vminPos(pd, dims: dims, zoom: zoom, geo: geo) {
                                pontoDinamico("V", cor: .ouro, em: vp)
                            }
                            if let fp = frenagemPos(pd, dims: dims, zoom: zoom, geo: geo) {
                                pontoDinamico("F", cor: .erro, em: fp)
                            }
                            if let pp = pacePos(pd, dims: dims, zoom: zoom, geo: geo) {
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
        // 2026-05-17 (Flávio "ver mais pista"): quadro maior (220 → 360pt)
        // pra a pista ocupar mais espaço físico.
        .frame(height: 360)
        .coordinateSpace(name: "desenhoTrecho")
        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
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

    /// Centro do trecho atual em coordenadas do mapa. Usado pra "Voronoi"
    /// do desenho da pista — cada pedaço do path SVG só é desenhado se
    /// o trecho mais próximo for este.
    private var centroDoTrechoAtual: CGPoint {
        if let g = SegmentGeometry.decode(segmento?.geometria) {
            return CGPoint(x: g.x, y: g.y)
        }
        return .zero
    }

    /// Centros de TODOS os outros segments do mesmo layout (incluindo retas
    /// — pra que retas distantes não "puxem" o desenho do trecho atual
    /// pra elas). Em coords do mapa.
    private var centrosDosOutrosTrechos: [CGPoint] {
        guard let layId = segmento?.layoutId else { return [] }
        let outros = trackRepo.segments(forLayoutId: layId)
            .filter { $0.id != segmentId }
        return outros.compactMap { s in
            guard let g = SegmentGeometry.decode(s.geometria) else { return nil }
            return CGPoint(x: g.x, y: g.y)
        }
    }

    /// Lista de pontos do traçado pertencentes ao trecho atual (Voronoi).
    /// Usada pra projetar arrastos no traçado real e calcular tangentes.
    private var pistaDoTrecho: PistaParseada {
        guard let svg = trackPath else { return PistaParseada(pontos: [], indices: []) }
        return PistaParseada.parsear(svgPath: svg,
                                     centroAtual: centroDoTrechoAtual,
                                     centrosOutros: centrosDosOutrosTrechos)
    }

    /// Índice local no traçado da posição atual de uma faixa.
    private func indiceLocalDe(_ f: TrackSegmentFaixa) -> Int? {
        let p = CGPoint(x: f.x, y: f.y)
        return pistaDoTrecho.projetar(p)?.indiceLocal
    }

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
        // 2026-05-17 (Flávio "20% maior, mais antes da entrada e
        // depois da saída"): folga 90.
        let folga: CGFloat = 90
        return CGRect(x: minX - folga, y: minY - folga,
                      width: (maxX - minX) + folga * 2,
                      height: (maxY - minY) + folga * 2)
    }

    private func mapaParaTela(x: CGFloat, y: CGFloat, dims: (w: CGFloat, h: CGFloat),
                              zoom: CGRect, geo: GeometryProxy) -> CGPoint {
        let scale = min(geo.size.width / zoom.width, geo.size.height / zoom.height)
        let offsetX = (geo.size.width - zoom.width * scale) / 2.0 - zoom.minX * scale
        let offsetY = (geo.size.height - zoom.height * scale) / 2.0 - zoom.minY * scale
        return CGPoint(x: offsetX + x * scale, y: offsetY + y * scale)
    }

    private func telaParaMapa(x: CGFloat, y: CGFloat, dims: (w: CGFloat, h: CGFloat),
                              zoom: CGRect, geo: GeometryProxy) -> CGPoint {
        let scale = min(geo.size.width / zoom.width, geo.size.height / zoom.height)
        let offsetX = (geo.size.width - zoom.width * scale) / 2.0 - zoom.minX * scale
        let offsetY = (geo.size.height - zoom.height * scale) / 2.0 - zoom.minY * scale
        return CGPoint(x: (x - offsetX) / scale, y: (y - offsetY) / scale)
    }

    private func direcaoPista(em f: TrackSegmentFaixa) -> CGVector {
        // 2026-05-17 — perpendicular REAL ao traçado: usa a tangente
        // do path SVG no ponto mais próximo da faixa.
        let pos = posicaoMapa(f)
        if let projecao = pistaDoTrecho.projetar(pos) {
            return pistaDoTrecho.tangente(no: projecao.indiceLocal)
        }
        // Fallback antigo (reta entrada↔ápice) caso o parse falhe.
        if f.tipoEnum != .apice, let apice = apices.first {
            let dx = CGFloat(apice.x - f.x)
            let dy = CGFloat(apice.y - f.y)
            let len = sqrt(dx*dx + dy*dy)
            if len > 0.001 { return CGVector(dx: dx/len, dy: dy/len) }
        }
        return CGVector(dx: 0, dy: -1)
    }

    /// Posição da faixa em coords do MAPA, considerando o override local
    /// se o gestor está arrastando (ou acabou de arrastar e o banco ainda
    /// não confirmou).
    private func posicaoMapa(_ f: TrackSegmentFaixa) -> CGPoint {
        if let override = posicaoLocal[f.id] { return override }
        return CGPoint(x: f.x, y: f.y)
    }

    private func faixaBarra(_ f: TrackSegmentFaixa, dims: (w: CGFloat, h: CGFloat),
                            zoom: CGRect, geo: GeometryProxy) -> some View {
        let pm = posicaoMapa(f)
        let centro = mapaParaTela(x: pm.x, y: pm.y,
                                  dims: dims, zoom: zoom, geo: geo)
        let escala = min(geo.size.width / zoom.width, geo.size.height / zoom.height)
        let metade = 22 * escala / 2.0
        let dir = direcaoPista(em: f)
        let perpX = -dir.dy
        let perpY = dir.dx
        let cor = Color(red: 0.83, green: 0.69, blue: 0.22)
        let isSelecionado = pontoSelecionadoId == f.id
        // 2026-05-17 (Flávio "toque perto já ativa"): área de toque
        // não-selecionado reduzida de 56pt pra 40pt — mais precisão.
        let metadeAnel: CGFloat = isSelecionado ? 60 : 20
        let p1 = CGPoint(x: metadeAnel + perpX * metade, y: metadeAnel + perpY * metade)
        let p2 = CGPoint(x: metadeAnel - perpX * metade, y: metadeAnel - perpY * metade)
        return ZStack {
            if isSelecionado {
                Circle()
                    .fill(Color.accent.opacity(0.15))
                    .overlay(Circle().stroke(Color.accent, lineWidth: 2))
                    .frame(width: 120, height: 120)
                    .contentShape(Circle())
                Text("Arraste pra mover")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.accent)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(Color.surface))
                    .offset(y: -80)
                    .allowsHitTesting(false)
            } else {
                Circle()
                    .fill(Color.clear)
                    .contentShape(Circle())
                    .frame(width: 40, height: 40)
            }
            Path { p in p.move(to: p1); p.addLine(to: p2) }
                .stroke(cor, style: StrokeStyle(lineWidth: isSelecionado ? 5 : 3, lineCap: .round))
                .allowsHitTesting(false)
            Text(f.tipoEnum == .entrada ? "E" : "S")
                .font(.system(size: isSelecionado ? 14 : 11, weight: .bold))
                .foregroundStyle(cor)
                .position(x: metadeAnel + dir.dx * (metade + 10),
                          y: metadeAnel + dir.dy * (metade + 10))
                .allowsHitTesting(false)
        }
        .frame(width: isSelecionado ? 120 : 40, height: isSelecionado ? 120 : 40)
        .position(x: centro.x, y: centro.y)
        .highPriorityGesture(gestoCombinadoToqueArrasto(para: f, dims: dims, zoom: zoom, geo: geo))
    }

    @ViewBuilder
    private func faixaApice(_ f: TrackSegmentFaixa, dims: (w: CGFloat, h: CGFloat),
                            zoom: CGRect, geo: GeometryProxy) -> some View {
        let pm = posicaoMapa(f)
        let pos = mapaParaTela(x: pm.x, y: pm.y, dims: dims, zoom: zoom, geo: geo)
        let cremoso = Color(red: 0.96, green: 0.87, blue: 0.66)
        let dourado = Color(red: 0.91, green: 0.79, blue: 0.48)
        let isSelecionado = pontoSelecionadoId == f.id
        let lado: CGFloat = isSelecionado ? 120 : 40
        ZStack {
            if isSelecionado {
                Circle()
                    .fill(Color.accent.opacity(0.15))
                    .overlay(Circle().stroke(Color.accent, lineWidth: 2))
                    .frame(width: 120, height: 120)
                    .contentShape(Circle())
                Text("Arraste pra mover")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.accent)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(Color.surface))
                    .offset(y: -80)
                    .allowsHitTesting(false)
            } else {
                Circle()
                    .fill(Color.clear)
                    .contentShape(Circle())
                    .frame(width: 40, height: 40)
            }
            // 2026-05-17 (Flávio "bolinha selecionada pela metade"):
            // ápice selecionado mantém o tamanho normal — a área de
            // toque vem do anel azul de 120pt em volta. Visualmente
            // SEMPRE pequeno (9pt), pra não esconder a pista.
            Circle().fill(Color.black.opacity(0.62)).frame(width: 9, height: 9)
                .allowsHitTesting(false)
            Circle().stroke(dourado, lineWidth: 1.2).frame(width: 7, height: 7)
                .allowsHitTesting(false)
            Circle().fill(cremoso).frame(width: 4, height: 4)
                .allowsHitTesting(false)
            if apices.count > 1 {
                Text("\(f.indice + 1)")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(cremoso)
                    .offset(x: 14, y: -12)
                    .allowsHitTesting(false)
            }
        }
        .frame(width: lado, height: lado)
        .position(x: pos.x, y: pos.y)
        .highPriorityGesture(gestoCombinadoToqueArrasto(para: f, dims: dims, zoom: zoom, geo: geo))
    }

    /// Gesto que combina TOQUE (seleciona) + ARRASTAR (move).
    /// • Toque curto (mag ≤ 4 pt): seleciona o ponto.
    /// • Arrasto (mag > 4 pt): move o ponto se já estava selecionado;
    ///   ignora se não estava (precisa de 1 toque pra selecionar antes).
    /// Resolve a queixa "clico em cima e ele não enxerga onde está".
    private func gestoCombinadoToqueArrasto(para f: TrackSegmentFaixa,
                                             dims: (w: CGFloat, h: CGFloat),
                                             zoom: CGRect,
                                             geo: GeometryProxy) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("desenhoTrecho"))
            .onChanged { value in
                guard pontoSelecionadoId == f.id else { return }
                // 2026-05-17 (Flávio "salta quando clico"): toque com
                // movimento < 4 pt é TOQUE PURO, não arrasto. Só mexe
                // visualmente quando passa esse limiar. Antes pequenos
                // arrastinhos involuntários moviam o ponto.
                let mag = hypot(value.translation.width, value.translation.height)
                guard mag > 4 else { return }
                if inicioArrasto[f.id] == nil {
                    inicioArrasto[f.id] = CGPoint(x: f.x, y: f.y)
                }
                guard let inicio = inicioArrasto[f.id] else { return }
                let scale = min(geo.size.width / zoom.width, geo.size.height / zoom.height)
                guard scale > 0 else { return }
                let dxMapa = value.translation.width / scale
                let dyMapa = value.translation.height / scale
                let mapaDestino = CGPoint(x: inicio.x + dxMapa, y: inicio.y + dyMapa)
                if let alvo = aplicarRegrasDeArrasto(para: f, dedoNoMapa: mapaDestino) {
                    posicaoLocal[f.id] = alvo
                }
            }
            .onEnded { value in
                let mag = hypot(value.translation.width, value.translation.height)
                if mag <= 4 {
                    // Toque puro — seleciona/desseleciona.
                    pontoSelecionadoId = (pontoSelecionadoId == f.id) ? nil : f.id
                    posicaoLocal.removeValue(forKey: f.id)
                    inicioArrasto.removeValue(forKey: f.id)
                    return
                }
                defer { inicioArrasto.removeValue(forKey: f.id) }
                guard pontoSelecionadoId == f.id, let inicio = inicioArrasto[f.id] else {
                    posicaoLocal.removeValue(forKey: f.id)
                    return
                }
                let scale = min(geo.size.width / zoom.width, geo.size.height / zoom.height)
                guard scale > 0 else {
                    posicaoLocal.removeValue(forKey: f.id)
                    return
                }
                let dxMapa = value.translation.width / scale
                let dyMapa = value.translation.height / scale
                let mapaDestino = CGPoint(x: inicio.x + dxMapa, y: inicio.y + dyMapa)
                guard let alvo = aplicarRegrasDeArrasto(para: f, dedoNoMapa: mapaDestino) else {
                    posicaoLocal.removeValue(forKey: f.id)
                    return
                }
                posicaoLocal[f.id] = alvo
                let novoX = Double(alvo.x)
                let novoY = Double(alvo.y)
                let tipo = f.tipoEnum ?? .entrada
                let indice = f.indice
                let segId = segmentId
                let repo = trackRepo
                Task { @MainActor in
                    try? await repo.moverFaixa(
                        segmentId: segId, tipo: tipo, indice: indice,
                        x: novoX, y: novoY
                    )
                }
            }
    }

    /// Drag de um ponto.
    /// • Entrada e Saída: ficam EM CIMA do traçado da pista (snap),
    ///   com restrição de ordem (E sempre antes do Ápice, S sempre
    ///   depois). Barra é desenhada perpendicular à tangente local.
    /// • Ápice: pode ir pra qualquer lugar DENTRO da curva (limitado
    ///   à parte do traçado pertencente a este trecho), mas não pra
    ///   fora pra evitar "ponto pular pra outro lugar".
    private func dragGesture(para f: TrackSegmentFaixa, dims: (w: CGFloat, h: CGFloat),
                             zoom: CGRect, geo: GeometryProxy) -> some Gesture {
        DragGesture(minimumDistance: 2, coordinateSpace: .named("desenhoTrecho"))
            .onChanged { value in
                if inicioArrasto[f.id] == nil {
                    inicioArrasto[f.id] = CGPoint(x: f.x, y: f.y)
                }
                let mapa = telaParaMapa(x: value.location.x, y: value.location.y,
                                         dims: dims, zoom: zoom, geo: geo)
                if let alvo = aplicarRegrasDeArrasto(para: f, dedoNoMapa: mapa) {
                    posicaoLocal[f.id] = alvo
                }
            }
            .onEnded { value in
                defer { inicioArrasto.removeValue(forKey: f.id) }
                let mag = hypot(value.translation.width, value.translation.height)
                guard mag > 2 else {
                    posicaoLocal.removeValue(forKey: f.id)
                    return
                }
                let mapa = telaParaMapa(x: value.location.x, y: value.location.y,
                                         dims: dims, zoom: zoom, geo: geo)
                guard let alvo = aplicarRegrasDeArrasto(para: f, dedoNoMapa: mapa) else {
                    posicaoLocal.removeValue(forKey: f.id)
                    return
                }
                posicaoLocal[f.id] = alvo
                let novoX = Double(alvo.x)
                let novoY = Double(alvo.y)
                let tipo = f.tipoEnum ?? .entrada
                let indice = f.indice
                let segId = segmentId
                let repo = trackRepo
                Task { @MainActor in
                    try? await repo.moverFaixa(
                        segmentId: segId, tipo: tipo, indice: indice,
                        x: novoX, y: novoY
                    )
                }
            }
    }

    /// Aplica regras de cálculo de posição final.
    /// Devolve nil quando o dedo está muito fora — significa "descarta
    /// este arrasto" pra não gravar coord ruim que deixa a barra fora
    /// da pista (bug reportado pelo Flávio).
    /// • Entrada/Saída → SEMPRE em cima da pista (snap contínuo).
    ///   Ordem E < Á < S via índice linear.
    /// • Ápice → livre, mas confinado a um raio razoável do centro.
    private func aplicarRegrasDeArrasto(para f: TrackSegmentFaixa,
                                         dedoNoMapa mapa: CGPoint) -> CGPoint? {
        let pista = pistaDoTrecho
        guard !pista.pontos.isEmpty else { return mapa }
        guard let proj = pista.projetarContinuo(mapa) else { return mapa }

        // Raio máximo: usa o bounding box do trecho (zoomRect) com
        // pequena margem. Se o dedo está pra fora disso, é descarte.
        let raioMax: CGFloat = {
            guard let zr = zoomRect else { return 1000 }
            return max(zr.width, zr.height) / 2 + 50
        }()
        let centroT = centroDoTrechoAtual
        let distCentro = sqrt(PistaParseada.sqDist(mapa, centroT))
        if distCentro > raioMax { return nil }

        let idxApiceLinear: CGFloat? = {
            guard let a = apices.first else { return nil }
            let aPt = CGPoint(x: a.x, y: a.y)
            guard let p = pista.projetarContinuo(aPt) else { return nil }
            return pista.indiceLinear(idxSegmento: p.idxSegmento, t: p.t)
        }()

        switch f.tipoEnum {
        case .entrada:
            // SEMPRE em cima da pista. Margem mínima até o ápice — só
            // pra E e Á não sobreporem visualmente. Não trava antes.
            let meuLinear = pista.indiceLinear(idxSegmento: proj.idxSegmento, t: proj.t)
            if let idxA = idxApiceLinear, meuLinear >= idxA - 0.02 {
                let alvo = max(0, idxA - 0.02)
                return pontoNoLinear(alvo, pista: pista)
            }
            return proj.ponto
        case .saida:
            let meuLinear = pista.indiceLinear(idxSegmento: proj.idxSegmento, t: proj.t)
            if let idxA = idxApiceLinear, meuLinear <= idxA + 0.02 {
                let alvo = min(CGFloat(pista.pontos.count - 1), idxA + 0.02)
                return pontoNoLinear(alvo, pista: pista)
            }
            return proj.ponto
        case .apice:
            // 2026-05-17 (Flávio "preciso colocar no ponto certo"):
            // ápice é LIVRE (parte interna da curva, fora da linha).
            // Só confina índice linear entre E e S: se o dedo está
            // antes do E ou depois do S na sequência da pista, puxa
            // pra dentro dessa janela. Senão, fica onde o dedo soltou.
            let entrada = faixas.first(where: { $0.tipoEnum == .entrada })
            let saida = faixas.first(where: { $0.tipoEnum == .saida })
            if let e = entrada, let s = saida,
               let pE = pista.projetarContinuo(CGPoint(x: e.x, y: e.y)),
               let pS = pista.projetarContinuo(CGPoint(x: s.x, y: s.y)) {
                let linE = pista.indiceLinear(idxSegmento: pE.idxSegmento, t: pE.t)
                let linS = pista.indiceLinear(idxSegmento: pS.idxSegmento, t: pS.t)
                let meu = pista.indiceLinear(idxSegmento: proj.idxSegmento, t: proj.t)
                let minLin = min(linE, linS) + 0.02
                let maxLin = max(linE, linS) - 0.02
                if meu < minLin || meu > maxLin {
                    // Fora da janela E↔S — encaixa no limite mais próximo.
                    let alvoLin = max(minLin, min(maxLin, meu))
                    return pontoNoLinear(alvoLin, pista: pista)
                }
            }
            // Dentro da janela — fica onde o dedo soltou.
            return mapa
        case nil:
            return mapa
        }
    }

    /// Recupera o ponto em coords do mapa a partir de um índice linear
    /// (idx + t). Usado pra "colocar" Entrada/Saída no limite da ordem.
    private func pontoNoLinear(_ linear: CGFloat, pista: PistaParseada) -> CGPoint {
        let idx = Int(linear.rounded(.down))
        let t = linear - CGFloat(idx)
        guard idx >= 0, idx < pista.pontos.count else {
            return pista.pontos.last ?? .zero
        }
        if idx + 1 >= pista.pontos.count { return pista.pontos[idx] }
        let a = pista.pontos[idx]
        let b = pista.pontos[idx + 1]
        return CGPoint(x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y))
    }

    private func pontoDinamico(_ letra: String, cor: Color, em pos: CGPoint) -> some View {
        ZStack {
            Circle().fill(cor).frame(width: 18, height: 18)
            Text(letra).font(.system(size: 9, weight: .bold)).foregroundStyle(Color.onAccent)
        }
        .position(x: pos.x, y: pos.y)
    }

    private func vminPos(_ pd: SegmentPontosDinamicos, dims: (w: CGFloat, h: CGFloat),
                         zoom: CGRect, geo: GeometryProxy) -> CGPoint? {
        guard let x = pd.vminX, let y = pd.vminY else { return nil }
        return mapaParaTela(x: CGFloat(x), y: CGFloat(y), dims: dims, zoom: zoom, geo: geo)
    }
    private func frenagemPos(_ pd: SegmentPontosDinamicos, dims: (w: CGFloat, h: CGFloat),
                             zoom: CGRect, geo: GeometryProxy) -> CGPoint? {
        guard let x = pd.frenagemX, let y = pd.frenagemY else { return nil }
        return mapaParaTela(x: CGFloat(x), y: CGFloat(y), dims: dims, zoom: zoom, geo: geo)
    }
    private func pacePos(_ pd: SegmentPontosDinamicos, dims: (w: CGFloat, h: CGFloat),
                         zoom: CGRect, geo: GeometryProxy) -> CGPoint? {
        guard let x = pd.paceX, let y = pd.paceY else { return nil }
        return mapaParaTela(x: CGFloat(x), y: CGFloat(y), dims: dims, zoom: zoom, geo: geo)
    }

    // ─────────────────────────────────────────────────────────
    // Ajuste de pontos
    // ─────────────────────────────────────────────────────────
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
                    onModoAjusteChange?(modoAjuste)
                } label: {
                    Text(modoAjuste ? "Concluir" : "Editar")
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
                // 2026-05-17 (Flávio "arrastar com o dedo, sem ser por
                // linha X/Y"): pílulas Entrada/Saída/Ápice removidas.
                // Agora você toca direto no ponto no desenho e arrasta.
                Text("Toque uma vez no ponto (E, S ou A) pra selecionar — aparece um anel azul. Depois arraste pra mover. Toque fora ou no mesmo ponto pra desselecionar.")
                    .font(.system(size: 11))
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
        // 2026-05-17 (Flávio cobrou B5-3 "tocar no botão não muda a
        // pílula selecionada"): aumentei a área de toque (padding maior)
        // e adicionei `.contentShape(Rectangle())` explícito pra garantir
        // que toda a área do botão é tocável — não só o texto.
        return Button {
            tipoAjusteSelecionado = tipo
            indiceAjusteSelecionado = indice
        } label: {
            Text(rotulo)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isOn ? Color.onAccent : Color.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(Capsule().fill(isOn ? Color.accent : Color.surfaceHover))
                .overlay(Capsule().stroke(isOn ? Color.accent : Color.border, lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // ─────────────────────────────────────────────────────────
    // Ficha numérica dos 6 elementos
    // ─────────────────────────────────────────────────────────
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
                linhaPonto(letra: "A", cor: .text, titulo: "Ápice", valor: "Não cadastrado")
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
                Text(titulo).font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.text)
                Text(valor).font(.system(size: 12)).foregroundStyle(Color.textMuted)
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
            HelperNote(text: "Aguardando completar \(PontosDinamicosCalculo.minVoltasParaCalcular) voltas com este carro e configuração pra ativar o cálculo dos pontos dinâmicos. Até agora: \(voltasContadas).")
        } else if carroId == nil || configuracaoId == nil {
            HelperNote(text: "Escolha um carro e uma configuração acima pra ver os pontos dinâmicos (V-min, ponto de frenagem, PAce) deste trecho.")
        }
    }

    @MainActor
    private func carregar() async {
        guard let cid = carroId, let cfgId = configuracaoId else {
            pontos = nil; voltasContadas = 0; return
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
            pontos = pd; voltasContadas = n
        } catch {
            pontos = nil; voltasContadas = 0
        }
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - PistaParseada (helper)
// ═══════════════════════════════════════════════════════════
// Parseia o path SVG da pista em uma lista de pontos. Filtra só os
// pontos pertencentes ao trecho atual (Voronoi com centrosOutros).
// Oferece: projetar ponto qualquer no traçado, tangente local,
// índice ordinal na sequência da pista.

struct PistaParseada {
    let pontos: [CGPoint]    // pontos do trecho atual em coords do mapa
    let indices: [Int]       // índice original no path completo (pra ordem global)

    static func parsear(svgPath: String,
                        centroAtual: CGPoint,
                        centrosOutros: [CGPoint]) -> PistaParseada {
        // 2026-05-17 (Flávio noite): o desenho v2 da Brasília já vem
        // arrumado manualmente (425 pontos). O filtro Douglas-Peucker
        // estava jogando fora as correções manuais. Mantido o parser
        // puro — sem simplificação.
        let subpaths = PathUtils.parsearSubpaths(svgPath)
        var todos: [CGPoint] = []
        for sub in subpaths { todos.append(contentsOf: sub) }
        // Filtra: ponto pertence ao trecho atual se centroAtual está mais
        // próximo do que qualquer centroOutro.
        var marcador = [Bool](repeating: false, count: todos.count)
        for (idx, p) in todos.enumerated() {
            let dAtual = sqDist(p, centroAtual)
            var ehAtual = true
            for c in centrosOutros where sqDist(p, c) < dAtual {
                ehAtual = false; break
            }
            marcador[idx] = ehAtual
        }
        // 2026-05-17 (Flávio cobrou 5×): janela expandida pra 12 pontos
        // vizinhos. Antes era 6, mas o efeito não aparecia no desenho
        // por causa de bug no TrechoFatiado (filtragem dupla — corrigido).
        let janela = 12
        var expandido = marcador
        let n = todos.count
        for (idx, ativo) in marcador.enumerated() where ativo {
            for k in 1...janela {
                if idx - k >= 0 { expandido[idx - k] = true }
                if idx + k < n { expandido[idx + k] = true }
            }
        }
        var pontosFiltrados: [CGPoint] = []
        var indicesFiltrados: [Int] = []
        for (idx, p) in todos.enumerated() where expandido[idx] {
            pontosFiltrados.append(p)
            indicesFiltrados.append(idx)
        }
        return PistaParseada(pontos: pontosFiltrados, indices: indicesFiltrados)
    }

    /// Projeta um ponto qualquer no ponto da pista mais próximo. Devolve
    /// o ponto e o índice local (na lista filtrada).
    func projetar(_ p: CGPoint) -> (ponto: CGPoint, indiceLocal: Int)? {
        guard !pontos.isEmpty else { return nil }
        var melhor = 0
        var melhorDist = PistaParseada.sqDist(p, pontos[0])
        for i in 1..<pontos.count {
            let d = PistaParseada.sqDist(p, pontos[i])
            if d < melhorDist { melhorDist = d; melhor = i }
        }
        return (pontos[melhor], melhor)
    }

    /// Projeção CONTÍNUA — em vez de pegar o ponto mais próximo da
    /// lista, projeta o dedo no SEGMENTO de reta entre dois pontos
    /// vizinhos. Resultado: posição fluida ao longo da pista, sem
    /// "pulos" entre pontos discretos. Devolve o ponto na linha,
    /// o índice do segmento e o parâmetro t ∈ [0,1] dentro dele.
    func projetarContinuo(_ p: CGPoint) -> (ponto: CGPoint, idxSegmento: Int, t: CGFloat)? {
        guard !pontos.isEmpty else { return nil }
        if pontos.count == 1 { return (pontos[0], 0, 0) }
        var melhorP = pontos[0]
        var melhorIdx = 0
        var melhorT: CGFloat = 0
        var melhorDist: CGFloat = .greatestFiniteMagnitude
        for i in 0..<(pontos.count - 1) {
            let a = pontos[i]; let b = pontos[i + 1]
            let dx = b.x - a.x; let dy = b.y - a.y
            let len2 = dx * dx + dy * dy
            let t: CGFloat
            let proj: CGPoint
            if len2 < 1e-6 {
                t = 0; proj = a
            } else {
                let raw = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
                t = max(0, min(1, raw))
                proj = CGPoint(x: a.x + t * dx, y: a.y + t * dy)
            }
            let d = PistaParseada.sqDist(p, proj)
            if d < melhorDist {
                melhorDist = d
                melhorP = proj
                melhorIdx = i
                melhorT = t
            }
        }
        return (melhorP, melhorIdx, melhorT)
    }

    /// Índice "linear" 0..(N-1) — útil pra ordenar posições contínuas
    /// e aplicar a regra E < Á < S.
    func indiceLinear(idxSegmento: Int, t: CGFloat) -> CGFloat {
        CGFloat(idxSegmento) + t
    }

    /// Tangente unitária no ponto do índice — usa segmento antes-depois.
    func tangente(no indiceLocal: Int) -> CGVector {
        guard pontos.count >= 2 else { return CGVector(dx: 0, dy: -1) }
        let a = pontos[max(0, indiceLocal - 1)]
        let b = pontos[min(pontos.count - 1, indiceLocal + 1)]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let len = sqrt(dx * dx + dy * dy)
        guard len > 0.001 else { return CGVector(dx: 0, dy: -1) }
        return CGVector(dx: dx / len, dy: dy / len)
    }

    static func sqDist(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        let dx = a.x - b.x; let dy = a.y - b.y
        return dx * dx + dy * dy
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - TrechoFatiado (Shape)
// ═══════════════════════════════════════════════════════════
// 2026-05-17 — Reformulação Autódromos. A PISTA É FIXA (Flávio
// cobrou 3 vezes). Desenha o traçado SVG OFICIAL do autódromo (o
// mesmo do mapa principal), mas filtrando: cada segmento de linha
// do path só entra no desenho se o trecho mais próximo (entre o
// atual e todos os outros do layout) for o atual. Isso elimina os
// "ressaltos" de outras curvas que passavam dentro do retângulo do
// zoom, sem inventar nenhuma curva nova. Arrastar os pontos E/S/A
// NÃO altera mais o desenho.

struct TrechoFatiado: Shape {
    let zoomRect: CGRect
    /// 2026-05-17 (Flávio cobrou 5×): pontos já vêm pré-filtrados e
    /// EXPANDIDOS pelo PistaParseada. Antes havia filtragem dupla aqui
    /// dentro que ignorava a expansão — bug que escondia o pedaço
    /// extra de pista que o gestor queria ver.
    let pontosTrecho: [CGPoint]
    let indicesNoPath: [Int]

    func path(in rect: CGRect) -> Path {
        var resultado = Path()
        let scale = min(rect.width / zoomRect.width, rect.height / zoomRect.height)
        let offsetX = (rect.width - zoomRect.width * scale) / 2.0 - zoomRect.minX * scale
        let offsetY = (rect.height - zoomRect.height * scale) / 2.0 - zoomRect.minY * scale
        let mapaToTela: (CGPoint) -> CGPoint = { mp in
            CGPoint(x: offsetX + mp.x * scale, y: offsetY + mp.y * scale)
        }
        guard pontosTrecho.count >= 2 else { return resultado }
        // Agrupar em sequências contíguas (índice no path completo).
        var grupo: [CGPoint] = [pontosTrecho[0]]
        var idxAnterior = indicesNoPath[0]
        for k in 1..<pontosTrecho.count {
            let idxAtual = indicesNoPath[k]
            if idxAtual == idxAnterior + 1 {
                grupo.append(pontosTrecho[k])
            } else {
                if grupo.count >= 2 {
                    desenharCatmullRom(grupo, em: &resultado, mapaToTela: mapaToTela)
                }
                grupo = [pontosTrecho[k]]
            }
            idxAnterior = idxAtual
        }
        if grupo.count >= 2 {
            desenharCatmullRom(grupo, em: &resultado, mapaToTela: mapaToTela)
        }
        return resultado
    }

    private func desenharCatmullRom(_ pontos: [CGPoint], em path: inout Path,
                                     mapaToTela: (CGPoint) -> CGPoint) {
        guard pontos.count >= 2 else { return }
        let telaPts = pontos.map(mapaToTela)
        path.move(to: telaPts[0])
        let n = telaPts.count
        for i in 0..<(n - 1) {
            let p0 = i == 0 ? telaPts[i] : telaPts[i - 1]
            let p1 = telaPts[i]
            let p2 = telaPts[i + 1]
            let p3 = (i + 2 < n) ? telaPts[i + 2] : telaPts[i + 1]
            let cp1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6.0,
                              y: p1.y + (p2.y - p0.y) / 6.0)
            let cp2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6.0,
                              y: p2.y - (p3.y - p1.y) / 6.0)
            path.addCurve(to: p2, control1: cp1, control2: cp2)
        }
    }
}

