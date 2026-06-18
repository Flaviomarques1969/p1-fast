// nuvem-replay-gps.mjs — DEV: toca a volta REAL gravada (23/05) como GPS CRU no canal ao vivo,
// no lugar do carro (que não está na pista). Serve pra provar a cadeia:
//   este emissor (GPS cru)  ->  nuvem-posicao.mjs (calcula)  ->  posição pronta  ->  telas (exibem).
// NÃO é ao vivo de verdade — é gravação, só pra validar a ligação em desenvolvimento.
// Uso: node tools/nuvem-replay-gps.mjs [23-05] [speed]   (speed padrão 6x)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const CHANNEL = 'cockpit-bubi-live';

const id    = process.argv[2] || '23-05';
const speed = Math.max(0.25, +(process.argv[3] || 6));
const j = JSON.parse(readFileSync(`web/command-box/fixtures/volta-real-gps-${id}.json`, 'utf8'));
const a = j.amostras || [];
if (!a.length) { console.error('fixture vazio'); process.exit(1); }
const dur = a[a.length-1][0] || 1;

const client = createClient(SUPABASE_URL, SUPABASE_ANON, { realtime: { params: { eventsPerSecond: 20 } } });
const ch = client.channel(CHANNEL, { config: { broadcast: { ack: false, self: false } } });
await new Promise((res, rej) => ch.subscribe((s) => { console.log('[replay] canal:', s); if (s==='SUBSCRIBED') res(); if (s==='CHANNEL_ERROR'||s==='TIMED_OUT') rej(new Error(s)); }));
console.log(`[replay] tocando volta ${id}: ${a.length} pontos · ${(dur/1000).toFixed(0)}s reais a ${speed}x · publicando 'gps' cru.`);

const t0 = Date.now();
let lastIdx = -1, lastTg = 0, n = 0;
const timer = setInterval(() => {
  const tg = ((Date.now() - t0) * speed) % dur;     // tempo gravado, acelerado, em loop
  if (tg < lastTg) lastIdx = -1;                     // virou a volta
  lastTg = tg;
  let idx = 0; for (let i=0;i<a.length;i++){ if (a[i][0] <= tg) idx = i; else break; }
  if (idx !== lastIdx) { lastIdx = idx;
    ch.send({ type:'broadcast', event:'gps', payload:{ lat:a[idx][1], lng:a[idx][2], fonte:'replay-23-05', tWall:Date.now() } });
    if ((++n % 25) === 0) console.log(`[replay] ${n} pontos enviados (idx ${idx}/${a.length})`);
  }
}, 50);

process.on('SIGINT', () => { clearInterval(timer); try { ch.unsubscribe(); } catch {} process.exit(0); });
