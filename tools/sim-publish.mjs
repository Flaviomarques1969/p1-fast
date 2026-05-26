// sim-publish.mjs — publica amostras sintéticas no canal cockpit-bubi-live.
// Pra testar a ponte sem a T3000 plugada. Roda: node tools/sim-publish.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

const client = createClient(SUPABASE_URL, SUPABASE_ANON);
const ch = client.channel('cockpit-bubi-live', { config: { broadcast: { ack: false, self: false } } });

await new Promise((resolve, reject) => {
  ch.subscribe((s) => {
    console.log('canal:', s);
    if (s === 'SUBSCRIBED') resolve();
    if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') reject(new Error(s));
  });
});

let t = 0;
const interval = setInterval(async () => {
  t += 0.2;
  const rpm = Math.round(2000 + 2000 * Math.sin(t));
  const sample = {
    source: 't3000-usb-sim',
    parserVersion: '2.0.0-sim',
    tMono: performance.now(),
    tWall: Date.now(),
    bytesLen: 460,
    rpm,
    batteryV: 13.8 + 0.1*Math.sin(t*2),
    mapBar: 0.95 - 0.4*Math.sin(t),
    tpsPct: Math.max(0, 50 + 50*Math.sin(t)),
    tpsTargetPct: Math.max(0, 50 + 50*Math.sin(t)),
    airTempC: 35, waterTempC: 88,
    lambda: 0.95, mapaAtual: 1, consumoBorboleta: 12,
    pedalAceleradorPct: Math.max(0, 50 + 50*Math.sin(t)),
    pedalFreioPct: 0, pressaoFreioBar: 0,
    speedKmh: Math.round(80 + 30*Math.sin(t)),
    accelXg: 0.1*Math.sin(t*3), accelYg: 0.2*Math.cos(t*2), accelZg: 1.0,
    fuelInjectionBalanced: true, fuelInjectionSpread: 50, fuelTimeA: [1200,1180,1210,1195],
    alarmes: { excessoRotacao: rpm > 6300 },
    statusSinais: {},
    cronometroParcialS: t, cronometroTotalS: t,
  };
  const res = await ch.send({ type: 'broadcast', event: 'sample', payload: sample });
  console.log(`enviada amostra t=${t.toFixed(1)} rpm=${rpm} status=${res}`);
}, 200);

setTimeout(async () => {
  clearInterval(interval);
  await ch.unsubscribe();
  console.log('teste encerrado.');
  process.exit(0);
}, 15000);
