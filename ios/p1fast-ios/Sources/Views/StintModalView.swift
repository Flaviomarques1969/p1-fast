// ═══════════════════════════════════════════════════════════
// StintModalView — port reduzido de mockup-stint.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.3 — Prompt #11. Modal de criação de stint dentro de
// um evento. O mockup canônico (`_design-reference/mockup-stint.html`)
// tem ~10 campos (combustível, pneu, calibragem 4-rodas, setup
// avançado, P1 Coach, área de foco, lição específica, trecho).
// O prompt do queue corta isso pro essencial do MVP — 4 campos:
//
//   - Piloto (picker, fonte = `pilotos` do time)
//   - Objetivo (5 tipos canônicos de SEED_OBJETIVO_TIPOS)
//   - Voltas planejadas (integer ≥ 1)
//   - Lição focada (texto livre — catálogo é Prompt #16)
//
// Visual herda do mockup: eyebrow + título + sections + footbar
// Cancelar/Salvar. Os campos cortados aparecem em "Sprint 1A.3+"
// (placeholder vazio) pra deixar claro que são pendências.
//
// CTA "Iniciar stint" cria sessao em GRDB com status='ativa', volta
// pra detalhe do evento + dispara `onCreated(stintId)` pra UI abrir
// PosStintView (atalho do MVP — sprint 1B vai inserir cockpit ao
// vivo entre os dois).

import SwiftUI
import P1FastCore

struct StintModalView: View {
    @EnvironmentObject private var repo: StintRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var pneuRepo: PneuRepository
    @EnvironmentObject private var combustivelRepo: CombustivelRepository
    @EnvironmentObject private var licaoRepo: LicaoRepository
    /// nil = Stint SOLTO (sem evento). Decisão Flávio 15/06/2026.
    let eventoId: String?
    let proximoNumero: Int
    let contextoLinha: String
    let onCancel: () -> Void
    let onCreated: (String) -> Void

    @State private var pilotoId: String?
    @State private var voltasPlanejadas: Int = 10
    @State private var licaoIdSelecionada: String?
    @State private var savingError: String?
    @State private var isSaving = false

    // ── Planejamento do Stint (15/06): propósito + treino vieram pra cá
    // ("uma tela só"). Ao aprovar, viram o plano que o painel da pista lê.
    enum Proposito: String { case livre, testar, treinar }
    @State private var proposito: Proposito = .livre
    @State private var focoTeste: FocoTeste?
    @State private var focoTreino: String?      // id do treino do catálogo
    @State private var briefConfirmado = false

    // Sprint 1A.4 — Prompt #17. Pneu + combustível ficam no estado local
    // do modal e são persistidos via setPneu/setCombustivel após o create.
    // carroId é derivado do primeiro carro do CarroRepository (MVP — não
    // existe seletor de carro no modal v1; ver mockup-stint contextoLinha
    // que mostra o carro como parte do header informativo).
    @State private var pneuIdSelecionado: String?
    @State private var combustivelIdSelecionado: String?
    @State private var qtCombustivelTexto: String = ""
    @State private var sheet: StintModalSheet?

    // MS-4.3: campos novos do StintPlan estendido (v14). Estado local
    // persistido via setStintExtensions após o create da sessao. Toggles
    // ia_ligada e mapa_ghost_ligado são flags only — comportamento real
    // vive em F2/F3/F4 (ver docs/FRENTES_POS_MS4.md).
    @State private var paradas: [ParadaBox] = []
    @State private var iaLigada: Bool = false
    @State private var mapaGhostLigado: Bool = false
    @State private var paradaEditando: ParadaBox?

    // MS-4.4: revezamento (endurance) + convidado (não-endurance).
    // permiteRevezamento é carregado em .task() lendo evento.tipo
    // via StintRepository.eventoPermiteRevezamento (lógica pura em
    // EnduranceDetection.tipoPermiteRevezamento).
    @State private var permiteRevezamento: Bool = false
    @State private var turnos: [PilotoTurno] = []
    @State private var turnoEditandoIndex: Int? = nil
    @State private var convidadoId: String? = nil

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
                onCancel: onCancel,
                onSave: salvar,
                saveLabel: "Aprovar e iniciar",
                canSave: canSave
            )
        }
        .preferredColorScheme(.dark)
        .onAppear { hidratarDefaults() }
        .task {
            // MS-4.4: detecta se evento é endurance pra liberar revezamento.
            // Stint solto (sem evento) nunca é endurance.
            if let eid = eventoId {
                permiteRevezamento = await repo.eventoPermiteRevezamento(eventoId: eid)
            } else {
                permiteRevezamento = false
            }
        }
        .sheet(item: $sheet) { which in
            sheetView(for: which)
        }
    }

    @ViewBuilder
    private func sheetView(for which: StintModalSheet) -> some View {
        switch which {
        case .pneuPicker:
            PneuPickerView(
                carroId: carroIdInferido,
                stintNumero: proximoNumero,
                initialPneuId: pneuIdSelecionado,
                onCancel: { sheet = nil },
                onConfirm: { id in
                    pneuIdSelecionado = id
                    sheet = nil
                }
            )
            .environmentObject(pneuRepo)
            .environmentObject(carroRepo)
        case .combustivelPicker:
            CombustivelPickerView(
                stintNumero: proximoNumero,
                contextoSub: contextoLinha,
                initialCombustivelId: combustivelIdSelecionado,
                onCancel: { sheet = nil },
                onConfirm: { id in
                    combustivelIdSelecionado = id
                    sheet = nil
                }
            )
            .environmentObject(combustivelRepo)
        case .paradaEditor:
            ParadaBoxEditorSheet(
                inicial: paradaEditando,
                maxVoltas: voltasPlanejadas,
                onCancel: { sheet = nil; paradaEditando = nil },
                onSalvar: { parada in
                    aplicarParada(parada)
                    sheet = nil
                    paradaEditando = nil
                },
                onRemover: paradaEditando == nil ? nil : {
                    if let editando = paradaEditando {
                        paradas.removeAll(where: { $0.volta == editando.volta })
                    }
                    sheet = nil
                    paradaEditando = nil
                }
            )
        case .turnoEditor:
            TurnoEditorSheet(
                inicial: turnoEditandoIndex.flatMap { turnos.indices.contains($0) ? turnos[$0] : nil },
                pilotos: repo.pilotos,
                maxVoltas: voltasPlanejadas,
                onCancel: { sheet = nil; turnoEditandoIndex = nil },
                onSalvar: { novo in
                    aplicarTurno(novo, index: turnoEditandoIndex)
                    sheet = nil
                    turnoEditandoIndex = nil
                },
                onRemover: turnoEditandoIndex == nil ? nil : {
                    if let idx = turnoEditandoIndex { removerTurno(index: idx) }
                    sheet = nil
                    turnoEditandoIndex = nil
                }
            )
        }
    }

    private var carroIdInferido: String? {
        carroRepo.carros.first?.id
    }

    private var canSave: Bool {
        guard !isSaving else { return false }
        guard voltasPlanejadas >= 1 else { return false }
        guard propositoOk else { return false }
        // MS-4.4: validação muda conforme tipo do evento
        if permiteRevezamento {
            // Endurance — precisa de pelo menos 1 turno cobrindo todas as voltas
            return !turnos.isEmpty && turnosCobremTodasVoltas
        } else {
            // Track day / treino livre — só piloto principal obrigatório
            return pilotoId != nil
        }
    }

    /// Propósito completo: livre sempre ok; testar exige a parte; treinar
    /// exige o treino escolhido + a explicação vista (gateia o Aprovar).
    private var propositoOk: Bool {
        switch proposito {
        case .livre: return true
        case .testar: return focoTeste != nil
        case .treinar: return focoTreino != nil && briefConfirmado
        }
    }

    /// O título do stint (campo `objetivo` da sessão) passa a vir do PROPÓSITO,
    /// não de um campo separado. Decisão Flávio 18/06: "Objetivo" e "Propósito"
    /// eram dois campos competindo; evoluímos só pro Propósito.
    private var objetivoDerivado: String {
        switch proposito {
        case .livre: return "Rodar livre"
        case .testar: return "Testar o carro"
        case .treinar: return "Treinar habilidade"
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(text: "Novo stint")
                Text("Stint #\(proximoNumero)")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(-0.6) // -0.025em em 24pt
                    .foregroundStyle(Color.text)
                if !contextoLinha.isEmpty {
                    Text(contextoLinha)
                        .font(.system(size: 13, weight: .regular))
                        .monospacedDigit()
                        .foregroundStyle(Color.textMuted)
                }
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, Spacing.sm)

            sectionConfiguracao
            sectionVoltas
            sectionParadas
            sectionItensCarro
            sectionProposito
            sectionLicao
            sectionAssistencia

            if let erro = savingError {
                Text(erro)
                    .font(.captionP1)
                    .foregroundStyle(Color.erro)
                    .padding(.horizontal, Spacing.xs)
            }
        }
    }

    // MARK: - Seções

    private var sectionConfiguracao: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Configuração")
            if permiteRevezamento {
                FormField(label: "Pilotos com troca por volta", small: "endurance · obrigatório cobrir todas as voltas") {
                    turnosSection
                }
            } else {
                FormField(label: "Piloto") { pilotoPicker }
                FormField(label: "Convidado", small: "opcional · piloto adicional") {
                    convidadoPicker
                }
            }
        }
    }

    // Itens do carro (combustível + pneu). Descem pra DEPOIS de voltas/paradas —
    // decisão Flávio 23/06/2026: "total de voltas e se para ou não no box logo
    // após o nome do piloto". Combustível/pneu ficam abaixo desse bloco.
    private var sectionItensCarro: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Combustível e pneu")
            FormField(label: "Combustível abastecido", small: "opcional") {
                combustivelRow
            }
            FormField(label: "Pneu montado", small: "opcional") {
                pneuRow
            }
        }
    }

    // MS-4.4 — Revezamento (lista de turnos pra endurance)

    private var turnosSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            if turnos.isEmpty {
                Text("Nenhum turno cadastrado. Toque em '+ adicionar turno'.")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.surfaceRaised)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(Color.border, lineWidth: 1)
                    )
            } else {
                ForEach(Array(turnos.enumerated()), id: \.offset) { idx, turno in
                    turnoRow(idx: idx, turno: turno)
                }
            }
            Button(action: {
                turnoEditandoIndex = nil
                sheet = .turnoEditor
            }) {
                HStack(spacing: 6) {
                    Text("+")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.textMuted)
                    Text("adicionar turno")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(Color.border.opacity(0.6), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                )
            }
            .buttonStyle(.plain)
            // Aviso de cobertura
            if !turnos.isEmpty && !turnosCobremTodasVoltas {
                Text("Atenção: turnos não cobrem todas as \(voltasPlanejadas) voltas planejadas.")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.atencao)
                    .padding(.horizontal, 4)
            }
        }
    }

    private func turnoRow(idx: Int, turno: PilotoTurno) -> some View {
        Button(action: {
            turnoEditandoIndex = idx
            sheet = .turnoEditor
        }) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(repo.pilotos.first(where: { $0.id == turno.pilotoId })?.nome ?? "Piloto")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Color.text)
                    Text("Voltas \(turno.voltaInicio)–\(turno.voltaFim)")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                }
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
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
        .buttonStyle(.plain)
    }

    /// Verifica se os turnos cobrem todas as voltas planejadas sem gap.
    /// Vazia ou um único turno (1..voltasPlanejadas) = ok. Sobrepostos = false.
    private var turnosCobremTodasVoltas: Bool {
        guard !turnos.isEmpty, voltasPlanejadas >= 1 else { return turnos.isEmpty }
        let ordenados = turnos.sorted(by: { $0.voltaInicio < $1.voltaInicio })
        guard ordenados.first?.voltaInicio == 1 else { return false }
        guard ordenados.last?.voltaFim == voltasPlanejadas else { return false }
        for i in 0..<(ordenados.count - 1) {
            if ordenados[i].voltaFim + 1 != ordenados[i+1].voltaInicio { return false }
        }
        return true
    }

    /// Aplica um turno (novo ou edição). Se índice nil, adiciona; senão substitui.
    func aplicarTurno(_ novo: PilotoTurno, index: Int?) {
        if let idx = index, idx >= 0, idx < turnos.count {
            turnos[idx] = novo
        } else {
            turnos.append(novo)
        }
        turnos.sort(by: { $0.voltaInicio < $1.voltaInicio })
    }

    func removerTurno(index: Int) {
        guard index >= 0, index < turnos.count else { return }
        turnos.remove(at: index)
    }

    // MS-4.4 — Convidado picker (não-endurance)

    private var convidadoPicker: some View {
        Menu {
            Button("Sem convidado") { convidadoId = nil }
            ForEach(repo.pilotos.filter { $0.id != pilotoId }, id: \.id) { p in
                Button(p.nome) { convidadoId = p.id }
            }
        } label: {
            HStack {
                Text(convidadoNomeAtual ?? "Sem convidado")
                    .font(.system(size: 15, weight: .medium))
                    .tracking(-0.075)
                    .foregroundStyle(convidadoId == nil ? Color.textFaint : Color.text)
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .frame(width: 20, height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.surfaceHover)
                    )
            }
            .padding(.horizontal, 14)
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
        .menuStyle(.button)
    }

    private var convidadoNomeAtual: String? {
        guard let id = convidadoId else { return nil }
        return repo.pilotos.first(where: { $0.id == id })?.nome
    }

    // MARK: - Combustível abastecido (qty + picker)

    private var combustivelRow: some View {
        HStack(spacing: 10) {
            qtCombustivelField
                .frame(maxWidth: 110)
            combustivelPickerButton
        }
    }

    private var qtCombustivelField: some View {
        TextField("L", text: $qtCombustivelTexto, prompt: Text("L").foregroundStyle(Color.textFaint))
            .keyboardType(.decimalPad)
            .textFieldStyle(.plain)
            .font(.system(size: 16, weight: .medium))
            .tracking(-0.08)
            .foregroundStyle(Color.text)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
            .onChange(of: qtCombustivelTexto) { _, novo in
                qtCombustivelTexto = sanitizarLitros(novo)
            }
    }

    private var combustivelPickerButton: some View {
        Button(action: { sheet = .combustivelPicker }) {
            HStack {
                Text(combustivelLabelAtual)
                    .font(.system(size: 15, weight: .medium))
                    .tracking(-0.075)
                    .foregroundStyle(combustivelIdSelecionado == nil ? Color.textFaint : Color.text)
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .frame(width: 20, height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.surfaceHover)
                    )
            }
            .padding(.horizontal, 14)
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

    private var combustivelLabelAtual: String {
        guard let id = combustivelIdSelecionado,
              let c = combustivelRepo.combustiveis.first(where: { $0.id == id }) else {
            return "Escolher tipo"
        }
        return c.nome
    }

    /// Permite só dígitos + 1 ponto/vírgula com no máx 1 casa decimal.
    /// Vírgula vira ponto pra `Double(_:)` aceitar.
    private func sanitizarLitros(_ raw: String) -> String {
        let permitido = raw.replacingOccurrences(of: ",", with: ".")
        let filtrado = permitido.filter { $0.isNumber || $0 == "." }
        let partes = filtrado.split(separator: ".", omittingEmptySubsequences: false)
        if partes.count <= 1 { return String(filtrado.prefix(5)) }
        let inteiro = partes[0]
        let decimal = partes[1].prefix(1)
        return "\(inteiro).\(decimal)"
    }

    // MARK: - Pneu montado (picker)

    private var pneuRow: some View {
        Button(action: abrirPneuPicker) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pneuLabelAtual)
                        .font(.system(size: 15, weight: .medium))
                        .tracking(-0.075)
                        .foregroundStyle(pneuIdSelecionado == nil ? Color.textFaint : Color.text)
                    if let hint = pneuHintAtual {
                        Text(hint)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    }
                }
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .frame(width: 20, height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.surfaceHover)
                    )
            }
            .padding(.horizontal, 14)
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

    private var pneuLabelAtual: String {
        guard let id = pneuIdSelecionado,
              let pneu = pneusDoCarro.first(where: { $0.id == id }) else {
            return "Escolher pneu"
        }
        return pneu.marca?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? "Pneu"
    }

    private var pneuHintAtual: String? {
        guard let id = pneuIdSelecionado,
              let pneu = pneusDoCarro.first(where: { $0.id == id }) else {
            return nil
        }
        var partes: [String] = []
        if let medida = pneu.medida, !medida.isEmpty { partes.append(medida) }
        if let comp = pneu.composto { partes.append(comp.rawValue) }
        return partes.isEmpty ? nil : partes.joined(separator: " · ")
    }

    private var pneusDoCarro: [Pneu] {
        guard let cid = carroIdInferido else { return [] }
        return pneuRepo.pneusByCarroId[cid] ?? []
    }

    private func abrirPneuPicker() {
        sheet = .pneuPicker
    }

    // MARK: - Propósito do Stint (planejamento — 15/06, "uma tela só")
    // Port fiel de StintPlanoView: o propósito + foco + treino viram o plano
    // que o painel da pista lê. Aprovar grava o plano junto do envelope.

    private var sectionProposito: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Propósito do Stint")

            propositoCard(.livre, "Rodar livre", "Volta livre, painel completo. Sem foco específico.")

            propositoCard(.testar, "Testar o carro", "O painel foca na parte escolhida o stint inteiro.")
            if proposito == .testar {
                propChipsWrap {
                    ForEach(FocoTeste.allCases) { f in
                        propChip(f.rotulo, ativo: focoTeste == f) { focoTeste = f }
                    }
                }
            }

            propositoCard(.treinar, "Treinar habilidade", "Voltas focadas numa disciplina: técnica de pilotagem ou um dos 6 pontos do trecho.")
            if proposito == .treinar {
                Text("TÉCNICA DE PILOTAGEM")
                    .font(.system(size: 11, weight: .semibold)).tracking(1.1)
                    .foregroundStyle(Color.textFaint)
                propChipsWrap {
                    ForEach(CatalogoTreinos.tecnica) { t in
                        propChip(t.rotulo, ativo: focoTreino == t.id) { escolherTreinoProp(t.id) }
                    }
                }
                Text("PONTOS DO TRECHO")
                    .font(.system(size: 11, weight: .semibold)).tracking(1.1)
                    .foregroundStyle(Color.textFaint).padding(.top, 2)
                propChipsWrap {
                    ForEach(CatalogoTreinos.pontos) { t in
                        propChip(t.rotulo, ativo: focoTreino == t.id) { escolherTreinoProp(t.id) }
                    }
                }
                if let id = focoTreino, let treino = CatalogoTreinos.por(id: id) {
                    briefCardProp(treino)
                }
            }
        }
    }

    private func propositoCard(_ p: Proposito, _ nome: String, _ desc: String) -> some View {
        let selecionado = proposito == p
        return Button {
            proposito = p
            if p != .testar { focoTeste = nil }
            if p != .treinar { focoTreino = nil; briefConfirmado = false }
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(nome)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(selecionado ? Color.accent.opacity(0.12) : Color.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(selecionado ? Color.accent : Color.border, lineWidth: selecionado ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func escolherTreinoProp(_ id: String) {
        focoTreino = id
        briefConfirmado = false   // treino novo → reexige a explicação
    }

    private func briefCardProp(_ t: TreinoCatalogo) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Text(t.rotulo)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.text)
                Spacer(minLength: 0)
                etiquetaBadgeProp(t.etiqueta)
            }
            Text(t.oQueE)
                .font(.system(size: 13))
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)

            Text("O QUE A INTELIGÊNCIA MEDE")
                .font(.system(size: 11, weight: .semibold)).tracking(1.1)
                .foregroundStyle(Color.textFaint).padding(.top, 2)
            ForEach(Array(t.oQueMede.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 8) {
                    Text("·").foregroundStyle(Color.accent)
                    Text(item)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if let r = t.ressalva {
                Text(r)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.textFaint)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }
            Button { briefConfirmado = true } label: {
                Text(briefConfirmado ? "Entendido" : "Entendi — pode treinar isso")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(briefConfirmado ? Color.onAccent : Color.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(briefConfirmado ? Color.accent : Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(Color.accent, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
        }
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

    private func etiquetaBadgeProp(_ etiqueta: String) -> some View {
        let pleno = etiqueta == "pleno"
        return Text(pleno ? "MEDIDO DE VERDADE" : "POR APROXIMAÇÃO")
            .font(.system(size: 9, weight: .bold)).tracking(0.6)
            .foregroundStyle(pleno ? Color.onAccent : Color.text)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(Capsule().fill(pleno ? Color.accent : Color.surface))
            .overlay(Capsule().stroke(pleno ? Color.clear : Color.border, lineWidth: 1))
    }

    private func propChip(_ texto: String, ativo: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(texto)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(ativo ? Color.onAccent : Color.textMuted)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(Capsule().fill(ativo ? Color.accent : Color.clear))
                .overlay(Capsule().stroke(ativo ? Color.clear : Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func propChipsWrap<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) { content() }.padding(.vertical, 2)
        }
    }

    private var sectionVoltas: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Voltas planejadas")
            FormField(label: "Voltas", small: "mínimo 1") {
                VoltasStepper(value: $voltasPlanejadas)
            }
        }
    }

    private var sectionLicao: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Lição focada")
            FormField(label: "Lição praticada", small: "opcional · do catálogo") {
                licaoPicker
            }
        }
    }

    // MS-4.3 — Paradas no box (decisão Q7 + Q2.1). Aparece como lista
    // de chips com volta + motivo, mais um "+" pra adicionar.
    private var sectionParadas: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Paradas no box")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(paradas.sorted(by: { $0.volta < $1.volta }), id: \.volta) { parada in
                        paradaChip(parada)
                    }
                    addParadaChip
                }
                .padding(.horizontal, 1)
            }
        }
    }

    private func paradaChip(_ parada: ParadaBox) -> some View {
        Button(action: {
            paradaEditando = parada
            sheet = .paradaEditor
        }) {
            HStack(spacing: 4) {
                Text("Volta \(parada.volta)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text("· \(parada.motivo)")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(Color.surfaceRaised))
            .overlay(Capsule().stroke(Color.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var addParadaChip: some View {
        Button(action: {
            paradaEditando = nil
            sheet = .paradaEditor
        }) {
            HStack(spacing: 4) {
                Text("+")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.textMuted)
                Text("adicionar")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(Color.clear))
            .overlay(Capsule().stroke(Color.border.opacity(0.6), style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
        }
        .buttonStyle(.plain)
    }

    private func aplicarParada(_ nova: ParadaBox) {
        // Se já existe parada na mesma volta, substitui. Senão adiciona.
        paradas.removeAll(where: { $0.volta == nova.volta })
        paradas.append(nova)
    }

    // MS-4.3 — Picker de lição substituiu texto livre (Q1.1: lições vêm do
    // catálogo já existente em `licoes`, populado por LicaoRepository).
    private var licaoPicker: some View {
        Menu {
            Button("Sem lição focada") { licaoIdSelecionada = nil }
            ForEach(licaoRepo.ativas, id: \.id) { licao in
                Button(licao.titulo) { licaoIdSelecionada = licao.id }
            }
        } label: {
            HStack {
                Text(licaoLabelAtual)
                    .font(.system(size: 15, weight: .medium))
                    .tracking(-0.075)
                    .foregroundStyle(licaoIdSelecionada == nil ? Color.textFaint : Color.text)
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .frame(width: 20, height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.surfaceHover)
                    )
            }
            .padding(.horizontal, 14)
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
        .menuStyle(.button)
    }

    private var licaoLabelAtual: String {
        guard let id = licaoIdSelecionada,
              let licao = licaoRepo.find(id: id) else {
            return "Sem lição focada"
        }
        return licao.titulo
    }

    // MS-4.3 — Toggles de assistência. Comportamento real fica pras frentes
    // pós-MS-4 (F2 = IA, F3 = ghost UI). Aqui só persiste a preferência
    // do piloto pra cada stint.
    private var sectionAssistencia: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Assistência durante o stint")
            assistenciaToggle(
                titulo: "Ativar IA",
                descricao: "Orienta antes da curva e resume depois (chega em fase futura)",
                isOn: $iaLigada
            )
            assistenciaToggle(
                titulo: "Mostrar mapa do ghost",
                descricao: "Sobrepõe traçado da sua melhor volta",
                isOn: $mapaGhostLigado
            )
        }
    }

    private func assistenciaToggle(titulo: String, descricao: String, isOn: Binding<Bool>) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(titulo)
                    .font(.system(size: 15, weight: .medium))
                    .tracking(-0.075)
                    .foregroundStyle(Color.text)
                Text(descricao)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
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

    private func sectionHead(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.32) // 0.12em em 11pt
            .foregroundStyle(Color.textFaint)
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, 2)
    }

    // MARK: - Picker piloto

    private var pilotoPicker: some View {
        Menu {
            ForEach(repo.pilotos, id: \.id) { p in
                Button(p.nome) { pilotoId = p.id }
            }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pilotoNomeAtual ?? "Escolher piloto")
                        .font(.system(size: 15, weight: .medium))
                        .tracking(-0.075)
                        .foregroundStyle(pilotoNomeAtual == nil ? Color.textFaint : Color.text)
                    if let _ = pilotoNomeAtual {
                        Text("Você")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    }
                }
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
                    .frame(width: 20, height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.surfaceHover)
                    )
            }
            .padding(.horizontal, 14)
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
        .menuStyle(.button)
    }

    private var pilotoNomeAtual: String? {
        guard let id = pilotoId else { return nil }
        return repo.pilotos.first(where: { $0.id == id })?.nome
    }

    /// Pré-seleciona o que tem opção única (decisão Flávio 23/06/2026):
    /// "se tem só um item, já aparece selecionado". Vale pra piloto (você por
    /// padrão), combustível (1 tipo cadastrado) e pneu (1 pneu no carro).
    /// Cada guarda só age quando o campo está vazio — nunca sobrescreve uma
    /// escolha manual do piloto.
    private func hidratarDefaults() {
        if pilotoId == nil {
            pilotoId = repo.pilotos.first(where: { $0.id == PilotoRepository.pilotoFlavioId })?.id
                ?? repo.pilotos.first?.id
        }
        if combustivelIdSelecionado == nil, combustivelRepo.combustiveis.count == 1 {
            combustivelIdSelecionado = combustivelRepo.combustiveis.first?.id
        }
        if pneuIdSelecionado == nil, pneusDoCarro.count == 1 {
            pneuIdSelecionado = pneusDoCarro.first?.id
        }
    }

    // MARK: - Salvar

    private func salvar() {
        // MS-4.4: piloto principal vem do `pilotoId` em modo normal, ou
        // do primeiro turno em modo endurance.
        let pidPrincipal: String? = permiteRevezamento
            ? turnos.sorted(by: { $0.voltaInicio < $1.voltaInicio }).first?.pilotoId
            : pilotoId
        guard let pid = pidPrincipal else { return }
        isSaving = true
        savingError = nil
        let pneuParaSalvar = pneuIdSelecionado
        let combustivelParaSalvar = combustivelIdSelecionado
        let litrosParaSalvar = parseLitros(qtCombustivelTexto)
        // Snapshots dos campos novos pra persistir após o create.
        let licaoSnapshot = licaoIdSelecionada
        let licaoTitulo = licaoIdSelecionada.flatMap { licaoRepo.find(id: $0)?.titulo } ?? ""
        let paradasSnapshot = paradas
        let iaSnapshot = iaLigada
        let ghostSnapshot = mapaGhostLigado
        let turnosSnapshot: [PilotoTurno]? = permiteRevezamento ? turnos : nil
        let convidadoSnapshot: String? = permiteRevezamento ? nil : convidadoId

        // ── PLANEJAMENTO (15/06): monta o plano que o painel da pista lê. ──
        let carroId = carroIdInferido
        let tipoPneuNorm = normalizarTipoPneu(tipoPneuBruto)
        let focoStr: String?
        switch proposito {
        case .livre:   focoStr = nil
        case .testar:  focoStr = focoTeste?.rawValue
        case .treinar: focoStr = focoTreino
        }
        let isoFmt = ISO8601DateFormatter()
        isoFmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plano = PlanoStint(
            proposito: proposito.rawValue,
            foco: focoStr,
            ghost: ghostSnapshot,
            voltas: voltasPlanejadas,
            paradas: paradasSnapshot.map { PlanoParada(volta: $0.volta, motivo: $0.motivo) },
            carroId: carroId,
            piloto: pid,
            autodromo: nil,               // v1: painel casa o plano pelo carro
            tipoPneu: tipoPneuNorm,
            vidaPneuFaixa: nil,           // v1: modal ainda não pergunta a faixa de vida
            aprovadoEm: isoFmt.string(from: Date())
        )

        Task {
            do {
                // 1. APROVAR: grava plano + envelope na nuvem (papel que era do
                //    computador). carro_id é obrigatório na tabela — sem carro,
                //    o Stint ainda inicia, mas o plano não vai pro painel.
                if let carroId {
                    _ = try await EnvelopeAprovacao.gravar(
                        carroId: carroId, tipoPneu: tipoPneuNorm, plano: plano)
                }
                // 2. INICIAR o Stint (como antes).
                let stintId = try await repo.create(
                    eventoId: eventoId,
                    pilotoId: pid,
                    objetivoTipo: objetivoDerivado,
                    licaoFocada: licaoTitulo,
                    voltasPlanejadas: voltasPlanejadas
                )
                if pneuParaSalvar != nil {
                    try await repo.setPneu(stintId: stintId, pneuId: pneuParaSalvar)
                }
                if combustivelParaSalvar != nil || litrosParaSalvar != nil {
                    try await repo.setCombustivel(
                        stintId: stintId,
                        combustivelId: combustivelParaSalvar,
                        litros: litrosParaSalvar
                    )
                }
                // MS-4.3 + MS-4.4: persiste campos novos do StintPlan (v14).
                try await repo.setStintExtensions(
                    stintId: stintId,
                    paradas: paradasSnapshot,
                    iaLigada: iaSnapshot,
                    mapaGhostLigado: ghostSnapshot,
                    licaoId: .some(licaoSnapshot),
                    pilotosRevezamento: .some(turnosSnapshot),
                    convidadoId: .some(convidadoSnapshot)
                )
                isSaving = false
                onCreated(stintId)
            } catch {
                isSaving = false
                savingError = "Não consegui aprovar/iniciar: \(error.localizedDescription)"
            }
        }
    }

    /// Texto bruto do tipo de pneu derivado do pneu montado (composto + medida).
    /// Ex.: radial + "185/14" → "radial 185/14" → normaliza pra "radial-185-14".
    /// Vazio quando nenhum pneu escolhido → normaliza pra "desconhecido".
    private var tipoPneuBruto: String {
        guard let pid = pneuIdSelecionado,
              let pneu = pneusDoCarro.first(where: { $0.id == pid }) else { return "" }
        let comp = pneu.composto?.rawValue
        let med = pneu.medida?.trimmingCharacters(in: .whitespaces)
        if let comp, let med, !med.isEmpty { return "\(comp) \(med)" }
        if let comp { return comp }
        if let med, !med.isEmpty { return med }
        return pneu.marca ?? ""
    }

    private func parseLitros(_ texto: String) -> Double? {
        let trimmed = texto.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        return Double(trimmed.replacingOccurrences(of: ",", with: "."))
    }
}

// MARK: - Sub-componentes

/// Stepper numérico — ± / valor central. Mais legível que TextField
/// num campo "voltas planejadas" que só aceita ints positivos.
private struct VoltasStepper: View {
    @Binding var value: Int

    var body: some View {
        HStack(spacing: 0) {
            stepperButton(symbol: "−", action: decrement, isEnabled: value > 1)
            Spacer(minLength: 0)
            Text("\(value)")
                .font(.system(size: 22, weight: .semibold))
                .monospacedDigit()
                .tracking(-0.44) // -0.02em em 22pt
                .foregroundStyle(Color.text)
            Spacer(minLength: 0)
            stepperButton(symbol: "+", action: increment, isEnabled: value < 99)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func decrement() { if value > 1 { value -= 1 } }
    private func increment() { if value < 99 { value += 1 } }

    private func stepperButton(symbol: String, action: @escaping () -> Void, isEnabled: Bool) -> some View {
        Button(action: action) {
            Text(symbol)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(isEnabled ? Color.text : Color.textFaint)
                .frame(width: 46, height: 38)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.surfaceHover)
                )
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }
}

// MARK: - Sheets enum

enum StintModalSheet: Identifiable, Equatable {
    case pneuPicker
    case combustivelPicker
    case paradaEditor  // MS-4.3 — abre o ParadaBoxEditorSheet
    case turnoEditor   // MS-4.4 — abre o TurnoEditorSheet (endurance)

    var id: String {
        switch self {
        case .pneuPicker: return "pneu-picker"
        case .combustivelPicker: return "combustivel-picker"
        case .paradaEditor: return "parada-editor"
        case .turnoEditor: return "turno-editor"
        }
    }
}

// MARK: - ParadaBoxEditorSheet (MS-4.3)

/// Sheet pra adicionar ou editar uma parada no box dentro do StintPlan.
/// Recebe `inicial` nil pra criar nova; com valor pra editar/remover.
struct ParadaBoxEditorSheet: View {
    let inicial: ParadaBox?
    let maxVoltas: Int
    let onCancel: () -> Void
    let onSalvar: (ParadaBox) -> Void
    let onRemover: (() -> Void)?

    @State private var volta: Int
    @State private var motivo: String

    init(inicial: ParadaBox?,
         maxVoltas: Int,
         onCancel: @escaping () -> Void,
         onSalvar: @escaping (ParadaBox) -> Void,
         onRemover: (() -> Void)?) {
        self.inicial = inicial
        self.maxVoltas = max(maxVoltas, 1)
        self.onCancel = onCancel
        self.onSalvar = onSalvar
        self.onRemover = onRemover
        let v = inicial?.volta ?? min(5, self.maxVoltas)
        let m = inicial?.motivo ?? ""
        _volta = State(initialValue: max(1, min(v, self.maxVoltas)))
        _motivo = State(initialValue: m)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    Eyebrow(text: inicial == nil ? "Nova parada" : "Editar parada")
                    Text(inicial == nil ? "Adicionar parada no box" : "Parada na volta \(inicial!.volta)")
                        .font(.system(size: 22, weight: .semibold))
                        .tracking(-0.44)
                        .foregroundStyle(Color.text)
                        .padding(.bottom, Spacing.sm)

                    FormField(label: "Volta da parada", small: "1 a \(maxVoltas)") {
                        VoltaStepperEditor(value: $volta, maxValue: maxVoltas)
                    }
                    FormField(label: "Motivo", small: "aparece no Command Box") {
                        FormInput(text: $motivo, placeholder: "Ex: trocar pneu")
                    }
                    if let onRemover = onRemover {
                        Button(action: onRemover) {
                            Text("Remover parada")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color.erro)
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity)
                                .background(
                                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                        .stroke(Color.erro.opacity(0.5), lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .padding(.top, Spacing.md)
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 140)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: onCancel,
                onSave: {
                    let trimmed = motivo.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty else { return }
                    onSalvar(ParadaBox(volta: volta, motivo: trimmed))
                },
                saveLabel: inicial == nil ? "Adicionar" : "Salvar",
                canSave: !motivo.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                       && volta >= 1 && volta <= maxVoltas
            )
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - TurnoEditorSheet (MS-4.4)

/// Sheet pra adicionar ou editar um turno de piloto em revezamento (endurance).
/// Cada turno = piloto + volta início + volta fim.
struct TurnoEditorSheet: View {
    let inicial: PilotoTurno?
    let pilotos: [Piloto]
    let maxVoltas: Int
    let onCancel: () -> Void
    let onSalvar: (PilotoTurno) -> Void
    let onRemover: (() -> Void)?

    @State private var pilotoId: String?
    @State private var voltaInicio: Int
    @State private var voltaFim: Int

    init(inicial: PilotoTurno?,
         pilotos: [Piloto],
         maxVoltas: Int,
         onCancel: @escaping () -> Void,
         onSalvar: @escaping (PilotoTurno) -> Void,
         onRemover: (() -> Void)?) {
        self.inicial = inicial
        self.pilotos = pilotos
        self.maxVoltas = max(maxVoltas, 1)
        self.onCancel = onCancel
        self.onSalvar = onSalvar
        self.onRemover = onRemover
        _pilotoId = State(initialValue: inicial?.pilotoId ?? pilotos.first?.id)
        let inicio = inicial?.voltaInicio ?? 1
        let fim = inicial?.voltaFim ?? self.maxVoltas
        _voltaInicio = State(initialValue: max(1, min(inicio, self.maxVoltas)))
        _voltaFim = State(initialValue: max(inicio, min(fim, self.maxVoltas)))
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    Eyebrow(text: inicial == nil ? "Novo turno" : "Editar turno")
                    Text(inicial == nil ? "Adicionar turno de revezamento" : "Turno")
                        .font(.system(size: 22, weight: .semibold))
                        .tracking(-0.44)
                        .foregroundStyle(Color.text)
                        .padding(.bottom, Spacing.sm)

                    FormField(label: "Piloto", small: "obrigatório") {
                        Menu {
                            ForEach(pilotos, id: \.id) { p in
                                Button(p.nome) { pilotoId = p.id }
                            }
                        } label: {
                            HStack {
                                Text(pilotos.first(where: { $0.id == pilotoId })?.nome ?? "Escolher piloto")
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(pilotoId == nil ? Color.textFaint : Color.text)
                                Spacer()
                                Text("›").foregroundStyle(Color.textMuted)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: Radius.md).fill(Color.surfaceRaised))
                            .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(Color.border, lineWidth: 1))
                        }
                        .menuStyle(.button)
                    }
                    FormField(label: "Volta início", small: "1 a \(maxVoltas)") {
                        VoltaStepperEditor(value: $voltaInicio, maxValue: maxVoltas)
                    }
                    FormField(label: "Volta fim", small: "≥ início") {
                        VoltaStepperEditor(value: $voltaFim, maxValue: maxVoltas)
                    }
                    if let onRemover = onRemover {
                        Button(action: onRemover) {
                            Text("Remover turno")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color.erro)
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity)
                                .background(
                                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                        .stroke(Color.erro.opacity(0.5), lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .padding(.top, Spacing.md)
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.md)
                .padding(.bottom, 140)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.surface)

            FootBar(
                onCancel: onCancel,
                onSave: {
                    guard let pid = pilotoId else { return }
                    guard voltaFim >= voltaInicio else { return }
                    onSalvar(PilotoTurno(pilotoId: pid, voltaInicio: voltaInicio, voltaFim: voltaFim))
                },
                saveLabel: inicial == nil ? "Adicionar" : "Salvar",
                canSave: pilotoId != nil && voltaFim >= voltaInicio
                       && voltaInicio >= 1 && voltaFim <= maxVoltas
            )
        }
        .preferredColorScheme(.dark)
    }
}

private struct VoltaStepperEditor: View {
    @Binding var value: Int
    let maxValue: Int

    var body: some View {
        HStack(spacing: 0) {
            stepperButton(symbol: "−", action: { if value > 1 { value -= 1 } }, isEnabled: value > 1)
            Spacer(minLength: 0)
            Text("\(value)")
                .font(.system(size: 22, weight: .semibold))
                .monospacedDigit()
                .tracking(-0.44)
                .foregroundStyle(Color.text)
            Spacer(minLength: 0)
            stepperButton(symbol: "+", action: { if value < maxValue { value += 1 } }, isEnabled: value < maxValue)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func stepperButton(symbol: String, action: @escaping () -> Void, isEnabled: Bool) -> some View {
        Button(action: action) {
            Text(symbol)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(isEnabled ? Color.text : Color.textFaint)
                .frame(width: 46, height: 38)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.surfaceHover)
                )
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }
}

// MARK: - Helpers locais

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

// MARK: - StintSoltoLauncher — abre o modal "uma tela só" sem evento

/// Abre o StintModalView no modo SOLTO (sem evento) a partir da navegação
/// ("Stint livre" em StintPlanejamentoView). Decisão Flávio 15/06: o mesmo
/// modal que tem pneu/paradas agora tem propósito/treino — uma tela só.
/// Os repositórios chegam pelo ambiente (injetados na raiz em ContentView).
struct StintSoltoLauncher: View {
    /// nil = livre; com id = vinculado a um evento (mesma tela).
    let eventoId: String?
    @EnvironmentObject private var router: NavRouter
    @EnvironmentObject private var carroRepo: CarroRepository
    /// Vira true quando o Stint é aprovado/iniciado — troca o modal pela
    /// confirmação (antes a tela voltava CALADA e parecia que nada acontecia).
    @State private var iniciado = false

    var body: some View {
        Group {
            if iniciado {
                confirmacao
            } else {
                StintModalView(
                    eventoId: eventoId,
                    proximoNumero: max(1, carroRepo.stintsPorCarro.values.reduce(0, +) + 1),
                    contextoLinha: eventoId == nil ? "Stint livre" : "Vinculado a um evento",
                    onCancel: { voltar() },
                    onCreated: { _ in iniciado = true }   // mostra a confirmação
                )
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    // Confirmação explícita pós-aprovação (feedback claro, sem voltar calado).
    private var confirmacao: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()
            Image(systemName: "checkmark.circle")
                .font(.system(size: 56, weight: .regular))
                .foregroundStyle(Color.accent)
            VStack(spacing: Spacing.sm) {
                Text("Stint iniciado")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Color.text)
                Text("Plano aprovado e enviado pro painel. O painel da pista já pode armar o treino conforme você escolheu.")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.textMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, Spacing.lg)
            Spacer()
            Button(action: voltarHome) {
                Text("Voltar pra Home")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.onAccent)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Capsule().fill(Color.accent))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surface)
        .preferredColorScheme(.dark)
    }

    private func voltar() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        if !router.path.isEmpty { router.path.removeLast() }
    }

    /// Volta até a Home (esvazia a pilha de navegação).
    private func voltarHome() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        while !router.path.isEmpty { router.path.removeLast() }
    }
}

#Preview("StintModal — preview vazio") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let stintRepo = StintRepository(queue: queue)
    let carroRepo = CarroRepository(queue: queue)
    let pneuRepo = PneuRepository(queue: queue)
    let combustivelRepo = CombustivelRepository(queue: queue)
    let licaoRepo = LicaoRepository(queue: queue)
    return StintModalView(
        eventoId: "preview",
        proximoNumero: 1,
        contextoLinha: "Brasília · sábado 02/05 · Celta 1.4",
        onCancel: {},
        onCreated: { _ in }
    )
    .environmentObject(stintRepo)
    .environmentObject(carroRepo)
    .environmentObject(pneuRepo)
    .environmentObject(combustivelRepo)
    .environmentObject(licaoRepo)
    .task {
        await stintRepo.bootstrap()
        await carroRepo.bootstrap()
        await pneuRepo.bootstrap()
        await combustivelRepo.bootstrap()
        await licaoRepo.bootstrap()
    }
}
