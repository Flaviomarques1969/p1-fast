// prova da opção B (painel p1fast-tv-blocos-sem-racebox-1151): na TV em modo RaceBox nenhum bloco visível diz
// "não vem do RaceBox", os 5 sem fonte somem, os que cresceram não se sobrepõem a ninguém, nada sai da tela,
// e o texto do coach/stint cabe (sem "…" e sem corte). Controle: editor (?tv=0) continua com os 16 blocos.
// 28/10 (pedido "TV ainda fraca"): velocímetro menor sem "aguardando sensor" com km/h e km do cérebro da TV, faixa
// da volta inteira embaixo dele (pintada, sem sobrepor ninguém), stint = painel de voltas com plano e 4 quadros.
// Controles: no editor a faixa não aparece; e a TV ANTIGA (bak-tv-pinta, servida como página à parte e passada em
// argv[2]) tem de REPROVAR nestas checagens novas (velocímetro aguardando, odômetro 000.0, sem faixa, sem painel).
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html';
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
    const fx = document.querySelector('[data-tv-faixa]'), fxVis = !!fx && getComputedStyle(fx).display !== 'none';
    const odo = [...document.querySelectorAll('[data-hud="odometro"] .sg-odo-cell text')].map(x => x.textContent).join('');
    const tg = window.__tvGps || {};
    const painel = { kpis: document.querySelectorAll('[data-block-id="stint"] .tvb-kpis .kp').length,
      plano: (document.querySelector('[data-block-id="stint"] .tvb-plano') || {}).textContent || '',
      linhas: document.querySelectorAll('[data-block-id="stint"] .tvb-lista .r').length };
    const corteFx = fxVis ? [...fx.querySelectorAll(':scope > *')].filter(e => e.getBoundingClientRect().bottom > fx.getBoundingClientRect().bottom + 1).length : 0;
    return { racebox: document.body.classList.contains('tv-racebox'), vis: vis.map(caixa), nTvb,
      faixa: fxVis ? { ...caixa(fx), id:'faixa', atual: fx.querySelectorAll('.fx-atual line').length, melhor: fx.querySelectorAll('.fx-melhor polyline').length,
        fonte: (fx.querySelector('.fx-fonte') || {}).textContent || '', corte: corteFx } : null,
      hudCls: (document.querySelector('[data-block-id="hud"]') || {}).className || '',
      vel: (document.querySelector('[data-hud="velocidade"]') || {}).textContent, velEsperada: tg.kmh != null ? String(Math.round(tg.kmh)) : '—',
      odo, odoEsperado: (function(){ var t = (typeof tg.kmSessao === 'number' ? tg.kmSessao : 0).toFixed(1); while(t.length < 5) t = '0' + t; return t; })(), painel,
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
const CRESCEU = ['coach','stint','frenagem','hud'];
for(const a of tv.vis.filter(v => CRESCEU.includes(v.id))) for(const b of tv.vis) if(a.id !== b.id && b.id !== 'header' && sobrepoe(a, b)) erros.push('sobreposição: ' + a.id + ' × ' + b.id);
if(tv.textoCortado.length) erros.push('texto cortado: ' + tv.textoCortado.join(' | '));
// velocímetro e km do cérebro da TV
if(/cb-aguardando/.test(tv.hudCls)) erros.push('velocímetro ainda "aguardando sensor"');
if(tv.vel !== tv.velEsperada) erros.push('km/h na tela ' + tv.vel + ' ≠ cérebro ' + tv.velEsperada);
if(tv.odo !== tv.odoEsperado) erros.push('odômetro ' + tv.odo + ' ≠ km da sessão ' + tv.odoEsperado);
if(tv.odo === '000.0') erros.push('odômetro parado em 000.0 depois da gravação inteira');
// faixa da volta inteira
if(!tv.faixa) erros.push('faixa da volta inteira não apareceu na TV');
else {
  if(!tv.faixa.atual || !tv.faixa.melhor) erros.push('faixa sem as linhas (atual ' + tv.faixa.atual + ', melhor ' + tv.faixa.melhor + ')');
  if(!/G medido|velocidade do GPS/.test(tv.faixa.fonte)) erros.push('faixa sem a fonte do G escrita: ' + tv.faixa.fonte);
  if(tv.faixa.corte) erros.push('faixa com ' + tv.faixa.corte + ' peça(s) cortada(s) pela borda');
  if(tv.faixa.l < -1 || tv.faixa.r > 1921 || tv.faixa.b > 1081) erros.push('faixa fora da tela');
  for(const b of tv.vis) if(b.id !== 'header' && sobrepoe(tv.faixa, b)) erros.push('sobreposição: faixa × ' + b.id);
}
// painel de voltas
if(tv.painel.kpis !== 4) erros.push('painel de voltas sem os 4 quadros (melhor/última/média/ideal): ' + tv.painel.kpis);
if(!/plano/i.test(tv.painel.plano) || /lendo/.test(tv.painel.plano)) erros.push('plano do stint não lido no painel: "' + tv.painel.plano + '"');
if(tv.painel.linhas < 1) erros.push('painel de voltas sem a lista das voltas');
console.log('TV: km/h ' + tv.vel + ' · odômetro ' + tv.odo + ' · faixa ' + JSON.stringify(tv.faixa && [tv.faixa.l, tv.faixa.t, tv.faixa.r, tv.faixa.b].map(Math.round)) + ' linhas ' + (tv.faixa && tv.faixa.atual) + '/' + (tv.faixa && tv.faixa.melhor) + ' · ' + (tv.faixa && tv.faixa.fonte) + ' · painel ' + JSON.stringify(tv.painel));
const c = (id) => tv.vis.find(v => v.id === id);
console.log('TV:', CRESCEU.map(id => id + ' ' + JSON.stringify(c(id) && [c(id).l, c(id).t, c(id).r, c(id).b].map(Math.round))).join(' · '), '· linhas coach+stint', tv.nTvb);
const ed = await medir(base + '?tv=0', 4000);
console.log('editor (controle): ' + ed.vis.length + ' blocos visíveis');
if(ed.vis.length < 16) erros.push('editor perdeu blocos: ' + ed.vis.length);
if(ed.faixa) erros.push('controle: faixa apareceu no editor (é só da TV)');
await nav.close();
console.log(erros.length ? 'REPROVADO:\n - ' + erros.join('\n - ') : 'RESULTADO: APROVADO');
process.exit(erros.length ? 1 : 0);
