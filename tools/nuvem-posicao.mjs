// nuvem-posicao.mjs — PROCESSADOR DA NUVEM (posição do carro na pista).
// Papel (arquitetura Flávio 16/06): a NUVEM centraliza o cálculo pras telas (Command Box + app
// do celular). Aqui ele:
//   1. assina o GPS CRU no canal ao vivo (evento 'gps' = lat/lng como o notebook/iPhone publicam);
//   2. converte lat/lng -> posição na pista do Command Box (geoParaCommandBox) -> fração de arco (fracDe);
//   3. re-publica a POSIÇÃO PRONTA (evento 'posicao' = { frac, x, y }) pras telas só EXIBIREM.
// As telas não calculam nada — só desenham o que chega aqui. Em desenvolvimento roda local;
// em produção é uma peça hospedada (decisão de onde rodar é do Flávio, mais pra frente).
import { createClient } from '@supabase/supabase-js';
import { geoParaCommandBox } from '../web/cockpit/pista-brasilia-commandbox.js';
import { fracDe } from '../web/command-box/pista-cb-polyline.js';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const CHANNEL = 'cockpit-bubi-live';

const client = createClient(SUPABASE_URL, SUPABASE_ANON, { realtime: { params: { eventsPerSecond: 20 } } });
const ch = client.channel(CHANNEL, { config: { broadcast: { ack: false, self: false } } });

let n = 0;
function emFaixaBrasilia(lat, lng) { return lat < -15.7 && lat > -15.8 && lng < -47.8 && lng > -48.0; }

function onGps(g) {
  if (!g || typeof g.lat !== 'number' || typeof g.lng !== 'number') return;
  if (!emFaixaBrasilia(g.lat, g.lng)) return;            // ignora ruído fora da pista
  const p = geoParaCommandBox(g.lat, g.lng);
  const frac = fracDe(p.x, p.y);
  ch.send({ type: 'broadcast', event: 'posicao', payload: {
    frac: +frac.toFixed(5),
    x: +p.x.toFixed(1), y: +p.y.toFixed(1),
    fonte: g.fonte || 'gps',
    tWall: Date.now()
  }});
  if ((++n % 25) === 0) console.log(`[nuvem] ${n} posições · última frac=${frac.toFixed(3)} (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
}

ch.on('broadcast', { event: 'gps' }, (msg) => { try { onGps(msg && msg.payload); } catch (e) { /* não derruba o canal */ } });
ch.subscribe((s) => {
  console.log('[nuvem] canal:', s);
  if (s === 'SUBSCRIBED') console.log('[nuvem] processador de POSIÇÃO no ar — assinando GPS cru, publicando posição pronta.');
});

process.on('SIGINT', () => { try { ch.unsubscribe(); } catch {} process.exit(0); });
