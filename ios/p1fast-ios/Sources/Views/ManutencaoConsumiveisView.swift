// ═══════════════════════════════════════════════════════════
// ManutencaoConsumiveisView — telas da função Manutenção (modelo
// CHECAGEM ≠ TROCA) — reforma 2026-05-31.
// ═══════════════════════════════════════════════════════════
// Reescritas no estilo aprovado das telas de 18/05, mas ligadas ao
// motor novo do núcleo (CatalogoConsumiveisCelta + ManutencaoHistorico
// + ManutencaoRegistro). Abre do painel do carro (CarroModalView).
//
//   • ManutencaoConsumiveisStore     — ponte fina app↔core (GRDB).
//   • ManutencaoConsumiveisView      — pendências no topo + 30 itens
//     por bloco, cada um com checagem, modo de troca e status.
//   • RegistrarTrocaView             — registra uma troca.

import SwiftUI
import GRDB
import P1FastCore

// ─────────────────────────────────────────────────────────────
// MARK: - Store (ponte app↔core)
// ─────────────────────────────────────────────────────────────

@MainActor
final class ManutencaoConsumiveisStore: ObservableObject {
    @Published private(set) var statusPorItem: [String: StatusManutencao] = [:]

    private let queue: DatabaseQueue
    init(queue: DatabaseQueue) { self.queue = queue }

    enum StoreErro: Error, LocalizedError {
        case semTime
        var errorDescription: String? {
            switch self {
            case .semTime: return "O app está sem time ativo — feche e abra o app antes de tentar de novo."
            }
        }
    }

    /// Recalcula o status dos 30 itens pra um carro (uma transação só).
    func carregarStatus(carroId: String) async {
        guard let team = TeamContext.currentTeamId else { statusPorItem = [:]; return }
        let agora = DB.nowMs()
        do {
            let novo = try await queue.read { db -> [String: StatusManutencao] in
                var m: [String: StatusManutencao] = [:]
                for item in CatalogoConsumiveisCelta.itens {
                    m[item.codigo] = try ManutencaoHistorico.status(
                        db, item: item, carroId: carroId, timeId: team, agoraMs: agora)
                }
                return m
            }
            statusPorItem = novo
        } catch {
            print("ManutencaoConsumiveisStore.carregarStatus falhou: \(error)")
        }
    }

    /// Registra uma troca e recalcula o status.
    func registrarTroca(carroId: String, itemCodigo: String, ocorridoEm: Int64,
                        validadeEtiqueta: Int64?, observacao: String?) async throws {
        guard let team = TeamContext.currentTeamId else { throw StoreErro.semTime }
        let reg = ManutencaoRegistro(
            id: UUID().uuidString.lowercased(), timeId: team, carroId: carroId,
            itemCodigo: itemCodigo, ocorridoEm: ocorridoEm,
            observacao: observacao?.trimmedNilSeVazio, validadeEtiqueta: validadeEtiqueta)
        try await queue.write { db in
            try reg.insert(db)
            try SyncQueue.enqueueRecord(db, tableName: "manutencoes", rowId: reg.id, op: .insert, record: reg)
        }
        await carregarStatus(carroId: carroId)
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Tela principal
// ─────────────────────────────────────────────────────────────

/// Alvo do formulário de troca: item pré-escolhido (toque no cartão)
/// ou nenhum (botão geral — o piloto escolhe o item no formulário).
private struct AlvoRegistro: Identifiable {
    let id = UUID()
    let item: ConsumivelDef?
}

struct ManutencaoConsumiveisView: View {
    @EnvironmentObject private var store: ManutencaoConsumiveisStore
    @EnvironmentObject private var carroRepo: CarroRepository

    let carroId: String
    let onClose: () -> Void

    @State private var registrar: AlvoRegistro?
    @State private var aviso: String?

    private var carro: Carro? { carroRepo.carros.first { $0.id == carroId } }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    cabecalho
                    pendencias
                    listaPorBloco
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 140)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FAB("Registrar troca") { registrar = AlvoRegistro(item: nil) }
                .padding(.trailing, Spacing.md)
                .padding(.bottom, 24)
        }
        .overlay(alignment: .top) {
            if let aviso {
                Text(aviso)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.text)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(Capsule().fill(Color.surfaceRaised))
                    .overlay(Capsule().stroke(Color.bom.opacity(0.7), lineWidth: 1))
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .allowsHitTesting(false)
            }
        }
        .navigationTitle("Manutenção")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .task { await store.carregarStatus(carroId: carroId) }
        .sheet(item: $registrar) { alvo in
            RegistrarTrocaView(
                carroId: carroId,
                itemInicial: alvo.item,
                onSaved: { def, dataMs in
                    registrar = nil
                    mostrarAviso("Troca registrada · \(def.nome) · \(fmtDataCurta(dataMs))")
                    Task { await store.carregarStatus(carroId: carroId) }
                },
                onClose: { registrar = nil })
            .environmentObject(store)
        }
    }

    /// Mostra a confirmação no topo e some sozinha depois de alguns segundos.
    private func mostrarAviso(_ texto: String) {
        withAnimation(.easeOut(duration: 0.25)) { aviso = texto }
        Task {
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            await MainActor.run {
                if aviso == texto {
                    withAnimation(.easeIn(duration: 0.3)) { aviso = nil }
                }
            }
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: "Manutenção")
            Text(carro?.apelido ?? "Carro")
                .font(.system(size: 24, weight: .semibold))
                .tracking(-0.6)
                .foregroundStyle(Color.text)
            Text("Consumíveis do carro de corrida · checagem e troca")
                .font(.system(size: 13))
                .foregroundStyle(Color.textMuted)
        }
    }

    // Itens vencidos/perto (vermelho/amarelo) — sobem pro topo.
    private var pendencias: some View {
        let lista = CatalogoConsumiveisCelta.itens.compactMap { item -> (ConsumivelDef, StatusManutencao)? in
            guard let s = store.statusPorItem[item.codigo],
                  s.severidade == .vermelho || s.severidade == .amarelo else { return nil }
            return (item, s)
        }.sorted { l, r in
            l.1.severidade == .vermelho && r.1.severidade != .vermelho
        }
        return Group {
            if !lista.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("ATENÇÃO")
                        .font(.system(size: 11, weight: .semibold)).tracking(1.4)
                        .foregroundStyle(Color.textFaint)
                    ForEach(lista, id: \.0.codigo) { item, status in
                        Button { registrar = AlvoRegistro(item: item) } label: { itemCard(item, status: status, compacto: true) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var listaPorBloco: some View {
        ForEach(CatalogoConsumiveisCelta.porBloco(), id: \.0) { bloco, itens in
            VStack(alignment: .leading, spacing: 8) {
                Text(bloco.uppercased())
                    .font(.system(size: 11, weight: .semibold)).tracking(1.2)
                    .foregroundStyle(Color.accent)
                    .padding(.top, 4)
                ForEach(itens, id: \.codigo) { item in
                    Button { registrar = AlvoRegistro(item: item) } label: {
                        itemCard(item, status: store.statusPorItem[item.codigo], compacto: false)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func itemCard(_ item: ConsumivelDef, status: StatusManutencao?, compacto: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle().fill(corStatus(status))
                .frame(width: 10, height: 10).padding(.top, 5)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.nome)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.text)
                    .fixedSize(horizontal: false, vertical: true)
                if !compacto {
                    Text(descricaoChecagem(item) + "  ·  " + descricaoTroca(item))
                        .font(.system(size: 11.5))
                        .foregroundStyle(Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let s = status {
                    if let trocaMs = s.ultimaTrocaMs {
                        Text(linhaUltimaTroca(s, trocaMs: trocaMs))
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundStyle(Color.accent)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    // Sem média ainda, o resumo do motor ("registre as trocas…")
                    // confundiria logo depois de salvar — a linha acima já informa.
                    if !(s.severidade == .semHistorico && s.ultimaTrocaMs != nil) {
                        Text(s.resumo)
                            .font(.system(size: 11.5))
                            .foregroundStyle(corStatus(s))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            Spacer(minLength: 0)
            Text(textoSeveridade(status))
                .font(.system(size: 10, weight: .bold)).tracking(0.4)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(corStatus(status).opacity(0.16)))
                .foregroundStyle(corStatus(status))
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Registrar troca
// ─────────────────────────────────────────────────────────────

struct RegistrarTrocaView: View {
    @EnvironmentObject private var store: ManutencaoConsumiveisStore

    let carroId: String
    let itemInicial: ConsumivelDef?
    /// Chamado SÓ quando gravou de verdade — leva o item e a data pro aviso.
    let onSaved: (ConsumivelDef, Int64) -> Void
    let onClose: () -> Void

    @State private var itemCodigo: String
    @State private var data: Date = Date()
    @State private var temValidade: Bool = false
    @State private var validade: Date = Date()
    @State private var observacao: String = ""
    @State private var salvando = false
    @State private var erroSalvar: String?

    init(carroId: String, itemInicial: ConsumivelDef?,
         onSaved: @escaping (ConsumivelDef, Int64) -> Void,
         onClose: @escaping () -> Void) {
        self.carroId = carroId
        self.itemInicial = itemInicial
        self.onSaved = onSaved
        self.onClose = onClose
        // Sem item pré-escolhido (botão geral), o formulário OBRIGA a escolha —
        // foi assim que uma troca de pneus virou "óleo do motor" em 11/06.
        _itemCodigo = State(initialValue: itemInicial?.codigo ?? "")
    }

    private var itemDef: ConsumivelDef? { CatalogoConsumiveisCelta.find(itemCodigo) }
    private var ehValidade: Bool {
        if case .limiteMaximo(_, .validade) = itemDef?.troca { return true }
        return false
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    secao("Item") {
                        Picker("Item", selection: $itemCodigo) {
                            if itemCodigo.isEmpty {
                                Text("Escolha o item").tag("")
                            }
                            ForEach(CatalogoConsumiveisCelta.itens, id: \.codigo) { it in
                                Text(it.nome).tag(it.codigo)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(Color.accent)
                        if itemCodigo.isEmpty {
                            Text("Escolha qual item foi trocado — o Salvar libera depois disso.")
                                .font(.system(size: 11)).foregroundStyle(Color.yellow)
                        }
                    }
                    secao("Quando foi a troca") {
                        DatePicker("Data", selection: $data, in: ...Date(), displayedComponents: .date)
                            .labelsHidden().datePickerStyle(.compact).colorScheme(.dark).tint(Color.accent)
                    }
                    if ehValidade {
                        secao("Validade da etiqueta (FIA/CBA)") {
                            DatePicker("Validade", selection: $validade, displayedComponents: .date)
                                .labelsHidden().datePickerStyle(.compact).colorScheme(.dark).tint(Color.accent)
                            Text("Pros itens de segurança, o alerta vem pela data da etiqueta.")
                                .font(.system(size: 11)).foregroundStyle(Color.textFaint)
                        }
                    }
                    secao("Observação (opcional)") {
                        TextField("Detalhes da troca", text: $observacao, axis: .vertical)
                            .lineLimit(2...5).font(.system(size: 14)).foregroundStyle(Color.text)
                            .padding(10)
                            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.surfaceRaised))
                    }
                }
                .padding(.horizontal, Spacing.lg).padding(.top, Spacing.md).padding(.bottom, 120)
            }
            .background(Color.surface)
            .navigationTitle("Registrar troca")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") { onClose() }.foregroundStyle(Color.text)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Salvar") { Task { await salvar() } }
                        .foregroundStyle((salvando || itemDef == nil) ? Color.textFaint : Color.accent)
                        .disabled(salvando || itemDef == nil)
                }
            }
            .preferredColorScheme(.dark)
            .alert("Não foi salvo", isPresented: Binding(
                get: { erroSalvar != nil },
                set: { if !$0 { erroSalvar = nil } })) {
                Button("Entendi", role: .cancel) {}
            } message: {
                Text(erroSalvar ?? "")
            }
        }
    }

    @MainActor
    private func salvar() async {
        guard let def = itemDef else { return }
        salvando = true; defer { salvando = false }
        let ocorridoMs = Int64(data.timeIntervalSince1970 * 1000)
        let validadeMs: Int64? = (ehValidade) ? Int64(validade.timeIntervalSince1970 * 1000) : nil
        do {
            try await store.registrarTroca(
                carroId: carroId, itemCodigo: def.codigo,
                ocorridoEm: ocorridoMs,
                validadeEtiqueta: validadeMs,
                observacao: observacao)
            onSaved(def, ocorridoMs)
        } catch {
            print("RegistrarTrocaView.salvar falhou: \(error)")
            erroSalvar = "A troca de \(def.nome) NÃO foi registrada. Tente de novo. Detalhe: \(error.localizedDescription)"
        }
    }

    @ViewBuilder
    private func secao<C: View>(_ titulo: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(titulo.uppercased()).font(.system(size: 11, weight: .semibold)).tracking(1.4)
                .foregroundStyle(Color.textFaint)
            content()
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).fill(Color.surfaceRaised.opacity(0.6)))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Color.border, lineWidth: 1))
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: - Helpers de apresentação
// ─────────────────────────────────────────────────────────────

private func corStatus(_ s: StatusManutencao?) -> Color {
    // Preditivo já com troca registrada = a contagem está viva → cor de ação.
    if s?.severidade == .semHistorico, s?.ultimaTrocaMs != nil { return Color.accent }
    switch s?.severidade {
    case .verde:        return Color.bom
    case .amarelo:      return Color.yellow
    case .vermelho:     return Color.atencao
    case .condicional:  return Color.accent
    case .recomendacao, .semHistorico, .none: return Color.textFaint
    }
}

private func textoSeveridade(_ s: StatusManutencao?) -> String {
    if s?.severidade == .semHistorico, s?.ultimaTrocaMs != nil { return "CONTANDO" }
    switch s?.severidade {
    case .verde:        return "EM DIA"
    case .amarelo:      return "ATENÇÃO"
    case .vermelho:     return "TROCAR"
    case .condicional:  return "CHECAR"
    case .recomendacao: return "OPCIONAL"
    case .semHistorico, .none: return "SEM DADO"
    }
}

/// "Trocado em 10/06/2026 · 0 h de uso · aprendendo a vida útil"
/// (a parte de aprendizado só nos preditivos ainda sem média).
private func linhaUltimaTroca(_ s: StatusManutencao, trocaMs: Int64) -> String {
    var partes = ["Trocado em \(fmtDataCurta(trocaMs))"]
    if let horas = s.horasDesdeUltima {
        partes.append("\(fmtHorasUso(horas)) de uso")
    }
    if s.severidade == .semHistorico {
        partes.append("aprendendo a vida útil")
    }
    return partes.joined(separator: " · ")
}

private func fmtDataCurta(_ ms: Int64) -> String {
    let df = DateFormatter()
    df.dateFormat = "dd/MM/yyyy"
    return df.string(from: Date(timeIntervalSince1970: Double(ms) / 1000))
}

private func fmtHorasUso(_ horas: Double) -> String {
    if horas <= 0 { return "0 h" }
    if horas >= 10 { return "\(Int(horas.rounded())) h" }
    return String(format: "%.1f h", horas).replacingOccurrences(of: ".", with: ",")
}

private func descricaoChecagem(_ item: ConsumivelDef) -> String {
    guard item.checagem.ativa else { return "Sem checagem recorrente" }
    return "Checar: \(item.checagem.acao.rawValue.lowercased()) — \(item.checagem.quando.descricao.lowercased())"
}

private func descricaoTroca(_ item: ConsumivelDef) -> String {
    switch item.troca {
    case .peloResultado:     return "Troca: pelo resultado"
    case .preditivoPorHoras: return "Troca: preditiva (IA aprende as horas)"
    case .soRecomendacao:    return "Troca: só recomendação"
    case .limiteMaximo(let v, let u):
        if u == .validade { return "Troca: pela validade da etiqueta" }
        let valor = v.map { $0 == $0.rounded() ? String(Int($0)) : String($0) } ?? "?"
        return "Troca: limite \(valor) \(u.rawValue.lowercased())"
    }
}

private extension String {
    var trimmedNilSeVazio: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
