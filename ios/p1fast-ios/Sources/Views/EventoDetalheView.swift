// ═══════════════════════════════════════════════════════════
// EventoDetalheView — port de mockup-evento-detalhe.html
// ═══════════════════════════════════════════════════════════
// Sprint 1A.2 — Prompt #10. Sprint 1A.3 — Prompt #11 acoplou os
// fluxos `StintModalView` (CTA "Novo stint") e `PosStintView`
// (tap em stint card real → finalize + recap).
//
// Composição (1:1 com mockup):
//   - topbar: "‹ Eventos" (back) à esquerda + "Editar" à direita
//   - event-head: eyebrow "Evento" + título grande (28pt) + sub
//     "Sábado · 25/04 · Nelson Piquet"
//   - summary card 4-cells: Stints / Voltas / Melhor (em ouro) / Pronto%
//   - group__head "Stints" + contagem
//   - lista de stint cards (numerador 42x42 + título + sub + tags)
//   - CTA inline dashed "+ Novo stint"
//
// Dados:
//   - Eventos seedados (`evt-mock-*`) renderizam stints do
//     `EventoMockSummary` — somente leitura, atalho do PR #10.
//   - Eventos criados pelo usuário renderizam `StintRepository
//     .stintsPorEvento` (real, GRDB). Tap abre PosStintView; se
//     stint ainda está ativo, repo.finalize() roda antes pra
//     gerar voltas (gerador determinístico — Sprint 1B troca pelo
//     dado real do cockpit).

import SwiftUI
import P1FastCore

struct EventoDetalheView: View {
    @EnvironmentObject private var repo: EventoRepository
    @EnvironmentObject private var stintRepo: StintRepository
    @EnvironmentObject private var carroRepo: CarroRepository
    @EnvironmentObject private var pneuRepo: PneuRepository
    @EnvironmentObject private var combustivelRepo: CombustivelRepository
    @EnvironmentObject private var pendenciaRepo: PendenciaRepository
    @EnvironmentObject private var voltaVideoRepo: VoltaVideoRepository
    @EnvironmentObject private var acaoFazerRepo: AcaoFazerRepository
    @EnvironmentObject private var eventoPneuRepo: EventoPneuRepository
    @EnvironmentObject private var setupReplicadoRepo: EventoSetupReplicadoRepository
    @EnvironmentObject private var configuracaoRepo: ConfiguracaoRepository
    let eventoId: String
    let onClose: () -> Void

    @State private var sheet: EventoDetalheSheet?
    /// 2026-05-20 (Flávio): o stint rodando é apresentado como tela cheia
    /// (fullScreenCover) e não como modal (sheet), pra permitir a rotação
    /// livre do iPhone (vertical = dados, horizontal = cockpit). Sheets do
    /// iOS travam orientação mesmo com o lock global liberado.
    @State private var stintRodandoFullScreen: StintRodandoToken?
    @State private var finalizingStintId: String?
    // S8 #18: histórico do piloto na pista por carro (evento futuro).
    @State private var historicoCarros: [EventoRepository.CarroPistaResumo] = []
    @State private var historicoCarregando = true
    // S8 #22: ações a fazer — texto sendo digitado pra adicionar.
    @State private var novaAcaoTexto: String = ""
    // Rodada 1 fim (2026-05-16): dias do evento + dia selecionado nas abas.
    @State private var dias: [EventoDia] = []
    @State private var diaSelecionadoId: String?

    /// Evento "passado" — data anterior ao dia de hoje (decisão Flávio
    /// rodada 1, escolha "Data anterior ao dia de hoje"). Passado é só
    /// histórico — esconde botões de mutação (Novo stint, Editar).
    private var isEventoPassado: Bool {
        guard let ms = repo.find(id: eventoId)?.evento.dataEvento else { return false }
        let dataEvento = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
        let inicioDeHoje = Calendar(identifier: .gregorian).startOfDay(for: Date())
        return dataEvento < inicioDeHoje
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface.ignoresSafeArea()

            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, 4)
                    .padding(.bottom, 140) // espaço pro menu de baixo
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .preferredColorScheme(.dark)
        // 2026-05-16 Flávio "em cima é pra voltar, sempre": cabeçalho
        // duplicado (setinha customizada + Editar customizado) removido.
        // A setinha de voltar passa a vir do sistema (NavigationStack do
        // root) — fica sempre no topo à esquerda, alinhada com o botão
        // Editar quando ele existir.
        .navigationBarBackButtonHidden(false)
        .toolbarBackground(Color.surface, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task {
            EventoDetalheView.gravaDiag("abriu eventoId=\(eventoId)")
            EventoDetalheView.gravaDiag("repo.find -> \(repo.find(id: eventoId) == nil ? "NIL" : "OK")")
            await loadStintsReais()
            EventoDetalheView.gravaDiag("loadStintsReais OK")
            await loadHistoricoSeFuturo()
            EventoDetalheView.gravaDiag("loadHistoricoSeFuturo OK")
            await loadDias()
            EventoDetalheView.gravaDiag("loadDias OK — \(dias.count) dias")
        }
        .sheet(item: $sheet, onDismiss: {
            // Recarrega após criar/encerrar stint.
            Task { await loadStintsReais() }
        }) { which in
            sheetView(for: which)
        }
        // 2026-05-21 (Flávio): stint roda em tela cheia que alterna pela
        // rotação — vertical mostra dados/aplicativo, horizontal mostra
        // cockpit. Sheets do iOS travam orientação, então o stint precisa
        // entrar via fullScreenCover.
        .fullScreenCover(item: $stintRodandoFullScreen, onDismiss: {
            Task { await loadStintsReais() }
        }) { token in
            if let ev = repo.find(id: eventoId) {
                StintRodandoView(
                    stintId: token.stintId,
                    contextoLinha: contextoStintModal(ev: ev),
                    onFinalized: { id in
                        stintRodandoFullScreen = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            sheet = .triagemVideo(stintId: id)
                        }
                    },
                    onCancel: { stintRodandoFullScreen = nil }
                )
                .environmentObject(stintRepo)
            } else {
                EmptyView()
            }
        }
    }

    @ViewBuilder
    private func sheetView(for which: EventoDetalheSheet) -> some View {
        switch which {
        case .novoStint:
            if let ev = repo.find(id: eventoId) {
                StintModalView(
                    eventoId: eventoId,
                    proximoNumero: stintRepo.stintsPorEvento.count + 1,
                    contextoLinha: contextoStintModal(ev: ev),
                    onCancel: { sheet = nil },
                    // MS-2.5 wire: stint criado entra direto na captura
                    // ao vivo (StintCaptureView arma o coordinator). Antes
                    // disso o modal só fechava — finalize nunca recebia
                    // segmentEvents na prática.
                    onCreated: { stintId in
                        // 2026-05-16 Flávio: depois do plano, passa pela tela
                        // "Pronto pra começar" com START. Lá ele escolhe vista
                        // de dados ou cockpit.
                        sheet = .readyStint(stintId: stintId)
                    }
                )
                .environmentObject(stintRepo)
                .environmentObject(carroRepo)
                .environmentObject(pneuRepo)
                .environmentObject(combustivelRepo)
            } else {
                EmptyView()
            }
        case .novoStintComCarro(let carroId):
            if let ev = repo.find(id: eventoId) {
                StintModalView(
                    eventoId: eventoId,
                    proximoNumero: stintRepo.stintsPorEvento.count + 1,
                    contextoLinha: contextoStintModal(ev: ev),
                    carroInicialId: carroId,
                    onCancel: { sheet = nil },
                    onCreated: { stintId in
                        // 2026-05-16 Flávio: depois do plano, passa pela tela
                        // "Pronto pra começar" com START. Lá ele escolhe vista
                        // de dados ou cockpit.
                        sheet = .readyStint(stintId: stintId)
                    }
                )
                .environmentObject(stintRepo)
                .environmentObject(carroRepo)
                .environmentObject(pneuRepo)
                .environmentObject(combustivelRepo)
            } else {
                EmptyView()
            }
        case .readyStint(let stintId):
            // 2026-05-16 Flávio: tela intermediária. Stint já está criado;
            // captura ainda não foi iniciada. Aqui o gestor escolhe a vista
            // e toca START — só então `coordinator.start(...)` roda dentro
            // da próxima view (StintCaptureView ou StintCockpitView).
            if let ev = repo.find(id: eventoId) {
                let stint = stintRepo.find(stintId: stintId)
                StintReadyView(
                    stintNumero: stintRepo.stintsPorEvento.count,
                    contextoLinha: contextoStintModal(ev: ev),
                    onStart: { modo in
                        switch modo {
                        case .dados:
                            // Tela de dados — fica fixa em vertical via sheet.
                            sheet = .captureAtivo(stintId: stintId)
                        case .cockpit:
                            // 2026-05-21 v3 (Flávio): sequência sem piscada
                            // E garantindo que abre no cockpit, não nos dados.
                            // 1. Força landscape AGORA (iOS começa a rotacionar)
                            // 2. Fecha sheet sem animar
                            // 3. Espera 250ms pro iOS aplicar a rotação inicial
                            // 4. Abre fullScreenCover (já em landscape; o
                            //    StintRodandoView faz polling pra confirmar)
                            OrientationLock.set(.landscape)
                            var noAnim = Transaction()
                            noAnim.disablesAnimations = true
                            withTransaction(noAnim) {
                                sheet = nil
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                OrientationLock.set(.landscape)
                                var noAnim2 = Transaction()
                                noAnim2.disablesAnimations = true
                                withTransaction(noAnim2) {
                                    stintRodandoFullScreen = StintRodandoToken(stintId: stintId)
                                }
                            }
                        }
                    },
                    onCancel: { sheet = nil },
                    stintId: stintId,
                    carroIdDoStint: stint?.sessao.carroId,
                    configuracaoIdDoStint: stint?.sessao.configuracaoId,
                    onTrocarConfiguracao: { novoCfgId in
                        Task {
                            try? await stintRepo.setConfiguracao(
                                stintId: stintId, configuracaoId: novoCfgId
                            )
                        }
                    }
                )
                .environmentObject(configuracaoRepo)
            } else {
                EmptyView()
            }
        case .captureAtivo(let stintId):
            if let ev = repo.find(id: eventoId) {
                StintCaptureView(
                    stintId: stintId,
                    contextoLinha: contextoStintModal(ev: ev),
                    onFinalized: { id in
                        // F4-glue: passo intermediário pra triagem do vídeo.
                        // Se não houver gravação Daily.co OU nenhuma volta
                        // foi indexada, a TriagemVideoView mostra empty state
                        // e a pessoa avança pro PosStint normalmente.
                        sheet = .triagemVideo(stintId: id)
                    },
                    onCancel: { sheet = nil }
                )
            } else {
                EmptyView()
            }
        case .cockpitAtivo(let stintId):
            if let ev = repo.find(id: eventoId) {
                StintCockpitView(
                    stintId: stintId,
                    contextoLinha: contextoStintModal(ev: ev),
                    onFinalized: { id in
                        sheet = .triagemVideo(stintId: id)
                    },
                    onCancel: { sheet = nil }
                )
                .environmentObject(stintRepo)
            } else {
                EmptyView()
            }
        case .stintRodando(let stintId):
            // 2026-05-20 (Flávio): vista única que alterna entre
            // StintCaptureView (vertical) e StintCockpitView (horizontal)
            // pela orientação do iPhone. Substitui o switch dados/cockpit.
            if let ev = repo.find(id: eventoId) {
                StintRodandoView(
                    stintId: stintId,
                    contextoLinha: contextoStintModal(ev: ev),
                    onFinalized: { id in
                        sheet = .triagemVideo(stintId: id)
                    },
                    onCancel: { sheet = nil }
                )
                .environmentObject(stintRepo)
            } else {
                EmptyView()
            }
        case .triagemVideo(let stintId):
            if let ev = repo.find(id: eventoId) {
                TriagemVideoView(
                    sessaoId: stintId,
                    contextoLinha: contextoStintModal(ev: ev),
                    onClose: {
                        // Sempre encaminha pro PosStint depois da triagem
                        // (ou do "Pular"). PosStint é o destino final do
                        // fluxo.
                        sheet = .posStint(stintId: stintId)
                    }
                )
                .environmentObject(voltaVideoRepo)
            } else {
                EmptyView()
            }
        case .posStint(let stintId):
            if let ev = repo.find(id: eventoId) {
                PosStintView(
                    stintId: stintId,
                    contextoLinha: contextoStintModal(ev: ev),
                    onClose: { sheet = nil }
                )
                .environmentObject(stintRepo)
            } else {
                EmptyView()
            }
        case .pendencias:
            if let ev = repo.find(id: eventoId) {
                PendenciasView(
                    eventoId: eventoId,
                    eventoTitulo: contextoStintModal(ev: ev),
                    onClose: { sheet = nil }
                )
                .environmentObject(pendenciaRepo)
            } else {
                EmptyView()
            }
        }
    }

    private func contextoStintModal(ev: EventoView) -> String {
        let weekday = formatWeekdayLong(ev.evento.dataEvento)
        let dia = formatDayMonthShort(ev.evento.dataEvento)
        return "\(ev.pistaDisplay) · \(weekday.lowercased()) \(dia)"
    }

    /// Diagnóstico 2026-05-16 — grava trace em Documents/diag-evento.txt
    /// pra eu puxar pelo cabo e ver onde o sheet trava.
    static func gravaDiag(_ msg: String) {
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("diag-evento.txt")
        let linha = "[\(Date())] \(msg)\n"
        guard let data = linha.data(using: .utf8) else { return }
        if let h = try? FileHandle(forWritingTo: url) {
            h.seekToEndOfFile()
            h.write(data)
            try? h.close()
        } else {
            try? data.write(to: url)
        }
    }

    private func loadDias() async {
        do {
            let lista = try await repo.listDias(eventoId: eventoId)
            await MainActor.run {
                self.dias = lista
                if self.diaSelecionadoId == nil { self.diaSelecionadoId = lista.first?.id }
            }
        } catch {
            print("loadDias failed: \(error)")
        }
    }

    private func loadStintsReais() async {
        do { try await stintRepo.loadByEvento(eventoId: eventoId) } catch {
            print("loadByEvento failed: \(error)")
        }
        // S8 #22 + #23: carrega ações a fazer e pneus do evento.
        do { try await acaoFazerRepo.loadPendentes(eventoId: eventoId) } catch {
            print("acaoFazerRepo.loadPendentes failed: \(error)")
        }
        do { try await eventoPneuRepo.load(eventoId: eventoId) } catch {
            print("eventoPneuRepo.load failed: \(error)")
        }
        // S7 #17: carrega setups replicados de voltas passadas.
        do { try await setupReplicadoRepo.load(eventoId: eventoId) } catch {
            print("setupReplicadoRepo.load failed: \(error)")
        }
    }

    /// S8 #18 — carrega histórico do piloto na pista por carro. Só roda
    /// quando o evento ainda não passou e tem track_id; senão fica vazio.
    private func loadHistoricoSeFuturo() async {
        guard !isEventoPassado,
              let trackId = repo.find(id: eventoId)?.evento.trackId else {
            historicoCarregando = false
            return
        }
        do {
            historicoCarros = try await repo.loadHistoricoPilotoNaPista(trackId: trackId)
        } catch {
            print("loadHistoricoPilotoNaPista failed: \(error)")
        }
        historicoCarregando = false
    }

    private func abrirStintReal(_ stint: Stint) {
        // Se ainda está ativo, finalizamos antes (gerador determinístico
        // mockado — Sprint 1B troca pelo dado real). Atalho do MVP pra
        // poder visualizar o PosStint sem cockpit ao vivo.
        if stint.isAtivo {
            finalizingStintId = stint.id
            Task {
                _ = try? await stintRepo.finalize(stintId: stint.id)
                finalizingStintId = nil
                sheet = .posStint(stintId: stint.id)
            }
        } else {
            sheet = .posStint(stintId: stint.id)
        }
    }

    @ViewBuilder
    private var content: some View {
        if let ev = repo.find(id: eventoId) {
            VStack(alignment: .leading, spacing: 0) {
                eventHead(ev: ev)
                    .padding(.top, 14)
                // S5 #10: evento passado ganha resumo expandido (5 stats).
                // Evento futuro mantém o summary card 4-cells.
                if isEventoPassado {
                    resumoEventoPassadoCard(ev: ev)
                        .padding(.top, 18)
                } else {
                    summaryCard(ev: ev)
                        .padding(.top, 18)
                }
                // 2026-05-16 (Flávio): dias do evento aparecem LOGO DEPOIS
                // do cockpit (cards de estatística), tanto pra evento de 1
                // dia quanto pra eventos com vários dias. Quando tem mais
                // de um dia, viram abas pra filtrar; com 1 dia, é só uma
                // pílula com a data.
                if !dias.isEmpty {
                    diasAbas
                        .padding(.top, 18)
                }
                // 2026-05-16 (Flávio): botão "Novo stint" sobe pra logo
                // abaixo do dia da pista (era no fim, junto da lista de
                // stints). Escondido em evento passado.
                if !isEventoPassado {
                    AddStintCTA(onTap: { sheet = .novoStint })
                        .padding(.top, 12)
                        .padding(.horizontal, Spacing.xs)
                }
                // S8 #18: histórico do piloto na pista por carro,
                // visível só em evento FUTURO.
                if !isEventoPassado, let trackId = ev.evento.trackId {
                    historicoPistaSection(trackId: trackId)
                        .padding(.top, 18)
                }
                pendenciasSection
                    .padding(.top, 18)
                // S5 #9: histórico de pendências (concluídas × não concluídas)
                // visível em evento passado.
                if isEventoPassado, let inst = pendenciaRepo.instanciasPorEvento[eventoId], !inst.isEmpty {
                    historicoPendenciasSection(instancias: inst)
                        .padding(.top, 18)
                }
                // S8 #22 e #23 — só em evento futuro (planejamento).
                if !isEventoPassado {
                    acoesFazerSection
                        .padding(.top, 18)
                    pneusEventoSection
                        .padding(.top, 18)
                    // S7 #17 — Setups replicados de voltas passadas.
                    setupsReplicadosSection
                        .padding(.top, 18)
                }
                stintsSection(ev: ev)
                    .padding(.top, 18)
            }
        } else {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Text("Evento não encontrado.")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.top, Spacing.lg)
            }
        }
    }

    // MARK: - Seção pendências (CTA pra abrir o checklist completo)

    /// #24 — Contagem de pendências do evento (abertas × resolvidas).
    /// Lê o estado atual do PendenciaRepository (que carrega assíncrono
    /// no bootstrap). Quando ainda não carregou, retorna 0/0 e o sub-text
    /// fica "Carregando…".
    private var pendenciasContagem: (abertas: Int, resolvidas: Int)? {
        let instancias = pendenciaRepo.instanciasPorEvento[eventoId]
        guard let instancias = instancias else { return nil }
        let resolvidas = instancias.filter { $0.checado }.count
        let abertas = instancias.count - resolvidas
        return (abertas, resolvidas)
    }

    private var pendenciasSection: some View {
        Button {
            sheet = .pendencias
        } label: {
            HStack(alignment: .center, spacing: Spacing.sm) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Pendências")
                        .font(.system(size: 13, weight: .semibold))
                        .tracking(0.06 * 13)
                        .foregroundStyle(Color.text)
                    // #24 — Contadores no lugar do texto fixo antigo.
                    if let c = pendenciasContagem {
                        Text("\(c.abertas) abertas · \(c.resolvidas) resolvidas")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(c.abertas > 0 ? Color.accent : Color.textMuted)
                    } else {
                        Text("Carregando…")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(Color.textMuted)
                    }
                }
                Spacer(minLength: 0)
                // #24 — Removida palavra "Ver". Só a setinha (›) decorativa.
                Text("›")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle()) // #24 — garante linha inteira clicável
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

    // MARK: - Topbar

    private var topbar: some View {
        HStack {
            Button(action: onClose) {
                Text("‹ Eventos")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.plain)
            Spacer()
            // #16 — Botão "Editar" escondido em evento passado (histórico só).
            if !isEventoPassado {
                Button(action: { /* Edit fica pro Sprint 1A.3 */ }) {
                    Text("Editar")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Header

    private func eventHead(ev: EventoView) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: "Evento")
            Text(ev.pistaDisplay)
                .font(.system(size: 28, weight: .semibold))
                .tracking(-0.7) // -0.025em em 28pt
                .foregroundStyle(Color.text)
            Text(formatPeriodoLongoPiquet(inicioMs: ev.evento.dataEvento, fimMs: ev.evento.dataFim, layoutShort: ev.pistaLayoutShort))
                .font(.system(size: 14, weight: .regular))
                .monospacedDigit()
                .foregroundStyle(Color.textMuted)
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.bottom, 4)
    }

    // MARK: - Setups replicados (S7 #17, rodada 1)

    /// S7 #17 — Mostra os snapshots de setup copiados de voltas passadas
    /// neste evento futuro. Mais recente primeiro. Em conflito (mais de 1
    /// replicação), todos aparecem ordenados; o mecânico decide qual
    /// considerar. Recomendação P3 #17: "último vence + banner explicativo"
    /// — UI mostra todas + indicador visual no mais recente.
    @ViewBuilder
    private var setupsReplicadosSection: some View {
        let replicados = setupReplicadoRepo.replicadosPorEvento[eventoId] ?? []
        VStack(alignment: .leading, spacing: 14) {
            Text("Setup replicado de eventos passados")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)

            if replicados.isEmpty {
                Text("Nenhum setup replicado pra este evento ainda. Replicação acontece abrindo uma volta de evento passado e tocando em 'Replicar essa configuração'.")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, 4)
            } else {
                if replicados.count > 1 {
                    Text("Mais de uma replicação foi feita pra esse evento. A mais recente está no topo — use ela como referência principal.")
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Color.atencao)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .fill(Color.atencao.opacity(0.08))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .stroke(Color.atencao.opacity(0.45), lineWidth: 1)
                        )
                }
                VStack(spacing: 8) {
                    ForEach(Array(replicados.enumerated()), id: \.element.id) { idx, rep in
                        replicadoLinha(rep: rep, isMaisRecente: idx == 0)
                    }
                }
            }
        }
    }

    private func replicadoLinha(rep: EventoSetupReplicado, isMaisRecente: Bool) -> some View {
        let carroNome: String = {
            guard let cId = rep.carroId,
                  let c = carroRepo.carros.first(where: { $0.id == cId }) else { return "Carro removido" }
            return c.apelido
        }()
        let origemNome: String = {
            guard let origemEv = rep.origemEventoId,
                  let ev = repo.find(id: origemEv) else { return "Evento anterior" }
            return ev.pistaDisplay
        }()
        return HStack(alignment: .center, spacing: 10) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(isMaisRecente ? Color.accent : Color.textMuted)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(carroNome)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.text)
                    if isMaisRecente {
                        EventTag(text: "Mais recente", kind: .accent)
                    }
                }
                Text("De: \(origemNome) · \(formatDataCurta(ms: rep.createdAt))")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                if let overrides = rep.overridesJson, !overrides.isEmpty {
                    Text("Setup salvo (\(overrides.count) caracteres)")
                        .font(.system(size: 10, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                } else {
                    Text("Sem detalhes de setup salvos.")
                        .font(.system(size: 10, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
            }
            Spacer(minLength: 0)
            Button(action: {
                Task { try? await setupReplicadoRepo.remover(rep.id, eventoId: eventoId) }
            }) {
                Image(systemName: "xmark.circle")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(isMaisRecente ? Color.accentDim.opacity(0.10) : Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(isMaisRecente ? Color.accent.opacity(0.45) : Color.border, lineWidth: 1)
        )
    }

    // MARK: - Ações a fazer (S8 #22, rodada 1)

    /// S8 #22 — Lista pessoal livre. Mostrado só em evento futuro.
    /// "Some na próxima abertura" (P3 #22): UI filtra `feita_em IS NULL`
    /// no Repository — checkmark NÃO esconde imediatamente, só some quando
    /// loadPendentes() rodar de novo (próxima abertura do evento).
    private var acoesFazerSection: some View {
        let acoes = acaoFazerRepo.pendentesPorEvento[eventoId] ?? []
        return VStack(alignment: .leading, spacing: 14) {
            Text("Ações a fazer")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)

            // Adicionar nova ação
            HStack(spacing: 8) {
                TextField("Anote uma ação livre", text: $novaAcaoTexto,
                          prompt: Text("Anote uma ação livre").foregroundStyle(Color.textFaint))
                    .textFieldStyle(.plain)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.text)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.surfaceRaised)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(Color.border, lineWidth: 1)
                    )
                Button(action: adicionarAcao) {
                    Text("Adicionar")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(novaAcaoTexto.trimmingCharacters(in: .whitespaces).isEmpty ? Color.textFaint : Color.accent)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                                .stroke(Color.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .disabled(novaAcaoTexto.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            if acoes.isEmpty {
                Text("Nada anotado por enquanto. Vai anotando coisas que precisa fazer fora das pendências oficiais.")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, 4)
            } else {
                VStack(spacing: 6) {
                    ForEach(acoes, id: \.id) { acao in
                        acaoLinha(acao: acao)
                    }
                }
            }
        }
    }

    private func acaoLinha(acao: AcaoAFazer) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Button(action: { Task { try? await acaoFazerRepo.marcarFeita(acao.id, eventoId: eventoId) } }) {
                Image(systemName: "circle")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Color.textFaint)
            }
            .buttonStyle(.plain)
            Text(acao.descricao)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.text)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 10)
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

    private func adicionarAcao() {
        let texto = novaAcaoTexto.trimmingCharacters(in: .whitespaces)
        guard !texto.isEmpty else { return }
        Task {
            do {
                try await acaoFazerRepo.adicionar(eventoId: eventoId, descricao: texto)
                novaAcaoTexto = ""
            } catch {
                print("acaoFazerRepo.adicionar failed: \(error)")
            }
        }
    }

    // MARK: - Pneus do evento (S8 #23, rodada 1)

    /// S8 #23 — Lista pneus alocados ao evento. UI mínima nesta entrega:
    /// mostra os pneus já vinculados (carro_id + número de série + composto).
    /// Vínculo de novos pneus vai entrar pela tela de pneus do carro em
    /// sprint futura — fluxo "marcar pneu como destinado a evento X".
    /// Estrutura preparada pra receber TPMS (campos pressao_atual + temp).
    private var pneusEventoSection: some View {
        let pneusEvento = eventoPneuRepo.pneusPorEvento[eventoId] ?? []
        return VStack(alignment: .leading, spacing: 14) {
            Text("Pneus do evento")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)

            if pneusEvento.isEmpty {
                Text("Nenhum pneu vinculado a este evento ainda. Cadastre pneus na tela do carro e marque pra evento na próxima sprint.")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, 4)
            } else {
                VStack(spacing: 6) {
                    ForEach(pneusEvento, id: \.id) { ep in
                        pneuEventoLinha(eventoPneu: ep)
                    }
                }
            }
        }
    }

    private func pneuEventoLinha(eventoPneu: EventoPneu) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: "circle.grid.cross.fill")
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(Color.textMuted)
            VStack(alignment: .leading, spacing: 2) {
                Text("Pneu vinculado")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.text)
                Text("ID interno: \(String(eventoPneu.pneuId.prefix(8)))…")
                    .font(.system(size: 10, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
            Spacer(minLength: 0)
            if let p = eventoPneu.pressaoAtualPsi {
                Text(String(format: "%.0f psi", p))
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
            if let t = eventoPneu.temperaturaAtualC {
                Text(String(format: "%.0f°C", t))
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Color.textFaint)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 10)
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

    // MARK: - Histórico do piloto na pista (S8 #18, rodada 1)

    /// S8 #18 — Mostra, em evento futuro, como o piloto se sai naquela
    /// pista com cada carro do time. Carros que nunca correram ali
    /// caem como "Primeira vez nesse autódromo" (P3 #18).
    @ViewBuilder
    private func historicoPistaSection(trackId: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Seu histórico nessa pista")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)

            if historicoCarregando {
                Text("Carregando histórico…")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.surfaceRaised)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(Color.border, lineWidth: 1)
                    )
            } else if historicoCarros.isEmpty {
                Text("Nenhum carro cadastrado pra cruzar com este evento.")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textFaint)
                    .padding(.horizontal, 4)
            } else {
                VStack(spacing: 8) {
                    ForEach(historicoCarros) { item in
                        // 2026-05-16 Flávio: tocar no carro = "esse carro
                        // vai pra pista", abre o planejamento do stint
                        // com o carro já escolhido. Esconde o gesto em
                        // evento passado (histórico só).
                        if isEventoPassado {
                            historicoLinhaCarro(item: item)
                        } else {
                            Button {
                                sheet = .novoStintComCarro(carroId: item.carroId)
                            } label: {
                                historicoLinhaCarro(item: item)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func historicoLinhaCarro(item: EventoRepository.CarroPistaResumo) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.carroApelido)
                    .font(.system(size: 15, weight: .semibold))
                    .tracking(-0.075)
                    .foregroundStyle(Color.text)
                Spacer()
                if item.melhorVoltaMs == nil {
                    EventTag(text: "Primeira vez", kind: .accent)
                }
            }
            if let melhor = item.melhorVoltaMs {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("Melhor:")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                    Text(formatTempoMs(melhor))
                        .font(.system(size: 16, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Color.ouro)
                    if let quando = item.melhorVoltaQuandoMs {
                        Text("· \(formatDataCurta(ms: quando))")
                            .font(.system(size: 11, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    }
                    Spacer()
                }
                HStack(spacing: 12) {
                    Text("\(item.voltasValidas) volta\(item.voltasValidas == 1 ? "" : "s") aqui")
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                    if let vmax = item.vmaxKmh, vmax > 0 {
                        Text("· vel. máx. \(Int(vmax.rounded())) km/h")
                            .font(.system(size: 11, weight: .regular))
                            .foregroundStyle(Color.textFaint)
                    }
                    Spacer()
                }
            } else {
                Text("Você ainda não correu nessa pista com esse carro.")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color.textMuted)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .fill(item.melhorVoltaMs == nil ? Color.surfaceRaised.opacity(0.6) : Color.surfaceRaised)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.border, lineWidth: 1)
        )
    }

    private func formatDataCurta(ms: Int64) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "dd/MM/yy"
        return f.string(from: date)
    }

    // MARK: - Resumo do evento passado (S5 rodada 1)

    /// S5 #10 — Quadro de resultados visíveis SÓ em evento passado:
    /// melhor volta + total voltas + total stints + velocidade máxima + km
    /// rodada (estimada). Mantém o estilo visual do summary 4-cells
    /// (Spacing.md + Radius.md + surfaceRaised), só com 5 colunas em
    /// vez de 4 e ordem priorizando o ouro da melhor volta.
    private func resumoEventoPassadoCard(ev: EventoView) -> some View {
        let s = summaryFor(ev)
        return VStack(alignment: .leading, spacing: 10) {
            Text("Resumo do evento")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)
            HStack(spacing: 6) {
                statCell(value: s.melhorVoltaCurto ?? "—", label: "Melhor", isOuro: true)
                statCell(value: "\(s.voltas)", label: "Voltas", isOuro: false)
                statCell(value: "\(s.stints)", label: "Stints", isOuro: false)
                statCell(value: formatVmax(s.vmaxKmh), label: "Vel. máx.", isOuro: false)
                statCell(value: formatKm(s.kmTotal), label: "km rodada", isOuro: false)
            }
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

    private func formatVmax(_ kmh: Double?) -> String {
        guard let kmh = kmh, kmh > 0 else { return "—" }
        return String(format: "%.0f km/h", kmh)
    }

    private func formatKm(_ km: Double?) -> String {
        guard let km = km, km > 0 else { return "—" }
        return String(format: "%.0f km", km)
    }

    // MARK: - Histórico de pendências (S5 rodada 1)

    /// S5 #9 — Em evento passado, mostra as pendências feitas e as não
    /// feitas em 2 sub-listas inline. Recomendação P3 aplicada (#9: mostra
    /// em futuros + passados — implementação prioriza passado, futuro fica
    /// no fluxo de pendências aberto pelo botão da seção #24).
    private func historicoPendenciasSection(instancias: [EventoPendencia]) -> some View {
        let concluidas = instancias.filter { $0.checado }
        let naoConcluidas = instancias.filter { !$0.checado }
        return VStack(alignment: .leading, spacing: 14) {
            Text("Histórico de pendências")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.06 * 11)
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)

            if !concluidas.isEmpty {
                historicoBloco(
                    titulo: "Concluídas",
                    contagem: concluidas.count,
                    cor: Color.bom,
                    instancias: concluidas
                )
            }
            if !naoConcluidas.isEmpty {
                historicoBloco(
                    titulo: "Não concluídas",
                    contagem: naoConcluidas.count,
                    cor: Color.atencao,
                    instancias: naoConcluidas
                )
            }
        }
    }

    private func historicoBloco(titulo: String, contagem: Int, cor: Color, instancias: [EventoPendencia]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Circle().fill(cor).frame(width: 6, height: 6)
                Text(titulo)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.text)
                Text("\(contagem)")
                    .font(.system(size: 12, weight: .regular))
                    .monospacedDigit()
                    .foregroundStyle(Color.textFaint)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 4)

            VStack(spacing: 6) {
                ForEach(instancias, id: \.id) { inst in
                    historicoLinha(inst: inst, cor: cor)
                }
            }
        }
    }

    private func historicoLinha(inst: EventoPendencia, cor: Color) -> some View {
        let nome = pendenciaRepo.nomeTemplate(inst.templateId) ?? inst.templateId
        return HStack(alignment: .center, spacing: 10) {
            Image(systemName: inst.checado ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(inst.checado ? cor : Color.textFaint)
            VStack(alignment: .leading, spacing: 2) {
                Text(nome)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(inst.checado ? Color.textMuted : Color.text)
                    .strikethrough(inst.checado, color: Color.textFaint)
                if let nota = inst.nota?.trimmingCharacters(in: .whitespaces), !nota.isEmpty {
                    Text(nota)
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Color.textFaint)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 10)
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

    // MARK: - Summary 4-stats

    private func summaryCard(ev: EventoView) -> some View {
        let s = summaryFor(ev)
        return HStack(spacing: 8) {
            statCell(value: "\(s.stints)", label: "Stints", isOuro: false)
            statCell(value: "\(s.voltas)", label: "Voltas", isOuro: false)
            statCell(value: s.melhorVoltaCurto ?? "—", label: "Melhor", isOuro: true)
            statCell(value: "\(s.pctPronto)%", label: "Pronto", isOuro: false)
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

    private func statCell(value: String, label: String, isOuro: Bool) -> some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 18, weight: .semibold))
                .monospacedDigit()
                .tracking(-0.36) // -0.02em em 18pt
                .foregroundStyle(isOuro ? Color.ouro : Color.text)
                .lineLimit(1)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .medium))
                .tracking(0.6) // 0.06em em 10pt
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.surfaceHover)
        )
    }

    // MARK: - Abas por dia (rodada 1 fim, 2026-05-16)

    private var diasAbas: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(dias, id: \.id) { dia in
                    Button {
                        diaSelecionadoId = dia.id
                    } label: {
                        Text(rotuloAba(dia))
                            .font(.system(size: 13, weight: .semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                RoundedRectangle(cornerRadius: 999, style: .continuous)
                                    .fill(diaSelecionadoId == dia.id ? Color.accent : Color.surfaceRaised)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 999, style: .continuous)
                                    .stroke(diaSelecionadoId == dia.id ? Color.accent : Color.border, lineWidth: 1)
                            )
                            .foregroundStyle(diaSelecionadoId == dia.id ? Color.onAccent : Color.text)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Spacing.xs)
        }
    }

    /// Rótulo curto da aba: usa o rótulo do dia se preenchido, senão
    /// "Dia de pista DD" (decisão P2 — número do dia do mês).
    private func rotuloAba(_ dia: EventoDia) -> String {
        if let r = dia.rotulo, !r.trimmingCharacters(in: .whitespaces).isEmpty {
            return r
        }
        let date = Date(timeIntervalSince1970: TimeInterval(dia.dataDia) / 1000)
        let cal = Calendar(identifier: .iso8601)
        let dd = cal.component(.day, from: date)
        return "Dia de pista \(dd)"
    }

    // MARK: - Stints

    private func stintsSection(ev: EventoView) -> some View {
        let mocks = stintsFor(ev)
        let reaisAll = stintRepo.stintsPorEvento
        // Filtra por dia selecionado quando há múltiplos dias. Stints sem
        // evento_dia_id (legado ou criados antes da feature) aparecem em
        // qualquer aba pra não sumir da UI. Quando StintModal passar a
        // gravar evento_dia_id corretamente, essa cláusula vira `== diaId`.
        let reais: [Stint]
        if dias.count > 1, let diaId = diaSelecionadoId {
            reais = reaisAll.filter { $0.sessao.eventoDiaId == diaId || $0.sessao.eventoDiaId == nil }
        } else {
            reais = reaisAll
        }
        let totalCount = reais.isEmpty ? mocks.count : reais.count
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Stints")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.32) // 0.12em em 11pt
                    .foregroundStyle(Color.textFaint)
                Spacer()
                Text("\(totalCount)")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.accent)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.bottom, 10)

            VStack(spacing: 8) {
                if !reais.isEmpty {
                    // Eventos criados pelo usuário — stints reais do GRDB.
                    ForEach(reais) { stint in
                        StintCardReal(
                            stint: stint,
                            isFinalizing: finalizingStintId == stint.id,
                            onTap: { abrirStintReal(stint) },
                            onCancel: (stint.podeCancelar && podeEditarStint(stint)) ? {
                                Task {
                                    try? await stintRepo.cancel(stintId: stint.id)
                                    await loadStintsReais()
                                }
                            } : nil
                        )
                    }
                } else {
                    // Eventos seedados — fallback pros mocks de design.
                    ForEach(mocks) { stint in
                        StintCardMock(stint: stint)
                    }
                }
                // 2026-05-16 Flávio: o botão "Novo stint" foi promovido pra
                // logo abaixo do cabeçalho (depois dos cards de estatística
                // e do dia da pista). Aqui na lista de stints ele não aparece
                // mais — evita duplicação.
            }
        }
    }

    // MARK: - Helpers

    private struct DetalheSummary {
        let stints: Int
        let voltas: Int
        let melhorVoltaCurto: String?
        let pctPronto: Int
        /// S5 rodada 1: velocidade máxima do evento, nil quando não há dado.
        let vmaxKmh: Double?
        /// S5 rodada 1: km estimada do evento, nil quando não há dado.
        let kmTotal: Double?
    }

    private func summaryFor(_ ev: EventoView) -> DetalheSummary {
        if let mock = EventoMockSummary.canon(eventoId: ev.id) {
            return DetalheSummary(
                stints: mock.stintsCount,
                voltas: mock.voltasCount,
                melhorVoltaCurto: mock.melhorVoltaCurto(),
                pctPronto: mock.pctPronto,
                vmaxKmh: mock.vmaxKmh,
                kmTotal: mock.kmTotal
            )
        }
        let real = repo.sumarioPorEvento[ev.id]
        return DetalheSummary(
            stints: real?.stints ?? 0,
            voltas: real?.voltas ?? 0,
            melhorVoltaCurto: real.flatMap { sumario -> String? in
                guard let ms = sumario.melhorVoltaMs else { return nil }
                let minutos = ms / 60_000
                let segundos = (ms % 60_000) / 1000
                let decimo = (ms % 1000) / 100
                return String(format: "%d:%02d.%d", minutos, segundos, decimo)
            },
            pctPronto: 0,
            // S5: vmax e km de eventos reais ainda não são agregados no
            // sumarioPorEvento. Por enquanto nil — UI mostra "—". Adicionar
            // queries no EventoRepository em sprint futura.
            vmaxKmh: nil,
            kmTotal: nil
        )
    }

    private func stintsFor(_ ev: EventoView) -> [StintMock] {
        EventoMockSummary.canon(eventoId: ev.id)?.stintsDetalhados ?? []
    }

    // MS-4.6 — Permissão de editar/cancelar stint. Consume função pura
    // StintEditPermission.podeEditar (testada em PERM-01..06). Hoje,
    // sem F1 (Pessoas multi-papel), o owner do time é sempre 'admin' →
    // todo o app permite. Quando F1 chegar, papéis refinados restringem.
    private func podeEditarStint(_ stint: Stint) -> Bool {
        StintEditPermission.podeEditar(
            currentUserId: TeamContext.currentPilotoId,
            currentRole: TeamContext.currentRole,
            pilotoId: stint.sessao.pilotoId,
            pilotosRevezamento: stint.sessao.pilotosRevezamento
        )
    }
}

// MARK: - Sheet enum

/// 2026-05-20 (Flávio): identificador do stint rodando apresentado como
/// tela cheia (fullScreenCover) pra liberar rotação automática.
struct StintRodandoToken: Identifiable, Equatable {
    let stintId: String
    var id: String { stintId }
}

enum EventoDetalheSheet: Identifiable, Equatable {
    case novoStint
    /// 2026-05-16 Flávio: tocar num carro da lista "Seu histórico nessa
    /// pista" abre o planejamento do stint com aquele carro já escolhido,
    /// sem voltar a perguntar qual carro.
    case novoStintComCarro(carroId: String)
    /// 2026-05-16 Flávio: depois do "Iniciar stint" do planejamento, abre
    /// uma tela intermediária com botão START + escolha da vista (dados ou
    /// cockpit). O botão dispara captureAtivo OU cockpitAtivo conforme.
    case readyStint(stintId: String)
    case captureAtivo(stintId: String)
    case cockpitAtivo(stintId: String)
    /// 2026-05-20 (Flávio): vista única do stint — alterna por orientação
    /// do iPhone (vertical = dados, horizontal = cockpit). Substitui o uso
    /// dos dois cases acima a partir do START. Os dois cases anteriores
    /// continuam no enum por compatibilidade histórica mas não recebem mais
    /// navegação a partir do StintReadyView.
    case stintRodando(stintId: String)
    case triagemVideo(stintId: String)
    case posStint(stintId: String)
    case pendencias

    var id: String {
        switch self {
        case .novoStint: return "novo-stint"
        case .novoStintComCarro(let id): return "novo-stint-\(id)"
        case .readyStint(let id): return "ready-\(id)"
        case .captureAtivo(let id): return "capture-\(id)"
        case .cockpitAtivo(let id): return "cockpit-\(id)"
        case .stintRodando(let id): return "stint-rodando-\(id)"
        case .triagemVideo(let id): return "triagem-\(id)"
        case .posStint(let id): return "pos-\(id)"
        case .pendencias: return "pendencias"
        }
    }
}

// MARK: - StintCardMock (eventos seedados — read-only)

private struct StintCardMock: View {
    let stint: StintMock

    var body: some View {
        Button(action: { /* drill-down do mock chega no Sprint 1A.3 */ }) {
            HStack(alignment: .top, spacing: 14) {
                numCircle
                bodyBlock
                Spacer(minLength: 0)
                chev
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 14)
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

    private var numCircle: some View {
        Text("\(stint.numero)")
            .font(.system(size: 14, weight: .semibold))
            .monospacedDigit()
            .tracking(-0.28)
            .foregroundStyle(Color.text)
            .frame(width: 42, height: 42)
            .background(
                Circle()
                    .fill(Color.surfaceHover)
            )
            .overlay(
                Circle()
                    .stroke(Color.border, lineWidth: 1)
            )
    }

    private var bodyBlock: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(stint.titulo)
                .font(.system(size: 15, weight: .semibold))
                .tracking(-0.075) // -0.005em em 15pt
                .foregroundStyle(Color.text)
                .lineLimit(1)
            Text("\(stint.voltas) voltas · melhor \(formatTempoMs(stint.melhorVoltaMs))")
                .font(.system(size: 12, weight: .regular))
                .monospacedDigit()
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
            tags
                .padding(.top, 7)
        }
    }

    @ViewBuilder
    private var tags: some View {
        HStack(spacing: 6) {
            EventTag(text: stint.piloto, kind: .neutral)
            EventTag(text: stint.licao, kind: .neutral)
            if let especial = stint.tagEspecial {
                switch especial {
                case .pbDoDia:
                    EventTag(text: "PB do dia", kind: .ouro)
                case .desvioBaixo:
                    EventTag(text: "Desvio < 0.4s", kind: .bom)
                }
            }
        }
    }

    private var chev: some View {
        Text("›")
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(Color.textMuted)
            .frame(width: 24, height: 24)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.surfaceHover)
            )
            .padding(.top, 8)
    }
}

// MARK: - StintCardReal (eventos criados pelo usuário)

private struct StintCardReal: View {
    let stint: Stint
    let isFinalizing: Bool
    let onTap: () -> Void
    /// MS-4.5: opcional. Quando presente, long-press oferece "Cancelar stint".
    let onCancel: (() -> Void)?

    @State private var confirmandoCancelamento: Bool = false

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 14) {
                numCircle
                bodyBlock
                Spacer(minLength: 0)
                chev
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
            .opacity(stint.isCancelado ? 0.55 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(isFinalizing || stint.isCancelado)
        .contextMenu {
            if onCancel != nil {
                Button(role: .destructive, action: {
                    confirmandoCancelamento = true
                }) {
                    Label("Cancelar stint", systemImage: "xmark.circle")
                }
            }
        }
        .confirmationDialog(
            "Cancelar este stint?",
            isPresented: $confirmandoCancelamento,
            titleVisibility: .visible
        ) {
            Button("Cancelar stint", role: .destructive) {
                onCancel?()
            }
            Button("Voltar", role: .cancel) {}
        } message: {
            Text("O stint não some — fica marcado como cancelado no histórico.")
        }
    }

    private var backgroundColor: Color {
        if stint.isCancelado { return Color.surfaceRaised }
        if stint.isAtivo { return Color.accentDim.opacity(0.15) }
        return Color.surfaceRaised
    }

    private var borderColor: Color {
        if stint.isCancelado { return Color.border.opacity(0.6) }
        if stint.isAtivo { return Color.accent.opacity(0.55) }
        return Color.border
    }

    private var numCircle: some View {
        // Numeração do stint não é persistida no schema (sessoes não tem
        // `numero` explícito). Usamos só "•" como placeholder visual —
        // EventoDetalheView ordena por created_at e a posição na lista
        // é o que conta. Trocar por número real quando o schema ganhar.
        Text("•")
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(Color.text)
            .frame(width: 42, height: 42)
            .background(
                Circle()
                    .fill(stint.isAtivo ? Color.accent.opacity(0.18) : Color.surfaceHover)
            )
            .overlay(
                Circle()
                    .stroke(stint.isAtivo ? Color.accent.opacity(0.45) : Color.border, lineWidth: 1)
            )
    }

    private var bodyBlock: some View {
        let (tipo, licao) = stint.objetivoDecomposto
        return VStack(alignment: .leading, spacing: 3) {
            Text(tipo.isEmpty ? "Stint" : tipo)
                .font(.system(size: 15, weight: .semibold))
                .tracking(-0.075)
                .foregroundStyle(Color.text)
                .lineLimit(1)
            Text(subtitle)
                .font(.system(size: 12, weight: .regular))
                .monospacedDigit()
                .foregroundStyle(Color.textFaint)
                .lineLimit(1)
            HStack(spacing: 6) {
                if let nome = stint.pilotoNome, !nome.isEmpty {
                    EventTag(text: nome, kind: .neutral)
                }
                if !licao.isEmpty {
                    EventTag(text: licao, kind: .neutral)
                }
                if stint.isAtivo {
                    EventTag(text: isFinalizing ? "Finalizando…" : "Ativo", kind: .accent)
                }
                if stint.isCancelado {
                    EventTag(text: "Cancelado", kind: .neutral)
                }
            }
            .padding(.top, 7)
        }
    }

    private var subtitle: String {
        if stint.isAtivo {
            let plan = stint.sessao.voltasPlanejadas ?? 0
            if plan > 0 { return "\(plan) voltas planejadas · toque pra encerrar" }
            return "Stint ativo · toque pra encerrar"
        }
        let count = stint.voltasCount
        guard let melhor = stint.melhorVoltaMs else {
            return "\(count) voltas registradas"
        }
        return "\(count) voltas · melhor \(formatTempoMs(melhor))"
    }

    private var chev: some View {
        Text("›")
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(Color.textMuted)
            .frame(width: 24, height: 24)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.surfaceHover)
            )
            .padding(.top, 8)
    }
}

// MARK: - Add Stint CTA (dashed inline)

private struct AddStintCTA: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.sm) {
                Text("+")
                    .font(.system(size: 18, weight: .medium))
                Text("Novo stint")
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(-0.07) // -0.005em em 14pt
            }
            .foregroundStyle(Color.textMuted)
            .padding(.vertical, 14)
            .padding(.horizontal, Spacing.md)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(
                // 2026-05-16 Flávio "às vezes precisa clicar mais de uma
                // vez": o fundo era Color.clear, então a zona de toque
                // ficava só na linha pontilhada e no texto — buracos por
                // tudo. Trocamos por um fundo levemente opaco que cobre o
                // botão inteiro como zona de clique.
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .fill(Color.surfaceRaised.opacity(0.001))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .strokeBorder(
                        Color.border,
                        style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                    )
            )
            // Garante zona de toque na área inteira do retângulo, não só
            // no texto/borda. Sem isso o botão tinha "buracos" no centro.
            .contentShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("EventoDetalhe — 25/04 (4 stints)") {
    let queue = try! P1FastCore.DB.makeMemoryQueue()
    let repo = EventoRepository(queue: queue)
    let stintRepo = StintRepository(queue: queue)
    let carroRepo = CarroRepository(queue: queue)
    let pneuRepo = PneuRepository(queue: queue)
    let combustivelRepo = CombustivelRepository(queue: queue)
    return EventoDetalheView(eventoId: EventoRepository.seedPassado1Id, onClose: {})
        .environmentObject(repo)
        .environmentObject(stintRepo)
        .environmentObject(carroRepo)
        .environmentObject(pneuRepo)
        .environmentObject(combustivelRepo)
        .task {
            await repo.bootstrap()
            await stintRepo.bootstrap()
            await carroRepo.bootstrap()
            await pneuRepo.bootstrap()
            await combustivelRepo.bootstrap()
        }
}
