// ═══════════════════════════════════════════════════════════
// CockpitCloudCoordinator — Bloco 4 do Plano Piloto + Engenheiro
// 2026-05-18.
// ═══════════════════════════════════════════════════════════
// Costura o detector de trecho → cliente HTTP → painel JS.
//
// Fluxo:
//   1. `attach(coordinator:, binder:)` registra handlers no
//      `StintCaptureCoordinator.bridge?.detector` (segmentStart +
//      segmentEnd) e no `recorder.addSampleHandler` pra acumular
//      Samples brutos no trecho atual.
//   2. Em `segmentStart`: limpa o buffer.
//   3. Em `segmentEnd`: empacota o buffer como `[AmostraTrecho]` e,
//      se tem ao menos uma amostra com RPM real (T4000 ativo), bate
//      no `TrechoAnalisarClient`. Resposta atualiza o painel via
//      `binder.exibirAnalise(_:)`.
//
// **Modo só celular (sem T4000):** o detector segue funcionando
// (entrada/ápice/saída chegam pelo binder canônico), mas a análise
// na nuvem não é disparada — não dá pra calcular delta de aceleração
// sem RPM/pedal/marcha reais. A flag `temT4000` reporta o motivo.

import Foundation
import P1FastCore

@MainActor
final class CockpitCloudCoordinator: ObservableObject {

    // MARK: - Estado público

    @Published private(set) var ultimaAnalise: TrechoAnaliseResponse?
    @Published private(set) var ultimoErro: String?
    @Published private(set) var temT4000: Bool = false

    // MARK: - Dependências

    private let cliente: TrechoAnalisarClient?
    private let identificacao: () -> IdentificacaoTrecho?
    private let carro: () -> CarroAnaliseConfig
    private let historico: () -> [LeituraHistoricaTrecho]

    // MARK: - Estado interno

    private weak var capture: StintCaptureCoordinator?
    private weak var binder: CockpitDataBinder?
    private var segStartCancel: (() -> Void)?
    private var segEndCancel: (() -> Void)?
    private var rawCancel: (() -> Void)?

    /// Buffer de amostras do trecho atual (entre segmentStart e segmentEnd).
    private var bufferTrechoAtual: [Sample] = []
    private var trechoAtualId: String?

    init(
        cliente: TrechoAnalisarClient?,
        identificacao: @escaping () -> IdentificacaoTrecho?,
        carro: @escaping () -> CarroAnaliseConfig = { .celtaBubiPadrao },
        historico: @escaping () -> [LeituraHistoricaTrecho] = { [] }
    ) {
        self.cliente = cliente
        self.identificacao = identificacao
        self.carro = carro
        self.historico = historico
    }

    /// Liga handlers de raw + segment. Idempotente.
    func attach(coordinator: StintCaptureCoordinator, binder: CockpitDataBinder) {
        self.capture = coordinator
        self.binder = binder
        detach()

        if let recorder = coordinator.recorder {
            rawCancel = recorder.addSampleHandler { [weak self] sample in
                Task { @MainActor in
                    self?.onRawSample(sample)
                }
            }
        }
        if let detector = coordinator.bridge?.detector {
            segStartCancel = detector.onSegmentStart { [weak self] ev in
                Task { @MainActor in
                    self?.onSegmentStart(ev)
                }
            }
            segEndCancel = detector.onSegmentEnd { [weak self] ev in
                Task { @MainActor in
                    self?.onSegmentEnd(ev)
                }
            }
        }
    }

    func detach() {
        segStartCancel?(); segStartCancel = nil
        segEndCancel?(); segEndCancel = nil
        rawCancel?(); rawCancel = nil
    }

    // MARK: - Handlers

    private func onRawSample(_ s: Sample) {
        // Acumula só dentro de um trecho aberto.
        guard trechoAtualId != nil else { return }
        bufferTrechoAtual.append(s)
        if s.rpm != nil { temT4000 = true }
    }

    private func onSegmentStart(_ ev: DetectorSegmentStartEvent) {
        trechoAtualId = ev.segmentId
        bufferTrechoAtual.removeAll(keepingCapacity: true)
    }

    private func onSegmentEnd(_ ev: DetectorSegmentEndEvent) {
        let id = trechoAtualId ?? ev.segmentId
        let amostrasBruto = bufferTrechoAtual
        trechoAtualId = nil
        bufferTrechoAtual.removeAll(keepingCapacity: true)

        let amostras = empacotarAmostras(amostrasBruto)
        guard !amostras.isEmpty else { return }

        // Sem T4000 = sem RPM/pedal/marcha → não tem como analisar
        // delta de aceleração de forma honesta. Marca modo limitado
        // e segue silencioso (binder já mostra entrada/ápice/saída).
        guard amostras.contains(where: { $0.rpm > 0 }) else { return }
        guard let cliente = cliente, let ident = identificacao() else { return }

        let req = TrechoAnaliseRequest(
            trechoId: id,
            amostras: amostras,
            identificacao: ident,
            carro: carro(),
            historicoTrecho: historico()
        )
        Task { [weak self] in
            do {
                let resp = try await cliente.analisar(req)
                await MainActor.run {
                    self?.ultimaAnalise = resp
                    self?.ultimoErro = nil
                    self?.binder?.exibirAnalise(resp)
                }
            } catch {
                await MainActor.run {
                    self?.ultimoErro = String(describing: error)
                }
            }
        }
    }

    // MARK: - Empacotamento

    private func empacotarAmostras(_ samples: [Sample]) -> [AmostraTrecho] {
        guard !samples.isEmpty else { return [] }
        let tBase = samples.first!.tMono
        return samples.compactMap { s in
            // Velocidade em km/h: usa speedCan (T4000) quando existe, GPS
            // calculado pelo Kalman em outros lugares — aqui pegamos o
            // que estiver disponível no Sample bruto.
            let velKmh = (s.speedCan ?? 0) * 3.6
            return AmostraTrecho(
                t: (s.tMono - tBase) / 1000.0,
                velocidadeKmh: velKmh,
                pedalPct: s.tps ?? 0,
                rpm: s.rpm ?? 0,
                marcha: s.gear ?? 0,
                aceleracaoRealMs2: s.accLong ?? 0
            )
        }
    }
}
