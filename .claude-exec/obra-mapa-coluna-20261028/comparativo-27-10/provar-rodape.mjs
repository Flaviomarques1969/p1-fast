// Prova do rodapé do quadro de curvas (comparativo, gravação 21/06 a 10x): "Ideal pelos trechos" ao lado da soma,
// lido do cérebro da TV embutida; sem encavalar a legenda nem sair do rodapé. Controle: antes de existir volta que vale, não aparece.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ headless:true }); const pg = await nav.newPage({ viewport:{ width:1920, height:1080 } }); await pg.route('**/api/room', r => r.abort());
const erros=[]; pg.on('pageerror', e=>erros.push(String(e).slice(0,200)));
await pg.goto('http://127.0.0.1:5201/_tocar/comparativo.html?vel=10');
const medir = () => pg.evaluate(() => {
  const pe = document.querySelector('.qc-pe'), leg = pe.querySelector('[data-r="leg"]'), so = pe.querySelector('[data-r="soma"]');
  const P = pe.getBoundingClientRect(), L = leg.getBoundingClientRect(), S = so.getBoundingClientRect();
  const g = document.getElementById('tv').contentWindow.__tvGps, s = g && g.snapshot();
  const linhas = r => Math.round(r.height / parseFloat(getComputedStyle(so).lineHeight || 16));
  return { soma: so.innerText.replace(/\s+/g,' '), leg: leg.innerText.replace(/\s+/g,' ').slice(0,60),
    encavala: L.right > S.left + 0.5 && L.width > 0 && S.width > 0, gapPx: Math.round(S.left - L.right),
    fora: S.right > P.right + 0.5 || L.left < P.left - 0.5 || S.bottom > P.bottom + 0.5 || L.bottom > P.bottom + 0.5,
    alturaSoma: Math.round(S.height), alturaLeg: Math.round(L.height), rodape: [Math.round(P.width), Math.round(P.height)],
    voltasTv: s ? s.voltas.length : null, idealTv: s && s.trechos.validas ? s.trechos.validas.voltaIdealS : null,
    descartadas: s ? JSON.stringify(s.trechos.validas.descartadas) : null };
});
const linhas = [];
let antes = null, depois = null;
for (let i = 0; i < 90; i++) { await pg.waitForTimeout(1000); const m = await medir();
  if (!antes && m.voltasTv === 1) antes = m;
  if (m.idealTv != null && /Ideal/.test(m.soma)) { depois = m; break; } }
// pior caso: soma E ideal juntos (2ª rodada da gravação: a soma volta a existir e o cérebro da TV já tem o ideal)
let juntos = null;
for (let i = 0; i < 150 && depois; i++) { await pg.waitForTimeout(1000); const m = await medir();
  if (/Soma/.test(m.soma) && /Ideal/.test(m.soma)) { juntos = m; break; } }
await pg.screenshot({ path: new URL('./rodape-ideal.png', import.meta.url).pathname, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
console.log(JSON.stringify({ antes, depois, juntos, erros }, null, 1));
const falhas = [];
if (!antes) falhas.push('não vi o momento com 1 volta (controle)'); else if (/Ideal/.test(antes.soma)) falhas.push('CONTROLE: ideal apareceu só com a volta de aquecimento');
if (!depois) falhas.push('ideal nunca apareceu'); else {
  if (depois.encavala) falhas.push('legenda encavala a soma');
  if (depois.fora) falhas.push('texto sai do rodapé');
  if (depois.alturaSoma > 24 || depois.alturaLeg > 24) falhas.push('quebrou linha: soma ' + depois.alturaSoma + ' leg ' + depois.alturaLeg);
  const m = Math.floor(depois.idealTv / 60) + ':' + (depois.idealTv % 60).toFixed(1).padStart(4, '0').replace('.', ',');
  if (!depois.soma.includes('Ideal pelos trechos ' + m)) falhas.push('texto ≠ cérebro: ' + depois.soma + ' x ' + m); }
if (!juntos) falhas.push('não vi soma e ideal juntos (pior caso)'); else {
  if (juntos.encavala) falhas.push('pior caso: legenda encavala a soma (gap ' + juntos.gapPx + ')');
  if (juntos.fora) falhas.push('pior caso: texto sai do rodapé');
  if (juntos.alturaSoma > 24 || juntos.alturaLeg > 24) falhas.push('pior caso quebrou linha: soma ' + juntos.alturaSoma + ' leg ' + juntos.alturaLeg); }
if (erros.length) falhas.push('erros na página: ' + erros.length);
console.log(falhas.length ? 'REPROVADO: ' + falhas.join(' | ') : 'RESULTADO: APROVADO');
await nav.close(); process.exit(falhas.length ? 1 : 0);
