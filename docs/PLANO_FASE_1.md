# PLANO FASE 1 — P1 Fast

**Data deste plano:** 2026-05-03
**Status:** doc mestre vigente · supersedes `docs/_archive/PLANO_FASE_1A_1B.md`
**Aprovado por:** Flávio (2026-05-03, após audit honesto de Phase 1A)
**Repo:** https://github.com/Flaviomarques1969/p1-fast

> **Em caso de contradição com qualquer outro doc do projeto, este vence.**
> Sub-docs (`SPRINT_*.md`, `HANDOFF_*.md`, `READY_PROMPTS/*`, `IMPLEMENTATION_COVERAGE.md`,
> `STATUS.md`) são derivados e podem desatualizar. Se você é Claude e
> achar contradição, alertar Flávio — não escolher silenciosamente.

---

## 1 — Princípio fundador

**Não há mais Fase 2.** Tudo o que era plano "Fase 2" (Shift Light Premium,
ECU Injepro T4000, fases térmicas com chuva, ghost map de trecho, vista
resfriamento, vista de volta na reta, multi-usuário, box AirPlay, Daily.co,
mensagens Realtime) entra em **Fase 1**.

A v1 do P1 Fast é o app completo: hub + captura ao vivo + debrief + cockpit
ao vivo + multi-usuário + box + vídeo + shift light. Nenhum item fica de
fora.

**Decisão Flávio 2026-05-03 (após audit honesto):** declarar Phase 1A "100%"
em 2026-05-03 noite foi engano — cobria só Sprint 1A.1 + 1A.2 + parte de
infra do 1A.3 do plano antigo. Não faz sentido ter um app de "Fase 1" sem
captura real, sem cockpit ao vivo, sem multi-usuário, sem Shift Light premium —
porque é exatamente isso que o produto entrega ao piloto.

---

## 2 — Stack tecnológica fechada

| Camada | Tecnologia | ADR / fonte |
|---|---|---|
| Hub do piloto (HOME, Eventos, Garagem, Pendências, cadastros) | iOS Swift nativo (SwiftUI) | ADR-018 |
| Captura IMU 100 Hz + GPS 1 Hz + câmera onboard | iOS Swift (CoreMotion + CoreLocation + Daily.co) | ADR-018 |
| **Cockpit-display ao vivo (PRODUTO FINAL)** | **WinUI 3 + C# (.NET 8) nativo Windows**, rodando em notebook + tela 10,5" externa invertida no painel (rotação 180° via Windows Display Settings) | **ADR-023 amendments 4 (2026-05-09) e 5 (2026-05-10)** |
| Cockpit-display (REFERÊNCIA EXECUTÁVEL) | Web app (HTML/CSS/JS) em `web/cockpit/` — protótipo + spec dos smokes; descartado quando port C# fechar | ADR-023 amendment 3 |
| **Driver Injepro T4000 (RPM, marcha, temp, λ, MAP, EGT, etc.)** | **Windows.Devices.SerialCommunication (USB CDC-ACM)** ou adaptador CAN-USB com bindings nativos | **ADR-023 amendment 4 + `docs/hardware/T4000_CAN_SPEC.md`** |
| Persistência local iOS | GRDB (SQLite) | ADR-003 + ADR-020 |
| Persistência local web | Dexie / IndexedDB | ADR-002 (legado, modo referência) |
| Backend nuvem | Supabase (projeto isolado do CDAI) | — |
| Auth | Supabase Auth (Apple ID + email/senha) | — |
| Vídeo ao vivo | Daily.co (câmera onboard frontal do iPhone) | — |
| Telemetria ao vivo | Supabase Realtime (eventos agregados ≤10 Hz, NÃO samples raw) | ADR-014 |
| **Transporte iPhone ↔ notebook Windows** | **Cabo USB primário (TCP-over-USB via `usbmuxd`/`iproxy`, latência 5-15 ms) + Supabase Realtime como fallback automático.** Notebook escolhe via `TransportSelector` baseado em heartbeat 1 Hz. | **ADR-023 (amendment 2 — 2026-05-09)** |
| Histórico | Supabase Postgres | — |
| Box Cockpit | App iOS modo "BOX" → AirPlay → Apple TV → TV 32" | — |
| Convite usuário | Link gerado pelo app → share sheet iOS → WhatsApp manual | — |

---

## 3 — Modelo de papéis

| Papel | Quantidade típica | Permissões |
|---|---|---|
| Admin | 1 (Flávio) | Tudo + convidar + remover + mudar papel |
| Piloto | 2-3 (revezando no carro) | Leitura+escrita, manda mensagem |
| Professor | 1 | Leitura+escrita, manda mensagem |
| Mecânico | 1 | Leitura+escrita, foco em alertas |
| Read-only (mãe, amigos) | 1-3 | Só lê, não escreve, não convida |
| Box TV | 1 sessão (sem login extra) | Reflete celular do operador via AirPlay |

**Regra de visibilidade:** time é workspace aberto — todos os membros veem
todos os dados. Mensagens podem ser visíveis no box ou privadas (escolha
do remetente). Referências de tempo (best por trecho) são do **time**, não
do piloto individual.

---

## 4 — Tiers de hardware (graceful degradation)

Princípio: **app funciona 100% em Tier 0 (só celular).** Tier 1+ são
upgrades opcionais. Nenhuma feature de Tier 1 pode bloquear ação em
Tier 0 — fallback explícito sempre. Ver `feedback_p1fast_graceful_degradation`.

| Tier | Hardware | Ganho | Estado em Tier 0 |
|---|---|---|---|
| **Tier 0** | Só iPhone (sempre) | GPS 1Hz + IMU 100Hz + acelerômetro | base — tudo funciona |
| **Tier 1** | Tier 0 + Injepro **T4000** via BLE | RPM real + marcha real + temp motor | shift light dormente, sem temp real |
| Tier 2 (futuro) | + outras ECUs | normalização multi-ECU | — |
| Tier 3 (futuro) | + datalogger externo | ground-truth canal CAN | — |

**Em Tier 0:**
- Cockpit shift light renderiza só `idle()` (tier 1 verde nas pontas).
- Vista resfriamento + fases térmicas usam estimativas IMU/GPS (sem temp real).
- Tudo de domínio (4 pontos canônicos, debrief, troféus) funciona normal.

**Em Tier 1+:**
- `createBleRpmSource` parado em ECU → liga shift light com aprendizado de reaction.
- Temp motor real → desbloqueia overlay chuva e vista resfriamento "real".

---

## 5 — Estado atual honesto (audit 2026-05-03)

### O que está em `origin/main`

**Sprint 1A.1 do plano antigo — Fundação ✅ feito**
- Migrations Supabase 0001-0006 aplicadas em prod
- GRDB schema iOS (`Migrations.swift`, `AppDatabase.swift`)
- Xcode `p1fast-ios` SPM com GRDB + Supabase Swift
- Edge Function `supabase/functions/ingest` + `health` + `pull` + `sync`

**Sprint 1A.2 do plano antigo — Hub iOS ✅ feito**
- Theme.swift + componentes (EyebrowHeader, SummaryStats, Card, Chip, BottomNav, FAB)
- Telas: Home, Garagem, Modal Carro, CarroNovo, Eventos lista+detalhe, Stint Modal, PosStint
- Forms cadastro: piloto, passageiro, combustível, pneu
- Pendências readonly no EventoDetalheView

**Infra de sync ✅ parcial**
- TelemetryUploader.swift + BackoffPolicy.swift
- SyncQueue + SyncDrainer + PullCursor + PullExecutor (em `p1fast-core/Persistence/`)
- SyncCoordinator + URLSessionTransports + Reachability (em `p1fast-ios/Sync/`)
- SincronizacaoView + SyncStatusBadge

### O que **NÃO** está em `origin/main` (todo escopo desta Fase 1)

Ver mini-sprints abaixo. Em resumo: captura ao vivo (LiveTelemetryRecorder),
domínio canônico portado pro Swift (4 pontos, 12 classificações apex),
StintPlan portado, debrief real (troféus + endpoint + decider), pendências
vivas (CRUD + por carro), shift light + reaction learning portado, adapter
T4000 BLE, multi-usuário (auth + RLS time + convites), Daily.co, box
cockpit + AirPlay, mensagens Realtime, cockpit ao vivo (CockpitDevice +
ghost map + reference line + vista volta + vista resfriamento), fases
térmicas + chuva, track day 1.

---

## 6 — Plano de mini-sprints

Tamanho honesto: **~15 mini-sprints, 35-50 PRs**. Cada um = 2-4 PRs +
`/compact` entre cada (memória `feedback_quebrar_sprint_medio`). Cloud Code
sequencial — 1 PR por vez (ADR-021 + memória `feedback_cloud_code_sequencial`).

**A ordem é por dependência técnica, não por prioridade.** Tudo é v1
(decisão Flávio 2026-05-03). Nenhum mini-sprint pode ser empurrado pra "v2".

### MS-0 — Plano unificado (docs) `[em execução]`

| # | Task | Onde |
|---|---|---|
| 0.1 | Reescrever `docs/PLANO_FASE_1A_1B.md` como `docs/PLANO_FASE_1.md` | Aqui |
| 0.2 | Arquivar antigo em `docs/_archive/` | Aqui |
| 0.3 | Atualizar `STATUS.md` + `CLAUDE.md` apontando pro novo doc mestre | Aqui |
| 0.4 | PR docs-only | Aqui |

### MS-1 — Domínio canônico portado pro Swift

Bloqueia tudo que mede curva. Sem isso, debrief e cockpit ao vivo são mock.

| # | Task | Onde | Critério |
|---|---|---|---|
| 1.1 | Port `src/domain/track-segment.js` 4 pontos (entryPoint, brakingPoint, apexReference, exitPoint) pro Swift em `p1fast-core/Domain/TrackSegment.swift` | Cloud | `swift run p1fast-smoke` verde |
| 1.2 | Port `src/domain/error-classifier.js` (12 classificações de apex) | Cloud | testes Swift cobrindo 12 casos |
| 1.3 | Port `src/domain/trajectory-monitor.js` (`brakingPointDeviationM`, `turnInPointDeviationM`) | Cloud | fixture Brasília bate JS × Swift |
| 1.4 | Configurador visual de pista no app — mover entryPoint/brakingPoint/apexReference/exitPoint no mapa | Cloud | persiste em `track_segments`, sync OK |

### MS-2 — Captura ao vivo (LiveTelemetryRecorder)

Sem captura, debrief é mock. Tier 0 puro.

| # | Task | Onde |
|---|---|---|
| 2.1 | `LiveTelemetryRecorder.swift` — CoreMotion 100Hz + CLLocationManager 1Hz, sample shape canônico (`t`, `tMono`, `accLong/Lat/Vert`, `gyroX/Y/Z`, `lat/lng/speed/heading`) | Cloud |
| 2.2 | Wake lock (`isIdleTimerDisabled`) + Background mode em Info.plist (location + processing) + `LowPowerModeMonitor` | Cloud |
| 2.3 | Botão Iniciar/Encerrar stint dispara captura; Hook fim de stint chama pipeline | Aqui |
| 2.4 | Migration `segment_executions` ganha `vmin_kmh`, `vmin_x`, `vmin_y` — ponto georef onde a velocidade mínima aconteceu (Detector já calcula em `DetectorSegmentEndEvent.velMinima` + `apexActual`). Decisão Flávio 2026-05-04. | Cloud |
| 2.5 | `StintRepository.finalize` consome `Detector.onSegmentEnd` real (sai do mock atual de geração de voltas) e grava o trio Vmin por segment_execution. Pré-req do widget Vmin no cockpit (MS-13) e do Command Box futuro (MS-12). | Cloud |
| **2.8** | **Publish IMU/GPS agregado a 10 Hz em DOIS canais simultâneos** (decisão Flávio 2026-05-09 amendment 2): (a) **TCP socket local `127.0.0.1:5050`** via `NWListener` em iOS — primário, consumido pelo cockpit no notebook Windows via cabo USB (`iproxy`); (b) **Supabase Realtime canal `live-stint-{stintId}`** — fallback do cockpit + canal único do Box Cockpit (MS-12). Payload: `{ tMono, x, y, accLong, accLat, speedKmh, heading, gapDurationMs }`. Inclui heartbeat 1 Hz `{ tMono, source: 'iphone-imu' }` em ambos canais (notebook usa pra detectar queda do cabo). Não confundir com sample raw 100 Hz que continua local-only (ADR-014). | Cloud |

### MS-3 — Edge Function pipeline + smoke E2E

Fecha o loop captura → análise. Roda sem track day real.

| # | Task | Onde |
|---|---|---|
| 3.1 | Edge Function que recebe samples e roda pipeline (port mínimo de `src/telemetry/detector.js` + segmentação) | Cloud |
| 3.2 | Smoke E2E (simulator → endpoint → debrief JSON) com fixture Brasília | Cloud |

### MS-4 — StintPlan portado pro iOS ✅ FECHADO 2026-05-11 (arquitetura ≠ original)

Pré-req do debrief ("objetivo cumprido?"). **Entregue como extensão da tabela `sessoes` em vez de uma tabela `stint_plans` separada — decisão tomada via 37 respostas do Flávio em 2 rodadas de cards** (rodada 1 = 27 perguntas sobre escopo, rodada 2 = 10 perguntas sobre detalhes). Detalhes em `.claude-perguntas/respostas/p1-fast/`.

Escopo entregue cobriu 6 etapas (4 do plano original + 2 bônus). Migration servidor `0014_ms4_sessoes_extensions.sql` e migration local `v14_ms4_sessoes_extensions` adicionaram 7 colunas em `sessoes` (`paradas_box`, `ia_ligada`, `mapa_ghost_ligado`, `licao_id`, `cancelado_em`, `pilotos_revezamento`, `convidado_id`) + papel `chefe_equipe` em `usuarios_time`.

| # | Task | Onde | Submissão |
|---|---|---|---|
| 4.1 | Schema GRDB + migration Supabase com extensões em `sessoes` (não criou tabela `stint_plans` separada). Inclui `paradas_box`, `ia_ligada`, `mapa_ghost_ligado`, `licao_id` (FK pra `licoes`), `cancelado_em`, `pilotos_revezamento` (endurance), `convidado_id` (não-endurance) | Cloud | ✅ PR #176 |
| 4.2 | `StintRepository.swift` ganha métodos `setStintExtensions`, `cancel`, `eventoPermiteRevezamento`, `fetchSessaoCompleta` (não criou `StintPlanRepository` separado) | Cloud | ✅ PR #177 |
| 4.3 | `StintModalView.swift` estendida com paradas no box (chips arrastáveis), picker de lição (do catálogo `licoes`), toggles IA + ghost-map | Cloud | ✅ PR #178 |
| 4.4 | Multi-piloto endurance (lista de turnos cobrindo todas as voltas) + convidado em não-endurance — lógica `EnduranceDetection.tipoPermiteRevezamento` testada com END-01..04 | Cloud | ✅ PR #179 |
| 4.5 | **Bônus além do plano** — cancelamento marcado (long-press + tag visual; `cancelado_em` preserva histórico, não deleta) | Cloud | ✅ PR #180 |
| 4.6 | **Bônus além do plano** — permissões: só piloto + chefe da equipe editam stint. Helper RLS `is_chefe_equipe()` | Cloud | ✅ PR #181 |

**Frentes que ficaram fora do MS-4** (registradas em `docs/FRENTES_POS_MS4.md`, PR #175): F1 Pessoas (cadastro mais rico, papéis múltiplos) · F2 IA durante o stint (P1 Coach ao vivo) · F3 Checklist (separar pendência × obrigatório por carro) · F4 Triagem de vídeo.

### MS-5 — Pendências vivas (obrigatório × adicional, por carro+evento)

**Decisão Flávio 2026-05-03:** corrige a "simples × completo" inicial.
Não há duas listas predefinidas — há lista única com flag `obrigatorio`,
**viva** (CRUD por time), filtrada por carro.

| # | Task | Onde |
|---|---|---|
| 5.1 | Migration Supabase: tabela join `pendencias_template_carros` (template_id, carro_id) — nullable em todos os carros via row sentinela ou ausência de row = aplica a todos | Cloud |
| 5.2 | RLS escrita em `pendencias_template` (não mais readonly global — CRUD por time) | Cloud |
| 5.3 | `PendenciaRepository.swift` ganha `addTemplate`, `editTemplate`, `removeTemplate`, `linkToCarro`, `unlinkFromCarro` | Cloud |
| 5.4 | UI: ao escolher carro do evento, mostra obrigatórios marcados + adicionais filtrados pra escolher; CTA "Adicionar item ao catálogo" leva pra tela de gerenciamento | Cloud |
| 5.5 | `evento_pendencias` ganha flag `incluido` (sim/não) — adicional só entra se marcado | Cloud |

### MS-6 — Debrief pós-stint real

Fecha o pipeline de aprendizado solo (sem multi-usuário ainda).

| # | Task | Onde |
|---|---|---|
| 6.1 | Cálculo dos 4 troféus base em Swift (port de `src/domain/score.js` ou equivalente) | Cloud |
| 6.2 | `PosStintView.swift` consumindo dados reais (hoje é mock) — hero da melhor volta, gaps, lição praticada, trecho-foco | Cloud |
| 6.3 | Endpoint debrief + sugestão próximo stint via port mínimo de `src/domain/pedagogical-decider.js` | Cloud |
| 6.4 | Validação visual + dry run com fixture Brasília | Aqui |

### MS-7 — Track day 1 (operacional, 0 PRs)

Valida MS-1 a MS-6.

| # | Task | Onde |
|---|---|---|
| 7.1 | Marcar entryPoint/brakingPoint/apexReference/exitPoint dos 8 trechos Brasília no app (via configurador do MS-1.4) | Aqui (Flávio) |
| 7.2 | Calibrar limites alertas Celta (pressão óleo, temp motor, λ — em Tier 0 = thresholds heurísticos via IMU/GPS, em Tier 1+ = ECU) | Aqui (Flávio) |
| 7.3 | Cadastrar regras críticas | Cloud (migration de seed) |
| 7.4 | TRACK DAY | Aqui (Flávio no Celta) |
| 7.5 | Ingestão sessão real, debug, virar fixture canônica | Aqui |

### MS-8 — Shift Light Premium portado pro Swift (Tier 0 dormente)

Independe de hardware. Dorme até MS-9 acoplar T4000.

| # | Task | Onde |
|---|---|---|
| 8.1 | Port `src/domain/pilot-reaction.js` (EWMA α=0.15, MIN_SAMPLES=10, RT 50-400ms, tupla piloto×carro×marcha×trecho) | Cloud |
| 8.2 | Port `src/domain/shift-analysis.js` (correct/early/late + frase pedagógica) | Cloud |
| 8.3 | Port `src/pipeline/shift-event-detector.js` + `shift-light-bridge.js` (descarta sample sem RPM) | Cloud |
| 8.4 | Cockpit 12 LEDs Premium em SwiftUI — build-up tier 1-6 (verde→amarelo→vermelho), FIRE (3 pulsos branco-azul ~10Hz, flash device inteiro), OVERREV (pisca vermelho) | Cloud |
| 8.5 | Tela "Reações aprendidas" (port de `src/ui/reaction-profiles-view.js`) | Cloud |
| 8.6 | Em Tier 0: cockpit chama `idle()` na inicialização (só tier 1 verde nas pontas) | Cloud |

### MS-9 — Tier 1: driver Injepro T4000 no notebook Windows (REESCRITO 2026-05-09 — ADR-023)

Liga o shift light, MAP, λ, EGT, temp, marcha, erro ECU. Pré-req do MS-13 (cockpit). Não é mais BLE iOS — virou USB/CAN no notebook Windows que vai rodar o cockpit. Spec do frame está em `docs/hardware/T4000_CAN_SPEC.md`.

| # | Task | Onde |
|---|---|---|
| 9.0 | Decidir container Windows: browser puro (Edge/Chrome com WebSerial pra USB CDC-ACM) vs Electron (Node + biblioteca CAN/serial). Critérios: facilidade de empacotamento, reuso do JS de domínio, distribuição pro Flávio. | Aqui (Flávio + Claude) |
| 9.1 | Captura real do barramento CAN do T4000 conectado ao notebook Windows — resolve as 3 dúvidas residuais do `T4000_CAN_SPEC.md` (diferenciação dos 5 pacotes, bytes 2-6 do pacote 5, range max EGT). | Aqui (Flávio) |
| 9.2 | Port `T4000PacketParser` (JS) — decodifica os 5 pacotes, valida checksum, ordem, range. Fixture obrigatória: exemplo do PDF (`0x91`). | Cloud |
| 9.3 | `T4000Reader` (JS) — driver da interface escolhida em 9.0 (WebSerial CDC-ACM ou node-can / serialport). | Cloud |
| 9.4 | `T4000Provider` — herda contrato `TelemetryProvider`, `source: 't4000-can'`, emite samples normalizados (RPM, marcha, MAP, λ, etc.). | Cloud |
| 9.5 | Publisher Supabase Realtime — Windows publica T4000 agregado a 10 Hz no canal `live-stint-{stintId}` payload `{ tMono, rpm, marcha, mapBar, lambda, oilTempC, waterTempC, oilPressBar, batteryV, tps, ... }`. Consumidores: iPhone (agrega pro storage de longo prazo) e Box Cockpit. | Cloud |
| 9.6 | Cadastro `gear_signatures` + `gear_ratios` + `dyno_curve` por carro (tabelas Supabase + telas de cadastro). UI de cadastro fica no hub iOS. | Cloud |
| 9.7 | Validação em bancada com T4000 conectado ao notebook Windows. | Aqui (Flávio) |

### MS-10 — Multi-usuário + RLS time + convites

Independente de captura. Habilita Bruno/Luiz/Alain no app.

| # | Task | Onde |
|---|---|---|
| 10.1 | Auth Supabase + tela login Apple ID/email | Cloud |
| 10.2 | Tela "Convidar pessoa ao time" + share sheet iOS | Cloud |
| 10.3 | Refinar RLS Postgres por time (workspace aberto, todos veem tudo) — auditar contra `0002_team_signup.sql` + `0003_fix_recursive_rls.sql` | Cloud |
| 10.4 | Modelo de papéis (Admin / Piloto / Professor / Mecânico / Read-only) | Cloud |

### MS-11 — Daily.co 2 câmeras simultâneas

Depende de MS-10 (auth).

| # | Task | Onde |
|---|---|---|
| 11.1 | SDK iOS Daily.co integrado | Cloud |
| 11.2 | Sessão ao vivo 2 câmeras (cockpit + onboard) — escolha do piloto | Cloud |
| 11.3 | Persistência de sessões (id, link, participantes) em Supabase | Cloud |

### MS-12 — Box Cockpit + AirPlay + mensagens Realtime

Depende de MS-10 + MS-11.

| # | Task | Onde |
|---|---|---|
| 12.1 | Box Cockpit modo iOS — visão histórica + interação (tela diferente do cockpit do piloto) | Cloud |
| 12.2 | Validação AirPlay → Apple TV → TV 32" | Aqui (Flávio) |
| 12.3 | Canal de mensagens via Supabase Realtime | Cloud |
| 12.4 | Flag `visivelNoBox` por mensagem | Cloud |

### MS-13 — Cockpit-display ao vivo no notebook Windows (REESCRITO 2026-05-09/10 — ADR-023 + amendments 3/4/5)

Depende de MS-2 + MS-2.8 (live data publish) + MS-9 reescrito (driver T4000 no Windows). **Não é mais SwiftUI** e **não é app web rodando em navegador** — virou **app nativo Windows em WinUI 3 + C# (.NET 8)**, alvo de produção final (ADR-023 amendment 4, decisão Flávio 2026-05-09).

Princípio: o `_design-reference/mockup-cockpit-piloto.html` JÁ é o contrato visual + comportamental. O `web/cockpit/` (HTML/JS) é **referência executável + protótipo** que prova a lógica de domínio com testes verdes — **não é produto final**. Ele serve como spec pra portar pra C# nativo (ADR-023 amendment 3, decisão Flávio 2026-05-09).

> **REGRA DURA (Flávio 2026-05-09):** DOM, classes CSS, tokens (`:root` variables), animações (`@keyframes`), data-attrs e comportamento de TODOS os elementos do mockup canônico — shift-light (12 LEDs + tiers + fire-strobe + overrev), apex header (4 pontos), info-bloco (delta + ação + slide left), alert-bloco (z-axis blur + scale), halo radial (4 estados), stint-bar (12 blocos + bestStint shimmer + bestAlltime bloom), fire-overlay, telemetria-chip, notch — **ficam congelados, byte-for-byte** na versão nativa C#/XAML também. Esta sprint **não redesenha nada visual**. Mockup é contrato imutável (§9.1) e o Flávio reforçou em 2026-05-09.

**Status atual (2026-05-12):** camada de domínio C# portada do JS está fechada em produção via PR #148 (94 testes automáticos em xUnit — 5 módulos: `CockpitState`, `T4000PacketParser`, `T4000Provider`, `TransportSelector`, `LiveDataBridge`). Falta a tela XAML.

| # | Task | Onde | Status |
|---|---|---|---|
| 13.1 | Tela = **PDM-10.5T**, 1920×1280 (3:2), 500 cd/m², USB-C/HDMI. Specs em `docs/hardware/COCKPIT_DISPLAY_PDM-10.5T.md`. Viewport alvo do mockup canônico (atual 956×440) escala 2× pra 1912×880, com letterbox vertical ~200 px topo + base. Rotação 180° via Windows Display Settings. | Aqui (Flávio) | ✅ Fechado 2026-05-10 |
| 13.2 | Referência executável `web/cockpit/` — `index.html` + `cockpit.css` + `cockpit.js` extraídos byte-for-byte do mockup canônico, mais 16 testes automáticos de paridade. | Cloud | ✅ PR #148 (parte) |
| 13.3 | Camada Domain C# — port do `CockpitState` (JS → C#), modelo único alimentado por dado ao vivo. 24 testes (CST-01..24). | Cloud | ✅ PR #148 |
| 13.4 | Camada Domain C# — `LiveDataBridge` + `TransportSelector` + driver T4000 (parser + provider). Escolhe entre cabo USB (primário) e Supabase Realtime (fallback) com heartbeat 1 Hz. 67 testes (T4K-01..27, TRP-01..17, LDB-01..26). | Cloud | ✅ PR #148 |
| 13.5 | Camada Domain C# — `LapDetector` + `DeltaCalculator` + `CommandResolver` + `HaloController` (port do JS). Pode reutilizar parte do `src/telemetry/detector.js` ou da Edge Function. | Cloud | ❌ Não feito |
| 13.6 | Widget Vmin georef por trecho — consome `segment_executions.vmin_*` (MS-2.4/2.5) via Supabase REST. Exibe Vmin (km/h) + ponto (x/y) da melhor volta por trecho. Decisão Flávio 2026-05-04 preservada. | Cloud | ❌ Não feito |
| 13.7 | **Camada UI XAML** — porte fiel do mockup canônico em WinUI 3 + C# (.NET 8), consumindo `CockpitState` via observer. Animações via `Storyboard`, blend modes via `CompositionBrush`/`Visual Layer`, perspectiva 3D via `PerspectiveTransform`. Solution já existe em `windows/cockpit/P1Fast.Cockpit.UI`. | Cloud | ❌ Não feito |
| 13.8 | Empacotamento Windows nativo: instalador `.msix` ou self-contained `.exe` (.NET 8 publish single-file). Tier 0: cockpit funciona com mock data sem T4000 conectado. | Cloud | ❌ Não feito |
| 13.9 | Validação visual side-by-side: notebook Windows com cockpit nativo ao vivo vs `mockup-cockpit-piloto.html` no Mac, ambos com mesmo CYCLE de cenas. Diff visual ≤ 2%. | Aqui | ❌ Não feito |

### MS-14 — Vista de volta + ghost map de trecho + reference line

| # | Task | Onde |
|---|---|---|
| 14.1 | Detector reta principal por tempo médio + render `data-vista=volta` (vista UMA vez por volta) | Cloud |
| 14.2 | Recálculo volta ótima fim de volta | Cloud |
| 14.3 | Ghost map `mapa` — render trecho via PathKit/MetalKit, linha atual 10Hz, orientação heading/track/north, marcos estáticos, etiqueta `Ref: 1.842s · v8` | Cloud |
| 14.4 | Ghost map `mapa-ghost` — reference line, dois traços + diff visual, cenário sem referência (aviso plano) | Cloud |
| 14.5 | Validação contra `mockup-cockpit-ghost.html` | Aqui |

### MS-15 — Fases térmicas + chuva + vista resfriamento

Depende de MS-9 (T4000 fornece temp motor real) — em Tier 0 usa estimativa.

| # | Task | Onde |
|---|---|---|
| 15.1 | Detecção fase aquecimento/resfriamento por temp real (T4000) ou estimativa IMU/GPS (Tier 0) | Cloud |
| 15.2 | Overlay chuva (3 camadas) | Cloud |
| 15.3 | Vista resfriamento (lap-data + troféus pós-volta) | Cloud |

### MS-16 — Command Box Engenharia (aprovado Flávio 2026-05-13)

Núcleo lógico do sistema. Engenharia codificada + IA contextual. Operado pelos iPhones; mostrado na **TV 32" do box** (engenheiro/chefe-de-equipe) e no **Cockpit Pilot 10,5"** (piloto, com overlay de simulação quando parado). Notebook fica kiosk, não é operado. Detalhes completos em `docs/COMMAND_BOX_ENGENHARIA.md` (§1..§15) — auditoria + arquitetura aprovada.

3 decisões fechadas em 2026-05-13: D1 (criar MS-16), D2+D3 (TV 32" via Box Mode iOS + overlay simulação no Cockpit Pilot 10,5"; notebook não é operado), D6 (3 rules MVP: fuel-lean, water-drift, vmin-loss). 11 decisões abertas listadas em §11 do doc — nenhuma bloqueia A→B→C→D→E.

| # | Task | Onde | Status |
|---|---|---|---|
| 16.1 | Port `src/telemetry/timebase.js` → `ios/p1fast-core/Sources/P1FastCore/TelemetryTimebase.swift` + paridade JS↔Swift via fixture sintética | Cloud | ❌ |
| 16.2 | `VehicleContextAggregator.swift` — lap/stint/segment/thermal sem células. Fixture canônica sessão Brasília 2026-05-06 | Cloud | ❌ |
| 16.3 | `CalibrationEngine.swift` + 3 rules MVP (`fuel-lean-sustained-load`, `water-temp-drift-no-cooling`, `vmin-progressive-loss-segment`) + migrations 0020_engineering_findings + 0021_engineering_recommendations | Cloud | ❌ |
| 16.4 | `/api/advisor.js` aceita campo `findings[]`; system prompt ganha §"Findings codificadas"; persiste decisão em `engineering_recommendations` | Cloud | ❌ |
| 16.5 | Tab Engenharia no iOS hub (pós-stint mobile) — lista findings + recommendations + decisão aprovar/editar/rejeitar | Cloud | ❌ |
| 16.6 | iOS Box Mode ganha visão Engenharia — subscribe canal Realtime `live-stint-{id}`, renderiza na TV 32" via AirPlay → Apple TV. Gate: MS-9 + MS-12 fechados | Cloud | ❌ gate |
| 16.7 | Cockpit Pilot 10,5" ganha overlay de simulação (XAML adicional) sincronizado pelo canal `engineering-{stintId}` quando carro parado | Cloud | ❌ |
| 16.8 | Simulação de ajuste (engenheiro pré-visualiza efeito antes de aprovar; projeção por extrapolação linear nos samples atuais da célula) | Cloud | ❌ |
| 16.9 | (Opcional, gate D5) Engine cells RPM × MAP histogram + 2 rules extras (fuel-rich-light, lambda-vs-target) — só se mapa real for carregado | Cloud | ❌ gate |

**Ordem dura:** 16.1 → 16.2 → 16.3 → (16.4 + 16.5 em paralelo) → 16.6 → (16.7 + 16.8 em paralelo) → 16.9.

---

## 7 — Critério de divisão Aqui × Cloud

**Vai pro Cloud Code quando:**
- Mockup canônico 1:1 existe (contrato visual fechado)
- Schema/migration é objetivo
- Cálculo determinístico com fixture
- Refactor com goal claro
- Smoke verde como ground truth

**Fica aqui no terminal quando:**
- Decisão arquitetural pendente
- Validação visual no simulator+browser lado a lado
- Calibração com dado real
- Teste em pista
- Ambiguidade de spec

---

## 8 — Métricas de saúde

| Sinal | Bom | Ruim |
|---|---|---|
| `npm run smoke` | 129+/0 | qualquer regressão |
| `swift run p1fast-smoke` | 97+/0 | qualquer regressão |
| `npm run test:shift-light` | 153+/0 (após port pra Swift, valor pode subir) | qualquer regressão |
| Visual diff Hub | ≤2% vs mockup B | inventou token |
| Visual diff Cockpit | ≤2% vs mockup-cockpit-piloto | inventou token |
| PRs abertos pelo Cloud | ≤1 simultâneo (sequencial) | fila inflando |
| Tempo entre track days | ≤2 semanas após MS-7 | pipeline não aprende |

---

## 9 — Princípios duráveis

1. **Mockup canônico é contrato imutável** — copiar 1:1, sem inventar token/gap/!important.
2. **Tratamento "você"** — nunca "tu/te/ti/teu/tua".
3. **Sem ícones decorativos** — texto puro em botões/labels.
4. **Cockpits NÃO seguem padrão B** — DNA próprio (preto, accents, halo, slide 3D).
5. **Se estrutura do mockup não couber no consumidor, ADAPTE O CONSUMIDOR, não o mockup.**
6. **Nunca fabricar dados** — "sem referência" é estado válido, exibir explicitamente.
7. **Foco no trecho, não na volta** — volta é consequência.
8. **Tier 0 sempre funciona** — feature de Tier 1+ nunca bloqueia ação em Tier 0.
9. **SQLite local = source of truth durante sessão** (ADR-003).
10. **Telemetria append-only, não passa por syncQueue** (ADR-004 + ADR-014).
11. **Worktree obrigatório pra Cloud Code** (ADR-021).
12. **Package.resolved é tracked, não deletar** (ADR-022).

---

## 10 — Decisões já fechadas — não reabrir

- **Vídeo ao vivo:** Daily.co (câmera onboard frontal do iPhone) — §2 deste plano
- **Box cockpit:** App iOS modo BOX → AirPlay → Apple TV → TV 32" — §2
- **Cockpit-display ao vivo migra pra Windows nativo (WinUI 3 + C#)** (notebook hospeda + tela 10,5" externa invertida no painel) — **ADR-023 + amendments 4 e 5**, decisões Flávio 2026-05-09 e 2026-05-10. O `web/cockpit/` em HTML é referência executável + spec dos smokes, não produto final.
- **Driver T4000 fica no Windows** (USB CDC-ACM ou CAN, JS sobre Node/Electron) — **ADR-023**, substitui o plano original BLE iOS
- **Transporte iPhone ↔ Windows = redundante: cabo USB primário (TCP-over-USB via `iproxy`/`usbmuxd`, 5-15 ms) + Supabase Realtime fallback automático.** Notebook escolhe via `TransportSelector` (heartbeat 1 Hz, switch em 3 s, recovery com debounce 1 s). Cabo USB iPhone↔notebook agora carrega **dado + carga**. — **ADR-023 + amendment 2 de 2026-05-09**
- **Captura iOS Swift nativa preservada** (CoreMotion 100 Hz + CoreLocation 1 Hz + Daily.co), hub iOS preservado (HOME, Eventos, Garagem, etc.) — ADR-018 (com amendment 2026-05-09)
- **Plataforma do hub e da captura:** iOS Swift nativo, iPhone único. Sem CarPlay, Apple Watch, Android, PWA pra hub — ADR-018
- **Detector ao vivo:** Port nativo Swift no iPhone, JS no Windows a partir do mesmo domínio — decidido 2026-05-03 / revisitado 2026-05-09 com a nova arquitetura
- **Cockpit landscape:** forçado no notebook Windows (kiosk fullscreen) — revisitado 2026-05-09
- **SQLite local = source of truth durante sessão** — ADR-003
- **Telemetria append-only, NÃO passa por syncQueue** — ADR-004 + ADR-014
- **Worktree mandatório pra Cloud Code** — ADR-021
- **Package.resolved é tracked, não deletar** — ADR-022
- **Pendências obrigatório × adicional, vivas, por carro+evento** — §6 MS-5 (decisão Flávio 2026-05-03, corrige "simples × completo")
- **Apex ≠ Vmin ≠ ponto mais interno geométrico** (decisão Flávio 2026-05-04). Apex = referência de tangência da linha de corrida (organiza rotação e saída — métrica de linha). Vmin = dado dinâmico em runtime (onde o carro foi mais devagar — métrica de velocidade). Saída = métrica dominante quando há reta relevante depois. Configurador (MS-1.4) cadastra apex; Vmin é capturado e persistido em runtime (MS-2.4/2.5) e consumido pelo cockpit (MS-13.6) e Command Box futuro (MS-12).
- **Command Box Engenharia = produto iOS Box Mode → TV 32" + overlay no Cockpit Pilot 10,5"** (decisão Flávio 2026-05-13). Engenheiro e chefe-de-equipe operam pelos iPhones (Box Mode + Tab Engenharia no hub); notebook Windows fica kiosk (não é operado). Cockpit Pilot 10,5" ganha overlay de simulação sincronizado por Realtime quando carro parado. Arquitetura completa em `docs/COMMAND_BOX_ENGENHARIA.md` (auditoria + 8 gaps + 3 camadas + 9 sub-sprints). 3 rules MVP: `fuel-lean-sustained-load`, `water-temp-drift-no-cooling`, `vmin-progressive-loss-segment`.

---

## 11 — Como navegar este plano (para Claude)

1. Antes de propor escopo, ler este doc.
2. Antes de gerar prompt pro Cloud Code, identificar qual MS- é a tarefa.
3. Em cada PR, anotar `MS-X.Y` no título ou body pra rastreabilidade.
4. Após cada mini-sprint mergear, executar `/compact` antes de começar o próximo (memória `feedback_quebrar_sprint_medio`).
5. Após cada merge, entregar bloco copiável do próximo prompt na MESMA mensagem (memória `feedback_coordenacao_cloud_code`).
6. `STATUS.md` é atualizado por mini-sprint (não por PR).
