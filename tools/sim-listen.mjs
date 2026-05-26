// sim-listen.mjs — escuta o canal cockpit-bubi-live e imprime amostras.
// Pra testar a ponte: roda em outro terminal junto com sim-publish.mjs.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

const client = createClient(SUPABASE_URL, SUPABASE_ANON);
const ch = client.channel('cockpit-bubi-live', { config: { broadcast: { ack: false, self: false } } });

let count = 0;
ch.on('broadcast', { event: 'sample' }, (msg) => {
  count += 1;
  const s = msg.payload;
  console.log(`[${count}] rpm=${s.rpm} tps=${s.tpsPct?.toFixed(0)}% λ=${s.lambda?.toFixed(2)} água=${s.waterTempC} vel=${s.speedKmh}km/h`);
});

ch.subscribe((s) => {
  console.log('canal:', s);
});

setTimeout(async () => {
  console.log(`\ntotal recebido: ${count} amostras`);
  await ch.unsubscribe();
  process.exit(0);
}, 20000);
