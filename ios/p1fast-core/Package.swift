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
//
// GRDB: SQLite local via GRDB.swift. Schema em Sources/P1FastCore/
// Persistence/ espelha o Postgres do Supabase (supabase/migrations/
// 0001_initial.sql). Sync drainer não está aqui — Sprint 1A.6.

import PackageDescription

let package = Package(
    name: "P1FastCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    products: [
        .library(name: "P1FastCore", targets: ["P1FastCore"]),
        .executable(name: "p1fast-smoke", targets: ["P1FastSmoke"]),
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.29.0"),
    ],
    targets: [
        .target(
            name: "P1FastCore",
            dependencies: [.product(name: "GRDB", package: "GRDB.swift")],
            path: "Sources/P1FastCore"
        ),
        .executableTarget(
            name: "P1FastSmoke",
            dependencies: [
                "P1FastCore",
                .product(name: "GRDB", package: "GRDB.swift"),
            ],
            path: "Sources/P1FastSmoke"
        ),
    ]
)
