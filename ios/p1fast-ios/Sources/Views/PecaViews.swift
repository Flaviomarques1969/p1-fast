// ═══════════════════════════════════════════════════════════
// PecaViews — telas da função "Peças do carro" (2026-05-17)
// ═══════════════════════════════════════════════════════════
// 4 telas num arquivo só pra coesão:
//   • PecaListaView      — lista por carro, filtros, busca, FAB
//   • PecaNovoFormView   — cadastro (foto, nome, código, área, tipo,
//                          carro, especificação, qtd inicial, local)
//   • PecaDetalheView    — ficha + botões −1/+1 + histórico
//   • PecaLocalListaView — CRUD de locais de estoque
//
// Decisões aplicadas (HTML 20260517-000200):
//   A=banco-unico · B=dentro-garagem · C=livre-cadastravel
//   D=por-carro · E=lista-fixa-padrao · F=botao-rapido-com-historico

import SwiftUI
import P1FastCore
import PhotosUI

// ═══════════════════════════════════════════════════════════
// MARK: - PecaListaView
// ═══════════════════════════════════════════════════════════
struct PecaListaView: View {
    @EnvironmentObject private var repo: PecaRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    let onClose: () -> Void

    /// Abre já filtrada por um carro (usado pelo hub do carro). nil = todos.
    init(carroInicial: String? = nil, onClose: @escaping () -> Void) {
        self.onClose = onClose
        _carroFiltroId = State(initialValue: carroInicial)
    }

    @State private var carroFiltroId: String?
    @State private var tipoFiltro: TipoFiltro = .todos
    @State private var busca: String = ""
    @State private var sheet: PecaSheet?
    @State private var pecaDetalhe: Peca?

    enum TipoFiltro: String, CaseIterable, Identifiable {
        case todos = "Tudo"
        case componente = "Componentes"
        case ferramenta = "Ferramentas"
        var id: String { rawValue }
    }

    enum PecaSheet: Identifiable {
        case nova(carroIdSugerido: String?, tipoSugerido: PecaTipo?)
        case locais
        var id: String {
            switch self {
            case .nova(let c, let t): return "nova-\(c ?? "_")-\(t?.rawValue ?? "_")"
            case .locais: return "locais"
            }
        }
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

            FAB("Nova peça") {
                // 2026-05-17 — se o filtro de carro/tipo já está em algo
                // específico, abre o formulário JÁ COM essa escolha
                // pré-preenchida (Flávio: "se eu já escolhi um carro no
                // filtro, não me pergunta de novo").
                let tipoSug: PecaTipo? = {
                    switch tipoFiltro {
                    case .componente: return .componente
                    case .ferramenta: return .ferramenta
                    case .todos:      return nil
                    }
                }()
                sheet = .nova(carroIdSugerido: carroFiltroId, tipoSugerido: tipoSug)
            }
            .padding(.trailing, Spacing.md)
            // 2026-05-17 (Flávio): menu inferior fixo cobre o FAB quando
            // padding é pequeno. 110 pt sobe o botão pra cima do menu.
            .padding(.bottom, 110)
        }
        .navigationTitle("Estoque")
        .navigationBarTitleDisplayMode(.inline)
        // 2026-05-17: Back nativo do iOS aparece automaticamente quando
        // empurrada pela pilha. Button("Fechar") removido — era usado
        // só quando esta tela era janela modal.
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Locais") { sheet = .locais }
                    .foregroundStyle(Color.text)
            }
        }
        .preferredColorScheme(.dark)
        .sheet(item: $sheet) { which in
            switch which {
            case .nova(let cid, let tipo):
                PecaNovoFormView(
                    carroIdSugerido: cid,
                    tipoSugerido: tipo,
                    onClose: { sheet = nil }
                )
            case .locais:
                NavigationStack { PecaLocalListaView(onClose: { sheet = nil }) }
            }
        }
        .sheet(item: $pecaDetalhe) { p in
            NavigationStack { PecaDetalheView(peca: p, onClose: { pecaDetalhe = nil }) }
        }
    }

    private var pecasFiltradas: [Peca] {
        var lista = repo.busca(busca)
        if let cid = carroFiltroId { lista = lista.filter { $0.carroId == cid } }
        switch tipoFiltro {
        case .todos: break
        case .componente: lista = lista.filter { $0.tipo == PecaTipo.componente.rawValue }
        case .ferramenta: lista = lista.filter { $0.tipo == PecaTipo.ferramenta.rawValue }
        }
        return lista
    }

    @ViewBuilder
    private var conteudo: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Eyebrow(text: "Garagem · Estoque")
            Text(headerTitulo)
                .font(.system(size: 22, weight: .semibold))
                .tracking(-0.4)
                .foregroundStyle(Color.text)
            Text("Cadastre, busque e movimente as peças que você tem ou que precisa conhecer a especificação.")
                .font(.system(size: 13))
                .foregroundStyle(Color.textMuted)
                .padding(.bottom, Spacing.sm)

            buscaBar
            filtroCarro
            filtroTipo

            if !pecasFiltradas.isEmpty {
                resumoPorArea
            }

            if pecasFiltradas.isEmpty {
                vazio
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(pecasFiltradas, id: \.id) { p in
                        PecaCard(peca: p, localNome: repo.localNome(id: p.localId), carroNome: carroNome(p.carroId))
                            .onTapGesture { pecaDetalhe = p }
                    }
                }
                totalGeral
            }
        }
    }

    // MARK: - Resumo por área (no topo, acima da lista)

    private var resumoPorArea: some View {
        let agrupado = Dictionary(grouping: pecasFiltradas, by: { $0.area })
            .map { (area: $0.key, pecas: $0.value) }
            .sorted { $0.area < $1.area }
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Resumo por área")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.06 * 12)
                    .foregroundStyle(Color.textMuted)
                Spacer()
            }
            ForEach(agrupado, id: \.area) { grupo in
                let qtd = grupo.pecas.reduce(0) { $0 + $1.quantidade }
                let valorCents = grupo.pecas.reduce(0) { $0 + ($1.valorTotalCents ?? 0) }
                let temPreco = grupo.pecas.contains { $0.precoUnitarioCents != nil }
                HStack {
                    Text(grupo.area)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.text)
                    Spacer()
                    Text("\(qtd) \(qtd == 1 ? "peça" : "peças")")
                        .font(.system(size: 12)).foregroundStyle(Color.textMuted)
                    Text("·").foregroundStyle(Color.textFaint)
                    Text(temPreco ? MoedaBR.formatar(centavos: valorCents) : "—")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(temPreco ? Color.text : Color.textFaint)
                        .frame(minWidth: 72, alignment: .trailing)
                }
                .padding(.vertical, 6)
                .padding(.horizontal, 12)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.surfaceRaised.opacity(0.5)))
            }
        }
        .padding(.vertical, Spacing.sm)
    }

    // MARK: - Total geral (no rodapé, abaixo da lista)

    private var totalGeral: some View {
        let qtdTotal = pecasFiltradas.reduce(0) { $0 + $1.quantidade }
        let valorTotalCents = pecasFiltradas.reduce(0) { $0 + ($1.valorTotalCents ?? 0) }
        let temPreco = pecasFiltradas.contains { $0.precoUnitarioCents != nil }
        return HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Total geral")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.06 * 11)
                    .foregroundStyle(Color.textMuted)
                Text("\(qtdTotal) \(qtdTotal == 1 ? "peça" : "peças")")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.text)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("Valor estimado")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.06 * 11)
                    .foregroundStyle(Color.textMuted)
                Text(temPreco ? MoedaBR.formatar(centavos: valorTotalCents) : "—")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(temPreco ? Color.text : Color.textFaint)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.accent.opacity(0.4), lineWidth: 1))
        .padding(.top, Spacing.md)
    }

    private var headerTitulo: String {
        let n = pecasFiltradas.count
        if n == 0 { return "Nenhuma peça encontrada" }
        if n == 1 { return "1 peça" }
        return "\(n) peças"
    }

    private var buscaBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.textFaint)
            TextField("Buscar por nome, código, área...",
                      text: $busca,
                      prompt: Text("Buscar por nome, código, área...").foregroundStyle(Color.textFaint))
                .textFieldStyle(.plain)
                .foregroundStyle(Color.text)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
    }

    private var filtroCarro: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                pillCarro(id: nil, label: "Todos os carros")
                ForEach(carroRepo.carros, id: \.id) { c in
                    pillCarro(id: c.id, label: c.apelido)
                }
            }
        }
    }

    private func pillCarro(id: String?, label: String) -> some View {
        let isAtivo = carroFiltroId == id
        return Button {
            carroFiltroId = id
        } label: {
            Text(label)
                .font(.system(size: 13, weight: isAtivo ? .semibold : .regular))
                .foregroundStyle(isAtivo ? Color.onAccent : Color.text)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(
                    Capsule().fill(isAtivo ? Color.accent : Color.surfaceRaised)
                )
                .overlay(Capsule().stroke(Color.border, lineWidth: isAtivo ? 0 : 1))
        }
        .buttonStyle(.plain)
    }

    private var filtroTipo: some View {
        HStack(spacing: 8) {
            ForEach(TipoFiltro.allCases) { t in
                let isAtivo = tipoFiltro == t
                Button {
                    tipoFiltro = t
                } label: {
                    Text(t.rawValue)
                        .font(.system(size: 13, weight: isAtivo ? .semibold : .regular))
                        .foregroundStyle(isAtivo ? Color.onAccent : Color.text)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(Capsule().fill(isAtivo ? Color.accent : Color.surfaceRaised))
                        .overlay(Capsule().stroke(Color.border, lineWidth: isAtivo ? 0 : 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var vazio: some View {
        VStack(spacing: 10) {
            Text(busca.isEmpty ? "Nenhuma peça cadastrada ainda" : "Nada encontrado")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.text)
            Text(busca.isEmpty
                 ? "Use o botão laranja embaixo pra cadastrar a primeira."
                 : "Tente outro termo, ou troque os filtros.")
                .font(.system(size: 13))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private func carroNome(_ id: String) -> String {
        carroRepo.carros.first { $0.id == id }?.apelido ?? "—"
    }
}

// ─────────────── PecaCard ───────────────
private struct PecaCard: View {
    let peca: Peca
    let localNome: String?
    let carroNome: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            thumb
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(peca.nome)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.text)
                    Spacer()
                    quantidadePill
                }
                HStack(spacing: 6) {
                    Text(peca.area)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                    if peca.tipo == PecaTipo.ferramenta.rawValue {
                        Text("· Ferramenta")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.accent)
                    }
                }
                if let codigo = peca.codigo, !codigo.isEmpty {
                    Text("Código: \(codigo)")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textFaint)
                }
                HStack(spacing: 6) {
                    Text(carroNome)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.textFaint)
                    if let l = localNome, peca.quantidade > 0 {
                        Text("· em \(l)")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.textFaint)
                    }
                }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
    }

    private var thumb: some View {
        Group {
            if let img = PecaRepository.carregarFoto(pecaId: peca.id) {
                Image(uiImage: img)
                    .resizable().scaledToFill()
            } else {
                ZStack {
                    Rectangle().fill(Color.surface)
                    Image(systemName: "wrench.and.screwdriver")
                        .foregroundStyle(Color.textFaint)
                }
            }
        }
        .frame(width: 56, height: 56)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var quantidadePill: some View {
        let q = peca.quantidade
        let cor: Color = q == 0 ? Color.textFaint : (q < 2 ? Color.atencao : Color.bom)
        return Text(q == 0 ? "sem estoque" : "\(q)")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(cor)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(Color.surface))
            .overlay(Capsule().stroke(cor.opacity(0.5), lineWidth: 1))
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - PecaNovoFormView
// ═══════════════════════════════════════════════════════════
struct PecaNovoFormView: View {
    @EnvironmentObject private var repo: PecaRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    let onClose: () -> Void

    // 2026-05-17 — pré-seleção a partir dos filtros da lista. Se vier
    // != nil, o formulário NÃO mostra o seletor correspondente
    // (Flávio: "se eu já escolhi, não me pergunta de novo").
    let carroIdSugerido: String?
    let tipoSugerido: PecaTipo?

    // 2026-06-01 — modo edição. Se != nil, o form edita a peça existente
    // (pré-preenche tudo, salva via atualizarPeca, esconde "quantidade
    // inicial" e mostra o botão Apagar). `onApagada` fecha também o detalhe.
    let pecaParaEditar: Peca?
    let onApagada: (() -> Void)?

    @State private var nome: String = ""
    @State private var codigo: String = ""
    @State private var area: PecaArea = .motor
    @State private var tipo: PecaTipo
    @State private var especificacao: String = ""
    @State private var carroId: String?
    @State private var quantidade: Int = 0
    @State private var precoTexto: String = ""   // R$ digitado, livre
    @State private var localId: String? = nil
    @State private var observacoes: String = ""
    @State private var fotoItem: PhotosPickerItem?
    @State private var fotos: [UIImage] = []
    @State private var escolherFonteAberto = false
    @State private var cameraAberta = false
    @State private var galeriaAberta = false
    @State private var scannerAberto = false
    @State private var savingError: String?
    @State private var isSaving = false
    /// Permite o usuário "expandir" e trocar a escolha mesmo quando ela
    /// veio pré-preenchida do filtro. Default false: mostra só o resumo.
    @State private var trocarCarro = false
    @State private var trocarTipo = false
    @State private var mostrarConfirmaApagar = false
    // 2026-06-01 — leitura da etiqueta (OCR) e preço do Mercado Livre.
    @State private var escolherFonteEtiquetaAberto = false
    @State private var capturaEtiqueta = false
    @State private var lendoEtiqueta = false
    @State private var buscaPrecoAberta = false

    /// true quando estamos editando uma peça existente.
    private var editando: Bool { pecaParaEditar != nil }

    init(
        carroIdSugerido: String? = nil,
        tipoSugerido: PecaTipo? = nil,
        pecaParaEditar: Peca? = nil,
        onApagada: (() -> Void)? = nil,
        onClose: @escaping () -> Void
    ) {
        self.carroIdSugerido = carroIdSugerido
        self.tipoSugerido = tipoSugerido
        self.pecaParaEditar = pecaParaEditar
        self.onApagada = onApagada
        self.onClose = onClose
        if let p = pecaParaEditar {
            _nome = State(initialValue: p.nome)
            _codigo = State(initialValue: p.codigo ?? "")
            _area = State(initialValue: PecaArea(rawValue: p.area) ?? .motor)
            _tipo = State(initialValue: PecaTipo(rawValue: p.tipo) ?? .componente)
            _especificacao = State(initialValue: p.especificacao ?? "")
            _carroId = State(initialValue: p.carroId)
            _quantidade = State(initialValue: p.quantidade)
            _precoTexto = State(initialValue: Self.precoParaTexto(p.precoUnitarioCents))
            _localId = State(initialValue: p.localId)
            _observacoes = State(initialValue: p.observacoes ?? "")
            _fotos = State(initialValue: PecaRepository.carregarFotos(pecaId: p.id))
        } else {
            _carroId = State(initialValue: carroIdSugerido)
            _tipo = State(initialValue: tipoSugerido ?? .componente)
        }
    }

    /// Centavos → "89,90" pro campo de preço (vazio se nil).
    private static func precoParaTexto(_ cents: Int?) -> String {
        guard let c = cents else { return "" }
        return String(format: "%.2f", Double(c) / 100.0).replacingOccurrences(of: ".", with: ",")
    }

    /// Trim + nil se vazio (modo edição; o criarPeca já faz isso sozinho).
    private func limpo(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    var body: some View {
        NavigationStack {
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
                    onSave: salvar,
                    saveLabel: "Salvar",
                    canSave: podeSalvar && !isSaving
                )
            }
            .preferredColorScheme(.dark)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(editando ? "Editar peça" : "Nova peça").foregroundStyle(Color.text).font(.system(size: 16, weight: .semibold))
                }
            }
        }
        .onAppear {
            // Só usa "primeiro carro" como fallback quando NÃO veio
            // sugestão do filtro (caso "Todos os carros" estava ativo).
            if carroId == nil { carroId = carroRepo.carros.first?.id }
        }
        .onChange(of: fotoItem) { _, novo in
            guard let novo else { return }
            Task {
                if let data = try? await novo.loadTransferable(type: Data.self),
                   let img = UIImage(data: data) {
                    await MainActor.run {
                        if capturaEtiqueta {
                            capturaEtiqueta = false
                            processarEtiqueta(img)
                        } else if fotos.count < PecaRepository.maxFotos {
                            fotos.append(img)
                        }
                        fotoItem = nil
                    }
                }
            }
        }
        .sheet(isPresented: $scannerAberto) {
            BarcodeScannerSheet(
                onCode: { codigo = $0; scannerAberto = false },
                onClose: { scannerAberto = false }
            )
        }
        .photosPicker(isPresented: $galeriaAberta, selection: $fotoItem, matching: .images)
        .fullScreenCover(isPresented: $cameraAberta) {
            CameraPicker(
                onImage: { img in
                    cameraAberta = false
                    if capturaEtiqueta {
                        capturaEtiqueta = false
                        processarEtiqueta(img)
                    } else if fotos.count < PecaRepository.maxFotos {
                        fotos.append(img)
                    }
                },
                onCancel: { cameraAberta = false; capturaEtiqueta = false }
            )
            .ignoresSafeArea()
        }
        .alert("Apagar peça?", isPresented: $mostrarConfirmaApagar) {
            Button("Apagar", role: .destructive) {
                guard let p = pecaParaEditar else { return }
                Task {
                    try? await repo.apagarPeca(p)
                    await MainActor.run { (onApagada ?? onClose)() }
                }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Apaga a peça e todo o histórico de movimentações. Não dá pra recuperar.")
        }
        .confirmationDialog("Ler etiqueta da peça", isPresented: $escolherFonteEtiquetaAberto, titleVisibility: .visible) {
            if CameraPicker.disponivel {
                Button("Tirar foto da etiqueta") { capturaEtiqueta = true; cameraAberta = true }
            }
            Button("Escolher da galeria") { capturaEtiqueta = true; galeriaAberta = true }
            Button("Cancelar", role: .cancel) {}
        }
        .sheet(isPresented: $buscaPrecoAberta) {
            BuscaPrecoMLView(
                termo: termoBuscaML,
                onUsar: { cents in precoTexto = Self.precoParaTexto(cents) },
                onClose: { buscaPrecoAberta = false }
            )
        }
        .overlay {
            if lendoEtiqueta {
                ZStack {
                    Color.black.opacity(0.55).ignoresSafeArea()
                    VStack(spacing: 12) {
                        ProgressView().tint(.white)
                        Text("Lendo a etiqueta...")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
            }
        }
    }

    private var podeSalvar: Bool {
        !nome.trimmingCharacters(in: .whitespaces).isEmpty && carroId != nil
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: "Garagem · Estoque")
                Text(editando ? "Editar peça" : "Cadastrar peça")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text(editando
                     ? "Mude os dados da peça. A quantidade em estoque você ajusta na própria peça, pelos botões de usar e receber."
                     : "Foto + nome são o mínimo. Quantidade e local você preenche só se tiver em estoque.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.bottom, Spacing.xs)

            botaoLerEtiqueta

            FormField(label: "Foto", small: "opcional") {
                fotoPicker
            }

            FormField(label: "Nome") {
                FormInput(text: $nome, placeholder: "Ex: Correia do alternador")
            }

            FormField(label: "Código", small: "opcional") {
                HStack(spacing: 10) {
                    FormInput(text: $codigo, placeholder: "Ex: 5PK890")
                    Button { scannerAberto = true } label: {
                        Image(systemName: "barcode.viewfinder")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(Color.onAccent)
                            .frame(width: 46, height: 46)
                            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.accent))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Escanear código de barras")
                }
            }

            FormField(label: "Especificação e uso no carro", small: "opcional") {
                TextEditorField(text: $especificacao, placeholder: "Ex: calibragem 28 PSI · 3,5 L de óleo no motor · medida, marca, fabricante")
            }

            FormField(label: "Área") {
                Menu {
                    ForEach(PecaArea.allCases, id: \.self) { a in
                        Button(a.rawValue) { area = a }
                    }
                } label: {
                    pickerLabel(text: area.rawValue)
                }
            }

            // Tipo: se o filtro da lista veio com um tipo específico,
            // mostra só resumo. "Trocar" abre o seletor cheio.
            if tipoSugerido != nil && !trocarTipo {
                FormField(label: "Tipo") {
                    resumoEscolha(
                        valor: tipo == .componente ? "Componente do carro" : "Ferramenta de manutenção",
                        nota: "vindo do filtro · toque pra trocar"
                    ) { trocarTipo = true }
                }
            } else {
                FormField(label: "Tipo") {
                    HStack(spacing: 8) {
                        tipoBotao(.componente, label: "Componente do carro")
                        tipoBotao(.ferramenta, label: "Ferramenta de manutenção")
                    }
                }
            }

            // Carro: idem — se já veio do filtro, esconde o seletor.
            if carroIdSugerido != nil && !trocarCarro {
                FormField(label: "Carro vinculado") {
                    resumoEscolha(
                        valor: carroNomeSel ?? "—",
                        nota: "vindo do filtro · toque pra trocar"
                    ) { trocarCarro = true }
                }
            } else {
                FormField(label: "Carro vinculado") {
                    Menu {
                        ForEach(carroRepo.carros, id: \.id) { c in
                            Button(c.apelido) { carroId = c.id }
                        }
                    } label: {
                        pickerLabel(text: carroNomeSel ?? "Escolher carro")
                    }
                }
            }

            FormField(label: "Preço unitário (R$)", small: "opcional") {
                VStack(alignment: .leading, spacing: 8) {
                    FormInput(text: $precoTexto, placeholder: "Ex: 89,90", keyboardType: .decimalPad)
                    Button { buscaPrecoAberta = true } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "magnifyingglass")
                            Text("Buscar preço no Mercado Livre")
                        }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(termoBuscaML.isEmpty ? Color.textFaint : Color.accent)
                    }
                    .buttonStyle(.plain)
                    .disabled(termoBuscaML.isEmpty)
                }
            }

            if !editando {
                FormField(label: "Quantidade em estoque", small: "0 = só sei a especificação") {
                    HStack(spacing: 12) {
                        Button { quantidade = max(0, quantidade - 1) } label: {
                            Text("−").font(.system(size: 22, weight: .bold))
                                .frame(width: 44, height: 44)
                                .background(Circle().fill(Color.surfaceRaised))
                                .foregroundStyle(Color.text)
                        }
                        .buttonStyle(.plain)
                        Text("\(quantidade)")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(Color.text)
                            .frame(minWidth: 60)
                        Button { quantidade += 1 } label: {
                            Text("+").font(.system(size: 22, weight: .bold))
                                .frame(width: 44, height: 44)
                                .background(Circle().fill(Color.surfaceRaised))
                                .foregroundStyle(Color.text)
                        }
                        .buttonStyle(.plain)
                        Spacer()
                    }
                }
            }

            if editando || quantidade > 0 {
                FormField(label: "Local do estoque") {
                    Menu {
                        Button("(nenhum)") { localId = nil }
                        ForEach(repo.locais, id: \.id) { l in
                            Button(l.nome) { localId = l.id }
                        }
                    } label: {
                        pickerLabel(text: repo.localNome(id: localId) ?? "Escolher local")
                    }
                }
            }

            FormField(label: "Observações", small: "opcional") {
                TextEditorField(text: $observacoes, placeholder: "Anotações sobre essa peça")
            }

            if let erro = savingError {
                Text(erro).font(.captionP1).foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }

            if editando {
                botaoApagar
                    .padding(.top, Spacing.sm)
            }
        }
    }

    private var botaoApagar: some View {
        Button(role: .destructive) { mostrarConfirmaApagar = true } label: {
            Text("Apagar peça")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.erro)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
                .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.erro.opacity(0.5), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var fotoPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ForEach(Array(fotos.enumerated()), id: \.offset) { idx, img in
                    ZStack(alignment: .topTrailing) {
                        Image(uiImage: img).resizable().scaledToFill()
                            .frame(width: 72, height: 72)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                            .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
                        Button { fotos.remove(at: idx) } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 18))
                                .symbolRenderingMode(.palette)
                                .foregroundStyle(.white, .black.opacity(0.6))
                        }
                        .buttonStyle(.plain)
                        .padding(4)
                    }
                }
                if fotos.count < PecaRepository.maxFotos {
                    Button { escolherFonteAberto = true } label: {
                        ZStack {
                            RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised)
                            RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1)
                            Image(systemName: "plus")
                                .font(.system(size: 22, weight: .semibold))
                                .foregroundStyle(Color.accent)
                        }
                        .frame(width: 72, height: 72)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Adicionar foto")
                }
                Spacer(minLength: 0)
            }
            Text("Até 5 fotos — tire na hora ou escolha da galeria.")
                .font(.system(size: 12)).foregroundStyle(Color.textFaint)
        }
        .confirmationDialog("Adicionar foto", isPresented: $escolherFonteAberto, titleVisibility: .visible) {
            if CameraPicker.disponivel {
                Button("Tirar foto") { cameraAberta = true }
            }
            Button("Escolher da galeria") { galeriaAberta = true }
            Button("Cancelar", role: .cancel) {}
        }
    }

    private func tipoBotao(_ t: PecaTipo, label: String) -> some View {
        let isAtivo = tipo == t
        return Button {
            tipo = t
        } label: {
            Text(label)
                .font(.system(size: 13, weight: isAtivo ? .semibold : .regular))
                .foregroundStyle(isAtivo ? Color.onAccent : Color.text)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: Radius.md).fill(isAtivo ? Color.accent : Color.surfaceRaised))
                .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: isAtivo ? 0 : 1))
        }
        .buttonStyle(.plain)
    }

    /// Linha de "resumo do que veio do filtro" — escolha não-editável
    /// até o usuário tocar pra trocar.
    private func resumoEscolha(valor: String, nota: String, aoTrocar: @escaping () -> Void) -> some View {
        Button(action: aoTrocar) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(valor)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.text)
                    Text(nota)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.textFaint)
                }
                Spacer()
                Text("trocar")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, 14).padding(.vertical, 13)
            .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
            .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func pickerLabel(text: String) -> some View {
        HStack {
            Text(text).foregroundStyle(Color.text)
            Spacer()
            Image(systemName: "chevron.up.chevron.down").foregroundStyle(Color.textFaint).font(.system(size: 12))
        }
        .padding(.horizontal, 14).padding(.vertical, 13)
        .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
    }

    private var carroNomeSel: String? {
        guard let id = carroId else { return nil }
        return carroRepo.carros.first { $0.id == id }?.apelido
    }

    // MARK: - Etiqueta (OCR) e preço Mercado Livre

    private var botaoLerEtiqueta: some View {
        Button { escolherFonteEtiquetaAberto = true } label: {
            HStack(spacing: 10) {
                Image(systemName: "doc.text.viewfinder")
                    .font(.system(size: 20, weight: .semibold))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Ler etiqueta da peça")
                        .font(.system(size: 15, weight: .bold))
                    Text("Foto da etiqueta → preencho nome e especificação")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.onAccent.opacity(0.85))
                }
                Spacer(minLength: 0)
            }
            .foregroundStyle(Color.onAccent)
            .padding(.horizontal, 14).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.accent))
        }
        .buttonStyle(.plain)
    }

    /// Termo pra busca no Mercado Livre: usa o código se houver, senão o nome.
    private var termoBuscaML: String {
        let c = codigo.trimmingCharacters(in: .whitespacesAndNewlines)
        if !c.isEmpty { return c }
        return nome.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Lê o texto da etiqueta (OCR local) e preenche os campos ainda vazios.
    private func processarEtiqueta(_ img: UIImage) {
        if fotos.count < PecaRepository.maxFotos { fotos.append(img) }
        lendoEtiqueta = true
        Task {
            let linhas = await EtiquetaOCR.lerLinhas(de: img)
            let r = EtiquetaOCR.interpretar(linhas: linhas)
            await MainActor.run {
                if nome.trimmingCharacters(in: .whitespaces).isEmpty, let n = r.nome { nome = n }
                if codigo.trimmingCharacters(in: .whitespaces).isEmpty, let c = r.codigo { codigo = c }
                if let e = r.especificacao {
                    especificacao = especificacao.isEmpty ? e : especificacao + "\n" + e
                }
                lendoEtiqueta = false
            }
        }
    }

    private func salvar() {
        guard let cid = carroId else { return }
        isSaving = true; savingError = nil
        let precoCents = MoedaBR.parseParaCentavos(precoTexto)
        Task {
            do {
                if let original = pecaParaEditar {
                    // Edição: re-salva as fotos e atualiza os campos,
                    // preservando id / created_at / quantidade da peça.
                    let fotoPath = PecaRepository.salvarFotos(pecaId: original.id, imagens: fotos)
                    var atualizada = original
                    atualizada.carroId = cid
                    atualizada.nome = nome.trimmingCharacters(in: .whitespacesAndNewlines)
                    atualizada.codigo = limpo(codigo)
                    atualizada.area = area.rawValue
                    atualizada.tipo = tipo.rawValue
                    atualizada.especificacao = limpo(especificacao)
                    atualizada.fotoUrl = fotoPath
                    atualizada.precoUnitarioCents = precoCents
                    atualizada.localId = localId
                    atualizada.observacoes = limpo(observacoes)
                    try await repo.atualizarPeca(atualizada)
                } else {
                    _ = try await repo.criarPeca(
                        carroId: cid,
                        nome: nome,
                        codigo: codigo.isEmpty ? nil : codigo,
                        area: area, tipo: tipo,
                        especificacao: especificacao.isEmpty ? nil : especificacao,
                        quantidade: quantidade,
                        precoUnitarioCents: precoCents,
                        localId: localId,
                        observacoes: observacoes.isEmpty ? nil : observacoes,
                        fotos: fotos
                    )
                }
                await MainActor.run { isSaving = false; onClose() }
            } catch {
                await MainActor.run {
                    isSaving = false
                    savingError = "Não consegui salvar: \(error.localizedDescription)"
                }
            }
        }
    }
}

// ─────────────── TextEditorField ───────────────
private struct TextEditorField: View {
    @Binding var text: String
    let placeholder: String
    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text(placeholder)
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, 14).padding(.vertical, 13)
            }
            TextEditor(text: $text)
                .scrollContentBackground(.hidden)
                .foregroundStyle(Color.text)
                .font(.system(size: 15))
                .padding(.horizontal, 10).padding(.vertical, 6)
                .frame(minHeight: 60)
        }
        .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - PecaDetalheView
// ═══════════════════════════════════════════════════════════
struct PecaDetalheView: View {
    @EnvironmentObject private var repo: PecaRepository
    @EnvironmentObject private var carroRepo: CarroRepository

    let peca: Peca
    let onClose: () -> Void

    @State private var pecaAtual: Peca
    @State private var historico: [PecaMovimentacao] = []
    @State private var observacaoMov: String = ""
    @State private var editando = false
    @State private var ultimoErro: String?

    init(peca: Peca, onClose: @escaping () -> Void) {
        self.peca = peca
        self.onClose = onClose
        _pecaAtual = State(initialValue: peca)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                cabecalho
                faixaFotos
                botoesMov
                campoObservacao
                Divider().background(Color.border)
                infoPeca
                Divider().background(Color.border)
                historicoSecao
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 60)
        }
        .background(Color.surface)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Fechar", action: onClose).foregroundStyle(Color.text)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Editar") { editando = true }.foregroundStyle(Color.accent)
            }
        }
        .preferredColorScheme(.dark)
        .task { await carregarHistorico() }
        .sheet(isPresented: $editando) {
            PecaNovoFormView(
                pecaParaEditar: pecaAtual,
                onApagada: { editando = false; onClose() },
                onClose: {
                    editando = false
                    if let atualizada = repo.pecas.first(where: { $0.id == pecaAtual.id }) {
                        pecaAtual = atualizada
                    }
                }
            )
        }
    }

    /// Galeria horizontal das fotos da peça (aparece quando há 2+).
    @ViewBuilder
    private var faixaFotos: some View {
        let fotosPeca = PecaRepository.carregarFotos(pecaId: pecaAtual.id)
        if fotosPeca.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(Array(fotosPeca.enumerated()), id: \.offset) { _, img in
                        Image(uiImage: img).resizable().scaledToFill()
                            .frame(width: 96, height: 96)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                            .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
                    }
                }
                .padding(.horizontal, 2)
            }
        }
    }

    private var cabecalho: some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                if let img = PecaRepository.carregarFoto(pecaId: pecaAtual.id) {
                    Image(uiImage: img).resizable().scaledToFill()
                } else {
                    Image(systemName: "wrench.and.screwdriver")
                        .foregroundStyle(Color.textFaint)
                        .font(.system(size: 32))
                }
            }
            .frame(width: 96, height: 96)
            .background(Color.surfaceRaised)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))

            VStack(alignment: .leading, spacing: 4) {
                Text(pecaAtual.nome)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Color.text)
                Text(pecaAtual.area)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
                if pecaAtual.tipo == PecaTipo.ferramenta.rawValue {
                    Text("Ferramenta de manutenção")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.accent)
                }
                Text(carroNome)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textFaint)
            }
            Spacer()
        }
    }

    private var botoesMov: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Estoque")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                Spacer()
                Text("\(pecaAtual.quantidade)")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Color.text)
            }
            HStack(spacing: 10) {
                Button { mov(-1) } label: {
                    HStack { Image(systemName: "minus"); Text("Usei 1") }
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.erro))
                }
                .buttonStyle(.plain)
                .disabled(pecaAtual.quantidade == 0)
                .opacity(pecaAtual.quantidade == 0 ? 0.4 : 1)

                Button { mov(+1) } label: {
                    HStack { Image(systemName: "plus"); Text("Recebi 1") }
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.bom))
                }
                .buttonStyle(.plain)
            }
            if let err = ultimoErro {
                Text(err).font(.system(size: 12)).foregroundStyle(Color.erro)
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
    }

    private var campoObservacao: some View {
        FormField(label: "Observação da próxima movimentação", small: "opcional") {
            FormInput(text: $observacaoMov, placeholder: "Ex: instalei no stint 3")
        }
    }

    private var infoPeca: some View {
        VStack(alignment: .leading, spacing: 8) {
            linha(rotulo: "Código", valor: pecaAtual.codigo)
            linha(rotulo: "Especificação", valor: pecaAtual.especificacao)
            if let p = pecaAtual.precoUnitarioCents {
                linha(rotulo: "Preço unitário", valor: MoedaBR.formatar(centavos: p))
                if pecaAtual.quantidade > 0 {
                    linha(rotulo: "Valor em estoque", valor: MoedaBR.formatar(centavos: p * pecaAtual.quantidade))
                }
            }
            linha(rotulo: "Local", valor: repo.localNome(id: pecaAtual.localId))
            linha(rotulo: "Observações", valor: pecaAtual.observacoes)
        }
    }

    @ViewBuilder
    private func linha(rotulo: String, valor: String?) -> some View {
        if let v = valor, !v.isEmpty {
            HStack(alignment: .top) {
                Text(rotulo)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .frame(width: 110, alignment: .leading)
                Text(v)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.text)
                Spacer()
            }
        }
    }

    private var historicoSecao: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Histórico")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.text)
            if historico.isEmpty {
                Text("Sem movimentações ainda.")
                    .font(.system(size: 12)).foregroundStyle(Color.textFaint)
            } else {
                ForEach(historico, id: \.id) { m in
                    HStack {
                        Text(m.delta > 0 ? "+\(m.delta)" : "\(m.delta)")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(m.delta > 0 ? Color.bom : Color.erro)
                            .frame(width: 40, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(Self.formatarData(m.ocorridoEm))
                                .font(.system(size: 12)).foregroundStyle(Color.text)
                            if let obs = m.observacao, !obs.isEmpty {
                                Text(obs).font(.system(size: 11)).foregroundStyle(Color.textMuted)
                            }
                        }
                        Spacer()
                    }
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Color.surfaceRaised))
                }
            }
        }
    }

    private var carroNome: String {
        carroRepo.carros.first { $0.id == pecaAtual.carroId }?.apelido ?? "—"
    }

    private func mov(_ delta: Int) {
        ultimoErro = nil
        Task {
            do {
                try await repo.registrarMovimentacao(peca: pecaAtual, delta: delta, observacao: observacaoMov.isEmpty ? nil : observacaoMov)
                if let atualizada = repo.pecas.first(where: { $0.id == pecaAtual.id }) {
                    pecaAtual = atualizada
                }
                observacaoMov = ""
                await carregarHistorico()
            } catch {
                ultimoErro = "Falhou: \(error.localizedDescription)"
            }
        }
    }

    private func carregarHistorico() async {
        do {
            historico = try await repo.historico(pecaId: pecaAtual.id)
        } catch {
            historico = []
        }
    }

    static func formatarData(_ ms: Int64) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000.0)
        let f = DateFormatter()
        f.dateFormat = "dd/MM/yyyy HH:mm"
        return f.string(from: date)
    }
}

// ═══════════════════════════════════════════════════════════
// MARK: - PecaLocalListaView
// ═══════════════════════════════════════════════════════════
struct PecaLocalListaView: View {
    @EnvironmentObject private var repo: PecaRepository
    let onClose: () -> Void

    @State private var novoNome: String = ""
    @State private var novaDescricao: String = ""
    @State private var ultimoErro: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Eyebrow(text: "Garagem · Estoque")
                Text("Locais de estoque")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text("Cadastre os lugares onde você guarda as peças (box, caminhão, oficina em casa...). Você pode editar ou apagar a qualquer momento.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
                    .padding(.bottom, Spacing.sm)

                ForEach(repo.locais, id: \.id) { l in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(l.nome)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Color.text)
                            if let d = l.descricao, !d.isEmpty {
                                Text(d).font(.system(size: 12)).foregroundStyle(Color.textMuted)
                            }
                        }
                        Spacer()
                        Button(role: .destructive) {
                            Task { try? await repo.apagarLocal(l) }
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(Color.erro)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
                    .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
                }

                Divider().background(Color.border).padding(.vertical, Spacing.sm)

                Text("Adicionar novo local")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.text)
                FormField(label: "Nome") {
                    FormInput(text: $novoNome, placeholder: "Ex: Casa do mecânico")
                }
                FormField(label: "Descrição", small: "opcional") {
                    FormInput(text: $novaDescricao, placeholder: "Ex: rua X, fica no fundo da garagem")
                }
                if let err = ultimoErro {
                    Text(err).font(.system(size: 12)).foregroundStyle(Color.erro)
                }
                Button {
                    guard !novoNome.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                    Task {
                        do {
                            _ = try await repo.criarLocal(nome: novoNome, descricao: novaDescricao.isEmpty ? nil : novaDescricao)
                            novoNome = ""; novaDescricao = ""
                        } catch {
                            ultimoErro = "Falhou: \(error.localizedDescription)"
                        }
                    }
                } label: {
                    Text("Adicionar local")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.accent))
                }
                .buttonStyle(.plain)
                .disabled(novoNome.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.md)
            .padding(.bottom, 40)
        }
        .background(Color.surface)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Fechar", action: onClose).foregroundStyle(Color.text)
            }
        }
        .preferredColorScheme(.dark)
    }
}

// Identifiable pra usar Peca em .sheet(item:)
extension Peca: Identifiable {}

// ═══════════════════════════════════════════════════════════
// MARK: - MoedaBR (formatação e parsing de R$)
// ═══════════════════════════════════════════════════════════
// Pra não trazer dependência nova. Trata "89,90" / "89.90" / "1.234,56"
// e devolve centavos (Int). Formatação devolve "R$ 89,90".
enum MoedaBR {
    static func parseParaCentavos(_ texto: String) -> Int? {
        let trim = texto.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trim.isEmpty else { return nil }
        // Remove tudo que não é dígito, vírgula ou ponto.
        let limpo = trim.filter { $0.isNumber || $0 == "," || $0 == "." }
        guard !limpo.isEmpty else { return nil }
        // Substitui pontos de milhar e adota vírgula como decimal.
        let semMilhar = limpo.replacingOccurrences(of: ".", with: "")
        let comDot = semMilhar.replacingOccurrences(of: ",", with: ".")
        guard let valor = Double(comDot) else { return nil }
        return Int((valor * 100).rounded())
    }

    static func formatar(centavos: Int) -> String {
        let valor = Double(centavos) / 100.0
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "pt_BR")
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f.string(from: NSNumber(value: valor)) ?? "R$ 0,00"
    }
}
