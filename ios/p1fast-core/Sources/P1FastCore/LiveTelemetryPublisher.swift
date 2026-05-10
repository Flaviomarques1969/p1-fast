// ═══════════════════════════════════════════════════════════
// LiveTelemetryPublisher — MS-2.8
// ═══════════════════════════════════════════════════════════
// Consome o stream do recorder (raw, 100 Hz IMU + 1 Hz GPS) e do
// processor Kalman (enriched, ~10 Hz) e publica em DOIS transports
// (cabo USB local + Supabase Realtime) o envelope canônico que o
// cockpit Windows espera (web/cockpit/transport.js).
//
// Cadência:
//   - iphone-imu: 1 envelope por enriched recebido (~10 Hz) DESDE QUE
//     já tenhamos um lat/lng GPS bom (espera primeira fix).
//   - heartbeat:  caller chama `sendHeartbeat()` periodicamente (1 Hz
//     em produção, via Timer no driver iOS). Mantido fora do
//     publisher pra ficar testável sem Timer real no smoke.
//
// Coordenadas:
//   O Kalman armazena xM/yM com origem na PRIMEIRA fix GPS (lat0/lng0
//   internos), não na âncora do track. Pra projetar pra viewBox,
//   usamos lat/lng do último raw GPS bom + Projector.projectToViewBox.
//   Cadência de viewBox fica 1 Hz (lim. do GPS bruto) — Kalman ainda
//   suaviza heading/speed/gap a 10 Hz.
//
// accLong/accLat:
//   Não calibrados ainda pelo recorder (LiveTelemetryRecorder.swift:11).
//   Publicamos 0.0 enquanto a calibração de frame não chega; consumidor
//   pode tratar 0.0 como "indisponível" se precisar.

import Foundation

public actor LiveTelemetryPublisher {
    // MARK: - Config

    private let transports: [any CockpitTransport]
    private let track: Track
    private let stintId: String
    private let onEvent: (@Sendable (PublisherEvent) -> Void)?

    // MARK: - Estado

    private var lastLat: Double?
    private var lastLng: Double?
    private var lastAccLong: Double = 0
    private var lastAccLat: Double = 0
    private var started: Bool = false

    // MARK: - Stats observáveis

    public private(set) var imuGpsPublished: Int = 0
    public private(set) var heartbeatsPublished: Int = 0
    public private(set) var enrichedDroppedNoFix: Int = 0
    public private(set) var enrichedDroppedNoProjection: Int = 0

    // MARK: - Init

    public init(
        transports: [any CockpitTransport],
        track: Track,
        stintId: String,
        onEvent: (@Sendable (PublisherEvent) -> Void)? = nil
    ) {
        self.transports = transports
        self.track = track
        self.stintId = stintId
        self.onEvent = onEvent
    }

    // MARK: - Lifecycle

    public func start() async {
        guard !started else { return }
        started = true
        for t in transports { await t.start() }
        onEvent?(.started)
    }

    public func stop() async {
        guard started else { return }
        started = false
        for t in transports { await t.stop() }
        onEvent?(.stopped)
    }

    // MARK: - Ingest (chamado pelos handlers do recorder + processor)

    /// Atualiza estado interno com o sample raw (mantém última fix GPS
    /// e última leitura IMU pra compor o payload do enriched).
    public func ingestRawSample(_ s: Sample) {
        switch s.source {
        case SourceTags.gps, SourceTags.racebox:
            if let lat = s.lat, let lng = s.lng, lat.isFinite, lng.isFinite {
                lastLat = lat
                lastLng = lng
            }
        case SourceTags.imu, SourceTags.raceboxImu:
            if let aL = s.accLong, aL.isFinite { lastAccLong = aL }
            if let aLat = s.accLat, aLat.isFinite { lastAccLat = aLat }
        default:
            break
        }
    }

    /// Recebe enriched (10 Hz) e dispara publish em todos transports.
    /// No-op se ainda não temos primeira fix GPS (pra evitar publicar
    /// posição inválida).
    public func ingestEnriched(_ e: EnrichedSample) async {
        guard started else { return }
        guard let lat = lastLat, let lng = lastLng else {
            enrichedDroppedNoFix += 1
            return
        }
        guard let vb = Projector.projectToViewBox(lat: lat, lng: lng, track: track) else {
            enrichedDroppedNoProjection += 1
            return
        }
        let speedMps = (e.vxMps * e.vxMps + e.vyMps * e.vyMps).squareRoot()
        let payload = CockpitImuGpsPayload(
            x: vb.x,
            y: vb.y,
            accLong: lastAccLong,
            accLat: lastAccLat,
            speedKmh: speedMps * 3.6,
            heading: e.headingDeg,
            gapDurationMs: e.gapDurationMs ?? 0
        )
        let env = CockpitEnvelope.imuGps(tMono: e.tMono, payload: payload)
        await broadcast(env)
        imuGpsPublished += 1
    }

    // MARK: - Heartbeat

    /// Caller dispara periodicamente (1 Hz em produção). Publica
    /// envelope `heartbeat` em ambos transports.
    public func sendHeartbeat(tMono: Double = Clock.nowMono) async {
        guard started else { return }
        let env = CockpitEnvelope.heartbeat(tMono: tMono)
        await broadcast(env)
        heartbeatsPublished += 1
    }

    // MARK: - Internal

    private func broadcast(_ env: CockpitEnvelope) async {
        for t in transports {
            await t.send(env)
        }
    }
}

/// Sinais observáveis emitidos pelo publisher pra observabilidade.
public enum PublisherEvent: Sendable, Equatable {
    case started
    case stopped
}
