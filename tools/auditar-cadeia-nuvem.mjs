// auditar-cadeia-nuvem.mjs — AUDITOR INDEPENDENTE (4º participante, só escuta) da cadeia
// emissor(GPS cru) -> nuvem(calcula) -> 'posicao'. Tenta provar que é FALSO; se passar, é real.
// Mesma trava de produção das outras peças. Uso: CANAL=cb-dev-flavio node tools/auditar-cadeia-nuvem.mjs [segundos]
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calcularPosicao } from './nuvem-posicao.mjs';
import { fracDe } from '../web/command-box/pista-cb-polyline.js';

const CANAL_PRODUCAO = 'cockpit-bubi-live';
const CANAL = process.env.CANAL;
if (!CANAL) { console.log('defina CANAL=<canal-de-dev>'); process.exit(0); }
if (CANAL === CANAL_PRODUCAO && process.env.PERMITIR_PROD_CANAL !== '1') { console.error('RECUSADO: canal de produção.'); process.exit(2); }

const segs = +(process.argv[2] || 7);
const { createClient } = await import('@supabase/supabase-js');
const URL = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
const client = createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 30 } } });
const ch = client.channel(CANAL, { config: { broadcast: { ack: false, self: false } } });

const gps = [], pos = [];
ch.on('broadcast', { event: 'gps' },     (m) => { if (m && m.payload) gps.push(m.payload); });
ch.on('broadcast', { event: 'posicao' }, (m) => { if (m && m.payload) pos.push(m.payload); });
await new Promise((res) => ch.subscribe((s) => { if (s === 'SUBSCRIBED') res(); }));
console.log(`[auditor] escutando "${CANAL}" por ${segs}s (só leitura)…`);
await new Promise((r) => setTimeout(r, segs * 1000));
try { ch.unsubscribe(); } catch {}

console.log(`\n=== 1) CONEXÃO REAL? (mensagens recebidas de OUTROS participantes) ===`);
console.log(`GPS cru recebidos: ${gps.length} · posições recebidas: ${pos.length}`);
console.log(`fonte do GPS: ${gps[0] && gps[0].fonte} · fonte da posição: ${pos[0] && pos[0].fonte}`);

console.log(`\n=== 2) CÁLCULO REAL? (a posição é a projeção certa do GPS) ===`);
// 2a) consistência interna: a fração bate com o ponto (x,y) que a nuvem mandou?
let maxErrInterno = 0;
for (const p of pos) { let d = Math.abs(fracDe(p.x, p.y) - p.frac); if (d > 0.5) d = 1 - d; if (d > maxErrInterno) maxErrInterno = d; }
console.log(`2a) fração x ponto (x,y) da nuvem: erro máximo ${maxErrInterno.toFixed(5)} (perto de 0 = a fração é mesmo daquele ponto)`);
// 2b) cross-check: refaço a conta do ZERO a partir do GPS cru e comparo com a posição que a nuvem mandou (casando por tempo)
let casados = 0, maxErrCross = 0;
for (const g of gps) {
  const meu = calcularPosicao(g); if (!meu) continue;
  let melhor = null, dt = Infinity;
  for (const p of pos) { const d = Math.abs((p.tWall||0) - (g.tWall||0)); if (d < dt) { dt = d; melhor = p; } }
  if (melhor && dt < 400) { casados++; let e = Math.abs(melhor.frac - meu.frac); if (e > 0.5) e = 1 - e; if (e > maxErrCross) maxErrCross = e; }
}
console.log(`2b) refiz a conta offline e comparei com a nuvem: ${casados} pares casados · erro máximo ${maxErrCross.toFixed(5)} (0 = a nuvem calculou exatamente o esperado)`);

const ok = gps.length > 0 && pos.length > 0 && maxErrInterno < 0.01 && maxErrCross < 0.01 && casados > 0;
console.log(`\nVEREDITO PARCIAL: ${ok ? 'CONEXÃO E CÁLCULO REAIS (resistiu)' : 'ALGO NÃO BATE — investigar'}`);
process.exit(ok ? 0 : 1);
