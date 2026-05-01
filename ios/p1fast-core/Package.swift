// swift-tools-version:5.9
// ═══════════════════════════════════════════════════════════
// P1FastCore — port Swift do pipeline puro (sem deps iOS)
// ═══════════════════════════════════════════════════════════
// Compila com swiftc/Swift Package Manager no Mac (sem Xcode.app).
// Usado pelo app real iOS (importa como dependência) e validável
// hoje contra o pipeline JS via paridade de saída.
//
// Escopo: Quality, Sample, Snapshot, Timebase, helpers de tempo.
// FORA do escopo aqui: CoreMotion, CoreLocation, SwiftUI, Dexie.

import PackageDescription

let package = Package(
    name: "P1FastCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    products: [
        .library(name: "P1FastCore", targets: ["P1FastCore"]),
    ],
    targets: [
        .target(name: "P1FastCore", path: "Sources/P1FastCore"),
        .testTarget(name: "P1FastCoreTests", dependencies: ["P1FastCore"], path: "Tests/P1FastCoreTests"),
    ]
)
