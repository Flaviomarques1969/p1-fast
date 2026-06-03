// ═══════════════════════════════════════════════════════════
// ManutencaoViews — telas da função Manutenção (2026-05-18)
// ═══════════════════════════════════════════════════════════
// Arquivo único pra coesão. Telas neste arquivo:
//
//   • ManutencaoCarroView           — abre da seção "Manutenção" do
//     painel do carro. 2 abas: Histórico (lista cronológica + FAB
//     "Nova troca") · Especificação padrão (15 itens do catálogo).
//   • ManutencaoFormView            — formulário de nova troca (Bloco 2).
//   • ManutencaoEspecificacaoFormView — formulário "qual é o óleo padrão
//     do meu Subaru" (1 item por vez).
//   • ManutencaoItemDetalheView     — ficha do item: contador vivo,
//     média aprendida, previsão, detecção de anomalia (Bloco 5).
//
// Decisões fixas:
//   • Aba "Histórico" e "Especificação padrão" — picker simples no topo
//   • FAB "Nova troca" só na aba Histórico
//   • Lista cronológica decrescente (último em cima)
//   • Especificação agrupada por área (Motor, Câmbio, Freios…)

import SwiftUI
import P1FastCore
import PhotosUI

// ═══════════════════════════════════════════════════════════
// MARK: - ManutencaoCarroView (root)
// ═══════════════════════════════════════════════════════════

struct ManutencaoCarroView: View {
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var manutencaoRepo: ManutencaoRepository
    @EnvironmentObject private var pecaRepo: PecaRepository
    @EnvironmentObject private var navCoordinator: NavigationCoordinator

    let carroId: String
    let onClose: () -> Void

    @State private var abaSelecionada: Aba = .historico
    @State private var sheet: SheetTarget?
    @State private var detalheItem: ManutencaoItemDef?

    enum Aba: String, CaseIterable, Identifiable {
        case historico = "Histórico"
        case especificacao = "Especificação padrão"
        var id: String { rawValue }
    }

    enum SheetTarget: Identifiable {
        case novaTroca
        case editarEspecificacao(itemCodigo: String)
        var id: String {
            switch self {
            case .novaTroca: return "nova-troca"
            case .editarEspecificacao(let c): return "spec-\(c)"
            }
        }
    }

    private var carro: Carro? {
        carroRepo.carros.first { $0.id == carroId }
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollView {
                conteudo
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, 140)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            if abaSelecionada == .historico {
                FAB("Nova troca") { sheet = .novaTroca }
                    .padding(.trailing, Spacing.md)
                    .padding(.bottom, 110)
            }
        }
        .navigationTitle("Manutenção")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .sheet(item: $sheet) { target in
            switch target {
            case .novaTroca:
                ManutencaoFormView(carroId: carroId) { sheet = nil }
            case .editarEspecificacao(let codigo):
                ManutencaoEspecificacaoFormView(
                    carroId: carroId,
                    itemCodigo: codigo,
                    onClose: { sheet = nil }
                )
            }
        }
        .sheet(item: $detalheItem) { item in
            ManutencaoItemDetalheView(
                carroId: carroId,
                itemDef: item,
                onClose: { detalheItem = nil }
            )
        }
    }

    @ViewBuilder
    private var conteudo: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            cabecalho
            pendenciasAutomaticas
            seletorAbas
            switch abaSelecionada {
            case .historico:    abaHistorico
            case .especificacao: abaEspecificacao
            }
        }
    }

    // MARK: - Pendências automáticas (Bloco 4)

    /// Lista os itens que estão amarelos/vermelhos calculados a partir
    /// da regra de periodicidade + última manutenção registrada. Bloco 4
    /// usa contador APROXIMADO (apenas dias calendário até ter histórico
    /// pra estimar km/voltas) — ManutencaoItemDetalheView traz o cálculo
    /// completo com SQL.
    @ViewBuilder
    private var pendenciasAutomaticas: some View {
        let lista = pendenciasComputadas()
        if !lista.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("ATENÇÃO")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(Color.textFaint)
                ForEach(lista, id: \.item.codigo) { p in
                    Button { detalheItem = p.item } label: {
                        cardPendencia(p)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private struct PendenciaCalc {
        let item: ManutencaoItemDef
        let status: ManutencaoStatus
        let ultimaData: Int64?
    }

    /// Pendências baseadas só nos dados disponíveis aqui (sem
    /// consulta SQL). Considera dias calendário + km da última troca.
    /// Detalhe completo (com km de pista + horas) vive em
    /// ManutencaoItemDetalheView.
    private func pendenciasComputadas() -> [PendenciaCalc] {
        let agoraMs = Int64(Date().timeIntervalSince1970 * 1000)
        var resultado: [PendenciaCalc] = []
        for item in ManutencaoCatalogo.itens {
            let ultima = manutencaoRepo.ultimaManutencao(carroId: carroId, itemCodigo: item.codigo)
            guard let ultima = ultima else { continue }
            let regra = manutencaoRepo.regra(carroId: carroId, itemCodigo: item.codigo)
            let dias = Int(round(Double(agoraMs - ultima.ocorridoEm) / (24.0 * 60.0 * 60.0 * 1000.0)))
            let contador = ContadorVida(kmRua: 0, kmPista: 0, horas: 0, dias: dias)
            let status = avaliarStatus(regra: regra, contador: contador)
            if status.severidade == .amarelo || status.severidade == .vermelho {
                resultado.append(PendenciaCalc(
                    item: item, status: status, ultimaData: ultima.ocorridoEm
                ))
            }
        }
        // Vermelhos primeiro, depois amarelos
        return resultado.sorted { l, r in
            if l.status.severidade == r.status.severidade {
                return (l.status.fracao ?? 0) > (r.status.fracao ?? 0)
            }
            return l.status.severidade == .vermelho
        }
    }

    private func cardPendencia(_ p: PendenciaCalc) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(p.status.severidade == .vermelho ? Color.atencao : Color.yellow)
                .frame(width: 10, height: 10)
                .padding(.top, 5)
            VStack(alignment: .leading, spacing: 3) {
                Text(p.item.nome)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text(p.status.resumo)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.textFaint)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(
                    p.status.severidade == .vermelho ? Color.atencao.opacity(0.5) : Color.yellow.opacity(0.4),
                    lineWidth: 1
                )
        )
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: "Manutenção")
            Text(carro?.apelido ?? "Carro")
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            if let m = carro?.modelo, !m.isEmpty {
                Text(m)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
            }
        }
    }

    private var seletorAbas: some View {
        HStack(spacing: 0) {
            ForEach(Aba.allCases) { aba in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        abaSelecionada = aba
                    }
                } label: {
                    Text(aba.rawValue)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(abaSelecionada == aba ? Color.onAccent : Color.text)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(abaSelecionada == aba ? Color.accent : Color.surfaceRaised)
                        )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 2)
            }
        }
    }

    // MARK: - Aba: Histórico

    @ViewBuilder
    private var abaHistorico: some View {
        let lista = manutencaoRepo.manutencoes(doCarro: carroId)
        if lista.isEmpty {
            estadoVazioHistorico
        } else {
            VStack(spacing: 10) {
                ForEach(lista, id: \.id) { m in
                    cardManutencao(m)
                }
            }
        }
    }

    private var estadoVazioHistorico: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("VOCÊ AINDA NÃO REGISTROU NENHUMA TROCA")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.4)
                .foregroundStyle(Color.textFaint)
            Text("Toque em **+ Nova troca** pra registrar a primeira manutenção desse carro. Use o histórico pra acompanhar quando precisa trocar de novo.")
                .font(.system(size: 13))
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
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

    private func cardManutencao(_ m: Manutencao) -> some View {
        let def = ManutencaoCatalogo.find(m.itemCodigo)
        let titulo = def?.nome ?? m.itemCodigo
        return Button {
            if let def = def { detalheItem = def }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(titulo)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.text)
                    Spacer()
                    Text(Self.dataCurta(ms: m.ocorridoEm))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Color.textMuted)
                }
                Text(detalhesLinha(m))
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textMuted)
                    .lineLimit(2)
            }
            .padding(12)
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
        .buttonStyle(.plain)
    }

    private func detalhesLinha(_ m: Manutencao) -> String {
        var parts: [String] = []
        if let marca = m.marca, !marca.isEmpty { parts.append(marca) }
        if let modelo = m.modelo, !modelo.isEmpty { parts.append(modelo) }
        if let spec = m.especificacao, !spec.isEmpty { parts.append(spec) }
        if let km = m.kmCarro {
            parts.append("\(formatarKmCurto(km)) km")
        }
        return parts.isEmpty ? "Sem detalhes" : parts.joined(separator: " · ")
    }

    // MARK: - Aba: Especificação padrão

    private var abaEspecificacao: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Cadastre **qual** é o item padrão pra esse carro (marca, modelo, especificação). Quando registrar uma troca, esses dados aparecem pré-preenchidos.")
                .font(.system(size: 12))
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 4)

            ForEach(ManutencaoCatalogo.itensPorArea(), id: \.0) { (area, itens) in
                VStack(alignment: .leading, spacing: 10) {
                    Text(area.rawValue.uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(1.4)
                        .foregroundStyle(Color.textFaint)
                    VStack(spacing: 6) {
                        ForEach(itens, id: \.codigo) { item in
                            botaoItemEspecificacao(item)
                        }
                    }
                }
            }
        }
    }

    private func botaoItemEspecificacao(_ item: ManutencaoItemDef) -> some View {
        let spec = manutencaoRepo.especificacao(carroId: carroId, itemCodigo: item.codigo)
        let resumoSpec = Self.resumoSpec(spec)
        return Button {
            sheet = .editarEspecificacao(itemCodigo: item.codigo)
        } label: {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.nome)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.text)
                    Text(resumoSpec)
                        .font(.system(size: 12))
                        .foregroundStyle(resumoSpec == "Sem cadastro" ? Color.textFaint : Color.textMuted)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.textFaint)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private static func resumoSpec(_ spec: ManutencaoEspecificacao?) -> String {
        guard let s = spec else { return "Sem cadastro" }
        var parts: [String] = []
        if let m = s.marca, !m.isEmpty { parts.append(m) }
        if let mo = s.modelo, !mo.isEmpty { parts.append(mo) }
        if let e = s.especificacao, !e.isEmpty { parts.append(e) }
        return parts.isEmpty ? "Sem cadastro" : parts.joined(separator: " · ")
    }

    private static func dataCurta(ms: Int64) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "dd/MM/yyyy"
        return f.string(from: Date(timeIntervalSince1970: TimeInterval(ms) / 1000))
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - ManutencaoFormView (Bloco 2)
// ═══════════════════════════════════════════════════════════

struct ManutencaoFormView: View {
    @EnvironmentObject private var manutencaoRepo: ManutencaoRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var pecaRepo: PecaRepository

    let carroId: String
    let onClose: () -> Void

    @State private var itemCodigo: String = ManutencaoCatalogo.itens.first?.codigo ?? ""
    @State private var data: Date = Date()
    @State private var kmCarroTexto: String = ""
    @State private var marca: String = ""
    @State private var modelo: String = ""
    @State private var especificacao: String = ""
    @State private var observacao: String = ""
    @State private var pecaIdSelecionada: String? = nil
    @State private var photoItem: PhotosPickerItem? = nil
    @State private var fotoSelecionada: UIImage? = nil
    @State private var salvando = false
    @State private var erro: String? = nil
    @State private var marcouComoSpecPadrao = false

    private var itemDef: ManutencaoItemDef? {
        ManutencaoCatalogo.find(itemCodigo)
    }

    private var podeSalvar: Bool {
        !itemCodigo.isEmpty && !salvando
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    cabecalho
                    blocoItem
                    blocoData
                    blocoMarcaModelo
                    blocoKmFoto
                    blocoEstoque
                    blocoObservacao
                    if let erro = erro {
                        Text(erro)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.atencao)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 120)
            }
            .background(Color.surface)
            .navigationTitle("Nova troca")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") { onClose() }.foregroundStyle(Color.text)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Salvar") { Task { await salvar() } }
                        .foregroundStyle(podeSalvar ? Color.accent : Color.textFaint)
                        .disabled(!podeSalvar)
                }
            }
            .onChange(of: itemCodigo) { _, novo in
                preencherDoSpecPadrao(itemCodigo: novo)
            }
            .onChange(of: photoItem) { _, item in
                Task {
                    if let item, let data = try? await item.loadTransferable(type: Data.self),
                       let img = UIImage(data: data) {
                        fotoSelecionada = img
                    }
                }
            }
            .task {
                preencherDoSpecPadrao(itemCodigo: itemCodigo)
            }
            .preferredColorScheme(.dark)
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 2) {
            Eyebrow(text: carroRepo.carros.first { $0.id == carroId }?.apelido ?? "Carro")
            Text("Registrar troca")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Color.text)
        }
    }

    private var blocoItem: some View {
        secao(titulo: "Item") {
            Menu {
                ForEach(ManutencaoCatalogo.itensPorArea(), id: \.0) { (area, itens) in
                    Section(area.rawValue) {
                        ForEach(itens, id: \.codigo) { item in
                            Button(item.nome) { itemCodigo = item.codigo }
                        }
                    }
                }
            } label: {
                HStack {
                    Text(itemDef?.nome ?? "Escolha o item")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.text)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.textFaint)
                }
                .padding(12)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.surfaceRaised)
                )
            }
            if let def = itemDef {
                Text("Área: \(def.area.rawValue)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }

    private var blocoData: some View {
        secao(titulo: "Quando") {
            DatePicker("Data", selection: $data, in: ...Date(), displayedComponents: .date)
                .datePickerStyle(.compact)
                .labelsHidden()
                .tint(Color.accent)
                .colorScheme(.dark)
        }
    }

    private var blocoMarcaModelo: some View {
        secao(titulo: "Detalhes do item") {
            VStack(spacing: 8) {
                campoTexto(label: "Marca", text: $marca, placeholder: "Ex.: Motul")
                campoTexto(label: "Modelo", text: $modelo, placeholder: "Ex.: 8100 X-Cess")
                campoTexto(label: "Especificação", text: $especificacao, placeholder: "Ex.: 5W40 4L")
            }
            Toggle("Salvar como especificação padrão deste carro", isOn: $marcouComoSpecPadrao)
                .toggleStyle(.switch)
                .tint(Color.accent)
                .font(.system(size: 12))
                .foregroundStyle(Color.textMuted)
        }
    }

    private var blocoKmFoto: some View {
        secao(titulo: "Km do carro · Foto") {
            VStack(spacing: 8) {
                campoTexto(label: "Quilometragem (km)", text: $kmCarroTexto, placeholder: "Ex.: 35230", keyboard: .decimalPad)
                HStack {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Text(fotoSelecionada == nil ? "Adicionar foto" : "Trocar foto")
                            .font(.system(size: 13, weight: .semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .foregroundStyle(Color.onAccent)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(Color.accent)
                            )
                    }
                    if let img = fotoSelecionada {
                        Image(uiImage: img).resizable().scaledToFill()
                            .frame(width: 44, height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    Spacer()
                }
            }
        }
    }

    @ViewBuilder
    private var blocoEstoque: some View {
        let pecasCompatíveis = pecasDoMesmoItemNoCarro
        if !pecasCompatíveis.isEmpty {
            secao(titulo: "Abater do estoque (opcional)") {
                VStack(spacing: 6) {
                    Button {
                        pecaIdSelecionada = nil
                    } label: {
                        linhaPecaOpcao(label: "Não abater do estoque",
                                       complemento: nil,
                                       selecionada: pecaIdSelecionada == nil)
                    }.buttonStyle(.plain)
                    ForEach(pecasCompatíveis, id: \.id) { p in
                        Button {
                            pecaIdSelecionada = p.id
                        } label: {
                            linhaPecaOpcao(
                                label: p.nome,
                                complemento: "qtd: \(p.quantidade)",
                                selecionada: pecaIdSelecionada == p.id
                            )
                        }.buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var blocoObservacao: some View {
        secao(titulo: "Observação (opcional)") {
            TextField("Detalhes da troca, condições do item, etc.", text: $observacao, axis: .vertical)
                .lineLimit(3...6)
                .font(.system(size: 13))
                .foregroundStyle(Color.text)
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.surfaceRaised)
                )
        }
    }

    private var pecasDoMesmoItemNoCarro: [Peca] {
        // Heurística: peças do carro cuja área bate com a área do item.
        // Funciona com o vocabulário existente do Estoque sem precisar
        // de relação direta peça↔item de manutenção.
        let area = itemDef?.area
        return pecaRepo.pecas(doCarro: carroId).filter { p in
            guard let area = area else { return false }
            return p.area == area.rawValue && p.quantidade > 0
        }
    }

    private func linhaPecaOpcao(label: String, complemento: String?, selecionada: Bool) -> some View {
        HStack {
            Image(systemName: selecionada ? "largecircle.fill.circle" : "circle")
                .foregroundStyle(selecionada ? Color.accent : Color.textFaint)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 13, weight: .medium)).foregroundStyle(Color.text)
                if let c = complemento {
                    Text(c).font(.system(size: 11)).foregroundStyle(Color.textMuted)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.surfaceRaised)
        )
    }

    private func campoTexto(label: String, text: Binding<String>, placeholder: String, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(Color.textFaint)
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .font(.system(size: 14))
                .foregroundStyle(Color.text)
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.surfaceRaised)
                )
        }
    }

    @ViewBuilder
    private func secao<C: View>(titulo: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(titulo.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.4)
                .foregroundStyle(Color.textFaint)
            content()
        }
        .padding(.horizontal, 12).padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised.opacity(0.6))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func preencherDoSpecPadrao(itemCodigo: String) {
        guard let spec = manutencaoRepo.especificacao(carroId: carroId, itemCodigo: itemCodigo) else {
            // Sem spec padrão: zera os 3 campos pra evitar carregar dado
            // do item anterior. Se já tinha algo preenchido, preserva.
            return
        }
        if marca.isEmpty, let m = spec.marca { marca = m }
        if modelo.isEmpty, let mo = spec.modelo { modelo = mo }
        if especificacao.isEmpty, let e = spec.especificacao { especificacao = e }
    }

    @MainActor
    private func salvar() async {
        guard let def = itemDef else { return }
        salvando = true
        defer { salvando = false }
        let km: Double? = Double(kmCarroTexto.replacingOccurrences(of: ",", with: "."))
        do {
            _ = try await manutencaoRepo.criar(
                carroId: carroId,
                itemCodigo: def.codigo,
                area: def.area,
                ocorridoEm: Int64(data.timeIntervalSince1970 * 1000),
                kmCarro: km,
                marca: marca,
                modelo: modelo,
                especificacao: especificacao,
                observacao: observacao,
                foto: fotoSelecionada,
                pecaId: pecaIdSelecionada,
                quantidade: 1
            )
            // Se o gestor marcou "salvar como spec padrão", grava também
            // na tabela de especificações pra próximas trocas virem
            // pré-preenchidas.
            if marcouComoSpecPadrao {
                try? await manutencaoRepo.upsertEspecificacao(
                    carroId: carroId, itemCodigo: def.codigo,
                    marca: marca, modelo: modelo,
                    especificacao: especificacao, observacao: nil
                )
            }
            onClose()
        } catch {
            erro = "Não foi possível salvar: \(error.localizedDescription)"
        }
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - ManutencaoEspecificacaoFormView
// ═══════════════════════════════════════════════════════════

struct ManutencaoEspecificacaoFormView: View {
    @EnvironmentObject private var manutencaoRepo: ManutencaoRepository

    let carroId: String
    let itemCodigo: String
    let onClose: () -> Void

    @State private var marca: String = ""
    @State private var modelo: String = ""
    @State private var especificacao: String = ""
    @State private var observacao: String = ""
    @State private var carregando = true

    private var itemDef: ManutencaoItemDef? {
        ManutencaoCatalogo.find(itemCodigo)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    cabecalho
                    secao(titulo: "Marca · Modelo · Especificação") {
                        campoTexto(label: "Marca", text: $marca, placeholder: "Ex.: Motul")
                        campoTexto(label: "Modelo", text: $modelo, placeholder: "Ex.: 8100 X-Cess")
                        campoTexto(label: "Especificação", text: $especificacao, placeholder: "Ex.: 5W40")
                    }
                    secao(titulo: "Observação (opcional)") {
                        TextField("Detalhes", text: $observacao, axis: .vertical)
                            .lineLimit(3...6)
                            .font(.system(size: 13))
                            .padding(10)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(Color.surfaceRaised)
                            )
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 120)
            }
            .background(Color.surface)
            .navigationTitle(itemDef?.nome ?? itemCodigo)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") { onClose() }.foregroundStyle(Color.text)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Salvar") { Task { await salvar() } }
                        .foregroundStyle(Color.accent)
                }
            }
            .task {
                if let spec = manutencaoRepo.especificacao(carroId: carroId, itemCodigo: itemCodigo) {
                    marca = spec.marca ?? ""
                    modelo = spec.modelo ?? ""
                    especificacao = spec.especificacao ?? ""
                    observacao = spec.observacao ?? ""
                }
                carregando = false
            }
            .preferredColorScheme(.dark)
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 2) {
            Eyebrow(text: itemDef?.area.rawValue ?? "Item")
            Text(itemDef?.nome ?? itemCodigo)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Color.text)
        }
    }

    @ViewBuilder
    private func secao<C: View>(titulo: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(titulo.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.4)
                .foregroundStyle(Color.textFaint)
            content()
        }
        .padding(.horizontal, 12).padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised.opacity(0.6))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func campoTexto(label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(Color.textFaint)
            TextField(placeholder, text: text)
                .font(.system(size: 14))
                .foregroundStyle(Color.text)
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.surfaceRaised)
                )
        }
    }

    @MainActor
    private func salvar() async {
        do {
            try await manutencaoRepo.upsertEspecificacao(
                carroId: carroId, itemCodigo: itemCodigo,
                marca: marca, modelo: modelo,
                especificacao: especificacao, observacao: observacao
            )
            onClose()
        } catch {
            print("upsertEspecificacao failed: \(error)")
        }
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - ManutencaoItemDetalheView (Bloco 5)
// ═══════════════════════════════════════════════════════════

struct ManutencaoItemDetalheView: View {
    @EnvironmentObject private var manutencaoRepo: ManutencaoRepository
    @EnvironmentObject private var stintRepo: StintRepository
    @EnvironmentObject private var trackRepo: TrackRepository

    let carroId: String
    let itemDef: ManutencaoItemDef
    let onClose: () -> Void

    @State private var contador: ContadorVida = .zero
    @State private var media: DuracaoEntreTrocas? = nil
    @State private var historico: [Manutencao] = []
    @State private var carregando = true

    private var regraEfetiva: PeriodicidadeRegra {
        manutencaoRepo.regra(carroId: carroId, itemCodigo: itemDef.codigo)
    }

    private var statusAtual: ManutencaoStatus {
        avaliarStatus(regra: regraEfetiva, contador: contador)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    cabecalho
                    blocoStatus
                    blocoContador
                    blocoMedia
                    blocoHistorico
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 120)
            }
            .background(Color.surface)
            .navigationTitle(itemDef.nome)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fechar") { onClose() }.foregroundStyle(Color.text)
                }
            }
            .task { await carregar() }
            .preferredColorScheme(.dark)
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 2) {
            Eyebrow(text: itemDef.area.rawValue)
            Text(itemDef.nome)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Color.text)
        }
    }

    private var blocoStatus: some View {
        let status = statusAtual
        return secao(titulo: "Status atual") {
            HStack(spacing: 10) {
                Circle()
                    .fill(corDoStatus(status.severidade))
                    .frame(width: 12, height: 12)
                Text(textoStatus(status.severidade))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.text)
                Spacer()
            }
            Text(status.resumo)
                .font(.system(size: 12))
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var blocoContador: some View {
        secao(titulo: "Desde a última troca") {
            if historico.isEmpty {
                Text("Sem trocas registradas ainda. Quando você registrar a primeira, esse contador começa a rodar.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textFaint)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    linhaInfo(label: "Km de rua", valor: "\(formatarKmCurto(contador.kmRua)) km")
                    linhaInfo(label: "Km de pista", valor: "\(formatarKmCurto(contador.kmPista)) km")
                    linhaInfo(label: "Horas de stint", valor: String(format: "%.1f h", contador.horas))
                    linhaInfo(label: "Dias", valor: "\(contador.dias)")
                }
            }
        }
    }

    private var blocoMedia: some View {
        secao(titulo: "Média aprendida") {
            if let m = media {
                VStack(alignment: .leading, spacing: 6) {
                    if let km = m.kmRua {
                        linhaInfo(label: "Km de rua", valor: "\(formatarKmCurto(km)) km")
                    }
                    if m.kmPista > 0 {
                        linhaInfo(label: "Km de pista", valor: "\(formatarKmCurto(m.kmPista)) km")
                    }
                    if m.horas > 0 {
                        linhaInfo(label: "Horas", valor: String(format: "%.1f h", m.horas))
                    }
                    linhaInfo(label: "Dias", valor: "\(m.dias)")
                    Text("Média calculada com \(historico.count - 1) intervalo\(historico.count - 1 == 1 ? "" : "s") entre trocas registradas.")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.textFaint)
                        .padding(.top, 4)
                }
            } else if historico.count < 2 {
                Text("Precisa de pelo menos 2 trocas registradas pra começar a aprender quanto dura. Hoje: \(historico.count) troca\(historico.count == 1 ? "" : "s") registrada\(historico.count == 1 ? "" : "s").")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textFaint)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Calculando…")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textFaint)
            }
        }
    }

    private var blocoHistorico: some View {
        secao(titulo: "Histórico desse item") {
            if historico.isEmpty {
                Text("Sem registros.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textFaint)
            } else {
                VStack(spacing: 6) {
                    ForEach(historico.reversed(), id: \.id) { m in
                        HStack {
                            Text(Self.dataCurta(ms: m.ocorridoEm))
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundStyle(Color.textMuted)
                            Spacer()
                            if let km = m.kmCarro {
                                Text("\(formatarKmCurto(km)) km")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.textFaint)
                            }
                        }
                        .padding(.horizontal, 10).padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.surfaceRaised)
                        )
                    }
                }
            }
        }
    }

    private func linhaInfo(label: String, valor: String) -> some View {
        HStack {
            Text(label).font(.system(size: 12)).foregroundStyle(Color.textMuted)
            Spacer()
            Text(valor).font(.system(size: 13, weight: .medium, design: .monospaced))
                .foregroundStyle(Color.text)
        }
    }

    private func corDoStatus(_ s: ManutencaoSeveridade) -> Color {
        switch s {
        case .verde: return Color.green
        case .amarelo: return Color.yellow
        case .vermelho: return Color.atencao
        case .desgasteManual, .semHistorico: return Color.textFaint
        }
    }

    private func textoStatus(_ s: ManutencaoSeveridade) -> String {
        switch s {
        case .verde: return "Dentro do limite"
        case .amarelo: return "Aproximando do limite"
        case .vermelho: return "Vencido"
        case .desgasteManual: return "Por desgaste"
        case .semHistorico: return "Sem histórico"
        }
    }

    @ViewBuilder
    private func secao<C: View>(titulo: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(titulo.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.4)
                .foregroundStyle(Color.textFaint)
            content()
        }
        .padding(.horizontal, 12).padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised.opacity(0.6))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    @MainActor
    private func carregar() async {
        carregando = true
        historico = manutencaoRepo.historicoItem(carroId: carroId, itemCodigo: itemDef.codigo)
        contador = await ManutencaoInteligencia.contadorDesdeUltimaTroca(
            carroId: carroId, itemCodigo: itemDef.codigo,
            historico: historico,
            stintRepo: stintRepo,
            trackRepo: trackRepo
        )
        if historico.count >= 2 {
            media = await ManutencaoInteligencia.mediaEntreTrocas(
                carroId: carroId,
                historico: historico,
                stintRepo: stintRepo,
                trackRepo: trackRepo
            )
        } else {
            media = nil
        }
        carregando = false
    }

    private static func dataCurta(ms: Int64) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "dd/MM/yyyy"
        return f.string(from: Date(timeIntervalSince1970: TimeInterval(ms) / 1000))
    }
}
