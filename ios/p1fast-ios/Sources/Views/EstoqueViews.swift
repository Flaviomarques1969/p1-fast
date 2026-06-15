// ═══════════════════════════════════════════════════════════
// EstoqueViews — Estoque geral + Editor unificado de item (2026-06-14)
// ═══════════════════════════════════════════════════════════
// Desenho aprovado por Flávio (mockup-pendencias-estoque-APROVADO).
//   • EstoqueGeralView — lista do estoque geral (sub-aba da Garagem):
//     itens e ferramentas que não são de um carro específico. "+ Cadastrar".
//   • EstoqueItemEditorView — editor ÚNICO em botões + câmera que lê o
//     rótulo (reaproveita EtiquetaOCR/CameraPicker). Usado tanto aqui quanto
//     nas Pendências (Gerenciar → Adicionar).
//
// Tudo LOCAL (EstoqueRepository) — não toca a nuvem/produção.

import SwiftUI
import PhotosUI
import UIKit
import P1FastCore

// MARK: - Semente do editor (sheet)

/// O que abrir no editor: item existente (edição) ou novo, num escopo inicial.
/// Para "Adicionar/Editar" vindo das Pendências, pode pré-preencher nome+bloco.
struct EstoqueEditorSeed: Identifiable {
    let id: String
    let item: EstoqueItem?
    let escopoInicial: String
    var nomeInicial: String?
    var blocoIdInicial: String?

    static func novo(escopo: String = EstoqueRepository.escopoGeral,
                     nome: String? = nil, blocoId: String? = nil) -> EstoqueEditorSeed {
        EstoqueEditorSeed(id: "novo-\(nome ?? "")-\(blocoId ?? "")", item: nil,
                          escopoInicial: escopo, nomeInicial: nome, blocoIdInicial: blocoId)
    }
    static func editar(_ item: EstoqueItem) -> EstoqueEditorSeed {
        EstoqueEditorSeed(id: item.id, item: item, escopoInicial: item.escopo,
                          nomeInicial: nil, blocoIdInicial: nil)
    }
}

// MARK: - EstoqueGeralView (sub-aba da Garagem)

struct EstoqueGeralView: View {
    @EnvironmentObject private var repo: EstoqueRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @State private var editor: EstoqueEditorSeed?
    /// Escopo em foco: "geral" ou um carroId. Estoque UNIFICADO — um só lugar.
    @State private var escopoSel: String = EstoqueRepository.escopoGeral

    private var itens: [EstoqueItem] {
        repo.itens(escopo: escopoSel)
            .sorted {
                if $0.grupoNum != $1.grupoNum { return $0.grupoNum < $1.grupoNum }
                return $0.nome.localizedCaseInsensitiveCompare($1.nome) == .orderedAscending
            }
    }

    /// Botões de escopo: Geral + 1 por carro (dinâmico).
    private var escopos: [(id: String, label: String)] {
        [(EstoqueRepository.escopoGeral, "Geral")] + carroRepo.carros.map { ($0.id, $0.apelido) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                escopoPicker
                groupHead
                if itens.isEmpty {
                    Text(escopoSel == EstoqueRepository.escopoGeral
                         ? "Nenhum item no estoque geral. Cadastre itens e ferramentas que não são de um carro específico — você reaproveita em todo evento."
                         : "Nenhum item neste carro ainda. Cadastre peças e ferramentas deste carro.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textFaint)
                        .padding(.horizontal, Spacing.xs)
                        .padding(.vertical, Spacing.sm)
                } else {
                    ForEach(itens) { item in
                        Button { editor = .editar(item) } label: {
                            EstoqueRow(item: item)
                        }
                        .buttonStyle(.plain)
                    }
                }
                addRow
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.sm)
            .padding(.bottom, 120)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .sheet(item: $editor) { seed in
            EstoqueItemEditorView(
                item: seed.item,
                escopoInicial: seed.escopoInicial,
                onClose: { editor = nil },
                onSaved: { _ in editor = nil }
            )
        }
    }

    private var escopoPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(escopos, id: \.id) { esc in
                    let ativo = escopoSel == esc.id
                    Button { escopoSel = esc.id } label: {
                        Text(esc.label)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(ativo ? Color.onAccent : Color.textMuted)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(Capsule().fill(ativo ? Color.accent : Color.clear))
                            .overlay(Capsule().stroke(ativo ? Color.clear : Color.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Spacing.xs)
        }
    }

    private var groupHead: some View {
        HStack {
            Text(escopoSel == EstoqueRepository.escopoGeral
                 ? "ITENS E FERRAMENTAS GERAIS"
                 : "ESTOQUE DESTE CARRO")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11)
                .foregroundStyle(Color.textFaint)
            Spacer()
            Text("\(itens.count)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.accent)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.top, Spacing.xs)
    }

    private var addRow: some View {
        Button { editor = .novo() } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus").font(.system(size: 16, weight: .semibold))
                Text("Cadastrar item").font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(Color.textMuted)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                    .foregroundStyle(Color.border)
            )
        }
        .buttonStyle(.plain)
        .padding(.top, 2)
    }
}

/// Linha de item do estoque geral — nome + (Item/Ferramenta · quantidade · especificação).
private struct EstoqueRow: View {
    let item: EstoqueItem

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.nome)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text(subLinha)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
            Spacer(minLength: 0)
            Text("›")
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
                .frame(width: 24, height: 24)
                .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.surfaceHover))
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
        .contentShape(Rectangle())
    }

    private var subLinha: String {
        let kind = item.kind == "ferramenta" ? "Ferramenta" : "Item"
        var partes = ["\(kind) · \(EstoqueFmt.quantidade(item))"]
        if let e = item.especificacao, !e.isEmpty { partes.append(e) }
        return partes.joined(separator: " · ")
    }
}

// MARK: - Formatação compartilhada (badge/quantidade)

enum EstoqueFmt {
    /// Texto curto da quantidade conforme "como conta": ex "×4", "4 × 1 L", "8 peças".
    static func quantidade(_ item: EstoqueItem) -> String {
        switch item.contagem {
        case "embalagem":
            let emb = item.embalagens ?? 1
            return "\(emb) × \(num(item.volume ?? 1))\(item.unidade ?? "")"
        case "conjunto":
            return "\(item.alvo) peças"
        default:
            return "\(max(1, item.quantidade))"
        }
    }
    static func num(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }
}

// MARK: - EstoqueItemEditorView (editor único — botões + câmera/OCR)

struct EstoqueItemEditorView: View {
    @EnvironmentObject private var repo: EstoqueRepository
    @EnvironmentObject private var carroRepo: CarroRepository

    let item: EstoqueItem?
    let escopoInicial: String
    var nomeInicial: String? = nil
    var blocoIdInicial: String? = nil
    let onClose: () -> Void
    let onSaved: (EstoqueItem) -> Void

    @State private var nome: String = ""
    @State private var escopo: String = EstoqueRepository.escopoGeral
    @State private var kind: String = "item"
    @State private var blocoId: String = "G1"
    @State private var categoria: String = "obrig"
    @State private var espec: String = ""
    @State private var contagem: String = "simples"
    @State private var quantidade: Int = 1
    @State private var volumeTexto: String = "1"
    @State private var unidade: String = "L"
    @State private var embalagens: Int = 1
    @State private var partes: [EstoqueItem.Parte] = [.init(nome: "Aro 15", qtd: 4), .init(nome: "Aro 14", qtd: 4)]

    // Câmera / OCR (reaproveita EtiquetaOCR + CameraPicker, igual à tela de peça).
    @State private var fotoCapturada: UIImage?
    @State private var cameraAberta = false
    @State private var galeriaAberta = false
    @State private var fotoItem: PhotosPickerItem?
    @State private var escolherFonteAberta = false
    @State private var lendoEtiqueta = false

    private let unidades = ["L", "ml", "un", "kg", "par"]

    private var editando: Bool { item != nil }

    private var escoposDisponiveis: [(id: String, label: String)] {
        [(EstoqueRepository.escopoGeral, "Estoque geral")]
            + carroRepo.carros.map { ($0.id, $0.apelido) }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    Eyebrow(text: editando ? "Editar item" : "Cadastrar item")
                    botaoCamera
                    FormField(label: "Nome") {
                        FormInput(text: $nome, placeholder: "Ex: Macaco, Jacks, Óleo motor…")
                    }
                    FormField(label: "Onde fica (estoque)") {
                        SegPicker(opcoes: escoposDisponiveis.map { ($0.id, $0.label) }, selecao: $escopo)
                    }
                    FormField(label: "É") {
                        SegPicker(opcoes: [("item", "Item"), ("ferramenta", "Ferramenta")], selecao: $kind)
                    }
                    FormField(label: "Bloco") {
                        blocoPicker
                    }
                    FormField(label: "Categoria") {
                        SegPicker(opcoes: [("obrig", "Obrigatório"), ("desej", "Desejável")], selecao: $categoria)
                    }
                    FormField(label: "Especificação", small: "qual / tipo — opcional") {
                        FormInput(text: $espec, placeholder: "Ex: Mobil 5W30 sintético")
                    }
                    FormField(label: "Como conta a quantidade") {
                        SegPicker(opcoes: [("simples", "Simples"), ("embalagem", "Embalagens"), ("conjunto", "Conjunto")], selecao: $contagem)
                    }
                    camposQuantidade
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 120)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: onClose,
                onSave: salvar,
                saveLabel: editando ? "Salvar" : "Cadastrar",
                canSave: !nome.trimmingCharacters(in: .whitespaces).isEmpty
            )
        }
        .preferredColorScheme(.dark)
        .onAppear(perform: carregar)
        .confirmationDialog("Ler o rótulo do item", isPresented: $escolherFonteAberta, titleVisibility: .visible) {
            if CameraPicker.disponivel {
                Button("Tirar foto do rótulo") { cameraAberta = true }
            }
            Button("Escolher da galeria") { galeriaAberta = true }
            Button("Cancelar", role: .cancel) {}
        }
        .fullScreenCover(isPresented: $cameraAberta) {
            CameraPicker(
                onImage: { img in cameraAberta = false; processarRotulo(img) },
                onCancel: { cameraAberta = false }
            )
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $galeriaAberta, selection: $fotoItem, matching: .images)
        .onChange(of: fotoItem) { _, novo in
            guard let novo else { return }
            Task {
                if let data = try? await novo.loadTransferable(type: Data.self),
                   let img = UIImage(data: data) {
                    await MainActor.run { processarRotulo(img); fotoItem = nil }
                }
            }
        }
        .overlay {
            if lendoEtiqueta {
                ZStack {
                    Color.black.opacity(0.55).ignoresSafeArea()
                    VStack(spacing: 12) {
                        ProgressView().tint(.white)
                        Text("Lendo o rótulo…").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    }
                }
            }
        }
    }

    // MARK: - Botão câmera

    private var botaoCamera: some View {
        Button { escolherFonteAberta = true } label: {
            HStack(spacing: 8) {
                Image(systemName: "doc.text.viewfinder").font(.system(size: 18, weight: .semibold))
                Text("Tirar foto e ler o item").font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(Color.accent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.accent.opacity(0.10)))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.accent, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Bloco (picker)

    private var blocoPicker: some View {
        Menu {
            ForEach(EstoqueRepository.blocos) { b in
                Button(b.titulo) { blocoId = b.id }
            }
        } label: {
            HStack {
                Text(EstoqueRepository.bloco(id: blocoId).titulo).foregroundStyle(Color.text)
                Spacer()
                Image(systemName: "chevron.up.chevron.down").foregroundStyle(Color.textFaint).font(.system(size: 12))
            }
            .padding(.horizontal, 14).padding(.vertical, 13)
            .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
        }
    }

    // MARK: - Campos de quantidade (variam por "como conta")

    @ViewBuilder
    private var camposQuantidade: some View {
        switch contagem {
        case "embalagem":
            FormField(label: "Volume por embalagem") {
                HStack(spacing: 8) {
                    FormInput(text: $volumeTexto, placeholder: "1", keyboardType: .decimalPad)
                    Menu {
                        ForEach(unidades, id: \.self) { u in Button(u) { unidade = u } }
                    } label: {
                        HStack(spacing: 6) {
                            Text(unidade).foregroundStyle(Color.text)
                            Image(systemName: "chevron.down").font(.system(size: 11)).foregroundStyle(Color.textFaint)
                        }
                        .padding(.horizontal, 14).padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
                        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
                    }
                }
            }
            FormField(label: "Quantas embalagens") {
                Stepper2(valor: $embalagens, minimo: 1)
            }
        case "conjunto":
            FormField(label: "Peças do conjunto (nome + quantidade)") {
                VStack(spacing: 8) {
                    ForEach(partes.indices, id: \.self) { i in
                        HStack(spacing: 8) {
                            FormInput(text: Binding(
                                get: { partes[i].nome },
                                set: { partes[i] = .init(nome: $0, qtd: partes[i].qtd) }
                            ), placeholder: "Ex: Aro 15")
                            TextField("", value: Binding(
                                get: { partes[i].qtd },
                                set: { partes[i] = .init(nome: partes[i].nome, qtd: max(1, $0)) }
                            ), format: .number)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.center)
                                .frame(width: 56)
                                .padding(.vertical, 11)
                                .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
                                .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
                            Button { partes.remove(at: i) } label: {
                                Image(systemName: "trash").font(.system(size: 14)).foregroundStyle(Color.textMuted)
                                    .frame(width: 34, height: 34)
                            }
                            .buttonStyle(.plain)
                            .disabled(partes.count <= 1)
                        }
                    }
                    Button { partes.append(.init(nome: "", qtd: 1)) } label: {
                        Text("+ Adicionar peça").font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.textMuted)
                            .frame(maxWidth: .infinity).padding(.vertical, 10)
                            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .stroke(style: StrokeStyle(lineWidth: 1, dash: [5, 4])).foregroundStyle(Color.border))
                    }
                    .buttonStyle(.plain)
                }
            }
        default:
            FormField(label: "Quantidade") {
                Stepper2(valor: $quantidade, minimo: 1)
            }
        }
    }

    // MARK: - Carregar / salvar

    private func carregar() {
        escopo = escopoInicial
        guard let it = item else {
            // Novo item: pode vir pré-preenchido (Pendências → Adicionar/Editar).
            if let n = nomeInicial { nome = n }
            if let b = blocoIdInicial { blocoId = b }
            return
        }
        nome = it.nome
        escopo = it.escopo
        kind = it.kind
        blocoId = it.grupoId
        categoria = it.categoria
        espec = it.especificacao ?? ""
        contagem = it.contagem
        quantidade = max(1, it.quantidade)
        volumeTexto = EstoqueFmt.num(it.volume ?? 1)
        unidade = it.unidade ?? "L"
        embalagens = it.embalagens ?? 1
        let p = EstoqueItem.decodePartes(it.partesJson)
        if !p.isEmpty { partes = p }
    }

    private func processarRotulo(_ img: UIImage) {
        fotoCapturada = img
        lendoEtiqueta = true
        Task {
            let linhas = await EtiquetaOCR.lerLinhas(de: img)
            let r = EtiquetaOCR.interpretar(linhas: linhas)
            await MainActor.run {
                if nome.trimmingCharacters(in: .whitespaces).isEmpty, let n = r.nome { nome = n }
                if let e = r.especificacao {
                    espec = espec.isEmpty ? e : espec + "\n" + e
                }
                lendoEtiqueta = false
            }
        }
    }

    private func salvar() {
        let nomeLimpo = nome.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !nomeLimpo.isEmpty else { return }
        let bloco = EstoqueRepository.bloco(id: blocoId)
        let vol = Double(volumeTexto.replacingOccurrences(of: ",", with: ".")) ?? 1
        let especLimpa = espec.trimmingCharacters(in: .whitespacesAndNewlines)
        let partesLimpas = partes
            .map { EstoqueItem.Parte(nome: $0.nome.trimmingCharacters(in: .whitespaces).isEmpty ? "Peça" : $0.nome, qtd: max(1, $0.qtd)) }
        Task {
            do {
                if var existente = item {
                    existente.nome = nomeLimpo
                    existente.escopo = escopo
                    existente.kind = kind
                    existente.grupoId = bloco.id
                    existente.grupoTitulo = bloco.titulo
                    existente.grupoNum = bloco.num
                    existente.categoria = categoria
                    existente.especificacao = especLimpa.isEmpty ? nil : especLimpa
                    existente.contagem = contagem
                    existente.quantidade = max(1, quantidade)
                    existente.volume = contagem == "embalagem" ? vol : nil
                    existente.unidade = contagem == "embalagem" ? unidade : nil
                    existente.embalagens = contagem == "embalagem" ? max(1, embalagens) : nil
                    existente.partesJson = contagem == "conjunto" ? EstoqueItem.encodePartes(partesLimpas) : nil
                    try await repo.atualizar(existente, foto: fotoCapturada)
                    onSaved(existente)
                } else {
                    let novo = try await repo.criar(
                        escopo: escopo, kind: kind, bloco: bloco, nome: nomeLimpo,
                        especificacao: especLimpa.isEmpty ? nil : especLimpa,
                        categoria: categoria, contagem: contagem,
                        quantidade: max(1, quantidade),
                        volume: contagem == "embalagem" ? vol : nil,
                        unidade: contagem == "embalagem" ? unidade : nil,
                        embalagens: contagem == "embalagem" ? max(1, embalagens) : nil,
                        partes: contagem == "conjunto" ? partesLimpas : [],
                        foto: fotoCapturada
                    )
                    onSaved(novo)
                }
            } catch {
                print("EstoqueItemEditorView.salvar failed: \(error)")
            }
        }
    }
}

// MARK: - Controles reutilizáveis

/// Botões em segmento (estilo "seg" do mockup) — 2 a 4 opções na horizontal.
struct SegPicker: View {
    let opcoes: [(String, String)]   // (valor, rótulo)
    @Binding var selecao: String

    var body: some View {
        HStack(spacing: 6) {
            ForEach(opcoes, id: \.0) { valor, rotulo in
                let ativo = selecao == valor
                Button { selecao = valor } label: {
                    Text(rotulo)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(ativo ? Color.onAccent : Color.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(ativo ? Color.accent : Color.clear))
                        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(ativo ? Color.clear : Color.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Stepper − N + com piso configurável.
struct Stepper2: View {
    @Binding var valor: Int
    var minimo: Int = 0

    var body: some View {
        HStack(spacing: 0) {
            botao("–") { valor = max(minimo, valor - 1) }
            Text("\(valor)")
                .font(.system(size: 17, weight: .semibold))
                .monospacedDigit()
                .frame(minWidth: 58)
            botao("+") { valor += 1 }
        }
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
        .fixedSize()
    }

    private func botao(_ s: String, _ acao: @escaping () -> Void) -> some View {
        Button(action: acao) {
            Text(s).font(.system(size: 22, weight: .regular)).foregroundStyle(Color.text)
                .frame(width: 46, height: 44)
        }
        .buttonStyle(.plain)
    }
}
