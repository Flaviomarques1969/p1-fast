// nuvem-replay-gps.mjs — DEV: toca a volta REAL gravada (23/05) como GPS CRU num canal,
// no lugar do carro (que não está na pista). Prova a cadeia em desenvolvimento:
//   este emissor (GPS cru)  ->  nuvem-posicao (calcula)  ->  posição pronta  ->  telas (exibem).
// NÃO é ao vivo — é gravação, só pra validar a ligação.
//
// SEGURANÇA DE PRODUÇÃO (regra dura): NÃO conecta quando importado; ao rodar, SÓ liga se CANAL
// estiver definido; RECUSA o canal de produção `cockpit-bubi-live` sem PERMITIR_PROD_CANAL=1.
// Uso seguro (canal de desenvolvimento): CANAL=cb-dev-flavio node tools/nuvem-replay-gps.mjs 23-05 8
import { readFileSync } from 'node:fs';

const CANAL_PRODUCAO = 'cockpit-bubi-live';

// CARREGADOR PURO (sem rede): devolve as amostras [tRel, lat, lng] da volta gravada.
export function carregarVolta(id = '23-05') {
  const j = JSON.parse(readFileSync(`web/command-box/fixtures/volta-real-gps-${id}.json`, 'utf8'));
  return j.amostras || [];
}

const executadoDireto = import.meta.url === `file://${process.argv[1]}`;
if (executadoDireto) {
  const CANAL = process.env.CANAL;
  if (!CANAL) {
    console.log('[replay] modo seguro: defina CANAL=<canal-de-dev> para emitir. NUNCA produção sem autorização.');
    process.exit(0);
  }
  if (CANAL === CANAL_PRODUCAO && process.env.PERMITIR_PROD_CANAL !== '1') {
    console.error('[replay] RECUSADO: "' + CANAL_PRODUCAO + '" é PRODUÇÃO. Exige PERMITIR_PROD_CANAL=1.');
    process.exit(2);
  }
  const id    = process.argv[2] || '23-05';
  const speed = Math.max(0.25, +(process.argv[3] || 6));
  const a = carregarVolta(id);
  if (!a.length) { console.error('fixture vazio'); process.exit(1); }
  const dur = a[a.length-1][0] || 1;
  const { createClient } = await import('@supabase/supabase-js');
  const URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
  const client = createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } });
  const ch = client.channel(CANAL, { config: { broadcast: { ack: false, self: false } } });
  await new Promise((res, rej) => ch.subscribe((s) => { console.log('[replay] canal', CANAL, ':', s); if (s==='SUBSCRIBED') res(); if (s==='CHANNEL_ERROR'||s==='TIMED_OUT') rej(new Error(s)); }));
  console.log(`[replay] volta ${id}: ${a.length} pts · ${(dur/1000).toFixed(0)}s reais a ${speed}x · publicando 'gps'.`);
  const t0 = Date.now(); let lastIdx = -1, lastTg = 0, n = 0;
  const timer = setInterval(() => {
    const tg = ((Date.now() - t0) * speed) % dur;
    if (tg < lastTg) lastIdx = -1; lastTg = tg;
    let idx = 0; for (let i=0;i<a.length;i++){ if (a[i][0] <= tg) idx = i; else break; }
    if (idx !== lastIdx) { lastIdx = idx;
      ch.send({ type:'broadcast', event:'gps', payload:{ lat:a[idx][1], lng:a[idx][2], fonte:'replay-'+id, tWall:Date.now() } });
      if ((++n % 25) === 0) console.log(`[replay] ${n} enviados`);
    }
  }, 50);
  process.on('SIGINT', () => { clearInterval(timer); try { ch.unsubscribe(); } catch {} process.exit(0); });
}
