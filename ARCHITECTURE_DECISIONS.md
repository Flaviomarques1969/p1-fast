# ARCHITECTURE DECISIONS

Cada ADR = uma decisão travada. Não se reabre sem upgrade formal.

---

## ADR-001 — Stack sem bundler
**Decisão**: ES Modules nativos, sem Vite/Webpack.
**Motivo**: simplicidade, zero build step, funciona direto no browser, debuggable.
**Trade-off**: sem tree-shaking. Aceitável no escopo pessoal.

## ADR-002 — Dexie como wrapper IndexedDB
**Decisão**: Dexie 4 via `vendor/dexie.min.js` local (não CDN em runtime).
**Motivo**: API ergonômica, offline garantido, schema versionado.
**Alternativas descartadas**: IndexedDB nativo (verboso), localStorage (insuficiente).

## ADR-003 — Source of truth local durante sessão
**Decisão**: IndexedDB no dispositivo mestre é canonical durante sessão ao vivo. Nuvem é backend pós-sync.
**Motivo**: rede na pista é instável. Não pode travar aquisição de telemetria.
**Consequência**: toda mutation passa por `syncQueue`. Drainer consome depois.

## ADR-004 — Telemetria append-only
**Decisão**: amostras de telemetria nunca são editáveis. Só corrigíveis via "metadados" separados (invalidação, anotação).
**Motivo**: integridade dos dados brutos. Auditoria confiável.

## ADR-005 — Unidade primária = trecho/curva (não volta)
**Decisão**: o domínio analítico é construído sobre SegmentExecution, não Lap.
**Motivo**: pedagogia precisa granularidade. Lap é agregação.

## ADR-006 — Pista em 2 camadas
**Decisão**: layout (linha de chegada + 3 setores macro) é camada 1; trechos/curvas com nomes editáveis é camada 2.
**Motivo**: setores são para timing/estatística; trechos são para análise pedagógica.

## ADR-007 — Device master único por sessão
**Decisão**: 1 device = 1 fonte de telemetria por sessão. Sem merge entre devices.
**Motivo**: merge é não determinístico e frágil. Fallback = trocar master manualmente.

## ADR-008 — IA NÃO em segurança crítica
**Decisão**: alertas críticos são determinísticos (regras fixas). IA só fala de desempenho/pedagogia.
**Motivo**: previsibilidade em situações de risco.

## ADR-009 — SyncQueue só acumula (sem drainer) até Fase 20
**Decisão**: toda mutation enfileira, mas nenhum worker drena a fila ainda. Drainer = Fase 20.
**Motivo**: preserva operação local-first; backend é feature posterior.

## ADR-014 — Telemetria append-only NÃO passa por syncQueue
**Decisão**: `telemetrySamples` é a única store local-first que NÃO enfileira cada row em `syncQueue`. Sincronização remota, quando existir, será por batch/arquivo consolidado — não por row.
**Motivo**: volume proibitivo (10Hz × 1h = 36 000 rows/sessão) tornaria `syncQueue` inviável tanto para escrita local quanto para o futuro drainer. Telemetria é reconstituível a partir de laps+segmentExecutions agregados (que SIM passam por `syncQueue`).
**Trade-off**: replay remoto fino de uma sessão exigirá drainer-de-batch específico no futuro (item registrado em TECH_DEBT_TRACKER). Até lá, o usuário principal é local-first puro.
**Resolve contradição ADR-004 × ADR-009**: ADR-004 garante imutabilidade de amostras; ADR-009 diz "toda mutação enfileira"; ADR-014 declara explicitamente que `telemetrySamples` é a EXCEÇÃO formal a ADR-009, mantendo ADR-004.
**Aplica-se a**: `src/telemetry/sample-store.js` e todas as futuras stores de telemetria de alta frequência (IMU, CAN bus, etc.).

## ADR-015 — Deltas de tempo usam relógio monotônico
**Decisão**: qualquer cálculo de duração (`tempoMs`, `tempoS1Ms`, segmentTempoMs) usa `sample.tMono` (`performance.now()`). `sample.t` (`Date.now()`) é preservado apenas como timestamp auditorial.
**Motivo**: sincronização NTP do dispositivo pode fazer `Date.now()` saltar para trás, gerando deltas negativos impossíveis. `performance.now()` é monotônico por contrato.
**Aplica-se a**: `src/telemetry/detector.js` (tempos de volta e setor), `src/telemetry/session-recorder.js`, qualquer derivada de duração.
**Consequência**: testes usando `Date.now()` mock precisam mockar também `performance.now()` pra simular deltas.

## ADR-016 — Toda interpolação em innerHTML passa por escape
**Decisão**: qualquer string de usuário injetada em `innerHTML` deve passar por `esc()` (`src/core/escape.js`) ou ser inserida via DOM API (`textContent`, `createElement`). Templates com `${variavel}` bruto são proibidos em views.
**Motivo**: box-view e dev-panel interpolavam campos editáveis (nome, motivoInvalidacao, notas) sem sanitização, permitindo XSS local (A-031, A-032, A-035).
**Consequência**: qualquer PR que introduza `innerHTML = \`...${x}...\`` sem `esc(x)` é rejeitado em review. Eventos de clique usam delegação por data-attribute, nunca `onclick="fn('${id}')"`.
**Exceções**: SVG paths pré-definidos (constantes do código), URLs internas fixas. Qualquer input vindo de IndexedDB/localStorage/forms passa por esc.

## ADR-017 — window.FAM restrito em produção
**Decisão**: `window.FAM` é dividido em `FAM_PUBLIC` (versão, status, screenshot — read-only) e `FAM_DEV` (API completa, inclusive mutativa). Em localhost ou `?dev=1`, expõe ambos. Em prod, só `FAM_PUBLIC`.
**Motivo**: XSS local pode chamar `window.FAM.Laps.invalidar(...)` ou `Sessions.destroy(...)`. Reduzir superfície limita blast radius.
**Consequência**: dev console perde conveniência em prod (aceitável — prod é piloto usando, não debug). Integrações futuras precisam feature-flag explícito.

## ADR-018 — App do celular é iOS nativo (Swift). PWA descartado.
**Decisão (Flavio 2026-05-01)**: o app do celular do P1 Fast — cockpit do piloto + hub (HOME, Eventos, Garagem, Pendências, cadastros) — é **iOS nativo em Swift/SwiftUI**. PWA / web no celular é descartado completamente.
**Motivo**: Safari iOS não garante captura DeviceMotion a 10 Hz consistentes. Throttling em background, low-power mode, contexto cross-origin e perda de wake lock degradam a frequência abaixo do necessário pra IMU motorsports. Captura GPS+IMU confiável só com CoreMotion / CoreLocation acessados nativamente.

> **AMENDMENT 2026-05-09 (Flavio):** o **cockpit-display ao vivo** sai do iOS e migra pra Windows (notebook hospeda o app + tela 10,5" externa invertida no painel — ver ADR-023 amendment 5 de 2026-05-10). iPhone preserva captura IMU/GPS + câmera onboard + papel de uploader pra Supabase Realtime. Hub iOS (HOME, Eventos, Garagem, Pendências, cadastros) e Box Cockpit continuam SwiftUI. Detalhes em **ADR-023**.
**Escopo afetado**:
- Mockups B em `_design-reference/*.html` permanecem como **contrato visual** — copiar 1:1 pra SwiftUI, sem inventar tokens. Não são código rodável no celular.
- `src/pipeline/mobile-telemetry.js` (DeviceMotionEvent + Geolocation API) deixa de ser código de runtime do celular — vira **referência de contrato** (Sample shape, freshness por canal, métricas Hz/jitter). Captura real fica em Swift CoreMotion + CoreLocation.
- Hub web (HTML/JS) sai do escopo do celular. Mantido apenas como base de mockup.
- Pipeline puro JS (`src/telemetry/`, `src/domain/`) **continua como base auditável** via Node smokes — pode ser portado pra Swift, embarcado via JavaScriptCore, ou ambos. Decisão futura.
**Decisões pendentes** (não tomadas hoje):
- Swift puro vs SwiftUI + JavaScriptCore embarcando o pipeline JS
- Persistência: SwiftData / CoreData / GRDB / Realm — substitui Dexie no celular
- Android — fora do escopo V1 (Flavio usa iPhone)
**Aplica-se a**: qualquer trabalho futuro de UI no celular. Trabalho de pipeline/domínio/backend em Node/Vercel não é afetado por esta ADR.

## ADR-019 — `retas_especiais` é tabela separada (não flag em `trackSegments`)
**Decisão (Flavio 2026-05-01)**: retas marcadas como "especiais" pra ghost-map vivem em tabela própria `retas_especiais` (campos: `trackId`, `segmentId`, `tempoMedioMs`, `autoDetectada` + `timeId` nullable), NÃO como booleano `ehRetaEspecial` em `trackSegments`.
**Motivo**: a marcação é por **trackId × segmentId** mas pode ter metadados próprios (tempo médio histórico, flag `autoDetectada` separando marcação manual da heurística futura). Misturar com `trackSegments` (que é estrutura geométrica imutável da pista) acopla duas coisas com ciclo de vida diferente: segmento muda quando piloto remapeia a pista; reta especial muda quando o pipeline aprende ou o piloto re-marca.
**Sobre `timeId`** (adicionado em 0001_initial.sql, 2026-05-02): a tabela é híbrida — `time_id NULL` = curadoria global (oficial, compartilhada por todos os times), `time_id` não-nulo = marcação privada do time (auto-detectada pelo pipeline ou re-marcação manual local). Ghost-map aplica fallback: usa a do time se existir, senão a global. Não previsto na spec original mas surge naturalmente do modelo de workspace por time (ver 0001_initial.sql).
**Consequência**: queries de ghost-map fazem JOIN `trackSegments × retas_especiais` por `segmentId` + filtro `(time_id IS NULL OR time_id = current_team)`. Pequeno custo, ganho em separar concerns. `MARCO_TIPOS` ganhou `pit-in`/`pit-out` na mesma migração (v13) pra fechar a spec ghost-map de 2026-05-01.
**Aplica-se a**: `src/data/schemas.js` (RETA_ESPECIAL_FIELDS, MARCO_TIPOS), Dexie v13, schema Postgres do Supabase (espelha 1:1), GRDB iOS (`ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift`).

## ADR-020 — Convenção de paths Swift (repos em ios, structs em core)
**Decisão (validada empiricamente 2026-05-02 no PR #34 Combustíveis)**: Repositories SwiftUI vivem em `ios/p1fast-ios/Sources/Persistence/`, NÃO em `p1fast-core`. Apenas as structs de modelo (Codable + GRDB FetchableRecord/PersistableRecord) entram em `p1fast-core/Sources/P1FastCore/Persistence/Models.swift`.
**Motivo**: `p1fast-core` é Swift puro reusável (também roda no smoke CLI `swift run p1fast-smoke`). Repositories dependem de `@MainActor`, `@Published`, `ObservableObject` — APIs SwiftUI/Combine que não cabem no core. Tentativa inicial de colocar `CombustivelRepository` em core (Prompt #15) foi corrigida pelo Cloud Code dev pra `ios/Persistence/` durante execução.
**Padrão canônico vigente** (todos no path certo): `CarroRepository`, `EventoRepository`, `StintRepository`, `PilotoRepository`, `PassageiroRepository`, `CombustivelRepository`. Próximos a entrar: `PneuRepository` (#14), `LicaoRepository` (#20), `PendenciaRepository` (#21), `TrackRepository` (#19).
**Aplica-se a**: todo prompt futuro pro Cloud Code que cria novo Repository. Models em core, Repos em ios.

## ADR-021 — Worktree obrigatório pra Cloud Code (autosave race protection)
**Decisão (validada empiricamente 2026-05-02 com 2 sessões paralelas)**: prompts pro Cloud Code DEVEM começar com `git worktree add ../p1-fast-{slug} feat/{branch}`. NÃO permitir trocar branch no checkout principal `/Users/imac/Projetos/P1 Fast`.
**Motivo**: o IDE auto-save commita a cada 20-30s no branch atual do checkout principal (memória `feedback_autosave_bypass`). Se o Cloud Code troca branch sem worktree, qualquer arquivo que outra sessão (humano OU outro Claude) editar no checkout principal vai pra branch dele via autosave. Já aconteceu 2x nesta sessão: `docs/CLOUD_CODE_QUEUE.md` e `docs/SPRINT_1A4_DESIGN.md` foram absorvidos pelo PR #34 Combustíveis.
**Consequência**: PRs ficam com edits unrelated, reviewers ficam confusos, cherry-picks viram comuns.
**Padrão a partir de 2026-05-03**: todo prompt autônomo no formato `feat/X` ou `fix/X` começa com worktree explícito. Visto em #14 Pneus, #16-#22, #23-#24.
**Aplica-se a**: todo prompt autônomo futuro pro Cloud Code. Sem exceção.

## ADR-022 — Package.resolved guardrail em PRs SPM
**Decisão (descoberta empírica 2026-05-02 no PR #34)**: `ios/p1fast-core/Package.resolved` é tracked em main (não está em `.gitignore`). Cloud Code rodando `swift build`/`swift run` regenera o arquivo, e às vezes ele entra deletado no diff (visto em commit `fe61cbb`: -72 linhas).
**Motivo**: SPM regenera durante operações de dependency. Sem `.gitignore`, ele entra no `git rm` ou stage parcial. Deletar quebra reproducibility de CI/novos checkouts.
**Mitigação**:
1. Todo prompt autônomo pro Cloud Code que mexe em `ios/p1fast-core/` inclui explicitamente: `❌ NÃO autorizado: tocar Package.resolved`.
2. Audit de PRs SPM sempre roda: `git diff main..HEAD --stat -- ios/p1fast-core/Package.resolved` (esperado: vazio).
3. Se foi deletado e build seguinte regenerou, autosave recupera — verificar com `git ls-tree HEAD ios/p1fast-core/Package.resolved` vs `git ls-tree main` (blob hashes batem = OK).
4. Se não auto-recuperou: `git checkout main -- ios/p1fast-core/Package.resolved && git add . && git commit -m "fix: restore Package.resolved" && git push`.
**Aplica-se a**: todo PR que toca `ios/p1fast-core/`. Memória `feedback_package_resolved_gotcha.md` tem o procedimento operacional.

## ADR-023 — Cockpit-display ao vivo migra pra Windows; T4000 deixa de ser BLE iOS
**Decisão (Flavio 2026-05-09, refinada 2026-05-10 amendment 5)**: a tela viva do cockpit do piloto deixa de ser SwiftUI no iPhone e passa a rodar num **notebook Windows** com **tela 10,5" externa** plugada nele e montada no painel do carro **de cabeça pra baixo** (rotação 180° via Windows Display Settings). O iPhone continua presente, mas com papel diferente.

**Por que mudou**: o piloto vai ter uma tela maior melhor posicionada no painel (10,5" landscape externa, montagem no carro). Fica mais legível em ambiente de pista que a tela do iPhone presa em algum suporte. Decisão de produto, não técnica.

**Papéis na nova arquitetura**:

| Aparelho | Função |
|---|---|
| **Notebook Windows** (host) | Hospeda o app cockpit (WinUI 3 + C# .NET 8), driver T4000 (USB/CAN), processamento ao vivo (delta, halo, shift light, apex) com dados próprios + IMU/GPS recebidos do iPhone via cabo USB / Supabase Realtime. Display interno do notebook fica com a área de trabalho normal pra engenheiro/instalador. |
| **Tela 10,5" externa** (target visual do piloto) | Plugada no notebook (HDMI/USB-C/DisplayPort), montada **invertida** no painel, rotação 180° via Windows Display Settings. Recebe a janela cockpit fullscreen (`--display-index 2`). É a tela cuja resolução nativa define o viewport alvo do mockup canônico (MS-13.1). |
| **iPhone 16 Pro Max** | Captura IMU 100 Hz + GPS 1 Hz (CoreMotion / CoreLocation), câmera onboard frontal (Daily.co), agregador de tudo (sensores próprios + T4000 lido do canal Realtime do Windows) e uploader pro mundo externo. **Sem cockpit-display ativo durante a pilotagem.** |
| **Command Box (TV 32")** | TV de 32" no box, acessada por um **Fire TV Stick 4K Max** que roda o navegador e abre o **app na nuvem** (que consome o canal Supabase Realtime). Não há mais Apple TV nem AirPlay/espelhamento pelo celular. (atualizado 16/06/2026 — ver docs/ARQUITETURA_DEFINITIVA.md) |

**Transporte entre Windows e iPhone**: ambos publicam no **Supabase Realtime** e ambos assinam o canal contrário. Sem cabo de dados entre eles. O cabo USB iPhone↔notebook serve só pra manter a bateria do iPhone. Latência típica 150-500 ms — aceita pra primeiro field test, pode migrar pra Wi-Fi local (iPhone hotspot + WebSocket) se virar dor.

> **AMENDMENT 2026-05-09 (Flávio, decisão 2):** transporte iPhone↔Windows passa a ser **redundante** — **cabo USB primário (TCP-over-USB via `usbmuxd`/`iproxy`)** com **Supabase Realtime como fallback automático**.
>
> - **Cabo USB (primário)**: app iOS abre `NWListener` em `127.0.0.1:5050`; no Windows, daemon `iproxy` (libimobiledevice) expõe `127.0.0.1:5050` pareado com a porta do iPhone via USB; cockpit web conecta no socket local. Latência típica 5-15 ms. Não usa plano de dados, não precisa Personal Hotspot, não compete com 4G/5G.
> - **Supabase Realtime (fallback)**: iPhone publica no canal `live-stint-{stintId}` em paralelo (mesmo payload, mesma cadência 10 Hz). Já é o canal que o **Box Cockpit** consome de qualquer jeito — então não há custo extra de manter o publisher Realtime ligado.
> - **Selector no Windows**: `TransportSelector` com healthcheck por heartbeat de 1 Hz; se cabo silencia por 3 s, troca pra Realtime; quando cabo volta a heartbeatar, volta pro cabo (debounce 1 s).
> - **Setup no notebook**: instalar **Apple Devices** (Microsoft Store, gratuito) + empacotar `iproxy` no cockpit. `Apple Mobile Device Service` cuida do enxoval USB; sem MFi certification.
> - **Cabo USB iPhone↔notebook**: agora é cabo de **dados + carga** — mesmo cabo USB-C que ia ser usado pra carga.
>
> **Restrição inalterada (já documentada):** iOS bloqueia TCP socket + CoreMotion 100 Hz em background. App iOS precisa estar em foreground durante o stint — mesma constraint do MS-2 atual. Mitigação (banner "captura interrompida" + gap recovery do A-07) cobre cabo e Realtime igual.
>
> **Implicações no plano**: MS-2.8 reescrito (publicar nos dois canais simultâneos), MS-13.4 ganha `TransportSelector` (web/cockpit/transport.js).

**Stack do cockpit Windows**:
- Cockpit = **web app** baseado no `_design-reference/mockup-cockpit-piloto.html` (já é HTML/CSS/JS pronto, contrato visual fechado).
- **Mockup é congelado byte-for-byte (Flávio 2026-05-09):** DOM, classes CSS, tokens `:root`, `@keyframes`, data-attrs e comportamento de todos os elementos (shift-light 12 LEDs + tiers + fire/overrev, apex header 4 pontos, info-bloco delta+ação+slide, alert-bloco z-axis, halo radial 4 estados, stint-bar 12 blocos com shimmer/bloom, fire-overlay, telemetria-chip, notch) NÃO são tocados. MS-13 só embala em arquivos de produção, ajusta viewport pro notebook 10,5", e substitui o demo cycle por live data — sem redesenho.
- Container de execução no Windows: a decidir entre browser puro (Edge/Chrome) ou Electron com driver T4000 embutido. Ver MS-9 / MS-13 reescritos.
- Driver T4000: USB traseiro do T4000 (CDC-ACM serial) ou adaptador CAN-USB. Spec do frame fechada em `docs/hardware/T4000_CAN_SPEC.md` (5 pacotes, big-endian, checksum validado matematicamente, 3 dúvidas residuais não-bloqueantes).

> **AMENDMENT 3 (Flávio 2026-05-09):** o **produto final** do cockpit Windows e do hub iPhone é **NATIVO**, não web/PWA. O conteúdo do diretório `web/cockpit/` é **referência executável + protótipo de validação** — serve pra (1) demonstrar visualmente o mockup canônico no notebook hoje, (2) provar a lógica de domínio (`CockpitState`, `TransportSelector`, `LiveDataBridge`, `T4000PacketParser`, regras de RPM→shift e alertas críticos) com smokes verdes em JS e (3) servir de espec executável pra ser portada pro app nativo Windows quando ele for construído. Os smokes JS viram o **contrato de teste** do app nativo (cada caso JS deve ter um equivalente C# / .NET / outra stack que escolheremos). O `cockpit-renderer.js` é o único módulo descartável (DOM-bindings específicos de HTML); todo o resto da lógica é portável.

> **AMENDMENT 4 (Flávio 2026-05-09):** stack do cockpit Windows nativo é **WinUI 3 + C# (.NET 8+)**. Decisão final.
>
> **Por quê:**
> - **Performance:** Composition API roda animações em thread dedicada da GPU. Latência estado→pixel ~16-17 ms. GC pause raro <3 ms. Suficiente pra cockpit de pista (reação humana treinada ~100 ms).
> - **Qualidade gráfica:** atende 100% do mockup canônico — OKlch (via conversão pra RGB), 8 keyframes complexos (Composition.AnimationGroup), `mix-blend-mode: screen` (BlendMode.Screen), `backdrop-filter: blur` (AcrylicBrush), perspective 3D + translateZ (Transform3D + PlaneProjection), box-shadow multilayer (DropShadow stack), radial gradients (RadialGradientBrush). Sem comprometer um efeito sequer.
> - **Robustez:** Microsoft mantém oficialmente, suporte 20+ anos garantido. Stack atual recomendada da Microsoft pra apps Windows nativos.
> - **Custo:** zero licença, sem restrição comercial em qualquer store.
> - **Velocidade de desenvolvimento:** C# 1,5-2x mais rápido que C++/Qt. Hot reload XAML no Visual Studio. Compilação em segundos. Mercado de devs C# = oceano.
> - **Stores compatível:** se um dia portar partes pra Microsoft Store, MSIX nativo. (Mobile iOS/Android continua decisão separada — ADR-018 segue valendo).
>
> **Trade-off aceito:** não é "padrão automotivo igual Tesla/BMW" (que usam Qt). Pra P1 Fast esse selo não importa — não é certificação industrial, é cockpit pra carro de track day.

> **AMENDMENT 5 (Flávio 2026-05-10):** correção de entendimento sobre o hardware de display. **Quem roda o app é o notebook Windows; quem o piloto OLHA é uma tela 10,5" externa**, plugada nesse notebook (HDMI / USB-C / DisplayPort), montada no painel do carro. **A tela é instalada de cabeça pra baixo**, então a imagem precisa estar **rotacionada 180°** pra ficar legível pelo piloto.
>
> **Como a rotação é feita:** via **Windows Display Settings → Orientação do monitor 2 = 180°**. NÃO no código do app. Razões:
> 1. Custo zero pra desenvolvimento (sem `RotateTransform 180` no XAML, sem código de mapeamento de input).
> 2. Aplica também ao mouse/touch quando o piloto ou mecânico precisar interagir com a tela.
> 3. É uma config que o instalador faz uma vez e fica permanente.
>
> **Implicações pra o app cockpit:**
> 1. **Multi-monitor:** o app precisa abrir fullscreen no **monitor 2** (a tela 10,5" externa), não no display interno do notebook. Configurável via argumento (`--display-index N`) ou auto-detecção (escolhe o de maior área quando há ≥2 monitores).
> 2. **Notebook (display 1):** fica com a área de trabalho normal pra o engenheiro/instalador interagir. App não toma o display 1.
> 3. **Dimensão alvo do mockup:** continua sendo definida pela **tela 10,5"** (não pelo notebook). Resolução nativa, DPR e área útil dessa tela são o que importa pro `viewport` (MS-13.1).
>
> **Checklist de instalação no carro (criar quando MS-13 fechar):**
> 1. Plugar tela 10,5" no notebook (HDMI/USB-C).
> 2. Windows Display Settings → "Estender estes monitores".
> 3. Identificar a 10,5" como display 2 e marcar **Orientação = 180°**.
> 4. Posicionar a tela 10,5" "à direita" do display 1 nas configurações (independente do físico, importa pra cursor mapping).
> 5. Rodar `P1Fast.Cockpit.UI.exe --display-index 2` (ou shortcut equivalente).
>
> **Próximos passos práticos** (gated, requer Windows + Visual Studio):
> 1. Criar `windows/cockpit/` com solution C# (.NET 8 + Windows App SDK / WinUI 3).
> 2. Portar `CockpitState` JS → C# (puro, testável com xUnit). Cada smoke JS vira fato xUnit equivalente.
> 3. Portar `T4000PacketParser` + fixture do PDF (`0x91`).
> 4. Portar `TransportSelector` + `LiveDataBridge` + regras de RPM/alertas.
> 5. Implementar `CockpitView.xaml` em XAML 1:1 com `_design-reference/mockup-cockpit-piloto.html` — DOM web vira árvore visual XAML, CSS vira Style/Resource, @keyframes vira Storyboard / Composition Animation.
> 6. Driver T4000 USB (Windows.Devices.SerialCommunication) e cliente `iproxy` pra cabo iPhone.
> 7. Empacotamento MSIX + atalho kiosk fullscreen no notebook 10,5".
>
> **Trabalho JS continua valendo** como spec executável até cada peça ser portada pra C# com smokes equivalentes verdes.

**Stack do iPhone**:
- Captura iOS Swift continua mandatória (ADR-018 segue valendo pra essa parte).
- `LiveTelemetryRecorder` ganha consumidor novo: publish em canal Realtime `live-stint-{stintId}` a 10 Hz (IMU/GPS agregados — não 100 Hz raw, isso fica só no SQLite local conforme ADR-014).
- Daily.co continua planejado pra câmera onboard (MS-11).
- Hub iOS (HOME, Eventos, Garagem, Pendências, cadastros) **NÃO migra** — segue SwiftUI.

**Consequências**:
- **MS-9 reescrito**: deixa de ser "BLE T4000 via CoreBluetooth" e vira "driver T4000 USB/CAN no Windows + publish em Supabase Realtime". Move pra antes de MS-13.
- **MS-13 reescrito**: deixa de ser "CockpitDevice 956×440 SwiftUI" e vira "cockpit web app rodando em Windows 10,5" (e em iOS WKWebView no Box, se vier a fazer sentido)". O mockup canônico vira o produto, com tweaks pra dimensão alvo 10,5" (área visível ~954×517 a ~1280×692 dependendo de DPR).
- **MS-2 ganha 2.8**: publish IMU/GPS agregado a 10 Hz em canal Realtime.
- **MS-12 Box Cockpit**: inalterado. Continua iOS + AirPlay + Apple TV.
- **MS-11 Daily.co**: papel da câmera onboard fica mais explícito (frente do carro, pra Supabase pra ver no Box).

**ADR-018 NÃO é revogado** — recebe amendment apontando pra cá. iOS continua mandatório pra captura, hub e Box. PWA continua descartado **pra captura**. O cockpit-display web no Windows é caso novo (não cabe no escopo original do ADR-018, que é específico do celular).

**Aplica-se a**: PLANO_FASE_1.md §2 (stack), §6 (mini-sprints MS-2/9/13), §10 (decisões fechadas); STATUS.md; CLAUDE.md (decisões fechadas).

---

## ADR-024 — Vídeo ao vivo MVP: câmera DJI no notebook + Daily.co (atualizada 2026-06-09)

**Status:** decisão fechada, validada em campo 2026-06-09 (teste de aparelhos: "a imagem apareceu e o gps também").

**Histórico:** reservada em 2026-05-11 com stream MVP = câmera frontal do iPhone + Daily.co (Insta360 fora; Cloudflare/LiveKit fora). Em 2026-06-09, com a chegada do hardware, o Flávio trocou a fonte da imagem: **a câmera deixa de ser o iPhone e passa a ser a DJI Osmo Action 6 ligada no notebook Windows** (modo webcam USB/UVC, 1080p).

**Decisão vigente:**
- Transporte: **Daily.co** (inalterado). Qualidade: **1080p** (inalterado).
- Fonte da imagem: **DJI Osmo Action 6 → cabo USB → notebook Windows da pista** (a DJI vira webcam padrão; não existe API da DJI pra PC comandar gravação interna — quem captura é o notebook).
- Transmissor: página web no navegador do notebook (`web/teste-aparelhos/` · publicada no endereço de teste p1tv.vercel.app), junto com o GPS RaceBox.
- Quem assiste: app iOS P1 Fast (tela ao vivo) e/ou página `/painel` no celular.
- Subida pela internet da pista (**Starlink**).
- Insta360, Cloudflare e LiveKit continuam fora.

**Consequência:** o iPhone sai do caminho do vídeo. Captura de telemetria iOS (ADR-018) não muda.

---

## ADR-025 — Fonte da verdade do Detector ao vivo

**Status:** decisão fechada. Aprovada pelo Flávio em 2026-05-12 via página de decisões F4 (`.claude-perguntas/respostas/p1-fast/20260512-130000-f4-decisoes.json`, campo `d5_adr025_detector: SWIFT`).

**Contexto:** a lógica de detecção de trechos (Detector — identifica entry, braking, apex, exit, fim de volta) hoje vive em 3 lugares:

1. `src/telemetry/detector.js` — original em JavaScript, primeiro porte do conceito, cresceu junto com `fase-curva.js` + `path-mapper.js`.
2. `ios/p1fast-core/Sources/P1FastCore/Detector.swift` — porte parcial pra Swift (~60%), usado pelo app real do iPhone durante captura ao vivo via `SampleDetectorAdapter` + `LiveDetectorBridge`.
3. `supabase/functions/detector/index.ts` — port pra Deno na Edge Function `/functions/v1/detector`, deployed em prod 2026-05-06.

Sem fonte da verdade declarada, a lógica pode divergir entre as 3 implementações conforme cada uma evolui. Auditoria estrutural 2026-05-12 marcou isso como dívida arquitetural real.

**Decisão proposta:** **Swift em `p1fast-core/Detector.swift` é a fonte da verdade** do Detector ao vivo, daqui pra frente.

**Por quê:**
- Captura real acontece dentro do app iOS. O Detector ao vivo precisa rodar em milisegundos junto da captura, sem rede.
- O app iOS já tem cobertura de testes automáticos (smokes) sustentando o porte Swift e bate na captura real desde o field test de 2026-05-06.
- ADR-018 (captura iOS nativa) é decisão fechada — alinhar o Detector com ela respeita a hierarquia.

**Papel das outras duas implementações:**
- `src/telemetry/detector.js` — **referência legada**. Mantida pra histórico e leitura comparativa do algoritmo. Não vai mais ser fonte de mudança; quando o Swift divergir, o JS fica para trás. Cabeçalho do arquivo deve apontar pra esta ADR.
- `supabase/functions/detector/index.ts` — **reprocessamento pós-stint** (batch contra fixtures, debug, regerar debrief antigo). Não é usada no caminho ao vivo. Quando o algoritmo Swift mudar, esta Edge Function precisa ser atualizada manualmente OU o caso de uso "reprocessar" ser deprecado.

**Consequências:**
- Mudanças no algoritmo de detecção entram primeiro no Swift, com smoke novo.
- Edge Function só recebe atualização quando o caso de uso "reprocessar sessão antiga" for exercitado (gated por necessidade real).
- Quando o caminho de reprocessamento pós-stint for realmente usado (debrief profundo de sessões antigas), avaliar se vale consolidar a Edge Function chamando o Swift compilado para Linux (server-side Swift) ou se mantém o port Deno.
- O JS em `src/telemetry/detector.js` pode ficar dormente até MS-14/15. Quando esses entrarem, decidir caso a caso se atualizar ou aposentar.

**Não revoga:**
- ADR-014 (telemetria append-only — quem grava continua sendo o Swift dentro do app).
- ADR-018 (captura iOS Swift mandatória).

**Aplica-se a:** `src/telemetry/detector.js` (cabeçalho), `supabase/functions/detector/index.ts` (cabeçalho), `docs/PLANO_FASE_1.md` §6 (MS-13.5 que ainda fala em "reutilizar parte do `src/telemetry/detector.js` ou Edge Function").

