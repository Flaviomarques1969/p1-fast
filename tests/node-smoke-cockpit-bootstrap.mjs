// Smoke do bootstrap do cockpit (web/cockpit/main.js).
// Spec: PLANO_FASE_1.md §6 MS-13 + ADR-023 amendment 3 (Flávio 2026-05-09)
//
// Roda main.js em Node mockando as APIs de browser (document, performance,
// timers). Confirma que tudo importa, pluga e produz o estado esperado
// após algumas iterações dos timers.

import { readFileSync, existsSync } from 'node:fs';

let ok = 0, fail = 0;
const sync = (name, fn) => {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
};
const asyncT = async (name, fn) => {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
};

// ── Validação estática dos arquivos ──────────────────────

sync('CKB-01 web/cockpit/main.js existe', () => {
  if (!existsSync('web/cockpit/main.js')) throw new Error();
});

sync('CKB-02 web/cockpit/index-live.html existe', () => {
  if (!existsSync('web/cockpit/index-live.html')) throw new Error();
});

sync('CKB-03 index-live.html carrega main.js como módulo (não cockpit.js)', () => {
  const html = readFileSync('web/cockpit/index-live.html', 'utf8');
  if (!html.includes('<script type="module" src="main.js">')) throw new Error('falta main.js como módulo');
  if (html.includes('<script src="cockpit.js"></script>')) throw new Error('não deveria carregar cockpit.js demo');
});

sync('CKB-04 index-live.html linka cockpit.css igual ao index.html', () => {
  const html = readFileSync('web/cockpit/index-live.html', 'utf8');
  if (!html.includes('<link rel="stylesheet" href="cockpit.css">')) throw new Error();
});

sync('CKB-05 main.js importa todos os 4 módulos do cockpit web', () => {
  const js = readFileSync('web/cockpit/main.js', 'utf8');
  for (const mod of ['./cockpit-state.js', './cockpit-renderer.js', './live-data-bridge.js', './transport.js']) {
    if (!js.includes(`from '${mod}'`)) throw new Error(`falta import de ${mod}`);
  }
});

sync('CKB-06 main.js NÃO importa src/telemetry/* (web/cockpit/ é autocontido)', () => {
  const js = readFileSync('web/cockpit/main.js', 'utf8');
  if (js.includes('src/telemetry')) throw new Error('cross-import indevido — protótipo cockpit deve ser autocontido');
});

// ── Execução em Node com mocks de browser ────────────────

await asyncT('CKB-07 main.js carrega em Node com browser mockado e produz estado esperado', async () => {
  function makeEl({ tier } = {}) {
    const el = {
      dataset: tier !== undefined ? { tier: String(tier) } : {},
      textContent: '',
      innerHTML: '',
      className: '',
      _classes: new Set(),
    };
    el.classList = {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      toggle: (c, on) => {
        if (on === undefined) el._classes.has(c) ? el._classes.delete(c) : el._classes.add(c);
        else (on ? el._classes.add(c) : el._classes.delete(c));
      },
      contains: (c) => el._classes.has(c),
    };
    return el;
  }

  const dots = [];
  for (let i = 1; i <= 12; i++) dots.push(makeEl({ tier: i }));

  const apexEntradaVal = makeEl();
  const apexFreioVal = makeEl();

  const elements = {
    'device':     makeEl(),
    'shiftLight': Object.assign(makeEl(), {
      querySelectorAll: (sel) => sel === '.shift-light__dot' ? dots : [],
    }),
    'alertBloco': makeEl(),
    'alertMsg':   makeEl(),
  };
  const querySelectorMap = {
    '.info__delta':                       makeEl(),
    '.info__acao':                        makeEl(),
    '.apex__ponto:nth-child(1)':          Object.assign(makeEl(), {
      querySelector: () => apexEntradaVal,
    }),
    '.apex__ponto[data-papel="freio"]':   Object.assign(makeEl(), {
      querySelector: () => apexFreioVal,
    }),
  };

  globalThis.document = {
    getElementById: (id) => elements[id] ?? null,
    querySelector: (sel) => querySelectorMap[sel] ?? null,
  };
  globalThis.window = {};
  globalThis.performance = { now: () => Date.now() };

  const intervals = [];
  globalThis.setInterval = (cb, ms) => { intervals.push({ cb, ms }); return intervals.length; };
  globalThis.requestAnimationFrame = (cb) => { cb(0); return 1; };

  // Cache-bust pra rodar limpo
  const ts = Date.now();
  await import(`../web/cockpit/main.js?t=${ts}`);

  // 5 rounds disparando todos os timers
  for (let round = 0; round < 5; round++) {
    for (const { cb } of intervals) cb();
  }

  const p1 = globalThis.window.__p1;
  if (!p1) throw new Error('window.__p1 ausente');
  for (const k of ['cockpitState', 'bridge', 'transport', 'primary', 'fallback']) {
    if (!p1[k]) throw new Error(`window.__p1.${k} ausente`);
  }

  const s = p1.cockpitState.get();
  if (!s.shift) throw new Error('shift não inicializou');
  if (!['off','lit','fire','overrev'].includes(s.shift.mode)) throw new Error(`shift.mode=${s.shift.mode}`);
  if (s.delta.value === undefined) throw new Error('delta não populou');

  if (!elements.device.dataset.trechoStatus) throw new Error('renderer não aplicou trechoStatus no device');

  const stats = p1.bridge.getStats();
  if (stats.t4000Count < 1) throw new Error('bridge não recebeu T4000');
  if (stats.imuGpsCount < 1) throw new Error('bridge não recebeu IMU/GPS');

  // Selector tem que estar em ON_PRIMARY (heartbeat foi injetado)
  if (p1.transport.getStats().state !== 'on-primary') {
    throw new Error(`selector esperado on-primary, recebeu ${p1.transport.getStats().state}`);
  }
});

console.log(`\nCockpit bootstrap: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
