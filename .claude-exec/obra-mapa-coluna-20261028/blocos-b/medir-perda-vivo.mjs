// prova de tela dos itens 2 e 3 do painel p1fast-tv-quadro-melhorias-1425 (Flávio 28/10) na TV do box:
//  A) curva em curso AO VIVO — gravação real de 21/06: a linha da curva em que o carro está tem a etiqueta «Ao vivo», a
//     entrada e a mínima na tela = as do cérebro no instante do desenho (ida e volta pelo observador), saída e tempo «—»,
//     e a mínima na tela baixa durante a curva;
//  B) ONDE MAIS PERDEU — sessão SINTÉTICA (a volta 2 real de 21/06 repetida, a 1ª cópia com uma curva 0,6 s mais lenta e
//     mínima 3 km/h menor; a mesma montagem de tests/node-smoke-tv-quadro-curvas.mjs seção 6) entregue pelo
//     window.__tvGps.feed — só nesta régua, nunca na tela de verdade: a frase do rodapé = pacote().quadro.perda.frase,
//     só a linha da curva atrasada marcada, subtítulo «mais perdeu na volta 3», texto inteiro (sem corte), letra ≥ 11 px na
//     tela; foto.
//  C) mapa sem «N,N m do ápice» (28/10: saiu do mapa a pedido dele) e com as cruzes do ápice.
// Controle: argv[2] = outra página (a TV antes dos itens 2 e 3) tem de REPROVAR.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const { criarCerebroGpsTv } = await import('/Users/imac/Projetos/p1fast-worktrees/tv-box-aovivo/web/command-box/cerebro/cerebro-gps-tv.js');
const base = process.argv[2] || 'http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html';
const foto = process.argv[3] || '/Users/imac/Projetos/p1fast-worktrees/tv-box-aovivo/.claude-exec/obra-mapa-coluna-20261028/blocos-b/perda-vivo.png';
const erros = [];
const nav = await chromium.launch({ headless: true });
const nova = async () => { const pg = await nav.newPage({ viewport: { width: 1920, height: 1080 } }); await pg.route('**/api/room', r => r.abort());
  pg.on('pageerror', e => erros.push('erro na página: ' + e.message)); return pg; };
const observar = (pg) => pg.evaluate(() => { const qEl = document.querySelector('[data-tv-quadro]'); if(!qEl) return false;
  new MutationObserver(() => { window.__regua = JSON.parse(JSON.stringify(window.__tvGps.blocos.quadro)); })
    .observe(qEl, { childList: true, subtree: true, attributes: true, characterData: true }); return true; });

// ── A) ao vivo, gravação real ──
const pa = await nova();
await pa.goto(base + '?tv=1&replay-gps=21-06&speed=6');
const temVivo = await pa.waitForFunction(() => { const q = window.__tvGps && window.__tvGps.blocos && window.__tvGps.blocos.quadro;
  return !!q && q.curvas.some(c => c.aoVivo) && !!document.querySelector('[data-tv-quadro]'); }, null, { timeout: 150000, polling: 100 }).then(() => true, () => false);
if(!temVivo) erros.push('A: o cérebro não chegou a uma curva ao vivo em 150 s');
await observar(pa);
const amostras = [];
for(let k = 0; k < 160 && temVivo; k++){
  await pa.waitForTimeout(120);
  const r = await pa.evaluate(() => {
    const q = window.__regua; if(!q) return null;
    const c = q.curvas.find(x => x.aoVivo);
    const l = document.querySelector('[data-qc-vivo]');
    const cel = l ? [...l.children].filter(e => !/qc-nome|qc-tag|qc-trilho|qc-prog/.test(e.className)) : [];
    const ult = cel.map(e => e.querySelectorAll('.qc-l')[1].querySelector('.qc-n').textContent);
    return { c: c ? { i: c.i, u: c.ultima } : null, i: l ? +l.dataset.qcCurva : null, tag: l ? l.querySelector('.qc-tag i:last-child').textContent : null,
      sub: l ? l.querySelector('.qc-nome span').textContent : null, ult, nVivo: document.querySelectorAll('[data-qc-vivo]').length };
  });
  if(r) amostras.push(r);
}
const fmt = (v, c) => v == null ? '—' : v.toFixed(c).replace('.', ',').replace('-', '−');
let casadas = 0, comVivo = 0; const porCurva = new Map();
for(const a of amostras){
  if(!a.c){ if(a.nVivo) erros.push('A: linha «ao vivo» na tela sem curva ao vivo no cérebro'); continue; }
  comVivo++;
  const ok = a.nVivo === 1 && a.i === a.c.i && a.tag === 'Ao vivo' && /ao vivo/.test(a.sub)
    && a.ult[0] === fmt(a.c.u.entrada, 0) && a.ult[2] === fmt(a.c.u.vmin, 0) && a.ult[3] === '—' && a.ult[4] === '—';
  if(ok) casadas++; else if(erros.length < 6) erros.push('A: tela × cérebro na curva ao vivo: ' + JSON.stringify(a));
  if(!porCurva.has(a.i)) porCurva.set(a.i, []); porCurva.get(a.i).push(a.c.u.vmin);
}
const baixou = [...porCurva.values()].filter(v => v.length > 2 && v[v.length - 1] < v[0]).length;
console.log('A: ' + amostras.length + ' fotos, ' + comVivo + ' com curva ao vivo, ' + casadas + ' casadas tela = cérebro; curvas vistas ' + porCurva.size + ', mínima baixou em ' + baixou);
if(comVivo < 20) erros.push('A: poucas fotos com curva ao vivo (' + comVivo + ')');
if(casadas !== comVivo) erros.push('A: ' + (comVivo - casadas) + ' fotos com a tela diferente do cérebro');
if(baixou < 1) erros.push('A: a mínima não baixou na tela em nenhuma curva');
await pa.close();

// ── B) onde mais perdeu, sessão sintética (mesma montagem da prova offline) ──
const fx = JSON.parse(readFileSync('/Users/imac/Projetos/p1fast-worktrees/tv-box-aovivo/web/command-box/fixtures/replay-hoje-2026-06-21.json', 'utf8'));
const pts = fx.amostras.filter(a => a.tipo === 'gps').map(a => ({ ...a, lng: a.lon, kmh: a.kmh / 3.6, source: 'racebox' }));
const n2 = [], ta2 = [];
const cc = criarCerebroGpsTv({ guardarVoltas: true });
pts.forEach((p, k) => { cc.feedGps(p); const a = cc.snapshot().voltaAtual; if(a && a.n === 2){ n2.push(k); ta2.push(a.trechoAtual); } });
const lista = cc.snapshot().trechos.lista, curvas = lista.map((tr, i) => ({ tr, i })).filter(x => x.tr.tipo === 'curva');
const iAlvo = curvas[Math.floor(curvas.length / 2)].i;
const kAlvo = ta2.map((x, j) => (x === iAlvo + 1 ? j : -1)).filter(j => j >= 0);
const copia = (desloc, lenta) => { const t0 = pts[n2[0]].tWall; return n2.map((k, j) => { const p = pts[k];
  const atraso = !lenta ? 0 : j < kAlvo[0] ? 0 : j > kAlvo[kAlvo.length - 1] ? 600 : 600 * (j - kAlvo[0] + 1) / kAlvo.length;
  return { ...p, tWall: p.tWall - t0 + desloc + atraso, kmh: lenta && kAlvo.includes(j) ? Math.max(0, p.kmh - 3) : p.kmh }; }); };
const fimReal = pts[n2[n2.length - 1]].tWall, durV2 = fimReal - pts[n2[0]].tWall;
const fimV4 = n2.findIndex(k => pts[k].tWall - pts[n2[0]].tWall > 30000);   // volta 4: 30 s, para a tela ter a 3 fechada
const sint = [...pts.slice(0, n2[n2.length - 1] + 1), ...copia(fimReal + 100, true), ...copia(fimReal + 100 + durV2 + 700, false).slice(0, fimV4)];
const pb = await nova();
await pb.goto(base + '?tv=1');
await pb.waitForFunction(() => !!window.__tvGps && !!window.__modoTv, null, { timeout: 30000 }).catch(() => erros.push('B: a TV não abriu em modo TV'));
await pb.evaluate((lote) => { for(const p of lote) window.__tvGps.feed(p); }, sint);
await pb.waitForTimeout(900);
const b = await pb.evaluate(() => {
  const q = window.__tvGps.blocos && window.__tvGps.blocos.quadro, pe = document.querySelector('[data-qc-perda]');
  const hud = document.querySelector('[data-block-id="hud"]'), fator = hud ? hud.parentNode.getBoundingClientRect().width / 1280 : 1;
  const marcadas = [...document.querySelectorAll('[data-qc-maisperdeu]')];
  const tam = pe ? [...pe.querySelectorAll('span')].map(e => parseFloat(getComputedStyle(e).fontSize) * fator) : [];
  return { perda: q && q.perda, frase: pe && pe.querySelector('[data-qc-perda-frase]') ? pe.querySelector('[data-qc-perda-frase]').textContent : null,
    rot: pe ? pe.querySelector('.qc-rot').textContent : null, corte: pe ? pe.scrollWidth > pe.clientWidth + 1 : true,
    menorPx: tam.length ? Math.min(...tam) : 0, marcadas: marcadas.map(l => +l.dataset.qcCurva),
    sub: marcadas[0] ? marcadas[0].querySelector('.qc-nome span').textContent : null,
    apice: (() => { const M = document.querySelector('.b-map').getBoundingClientRect();
      return [...document.querySelectorAll('[data-tv-apice-m]')].map(e => { const R = e.getBoundingClientRect();
        return { txt: e.textContent, dentro: R.left >= M.left && R.right <= M.right && R.top >= M.top && R.bottom <= M.bottom }; }); })(),
    cruzes: document.querySelectorAll('[data-tv-apice]').length,
    dentro: pe ? (() => { const R = pe.getBoundingClientRect(), Q = document.querySelector('[data-tv-quadro]').getBoundingClientRect();
      return R.left >= Q.left - 1 && R.right <= Q.right + 1 && R.bottom <= Q.bottom + 1; })() : false };
});
console.log('B: cérebro «' + (b.perda && b.perda.frase) + '» · tela «' + b.rot + ' | ' + b.frase + '» · marcadas ' + JSON.stringify(b.marcadas)
  + ' · subtítulo «' + b.sub + '» · menor letra ' + b.menorPx.toFixed(1) + ' px · corte ' + b.corte);
if(!b.perda || b.perda.i !== iAlvo + 1 || b.perda.volta !== 3) erros.push('B: o cérebro não achou a curva atrasada na volta 3: ' + JSON.stringify(b.perda));
else {
  if(b.frase !== b.perda.frase) erros.push('B: frase na tela ≠ cérebro: «' + b.frase + '»');
  if(!/^Onde mais perdeu · volta 3$/.test(b.rot || '')) erros.push('B: rótulo do rodapé «' + b.rot + '»');
  if(b.marcadas.join() !== String(iAlvo + 1)) erros.push('B: linhas marcadas na tela ' + JSON.stringify(b.marcadas) + ' (esperada ' + (iAlvo + 1) + ')');
  if(!/mais perdeu na volta 3/.test(b.sub || '')) erros.push('B: subtítulo da linha «' + b.sub + '»');
  if(!/— mínima [\d,]+ km\/h abaixo da sua melhor/.test(b.frase || '')) erros.push('B: a frase não traz o motivo medido');
}
console.log('B: ápice no mapa ' + JSON.stringify(b.apice));
if(b.apice.length) erros.push('C: ' + b.apice.length + ' «m do ápice» no mapa (deviam ser 0)');
if(b.cruzes < 7) erros.push('C: só ' + b.cruzes + ' cruzes de ápice no mapa (esperadas 7)');
if(b.corte) erros.push('B: a linha «onde mais perdeu» corta o texto');
if(b.menorPx < 11) erros.push('B: letra de ' + b.menorPx.toFixed(1) + ' px na tela (mínimo 11)');
if(!b.dentro) erros.push('B: a linha «onde mais perdeu» sai do quadro');
await pb.screenshot({ path: foto });
console.log('foto: ' + foto);
await nav.close();
console.log(erros.length ? 'REPROVADO\n - ' + erros.join('\n - ') : 'APROVADO');
process.exit(erros.length ? 1 : 0);
