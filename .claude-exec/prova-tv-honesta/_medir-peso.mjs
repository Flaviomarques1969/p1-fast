// PECA-DE-PROVA: chamado por triagem da E2b (mede tarefas longas e atraso do velocímetro, antes × agora)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const RAIZ = new URL('../../', import.meta.url).pathname;
const ALT = process.env.HTML_ALT;
const SUP = `const o={};window.__nuvem={emit(e,p){for(const f of(o[e]||[]))f({payload:p})}};export function createClient(){return{channel(){return{on(_t,fl,f){(o[fl.event]=o[fl.event]||[]).push(f);return this},subscribe(cb){setTimeout(()=>cb('SUBSCRIBED'),50);return this},send(){return Promise.resolve()},unsubscribe(){return Promise.resolve()}}}}}`;
const fx = JSON.parse(readFileSync(RAIZ + 'web/command-box/fixtures/replay-hoje-2026-06-21.json', 'utf8'));
const pts = fx.amostras.filter(a => a.tipo === 'gps' && a.fix >= 3).map(a => ({ ...a, kmh: a.kmh / 3.6 }));
const ini = pts.findIndex(p => p.kmh > 60);
const b = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await page.route('https://esm.sh/@supabase/supabase-js*', r => r.fulfill({ contentType: 'text/javascript', body: SUP }));
if (ALT) await page.route('**/_design-reference/mockup-command-box-vista-piloto.html*', r => r.fulfill({ contentType: 'text/html', body: readFileSync(ALT, 'utf8') }));
await page.goto('http://127.0.0.1:5199/_design-reference/mockup-command-box-vista-piloto.html?canal=x', { waitUntil: 'load' });
await page.waitForTimeout(2500);
const cdp = await page.context().newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
const r = await page.evaluate(async ({ pts, ini }) => {
  const longas = []; new PerformanceObserver(l => l.getEntries().forEach(e => longas.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false });
  const atrasos = []; const now0 = Date.now();
  for (let i = 0; i < 250; i += 5) {
    const g = pts.slice(ini + i, ini + i + 5).map((a, k) => ({ lat: a.lat, lng: a.lon, kmh: a.kmh, numSV: a.numSV, fix: a.fix, accM: a.hacc, tWall: now0 + (i + k) * 40, source: 'racebox', gLong: 0, gLat: 0, zeroOk: false }));
    const topo = { ...g[4], lote: g.slice(0, 4) }; const alvo = String(Math.round(g[4].kmh)); const t0 = performance.now();
    window.__nuvem.emit('gps', topo);
    while (performance.now() - t0 < 600) { const v = document.querySelector('[data-hud="velocidade"]'); if (v && v.textContent.trim() === alvo) break; await new Promise(r => setTimeout(r, 5)); }
    atrasos.push(Math.round(performance.now() - t0));
    await new Promise(r => setTimeout(r, Math.max(0, 200 - (performance.now() - t0))));
  }
  atrasos.sort((a, b) => a - b);
  return { longas: longas.length, maiorLonga: Math.max(0, ...longas), atrasoMediana: atrasos[25], atrasoP90: atrasos[45], atrasoMax: atrasos[49] };
}, { pts, ini });
const { profile } = await cdp.send('Profiler.stop');
const self = {}; const dt = profile.timeDeltas; const porId = new Map(profile.nodes.map(n => [n.id, n]));
profile.samples.forEach((id, i) => { const n = porId.get(id); const f = n.callFrame; const k = (f.functionName || '(anon)') + ' ' + f.url.split('/').pop() + ':' + f.lineNumber; self[k] = (self[k] || 0) + (dt[i] || 0) / 1000; });
console.log(Object.entries(self).filter(([k]) => !/^\(idle\)|^\(program\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => '   ' + v.toFixed(0) + ' ms  ' + k).join('\n'));
console.log((ALT ? 'ANTES ' : 'AGORA ') + JSON.stringify(r));
await b.close();
