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
| App piloto | iOS Swift nativo (SwiftUI) | ADR-018 |
| Persistência local iOS | GRDB (SQLite) | ADR-003 + ADR-020 |
| Persistência local web | Dexie / IndexedDB | ADR-002 (legado, modo referência) |
| Backend nuvem | Supabase (projeto isolado do CDAI) | — |
| Auth | Supabase Auth (Apple ID + email/senha) | — |
| Vídeo ao vivo | Daily.co (2 câmeras simultâneas iPhone) | — |
| Telemetria ao vivo | Supabase Realtime (eventos agregados, NÃO samples) | ADR-014 |
| Histórico | Supabase Postgres | — |
| Box Cockpit | App iOS modo "BOX" → AirPlay → Apple TV → TV 32" | — |
| RPM / marcha (opcional) | ECU Injepro **T4000** via BLE | tier 1 — graceful degradation |
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

### MS-3 — Edge Function pipeline + smoke E2E

Fecha o loop captura → análise. Roda sem track day real.

| # | Task | Onde |
|---|---|---|
| 3.1 | Edge Function que recebe samples e roda pipeline (port mínimo de `src/telemetry/detector.js` + segmentação) | Cloud |
| 3.2 | Smoke E2E (simulator → endpoint → debrief JSON) com fixture Brasília | Cloud |

### MS-4 — StintPlan portado pro iOS

Pré-req do debrief ("objetivo cumprido?").

| # | Task | Onde |
|---|---|---|
| 4.1 | Schema GRDB + migration Supabase `stint_plans` (meta, abordagem, trechosFoco[], focusModeOrigem, nVoltasAlvo, licaoFocoId) | Cloud |
| 4.2 | `StintPlanRepository.swift` (em `p1fast-ios/Persistence/`) | Cloud |
| 4.3 | Refatorar `StintModalView.swift` pra persistir StintPlan (hoje só shell visual) | Cloud |
| 4.4 | Lista de pendências/objetivos dentro do stint (separadas das do evento) | Cloud |

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

### MS-9 — Tier 1: adapter BLE T4000 (RPM/marcha/temp)

Liga o shift light. Liga overlay chuva e vista resfriamento "real".

| # | Task | Onde |
|---|---|---|
| 9.1 | `createBleRpmSource` em Swift (Manual / Mock / BLE — adapter pattern) | Cloud |
| 9.2 | Cadastro `gear_signatures` + `gear_ratios` + `dyno_curve` por carro (tabelas Supabase + telas de cadastro) | Cloud |
| 9.3 | Wire-up cockpit: troca `idle()` por `update({rpm, visualRpm, redline})` quando T4000 conectado | Cloud |
| 9.4 | Validação em bancada com T4000 conectado | Aqui (Flávio) |

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

### MS-13 — Cockpit ao vivo (era Sprint 1B mestre)

Depende de MS-2 (live data) + MS-8 (shift light já portado).

| # | Task | Onde |
|---|---|---|
| 13.1 | `CockpitDevice.swift` 956×440 — apex header + info-bloco + stint-bar + halo + slot direito Z-axis | Cloud |
| 13.2 | Sistema data-attrs → State SwiftUI | Cloud |
| 13.3 | Halo radial 4 estados (neutro / laranja recorde-stint / ouro best-alltime / roxo pior-stint) | Cloud |
| 13.4 | Wireup live: detector → cockpit (`CockpitState`, `LapDetector`, `DeltaCalculator`, `CommandResolver`, `HaloController`) | Cloud |
| 13.5 | Validação visual contra `mockup-cockpit-piloto.html` | Aqui |

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

- **Vídeo ao vivo:** Daily.co (2 câmeras simultâneas iPhone) — §2 deste plano
- **Box cockpit:** App iOS modo BOX → AirPlay → Apple TV → TV 32" — §2
- **Plataforma:** iOS Swift nativo, iPhone único. Sem CarPlay, Apple Watch, Android, PWA — ADR-018
- **Detector ao vivo:** Port nativo Swift, JS aposentado — decidido 2026-05-03
- **Cockpit landscape:** forçado via override só na CockpitView — decidido 2026-05-03
- **SQLite local = source of truth durante sessão** — ADR-003
- **Telemetria append-only, NÃO passa por syncQueue** — ADR-004 + ADR-014
- **Worktree mandatório pra Cloud Code** — ADR-021
- **Package.resolved é tracked, não deletar** — ADR-022
- **Tier 1 = T4000 via BLE** — §4 deste plano. Outras ECUs ficam pra Tier 2+ (futuro).
- **Pendências obrigatório × adicional, vivas, por carro+evento** — §6 MS-5 (decisão Flávio 2026-05-03, corrige "simples × completo")

---

## 11 — Como navegar este plano (para Claude)

1. Antes de propor escopo, ler este doc.
2. Antes de gerar prompt pro Cloud Code, identificar qual MS- é a tarefa.
3. Em cada PR, anotar `MS-X.Y` no título ou body pra rastreabilidade.
4. Após cada mini-sprint mergear, executar `/compact` antes de começar o próximo (memória `feedback_quebrar_sprint_medio`).
5. Após cada merge, entregar bloco copiável do próximo prompt na MESMA mensagem (memória `feedback_coordenacao_cloud_code`).
6. `STATUS.md` é atualizado por mini-sprint (não por PR).
