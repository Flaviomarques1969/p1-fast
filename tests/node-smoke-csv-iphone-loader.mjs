// Smoke do csv-iphone-loader — parsing + integração com ReplayEngine + CSV real.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadIphoneCsv } from '../src/telemetry/csv-iphone-loader.js';
import { ReplayEngine } from '../src/telemetry/replay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_REAL = resolve(__dirname, '../docs/hardware/baselines/iphone16promax-2026-05-01-walking-31s.csv');

let ok = 0, fail = 0;
function t(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(
        () => { console.log('✓', name); ok++; },
        (e) => { console.log('✗', name, '—', e.message); fail++; },
      );
    }
    console.log('✓', name); ok++;
  } catch (e) {
    console.log('✗', name, '—', e.message); fail++;
  }
}

const HEADER = 'ts_iso,tMono_s,kind,accLong_ms2,accLat_ms2,accVert_ms2,lat,lng,speed_ms,gpsAcc_m';

// ── Validação de input ─────────────────────────────────────

t('rejeita text não-string', () => {
  let threw = false;
  try { loadIphoneCsv(null); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar null');
});

t('rejeita CSV vazio', () => {
  let threw = false;
  try { loadIphoneCsv(''); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar vazio');
});

t('rejeita header inválido (colunas trocadas)', () => {
  const bad = 'foo,bar,baz\n';
  let threw = false;
  try { loadIphoneCsv(bad); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar header errado');
});

t('rejeita header com nº de colunas incorreto', () => {
  const bad = 'ts_iso,tMono_s,kind\n';
  let threw = false;
  try { loadIphoneCsv(bad); } catch { threw = true; }
  if (!threw) throw new Error('deveria rejeitar header curto');
});

// ── Parsing básico ─────────────────────────────────────────

t('parsea IMU sample com acc* e lat/lng/speed/gpsAcc null', () => {
  const csv = HEADER + '\n2026-05-01T19:09:54.556Z,9535.152643,imu,-0.922695,-0.724539,0.060005,,,,';
  const r = loadIphoneCsv(csv);
  if (r.samples.length !== 1) throw new Error('samples=' + r.samples.length);
  const s = r.samples[0];
  if (s.kind !== 'imu') throw new Error('kind=' + s.kind);
  if (Math.abs(s.accLong - (-0.922695)) > 1e-6) throw new Error('accLong=' + s.accLong);
  if (Math.abs(s.accLat - (-0.724539)) > 1e-6) throw new Error('accLat=' + s.accLat);
  if (Math.abs(s.accVert - 0.060005) > 1e-6) throw new Error('accVert=' + s.accVert);
  if (s.lat !== null) throw new Error('lat deveria ser null');
  if (s.lng !== null) throw new Error('lng deveria ser null');
  if (s.speed !== null) throw new Error('speed deveria ser null');
  if (s.gpsAccuracy !== null) throw new Error('gpsAccuracy deveria ser null');
  if (r.imuCount !== 1) throw new Error('imuCount=' + r.imuCount);
  if (r.gpsCount !== 0) throw new Error('gpsCount=' + r.gpsCount);
});

t('parsea GPS sample com lat/lng/gpsAccuracy e acc* null', () => {
  const csv = HEADER + '\n2026-05-01T19:09:54.557Z,9535.154225,gps,,,,-15.745963,-47.850021,,3.220527';
  const r = loadIphoneCsv(csv);
  if (r.samples.length !== 1) throw new Error('samples=' + r.samples.length);
  const s = r.samples[0];
  if (s.kind !== 'gps') throw new Error('kind=' + s.kind);
  if (Math.abs(s.lat - (-15.745963)) > 1e-9) throw new Error('lat=' + s.lat);
  if (Math.abs(s.lng - (-47.850021)) > 1e-9) throw new Error('lng=' + s.lng);
  if (Math.abs(s.gpsAccuracy - 3.220527) > 1e-6) throw new Error('gpsAccuracy=' + s.gpsAccuracy);
  if (s.accLong !== null) throw new Error('accLong deveria ser null');
  if (s.accLat !== null) throw new Error('accLat deveria ser null');
  if (s.accVert !== null) throw new Error('accVert deveria ser null');
  if (s.speed !== null) throw new Error('speed deveria ser null');
  if (r.gpsCount !== 1) throw new Error('gpsCount=' + r.gpsCount);
});

t('parsea GPS sample com speed_ms preenchido', () => {
  const csv = HEADER + '\n2026-05-01T19:09:54.557Z,9535.154225,gps,,,,-15.745963,-47.850021,1.234,3.0';
  const r = loadIphoneCsv(csv);
  if (r.samples[0].speed !== 1.234) throw new Error('speed=' + r.samples[0].speed);
});

t('t = Date.parse(ts_iso) e tMono = tMono_s * 1000', () => {
  const csv = HEADER + '\n2026-05-01T19:09:54.556Z,9535.152643,imu,-0.9,-0.7,0.0,,,,';
  const r = loadIphoneCsv(csv);
  const s = r.samples[0];
  const expectedT = Date.parse('2026-05-01T19:09:54.556Z');
  if (s.t !== expectedT) throw new Error('t=' + s.t + ' esperado=' + expectedT);
  if (Math.abs(s.tMono - 9535152.643) > 0.001) throw new Error('tMono=' + s.tMono);
});

t('seq é 0..n-1 na ordem de aparição', () => {
  const csv = HEADER + '\n' +
    '2026-05-01T19:09:54.556Z,9535.152643,imu,-0.9,-0.7,0.0,,,,\n' +
    '2026-05-01T19:09:54.557Z,9535.154225,gps,,,,-15.745963,-47.850021,,3.0\n' +
    '2026-05-01T19:09:54.563Z,9535.160048,imu,-0.8,-0.7,0.0,,,,';
  const r = loadIphoneCsv(csv);
  if (r.samples.length !== 3) throw new Error('samples=' + r.samples.length);
  if (r.samples[0].seq !== 0 || r.samples[1].seq !== 1 || r.samples[2].seq !== 2) {
    throw new Error('seq fora de ordem');
  }
});

t('source override aplica em todos os samples', () => {
  const csv = HEADER + '\n2026-05-01T19:09:54.556Z,9535.152643,imu,-0.9,-0.7,0.0,,,,';
  const r = loadIphoneCsv(csv, { source: 'fixture-A', sessionId: 'sess-X' });
  if (r.samples[0].source !== 'fixture-A') throw new Error('source=' + r.samples[0].source);
  if (r.samples[0].sessionId !== 'sess-X') throw new Error('sessionId=' + r.samples[0].sessionId);
});

t('signalQuality default é "good"', () => {
  const csv = HEADER + '\n2026-05-01T19:09:54.556Z,9535.152643,imu,-0.9,-0.7,0.0,,,,';
  const r = loadIphoneCsv(csv);
  if (r.samples[0].signalQuality !== 'good') throw new Error('signalQuality=' + r.samples[0].signalQuality);
});

// ── Tolerância a linhas inválidas ──────────────────────────

t('linhas vazias e comentários (#) são ignorados', () => {
  const csv = HEADER + '\n' +
    '\n' +
    '# comentário\n' +
    '2026-05-01T19:09:54.556Z,9535.152643,imu,-0.9,-0.7,0.0,,,,\n' +
    '\n' +
    '# outro\n';
  const r = loadIphoneCsv(csv);
  if (r.samples.length !== 1) throw new Error('samples=' + r.samples.length);
  if (r.dropped !== 0) throw new Error('dropped deveria ser 0; veio ' + r.dropped);
});

t('linhas com nº de colunas errado vão para dropped', () => {
  const csv = HEADER + '\n' +
    '2026-05-01T19:09:54.556Z,9535.152643,imu,-0.9,-0.7,0.0,,,,\n' +              // 10 cols → ok
    'curto,demais\n' +                                                              //  2 cols → drop
    '2026-05-01T19:09:54.563Z,9535.160048,imu,-0.8,-0.7,0.0,,,,extra,demais';      // 11 cols → drop
  const r = loadIphoneCsv(csv);
  if (r.samples.length !== 1) throw new Error('samples=' + r.samples.length);
  if (r.dropped !== 2) throw new Error('dropped=' + r.dropped);
});

t('ts_iso inválido vai para dropped', () => {
  const csv = HEADER + '\n' +
    'sexta-feira,9535.152643,imu,-0.9,-0.7,0.0,,,,\n' +
    '2026-05-01T19:09:54.556Z,9535.152643,imu,-0.9,-0.7,0.0,,,,';
  const r = loadIphoneCsv(csv);
  if (r.samples.length !== 1) throw new Error('samples=' + r.samples.length);
  if (r.dropped !== 1) throw new Error('dropped=' + r.dropped);
});

t('tMono_s não-numérico vai para dropped', () => {
  const csv = HEADER + '\n' +
    '2026-05-01T19:09:54.556Z,abc,imu,-0.9,-0.7,0.0,,,,';
  const r = loadIphoneCsv(csv);
  if (r.samples.length !== 0) throw new Error('samples=' + r.samples.length);
  if (r.dropped !== 1) throw new Error('dropped=' + r.dropped);
});

t('kind desconhecido vai para dropped', () => {
  const csv = HEADER + '\n' +
    '2026-05-01T19:09:54.556Z,9535.152643,can,-0.9,-0.7,0.0,,,,\n' +
    '2026-05-01T19:09:54.563Z,9535.160048,imu,-0.8,-0.7,0.0,,,,';
  const r = loadIphoneCsv(csv);
  if (r.samples.length !== 1) throw new Error('samples=' + r.samples.length);
  if (r.dropped !== 1) throw new Error('dropped=' + r.dropped);
  if (r.samples[0].kind !== 'imu') throw new Error('kind=' + r.samples[0].kind);
});

t('CRLF (\\r\\n) é tratado como LF', () => {
  const csv = HEADER + '\r\n' +
    '2026-05-01T19:09:54.556Z,9535.152643,imu,-0.9,-0.7,0.0,,,,\r\n' +
    '2026-05-01T19:09:54.557Z,9535.154225,gps,,,,-15.745963,-47.850021,,3.0\r\n';
  const r = loadIphoneCsv(csv);
  if (r.samples.length !== 2) throw new Error('samples=' + r.samples.length);
  if (r.dropped !== 0) throw new Error('dropped=' + r.dropped);
});

// ── Integração com ReplayEngine ────────────────────────────

t('integração: loader + ReplayEngine instant emite todos', async () => {
  const csv = HEADER + '\n' +
    '2026-05-01T19:09:54.556Z,9535.152643,imu,-0.9,-0.7,0.0,,,,\n' +
    '2026-05-01T19:09:54.557Z,9535.154225,gps,,,,-15.745963,-47.850021,,3.0\n' +
    '2026-05-01T19:09:54.563Z,9535.160048,imu,-0.8,-0.7,0.0,,,,';
  const { samples } = loadIphoneCsv(csv);
  const replay = new ReplayEngine({ samples });
  const seen = [];
  replay.onSample((s) => seen.push(s.kind));
  const result = await replay.start();
  if (result.emitted !== 3) throw new Error('emitted=' + result.emitted);
  if (JSON.stringify(seen) !== JSON.stringify(['imu','gps','imu'])) {
    throw new Error('ordem kind: ' + JSON.stringify(seen));
  }
});

// ── CSV real do projeto ────────────────────────────────────

t('CSV real (3197 IMU + 31 GPS) parseia sem dropped', () => {
  const text = readFileSync(CSV_REAL, 'utf8');
  const r = loadIphoneCsv(text);
  if (r.imuCount !== 3197) throw new Error('imuCount=' + r.imuCount);
  if (r.gpsCount !== 31) throw new Error('gpsCount=' + r.gpsCount);
  if (r.dropped !== 0) throw new Error('dropped=' + r.dropped);
  if (r.samples.length !== 3228) throw new Error('total=' + r.samples.length);
});

t('CSV real: t é monotônico (não-decrescente) na sequência emitida', () => {
  const text = readFileSync(CSV_REAL, 'utf8');
  const { samples } = loadIphoneCsv(text);
  let lastT = -Infinity;
  let violations = 0;
  for (const s of samples) {
    if (s.t < lastT) violations++;
    lastT = s.t;
  }
  if (violations !== 0) throw new Error('violations=' + violations + ' (CSV não-monotônico)');
});

t('CSV real: ReplayEngine instant emite tudo, dropped=0', async () => {
  const text = readFileSync(CSV_REAL, 'utf8');
  const { samples, imuCount, gpsCount } = loadIphoneCsv(text);
  const replay = new ReplayEngine({ samples });
  let imu = 0, gps = 0;
  replay.onSample((s) => {
    if (s.kind === 'imu') imu++;
    else if (s.kind === 'gps') gps++;
  });
  const result = await replay.start();
  if (result.emitted !== samples.length) throw new Error('emitted=' + result.emitted);
  if (result.dropped !== 0) throw new Error('replay dropped=' + result.dropped);
  if (imu !== imuCount) throw new Error('imu emitted=' + imu);
  if (gps !== gpsCount) throw new Error('gps emitted=' + gps);
});

t('CSV real: duração ≈ 31s (firstT/lastT)', () => {
  const text = readFileSync(CSV_REAL, 'utf8');
  const r = loadIphoneCsv(text);
  const durMs = r.lastT - r.firstT;
  if (durMs < 25_000 || durMs > 35_000) throw new Error('duração=' + durMs + 'ms (esperado ~31s)');
});

// ── Final ──────────────────────────────────────────────────

await new Promise((r) => setImmediate(r));
console.log('');
console.log(`csv-iphone-loader: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
