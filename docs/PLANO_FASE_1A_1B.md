# PLANO FASE 1A + 1B — P1 Fast

**Data do plano:** 2026-05-01
**Status:** Aprovado por Flávio · execução iniciada
**Repo:** https://github.com/Flaviomarques1969/p1-fast

---

## Stack tecnológica fechada

| Camada | Tecnologia | Justificativa |
|---|---|---|
| App piloto | iOS Swift nativo (SwiftUI) | ADR-018, sensores 100Hz só com CoreMotion |
| Persistência local | **GRDB** (SQLite) | Schema portável pra Postgres, queryable, sem lock-in |
| Backend nuvem | **Supabase** (projeto isolado do CDAI) | Postgres + Realtime + Auth + Edge Functions |
| Auth | Apple ID + email/senha | Supabase Auth nativo |
| Vídeo ao vivo | **Daily.co** (2 câmeras simultâneas iPhone) | SDK iOS maduro, latência sub-100ms, já usado no CDAI |
| Telemetria ao vivo | **Supabase Realtime** | RLS automático, persistência grátis, mesma stack |
| Histórico | **Supabase Postgres** | Queryable, backup, audit trail |
| Box Cockpit | App iOS modo "BOX" → AirPlay → Apple TV → TV 32" | Reuso do app piloto, zero código tvOS |
| Convite usuário | Link gerado pelo app → share sheet iOS → WhatsApp manual | Sem WhatsApp Business API, simples |

---

## Modelo de papéis

| Papel | Quantidade típica | Permissões |
|---|---|---|
| Admin | 1 (Flávio) | Tudo + convidar + remover + mudar papel |
| Piloto | 2-3 (revezando no carro) | Leitura+escrita, manda mensagem |
| Professor | 1 | Leitura+escrita, manda mensagem |
| Mecânico | 1 | Leitura+escrita, foco em alertas |
| Read-only (mãe, amigos) | 1-3 | Só lê, não escreve, não convida |
| Box TV | 1 sessão (sem login extra) | Reflete celular do operador via AirPlay |

**Regra de visibilidade:** time é workspace aberto — todos os membros veem todos os dados. Mensagens podem ser visíveis no box ou privadas (escolha do remetente). Referências de tempo (best por trecho) são do **time**, não do piloto individual.

---

## Plano de Sprints

### FASE 1A — Captura + Debrief (4-6 semanas)

#### Sprint 1A.1 — Fundação `[em andamento]`

| # | Task | Onde | Critério |
|---|---|---|---|
| 1 | Auditar `src/data/schemas.js`, fechar campos faltantes do ghost-map | Aqui | Smoke 129/0 |
| 2 | Migration Dexie v13 (voltas_planejadas, temperatura_ideal_range, fonte_temperatura, marcos pit-in/out, retas_especiais) | **Cloud** | PR mergeado, smoke verde |
| 3 | Schema Supabase Postgres espelho (migrations SQL) | **Cloud** | Migration aplicada em projeto P1 Fast |
| 4 | Schema GRDB iOS espelho | **Cloud** | swift smoke ≥97 |
| 5 | Inicializar Xcode `p1fast-ios` com SPM (GRDB, Daily.co, Supabase Swift) | Aqui | App roda no simulator |
| 6 | Endpoint `/api/ingest/iphone` migrado pra Supabase Edge Function | **Cloud** | curl + simulator postam OK |

#### Sprint 1A.2 — Hub iOS (11 mockups B)

| # | Task | Onde |
|---|---|---|
| 7 | `Theme.swift` com tokens Padrão B (OKLCH→sRGB) | **Cloud** |
| 8 | Componentes: EyebrowHeader, SummaryStats, Card, Chip, BottomNav, FAB | **Cloud** |
| 9 | Tela Home (cheio + vazio) | **Cloud** |
| 10 | Tela Garagem + Modal Carro + form Carro Novo | **Cloud** |
| 11 | Tela Eventos lista + detalhe | **Cloud** |
| 12 | Modal Stint + 5 sub-modais | **Cloud** |
| 13 | Forms cadastro (piloto, passageiro, combustível, pneu) | **Cloud** |
| 14 | Tela Pendências cascata | **Cloud** |
| 15 | Validação visual contra mockups | Aqui |

#### Sprint 1A.3 — Captura ao vivo

| # | Task | Onde |
|---|---|---|
| 16 | `LiveTelemetryRecorder.swift` (CoreMotion 100Hz + CoreLocation 1Hz) | **Cloud** |
| 17 | Buffer + batch uploader + offline GRDB fallback | **Cloud** |
| 18 | Botão "Iniciar stint" dispara captura | Aqui |
| 19 | Hook fim de stint chama pipeline server-side | Aqui |
| 20 | Edge Function que recebe samples e roda pipeline | **Cloud** |
| 21 | Smoke E2E (simulator → endpoint → debrief JSON) | **Cloud** |

#### Sprint 1A.4 — Debrief pós-stint

| # | Task | Onde |
|---|---|---|
| 22 | Cálculo dos 4 troféus base | **Cloud** |
| 23 | View Pós-Stint SwiftUI | **Cloud** |
| 24 | Endpoint debrief | **Cloud** |
| 25 | Sugestão próximo stint via pedagogical-decider | **Cloud** |
| 26 | Validação visual + dry run com fixture Brasília | Aqui |

#### Sprint 1A.5 — Track day 1

| # | Task | Onde |
|---|---|---|
| 27 | Marcar apex visual 8 trechos Brasília | **Aqui (Flávio)** |
| 28 | Popular seed Brasília completo | **Cloud** (após JSON dos apex) |
| 29 | Calibrar limites alertas Celta (pressão óleo, temp motor, λ) | **Aqui (Flávio)** |
| 30 | Cadastrar regras críticas | **Cloud** |
| 31 | TRACK DAY | **Aqui (Flávio no Celta)** |
| 32 | Ingestão sessão real, debug, virar fixture canônica | Aqui |

#### Sprint 1A.6 — Multi-usuário e box (escopo team)

| # | Task | Onde |
|---|---|---|
| 33 | Auth Supabase + tela login Apple ID/email | **Cloud** |
| 34 | Tela "Convidar pessoa ao time" + share sheet iOS | **Cloud** |
| 35 | RLS Postgres por time (workspace aberto) | **Cloud** |
| 36 | Daily.co integração 2 câmeras simultâneas | **Cloud** |
| 37 | Box Cockpit modo iOS (visão histórica + interação) | **Cloud** |
| 38 | Validação AirPlay → Apple TV → TV 32" | Aqui |
| 39 | Canal de mensagens via Supabase Realtime | **Cloud** |
| 40 | Flag visivelNoBox por mensagem | **Cloud** |

---

### FASE 1B — Cockpit ao vivo (4-6 semanas após 1A em pista)

#### Sprint 1B.1 — Cockpit piloto base

| # | Task | Onde |
|---|---|---|
| 41 | View `CockpitDevice.swift` 956×440 estrutura completa | **Cloud** |
| 42 | Sistema data-attrs → State SwiftUI | **Cloud** |
| 43 | Z-axis transition slot direito | **Cloud** |
| 44 | Halo radial 4 estados (neutro/laranja/ouro/roxo) | **Cloud** |
| 45 | Validação visual contra mockup-cockpit-piloto.html | Aqui |
| 46 | Wireup live: detector → cockpit | Aqui |

#### Sprint 1B.2 — Vista de volta na reta principal

| # | Task | Onde |
|---|---|---|
| 47 | Detector reta principal por tempo médio | **Cloud** |
| 48 | Trigger automático fim de volta + render `data-vista=volta` | **Cloud** |
| 49 | Recálculo volta ótima fim de volta | **Cloud** |

#### Sprint 1B.3 — Ghost map `mapa`

| # | Task | Onde |
|---|---|---|
| 50 | Render trecho via PathKit/MetalKit | **Cloud** |
| 51 | Linha atual 10Hz crescendo | **Cloud** |
| 52 | Orientação configurável (heading/track/north) | **Cloud** |
| 53 | Marcos estáticos | **Cloud** |
| 54 | Etiqueta contexto `Ref: 1.842s · v8` | **Cloud** |
| 55 | Validação contra mockup-cockpit-ghost.html | Aqui |

#### Sprint 1B.4 — Ghost map `mapa-ghost`

| # | Task | Onde |
|---|---|---|
| 56 | Reference line via reference-line.js | **Cloud** |
| 57 | Render dois traços + diff visual | **Cloud** |
| 58 | Cenário sem referência total + aviso plano | **Cloud** |
| 59 | Tela "Plano de stint" (mockup novo) | Aqui primeiro |
| 60 | Port da tela Plano de stint | **Cloud** |

#### Sprint 1B.5 — Fases térmicas + chuva `[BLOQUEADO]`

Aguarda fonte real de temperatura (ECU Injepro Fase 2 OU TPMS Celta).

| # | Task | Onde |
|---|---|---|
| 61 | Detecção fase aquec/resfr por temp real | Cloud |
| 62 | Overlay chuva (3 camadas) | Cloud |
| 63 | Vista resfriamento (lap-data + troféus) | Cloud |

---

## Critério de divisão Aqui × Cloud

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

## Métricas de saúde

| Sinal | Bom | Ruim |
|---|---|---|
| `npm run smoke` | 129+/0 | qualquer regressão |
| `swift run p1fast-smoke` | 97+/0 | qualquer regressão |
| Visual diff Hub | ≤2% vs mockup B | inventou token |
| PRs abertos pelo Cloud | ≤5 simultâneos | fila inflando |
| Tempo entre track days | ≤2 semanas após 1A | pipeline não aprende |

---

## Princípios duráveis

1. **Mockup canônico é contrato imutável** — copiar 1:1, sem inventar token/gap/!important.
2. **Tratamento "você"** — nunca "tu/te/ti/teu/tua".
3. **Sem ícones decorativos** — texto puro em botões/labels.
4. **Cockpits NÃO seguem padrão B** — DNA próprio (preto, accents, halo, slide 3D).
5. **Se estrutura do mockup não couber no consumidor, ADAPTE O CONSUMIDOR, não o mockup.**
6. **Nunca fabricar dados** — "sem referência" é estado válido, exibir explicitamente.
7. **Foco no trecho, não na volta** — volta é consequência.
