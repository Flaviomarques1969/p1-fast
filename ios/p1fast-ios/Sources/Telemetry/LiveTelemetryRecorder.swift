// ═══════════════════════════════════════════════════════════
// LiveTelemetryRecorder — captura CoreMotion 100Hz + GPS 1Hz
// ═══════════════════════════════════════════════════════════
// MS-2.1: primeira captura ao vivo do P1 Fast no app real.
// Baseline: ios/imu-test/CaptureService.swift provou IMU 100.3 Hz /
// jitter 0.2 ms no iPhone 16 Pro Max (ADR-018 confirmada).
//
// Mapeia CMDeviceMotion → Sample canônico (P1FastCore) com:
//   - accX/Y/Z em m/s² (userAcceleration sem gravidade, frame device)
//   - gyroAlpha/Beta/Gamma em graus (attitude yaw/pitch/roll)
//   - accLong/Lat/Vert ficam nil (calibração de frame é MS futura)
//
// Mapeia CLLocation → Sample canônico GPS com lat/lng/speed (m/s) +
// kmh = speed * 3.6 + course + acc.
//
// Buffer interno + flush em lotes de 100 amostras OU a cada 1s pra
// telemetry_samples via TelemetryWriter.appendBatch.
//
// MS-2.2: tela fica acesa via UIApplication.isIdleTimerDisabled
// durante a captura. Background location habilitado pra GPS continuar
// gravando quando o app vai pra background (Info.plist exige
// UIBackgroundModes.location, já adicionado).
//
// NÃO conecta ao Detector ainda — MS-2.6.
// NÃO amarra ao stint real — MS-2.3.

import Foundation
import CoreMotion
import CoreLocation
import Combine
import QuartzCore
import UIKit
import GRDB
import P1FastCore

@MainActor
final class LiveTelemetryRecorder: NSObject, ObservableObject {

    // MARK: - Published (consumidos pela UI)
    @Published private(set) var running = false
    @Published private(set) var imuHz: Double = 0
    @Published private(set) var imuJitterMs: Double = 0
    @Published private(set) var gpsHz: Double = 0
    @Published private(set) var gpsJitterMs: Double = 0
    @Published private(set) var sampleCount: Int = 0
    @Published private(set) var lastError: String?
    @Published private(set) var permissionStatus: String = "—"

    // MARK: - Config
    private let queue: DatabaseQueue
    private let sessaoId: String
    private let timeId: String
    private let flushBatchSize: Int = 100
    private let flushIntervalS: TimeInterval = 1.0

    // MARK: - Internals
    private let motion = CMMotionManager()
    private let location = CLLocationManager()
    private let opQueue: OperationQueue = {
        let q = OperationQueue()
        q.qualityOfService = .userInteractive
        q.maxConcurrentOperationCount = 1
        return q
    }()

    private var buffer: [Sample] = []
    private var seq: Int = 0
    private var flushTimer: Timer?

    // Métricas de Hz/jitter por canal — janela rolling de 60.
    private var imuTs: [TimeInterval] = []
    private var gpsTs: [TimeInterval] = []
    private let metricsWindow = 60

    init(queue: DatabaseQueue, sessaoId: String, timeId: String) {
        self.queue = queue
        self.sessaoId = sessaoId
        self.timeId = timeId
        super.init()
        location.delegate = self
        location.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        location.distanceFilter = kCLDistanceFilterNone
        location.activityType = .automotiveNavigation
        location.allowsBackgroundLocationUpdates = false
        location.pausesLocationUpdatesAutomatically = false
    }

    /// FB-01: cleanup síncrono caso a view morra com captura ativa.
    /// Sem isso, `isIdleTimerDisabled` ficava `true` até reboot e
    /// `allowsBackgroundLocationUpdates` continuava drenando GPS.
    /// Buffer in-memory não-flushed é perdido (~1s de amostras no
    /// pior caso, aceitável em teardown abrupto).
    deinit {
        motion.stopDeviceMotionUpdates()
        location.stopUpdatingLocation()
        location.allowsBackgroundLocationUpdates = false
        flushTimer?.invalidate()
        // UIApplication.shared.isIdleTimerDisabled é UIApplication-only
        // → marshalling pra main. Ignora se app já tá saindo.
        Task { @MainActor in
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }

    // MARK: - Controle público

    func start() {
        guard !running else { return }
        running = true
        sampleCount = 0
        seq = 0
        buffer.removeAll(keepingCapacity: true)
        imuTs.removeAll(keepingCapacity: true)
        gpsTs.removeAll(keepingCapacity: true)
        // MS-2.2: tela não dorme durante captura.
        UIApplication.shared.isIdleTimerDisabled = true
        // MS-2.2: GPS continua em background (Info.plist tem
        // UIBackgroundModes.location). CoreLocation exige setar APÓS
        // já ter authorization — então sempre setamos no start.
        location.allowsBackgroundLocationUpdates = true
        startGps()
        startImu()
        scheduleFlushTimer()
    }

    func stop() async {
        guard running else { return }
        running = false
        flushTimer?.invalidate()
        flushTimer = nil
        motion.stopDeviceMotionUpdates()
        location.stopUpdatingLocation()
        // MS-2.2: libera wake lock + background updates.
        location.allowsBackgroundLocationUpdates = false
        UIApplication.shared.isIdleTimerDisabled = false
        await flush()
    }

    // MARK: - IMU

    private func startImu() {
        guard motion.isDeviceMotionAvailable else {
            permissionStatus = "IMU indisponível"
            return
        }
        motion.deviceMotionUpdateInterval = 1.0 / 100.0
        motion.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: opQueue) { [weak self] dm, err in
            guard let self, let dm else { return }
            let tMono = Clock.nowMono
            let sample = Self.makeImuSample(deviceMotion: dm, tMono: tMono)
            Task { @MainActor in
                self.append(sample)
                self.trackRate(.imu, tMono: tMono / 1000.0)
            }
        }
    }

    /// Mapeia CMDeviceMotion → Sample canônico. Pública estática pra
    /// poder ser exercida no smoke headless com fixture sintética.
    public static func makeImuSample(deviceMotion dm: CMDeviceMotion, tMono: Double) -> Sample {
        let g = 9.80665
        var s = Sample(
            t: Clock.now,
            tMono: tMono,
            source: SourceTags.imu
        )
        // userAcceleration vem em g — multiplica pra m/s². Frame device
        // (não calibrado pro veículo) → preenche accX/Y/Z, deixa
        // accLong/Lat/Vert nil (calibração é MS futura).
        s.accX = dm.userAcceleration.x * g
        s.accY = dm.userAcceleration.y * g
        s.accZ = dm.userAcceleration.z * g
        // attitude em graus (convenção web DeviceOrientationEvent).
        s.gyroAlpha = dm.attitude.yaw * 180.0 / .pi
        s.gyroBeta = dm.attitude.pitch * 180.0 / .pi
        s.gyroGamma = dm.attitude.roll * 180.0 / .pi
        return s
    }

    // MARK: - GPS

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

    /// Mapeia CLLocation → Sample canônico GPS. Estática pública pro smoke.
    public static func makeGpsSample(location loc: CLLocation, tMono: Double) -> Sample {
        var s = Sample(
            t: Clock.now,
            tMono: tMono,
            source: SourceTags.gps
        )
        s.lat = loc.coordinate.latitude
        s.lng = loc.coordinate.longitude
        s.alt = loc.altitude
        if loc.speed >= 0 {
            s.speed = loc.speed
            s.kmh = loc.speed * 3.6
        }
        if loc.course >= 0 {
            s.course = loc.course
        }
        if loc.horizontalAccuracy >= 0 {
            s.acc = loc.horizontalAccuracy
        }
        return s
    }

    // MARK: - Buffer + flush

    /// MS-2.7 PR C: handlers chamados por sample logo após o append no
    /// buffer raw, antes do flush check. Usado pelo LiveKalmanProcessor
    /// (predict/update) e pelo LiveDetectorBridge (consume → Detector).
    /// Roda no MainActor (mesma fila do append). MS-2.6: era um único
    /// callback `onSample`, virou dicionário pra suportar múltiplos
    /// consumidores ao vivo (Kalman + Detector + futuro Box cockpit).
    private var sampleHandlers: [UUID: (Sample) -> Void] = [:]

    /// Registra um handler de Sample. Retorna closure que cancela o
    /// registro — segue o padrão do `Detector.onLap`/`onSegmentStart`.
    @discardableResult
    public func addSampleHandler(_ cb: @escaping (Sample) -> Void) -> () -> Void {
        let id = UUID()
        sampleHandlers[id] = cb
        return { [weak self] in self?.sampleHandlers.removeValue(forKey: id) }
    }

    private func append(_ s: Sample) {
        buffer.append(s)
        sampleCount += 1
        for cb in sampleHandlers.values { cb(s) }
        if buffer.count >= flushBatchSize {
            Task { await flush() }
        }
    }

    private func scheduleFlushTimer() {
        flushTimer?.invalidate()
        flushTimer = Timer.scheduledTimer(withTimeInterval: flushIntervalS, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.flush() }
        }
    }

    private func flush() async {
        guard !buffer.isEmpty else { return }
        let batch = buffer
        let startSeq = seq
        buffer.removeAll(keepingCapacity: true)
        seq += batch.count
        let q = queue
        let sId = sessaoId
        let tId = timeId
        let result: Result<Int, Error> = await Task.detached(priority: .utility) {
            do {
                let n = try TelemetryWriter.appendBatch(
                    queue: q, sessaoId: sId, timeId: tId,
                    samples: batch, startSeq: startSeq
                )
                return .success(n)
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success: break
        case .failure(let err):
            lastError = "flush falhou: \(err.localizedDescription)"
            buffer.insert(contentsOf: batch, at: 0)
            seq = startSeq
        }
    }

    // MARK: - Métricas Hz/jitter

    private enum Channel { case imu, gps }
    private func trackRate(_ ch: Channel, tMono: TimeInterval) {
        var arr = (ch == .imu) ? imuTs : gpsTs
        arr.append(tMono)
        if arr.count > metricsWindow {
            arr.removeFirst(arr.count - metricsWindow)
        }
        if ch == .imu { imuTs = arr } else { gpsTs = arr }
        guard arr.count >= 2 else { return }
        let span = arr.last! - arr.first!
        let hz = span > 0 ? Double(arr.count - 1) / span : 0
        var diffs: [Double] = []
        for i in 1..<arr.count { diffs.append((arr[i] - arr[i - 1]) * 1000) }
        let mean = diffs.reduce(0, +) / Double(diffs.count)
        let variance = diffs.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(diffs.count)
        let jitter = variance.squareRoot()
        if ch == .imu { imuHz = hz; imuJitterMs = jitter }
        else { gpsHz = hz; gpsJitterMs = jitter }
    }
}

// MARK: - CLLocationManagerDelegate

extension LiveTelemetryRecorder: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.permissionStatus = self.describe(manager.authorizationStatus)
            if (manager.authorizationStatus == .authorizedWhenInUse ||
                manager.authorizationStatus == .authorizedAlways) && self.running {
                manager.startUpdatingLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            guard self.running else { return }
            for loc in locations {
                let tMono = Clock.nowMono
                let sample = Self.makeGpsSample(location: loc, tMono: tMono)
                self.append(sample)
                self.trackRate(.gps, tMono: tMono / 1000.0)
            }
        }
    }
}
