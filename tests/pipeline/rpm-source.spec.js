// Smoke spec: rpm-source adapters

import { createManualRpmSource, createMockRpmSource, createBleRpmSource } from '../../src/pipeline/rpm-source.js';

let ok = 0, fail = 0;
const runners = [];
function t(name, fn) { runners.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ─── Manual ──────────────────────────────────────────────────────────────

t('manual: getRpm null antes de start', () => {
  const src = createManualRpmSource();
  src.setRpm(5000);
  assert(src.getRpm() === null);
  assert(src.getStatus() === 'lost');
});

t('manual: start + setRpm → getRpm devolve valor; status connected', () => {
  let now = 1000;
  const src = createManualRpmSource({ now: () => now });
  src.start();
  src.setRpm(5000);
  assert(src.getRpm() === 5000);
  assert(src.getStatus() === 'connected');
});

t('manual: leitura velha → degraded → lost', () => {
  let now = 1000;
  const src = createManualRpmSource({ freshnessMs: 200, now: () => now });
  src.start();
  src.setRpm(5000);
  now += 100;
  assert(src.getStatus() === 'connected');
  now += 200; // 300ms total → > 200, mas < 400 → degraded
  assert(src.getStatus() === 'degraded', 'esperado degraded, foi ' + src.getStatus());
  assert(src.getRpm() === null, 'getRpm() retorna null fora da freshness');
  now += 200; // 500ms total → lost
  assert(src.getStatus() === 'lost');
});

t('manual: setRpm com valor inválido → null', () => {
  const src = createManualRpmSource();
  src.start();
  src.setRpm('abc');
  assert(src.getRpm() === null);
  src.setRpm(-100);
  assert(src.getRpm() === null);
});

t('manual: stop limpa estado', () => {
  const src = createManualRpmSource();
  src.start(); src.setRpm(5000); src.setTps(80);
  src.stop();
  assert(src.getRpm() === null);
  assert(src.getTps() === null);
  assert(src.getStatus() === 'lost');
});

// ─── Mock (scriptado) ────────────────────────────────────────────────────

t('mock: tick(t) avança a leitura via scriptFn', () => {
  const src = createMockRpmSource((t) => ({ rpm: 3000 + t, tps: 80 }));
  src.start();
  src.tick(2000);
  assert(src.getRpm() === 5000);
  assert(src.getTps() === 80);
});

t('mock: sem start retorna null', () => {
  const src = createMockRpmSource(() => ({ rpm: 5000 }));
  src.tick(0);
  assert(src.getRpm() === null);
});

t('mock: scriptFn obrigatória', () => {
  let threw = false;
  try { createMockRpmSource(); } catch { threw = true; }
  assert(threw);
});

// ─── BLE skeleton ───────────────────────────────────────────────────────

t('ble: factory exige device + characteristic + parseValue', () => {
  let threw = 0;
  try { createBleRpmSource({}); } catch { threw++; }
  try { createBleRpmSource({ device: {} }); } catch { threw++; }
  try { createBleRpmSource({ device: {}, rpmCharacteristic: {} }); } catch { threw++; }
  assert(threw === 3, 'esperava 3 erros, foi ' + threw);
});

t('ble: parseValue lê notification e atualiza rpm; status connected/lost', async () => {
  let listener = null;
  let now = 1000;
  const fakeChar = {
    addEventListener: (ev, cb) => { if (ev === 'characteristicvaluechanged') listener = cb; },
    removeEventListener: () => { listener = null; },
    startNotifications: async () => {},
    stopNotifications: () => {}
  };
  const fakeDevice = { gatt: { connected: true } };
  const src = createBleRpmSource({
    device: fakeDevice,
    rpmCharacteristic: fakeChar,
    parseValue: (v) => ({ rpm: v.rpm, tps: v.tps }),
    freshnessMs: 200,
    now: () => now
  });
  await src.start();
  // Simula notification
  listener({ target: { value: { rpm: 5500, tps: 70 } } });
  assert(src.getRpm() === 5500);
  assert(src.getTps() === 70);
  assert(src.getStatus() === 'connected');
  // Avança o tempo: leitura fica velha
  now += 300; // 300 > freshness 200, < 400 → degraded
  assert(src.getStatus() === 'degraded');
  // Simula desconexão
  fakeDevice.gatt.connected = false;
  assert(src.getStatus() === 'lost');
  src.stop();
});

(async () => {
  for (const r of runners) {
    try { await r.fn(); console.log('✓', r.name); ok++; }
    catch (e) { console.log('✗', r.name, '—', e.message); fail++; }
  }
  console.log(`\n[rpm-source.spec] ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
})();
