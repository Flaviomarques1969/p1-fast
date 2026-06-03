// ═══════════════════════════════════════════════════════════
// CockpitOrientationTestView — diagnóstico de rotação (DEV ONLY)
// ═══════════════════════════════════════════════════════════
// 2026-05-21: criado pra validar isoladamente se OrientationLock
// consegue de fato girar o iPhone/simulator pra horizontal quando
// o usuário escolhe "Cockpit do piloto". Não tem WebView, não tem
// coordinator, não tem stint — só o lock + um indicador visual de
// orientação. Acesso via launch arg --p1-cockpit-test.

import SwiftUI

struct CockpitOrientationTestView: View {
    var body: some View {
        GeometryReader { geo in
            let isLandscape = geo.size.width > geo.size.height
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(spacing: 24) {
                    Text(isLandscape ? "HORIZONTAL ✓" : "VERTICAL ✗")
                        .font(.system(size: 56, weight: .heavy))
                        .foregroundStyle(isLandscape ? .green : .red)
                    Text("Tamanho: \(Int(geo.size.width)) × \(Int(geo.size.height))")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(.white.opacity(0.8))
                    Text("Lock atual: \(OrientationLock.allowed.rawValue)")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
        }
        .statusBar(hidden: true)
        .onAppear { OrientationLock.set(.landscape) }
        .onDisappear { OrientationLock.set(.portrait) }
    }
}

/// 2026-05-21: simula o caminho real (sheet → fullScreenCover) que está
/// quebrando rotação no iPhone real. Reproduz a hierarquia com botão
/// dentro de sheet, e fullScreenCover apresentado por cima.
struct CockpitFlowTestView: View {
    @State private var sheetAberto = false
    @State private var coverAberto: FlowToken? = nil

    var body: some View {
        VStack(spacing: 30) {
            Text("Teste do caminho real")
                .font(.system(size: 22, weight: .bold))
            Text("1. Toca \"Abrir modal\". 2. Dentro do modal toca \"Cockpit\". 3. Tela cheia deve abrir e girar.")
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("1) Abrir modal (sheet)") { sheetAberto = true }
                .buttonStyle(.borderedProminent)
            Button("2) Pular modal — abrir tela cheia direto") {
                coverAberto = FlowToken()
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .sheet(isPresented: $sheetAberto) {
            VStack(spacing: 24) {
                Text("Tela 'Pronto pra começar'")
                    .font(.system(size: 20, weight: .semibold))
                Button("Cockpit (tela cheia horizontal)") {
                    OrientationLock.set(.landscape)
                    sheetAberto = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        OrientationLock.set(.landscape)
                        coverAberto = FlowToken()
                    }
                }
                .buttonStyle(.borderedProminent)
                Button("Fechar") { sheetAberto = false }
            }
            .padding()
        }
        .fullScreenCover(item: $coverAberto) { _ in
            CockpitOrientationTestView()
                .overlay(alignment: .topLeading) {
                    Button("X Fechar") { coverAberto = nil }
                        .padding(20)
                        .foregroundStyle(.white)
                }
        }
    }
}

private struct FlowToken: Identifiable, Equatable {
    let id = UUID()
}

/// 2026-05-21: variante que abre fullScreenCover automaticamente no
/// onAppear — sem clique. Pra automatizar testes no simulador.
struct CockpitCoverTestAutoView: View {
    @State private var aberto: FlowToken? = nil

    var body: some View {
        Color.gray.ignoresSafeArea()
            .onAppear {
                // Pede landscape ANTES e abre cover. Mesmo padrão do
                // EventoDetalheView com cockpit.
                OrientationLock.set(.landscape)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    OrientationLock.set(.landscape)
                    aberto = FlowToken()
                }
            }
            .fullScreenCover(item: $aberto) { _ in
                CockpitOrientationTestView()
            }
    }
}

/// 2026-05-21: simula PRECISAMENTE o caminho real do produto:
/// sheet abre primeiro, depois fecha e abre fullScreenCover. Tudo
/// automático no onAppear pra teste sem clique.
struct CockpitSheetToCoverAutoView: View {
    @State private var sheetAberto = true
    @State private var cover: FlowToken? = nil

    var body: some View {
        VStack {
            Text("Aguardando sheet → cover (automático)...")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.blue.ignoresSafeArea())
        .sheet(isPresented: $sheetAberto) {
            VStack {
                Text("Sheet aberto. Fechando em 2s...")
                    .font(.system(size: 18, weight: .semibold))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.purple.ignoresSafeArea())
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    OrientationLock.set(.landscape)
                    sheetAberto = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        OrientationLock.set(.landscape)
                        cover = FlowToken()
                    }
                }
            }
        }
        .fullScreenCover(item: $cover) { _ in
            CockpitOrientationTestView()
        }
    }
}
