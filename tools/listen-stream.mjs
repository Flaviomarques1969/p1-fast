// listen-stream.mjs — fica ouvindo o canal e gravando em arquivo + console.
import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'fs';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const LOG = '/tmp/bubi-live.log';

const client = createClient(SUPABASE_URL, SUPABASE_ANON);
const ch = client.channel('cockpit-bubi-live', { config: { broadcast: { ack: false, self: false } } });

let count = 0;
ch.on('broadcast', { event: 'sample' }, (msg) => {
  count += 1;
  const s = msg.payload || {};
  const line = JSON.stringify({ n: count, ts: Date.now(), ...s });
  appendFileSync(LOG, line + '\n');
  if (count % 5 === 0 || count <= 3) {
    console.log(`[${count}] rpm=${s.rpm} tps=${s.tpsPct?.toFixed?.(0)}% λ=${s.lambda?.toFixed?.(2)} água=${s.waterTempC}°C bat=${s.batteryV?.toFixed?.(1)}V vel=${s.speedKmh}km/h freio=${s.pressaoFreioBar?.toFixed?.(2)}bar pedal=${s.pedalAceleradorPct?.toFixed?.(0)}%`);
  }
});

ch.subscribe((s) => {
  console.log('canal:', s);
});

process.on('SIGINT', async () => {
  console.log(`\ntotal capturado: ${count}`);
  await ch.unsubscribe();
  process.exit(0);
});
