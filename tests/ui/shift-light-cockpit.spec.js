// Smoke spec: shift-light-cockpit (controla a barra do cockpit em runtime)

import { createCockpitShiftLight, resolveCockpitMode } from '../../src/ui/shift-light-cockpit.js';

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Mock minimalista de DOM Element compatível com o módulo
function makeShiftLightEl() {
  const dots = [];
  for (const tier of [1,2,3,4,5,6,6,5,4,3,2,1]) {
    const classes = new Set();
    dots.push({
      _tier: tier,
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        _set: classes
      },
      getAttribute: (k) => k === 'data-tier' ? String(tier) : null
    });
  }
  let state = 'off';
  return {
    _dots: dots,
    state: () => state,
    querySelectorAll: (sel) => sel === '.shift-light__dot' ? dots : [],
    setAttribute: (k, v) => { if (k === 'data-state') state = v; },
    getAttribute: (k) => k === 'data-state' ? state : null
  };
}

function activeTiers(el) {
  return el._dots.filter(d => d.classList.contains('is-on')).map(d => d._tier);
}

t('factory: element ausente → erro', () => {
  let threw = false;
  try { createCockpitShiftLight(null); } catch { threw = true; }
  assert(threw);
});

t('rpm muito baixo → state=off, nenhum dot aceso', () => {
  const el = makeShiftLightEl();
  const sl = createCockpitShiftLight(el);
  sl.update({ rpm: 2000, visualRpm: 6500, redline: 7000 });
  assert(el.state() === 'off');
  assert(activeTiers(el).length === 0);
});

t('rpm subindo → tiers progressivos', () => {
  const el = makeShiftLightEl();
  const sl = createCockpitShiftLight(el);
  sl.update({ rpm: 5500, visualRpm: 6500, redline: 7000 }); // ~50% (já na janela)
  const t1 = activeTiers(el).length;
  sl.update({ rpm: 6200, visualRpm: 6500, redline: 7000 }); // ~80%
  const t2 = activeTiers(el).length;
  assert(t2 > t1, 'tier mais alto deveria acender mais dots, foi ' + t1 + ' → ' + t2);
});

t('modo assisted: rpm >= visualRpm → state=fire, tier 6 acende', () => {
  const el = makeShiftLightEl();
  const sl = createCockpitShiftLight(el, { mode: 'assisted' });
  sl.update({ rpm: 6500, visualRpm: 6400, redline: 7000 });
  assert(el.state() === 'fire', 'esperava fire, foi ' + el.state());
  const tiers = activeTiers(el);
  assert(tiers.includes(6), 'tier 6 deveria estar aceso');
});

t('modo learning: rpm >= visualRpm → state continua off (sem fire)', () => {
  const el = makeShiftLightEl();
  const sl = createCockpitShiftLight(el, { mode: 'learning' });
  sl.update({ rpm: 6500, visualRpm: 6400, redline: 7000 });
  assert(el.state() === 'off', 'em learning não dispara fire, foi ' + el.state());
});

t('rpm > redline → state=overrev', () => {
  const el = makeShiftLightEl();
  const sl = createCockpitShiftLight(el);
  sl.update({ rpm: 7500, visualRpm: 6500, redline: 7000 });
  assert(el.state() === 'overrev');
});

t('setMode altera comportamento sem recriar', () => {
  const el = makeShiftLightEl();
  const sl = createCockpitShiftLight(el, { mode: 'assisted' });
  sl.setMode('learning');
  sl.update({ rpm: 6500, visualRpm: 6400, redline: 7000 });
  assert(el.state() === 'off');
  sl.setMode('assisted');
  sl.update({ rpm: 6700, visualRpm: 6400, redline: 7000 }); // 50 acima do anterior
  assert(el.state() === 'fire');
});

t('reset() apaga tudo', () => {
  const el = makeShiftLightEl();
  const sl = createCockpitShiftLight(el);
  sl.update({ rpm: 6500, visualRpm: 6400, redline: 7000 });
  sl.reset();
  assert(el.state() === 'off');
  assert(activeTiers(el).length === 0);
});

t('idle() — Fase 1: tier 1 aceso nas duas pontas, resto apagado, state=off', () => {
  const el = makeShiftLightEl();
  const sl = createCockpitShiftLight(el);
  sl.idle();
  assert(el.state() === 'off');
  const tiers = activeTiers(el);
  // 12 dots simétricos com tier 1,2,3,4,5,6,6,5,4,3,2,1 → dois dots tier=1
  assert(tiers.length === 2, 'exatamente 2 dots tier=1 acesos, foi ' + tiers.length);
  for (const t of tiers) assert(t === 1, 'tier deveria ser 1, foi ' + t);
});

t('idle() apaga fire pendente', () => {
  const el = makeShiftLightEl();
  const sl = createCockpitShiftLight(el, { mode: 'assisted' });
  sl.update({ rpm: 6500, visualRpm: 6400, redline: 7000 }); // dispara fire
  sl.idle();
  assert(el.state() === 'off');
  assert(activeTiers(el).every(t => t === 1));
});

// ─── resolveCockpitMode ──────────────────────────────────────────────────

t('resolveCockpitMode: requested=learning → learning sem downgrade', () => {
  const r = resolveCockpitMode({ requestedMode: 'learning' });
  assert(r.mode === 'learning' && r.downgraded === false);
});

t('resolveCockpitMode: assisted + confiança baixa → downgrade pra learning', () => {
  const r = resolveCockpitMode({ requestedMode: 'assisted', gearConfidence: 0.5, hasReliableTarget: true });
  assert(r.mode === 'learning' && r.downgraded === true);
  assert(r.reason && r.reason.includes('gear_confidence'));
});

t('resolveCockpitMode: assisted + sem alvo confiável → downgrade pra learning', () => {
  const r = resolveCockpitMode({ requestedMode: 'assisted', gearConfidence: 0.9, hasReliableTarget: false });
  assert(r.mode === 'learning' && r.downgraded === true);
  assert(r.reason && r.reason.includes('reliable target'));
});

t('resolveCockpitMode: assisted + confiança ok + alvo ok → assisted', () => {
  const r = resolveCockpitMode({ requestedMode: 'assisted', gearConfidence: 0.9, hasReliableTarget: true });
  assert(r.mode === 'assisted' && r.downgraded === false);
});

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[shift-light-cockpit.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
