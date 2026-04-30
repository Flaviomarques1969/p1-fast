# P1 Fast

Pacote standalone de **telemetria + domínio + backends** pra track day.
Origem: extração do projeto FAM Racing em 2026-04-30, removendo toda
a UI legada que estava enrolando o desenvolvimento. Aqui você tem
o pipeline funcional pronto pra ser consumido por uma UI nova,
construída do zero, livre dos padrões antigos.

**Zero código de UI legado.** Só telemetria, domínio, schemas, regras e backends.

> **`_design-reference/`** contém 6 mockups visuais canônicos
> (cockpit do piloto, modal evento BC, HOME cheio/vazio, pendências cascata,
> comparação halos). São arquivos auto-contidos para servir de **contrato visual**
> quando você for construir a UI nova — copiar do mockup ao código real,
> sem inventar tokens. Detalhes em [`_design-reference/README.md`](_design-reference/README.md).

## Conteúdo

```
P1 Fast/
├── _design-reference/  ← 6 mockups HTML auto-contidos (referência visual,
│                          não código vivo) + README explicando o uso
├── src/
│   ├── telemetry/   ← detector, session-recorder, cross-validation, timebase,
│   │                  snapshot, data-quality (em src/domain/), sample-store,
│   │                  projector, path-mapper, adaptive-tick, mock-provider,
│   │                  device-provider, provider, fase-curva, corredor
│   ├── pipeline/    ← sample-bus, mobile-telemetry (captura GPS/IMU),
│   │                  iphone-storage (chunks Dexie), iphone-uploader (upload BG),
│   │                  critical-rules, phrases (biblioteca canônica de mensagens)
│   ├── core/        ← db, device, escape, event-active-today, id, logger,
│   │                  sync-queue, sync-drainer, version, entities, effective-setup
│   ├── domain/      ← Dexie wrappers + cálculos de domínio (29 arquivos):
│   │                  Tracks, TrackSegments, Laps, Sessions, Cars,
│   │                  Configurations, fuel-calc, score, repeatability,
│   │                  pedagogical-decider, planned-vs-executed, etc
│   └── data/        ← schemas declarativos extraídos do app.js legado:
│                       schemas.js (SECOES, SEED_*, ITENS_STINT, etc)
│                       override-schemas.js (14 tipos de override de stint)
│                       car-cores.js (4 cores de identidade visual)
├── api/             ← 5 endpoints Vercel (advisor, post-event, post-stint,
│                       video/room, ingest/iphone) + _lib/security
├── tests/           ← 10 smokes Node (71 ok / 0 fail confirmados)
├── docs/
│   ├── telemetry/   ← regras canônicas (CROSS_VALIDATION, APEX_ANALYSIS,
│   │                  CORNER_ANALYSIS, DATA_QUALITY, SNAPSHOT_SPEC, TIMEBASE_SPEC,
│   │                  TELEMETRY_REVIEW, TELEMETRY_ENGINEERING_RULES)
│   ├── hardware/    ← RACEBOX_INTEGRATION_SPEC, T4000_CAN_SPEC
│   ├── domain/      ← rituais de track day (PRE_EVENT_CHECKLIST, debriefs,
│   │                  matrizes piloto/mecânico/engenheiro, FEATURE_ACCEPTANCE,
│   │                  PRODUCT_FOCUS, DELIVERY_REVIEW)
│   └── decision-logs/ ← TD + CTE histórico (filtrado: só entries de telemetria,
│                        sem decisões de cockpit visual)
├── vendor/          ← dexie.min.js (Dexie 4 — pode trocar por `npm i dexie`)
├── ARCHITECTURE_DECISIONS.md  ← 13 ADRs (001-009 + 014-017) — sem ADRs de UI
├── BLOCKERS.md      ← bloqueios de hardware (RaceBox, T4000)
└── package.json     ← scripts + dependências mínimas
```

## O que NÃO está aqui (intencional)

- `cockpit-mobile.html`, `cockpit.html`, `box.html`, `app.html`, `install.html`
- `src/app/*` (hub legado), `src/cockpit/cockpit-display.js`, `src/cockpit/cockpit-state.js`
- `src/cockpit/cockpit-mobile.css`, `src/cockpit/design-tokens.css`, `src/app/app.css`,
  `src/app/hub-bc.css`
- `dev/mockup-*.html`
- `docs/SPEC_COCKPIT.md`, `docs/SPEC_BOX.md`, `docs/SPEC_BOX_VISUAL.md`,
  `docs/SPEC_FOCO_TRECHO.md`, `docs/SPEC_MENSAGENS.md`, `docs/DESIGN_SYSTEM_COCKPIT.md`
- `docs/raceops/BOX_TO_PILOT_TRANSLATION_RULES.md`, `docs/raceops/ALERT_HIERARCHY.md`
- ADRs 010-013 e 018-022 (todos UI/cockpit visual)
- `.claude/agents/fam-design-critic.md`, `.claude/agents/fam-cockpit-design-critic.md`,
  `.claude/agents/fam-compliance-controller.md`, `.claude/hooks/ui-check.sh`

## Validação

Bateria de smokes verde no momento da extração:

```
✓ node-smoke-concurrency
✓ node-smoke-contracts
✓ node-smoke-detector-snapshot     (15 ok)
✓ node-smoke-detector              (3 ok)
✓ node-smoke-migration-port        (8 ok)
✓ node-smoke-migration             (2 ok)
✓ node-smoke-perna1-iphone         (9 ok — pipeline iPhone completo)
✓ node-smoke-projector             (6 ok)
✓ node-smoke-proximity-watcher
✓ node-smoke-telemetry-p0          (28 ok — regressão crítica)

═══ TOTAL: 71 ok / 0 fail ═══
```

Pra rodar: `npm run smoke` (após `npm install`).

## Pontos de entrada (APIs públicas)

```js
// Captura GPS/IMU do iPhone
import { MobileTelemetry, SourceTags } from './src/pipeline/mobile-telemetry.js';
const tel = new MobileTelemetry({ onSample: s => sampleBus.consume(s) });
await tel.start();

// Bus multi-fonte com adaptive-tick
import { sampleBus } from './src/pipeline/sample-bus.js';
sampleBus.attach('iphone', sample => detector.consume(sample));

// Detector — emite onSegmentEnd, onLapEnd
import { Detector } from './src/telemetry/detector.js';
const det = new Detector({ track, onSegmentEnd: e => ..., onLapEnd: l => ... });

// Cross-validation — V-001..V-013
import { CrossValidationEngine } from './src/telemetry/cross-validation.js';
const engine = new CrossValidationEngine();
engine.evaluate(snapshot); // → events[]

// Persistência local (Dexie)
import { iphoneStorage } from './src/pipeline/iphone-storage.js';
await iphoneStorage.openSession({ eventoId, diaId, stintId });
iphoneStorage.ingest(sample);

// Upload BG → /api/ingest/iphone (Vercel Blob)
import { iphoneUploader } from './src/pipeline/iphone-uploader.js';
iphoneUploader.start();

// Frases canônicas (10 ação · 10 confirmação · 4 manutenção · 5 sistema · 5 box)
import { FrasesAcao, FrasesConfirmacao } from './src/pipeline/phrases.js';
```

## Decisões portadas

Leia em ordem para entender o domínio:

1. `ARCHITECTURE_DECISIONS.md` — 13 ADRs fundamentais
2. `docs/telemetry/CROSS_VALIDATION_RULES.md` — V-001..V-013 spec
3. `docs/telemetry/TELEMETRY_SNAPSHOT_SPEC.md` — formato canônico
4. `docs/telemetry/TELEMETRY_TIMEBASE_SPEC.md` — alinhamento N fontes
5. `docs/domain/PRE_EVENT_CHECKLIST.md` — ritual de track day
6. `docs/decision-logs/TECHNICAL_DIRECTOR_DECISION_LOG.md` — histórico
7. `docs/decision-logs/TELEMETRY_ENGINEERING_DECISION_LOG.md` — histórico
8. `BLOCKERS.md` — hardware pendente

## Próximo passo (projeto novo)

1. Copie esta pasta como base do repo novo.
2. `npm install` (Dexie via vendor já incluído; ou troque por `npm i dexie`).
3. `npm run smoke` — confirma que migrou intacto.
4. Construa a UI nova **separada** desse pacote — o pipeline emite eventos
   via callback (`onSegmentEnd`, `onLapEnd`, etc); a UI nova decide o que
   fazer com eles. Nenhum acoplamento com DOM/CSS aqui.
5. Backends Vercel em `api/` rodam sem mudança.

## O que ficou no projeto original (para deletar quando estiver pronto)

- Toda a pasta `src/cockpit/cockpit-display.js`, `src/cockpit/cockpit-state.js`,
  `src/cockpit/cockpit-mobile.css`, `src/cockpit/design-tokens.css`
- Toda a pasta `src/app/`
- Toda a raiz: `cockpit-mobile.html`, `cockpit.html`, `app.html`, `box.html`,
  `install.html`, `index.html`
- Pasta `dev/` (mockups visuais)
- Specs visuais em `docs/`: SPEC_COCKPIT, SPEC_BOX, SPEC_BOX_VISUAL,
  SPEC_FOCO_TRECHO, SPEC_MENSAGENS, DESIGN_SYSTEM_COCKPIT
- ADRs 010-013, 018-022 do `ARCHITECTURE_DECISIONS.md`
- Hooks/agents de design em `.claude/`

---

**Extração feita em:** 2026-04-30
**Smokes verde:** 71 ok / 0 fail
**Origem:** `/Users/imac/Projetos/FAM Racing` commit `wip/20260429-235656`
