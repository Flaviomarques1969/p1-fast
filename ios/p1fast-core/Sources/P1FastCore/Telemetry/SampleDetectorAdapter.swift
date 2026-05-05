// ═══════════════════════════════════════════════════════════
// SampleDetectorAdapter — Sample (GPS) → DetectorSample
// ═══════════════════════════════════════════════════════════
// MS-2.6 (PLANO_FASE_1): fecha o gap entre o stream do
// LiveTelemetryRecorder/Provider e o `Detector` ao vivo. Detector
// só consome posição (x,y) já em coords do viewBox + speed; este
// adapter projeta lat/lng → viewBox via `Projector` usando as
// `geoAncoras` do Track.
//
// Lógica pura, sem CoreMotion/GRDB — testável no smoke headless.
// IMU samples são ignorados (Detector não usa IMU diretamente,
// apex tracking é por queda de speed, não por aceleração).
//
// Helper canônico — `LiveDetectorBridge` em p1fast-ios usa este
// adapter pra plugar em LiveTelemetryRecorder. Um futuro consumer
// que tenha apenas o `Sample` (e.g. parser CSV) usa o mesmo helper.

import Foundation

public enum SampleDetectorAdapter {

    /// Converte um `Sample` GPS num `DetectorSample` projetado pro
    /// viewBox da `track`. Retorna nil se:
    /// - source não é GPS (cockpit-mobile / racebox-gnss)
    /// - lat/lng ausentes ou não-finitos
    /// - track tem < 2 âncoras ou âncoras coincidentes
    public static func detectorSample(from s: Sample, track: Track) -> DetectorSample? {
        guard s.source == SourceTags.gps || s.source == SourceTags.racebox else {
            return nil
        }
        guard let p = Projector.projectToViewBox(lat: s.lat, lng: s.lng, track: track) else {
            return nil
        }
        return DetectorSample(
            x: p.x,
            y: p.y,
            t: Double(s.t),
            tMono: s.tMono,
            speed: s.speed
        )
    }
}
