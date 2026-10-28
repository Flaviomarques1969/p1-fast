// AUDITORIA: varredura FUNDA de movimento na TV — TODO elemento visível (qualquer profundidade, fora de SVG), chave =
// caminho estável (tag:nth-child até a raiz), foto a cada 200 ms na gravação 21/06 inteira. Por elemento: quantas vezes a
// borda ESQUERDA e a DIREITA mudaram, e o TOPO. "Anda" = esquerda E direita mudam juntas na mesma foto (deslocamento);
// "cresce" = só uma borda muda (texto alinhado aumentando). Lista os que ANDAM ≥ 5 vezes.
// Controle: argv[2] = TV antiga tem de mostrar o topo do quadro andando.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html';
const nav = await chromium.launch({ headless: true });
const pg = await nav.newPage({ viewport: { width: 1920, height: 1080 } }); await pg.route('**/api/room', r => r.abort());
await pg.goto(base + '?tv=1&replay-gps=21-06&speed=10&fim=parar');
const ant = new Map(), cont = new Map(); let fotos = 0;
for(let k = 0; k < 1100; k++){
  await pg.waitForTimeout(200);
  const m = await pg.evaluate(() => {
    const cam = (e) => { const p = []; for(let x = e; x && x !== document.body; x = x.parentElement){ const i = x.parentElement ? [...x.parentElement.children].indexOf(x) : 0; p.unshift(x.tagName.toLowerCase() + ':' + i); } return p.join('>'); };
    const out = {};
    document.querySelectorAll('body *').forEach(e => { if(e.closest('svg') || /SCRIPT|STYLE/.test(e.tagName)) return;
      const r = e.getBoundingClientRect(); if(!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < 1080 && r.right > 0 && r.left < 1920)) return;
      const cs = getComputedStyle(e); if(cs.visibility === 'hidden' || +cs.opacity === 0) return;
      out[cam(e)] = [Math.round(r.left), Math.round(r.right), Math.round(r.top), (e.className && String(e.className).split(' ')[0]) || e.tagName, (e.textContent || '').trim().slice(0, 24)]; });
    return out;
  });
  fotos++;
  for(const [k, v] of Object.entries(m)){ const a = ant.get(k);
    if(a){ const c = cont.get(k) || { anda: 0, cresce: 0, topo: 0, nome: v[3], txt: v[4] };
      const dl = a[0] !== v[0], dr = a[1] !== v[1]; if(dl && dr && (v[0] - a[0]) === (v[1] - a[1])) c.anda++; else if(dl || dr) c.cresce++; if(a[2] !== v[2]) c.topo++;
      c.txt = v[4]; cont.set(k, c); }
    ant.set(k, v); }
}
await nav.close();
const lista = [...cont].filter(([, c]) => c.anda >= 5 || c.topo >= 5).sort((a, b) => (b[1].anda + b[1].topo) - (a[1].anda + a[1].topo));
console.log(fotos + ' fotos, ' + ant.size + ' elementos vistos; ANDAM (≥5 deslocamentos laterais ou de altura): ' + lista.length);
lista.slice(0, 30).forEach(([k, c]) => console.log('  anda ' + c.anda + ' · topo ' + c.topo + ' · cresce ' + c.cresce + ' · ' + c.nome + ' «' + c.txt + '» · ' + k.split('>').slice(-4).join('>')));
