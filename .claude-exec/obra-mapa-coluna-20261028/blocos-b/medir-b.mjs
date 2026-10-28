// prova da opção B (painel p1fast-tv-blocos-sem-racebox-1151): na TV em modo RaceBox nenhum bloco visível diz
// "não vem do RaceBox", os 5 sem fonte somem, os que cresceram não se sobrepõem a ninguém, nada sai da tela,
// e o texto do coach/stint cabe (sem "…" e sem corte). Controle: editor (?tv=0) continua com os 16 blocos.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html';
const nav = await chromium.launch({ headless:true }); const erros = [];
async function medir(url, espera){
  const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
  await pg.goto(url); await pg.waitForTimeout(espera);
  const r = await pg.evaluate(() => {
    const vis = [...document.querySelectorAll('[data-block-id]')].filter(b => { const cs = getComputedStyle(b), R = b.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && R.width > 2; });
    const caixa = b => { const R = b.getBoundingClientRect(); return { id:b.dataset.blockId, l:R.left, t:R.top, r:R.right, b:R.bottom }; };
    const textoCortado = [...document.querySelectorAll('[data-block-id="coach"] .tvb > *, [data-block-id="stint"] .tvb > *')]
      .filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().bottom > e.closest('[data-block-id]').getBoundingClientRect().bottom + 1)
      .map(e => e.className + ': ' + e.textContent.trim().slice(0, 40));
    const nTvb = document.querySelectorAll('[data-block-id="coach"] .tvb > *, [data-block-id="stint"] .tvb > *').length;
    return { racebox: document.body.classList.contains('tv-racebox'), vis: vis.map(caixa), nTvb,
      avisos: vis.filter(b => b.classList.contains('tv-nao-racebox') && b.dataset.blockId !== 'video').map(b => b.dataset.blockId), textoCortado };
  });
  await pg.close(); return r;
}
const tv = await medir(base + '?tv=1&replay-gps=21-06&speed=40&fim=parar', 30000);
const ids = tv.vis.map(v => v.id);
if(!tv.racebox) erros.push('TV não entrou no modo RaceBox');
if(tv.nTvb < 8) erros.push('coach/stint sem conteúdo pintado (régua cega): ' + tv.nTvb + ' linhas');
for(const id of ['carro','pneus','fuel-gauge','checklist','shift-light']) if(ids.includes(id)) erros.push('ainda visível: ' + id);
for(const id of ['header','video','mapa','hud','coach','stint','stint-bar','delta-acum','passagem','frenagem','vmin']) if(!ids.includes(id)) erros.push('sumiu bloco com dado: ' + id);
if(tv.avisos.length) erros.push('aviso "não vem do RaceBox" visível em: ' + tv.avisos.join(','));
for(const v of tv.vis){ if(v.l < -1 || v.t < -1 || v.r > 1921 || v.b > 1081) erros.push('fora da tela: ' + v.id + ' ' + JSON.stringify(v)); }
const sobrepoe = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 3 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 3;
const CRESCEU = ['coach','stint','frenagem'];
for(const a of tv.vis.filter(v => CRESCEU.includes(v.id))) for(const b of tv.vis) if(a.id !== b.id && b.id !== 'header' && sobrepoe(a, b)) erros.push('sobreposição: ' + a.id + ' × ' + b.id);
if(tv.textoCortado.length) erros.push('texto cortado: ' + tv.textoCortado.join(' | '));
const c = (id) => tv.vis.find(v => v.id === id);
console.log('TV:', CRESCEU.map(id => id + ' ' + JSON.stringify(c(id) && [c(id).l, c(id).t, c(id).r, c(id).b].map(Math.round))).join(' · '), '· linhas coach+stint', tv.nTvb);
const ed = await medir(base + '?tv=0', 4000);
console.log('editor (controle): ' + ed.vis.length + ' blocos visíveis');
if(ed.vis.length < 16) erros.push('editor perdeu blocos: ' + ed.vis.length);
await nav.close();
console.log(erros.length ? 'REPROVADO:\n - ' + erros.join('\n - ') : 'RESULTADO: APROVADO');
process.exit(erros.length ? 1 : 0);
