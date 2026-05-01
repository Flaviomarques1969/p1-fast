// swift-tools-version:5.9
// ═══════════════════════════════════════════════════════════
// P1FastCore — port Swift do pipeline puro (sem deps iOS)
// ═══════════════════════════════════════════════════════════
// Compila com swiftc/Swift Package Manager no Mac (sem Xcode.app).
// Usado pelo app real iOS (importa como dependência) e validável
// hoje contra o pipeline JS via paridade de saída.
//
// Smoke: target executável `p1fast-smoke` (não usa XCTest/Testing,
// que não estão disponíveis sem Xcode.app). Roda asserts manuais
// e reporta "N ok / N fail" — mesmo padrão dos smokes JS Node.

import PackageDescription

let package = Package(
    name: "P1FastCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    products: [
        .library(name: "P1FastCore", targets: ["P1FastCore"]),
        .executable(name: "p1fast-smoke", targets: ["P1FastSmoke"]),
    ],
    targets: [
        .target(name: "P1FastCore", path: "Sources/P1FastCore"),
        .executableTarget(name: "P1FastSmoke", dependencies: ["P1FastCore"], path: "Sources/P1FastSmoke"),
    ]
)
