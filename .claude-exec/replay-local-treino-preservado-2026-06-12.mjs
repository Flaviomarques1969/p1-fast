import { chromium } from 'file:///Users/imac/Documents/Sistemas/cdai/frontend/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const pontos = JSON.parse(readFileSync('/Users/imac/Projetos/P1 Fast/web/teste-aparelhos/sim-gps.json', 'utf8'));
const browser = await chromium.launch({ headless: false, args: ['--window-size=1500,950', '--window-position=60,60'] });
const page = await browser.newPage({ viewport: { width: 1480, height: 900 } });
const erros = [];
page.on('pageerror', e => erros.push(e.message));
await page.goto('https://p1t4000.vercel.app/index-t3000.html?treino=frenagem', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('connLog')?.textContent.includes('coreografia da volta ativa'), null, { timeout: 30000 });
console.log('painel pronto — blindagem de simulação LIGADA, nada será gravado');

// injetor dentro da página: 5 voltas, ritmo 10x, relógio físico exato
await page.evaluate((pts) => {
  window.__P1_ORIGEM_SIM__ = true;
  window.__REPLAY = { volta: 0, fim: false };
  const R = 6378137, D2R = Math.PI / 180;
  (async () => {
    let t = Date.now();
    for (let volta = 1; volta <= 5; volta++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const x = (b.lng - a.lng) * D2R * Math.cos((a.lat + b.lat) / 2 * D2R), y = (b.lat - a.lat) * D2R;
        const ds = Math.hypot(x, y) * R;
        const v = ((a.v + b.v) / 2) / 3.6;
        const dtMs = (v > 0.5 ? ds / v : 0.2) * 1000;
        t += dtMs;
        window.__t3.bridge.ingestImuGps({ source: 'iphone-imu', payload: { lat: b.lat, lng: b.lng, kmh: b.v, t, acc: 2 } });
        await new Promise(r => setTimeout(r, Math.max(2, dtMs / 10)));
      }
      window.__REPLAY.volta = volta;
    }
    window.__REPLAY.fim = true;
  })();
}, pontos);
console.log('reprodução iniciada (5 voltas, 10x)');

const eventos = [];
let ultimo = '', shots = 0;
const fim = Date.now() + 9.2 * 60 * 1000;
while (Date.now() < fim) {
  const s = await page.evaluate(() => {
    const or = document.querySelector('.p1-orient');
    const on = or && or.dataset.on === '1';
    return {
      volta: window.__REPLAY?.volta ?? 0, fim: window.__REPLAY?.fim ?? false,
      orient: on ? { modo: or.dataset.modo, verbo: or.querySelector('.verbo')?.textContent.replace(/\s+/g, ' ').trim(), dado: or.querySelector('.dado')?.textContent.trim() } : null,
      msg: document.getElementById('alertMsg')?.textContent.trim() || null,
      selo: document.getElementById('seloTreino')?.textContent || '',
    };
  });
  const chave = JSON.stringify([s.orient, s.msg]);
  if (chave !== ultimo) {
    ultimo = chave;
    eventos.push({ t: new Date().toLocaleTimeString('pt-BR'), volta: s.volta, orient: s.orient, msg: s.msg });
    if (s.orient && s.orient.modo === 'curva' && shots < 3) {
      shots++;
      await page.screenshot({ path: `/tmp/replay-orientacao-${shots}.png` }).catch(() => {});
    }
  }
  if (s.fim) break;
  await new Promise(r => setTimeout(r, 800));
}
const final = await page.evaluate(() => ({
  resumo: window.__t3?.treinoStint?.resumo() ?? null,
  log: document.getElementById('connLog')?.innerText.split('\n').slice(-12),
}));
console.log('--- LINHA DO TEMPO (mudanças de tela/mensagem) ---');
for (const e of eventos) console.log(`v${e.volta}`, e.t, e.orient ? `[${e.orient.modo}] ${e.orient.verbo || ''} ${e.orient.dado || ''}` : '(painel padrão)', e.msg ? '| msg: ' + e.msg : '');
console.log('--- ESTADO FINAL POR TRECHO ---');
const r = final.resumo;
if (r) for (const [seg, st] of Object.entries(r.porSegmento)) console.log(seg.slice(0, 8), `passagens=${st.passagens} nivel=${st.nivel} consolidado=${st.consolidado} bandas=[${st.naBandaUltimas.join(',')}] freadasM=[${st.freadasM.map(x => x.toFixed(0)).join(',')}]`);
console.log('--- ÚLTIMAS LINHAS DO REGISTRO (prova de não-gravação) ---');
console.log((final.log || []).join('\n'));
console.log('erros de página:', erros.length ? erros.slice(0, 5).join(' | ') : 'zero');
await browser.close();
