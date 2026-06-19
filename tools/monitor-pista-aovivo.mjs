// Monitor SÓ-LEITURA do teste ao vivo da pista.
// ASSINA o canal canônico `cockpit-bubi-live` (Supabase Realtime) e imprime o que
// está chegando: dados do carro (T4000), GPS (RaceBox) e eventos (volta/trecho/delta).
//
// REGRA DURA (feedback-cockpit-bubi-live-e-producao-nao-publicar-dev):
//   - ASSINAR/OUVIR este canal é PERMITIDO (somente leitura) — é o que as telas fazem.
//   - PUBLICAR é PROIBIDO. Este script NUNCA chama channel.send(). Só escuta.
//
// Uso: node tools/monitor-pista-aovivo.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const CHANNEL = 'cockpit-bubi-live';

const hhmmss = () => new Date().toLocaleTimeString('pt-BR');
const win = { sample: [], gps: [], evento: [] };
const last = { sample: null, gps: null, evento: null };
const firstSeen = { sample: false, gps: false, evento: false };

function hz(arr) {
  const now = Date.now();
  while (arr.length && now - arr[0] > 5000) arr.shift();
  return (arr.length / 5).toFixed(1);
}
function bump(kind, payload) {
  win[kind].push(Date.now());
  last[kind] = payload;
  if (!firstSeen[kind]) {
    firstSeen[kind] = true;
    console.log(`\n  ✓ PRIMEIRA ${kind.toUpperCase()} recebida às ${hhmmss()}`);
  }
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON, { realtime: { params: { eventsPerSecond: 20 } } });
const ch = client.channel(CHANNEL, { config: { broadcast: { ack: false, self: false } } });

ch.on('broadcast', { event: 'sample' }, m => { if (m?.payload) bump('sample', m.payload); });
ch.on('broadcast', { event: 'gps'    }, m => { if (m?.payload) bump('gps', m.payload); });
ch.on('broadcast', { event: 'evento' }, m => { if (m?.payload) { bump('evento', m.payload);
  console.log(`  • evento: ${m.payload.tipo}${m.payload.segmentId ? ' '+m.payload.segmentId : ''}${m.payload.source==='sim-replay'?' (sim)':''}`); } });

ch.subscribe((status) => {
  if (status === 'SUBSCRIBED') console.log(`[${hhmmss()}] Monitor ligado (SÓ LEITURA) no canal "${CHANNEL}". Aguardando dados da pista…`);
  else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) console.log(`[${hhmmss()}] Canal ${status} — o cliente religa sozinho.`);
});

// Linha de status a cada 2s
setInterval(() => {
  const s = last.sample, g = last.gps;
  const carro = s
    ? `CARRO ${hz(win.sample)}/s${s.source==='sim-replay'?'(sim)':''} · RPM ${s.rpm ?? '—'} · água ${s.waterTempC ?? '—'}°C · bat ${s.batteryV != null ? s.batteryV.toFixed(1)+'V' : '—'} · λ ${typeof s.lambda==='number' && s.lambda>0 ? s.lambda.toFixed(2) : '—'}`
    : 'CARRO —';
  const gpsl = g
    ? `GPS ${hz(win.gps)}/s${g.sim?'(sim)':''} · ${g.kmh != null ? Number(g.kmh).toFixed(0) : '—'} km/h · ${g.numSV ?? '—'} sat · fix ${g.fix ?? '—'} · ${g.lat != null ? Number(g.lat).toFixed(5) : '—'},${g.lng != null ? Number(g.lng).toFixed(5) : '—'}`
    : 'GPS —';
  // Só imprime quando há algo vivo (evita poluir antes do teste começar)
  if (s || g) console.log(`[${hhmmss()}] ${carro}  ||  ${gpsl}`);
}, 2000);

console.log('Monitor de pista (só-leitura) iniciando… Ctrl+C para parar.');
