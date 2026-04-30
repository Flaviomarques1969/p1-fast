// ═══════════════════════════════════════════════════════════
// Smoke ProximityWatcher — F4 dinâmico (Flavio 2026-04-29)
// ═══════════════════════════════════════════════════════════
// Cobre o ciclo arm/prepare/exec/result/disarm acionado por gatilho
// geométrico (forwardDistance ≤ velocidade × janelaSegundos) +
// detector.onSegmentStart/onSegmentEnd. Sem hardware, sem indexedDB.

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;
if (typeof window === 'undefined') globalThis.window = { screen: { width: 390, height: 844 }, devicePixelRatio: 3 };
if (typeof localStorage === 'undefined') globalThis.localStorage = { _s: new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,String(v))}, removeItem(k){this._s.delete(k)}, clear(){this._s.clear()} };

const { ProximityWatcher, forwardDistance, metersPerUnit } = await import('../src/cockpit/proximity-watcher.js');
const { buildLookup } = await import('../src/telemetry/path-mapper.js');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assert failed'); };

// ─── Fixtures ────────────────────────────────────────────────
// Path simples: retângulo de 1000×500 unidades viewBox = perímetro 3000u.
// 2 trechos: T-01 começa em pathStart=10% (offset 300u), T-02 em pathStart=60%.
const SVG_PATH = 'M 0 0 L 1000 0 L 1000 500 L 0 500 Z';
const SEG_T01 = { id: 'seg-T01', nome: 'BICO DE PATO', pathStart: 10, pathEnd: 20 };
const SEG_T02 = { id: 'seg-T02', nome: 'CURVA 2',      pathStart: 60, pathEnd: 70 };

// extensaoMetros = 3000m → metersPerUnit = 1.0 (unidade ≡ metro nesta fixture).
const TRACK_BASE = { id: 'trk-1', svgPath: SVG_PATH, extensaoMetros: 3000 };

function makeFakeFocusMode() {
  const calls = [];
  let etapa = 'inativo';
  let armed = null;
  return {
    calls,
    arm(plan)            { calls.push({ kind: 'arm', plan }); armed = plan?.trechoId; etapa = 'armado'; return { ok: true }; },
    prepare(volta)       { calls.push({ kind: 'prepare', volta }); etapa = 'preparando'; return { ok: true }; },
    enterExecution()     { calls.push({ kind: 'enterExecution' }); etapa = 'executando'; return { ok: true }; },
    result(r)            { calls.push({ kind: 'result', ...r }); etapa = 'resultado'; return { ok: true }; },
    disarm()             { calls.push({ kind: 'disarm' }); armed = null; etapa = 'inativo'; return { ok: true }; },
    onNovaVolta()        { calls.push({ kind: 'onNovaVolta' }); },
    stats: () => ({ etapa, armed }),
  };
}

function makeFakeDetector() {
  const handlers = { lap: new Set(), segmentStart: new Set(), segmentEnd: new Set() };
  return {
    onLap(cb)          { handlers.lap.add(cb);          return () => handlers.lap.delete(cb); },
    onSegmentStart(cb) { handlers.segmentStart.add(cb); return () => handlers.segmentStart.delete(cb); },
    onSegmentEnd(cb)   { handlers.segmentEnd.add(cb);   return () => handlers.segmentEnd.delete(cb); },
    fire(ev, payload)  { for (const cb of handlers[ev]) cb(payload); },
    handlers,
  };
}

function makeWatcher({ trechosFoco = [SEG_T01.id], track = TRACK_BASE, segments = [SEG_T01, SEG_T02], focusMode = makeFakeFocusMode() } = {}) {
  const lookup = buildLookup(track.svgPath, 2000);
  const w = new ProximityWatcher({ track, lookup, segments, trechosFoco, focusMode });
  return { w, lookup, focusMode };
}

function snapshot({ x, y, speedMs, tMono = 1000 }) {
  return { tMono, position: { local_x: x, local_y: y }, vehicle: { speed_fused: speedMs } };
}

// ─── Helpers puros ────────────────────────────────────────────

await t('PW-helper-01: forwardDistance simples sem wrap', () => {
  const d = forwardDistance(100, 300, 1000);
  assert(d === 200, `esperava 200, foi ${d}`);
});
await t('PW-helper-02: forwardDistance com wrap-around', () => {
  const d = forwardDistance(900, 100, 1000);
  assert(d === 200, `esperava 200 (wrap), foi ${d}`);
});
await t('PW-helper-03: metersPerUnit via extensaoMetros', () => {
  const m = metersPerUnit({ extensaoMetros: 3000 }, 3000);
  assert(m === 1.0, `esperava 1.0, foi ${m}`);
});
await t('PW-helper-04: metersPerUnit via geoAncoras', () => {
  const t = {
    geoAncoras: [{ lat: -15.7, lng: -48.0, x: 0, y: 0 }, { lat: -15.7, lng: -48.001, x: 100, y: 0 }],
  };
  const m = metersPerUnit(t, 0); // totalLength irrelevante quando geoAncoras
  // 0.001 deg lng ≈ 107m em -15.7 latitude
  assert(m > 0.5 && m < 2.0, `esperava ~1m/u, foi ${m}`);
});

// ─── Watcher: arm/prepare ────────────────────────────────────

await t('PW-01: arma+prepare quando entra na janela do trecho-foco', () => {
  const { w, lookup, focusMode } = makeWatcher();
  // T-01 pathStart = 10% × 3000u = 300u (no path do retângulo, ~ x=300, y=0)
  // Carro em x=270, y=0 → offset≈270 → forwardDistance até 300 = 30u = 30m
  // velocidade=20m/s × janela=2s = 40m → 30m ≤ 40m → ARMA
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 }));
  const armCall = focusMode.calls.find(c => c.kind === 'arm');
  assert(armCall, 'arm não foi chamado');
  assert(armCall.plan.trechoId === SEG_T01.id);
  assert(armCall.plan.nomeTrecho === 'BICO DE PATO');
  assert(armCall.plan.acao === 'Mantenha linha', `acao default deveria ser 'Mantenha linha', foi '${armCall.plan.acao}'`);
  const prepCall = focusMode.calls.find(c => c.kind === 'prepare');
  assert(prepCall, 'prepare não foi chamado');
});

await t('PW-02: NÃO arma quando ainda fora da janela', () => {
  const { w, focusMode } = makeWatcher();
  // 200u até T-01 (offset 100 → target 300 = 200m de distância) > velocidade×janela=40m
  w.consume(snapshot({ x: 100, y: 0, speedMs: 20 }));
  assert(focusMode.calls.length === 0, `nenhum call esperado, teve ${focusMode.calls.length}`);
});

await t('PW-03: NÃO arma quando velocidade=0', () => {
  const { w, focusMode } = makeWatcher();
  w.consume(snapshot({ x: 290, y: 0, speedMs: 0 }));
  assert(focusMode.calls.length === 0);
});

await t('PW-04: NÃO arma quando trechosFoco vazio', () => {
  const { w, focusMode } = makeWatcher({ trechosFoco: [] });
  w.consume(snapshot({ x: 290, y: 0, speedMs: 20 }));
  assert(focusMode.calls.length === 0);
});

await t('PW-05: inativo quando track sem extensaoMetros nem geoAncoras', () => {
  const trackNoScale = { id: 'trk-x', svgPath: SVG_PATH };  // sem extensaoMetros
  const { w, focusMode } = makeWatcher({ track: trackNoScale });
  assert(w.stats().ativo === false, 'deveria estar inativo');
  w.consume(snapshot({ x: 290, y: 0, speedMs: 20 }));
  assert(focusMode.calls.length === 0);
});

await t('PW-06: idempotência — não arma 2x na mesma volta sem disarm', () => {
  const { w, focusMode } = makeWatcher();
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 }));
  const callsAfter1 = focusMode.calls.length;
  w.consume(snapshot({ x: 280, y: 0, speedMs: 20 }));
  assert(focusMode.calls.length === callsAfter1, 'não deveria armar 2x sem disarm');
});

// ─── Watcher: enterExecution/result/disarm via Detector events ──

await t('PW-07: enterExecution disparado por onSegmentStart do trecho armado', () => {
  const { w, focusMode } = makeWatcher();
  const det = makeFakeDetector();
  w.attach(det);
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 })); // arma
  det.fire('segmentStart', { segmentId: SEG_T01.id });
  assert(focusMode.calls.some(c => c.kind === 'enterExecution'), 'enterExecution não chamado');
});

await t('PW-08: enterExecution NÃO dispara em segmentStart de OUTRO trecho', () => {
  const { w, focusMode } = makeWatcher();
  const det = makeFakeDetector();
  w.attach(det);
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 })); // arma T-01
  det.fire('segmentStart', { segmentId: SEG_T02.id });
  assert(!focusMode.calls.some(c => c.kind === 'enterExecution'), 'enterExecution não deveria disparar pra outro trecho');
});

await t('PW-09: result NEUTRA quando histórico tem < 3 passadas', () => {
  const { w, focusMode } = makeWatcher();
  const det = makeFakeDetector();
  w.attach(det);
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 })); // arma T-01
  det.fire('segmentStart', { segmentId: SEG_T01.id });
  det.fire('segmentEnd',   { segmentId: SEG_T01.id, tempoMs: 4000 });
  const resCall = focusMode.calls.find(c => c.kind === 'result');
  assert(resCall, 'result não chamado');
  assert(resCall.status === 'parcial', `status esperado 'parcial', foi '${resCall.status}'`);
  assert(resCall.texto === 'Repita isso', `texto esperado 'Repita isso', foi '${resCall.texto}'`);
  assert(focusMode.calls.some(c => c.kind === 'disarm'), 'disarm não chamado');
});

await t('PW-10: result BOM quando deltaMs < -50 (mediana de 3 passadas)', () => {
  const { w, focusMode } = makeWatcher();
  const det = makeFakeDetector();
  w.attach(det);
  // Popula histórico: 3 passadas de 4000ms, sem armar
  for (let i = 0; i < 3; i++) {
    det.fire('segmentEnd', { segmentId: SEG_T01.id, tempoMs: 4000 });
  }
  // 4ª passagem armada com tempo 3900ms (delta -100ms vs mediana 4000)
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 }));
  det.fire('segmentStart', { segmentId: SEG_T01.id });
  det.fire('segmentEnd',   { segmentId: SEG_T01.id, tempoMs: 3900 });
  const resCall = focusMode.calls.find(c => c.kind === 'result');
  assert(resCall.status === 'bom', `esperado 'bom', foi '${resCall.status}'`);
  assert(resCall.texto === 'Boa curva');
});

await t('PW-11: result ERRO quando deltaMs > +50', () => {
  const { w, focusMode } = makeWatcher();
  const det = makeFakeDetector();
  w.attach(det);
  for (let i = 0; i < 3; i++) det.fire('segmentEnd', { segmentId: SEG_T01.id, tempoMs: 4000 });
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 }));
  det.fire('segmentStart', { segmentId: SEG_T01.id });
  det.fire('segmentEnd',   { segmentId: SEG_T01.id, tempoMs: 4100 });   // +100ms
  const resCall = focusMode.calls.find(c => c.kind === 'result');
  assert(resCall.status === 'erro', `esperado 'erro', foi '${resCall.status}'`);
  assert(resCall.texto === 'Freou cedo');
});

await t('PW-12: result PARCIAL quando -50 ≤ delta ≤ +50', () => {
  const { w, focusMode } = makeWatcher();
  const det = makeFakeDetector();
  w.attach(det);
  for (let i = 0; i < 3; i++) det.fire('segmentEnd', { segmentId: SEG_T01.id, tempoMs: 4000 });
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 }));
  det.fire('segmentStart', { segmentId: SEG_T01.id });
  det.fire('segmentEnd',   { segmentId: SEG_T01.id, tempoMs: 4030 });   // +30ms
  const resCall = focusMode.calls.find(c => c.kind === 'result');
  assert(resCall.status === 'parcial', `esperado 'parcial', foi '${resCall.status}'`);
  assert(resCall.texto === 'Repita isso');
});

await t('PW-13: histórico cap em N=5 (FIFO)', () => {
  const { w, focusMode } = makeWatcher();
  const det = makeFakeDetector();
  w.attach(det);
  // 7 passadas sem armar — só populando histórico
  for (let i = 0; i < 7; i++) det.fire('segmentEnd', { segmentId: SEG_T01.id, tempoMs: 4000 + i });
  const stats = w.stats();
  assert(stats.historicoSizes[SEG_T01.id] === 5, `esperado cap=5, foi ${stats.historicoSizes[SEG_T01.id]}`);
});

await t('PW-14: onLap atualiza voltaAtual + chama focusMode.onNovaVolta', () => {
  const { w, focusMode } = makeWatcher();
  const det = makeFakeDetector();
  w.attach(det);
  det.fire('lap', { numero: 5 });
  assert(w.stats().voltaAtual === 5);
  assert(focusMode.calls.some(c => c.kind === 'onNovaVolta'));
});

await t('PW-15: SPEC §1 invariante — após disarm pode armar de novo (volta seguinte)', () => {
  const { w, focusMode } = makeWatcher();
  const det = makeFakeDetector();
  w.attach(det);
  // Volta 1: arma + finaliza
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 }));
  det.fire('segmentStart', { segmentId: SEG_T01.id });
  det.fire('segmentEnd',   { segmentId: SEG_T01.id, tempoMs: 4000 });
  // Volta 2: nova volta + se aproxima de novo
  det.fire('lap', { numero: 2 });
  const callsBeforeV2 = focusMode.calls.length;
  w.consume(snapshot({ x: 270, y: 0, speedMs: 20 }));
  const armCallV2 = focusMode.calls.slice(callsBeforeV2).find(c => c.kind === 'arm');
  assert(armCallV2, 'deveria armar novamente na volta 2');
});

console.log(`\n${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
