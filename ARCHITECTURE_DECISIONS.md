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

> **AMENDMENT 2026-05-09 (Flavio):** o **cockpit-display ao vivo** sai do iOS e migra pra Windows (notebook 10,5" no painel). iPhone preserva captura IMU/GPS + câmera onboard + papel de uploader pra Supabase Realtime. Hub iOS (HOME, Eventos, Garagem, Pendências, cadastros) e Box Cockpit continuam SwiftUI. Detalhes em **ADR-023**.
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
**Decisão (Flavio 2026-05-09)**: a tela viva do cockpit do piloto deixa de ser SwiftUI no iPhone e passa a rodar num **notebook Windows 10,5"** montado no painel. O iPhone continua presente, mas com papel diferente.

**Por que mudou**: o piloto vai ter uma tela maior melhor posicionada no painel (notebook 10,5" landscape, montagem no carro). Fica mais legível em ambiente de pista que a tela do iPhone presa em algum suporte. Decisão de produto, não técnica.

**Papéis na nova arquitetura**:

| Aparelho | Função |
|---|---|
| **Notebook Windows 10,5"** | Cockpit-display ao vivo (web app), driver T4000 (USB/CAN), processamento ao vivo (delta, halo, shift light, apex) com dados próprios + IMU/GPS recebidos do iPhone via Supabase. |
| **iPhone 16 Pro Max** | Captura IMU 100 Hz + GPS 1 Hz (CoreMotion / CoreLocation), câmera onboard frontal (Daily.co), agregador de tudo (sensores próprios + T4000 lido do canal Realtime do Windows) e uploader pro mundo externo. **Sem cockpit-display ativo durante a pilotagem.** |
| **Apple TV (Box Cockpit)** | Inalterado — espelha o cockpit via Supabase Realtime, AirPlay do iPhone do operador do box. |

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
>
> **Stack Windows nativa:** a decidir. Critérios do Flávio: **robustez + alto desempenho + qualidade gráfica extrema**. Opções a apresentar antes da decisão.

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

