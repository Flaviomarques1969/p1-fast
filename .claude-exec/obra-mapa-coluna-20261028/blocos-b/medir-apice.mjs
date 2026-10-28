// prova de tela do ÁPICE NO MAPA DA TV (Flávio 28/10: "distância do carro ao ápice no mapa"; no mesmo dia: "não precisa
// colocar essa informação também lá na pista" → o texto «N,N m do ápice» SAIU do mapa, a cruz fica): gravação 21/06
// até o fim (fim=parar segura a última tela: volta 3 dentro da CURVA DA JUNÇÃO, CURVA 2 já feita). Confere: uma cruz por
// curva da TV no ápice do cérebro, visível no modo TV; NENHUM texto de ápice no mapa; o cérebro continua com o número
// (apiceAgoraM na curva em curso e trechos[j].apiceM na última feita — régua não fica cega se o estado não for o esperado).
// Controle: argv[2] = outra página (a TV de 76e666820, com o texto) tem de REPROVAR.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html';
const foto = process.argv[3] || null;
const erros = [];
const nav = await chromium.launch({ headless: true });
const pg = await nav.newPage({ viewport: { width: 1920, height: 1080 } }); await pg.route('**/api/room', r => r.abort());
const errosPg = []; pg.on('pageerror', e => errosPg.push(e.message));
await pg.goto(base + '?tv=1&replay-gps=21-06&speed=20&fim=parar');
const fim = await pg.waitForFunction(() => { const s = window.__tvGps && window.__tvGps.snapshot(); const a = s && s.voltaAtual;
  if (!a || a.n !== 3) return false;   // parou de andar = fim da gravação (fim=parar)
  const k = a.decorridoS, ant = window.__medirAnt; window.__medirAnt = k; return ant === k; }, null, { timeout: 150000, polling: 1000 }).then(() => true, () => false);
if (!fim) erros.push('a volta 3 não chegou ao fim da gravação em 150 s');
else {
  await pg.waitForTimeout(1500);   // gravação parada + redesenhos
  const r = await pg.evaluate(() => {
    const s = window.__tvGps.snapshot(), at = s.voltaAtual, lista = s.trechos.lista;
    const mapa = document.querySelector('.b-map').getBoundingClientRect();
    const cruzes = [...document.querySelectorAll('[data-tv-apice]')].map(e => { const b = e.getBoundingClientRect(), d = e.getAttribute('d').match(/M([\d.]+) ([\d.]+)H([\d.]+)/);
      return { i: +e.getAttribute('data-tv-apice'), cx: (+d[1] + +d[3]) / 2, cy: +d[2], vis: b.width > 0 && getComputedStyle(e).display !== 'none' && e.closest('g') && getComputedStyle(e.closest('g')).display !== 'none' }; });
    const textos = [...document.querySelectorAll('[data-tv-apice-m]')].map(e => { const b = e.getBoundingClientRect(), m = e.getScreenCTM();
      return { i: +e.getAttribute('data-tv-apice-m'), txt: e.textContent, px: +(Math.hypot(m.a, m.b) * parseFloat(e.getAttribute('font-size'))).toFixed(2), alt: +b.height.toFixed(1),
        dentro: b.left >= mapa.left && b.right <= mapa.right && b.top >= mapa.top && b.bottom <= mapa.bottom }; });
    let ultimaFeita = null; (at.trechos || []).forEach((m, j) => { if (lista[j].tipo === 'curva' && m && m.apiceM != null) ultimaFeita = { i: lista[j].i, m: m.apiceM }; });
    return { at: { n: at.n, trechoAtual: at.trechoAtual, apiceAgoraM: at.apiceAgoraM, nome: lista[at.trechoAtual - 1].nome }, ultimaFeita,
      curvas: lista.filter(t => t.tipo === 'curva').map(t => ({ i: t.i, x: t.apice.x, y: t.apice.y })), cruzes, textos };
  });
  const fmt = m => m.toFixed(1).replace('.', ',') + ' m do ápice';
  console.log('fim da gravação: volta ' + r.at.n + ' em ' + r.at.nome + ' (agora ' + r.at.apiceAgoraM + ' m) · última curva feita i=' + (r.ultimaFeita && r.ultimaFeita.i) + ' ' + (r.ultimaFeita && r.ultimaFeita.m) + ' m');
  console.log('na tela: ' + r.cruzes.length + ' cruzes · textos ' + JSON.stringify(r.textos));
  if (r.curvas.length !== 7) erros.push('cérebro com ' + r.curvas.length + ' curvas ≠ 7 (régua cega)');
  for (const c of r.curvas) { const z = r.cruzes.find(k => k.i === c.i);
    if (!z) erros.push('curva i=' + c.i + ' sem cruz do ápice'); else { if (!z.vis) erros.push('cruz do ápice i=' + c.i + ' invisível na TV'); if (Math.abs(z.cx - c.x) > 0.05 || Math.abs(z.cy - c.y) > 0.05) erros.push('cruz i=' + c.i + ' fora do ápice do cérebro'); } }
  if (r.at.apiceAgoraM == null || !r.ultimaFeita) erros.push('estado do fim sem curva em curso com ápice ou sem curva feita (régua cega)');
  if (r.textos.length) erros.push(r.textos.length + ' texto(s) de ápice no mapa (deviam ser 0): ' + r.textos.map(t => '«' + t.txt + '»').join(' '));
  const soltos = await pg.evaluate(() => [...document.querySelectorAll('.b-map text')].map(e => e.textContent).filter(t => /ápice/.test(t)));
  if (soltos.length) erros.push('texto com «ápice» no mapa: ' + soltos.join(' / '));
  if (foto) await pg.screenshot({ path: foto, clip: { x: 80, y: 570, width: 520, height: 420 } });
}
if (errosPg.length) erros.push('erro na página: ' + errosPg.slice(0, 2).join(' | '));
await nav.close();
console.log(erros.length ? 'REPROVADO\n - ' + erros.join('\n - ') : 'APROVADO');
process.exit(erros.length ? 1 : 0);
