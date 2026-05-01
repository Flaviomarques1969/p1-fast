// Smoke spec: shift-event-detector + shift-events Dexie + trecho-resolver

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
globalThis.Dexie = Dexie;

const { createShiftEventDetector } = await import('../../src/pipeline/shift-event-detector.js');
const { saveEvent, listEventsBySession, clearShiftEvents, SHIFT_EVENT_FIELDS } = await import('../../src/data/shift-events.js');
const { setTrechoLookup, clearTrechoLookup, resolveTrechoId } = await import('../../src/data/trecho-resolver.js');

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const car = Object.freeze({
  id: 'car-1',
  redline_rpm: 7000,
  safety_margin_rpm: 300,
  tolerance_rpm: 150,
  gear_signatures: { 1: { rpm_speed_ratio: 250 }, 2: { rpm_speed_ratio: 150 }, 3: { rpm_speed_ratio: 100 } }
});

function makeStream() {
  // Stream com 2 trocas: gear1→2 e gear2→3
  const out = [];
  let t0 = 1000;
  // Gear 1: 12→22 km/h, ratio 250
  for (let s = 12; s <= 22; s += 0.5) {
    out.push({ rpm: Math.round(s * 250), speed: s, tps: 80, accel: { x: 1.5, y: 0, z: 0 }, lat: -15.78, lon: -47.93, timestamp: t0 });
    t0 += 50;
  }
  // Shift 1→2 at speed=22
  out.push({ rpm: Math.round(22 * 150), speed: 22, tps: 70, accel: { x: 0.8, y: 0, z: 0 }, lat: -15.78, lon: -47.93, timestamp: t0 });
  t0 += 50;
  // Gear 2: 22.5→36 km/h, ratio 150
  for (let s = 22.5; s <= 36; s += 0.5) {
    out.push({ rpm: Math.round(s * 150), speed: s, tps: 80, accel: { x: 1.2, y: 0, z: 0 }, lat: -15.78, lon: -47.93, timestamp: t0 });
    t0 += 50;
  }
  // Shift 2→3 at speed=36
  out.push({ rpm: Math.round(36 * 100), speed: 36, tps: 70, accel: { x: 0.6, y: 0, z: 0 }, lat: -15.78, lon: -47.93, timestamp: t0 });
  t0 += 50;
  // Gear 3: 36.5→48
  for (let s = 36.5; s <= 48; s += 0.5) {
    out.push({ rpm: Math.round(s * 100), speed: s, tps: 80, accel: { x: 1.0, y: 0, z: 0 }, lat: -15.78, lon: -47.93, timestamp: t0 });
    t0 += 50;
  }
  return out;
}

// ─── Testes ──────────────────────────────────────────────────────────────

t('detector: stream com 2 trocas conhecidas → emite 2 eventos', async () => {
  const events = [];
  const det = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-1', car,
    onEvent: (ev) => events.push(ev)
  });
  for (const s of makeStream()) det.pushSample(s);
  assert(events.length === 2, 'esperava 2 eventos, foi ' + events.length);
});

t('detector: cada evento tem todos os 25 campos da spec', async () => {
  const events = [];
  const det = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-2', car,
    onEvent: (ev) => events.push(ev)
  });
  for (const s of makeStream()) det.pushSample(s);
  assert(events.length >= 1, 'pelo menos 1 evento');
  for (const ev of events) {
    for (const f of SHIFT_EVENT_FIELDS) {
      assert(Object.prototype.hasOwnProperty.call(ev, f), `campo faltando: ${f}`);
    }
  }
});

t('detector: lesson_text é null neste bloco', async () => {
  const events = [];
  const det = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-3', car,
    onEvent: (ev) => events.push(ev)
  });
  for (const s of makeStream()) det.pushSample(s);
  for (const ev of events) {
    assert(ev.lesson_text === null, 'lesson_text deveria ser null, foi ' + ev.lesson_text);
  }
});

t('detector ignora eventos com TPS<10', async () => {
  const events = [];
  const det = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-tps', car,
    onEvent: (ev) => events.push(ev)
  });
  // Stream onde a queda de RPM acontece com TPS=0 (clutch/neutro) — não deveria virar evento
  let t0 = 1000;
  // Estabiliza em gear 2 (ratio 150) com TPS=80
  for (let i = 0; i < 8; i++) {
    det.pushSample({ rpm: 4500, speed: 30, tps: 80, accel: {x:1,y:0,z:0}, timestamp: t0 });
    t0 += 50;
  }
  // Queda brusca de RPM com TPS=0 (típico de embreagem pisada sem trocar)
  det.pushSample({ rpm: 2500, speed: 30, tps: 0, accel: {x:-0.5,y:0,z:0}, timestamp: t0 });
  t0 += 50;
  // Continua TPS=0 por algum tempo
  for (let i = 0; i < 6; i++) {
    det.pushSample({ rpm: 2500, speed: 30, tps: 0, accel: {x:-0.3,y:0,z:0}, timestamp: t0 });
    t0 += 50;
  }
  assert(events.length === 0, 'TPS<10 não deveria gerar evento, foi ' + events.length);
});

t('persistência: saveEvent é idempotente (mesmo dedup_key não duplica)', async () => {
  await clearShiftEvents();
  const events = [];
  const det = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-idem', car,
    onEvent: (ev) => events.push(ev)
  });
  for (const s of makeStream()) det.pushSample(s);
  assert(events.length >= 1, 'precisamos pelo menos 1 evento');
  const first = events[0];
  const id1 = await saveEvent(first);
  const id2 = await saveEvent(first); // idêntico
  assert(id1 === id2, 'segunda escrita deveria retornar o mesmo id, foi ' + id1 + ' vs ' + id2);
  const all = await listEventsBySession('s-idem');
  assert(all.length === 1, 'deveria haver 1 linha persistida, foi ' + all.length);
});

t('persistência: listEventsBySession retorna eventos da sessão ordenados', async () => {
  await clearShiftEvents();
  const sess = 's-list';
  const events = [];
  const det = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: sess, car,
    onEvent: (ev) => events.push(ev)
  });
  for (const s of makeStream()) det.pushSample(s);
  for (const ev of events) await saveEvent(ev);
  const list = await listEventsBySession(sess);
  assert(list.length === events.length, 'tamanho diferente: ' + list.length + ' vs ' + events.length);
  for (let i = 1; i < list.length; i++) {
    assert(list[i].timestamp >= list[i-1].timestamp, 'lista deveria estar ordenada por timestamp');
  }
});

t('trecho-resolver: sem lookup → null', async () => {
  clearTrechoLookup();
  const id = await resolveTrechoId({ lat: 1, lon: 2, timestamp: 0 });
  assert(id === null, 'id deveria ser null, foi ' + id);
});

t('trecho-resolver: com lookup válido → retorna id; lookup falhando → null', async () => {
  setTrechoLookup(({ lat }) => lat > 0 ? 'trecho-A' : null);
  const a = await resolveTrechoId({ lat: 5, lon: 5, timestamp: 0 });
  const b = await resolveTrechoId({ lat: -5, lon: 5, timestamp: 0 });
  assert(a === 'trecho-A', 'esperado trecho-A');
  assert(b === null, 'esperado null para lookup que retorna null');
  setTrechoLookup(() => { throw new Error('boom'); });
  const c = await resolveTrechoId({ lat: 1, lon: 1, timestamp: 0 });
  assert(c === null, 'lookup que lança deveria retornar null');
  clearTrechoLookup();
});

t('trecho-resolver: lat/lon inválidos → null', async () => {
  setTrechoLookup(() => 'trecho-x');
  const r = await resolveTrechoId({ lat: NaN, lon: 0 });
  assert(r === null, 'lat inválido deveria dar null');
  clearTrechoLookup();
});

t('detector + trecho-resolver: trecho_id preenchido quando GPS válido E sistema responde', async () => {
  const events = [];
  const det = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-tr', car,
    onEvent: (ev) => events.push(ev),
    resolveTrecho: (sample) => 'trecho-reta-1'
  });
  for (const s of makeStream()) det.pushSample(s);
  assert(events.length >= 1);
  for (const ev of events) {
    assert(ev.trecho_id === 'trecho-reta-1', 'trecho_id esperado, foi ' + ev.trecho_id);
  }
});

t('detector + trecho-resolver: sistema indisponível → trecho_id null', async () => {
  const events = [];
  const det = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-tr2', car,
    onEvent: (ev) => events.push(ev),
    resolveTrecho: () => null
  });
  for (const s of makeStream()) det.pushSample(s);
  assert(events.length >= 1);
  for (const ev of events) assert(ev.trecho_id === null);
});

t('saveEvent: dedup_key obrigatório', async () => {
  let threw = false;
  try { await saveEvent({ sessao_id: 'x', timestamp: 0 }); } catch { threw = true; }
  assert(threw, 'deveria lançar sem dedup_key');
});

t('detector: data_inconsistent_flag true quando algum dado essencial é null', async () => {
  // tps=null no momento do shift produz inconsistência (porém não barra emissão, só sinaliza)
  // mas TPS=null cai no gate? Não — apenas TPS<10 barra. TPS=null passa, mas marca flag.
  const events = [];
  const det = createShiftEventDetector({
    piloto_id: 'p1', carro_id: car.id, sessao_id: 's-flag', car,
    onEvent: (ev) => events.push(ev)
  });
  let t0 = 1000;
  // Gear 2 estabilizada
  for (let i = 0; i < 8; i++) {
    det.pushSample({ rpm: 4500, speed: 30, tps: 80, accel:{x:1,y:0,z:0}, timestamp: t0 });
    t0 += 50;
  }
  // Shift sample com tps undefined (tps null)
  det.pushSample({ rpm: 3000, speed: 30, accel:{x:0.5,y:0,z:0}, timestamp: t0 });
  t0 += 50;
  for (let i = 0; i < 6; i++) {
    det.pushSample({ rpm: 3000 + i*30, speed: 30+i*0.5, tps: 80, accel:{x:1,y:0,z:0}, timestamp: t0 });
    t0 += 50;
  }
  assert(events.length === 1, 'esperava 1 evento, foi ' + events.length);
  assert(events[0].data_inconsistent_flag === true, 'flag deveria ser true com tps null');
});

// ─── Runner ──────────────────────────────────────────────────────────────

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[shift-event-detector.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
