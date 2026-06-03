// ═══════════════════════════════════════════════════════════
// AutodromoDetalheView — tela do autódromo (Onda 4)
// ═══════════════════════════════════════════════════════════
// Reformulação Autódromos (Flávio 2026-05-17). Substitui a abertura
// direta na lista de trechos. Agora a tela abre com:
//   • cabeçalho (apelido + cidade + extensão + nº curvas)
//   • seletor de carro no topo (filtro)
//   • 3 recordes: time + pessoal + carro+config (independente do piloto)
//   • botão "Abrir mapa" → mapa estilo Command Box Vista Piloto
//   • lista plana de trechos (sem agrupar por parcial — decisão D2)
//
// Decisões aplicadas:
//   B (1ª rodada): recordes do time primeiro; carro é filtro no topo.
//   C1 (questionário): TRÊS recordes mostrados.
//   C2: cada recorde mostra piloto + carro + data.
//   D1 (questionário): mapa escondido, abre por botão.
//   D2 (questionário): lista plana de trechos.
//   F2 (1ª rodada) + F2 (questionário): números do carro selecionado.

import SwiftUI
import P1FastCore
import GRDB

struct AutodromoDetalheView: View {
    @EnvironmentObject private var trackRepo: TrackRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var configuracaoRepo: ConfiguracaoRepository
    @EnvironmentObject private var sessionManager: SessionManager
    let autodromoId: String
    let carroFiltroId: String?

    @State private var carroSelecionado: String?
    @State private var configSelecionada: String?
    @State private var recordes: AutodromoRecordes = .vazio
    @State private var mostrarMapa = false
    @State private var carregando = true
    @State private var perfilCorrenteNome: String?
    @State private var perfilCorrentePilotoId: String?
    /// 2026-05-17 (Flávio): trecho selecionado no mapa em cima — quando
    /// nil, mostra o resumo do autódromo embaixo; quando preenchido,
    /// mostra os dados do trecho. Tudo na mesma tela.
    /// 2026-05-17 (Flávio "salva onde você estava"): persistido em
    /// UserDefaults com chave por autódromo pra restaurar no boot
    /// seguinte.
    @State private var trechoSelecionadoId: String?

    /// 2026-05-17 (auditor externo): quando o gestor está em modo
    /// Ajuste num trecho, a rolagem da página é travada pra não
    /// competir com o arrasto dos pontos E, S, A.
    @State private var ajusteTrechoAtivo = false

    private var trechoStorageKey: String { "p1fast.trechoSelecionado.\(autodromoId)" }

    private var autodromo: TrackRow? {
        trackRepo.tracks.first { $0.id == autodromoId }
    }

    private var layout: TrackLayoutRow? {
        trackRepo.layouts(forTrackId: autodromoId).first
    }

    private var trechos: [TrackSegmentRow] {
        guard let lay = layout else { return [] }
        // Lista plana ordenada por sequência da volta (ordem do segment)
        // — decisão D2 do questionário. Inclui só segments marcados como
        // trechos (curvas). Retas só aparecem no mapa.
        return trackRepo.trechos(forLayoutId: lay.id)
    }

    var body: some View {
        ScrollView {
            conteudo
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 100)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDisabled(ajusteTrechoAtivo)
        .background(Color.surface)
        .navigationTitle(autodromo?.apelido ?? "Autódromo")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .onAppear {
            if carroSelecionado == nil { carroSelecionado = carroFiltroId }
            sincronizarConfigSelecionada()
            // Restaura trecho selecionado da última sessão (se ainda existir).
            if trechoSelecionadoId == nil,
               let salvo = UserDefaults.standard.string(forKey: trechoStorageKey),
               trechos.contains(where: { $0.id == salvo }) {
                trechoSelecionadoId = salvo
            }
            Task { await carregarRecordes() }
        }
        .onChange(of: carroSelecionado) { _ in
            sincronizarConfigSelecionada()
            Task { await carregarRecordes() }
        }
        .onChange(of: configSelecionada) { _ in
            Task { await carregarRecordes() }
        }
        .onChange(of: trechoSelecionadoId) { _, novo in
            // Persiste a escolha — restaurada no próximo onAppear desta tela.
            if let id = novo {
                UserDefaults.standard.set(id, forKey: trechoStorageKey)
            } else {
                UserDefaults.standard.removeObject(forKey: trechoStorageKey)
            }
        }
        .sheet(isPresented: $mostrarMapa) {
            AutodromoMapaModal(
                autodromoId: autodromoId,
                onFechar: { mostrarMapa = false }
            )
            .environmentObject(trackRepo)
        }
    }

    @ViewBuilder
    private var conteudo: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            cabecalho
            mapaInline   // Mapa fixo em cima (Flávio 2026-05-17)
            filtroCarro
            // O conteúdo embaixo TROCA dependendo do trecho selecionado:
            // sem seleção = resumo do autódromo (recordes + lista de trechos)
            // com seleção = ficha completa do trecho (6 pontos + ajuste)
            if let segId = trechoSelecionadoId,
               trechos.contains(where: { $0.id == segId }) {
                blocoTrechoSelecionado(segId)
            } else {
                cardsRecordes
                listaTrechos
                // 2026-05-17 (Flávio cobrou B5-5): o botão "Gravar pista"
                // / "Editar mapa" precisa aparecer pro dono mesmo quando
                // o autódromo já tem traçado (caso de Brasília). Antes
                // o componente botaoMapa estava definido mas nunca era
                // renderizado no conteúdo — só ficava órfão.
                botaoEditarMapa
            }
        }
    }

    /// Botão "Editar mapa" / "Gravar pista" — visibilidade segue
    /// `podeEditarMapa`. Dono do aplicativo sempre vê (mesmo quando
    /// já existe traçado). Não-dono só vê quando o autódromo ainda
    /// não tem traçado cadastrado.
    @ViewBuilder
    private var botaoEditarMapa: some View {
        if podeEditarMapa {
            NavigationLink {
                PistaGravacaoPlaceholderView(
                    autodromoId: autodromoId,
                    onClose: {}
                )
            } label: {
                HStack {
                    Text(temMapaCadastrado ? "Editar mapa" : "Gravar pista")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.text)
                    Spacer()
                    Text("›").foregroundStyle(Color.textMuted)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(Color.surfaceRaised)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.border, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.sm)
        }
    }

    /// Mapa inline (mesma tela). Padrão visual Vista Piloto: asfalto
    /// cinza grosso, filete dourado, trechos numerados clicáveis.
    @ViewBuilder
    private var mapaInline: some View {
        let lay = layout
        ZStack(alignment: .topTrailing) {
            // Caixa do mapa
            ZStack {
                LinearGradient(
                    colors: [Color(red: 10/255, green: 16/255, blue: 24/255),
                             Color(red: 3/255, green: 5/255, blue: 8/255)],
                    startPoint: .top, endPoint: .bottom
                )
                if let lay, let svg = lay.svgPath, let dims = parseViewBoxLocal(lay.viewBox) {
                    GeometryReader { geo in
                        ZStack {
                            CircuitoShape(svgPath: svg, viewBoxW: dims.w, viewBoxH: dims.h)
                                .stroke(Color(red: 0.20, green: 0.22, blue: 0.26),
                                        style: StrokeStyle(lineWidth: 14, lineCap: .round, lineJoin: .round))
                                .padding(10)
                            CircuitoShape(svgPath: svg, viewBoxW: dims.w, viewBoxH: dims.h)
                                .stroke(Color(red: 0.83, green: 0.69, blue: 0.22).opacity(0.55),
                                        style: StrokeStyle(lineWidth: 0.9, lineCap: .round, lineJoin: .round))
                                .padding(10)
                            // 2026-05-17 (Flávio "mostrar todos os pontos
                            // no mapa geral, como o Command Box"): marca
                            // E (entrada), S (saída) e A (ápice) de cada
                            // trecho cadastrado em cima do mapa.
                            ForEach(trechos, id: \.id) { seg in
                                marcadoresDoTrecho(seg, geo: geo, dims: dims)
                            }
                            ForEach(Array(trechos.enumerated()), id: \.element.id) { idx, seg in
                                trechoHotspotInline(seg, ordem: idx + 1, geo: geo, dims: dims)
                            }
                        }
                    }
                } else {
                    Text("Mapa não cadastrado")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textMuted)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(height: 280)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
            // Botão "Ampliar" no canto pra abrir o mapa em tela cheia.
            Button {
                mostrarMapa = true
            } label: {
                Text("Ampliar")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.text)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Color.surfaceHover))
            }
            .buttonStyle(.plain)
            .padding(8)
        }
    }

    /// Marcadores E (entrada), S (saída) e A (ápice) sobre o mapa geral
    /// do autódromo. Usados pra ver de relance, em todos os trechos, onde
    /// estão os pontos cadastrados. Estilo igual o Command Box Vista Piloto.
    @ViewBuilder
    private func marcadoresDoTrecho(_ seg: TrackSegmentRow,
                                     geo: GeometryProxy,
                                     dims: (w: CGFloat, h: CGFloat)) -> some View {
        let faixas = trackRepo.faixasPorSegmento[seg.id] ?? []
        let dourado = Color(red: 0.83, green: 0.69, blue: 0.22)
        let cremoso = Color(red: 0.96, green: 0.87, blue: 0.66)
        ForEach(faixas, id: \.id) { f in
            if let p = posicaoFaixaNoMapaGeral(f, dims: dims, geo: geo) {
                switch f.tipoEnum {
                case .entrada:
                    ZStack {
                        Circle().fill(Color.black.opacity(0.6)).frame(width: 11, height: 11)
                        Circle().stroke(dourado, lineWidth: 1.2).frame(width: 8, height: 8)
                        Text("E").font(.system(size: 6, weight: .bold))
                            .foregroundStyle(dourado)
                    }
                    .position(x: p.x, y: p.y)
                case .saida:
                    ZStack {
                        Circle().fill(Color.black.opacity(0.6)).frame(width: 11, height: 11)
                        Circle().stroke(dourado, lineWidth: 1.2).frame(width: 8, height: 8)
                        Text("S").font(.system(size: 6, weight: .bold))
                            .foregroundStyle(dourado)
                    }
                    .position(x: p.x, y: p.y)
                case .apice:
                    ZStack {
                        Circle().fill(Color.black.opacity(0.7)).frame(width: 7, height: 7)
                        Circle().fill(cremoso).frame(width: 4, height: 4)
                    }
                    .position(x: p.x, y: p.y)
                case nil:
                    EmptyView()
                }
            }
        }
    }

    private func posicaoFaixaNoMapaGeral(_ f: TrackSegmentFaixa,
                                          dims: (w: CGFloat, h: CGFloat),
                                          geo: GeometryProxy) -> CGPoint? {
        let inset: CGFloat = 10
        let availableW = geo.size.width - inset * 2
        let availableH = geo.size.height - inset * 2
        let scale = min(availableW / dims.w, availableH / dims.h)
        let offsetX = (geo.size.width - dims.w * scale) / 2.0
        let offsetY = (geo.size.height - dims.h * scale) / 2.0
        return CGPoint(x: offsetX + CGFloat(f.x) * scale,
                       y: offsetY + CGFloat(f.y) * scale)
    }

    @ViewBuilder
    private func trechoHotspotInline(_ seg: TrackSegmentRow, ordem: Int,
                                     geo: GeometryProxy, dims: (w: CGFloat, h: CGFloat)) -> some View {
        if let pos = posicaoTrechoInline(seg, dims: dims, geo: geo) {
            let isSelecionado = trechoSelecionadoId == seg.id
            Button {
                trechoSelecionadoId = seg.id
            } label: {
                ZStack {
                    Circle()
                        .fill(isSelecionado ? Color.accent : Color(red: 0.83, green: 0.69, blue: 0.22))
                        .frame(width: 22, height: 22)
                    Text("\(ordem)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(isSelecionado ? Color.onAccent : Color.black)
                }
            }
            .buttonStyle(.plain)
            .position(x: pos.x, y: pos.y)
        }
    }

    private func posicaoTrechoInline(_ seg: TrackSegmentRow,
                                     dims: (w: CGFloat, h: CGFloat),
                                     geo: GeometryProxy) -> CGPoint? {
        let geom = SegmentGeometry.decode(seg.geometria)
        guard let g = geom else { return nil }
        let inset: CGFloat = 10
        let availableW = geo.size.width - inset * 2
        let availableH = geo.size.height - inset * 2
        let scale = min(availableW / dims.w, availableH / dims.h)
        let offsetX = (geo.size.width - dims.w * scale) / 2.0
        let offsetY = (geo.size.height - dims.h * scale) / 2.0
        return CGPoint(x: offsetX + CGFloat(g.x) * scale,
                       y: offsetY + CGFloat(g.y) * scale)
    }

    private func parseViewBoxLocal(_ json: String?) -> (w: CGFloat, h: CGFloat)? {
        guard let json = json, let data = json.data(using: .utf8) else { return nil }
        struct V: Decodable { let w: Double; let h: Double }
        if let v = try? JSONDecoder().decode(V.self, from: data) {
            return (CGFloat(v.w), CGFloat(v.h))
        }
        return nil
    }

    /// Bloco que aparece embaixo do mapa quando um trecho está selecionado.
    /// Mostra a ficha embutida do trecho — mesma estrutura da TrechoDetalheView,
    /// mas inline (sem navegação extra).
    @ViewBuilder
    private func blocoTrechoSelecionado(_ segId: String) -> some View {
        VStack(spacing: Spacing.md) {
            HStack {
                Button {
                    trechoSelecionadoId = nil
                } label: {
                    Text("‹ Voltar ao autódromo")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.text)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(Color.surfaceHover))
                }
                .buttonStyle(.plain)
                Spacer()
            }
            TrechoDetalheInline(
                segmentId: segId,
                carroId: carroSelecionado,
                configuracaoId: configSelecionada,
                onModoAjusteChange: { ativo in
                    // Trava a rolagem desta página enquanto o gestor
                    // arrasta os pontos do trecho.
                    ajusteTrechoAtivo = ativo
                }
            )
            .environmentObject(trackRepo)
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Autódromo")
            Text(autodromo?.apelido ?? "—")
                .font(.system(size: 26, weight: .semibold))
                .tracking(-0.65)
                .foregroundStyle(Color.text)
            Text(linhaSub)
                .font(.system(size: 13))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
    }

    private var linhaSub: String {
        guard let a = autodromo else { return "" }
        var partes: [String] = []
        if let c = a.cidade, !c.isEmpty { partes.append(c) }
        if let m = a.extensaoMetros { partes.append(String(format: "%.2f km", Double(m) / 1000.0)) }
        if let n = a.numeroCurvas { partes.append("\(n) curva\(n == 1 ? "" : "s")") }
        return partes.isEmpty ? "Sem dados de cadastro" : partes.joined(separator: " · ")
    }

    private var filtroCarro: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("CARRO")
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(Color.textFaint)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    pill(label: "Todos os carros", isOn: carroSelecionado == nil) {
                        carroSelecionado = nil
                    }
                    ForEach(carroRepo.carros, id: \.id) { c in
                        pill(label: c.apelido, isOn: carroSelecionado == c.id) {
                            carroSelecionado = c.id
                        }
                    }
                }
            }
            if let cid = carroSelecionado {
                let cfgs = configuracaoRepo.paraCarro(cid)
                if !cfgs.isEmpty {
                    Text("CONFIGURAÇÃO")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.8)
                        .foregroundStyle(Color.textFaint)
                        .padding(.top, 4)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            pill(label: "Todas configurações", isOn: configSelecionada == nil) {
                                configSelecionada = nil
                            }
                            ForEach(cfgs, id: \.id) { cfg in
                                pill(label: cfg.nome ?? cfg.resumoLegivel,
                                     isOn: configSelecionada == cfg.id) {
                                    configSelecionada = cfg.id
                                }
                            }
                        }
                    }
                }
            }
        }
        .padding(Spacing.md)
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

    private func pill(label: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(isOn ? Color.onAccent : Color.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    Capsule().fill(isOn ? Color.accent : Color.surfaceHover)
                )
        }
        .buttonStyle(.plain)
    }

    private var cardsRecordes: some View {
        VStack(spacing: 8) {
            cardRecorde(titulo: "Recorde do time",
                        sub: "Melhor entre todos os pilotos do time",
                        recorde: recordes.time)
            cardRecorde(titulo: "Recorde pessoal",
                        sub: pilotoLogadoNome.map { "Seu melhor — \($0)" } ?? "Seu melhor",
                        recorde: recordes.pessoal)
            if carroSelecionado != nil {
                cardRecorde(titulo: "Recorde do carro/configuração",
                            sub: "Melhor desse carro com essa configuração — qualquer piloto",
                            recorde: recordes.carroConfig)
            }
        }
    }

    private func cardRecorde(titulo: String, sub: String, recorde: RecordeVolta?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(titulo)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.text)
            Text(sub)
                .font(.system(size: 11))
                .foregroundStyle(Color.textFaint)
            HStack(alignment: .firstTextBaseline) {
                Text(recorde?.tempoTexto ?? "—")
                    .font(.system(size: 28, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(recorde != nil ? Color.text : Color.textFaint)
                Spacer()
                if let r = recorde {
                    Text(r.contextoTexto)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.textMuted)
                        .multilineTextAlignment(.trailing)
                }
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

    private var botaoMapa: some View {
        VStack(spacing: 8) {
            Button {
                mostrarMapa = true
            } label: {
                HStack {
                    Text("Abrir mapa")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.onAccent)
                    Spacer()
                    Text("›")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.onAccent)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .fill(Color.accent)
                )
            }
            .buttonStyle(.plain)

            // Pendência 5 (Flávio 2026-05-17 — P5E):
            // - Dono do aplicativo: sempre vê "Editar mapa".
            // - Piloto comum: só vê quando o autódromo AINDA não tem
            //   traçado cadastrado.
            if podeEditarMapa {
                NavigationLink {
                    PistaGravacaoPlaceholderView(
                        autodromoId: autodromoId,
                        onClose: {}
                    )
                } label: {
                    HStack {
                        Text(temMapaCadastrado ? "Editar mapa" : "Gravar pista")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.text)
                        Spacer()
                        Text("›").foregroundStyle(Color.textMuted)
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.surfaceRaised)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(Color.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var temMapaCadastrado: Bool {
        guard let lay = layout, let p = lay.svgPath, !p.isEmpty else { return false }
        return true
    }

    private var podeEditarMapa: Bool {
        if TeamContext.isOwner { return true }
        // Não-dono só vê quando ainda não há mapa cadastrado.
        return !temMapaCadastrado
    }

    private var listaTrechos: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TRECHOS")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.5)
                .foregroundStyle(Color.textFaint)
                .padding(.top, Spacing.sm)

            if trechos.isEmpty {
                Text("Esse autódromo ainda não tem trechos cadastrados.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
                    .padding(Spacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.surfaceRaised)
                    )
            } else {
                VStack(spacing: 8) {
                    ForEach(trechos, id: \.id) { seg in
                        Button {
                            // 2026-05-17 Flávio: tocar num trecho seleciona
                            // ele EMBAIXO na mesma tela (mapa fica em cima).
                            trechoSelecionadoId = seg.id
                        } label: {
                            linhaTrecho(seg)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func linhaTrecho(_ seg: TrackSegmentRow) -> some View {
        HStack(spacing: Spacing.sm) {
            Text(seg.nome ?? "Trecho")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.text)
            Spacer()
            Text("›")
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private var pilotoLogadoNome: String? {
        // Pendência 4 (Flávio 2026-05-17): nome do piloto vinculado ao
        // user_id do login atual. Vem do PerfilCorrenteService quando o
        // gestor já vinculou a pessoa em "Meu perfil".
        perfilCorrenteNome
    }

    private func sincronizarConfigSelecionada() {
        guard let cid = carroSelecionado else {
            configSelecionada = nil
            return
        }
        let cfgs = configuracaoRepo.paraCarro(cid)
        if let ativa = cfgs.first(where: { $0.ativa }) {
            configSelecionada = ativa.id
        } else {
            configSelecionada = cfgs.first?.id
        }
    }

    @MainActor
    private func carregarRecordes() async {
        carregando = true
        // Pendência 4 — hidrata identidade do piloto logado antes dos
        // recordes pra que o loader saiba quem é "pessoal".
        do {
            let identidade = try await PerfilCorrenteService.identidadeAtual(
                userId: sessionManager.currentUserId,
                queue: trackRepo.queue
            )
            perfilCorrenteNome = identidade?.nome
            perfilCorrentePilotoId = identidade?.pilotoId
        } catch {
            perfilCorrenteNome = nil
            perfilCorrentePilotoId = nil
        }
        do {
            recordes = try await AutodromoRecordesLoader.load(
                autodromoId: autodromoId,
                carroId: carroSelecionado,
                configuracaoId: configSelecionada,
                pilotoCorrenteId: perfilCorrentePilotoId,
                queue: trackRepo.queue
            )
        } catch {
            recordes = .vazio
        }
        carregando = false
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - Recordes + Loader
// ═══════════════════════════════════════════════════════════

struct RecordeVolta: Equatable {
    let tempoMs: Int
    let pilotoNome: String?
    let carroApelido: String?
    let configNome: String?
    let dataMs: Int64?

    var tempoTexto: String {
        CarroDashboardView.formatarTempoVolta(ms: tempoMs)
    }

    var contextoTexto: String {
        var partes: [String] = []
        if let p = pilotoNome, !p.isEmpty { partes.append(p) }
        if let c = carroApelido, !c.isEmpty { partes.append(c) }
        if let cfg = configNome, !cfg.isEmpty { partes.append(cfg) }
        if let d = dataMs { partes.append(CarroDashboardView.dataCurta(ms: d)) }
        return partes.isEmpty ? "" : partes.joined(separator: " · ")
    }
}

struct AutodromoRecordes: Equatable {
    let time: RecordeVolta?
    let pessoal: RecordeVolta?
    let carroConfig: RecordeVolta?

    static let vazio = AutodromoRecordes(time: nil, pessoal: nil, carroConfig: nil)
}

enum AutodromoRecordesLoader {
    /// Carrega os 3 recordes mostrados na ficha do autódromo:
    /// • time      = melhor entre todos os pilotos do time
    /// • pessoal   = melhor do piloto logado (placeholder por enquanto)
    /// • carroConfig = melhor desse carro+config (independente de piloto)
    static func load(autodromoId: String,
                     carroId: String?,
                     configuracaoId: String?,
                     pilotoCorrenteId: String? = nil,
                     queue: DatabaseQueue) async throws -> AutodromoRecordes {
        guard let teamId = TeamContext.currentTeamId else { return .vazio }
        return try await queue.read { db in
            let baseSql = """
                SELECT v.tempo_ms, v.inicio_at,
                       p.nome AS piloto_nome,
                       car.apelido AS carro_apelido,
                       cfg.nome AS cfg_nome
                FROM voltas v
                JOIN sessoes s ON s.id = v.sessao_id
                LEFT JOIN eventos e ON e.id = s.evento_id
                LEFT JOIN pilotos p ON p.id = s.piloto_id
                LEFT JOIN carros car ON car.id = s.carro_id
                LEFT JOIN configuracoes cfg ON cfg.id = s.configuracao_id
                WHERE e.track_id = ?
                  AND s.time_id = ?
                  AND v.valida = 1
                  AND v.tempo_ms IS NOT NULL
            """

            func row(extra: String, args: [DatabaseValueConvertible]) throws -> RecordeVolta? {
                let sql = baseSql + " " + extra + " ORDER BY v.tempo_ms ASC LIMIT 1"
                guard let r = try Row.fetchOne(db, sql: sql, arguments: StatementArguments(args)) else {
                    return nil
                }
                return RecordeVolta(
                    tempoMs: r["tempo_ms"] as Int? ?? 0,
                    pilotoNome: r["piloto_nome"] as String?,
                    carroApelido: r["carro_apelido"] as String?,
                    configNome: r["cfg_nome"] as String?,
                    dataMs: r["inicio_at"] as Int64?
                )
            }

            // Time inteiro (filtrado por carro/config quando aplicar — Flávio
            // pediu pra mudar pelo filtro, decisão F2/Q1 do questionário).
            var extras: [String] = []
            var args: [DatabaseValueConvertible] = [autodromoId, teamId]
            if let cid = carroId {
                extras.append("AND s.carro_id = ?")
                args.append(cid)
            }
            if let cfgId = configuracaoId {
                extras.append("AND s.configuracao_id = ?")
                args.append(cfgId)
            }
            let extrasJoined = extras.isEmpty ? "" : extras.joined(separator: " ")
            let recordeTime = try row(extra: extrasJoined, args: args)

            // Pendência 4 (Flávio 2026-05-17) — recorde pessoal calculado
            // quando o gestor já vinculou a pessoa em "Meu perfil". Sem
            // vínculo, fica null (UI mostra "—").
            let recordePessoal: RecordeVolta?
            if let pid = pilotoCorrenteId {
                recordePessoal = try row(
                    extra: "AND s.piloto_id = ?",
                    args: [autodromoId, teamId, pid]
                )
            } else {
                recordePessoal = nil
            }

            // Recorde carro+config: idêntico ao "time" mas SEMPRE filtra
            // por carro+config (independente de piloto). Só calcula quando
            // ambos selecionados.
            let recordeCarroCfg: RecordeVolta?
            if let cid = carroId, let cfgId = configuracaoId {
                recordeCarroCfg = try row(
                    extra: "AND s.carro_id = ? AND s.configuracao_id = ?",
                    args: [autodromoId, teamId, cid, cfgId]
                )
            } else if let cid = carroId {
                recordeCarroCfg = try row(
                    extra: "AND s.carro_id = ?",
                    args: [autodromoId, teamId, cid]
                )
            } else {
                recordeCarroCfg = nil
            }

            return AutodromoRecordes(
                time: recordeTime,
                pessoal: recordePessoal,
                carroConfig: recordeCarroCfg
            )
        }
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - AutodromoMapaModal (D1 do questionário)
// ═══════════════════════════════════════════════════════════

struct AutodromoMapaModal: View {
    @EnvironmentObject private var trackRepo: TrackRepository
    let autodromoId: String
    let onFechar: () -> Void

    @State private var trechoSelecionado: String? = nil

    private var layout: TrackLayoutRow? {
        trackRepo.layouts(forTrackId: autodromoId).first
    }

    private var trechos: [TrackSegmentRow] {
        guard let lay = layout else { return [] }
        return trackRepo.trechos(forLayoutId: lay.id)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                mapaArea
                if let segId = trechoSelecionado,
                   trechos.contains(where: { $0.id == segId }) {
                    ScrollView {
                        TrechoDetalheInline(
                            segmentId: segId,
                            carroId: nil,
                            configuracaoId: nil
                        )
                        .padding(.horizontal, Spacing.lg)
                        .padding(.top, Spacing.md)
                        .padding(.bottom, Spacing.lg)
                    }
                    .frame(maxHeight: .infinity)
                    .background(Color.surface)
                }
            }
            .background(
                LinearGradient(
                    colors: [Color(red: 10/255, green: 16/255, blue: 24/255),
                             Color(red: 3/255, green: 5/255, blue: 8/255)],
                    startPoint: .top, endPoint: .bottom
                ).ignoresSafeArea()
            )
            .navigationTitle("Mapa do autódromo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Voltar", action: onFechar)
                        .foregroundStyle(Color.text)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    /// Área do mapa com pinch zoom e arrasto (pan).
    /// Topo: ocupa toda largura; altura varia conforme há trecho selecionado.
    @ViewBuilder
    private var mapaArea: some View {
        ZStack {
            if let lay = layout, let svg = lay.svgPath, let dims = parseViewBox(lay.viewBox) {
                GeometryReader { geo in
                    ZStack {
                        CircuitoShape(svgPath: svg, viewBoxW: dims.w, viewBoxH: dims.h)
                            .stroke(Color(red: 0.20, green: 0.22, blue: 0.26),
                                    style: StrokeStyle(lineWidth: 22, lineCap: .round, lineJoin: .round))
                            .padding(20)
                        CircuitoShape(svgPath: svg, viewBoxW: dims.w, viewBoxH: dims.h)
                            .stroke(Color(red: 0.83, green: 0.69, blue: 0.22).opacity(0.55),
                                    style: StrokeStyle(lineWidth: 1.2, lineCap: .round, lineJoin: .round))
                            .padding(20)
                        // Marcadores E/S/A já cadastrados em cima do mapa.
                        ForEach(trechos, id: \.id) { seg in
                            marcadoresDoTrechoModal(seg, geo: geo, dims: dims)
                        }
                        // Trechos clicáveis (números).
                        ForEach(Array(trechos.enumerated()), id: \.element.id) { idx, seg in
                            trechoHotspot(seg, ordem: idx + 1, geo: geo, dims: dims)
                        }
                    }
                }
            } else {
                semMapa
            }
        }
        .frame(maxHeight: trechoSelecionado == nil ? .infinity : 320)
        .clipped()
    }

    @ViewBuilder
    private func marcadoresDoTrechoModal(_ seg: TrackSegmentRow,
                                          geo: GeometryProxy,
                                          dims: (w: CGFloat, h: CGFloat)) -> some View {
        let faixas = trackRepo.faixasPorSegmento[seg.id] ?? []
        let dourado = Color(red: 0.83, green: 0.69, blue: 0.22)
        let cremoso = Color(red: 0.96, green: 0.87, blue: 0.66)
        ForEach(faixas, id: \.id) { f in
            if let p = posicaoFaixaModal(f, dims: dims, geo: geo) {
                switch f.tipoEnum {
                case .entrada:
                    ZStack {
                        Circle().fill(Color.black.opacity(0.6)).frame(width: 12, height: 12)
                        Text("E").font(.system(size: 7, weight: .bold)).foregroundStyle(dourado)
                    }
                    .position(x: p.x, y: p.y)
                case .saida:
                    ZStack {
                        Circle().fill(Color.black.opacity(0.6)).frame(width: 12, height: 12)
                        Text("S").font(.system(size: 7, weight: .bold)).foregroundStyle(dourado)
                    }
                    .position(x: p.x, y: p.y)
                case .apice:
                    ZStack {
                        Circle().fill(Color.black.opacity(0.7)).frame(width: 7, height: 7)
                        Circle().fill(cremoso).frame(width: 4, height: 4)
                    }
                    .position(x: p.x, y: p.y)
                case nil:
                    EmptyView()
                }
            }
        }
    }

    private func posicaoFaixaModal(_ f: TrackSegmentFaixa,
                                    dims: (w: CGFloat, h: CGFloat),
                                    geo: GeometryProxy) -> CGPoint? {
        let inset: CGFloat = 20
        let availableW = geo.size.width - inset * 2
        let availableH = geo.size.height - inset * 2
        let scale = min(availableW / dims.w, availableH / dims.h)
        let offsetX = (geo.size.width - dims.w * scale) / 2.0
        let offsetY = (geo.size.height - dims.h * scale) / 2.0
        return CGPoint(x: offsetX + CGFloat(f.x) * scale,
                       y: offsetY + CGFloat(f.y) * scale)
    }

    @ViewBuilder
    private func trechoHotspot(_ seg: TrackSegmentRow, ordem: Int,
                               geo: GeometryProxy, dims: (w: CGFloat, h: CGFloat)) -> some View {
        if let pos = posicaoTrecho(seg, dims: dims, geo: geo) {
            let isSelecionado = trechoSelecionado == seg.id
            Button {
                trechoSelecionado = seg.id
            } label: {
                ZStack {
                    Circle()
                        .fill(isSelecionado ? Color.atencao : Color.accent)
                        .frame(width: 26, height: 26)
                    Text("\(ordem)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.onAccent)
                }
            }
            .buttonStyle(.plain)
            .position(x: pos.x, y: pos.y)
        }
    }

    private func posicaoTrecho(_ seg: TrackSegmentRow,
                               dims: (w: CGFloat, h: CGFloat),
                               geo: GeometryProxy) -> CGPoint? {
        let geom = SegmentGeometry.decode(seg.geometria)
        guard let g = geom else { return nil }
        let inset: CGFloat = 20
        let availableW = geo.size.width - inset * 2
        let availableH = geo.size.height - inset * 2
        let scale = min(availableW / dims.w, availableH / dims.h)
        let offsetX = (geo.size.width - dims.w * scale) / 2.0
        let offsetY = (geo.size.height - dims.h * scale) / 2.0
        return CGPoint(
            x: offsetX + CGFloat(g.x) * scale,
            y: offsetY + CGFloat(g.y) * scale
        )
    }

    private var semMapa: some View {
        Text("Mapa não cadastrado para este autódromo.\nQuando o editor visual entrar (rodada futura), você desenha o traçado aqui.")
            .font(.system(size: 14))
            .foregroundStyle(Color.textMuted)
            .multilineTextAlignment(.center)
            .padding(Spacing.lg)
    }

    private func parseViewBox(_ json: String?) -> (w: CGFloat, h: CGFloat)? {
        guard let json = json, let data = json.data(using: .utf8) else { return nil }
        struct V: Decodable { let w: Double; let h: Double }
        if let v = try? JSONDecoder().decode(V.self, from: data) {
            return (CGFloat(v.w), CGFloat(v.h))
        }
        return nil
    }
}
