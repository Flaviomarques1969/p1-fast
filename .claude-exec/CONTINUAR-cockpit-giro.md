# CONTINUAR — Cockpit do Piloto no app (abre ao GIRAR o celular)

> GATILHO: Flávio diz **"RETOMAR COCKPIT"** ou "voltei" → LER ESTE ARQUIVO PRIMEIRO.
> Última atualização: 2026-06-23. Tarefa em ANDAMENTO (não concluída).

> ★ VIRADA 23/06 (tarde) — Flávio redefiniu: o problema NÃO era o zoom; a tela tem que ser tela de app DE VERDADE,
> com CONEXÃO e DADO REAIS (o replay da volta 24/05 = "imagem simulada", rejeitado). FEITO nesta sessão: troquei,
> no `Resources/Cockpit/cockpit-app.html`, o replay pela ESCUTA do canal real `cockpit-bubi-live` (cloud-bridge.js,
> só ouve, nunca publica); sem carro = overlay "AGUARDANDO O CARRO". Conexão real PROVADA (assinatura SUBSCRIBED).
> Replay preservado em `cockpit-app-replay.html`. BUILD OK; instalar quando o iPhone 16 voltar ao alcance e Flávio testar.
> Detalhe completo em `.claude-exec/ultima-tarefa.md` (seção EXECUÇÃO 23/06 tarde). A questão "embute web x reescrever
> nativo" segue ABERTA — decidir DEPOIS que ele ver a versão ao vivo com zoom travado e disser se já lê como app.

> ★★ VIRADA 23/06 (NOITE) — MUDEI A ABORDAGEM PRA ROTAÇÃO NATIVA (Flávio: "este caminho não dá conta, o dia inteiro").
> A "rotação na mão" (girar uma página sobreposta + adivinhar margem pra ilha/quinas) NUNCA assentou — passei o dia em
> desalinho (direita comendo SAÍDA / preto à esquerda / encolhido). DECISÃO: virar o app pra HORIZONTAL DE VERDADE quando
> gira → o próprio iOS enquadra ilha/quinas/indicador. IMPLEMENTADO (compila, BUILD SUCCEEDED), mas NÃO VERIFICADO:
>   - Info.plist + project.yml: liberada LandscapeLeft/Right (era só Portrait). project REGENERADO com `xcodegen generate`.
>   - NOVO `Sources/App/AppDelegate.swift`: supportedInterfaceOrientationsFor = allowLandscape ? .landscape : .portrait.
>   - `P1FastApp.swift`: @UIApplicationDelegateAdaptor(AppDelegate.self).
>   - `OrientationGate.swift` REESCRITO: gravidade detecta → set(orientação) → allowLandscape=true + requestGeometryUpdate
>     (força a virada, vence trava). Publica `allowLandscape` (não mais `landscapeAngle`). Mapeamento phi→landscapeLeft/Right
>     pode estar INVERTIDO (testar no aparelho; flip se vier de cabeça pra baixo). Dev arg `--p1-force-landscape`.
>   - `ContentView.swift`: cockpit mostra quando `verticalSizeClass == .compact` (app deitado). Removido o overlay girado na
>     mão + args de teste antigos (--p1-overlay-only/--p1-force-ls). --p1-cockpit virou placeholder "Gire o celular".
>   - `CockpitPilotoView.swift`: SIMPLIFICADO — tela cheia nativa que RESPEITA a área segura (iOS enquadra). SEM rotationEffect,
>     SEM GeometryReader, SEM margem chutada. cockpit-app.html (dado real ao vivo + zoom travado) INTOCADO.
> POR QUE NÃO VERIFIQUEI: o SIMULADOR não tem sensor de inclinação e, com app travado em retrato, NÃO dispara UIDevice na
>   virada (logs: "P1COCKPIT orientacao ->" nunca apareceu ao girar o sim). `--p1-force-landscape` (requestGeometryUpdate)
>   entrou num MEIO-TERMO (traits viram compact mas a janela fica em pé → cockpit aparece DEITADO numa janela em pé). No
>   APARELHO REAL deve funcionar (gravidade dispara mesmo com trava). ÚLTIMA INSTALAÇÃO NO IPHONE DO FLÁVIO = a versão ANTERIOR
>   (rotação na mão, p=46), NÃO esta nativa.
> PRÓXIMO: instalar a versão nativa no iPhone 16 (cabo) e o Flávio gira → ler logs P1COCKPIT pelo cabo (idevicesyslog -u
>   00008140-000E2D611E6A801C | grep P1COCKPIT) pra confirmar gravidade dispara + orientação certa. Se virar de cabeça pra
>   baixo, trocar landscapeLeft<->Right no OrientationGate. Limpar o arg `--p1-force-landscape` quando fechar.
>
> ✅ CONFIRMADO NO APARELHO 24/06 00:03 (cabo + foto do Flávio): a VIRADA NATIVA FUNCIONA — o app gira pra horizontal de
>   verdade e o painel fica EM PÉ (não mais deitado/torto). Logs P1COCKPIT no iPhone 16: "orientacao -> 3 (landscapeRight,
>   allowLandscape=true)" ao deitar / "-> 1 (portrait)" ao levantar, repetido. O sensor de gravidade dispara mesmo com trava.
>   Esse era o problema que travou o DIA INTEIRO — RESOLVIDO. NÃO reabrir a "rotação na mão".
> FALTA SÓ (próxima sessão, cabeça fresca): o ENQUADRAMENTO dentro da horizontal — na foto do Flávio sobra uma FAIXA ESCURA
>   na lateral (canto/ilha do iPhone). É a tensão "tela cheia × ilha comendo a ponta", agora na orientação certa. Hoje o
>   CockpitWebView RESPEITA a área segura (iOS enquadra) → margem escura na lateral da ilha. Decidir com o Flávio: (a) aceitar
>   a faixa fina da área segura (jeito iOS correto), ou (b) preencher edge-to-edge (ignoresSafeArea no WebView) e aceitar a
>   ilha encostar na ponta da coluna de luzes de freio. O painel tem a MESMA proporção da tela, então não dá os dois.
> Parado em 24/06 ~00:05 por exaustão/horário (dia inteiro). App nativo INSTALADO no iPhone 16 do Flávio.

> ★★★ NOITE 2 (24/06 ~01:15) — VIRADA NATIVA 100% OK; FALTA SÓ O ENQUADRAMENTO (deslocamento CONSTANTE pra direita).
> MÉTODO NOVO QUE FUNCIONOU: "RÉGUA" — pintei o cockpit com fundo MAGENTA (#2a0a4a) = tela toda + contorno VERDE (#22ff55) =
>   zona segura, pra eu MEDIR no print do Flávio (a tela é preta-no-preto, sem isso eu fico cego). Flávio manda print da tela
>   cheia (iPhone Mirroring no Mac → ~2436x1125), eu meço por pixel (script python lê PNG sem libs). Já confirmado que os
>   prints dele vêm INTEIROS (não recortados).
> O QUE FIZ na tela (cockpit-app.html): viewport ganhou `viewport-fit=cover`; CockpitWebView ganhou `.ignoresSafeArea()`
>   (cobre a tela toda); fit() passou a ajustar #device à .stage (não à window); .stage virou caixa recuada. Testei recuo por
>   env(safe-area-inset-*) (entrou só na esquerda=ilha, deu torto) e depois recuo FIXO `top:22 bottom:22 left:60 right:60`
>   (simétrico) — CONFIRMADO no app empacotado.
> ACHADO-CHAVE (medido no print preto final, 2436x1125): MESMO com a folga FIXA SIMÉTRICA, o conteúdo está deslocado ~196px
>   PRA DIREITA (margem esq=393px, margem dir=0 → sensores CHASSI cortam na borda direita). Centro do conteúdo=1414 vs centro
>   da tela=1218. Ou seja: o empurrão NÃO vem da folga (.stage) — vem de OUTRO lugar. SUSPEITA FORTE: o WKWebView/área segura
>   está insetando o conteúdo pela ilha (mesmo com ignoresSafeArea + contentInsetAdjustmentBehavior=.never + viewport-fit=cover),
>   empurrando ~77 CSS px pra direita; minha folga só soma por cima. Flávio (corretíssimo): "vc é quem está colocando deslocada,
>   todas as vezes."
> PRÓXIMO (cabeça fresca): achar a FONTE do empurrão constante (não a folga). Hipóteses a testar com a régua: (a) o WebView
>   está aplicando inset de área segura no conteúdo → desligar de vez (testar sem o left/right da .stage e ver se o shift some,
>   ou medir env(safe-area-inset-left/right) reais via JS escrito num cantinho da tela); (b) a sensor-row (cluster 14 sensores)
>   transborda o #device 956 e/ou não está centrada; (c) algo no #device/info-bloco. MEDIR cada um isolado com a régua. NÃO
>   chutar folga — achar o deslocamento de origem e zerá-lo. Dev args atuais: `--p1-force-landscape`. LIMPAR a régua (magenta/
>   verde) e o `--p1-force-landscape` quando fechar.

> ★★★★ NOITE 3 (24/06 ~01:40) — TELA PRETA NA VIRADA + REVELA SÓ QUANDO ASSENTA (proposta do Flávio).
> Flávio: "não gire a tela já aparecendo; gire o celular, ele fica PRETO; assentou na horizontal, traz a tela
> preenchendo o espaço, normalmente, como qualquer app — porque na hora de girar, por algum motivo, você não
> centraliza". IMPLEMENTADO e INSTALADO no iPhone 16 (build OK, simulador + assinado):
>   - `CockpitPilotoView.swift`: agora em GeometryReader. Painel cobre de PRETO (opacity 0) enquanto a tela está
>     girando; `agendarRevelacao()` zera `revealed` a cada mudança de `geo.size` e só revela 0.40s DEPOIS que o
>     tamanho PARA de mudar (debounce por `settleToken` — "a virada assentou"). No revelar, chama
>     `window.p1Refit` no WebView pra recalcular o fit contra a geometria JÁ estável. `WebHolder` guarda o WKWebView.
>   - `cockpit-app.html`: exposto `window.p1Refit = function(){ fit(); requestAnimationFrame(fit); }`.
>   - NÃO mexi na detecção de giro (OrientationGate/AppDelegate) — a virada nativa já funciona (NOITE 2 confirmou).
> POR QUE: o desvio ~196px da NOITE 2 foi medido com o fit rodando na geometria TRANSITÓRIA da rotação. A hipótese
>   (e o pedido do Flávio) é que recalcular SÓ depois de assentar centraliza. NÃO VERIFICADO no aparelho ainda —
>   precisa o Flávio girar e mandar FOTO. SE ainda houver desvio constante, voltar a régua (magenta/verde) e MEDIR
>   por pixel (não chutar folga). Dev arg ainda presente: `--p1-force-landscape` (limpar quando fechar de vez).

> ★★★★★ CAUSA RAIZ ACHADA (24/06 ~01:46) — era a LARGURA DO VIEWPORT, não folga/ilha/tempo.
> Medi com a régua NUMÉRICA na tela (foto do Flávio). Números: innerW=812, mas o viewport meta era
> `width=956` → o `position:fixed` da .stage usava o espaço de 956 (stage larg=836, centro=478=956/2),
> enquanto a tela VISÍVEL tem só 812 (centro=406). 478−406 = **72px** = o "DESVIO" exato. safe-area era
> SIMÉTRICA (L53 R53) → nunca foi a ilha. CORREÇÃO (1 linha): viewport `width=956` → `width=device-width`
> em cockpit-app.html. Agora a .stage centraliza no centro REAL da tela; o fit() já escala o #device 956
> pra caber. CONFIRMADO pela foto do Flávio 24/06 ~01:49: **DESVIO = 0 px**, painel esq 146 / dir 146 (simétrico).
> Régua numérica JÁ REMOVIDA (bloco #p1diag), versão limpa reinstalada no iPhone 16. Flávio: "mudou a
> estratégia e está no caminho certo". Falta SÓ: dev arg `--p1-force-landscape` (inerte sem o flag, dá pra
> deixar) e o OK visual final dele do conjunto (tela-preta-na-virada + painel centralizado).
> LIÇÃO: o desvio constante NÃO era timing (a tela-preta-na-virada da NOITE 3 não centralizava sozinha
> porque a origem era a largura do viewport). A tela-preta continua boa (esconde a virada feia) e fica.
> OBS aberta (não-bug): com device-width o painel fica centralizado mas sobra preto nas laterais (~146px
> cada) porque a proporção medida do #device ficou ~1.57:1 contra a tela 2.17:1 (812×375). Se o Flávio
> quiser MENOS preto/painel maior, mexer é na proporção do painel APROVADO — confirmar com ele antes.

## O QUE É
No app iOS P1 Fast: **virar o celular pra paisagem ABRE o Cockpit do Piloto** (em pé, tela cheia, sobreposto a qualquer tela); **voltar pra vertical FECHA** e volta exatamente onde estava. SEM botão. Decisão Flávio 22/06.
O cockpit é o **painel APROVADO** da web (`web/cockpit/cockpit-volta-real.html`: cluster de sensores em cima, luz de freio nas laterais, ápice, frase do coach, mensagens críticas), embutido no app e rodando a volta real 24/05 em replay (demonstração). Espelhar o carro AO VIVO é passo futuro.

## ESTADO ATUAL (o que funciona / o que falta)
- ✅ Detecção do giro FUNCIONA no iPhone real (pelo sensor de gravidade; antes dependia da rotação nativa do iOS e NÃO disparava nada, ainda mais com a trava de rotação ligada).
- ✅ Painel aprovado renderiza (sensores/freio/ápice/críticas) — provado no simulador e no aparelho.
- ✅ Defeito "funciona e PARA" CONSERTADO: o iOS desliga o sensor em 2º plano; agora RELIGA no `didBecomeActive` (OrientationGate.startMotion via appActive).
- 🔧 EM CORREÇÃO (pedido Flávio 23/06): o cockpit estava vindo como **IMAGEM que dá pra dar ZOOM e arrastar**. ESCLARECIMENTO DO FLÁVIO (importante): "aplicação NÃO tem zoom em tela — o zoom prova que é imagem; eu quero uma TELA DE APLICATIVO DE VERDADE, viva, como a que o piloto vê, dentro do P1 Fast". Ou seja: o critério dele é COMPORTAMENTO de app (sem zoom, sem arrastar, viva animando) — NÃO necessariamente reescrever nativo. Apliquei a trava no código (FALTA reinstalar e ele testar):
  - `CockpitWebView`: `isUserInteractionEnabled = false` + zoom min/max=1 + pinch desligado + scroll off.
  - `cockpit-app.html` viewport: `maximum-scale=1, user-scalable=no`.
  - O painel CONTINUA VIVO (replay anima) — não é imagem parada; com o zoom travado, lê como tela de app.
  - SE depois de testar ele ainda disser que "não é app", aí sim discutir reescrever o painel em SwiftUI nativo — é esforço GRANDE e arrisca DIVERGIR do painel aprovado (cockpit-volta-real.html). Não recomendar de cara; confirmar a percepção dele primeiro com a versão sem zoom.
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
