// AUDITORIA: o topo do quadro e o cabeçalho da faixa aguentam o PIOR CASO sem corte? (a 21/06 não chega a esses números)
// Congela a gravação, troca os textos pelos piores valores plausíveis e mede corte (scrollWidth/Height) e caixas.
// Controle positivo: um texto de 30 caracteres no tempo TEM de acusar corte (senão a régua está cega).
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const vp = (process.env.VP || '1920x1080').split('x');
const nav = await chromium.launch({ headless: true });
const pg = await nav.newPage({ viewport: { width: +vp[0], height: +vp[1] } }); await pg.route('**/api/room', r => r.abort());
await pg.goto('http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html?tv=1&replay-gps=21-06&speed=10');
await pg.waitForFunction(() => document.querySelector('[data-tv-quadro] .qc-topo.qc-fixo') && document.querySelector('[data-tv-faixa] .fx-d'), null, { timeout: 200000, polling: 500 });
const r = await pg.evaluate(() => {
  // congela: clona o quadro e a faixa (o redesenho não mexe no clone) e põe ao lado, escondendo os originais
  const out = {};
  const mede = (raiz, piores, controle) => {
    const t = raiz.cloneNode(true); raiz.parentNode.appendChild(t); raiz.style.visibility = 'hidden';
    piores(t, controle);
    const spans = [...t.querySelectorAll('span')];
    const corte = spans.filter(e => e.scrollWidth > e.clientWidth + 1 || (e.closest('.qc-ref') && e.scrollHeight > e.clientHeight + 1)).map(e => e.textContent);
    const h = t.querySelector('.fx-h'); const hCorte = h ? (h.scrollHeight > h.clientHeight + 1 ? 'fx-h ' + h.scrollHeight + '>' + h.clientHeight : null) : null;
    const d = t.querySelector('.fx-d'); const dCorte = d && h ? (d.getBoundingClientRect().top < h.getBoundingClientRect().top - 0.5 || d.getBoundingClientRect().bottom > h.getBoundingClientRect().bottom + 0.5 ? 'Δ sai do cabeçalho' : null) : null;
    const cx = [...(t.querySelector('.qc-topo') || t).children].map(c => Math.round(c.getBoundingClientRect().x));
    t.remove(); raiz.style.visibility = '';
    return { corte, hCorte, dCorte, cx };
  };
  const topo = (t, ctl) => { const c = t.querySelector('.qc-topo').children;
    c[0].querySelector('.qc-v').textContent = '12'; c[1].querySelector('.qc-g').textContent = ctl ? 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' : '10:08,6';
    c[2].querySelector('.qc-g').textContent = '+10,25'; c[3].querySelector('.qc-v').textContent = '199 km/h';
    c[4].querySelector('.qc-v').textContent = '10:15,0'; c[5].querySelector('.qc-v').textContent = '10:15,0';
    c[6].querySelector('.qc-v').textContent = 'sem volta válida ainda (aquecimento não conta)'; };
  const q = document.querySelector('[data-tv-quadro]');
  out.normal = mede(q, () => {}); out.pior = mede(q, topo, false); out.controle = mede(q, topo, true);
  const f = document.querySelector('[data-tv-faixa]');
  out.faixa = mede(f, (t) => { t.querySelector('.fx-d').textContent = 'Δ +10,25 s'; t.querySelector('.fx-s').textContent = 'v12 × melhor válida v11 10:08,6'; });
  return out;
});
await nav.close();
console.log(JSON.stringify(r));
const erros = [];
if(r.pior.corte.length) erros.push('pior caso corta: ' + r.pior.corte.join(' / '));
if(r.pior.cx.join() !== r.normal.cx.join()) erros.push('pior caso mexe as casas: ' + r.normal.cx + ' → ' + r.pior.cx);
if(!r.controle.corte.length) erros.push('controle (30 caracteres no tempo) NÃO acusou corte — régua cega');
if(r.faixa.hCorte || r.faixa.dCorte || r.faixa.corte.filter(t => /Δ/.test(t)).length) erros.push('faixa: ' + [r.faixa.hCorte, r.faixa.dCorte, ...r.faixa.corte].filter(Boolean).join(' / '));
console.log(erros.length ? 'REPROVADO\n - ' + erros.join('\n - ') : 'APROVADO — pior caso sem corte e sem mexer; controle acusou corte');
process.exit(erros.length ? 1 : 0);
