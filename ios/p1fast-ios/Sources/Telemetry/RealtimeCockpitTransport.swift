// ═══════════════════════════════════════════════════════════
// RealtimeCockpitTransport — MS-2.8 (fallback Realtime)
// ═══════════════════════════════════════════════════════════
// Wrappa o canal Supabase Realtime `live-stint-{stintId}`. O cockpit
// no notebook Windows assina o mesmo canal e consome quando o cabo
// USB cai (TransportSelector decide o switch lá).
//
// Eventos:
//   broadcast(event: "sample", message: CockpitEnvelope)
// O envelope é Codable e o supabase-swift v2 serializa direto.
//
// Falhas de send: log + drop (publisher não retentar — fail-fast).

import Foundation
import P1FastCore
import Supabase

actor RealtimeCockpitTransport: CockpitTransport {
    public let name: String = "realtime"
    private let client: SupabaseClient
    private let topic: String
    private var channel: RealtimeChannelV2?
    private var subscribed: Bool = false

    public init(client: SupabaseClient, stintId: String) {
        self.client = client
        self.topic = "live-stint-\(stintId)"
    }

    public func start() async {
        guard channel == nil else { return }
        let ch = client.realtimeV2.channel(topic)
        channel = ch
        await ch.subscribe()
        subscribed = true
    }

    public func stop() async {
        if let ch = channel {
            await ch.unsubscribe()
        }
        channel = nil
        subscribed = false
    }

    public func send(_ envelope: CockpitEnvelope) async {
        guard subscribed, let ch = channel else { return }
        do {
            try await ch.broadcast(event: "sample", message: envelope)
        } catch {
            // fail-fast: drop e log. Publisher não decide retry.
            #if DEBUG
            print("[RealtimeCockpitTransport] broadcast falhou: \(error)")
            #endif
        }
    }
}
