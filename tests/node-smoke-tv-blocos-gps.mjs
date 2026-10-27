// node-smoke-tv-blocos-gps.mjs — CATRACA da E2b "TV do box ao vivo" (27/10/2026): os blocos da TV que saem
// do GPS (stint, Δ acumulado, passagem, frenagem pelo G medido, vmin, coach) — casa única
// web/command-box/cerebro/cerebro-tv-blocos-gps.js. Gravação REAL de 21/06 (posição + km/h); como ela não tem
// o G do RaceBox, a parte da frenagem usa (a) passagens sintéticas de resposta conhecida e (b) a volta real com
// o G montado pela física da própria volta (Δkm/h ÷ Δt). Offline, sem rede.
import { readFileSync } from 'node:fs';
import { criarCerebroGpsTv } from '../web/command-box/cerebro/cerebro-gps-tv.js';
import { criarCerebroTvBlocosGps, medirFrenagem, serieDistancia } from '../web/command-box/cerebro/cerebro-tv-blocos-gps.js';

let ok = 0, fail = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, extra !== undefined ? JSON.stringify(extra) : ''); } };

// ── 1) Freada de resposta conhecida (passagem sintética, 25 Hz, 1 ponto a cada ~1 m) ──
// reta a 120 km/h; freia a −1,0 G a partir de 40 m antes da entrada; solta aos poucos até −0,15 G na mínima
// (trail braking); retoma a +0,3 G 15 m depois da mínima.
function passagem({ freiaEm = -40, trailG = -0.15, soltaS = 0.8, z = true } = {}) {
  const pts = []; let kmh = 120, t0 = 0;
  for (let d = -150; d <= 120; d += 1) {
    let gl = 0;
    if (d >= freiaEm && kmh > 70) gl = -1.0;
    pts.push({ d: d + 1000, t: t0, kmh, gl, z, p: 0 });
    const v = kmh / 3.6; t0 += 1 / Math.max(v, 1);
    kmh = Math.max(0, kmh + gl * 9.81 * (1 / Math.max(v, 1)) * 3.6);
  }
  // soltar o freio aos poucos até a mínima (trail) e retomar depois
  const iMin = pts.findIndex(q => q.kmh <= 70);
  const nSolta = Math.round(soltaS * 25);
  for (let k = 0; k < nSolta && iMin - k >= 0; k++) pts[iMin - k].gl = trailG + (-1.0 - trailG) * (k / nSolta);
  for (let i = iMin + 1; i < pts.length; i++) { pts[i].kmh = 70 + (i - iMin) * 0.3; pts[i].gl = i - iMin > 15 ? 0.3 : 0; }
  pts[iMin].gl = trailG;
  return { pts, dEnt: 1000, iMin };
}
{
  const { pts, dEnt } = passagem();
  const f = medirFrenagem(pts, dEnt);
  t('freada conhecida: começou ~40 m antes da entrada', f.ok && f.freou && Math.abs(f.inicioFreadaM - (-40)) <= 1, f);
  t('freada conhecida: pico −1,0 G', f.picoFreioG === -1, f.picoFreioG);
  t('freada conhecida: chegou na mínima ainda freando = trail braking', f.trail === true && f.freioNaMinimaG === -0.15, f);
  t('freada conhecida: soltou progressivo (0,8 s)', f.soltou === 'progressivo', [f.soltou, f.soltouS]);
  t('freada conhecida: retomou a aceleração depois da mínima, pico +0,3 G', f.retomadaM > f.minimaM && f.picoAcelG === 0.3, f);
  const sem = medirFrenagem(passagem({ trailG: 0, soltaS: 0.1 }).pts, dEnt);
  t('controle: soltou tudo antes da mínima → SEM trail, "de uma vez"', sem.trail === false && sem.soltou === 'de uma vez', sem);
  const cedo = medirFrenagem(passagem({ freiaEm: -70 }).pts, dEnt);
  t('controle: freando 70 m antes → início em −70 m', Math.abs(cedo.inicioFreadaM - (-70)) <= 1, cedo.inicioFreadaM);
  const semZero = medirFrenagem(passagem({ z: false }).pts, dEnt);
  t('sem o zero do box → frenagem não vale (com motivo)', semZero.ok === false && /zero/.test(semZero.motivo), semZero);
  const serie = serieDistancia(pts, dEnt, 'gl', 24);
  t('série do gráfico: 24 pontos do início do recorte até o fim', serie.length === 24 && serie[0].m === -150 && serie[23].m === 120, serie && [serie[0], serie[23]]);
}

// ── 2) Gravação REAL 21/06 pelo cérebro do GPS + a casa nova ──
const fx = JSON.parse(readFileSync(new URL('../web/command-box/fixtures/replay-hoje-2026-06-21.json', import.meta.url), 'utf8'));
const pts = fx.amostras.filter(a => a.tipo === 'gps').map(a => ({ ...a, lng: a.lon, kmh: a.kmh / 3.6, source: 'racebox' }));
function rodar(comG) {
  const c = criarCerebroGpsTv({ guardarVoltas: true });
  let ant = null;
  for (const a of pts) {
    const p = { ...a };
    if (comG) {   // G longitudinal pela física da própria volta (Δv/Δt), zero do box valendo
      p.gLong = ant && a.tWall > ant.tWall ? ((a.kmh - ant.kmh) / 3.6) / ((a.tWall - ant.tWall) / 1000) / 9.81 : 0;
      p.gLat = 0; p.zeroOk = true;
    }
    c.feedGps(p); ant = a;
  }
  return c.snapshot();
}
const s0 = rodar(false);
const b0 = criarCerebroTvBlocosGps().pacote(s0);
t('real: 2 voltas fechadas, melhor = volta 2 (2:39,6)', b0.stint.feitas === 2 && b0.stint.melhor.n === 2 && b0.stint.melhor.tempoS === s0.melhorVolta.tempoS, b0.stint);
t('real: volta atual = 3', b0.stint.voltaAtual === 3, b0.stint.voltaAtual);
t('real: Δ da volta 1 contra a melhor = diferença dos tempos', b0.deltaAcum.voltas[0].deltaS === Math.round((s0.voltas[0].tempoS - s0.voltas[1].tempoS) * 1000) / 1000, b0.deltaAcum);
t('real: Δ acumulado soma as voltas', b0.deltaAcum.voltas[1].acumS === b0.deltaAcum.voltas[0].deltaS, b0.deltaAcum.voltas);
t('real: curva da vez é um trecho de CURVA do cadastro', b0.curva && s0.trechos.lista[b0.curva.i - 1].tipo === 'curva', b0.curva && b0.curva.nome);
t('real: passagem = os km/h medidos pelo cérebro na última volta', b0.curva.passagem.minima.kmh === s0.ultimaVolta.trechos[b0.curva.i - 1].kmhMin, b0.curva.passagem);
t('real: sem G na gravação → frenagem diz "sem G do RaceBox" (não inventa)', b0.curva.frenagem && b0.curva.frenagem.ok === false && /sem G/.test(b0.curva.frenagem.motivo), b0.curva.frenagem);
t('real: gráfico de km/h da curva sai mesmo sem G', b0.curva.vmin.serie && b0.curva.vmin.serie.length === 24, b0.curva.vmin);
t('real: coach aponta o trecho de maior perda do cérebro', b0.coach && b0.coach.perdeuS > 0 && b0.coach.nome === s0.trechos.lista[b0.coach.trecho - 1].nome, b0.coach);

const s1 = rodar(true);
const b1 = criarCerebroTvBlocosGps().pacote(s1);
const fr = b1.curva.frenagem;
t('real + G: frenagem medida na curva da vez', fr && fr.ok === true, fr);
t('real + G: série do G da última volta e da referência para o gráfico', fr.serie && fr.serie.length === 24 && fr.serieRef && fr.serieRef.length === 24, fr && [fr.serie && fr.serie.length, fr.serieRef && fr.serieRef.length]);
t('real + G: mínima medida = mínima do cérebro', fr.kmhMin === s1.ultimaVolta.trechos[b1.curva.i - 1].kmhMin || Math.abs(fr.kmhMin - s1.ultimaVolta.trechos[b1.curva.i - 1].kmhMin) < 3, [fr.kmhMin, s1.ultimaVolta.trechos[b1.curva.i - 1].kmhMin]);

// ── 3) A casa só muda com volta nova (cache) e a curva acompanha o trecho atual ──
{
  const casa = criarCerebroTvBlocosGps();
  const a = casa.pacote(s1), b = casa.pacote(s1);
  t('mesma entrada → mesmo pacote (cache por volta)', JSON.stringify(a) === JSON.stringify(b));
  const outro = { ...s1, voltaAtual: { ...s1.voltaAtual, trechoAtual: 1 } };
  const iPrimeiraCurva = s1.trechos.lista.findIndex(tr => tr.tipo === 'curva') + 1;
  t('numa reta, a curva da vez é a próxima curva', casa.pacote(outro).curva.i === iPrimeiraCurva, [casa.pacote(outro).curva.i, iPrimeiraCurva]);
  t('sem voltas → pacote vazio honesto (sem curva medida, stint zerado)', (() => { const p = criarCerebroTvBlocosGps().pacote({ voltas: [], trechos: s1.trechos, voltaAtual: null }); return p.stint.feitas === 0 && p.curva.passagem === null && p.coach === null; })());
}

console.log(`\nnode-smoke-tv-blocos-gps: ${ok} ok, ${fail} falha`);
process.exit(fail ? 1 : 0);
