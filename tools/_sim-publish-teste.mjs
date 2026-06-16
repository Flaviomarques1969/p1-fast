// _sim-publish-teste.mjs — APENAS auto-teste do registrador. Publica amostras de mentira
// (marcadas sim:true) num canal ISOLADO de teste pra provar que o registrador captura,
// levanta o formato e dispara alerta. NUNCA usar no canal real de produção.
// Uso: CANAL=teste-registrador-local node tools/_sim-publish-teste.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const CANAL = process.env.CANAL || 'teste-registrador-local';
if (CANAL === 'cockpit-bubi-live') { console.error('RECUSADO: este publicador de teste nao roda no canal real.'); process.exit(1); }

const client = createClient(SUPABASE_URL, SUPABASE_ANON, { realtime:{ params:{ eventsPerSecond:25 } } });
const ch = client.channel(CANAL, { config:{ broadcast:{ ack:false, self:false } } });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const send = (event, payload) => ch.send({ type:'broadcast', event, payload });

ch.subscribe(async (s) => {
  if (s !== 'SUBSCRIBED') return;
  console.log('publicador de teste no ar; esperando 3s pro registrador subir...');
  await sleep(3000);
  // GPS bom: 20 amostras a ~5 Hz, coords reais de Brasilia, fix 3D, 11 satelites.
  for (let i=0;i<20;i++){
    send('gps', { lat:-15.7740 + i*1e-5, lng:-47.8895 - i*1e-5, kmh:90+i, numSV:11, fix:3, accM:1.8, sim:true, tWall:Date.now() });
    await sleep(200);
  }
  // GPS ruim de proposito: sem ceu (fix 0, 2 satelites, sem lat/lng) -> deve gerar ALERTA.
  send('gps', { lat:null, lng:null, kmh:0, numSV:2, fix:0, accM:40, sim:true, tWall:Date.now() });
  // Carro bom: 15 amostras a 5 Hz.
  for (let i=0;i<15;i++){
    send('sample', { rpm:3000+i*100, speedKmh:80+i, waterTempC:88, batteryV:13.6, lambda:0.95,
                     tpsPct:45, pressaoFreioBar:0, source:'sim-replay', tWall:Date.now() });
    await sleep(200);
  }
  // Carro fora da faixa de proposito: rpm impossivel -> deve gerar ALERTA.
  send('sample', { rpm:50000, speedKmh:80, waterTempC:88, batteryV:13.6, source:'sim-replay', tWall:Date.now() });
  // Eventos de volta/trecho/delta.
  send('evento', { tipo:'volta', n:1, source:'sim-replay', tWall:Date.now() });
  send('evento', { tipo:'trecho', segmentId:'Curva 1', source:'sim-replay', tWall:Date.now() });
  send('evento', { tipo:'delta', segmentId:'Curva 1', deltaS:-0.42, source:'sim-replay', tWall:Date.now() });
  await sleep(500);
  console.log('publicador de teste terminou.');
  await ch.unsubscribe();
  process.exit(0);
});
