// E2E spec: pipeline completo do Shift Light.
// Telemetry samples → Detector + bridge → shift-event-detector → saveEvent
// → listEventsBySession → buildShiftCardsListHTML.

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;

const { Detector } = await import('../../src/telemetry/detector.js');
const { createShiftEventDetector } = await import('../../src/pipeline/shift-event-detector.js');
const { createShiftLightBridge } = await import('../../src/pipeline/shift-light-bridge.js');
const {
  setTrechoSource, clearTrechoSource, getCurrentTrechoIdSync
} = await import('../../src/data/trecho-resolver.js');
const {
  saveEvent, listEventsBySession, clearShiftEvents
} = await import('../../src/data/shift-events.js');
const { buildShiftCardsListHTML } = await import('../../src/ui/shift-cards-view.js');

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const car = Object.freeze({
  id: 'car-celta',
  redline_rpm: 7000,
  safety_margin_rpm: 300,
  tolerance_rpm: 150,
  gear_signatures: { 1: { rpm_speed_ratio: 250 }, 2: { rpm_speed_ratio: 150 }, 3: { rpm_speed_ratio: 100 } }
});

const svgPath = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
const linhaChegada = { x1: -5, y1: 0, x2: 5, y2: 0 };
const segments = [
  { id: 'reta-principal', nome: 'Reta principal', pathStart: 0,  pathEnd: 25 },
  { id: 'curva-1',        nome: 'Curva 1',        pathStart: 25, pathEnd: 50 }
];

function runSession({ sessao_id }) {
  const detector = new Detector({ svgPath, linhaChegada, segments });
  setTrechoSource(detector);

  const events = [];
  const shiftDet = createShiftEventDetector({
    piloto_id: 'flavio', carro_id: car.id, sessao_id, car,
    onEvent: (ev) => { events.push(ev); saveEvent(ev); },
    resolveTrecho: () => getCurrentTrechoIdSync()
  });

  // Canal externo de RPM (simulado): rpm é função de speed × ratio da marcha atual
  let currentGear = 1;
  function rpmFor(speedKmh, gear) {
    const ratios = { 1: 250, 2: 150, 3: 100 };
    return Math.round(speedKmh * ratios[gear]);
  }

  const bridge = createShiftLightBridge({
    shiftDetector: shiftDet,
    getRpm: (sample) => rpmFor(sample.kmh, currentGear)
  });

  // Trajetória sintética: 1 volta com 2 trocas (1→2 e 2→3)
  let ts = 0;
  // Fase 1: gear 1, 12→22 km/h em coords (0,0) — fora de curva-1, dentro de reta-principal
  for (let v = 12; v <= 22; v += 0.5) {
    detector.consume({ x: 25, y: 0, t: ts, speed: v / 3.6 });
    bridge.onTelemetrySample({ tMono: ts, t: ts, source: 'cockpit-mobile', kmh: v, accX: 1.5 });
    ts += 50;
  }
  // Shift 1→2 (rpm cai)
  currentGear = 2;
  detector.consume({ x: 25, y: 0, t: ts, speed: 22 / 3.6 });
  bridge.onTelemetrySample({ tMono: ts, t: ts, source: 'cockpit-mobile', kmh: 22, accX: 0.6 });
  ts += 50;
  // Fase 2: gear 2, 22.5→36 (entra na curva-1 a partir do x=50)
  for (let v = 22.5; v <= 36; v += 0.5) {
    const x = 25 + (v - 22) * 1.5; // marcha no path
    detector.consume({ x, y: 0, t: ts, speed: v / 3.6 });
    bridge.onTelemetrySample({ tMono: ts, t: ts, source: 'cockpit-mobile', kmh: v, accX: 1.2 });
    ts += 50;
  }
  // Shift 2→3 dentro da curva-1
  currentGear = 3;
  detector.consume({ x: 100, y: 0, t: ts, speed: 36 / 3.6 });
  bridge.onTelemetrySample({ tMono: ts, t: ts, source: 'cockpit-mobile', kmh: 36, accX: 0.4 });
  ts += 50;
  // Fase 3: gear 3, 36.5→48
  for (let v = 36.5; v <= 48; v += 0.5) {
    detector.consume({ x: 100, y: (v - 36) * 4, t: ts, speed: v / 3.6 });
    bridge.onTelemetrySample({ tMono: ts, t: ts, source: 'cockpit-mobile', kmh: v, accX: 1.0 });
    ts += 50;
  }

  clearTrechoSource();
  return { events, detector, shiftDet };
}

t('E2E: sessão completa gera 2 shift_events persistidos com trecho_id', async () => {
  await clearShiftEvents();
  const { events } = runSession({ sessao_id: 's-e2e-1' });
  assert(events.length === 2, 'esperava 2 trocas, foi ' + events.length);
  // Aguarda as escritas no Dexie
  await new Promise(r => setTimeout(r, 50));
  const persisted = await listEventsBySession('s-e2e-1');
  assert(persisted.length === 2, 'persistidos: ' + persisted.length);
  // Cada evento tem trecho_id ancorado
  for (const ev of persisted) {
    assert(typeof ev.trecho_id === 'string' && ev.trecho_id.length > 0,
      'trecho_id deveria estar preenchido, foi ' + ev.trecho_id);
  }
});

t('E2E: pós-sessão renderiza N cards com classes coerentes', async () => {
  const persisted = await listEventsBySession('s-e2e-1');
  const html = buildShiftCardsListHTML(persisted, car, (id) => {
    const seg = segments.find(s => s.id === id);
    return seg ? seg.nome : null;
  });
  const cardCount = (html.match(/class="shift-card /g) || []).length;
  assert(cardCount === persisted.length, 'cards renderizados: ' + cardCount);
  // Pelo menos uma classe de status presente
  assert(/is-(correct|early|late|insufficient)/.test(html), 'sem classe de status no HTML');
});

t('E2E: replay (segunda execução) é idempotente — não duplica eventos', async () => {
  // Re-roda com mesma session — dedup_key impede duplicatas
  const { events } = runSession({ sessao_id: 's-e2e-1' });
  for (const ev of events) await saveEvent(ev);
  const persisted = await listEventsBySession('s-e2e-1');
  assert(persisted.length === 2, 'após replay deveria continuar 2, foi ' + persisted.length);
});

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[shift-light-e2e.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
