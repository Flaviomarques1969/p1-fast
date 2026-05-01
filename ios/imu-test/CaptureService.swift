// ═══════════════════════════════════════════════════════════
// CaptureService — IMU (CoreMotion) + GPS (CoreLocation) + métricas
// ═══════════════════════════════════════════════════════════
// Pede 100 Hz pra IMU (deviceMotionUpdateInterval = 0.01) e
// kCLLocationAccuracyBestForNavigation pra GPS. Mede taxa real
// (Hz, jitter ms) por canal usando janela rolling de 60 amostras.
//
// Frame de referência: amostras IMU vêm cruas no frame do device
// (X = direita, Y = baixo, Z = perpendicular à tela). Quando o
// iPhone for fixado no berço do carro, essas precisam ser
// rotacionadas pro frame do veículo — calibração fica pra app real.
// Aqui só validamos taxa/jitter, frame não importa.
//
// Persistência: amostras vão pra um buffer in-memory (Array<Sample>).
// Botão EXPORTAR CSV serializa e abre Share Sheet.

import Foundation
import CoreMotion
import CoreLocation
import Combine

struct Sample {
    let ts: Date            // wall clock
    let tMono: TimeInterval // monotônico (CACurrentMediaTime)
    let kind: String        // "imu" | "gps"
    var accLong: Double?    // m/s² no frame device (X)
    var accLat: Double?     // m/s² no frame device (Y)
    var accVert: Double?    // m/s² no frame device (Z)
    var lat: Double?
    var lng: Double?
    var speed: Double?      // m/s
    var gpsAcc: Double?     // m
}

final class CaptureService: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var running = false
    @Published var imuHz: Double = 0
    @Published var imuJitterMs: Double = 0
    @Published var gpsHz: Double = 0
    @Published var gpsJitterMs: Double = 0
    @Published var lastImu: Sample?
    @Published var lastGps: Sample?
    @Published var sampleCount: Int = 0
    @Published var permissionStatus: String = "—"

    private let motion = CMMotionManager()
    private let location = CLLocationManager()
    private let opQueue = OperationQueue()

    private var samples: [Sample] = []
    private var imuTs: [TimeInterval] = []
    private var gpsTs: [TimeInterval] = []
    private let windowSize = 60

    override init() {
        super.init()
        opQueue.qualityOfService = .userInteractive
        opQueue.maxConcurrentOperationCount = 1
        location.delegate = self
        location.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        location.distanceFilter = kCLDistanceFilterNone
        location.activityType = .automotiveNavigation
        location.allowsBackgroundLocationUpdates = false
        location.pausesLocationUpdatesAutomatically = false
    }

    func start() {
        guard !running else { return }
        running = true
        sampleCount = 0
        samples.removeAll(keepingCapacity: true)
        imuTs.removeAll(keepingCapacity: true)
        gpsTs.removeAll(keepingCapacity: true)
        startGps()
        startImu()
    }

    func stop() {
        guard running else { return }
        running = false
        motion.stopDeviceMotionUpdates()
        location.stopUpdatingLocation()
    }

    // ─── IMU ────────────────────────────────────────────────
    private func startImu() {
        guard motion.isDeviceMotionAvailable else {
            permissionStatus = "IMU indisponível"
            return
        }
        motion.deviceMotionUpdateInterval = 1.0 / 100.0   // pede 100 Hz
        motion.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: opQueue) { [weak self] dm, err in
            guard let self, let dm else { return }
            let tMono = CACurrentMediaTime()
            let acc = dm.userAcceleration   // sem gravidade — m/s²
            // userAcceleration vem em g (1g ≈ 9.81 m/s²) — multiplicar pra m/s²
            let s = Sample(
                ts: Date(),
                tMono: tMono,
                kind: "imu",
                accLong: acc.x * 9.80665,
                accLat: acc.y * 9.80665,
                accVert: acc.z * 9.80665,
                lat: nil, lng: nil, speed: nil, gpsAcc: nil
            )
            DispatchQueue.main.async {
                self.append(s)
                self.lastImu = s
                self.trackRate(.imu, tMono: tMono)
            }
        }
    }

    // ─── GPS ────────────────────────────────────────────────
    private func startGps() {
        let st = location.authorizationStatus
        permissionStatus = describe(st)
        switch st {
        case .notDetermined:
            location.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            location.startUpdatingLocation()
        default:
            permissionStatus = "GPS negado"
        }
    }

    private func describe(_ st: CLAuthorizationStatus) -> String {
        switch st {
        case .notDetermined: return "GPS — pedindo permissão"
        case .restricted: return "GPS — restrito"
        case .denied: return "GPS — negado"
        case .authorizedAlways: return "GPS — sempre"
        case .authorizedWhenInUse: return "GPS — em uso"
        @unknown default: return "GPS — desconhecido"
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        permissionStatus = describe(manager.authorizationStatus)
        if manager.authorizationStatus == .authorizedWhenInUse ||
            manager.authorizationStatus == .authorizedAlways {
            if running { manager.startUpdatingLocation() }
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard running else { return }
        for loc in locations {
            let tMono = CACurrentMediaTime()
            let s = Sample(
                ts: Date(),
                tMono: tMono,
                kind: "gps",
                accLong: nil, accLat: nil, accVert: nil,
                lat: loc.coordinate.latitude,
                lng: loc.coordinate.longitude,
                speed: loc.speed >= 0 ? loc.speed : nil,
                gpsAcc: loc.horizontalAccuracy
            )
            self.append(s)
            self.lastGps = s
            self.trackRate(.gps, tMono: tMono)
        }
    }

    // ─── métricas Hz / jitter ───────────────────────────────
    private enum Channel { case imu, gps }
    private func trackRate(_ ch: Channel, tMono: TimeInterval) {
        var arr = (ch == .imu) ? imuTs : gpsTs
        arr.append(tMono)
        if arr.count > windowSize { arr.removeFirst(arr.count - windowSize) }
        if ch == .imu { imuTs = arr } else { gpsTs = arr }
        guard arr.count >= 2 else { return }
        let span = arr.last! - arr.first!
        let hz = span > 0 ? Double(arr.count - 1) / span : 0
        var diffs: [Double] = []
        for i in 1..<arr.count { diffs.append((arr[i] - arr[i-1]) * 1000) }
        let mean = diffs.reduce(0, +) / Double(diffs.count)
        let variance = diffs.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(diffs.count)
        let jitter = variance.squareRoot()
        if ch == .imu { imuHz = hz; imuJitterMs = jitter }
        else { gpsHz = hz; gpsJitterMs = jitter }
    }

    private func append(_ s: Sample) {
        samples.append(s)
        sampleCount = samples.count
    }

    // ─── export CSV ─────────────────────────────────────────
    func exportCSV() -> URL? {
        let header = "ts_iso,tMono_s,kind,accLong_ms2,accLat_ms2,accVert_ms2,lat,lng,speed_ms,gpsAcc_m\n"
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var body = ""
        for s in samples {
            let row = [
                iso.string(from: s.ts),
                String(format: "%.6f", s.tMono),
                s.kind,
                fmt(s.accLong), fmt(s.accLat), fmt(s.accVert),
                fmt(s.lat), fmt(s.lng), fmt(s.speed), fmt(s.gpsAcc)
            ].joined(separator: ",")
            body += row + "\n"
        }
        let csv = header + body
        let dir = FileManager.default.temporaryDirectory
        let stamp = Int(Date().timeIntervalSince1970)
        let url = dir.appendingPathComponent("p1fast-imu-test-\(stamp).csv")
        do {
            try csv.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }

    private func fmt(_ v: Double?) -> String {
        guard let v else { return "" }
        return String(format: "%.6f", v)
    }
}
