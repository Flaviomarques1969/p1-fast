// MEDIÇÃO: o que se MOVE na TV inteira durante a gravação 21/06 — caixa de todo bloco e de todo filho direto dos
// blocos (linhas do quadro, cabeçalhos, rodapés), foto a cada 200 ms; lista o que mudou de posição/tamanho.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html';
const foto = process.argv[3];
const nav = await chromium.launch({ headless: true });
const pg = await nav.newPage({ viewport: { width: 1920, height: 1080 } });
await pg.route('**/api/room', r => r.abort());
await pg.goto(base + '?tv=1&replay-gps=21-06&speed=10&fim=parar');
const hist = new Map();
for(let k = 0; k < 900; k++){
  await pg.waitForTimeout(200);
  const m = await pg.evaluate(() => {
    const out = {};
    const nome = (e) => (e.getAttribute('data-block-id') ? 'bloco:' + e.getAttribute('data-block-id') : '') || [...e.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + (a.value && a.value.length < 20 ? '=' + a.value : '')).join(' ') || e.className && String(e.className).split(' ')[0] || e.tagName;
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < 1080; };
    const raiz = [...document.querySelectorAll('[data-block-id], [data-tv-faixa], [data-tv-quadro], .b-map')].filter(vis);
    raiz.forEach((e, i) => {
      const n = nome(e), r = e.getBoundingClientRect(); out[n] = [r.x, r.y, r.width, r.height].map(Math.round).join(',');
      [...e.querySelectorAll(':scope > *, :scope > * > *')].filter(vis).forEach((c, j) => { if(c.closest('svg')) return; const q = c.getBoundingClientRect();
        out[n + ' › ' + nome(c) + '#' + j] = [q.x, q.y, q.width, q.height].map(Math.round).join(','); });
    });
    return out;
  });
  for(const [k, v] of Object.entries(m)){ if(!hist.has(k)) hist.set(k, []); const h = hist.get(k); if(h[h.length - 1] !== v) h.push(v); }
  if(foto && k === 450) await pg.screenshot({ path: foto });
}
await nav.close();
const mov = [...hist].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
console.log(hist.size + ' peças medidas; ' + mov.length + ' mudaram de posição ou tamanho');
const blocos = mov.filter(([k]) => !k.includes(' › '));
console.log('BLOCOS que mudaram: ' + (blocos.length ? blocos.map(([k, v]) => k + ' (' + v.length + ' estados: ' + v.slice(0, 3).join(' / ') + ')').join('\n  ') : 'nenhum'));
console.log('PEÇAS DENTRO (top 25):\n  ' + mov.filter(([k]) => k.includes(' › ')).slice(0, 25).map(([k, v]) => k + ' — ' + v.length + ' estados: ' + v.slice(0, 3).join(' / ')).join('\n  '));
