// ═══════════════════════════════════════════════════════════
// P1 Fast — IMU Test App (mini-app de validação ADR-018)
// ═══════════════════════════════════════════════════════════
// Objetivo único: provar que CoreMotion + CoreLocation no iPhone
// real entregam de fato ≥ 10 Hz consistentes (IMU) e ≥ 1 Hz (GPS)
// sob condições reais (Wi-Fi calmo → carro → sol → vibração).
//
// Não é o app de produção. É um harness descartável após validação.
// Quando passar, ADR-018 fica confirmada com dado real do iPhone.
//
// Saída: CSV exportável via Share Sheet com colunas
//   ts,tMono,kind,accLong,accLat,accVert,lat,lng,speed,gpsAcc

import SwiftUI

@main
struct P1FastIMUTestApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
