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
    // 2026-05-16 Flávio "cadastrar piloto dentro do seletor": precisa do
    // PilotoRepository pra abrir a tela de cadastro e auto-selecionar
    // o novo piloto após salvar.
    @EnvironmentObject private var pilotoRepo: PilotoRepository
    /// Pendência 3 da reformulação Autódromos (Flávio 2026-05-17):
    /// pré-seleção carro+configuração no plano do stint.
    @EnvironmentObject private var configuracaoRepo: ConfiguracaoRepository
    let eventoId: String
    let proximoNumero: Int
    let contextoLinha: String
    /// 2026-05-16 Flávio: quando o usuário toca num carro específico na
    /// tela do evento (em "Seu histórico nessa pista"), passamos o ID
    /// dele aqui pra evitar o fallback "primeiro carro do repositório".
    var carroInicialId: String? = nil
    let onCancel: () -> Void
    let onCreated: (String) -> Void

    @State private var pilotoId: String?
    @State private var objetivoTipo: String = "Aquecimento"
    @State private var voltasPlanejadas: Int = 10
    @State private var licaoIdSelecionada: String?
    @State private var savingError: String?
    @State private var isSaving = false
    /// Pendência 3 — pré-seleção carro+configuração no plano do stint.
    @State private var carroIdSelecionado: String?
    @State private var configuracaoIdSelecionada: String?

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
                saveLabel: "Iniciar stint",
                canSave: canSave
            )
        }
        .preferredColorScheme(.dark)
        .onAppear { hidratarPilotoDefault() }
        .task {
            // MS-4.4: detecta se evento é endurance pra liberar revezamento.
            permiteRevezamento = await repo.eventoPermiteRevezamento(eventoId: eventoId)
            // Pendência 3 — hidrata pré-seleção carro+config com a última
            // usada no evento. Se nada foi usado ainda, cai no carro inicial
            // (passado pelo toque no card) e na configuração marcada como
            // atual desse carro.
            await hidratarCarroConfigDefault()
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
        case .pilotoPicker:
            PilotoPickerView(
                titulo: "Piloto",
                subtitulo: "Stint #\(proximoNumero) · \(contextoLinha)",
                initialId: pilotoId,
                permiteSemOpcao: false,
                labelSemOpcao: "",
                labelCadastrarNovo: "Cadastrar novo piloto",
                idsBloqueados: convidadoId.map { Set([$0]) } ?? [],
                onCancel: { sheet = nil },
                onConfirm: { id in
                    pilotoId = id
                    sheet = nil
                    Task { try? await repo.reloadPilotos() }
                }
            )
            .environmentObject(pilotoRepo)
        case .convidadoPicker:
            PilotoPickerView(
                titulo: "Convidado",
                subtitulo: "Stint #\(proximoNumero) · \(contextoLinha)",
                initialId: convidadoId,
                permiteSemOpcao: true,
                labelSemOpcao: "Sem convidado",
                labelCadastrarNovo: "Cadastrar novo piloto",
                idsBloqueados: pilotoId.map { Set([$0]) } ?? [],
                onCancel: { sheet = nil },
                onConfirm: { id in
                    convidadoId = id
                    sheet = nil
                    Task { try? await repo.reloadPilotos() }
                }
            )
            .environmentObject(pilotoRepo)
        }
    }

    private var carroIdInferido: String? {
        // Pendência 3 — agora prefere o carroIdSelecionado do estado
        // (escolha explícita do gestor no formulário OU pré-seleção da
        // última usada). Cai pra carroInicialId (toque num card) e
        // primeiro carro do repositório como fallback antigo.
        if let cid = carroIdSelecionado,
           carroRepo.carros.contains(where: { $0.id == cid }) {
            return cid
        }
        if let cid = carroInicialId,
           carroRepo.carros.contains(where: { $0.id == cid }) {
            return cid
        }
        return carroRepo.carros.first?.id
    }

    /// Pendência 3 — popula carro+config no abrir o formulário.
    /// 1ª opção: última (carro, config) usada nesse evento.
    /// 2ª opção: carroInicialId (toque num card) + config atual desse carro.
    /// 3ª opção: deixa em branco — gestor escolhe.
    private func hidratarCarroConfigDefault() async {
        do {
            let ultimo = try await repo.ultimoCarroEConfigDoEvento(eventoId: eventoId)
            if let cid = ultimo.carroId,
               carroRepo.carros.contains(where: { $0.id == cid }) {
                carroIdSelecionado = cid
                configuracaoIdSelecionada = ultimo.configuracaoId
                return
            }
        } catch {
            // Silencioso — cai no fallback abaixo.
        }
        if let cid = carroInicialId,
           carroRepo.carros.contains(where: { $0.id == cid }) {
            carroIdSelecionado = cid
            configuracaoIdSelecionada = configuracaoRepo.ativaDoCarro(cid)?.id
        }
    }

    private var canSave: Bool {
        guard !isSaving else { return false }
        guard !objetivoTipo.isEmpty else { return false }
        guard voltasPlanejadas >= 1 else { return false }
        // MS-4.4: validação muda conforme tipo do evento
        if permiteRevezamento {
            // Endurance — precisa de pelo menos 1 turno cobrindo todas as voltas
            return !turnos.isEmpty && turnosCobremTodasVoltas
        } else {
            // Track day / treino livre — só piloto principal obrigatório
            return pilotoId != nil
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
            sectionObjetivo
            sectionVoltas
            sectionParadas
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
            // Pendência 3 — pré-seleção carro+configuração no plano.
            FormField(label: "Carro") { carroPicker }
            FormField(label: "Configuração do carro",
                      small: "motor, pneus, câmbio, aero") {
                configuracaoPicker
            }
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
            FormField(label: "Combustível abastecido", small: "opcional") {
                combustivelRow
            }
            FormField(label: "Pneu montado", small: "opcional") {
                pneuRow
            }
        }
    }

    /// Pendência 3 — picker de carro entre os carros cadastrados no time.
    /// Vem pré-marcado com o último carro usado no evento (ou o carro do
    /// card que abriu o formulário).
    private var carroPicker: some View {
        Menu {
            ForEach(carroRepo.carros, id: \.id) { c in
                Button {
                    carroIdSelecionado = c.id
                    // Quando troca de carro, a config selecionada pode
                    // não pertencer mais. Cai pra config marcada como
                    // atual do novo carro.
                    let cfgs = configuracaoRepo.paraCarro(c.id)
                    if let cfg = configuracaoIdSelecionada,
                       !cfgs.contains(where: { $0.id == cfg }) {
                        configuracaoIdSelecionada = cfgs.first(where: { $0.ativa })?.id
                            ?? cfgs.first?.id
                    } else if configuracaoIdSelecionada == nil {
                        configuracaoIdSelecionada = cfgs.first(where: { $0.ativa })?.id
                            ?? cfgs.first?.id
                    }
                } label: {
                    Text(c.apelido)
                }
            }
        } label: {
            HStack {
                Text(carroLegivel)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(carroIdSelecionado == nil ? Color.textFaint : Color.text)
                Spacer()
                Text("›")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
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

    private var carroLegivel: String {
        if let cid = carroIdSelecionado,
           let c = carroRepo.carros.first(where: { $0.id == cid }) {
            return c.apelido
        }
        return "Escolher carro"
    }

    /// Pendência 3 — picker de configuração entre as do carro selecionado.
    /// Some quando nenhum carro foi escolhido. Se o carro não tem nenhuma
    /// configuração cadastrada, mostra orientação.
    @ViewBuilder
    private var configuracaoPicker: some View {
        if let cid = carroIdSelecionado {
            let cfgs = configuracaoRepo.paraCarro(cid)
            if cfgs.isEmpty {
                Text("Esse carro não tem configuração. Cadastre uma na Garagem → carro → 'Gerenciar configurações'.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.atencao)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.surfaceRaised)
                    )
            } else {
                Menu {
                    ForEach(cfgs, id: \.id) { cfg in
                        Button { configuracaoIdSelecionada = cfg.id } label: {
                            Text(cfg.nome ?? cfg.resumoLegivel)
                        }
                    }
                } label: {
                    HStack {
                        Text(configuracaoLegivel(cfgs: cfgs))
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(configuracaoIdSelecionada == nil ? Color.textFaint : Color.text)
                        Spacer()
                        Text("›")
                            .font(.system(size: 14, weight: .regular))
                            .foregroundStyle(Color.textMuted)
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
        } else {
            Text("Escolha um carro primeiro.")
                .font(.system(size: 12))
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
        }
    }

    private func configuracaoLegivel(cfgs: [Configuracao]) -> String {
        if let cid = configuracaoIdSelecionada,
           let cfg = cfgs.first(where: { $0.id == cid }) {
            return cfg.nome ?? cfg.resumoLegivel
        }
        return "Escolher configuração"
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
        Button(action: { sheet = .convidadoPicker }) {
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
        .buttonStyle(.plain)
    }

    private var convidadoNomeAtual: String? {
        guard let id = convidadoId else { return nil }
        return repo.pilotos.first(where: { $0.id == id })?.nome
    }

    // MARK: - Combustível abastecido (só o tipo — sem campo de litros)
    //
    // 2026-05-16 (Flávio): "A gente só usa litros, só precisa colocar o
    // tipo de combustível mesmo." Tirei o campo de quantidade. Mantemos
    // o estado interno `qtCombustivelTexto` vazio — o sanitizarLitros e
    // o gravar do stint seguem funcionando, simplesmente sem litros.

    private var combustivelRow: some View {
        combustivelPickerButton
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

    private var sectionObjetivo: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHead("Objetivo")
            FormField(label: "Tipo", small: "obrigatório") {
                ObjetivoPicker(selection: $objetivoTipo)
            }
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
        Button(action: { sheet = .pilotoPicker }) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pilotoNomeAtual ?? "Escolher piloto")
                        .font(.system(size: 15, weight: .medium))
                        .tracking(-0.075)
                        .foregroundStyle(pilotoNomeAtual == nil ? Color.textFaint : Color.text)
                    if pilotoNomeAtual != nil {
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
        .buttonStyle(.plain)
    }

    private var pilotoNomeAtual: String? {
        guard let id = pilotoId else { return nil }
        return repo.pilotos.first(where: { $0.id == id })?.nome
    }

    private func hidratarPilotoDefault() {
        if pilotoId == nil {
            pilotoId = repo.pilotos.first(where: { $0.id == PilotoRepository.pilotoFlavioId })?.id
                ?? repo.pilotos.first?.id
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
        Task {
            do {
                let stintId = try await repo.create(
                    eventoId: eventoId,
                    pilotoId: pid,
                    objetivoTipo: objetivoTipo,
                    licaoFocada: licaoTitulo,
                    voltasPlanejadas: voltasPlanejadas,
                    carroId: carroIdSelecionado,
                    configuracaoId: configuracaoIdSelecionada
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
                savingError = "Não consegui salvar: \(error.localizedDescription)"
            }
        }
    }

    private func parseLitros(_ texto: String) -> Double? {
        let trimmed = texto.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        return Double(trimmed.replacingOccurrences(of: ",", with: "."))
    }
}

// MARK: - Sub-componentes

/// Picker dos 5 tipos canônicos. Visual idêntico ao CategoriaPicker do
/// CarroNovoFormView mas alimentado por `StintObjetivoTipos.canonicos`.
private struct ObjetivoPicker: View {
    @Binding var selection: String

    var body: some View {
        Menu {
            ForEach(StintObjetivoTipos.canonicos, id: \.self) { tipo in
                Button(tipo) { selection = tipo }
            }
        } label: {
            HStack {
                Text(selection)
                    .font(.system(size: 15, weight: .medium))
                    .tracking(-0.075)
                    .foregroundStyle(Color.text)
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
}

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
    /// 2026-05-16 Flávio: seletores de Piloto e Convidado agora usam a
    /// MESMA tela cheia dos outros seletores (PilotoPickerView), em vez
    /// dos menus suspensos antigos.
    case pilotoPicker
    case convidadoPicker

    var id: String {
        switch self {
        case .pneuPicker: return "pneu-picker"
        case .combustivelPicker: return "combustivel-picker"
        case .paradaEditor: return "parada-editor"
        case .turnoEditor: return "turno-editor"
        case .pilotoPicker: return "piloto-picker"
        case .convidadoPicker: return "convidado-picker"
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
