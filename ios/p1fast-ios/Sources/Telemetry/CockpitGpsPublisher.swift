// ═══════════════════════════════════════════════════════════
// CockpitGpsPublisher — publica pontos GPS ao vivo no canal Realtime
// `cockpit-bubi-live`, evento `gps`. Consumido pelo painel
// `p1t4000.vercel.app` pra acionar o detector de cruzamento de curva
// (registro automático de velocidade de entrada/saída).
// ═══════════════════════════════════════════════════════════
// Origem: pedido do Flávio 2026-05-26 — "vamos tornar real".
// Throttle: máximo 5 publicações/segundo (CoreLocation pode entregar
// rajadas que sobrecarregam o canal).

import Foundation
import Supabase

public struct CockpitGpsPayload: Codable, Sendable {
    public let lat: Double
    public let lng: Double
    public let speedKmh: Double
    public let tWall: Double
    public let source: String
}

public actor CockpitGpsPublisher {
    public static let channelName = "cockpit-bubi-live"

    private let client: SupabaseClient
    private var channel: RealtimeChannelV2?
    private var subscribed: Bool = false
    private var lastPublishMs: Double = 0
    private let minIntervalMs: Double = 200 // 5 Hz máx

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func start() async {
        guard channel == nil else { return }
        let ch = client.realtimeV2.channel(Self.channelName)
        channel = ch
        await ch.subscribe()
        subscribed = true
    }

    public func stop() async {
        if let ch = channel { await ch.unsubscribe() }
        channel = nil
        subscribed = false
    }

    public func publish(lat: Double, lng: Double, speedKmh: Double, tWallMs: Double) async {
        guard subscribed, let ch = channel else { return }
        if tWallMs - lastPublishMs < minIntervalMs { return }
        lastPublishMs = tWallMs
        let payload = CockpitGpsPayload(
            lat: lat, lng: lng, speedKmh: speedKmh, tWall: tWallMs, source: "iphone-gps"
        )
        do {
            try await ch.broadcast(event: "gps", message: payload)
        } catch {
            #if DEBUG
            print("[CockpitGpsPublisher] broadcast falhou: \(error)")
            #endif
        }
    }
}
