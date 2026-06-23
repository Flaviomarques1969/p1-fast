# CONTINUAR — Cockpit do Piloto no app (abre ao GIRAR o celular)

> GATILHO: Flávio diz **"RETOMAR COCKPIT"** ou "voltei" → LER ESTE ARQUIVO PRIMEIRO.
> Última atualização: 2026-06-23. Tarefa em ANDAMENTO (não concluída).

## O QUE É
No app iOS P1 Fast: **virar o celular pra paisagem ABRE o Cockpit do Piloto** (em pé, tela cheia, sobreposto a qualquer tela); **voltar pra vertical FECHA** e volta exatamente onde estava. SEM botão. Decisão Flávio 22/06.
O cockpit é o **painel APROVADO** da web (`web/cockpit/cockpit-volta-real.html`: cluster de sensores em cima, luz de freio nas laterais, ápice, frase do coach, mensagens críticas), embutido no app e rodando a volta real 24/05 em replay (demonstração). Espelhar o carro AO VIVO é passo futuro.

## ESTADO ATUAL (o que funciona / o que falta)
- ✅ Detecção do giro FUNCIONA no iPhone real (pelo sensor de gravidade; antes dependia da rotação nativa do iOS e NÃO disparava nada, ainda mais com a trava de rotação ligada).
- ✅ Painel aprovado renderiza (sensores/freio/ápice/críticas) — provado no simulador e no aparelho.
- ✅ Defeito "funciona e PARA" CONSERTADO: o iOS desliga o sensor em 2º plano; agora RELIGA no `didBecomeActive` (OrientationGate.startMotion via appActive).
- 🔧 EM CORREÇÃO (último pedido Flávio 23/06): o cockpit estava vindo como **IMAGEM que dá pra dar ZOOM e arrastar** ("parece imagem, não app"). Apliquei a trava no código (FALTA reinstalar e ele testar):
  - `CockpitWebView`: `isUserInteractionEnabled = false` + zoom min/max=1 + pinch desligado + scroll off.
  - `cockpit-app.html` viewport: `maximum-scale=1, user-scalable=no`.
- ❓ "fora do lugar" (centralização): provavelmente era o próprio zoom/arraste. Depois da trava, PEDIR FOTO do aparelho na horizontal pra confirmar o equilíbrio. Se ainda torto, ajustar `safeMargin`/centralização em CockpitPilotoView.
- ❓ Confirmar o SINAL do ângulo no aparelho (em pé dos dois lados) pelos marcadores de log "P1COCKPIT" (precisa cabo USB). A auditoria disse que o sinal está certo; confirmar.

## PRÓXIMO PASSO IMEDIATO
1. Reinstalar a versão com a trava de zoom (build+install abaixo) — JÁ INICIADO antes do clear; conferir se entrou.
2. Flávio testa: abre o app, vira o celular → cockpit fixo, sem dar pra dar zoom/arrastar, em pé.
3. Pedir FOTO na horizontal → confirmar centralização. Ajustar se preciso.
4. Confirmar pelos logs (cabo) que o giro detecta dos dois lados em pé.

## ARQUITETURA / ARQUIVOS (todos sob ios/p1fast-ios/)
- `Sources/App/OrientationGate.swift` — detecção: CoreMotion `deviceMotion.gravity` (aparelho) + UIDevice (simulador). Publica `landscapeAngle: Double?` (nil=retrato; +90/-90=graus pra ficar em pé). Histerese (entra >58°, sai <42°). RELIGA o sensor no `didBecomeActive`. Log os.Logger categoria "cockpit" prefixo "P1COCKPIT".
- `Sources/Views/ContentView.swift` — `@ObservedObject orientation = OrientationGate.shared`; no body, ZStack: appContent + `CockpitPilotoView(angle:)` SEMPRE montado, visível por opacity quando `landscapeAngle != nil` (+ allowsHitTesting). `.onAppear { startMonitoring() }`.
- `Sources/Views/CockpitPilotoView.swift` — gira o WebView `angle` graus e centraliza no CENTRO FÍSICO (GeometryReader ignoresSafeArea; frame(h-2m, w-2m).rotationEffect(angle).frame(w,h)); `safeMargin` = maior inset seguro (limpa o entalhe). WebView é PAINEL FIXO (isUserInteractionEnabled=false, sem zoom). `CockpitWebView` + `CockpitSchemeHandler` (scheme `cockpit://` servindo Resources/Cockpit/).
- `Sources/App/P1FastApp.swift` — SEM AppDelegate (a abordagem de rotação nativa foi descartada).
- `Sources/App/Info.plist` + `project.yml` — app TRAVADO em retrato (só Portrait).
- `Resources/Cockpit/` — `cockpit-app.html` (= cópia de cockpit-volta-real.html + ajustes de apresentação + 2 fetch relativos `./` + viewport sem zoom), `cockpit.css`, `cockpit-state.js`, `cockpit-renderer.js`, `live-data-bridge.js`, `apice-calculator.js`, `trecho-detector.js`, `volta-real-pista-24-05.json` (~695KB), `BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json`. README na pasta.

## COMANDOS (testados)
- Build SIMULADOR (verificar compila): 
  `cd "ios/p1fast-ios" && xcodebuild build -project p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'generic/platform=iOS Simulator' -configuration Debug CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO`
- Ver o cockpit no SIMULADOR sem login (atalho dev): instalar e `xcrun simctl launch booted com.flaviomarques.p1fast --p1-cockpit` (mostra o cockpit direto, ângulo 90; girar o PNG -90 pra ver em pé). No simulador NÃO há sensor → detecção cai no UIDevice (⌘←/→, mas o foco do Simulator é instável via osascript).
- Build ASSINADO pro iPhone (local FIXO pra não colidir com a outra sessão):
  `xcodebuild build -project p1fast-ios.xcodeproj -scheme p1fast-ios -configuration Debug -destination 'generic/platform=iOS' -derivedDataPath /tmp/p1fast-dd -allowProvisioningUpdates -allowProvisioningDeviceRegistration DEVELOPMENT_TEAM=K3MU9U9952`
  App = `/tmp/p1fast-dd/Build/Products/Debug-iphoneos/p1fast-ios.app`
- Instalar no iPhone 16 Pro Max do Flávio:
  `xcrun devicectl device install app --device 2D6E7A3B-1449-5BE6-8D82-18F969ED0CCB "/tmp/p1fast-dd/Build/Products/Debug-iphoneos/p1fast-ios.app"`
  ("Failed to load provisioning... No provider was found" = RUÍDO; se aparecer "App installed" deu certo.)
- IDs do aparelho: coredevice (devicectl) = `2D6E7A3B-1449-5BE6-8D82-18F969ED0CCB`; UDID (idevicesyslog) = `00008140-000E2D611E6A801C`.
- Ler log do aparelho (PRECISA CABO USB): `idevicesyslog -u 00008140-000E2D611E6A801C > /tmp/cockpit-log.txt 2>&1 &` depois `grep P1COCKPIT /tmp/cockpit-log.txt`. Pela REDE a libimobiledevice NÃO enxerga o aparelho. O aparelho DESCONECTA quando a tela apaga → manter desbloqueado.
- NÃO dá pra tirar foto da tela do aparelho pelo terminal (devicectl não tem screenshot) — pedir FOTO ao Flávio.

## REGRAS/DECISÕES (não reabrir)
- Sem botão (é o giro). App fechado/interno. Sem emoji. Painel aprovado é `cockpit-volta-real.html` (P1 Fast/CLAUDE.md + memória p1-fast-cockpit-volta-real-painel-2026-06-22).
- Detecção por sensor de gravidade (não rotação nativa) — a nativa falha com trava de rotação.
- O app é retrato-travado; o cockpit aparece por SOBREPOSIÇÃO girada na mão.
