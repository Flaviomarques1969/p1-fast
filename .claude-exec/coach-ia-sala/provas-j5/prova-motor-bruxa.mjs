// prova-motor-bruxa.mjs — Janela 5: rodar o MOTOR REAL (calcularDelta) na Curva da Bruxa
// com dado real do fixture. Anotação fracao = fórmula real (distância acumulada,
// live-data-bridge.js:569). Anotação sub = APROXIMAÇÃO OFFLINE dos marcos do detector
// (freada = desaceleração >= 0,5 g entre amostras; ápice = amostra do Vmin) — DEMONSTRATIVA:
// ao vivo quem anota é o live-data-bridge com os marcos reais do trecho-detector.
import { readFileSync } from 'node:fs';

const ROOT = '/Users/imac/Projetos/P1 Fast';
const fx = JSON.parse(readFileSync(`${ROOT}/web/command-box/fixtures/passagens-bubi-brasilia.v1.json`, 'utf8'));
const { calcularDelta } = await import(`${ROOT}/web/cockpit/delta-calculator.js`);

function distMeters(a, b) {
  const DEG2RAD = Math.PI / 180, R = 6378137;
  const lat1 = a.lat * DEG2RAD, lat2 = b.lat * DEG2RAD;
  const x = (b.lng - a.lng) * DEG2RAD * Math.cos((lat1 + lat2) / 2);
  const y = lat2 - lat1;
  return Math.hypot(x, y) * R;
}

// fracao pela distância acumulada — mesma conta do live-data-bridge.js:569
function comFracao(pontos) {
  const dists = [0];
  for (let i = 1; i < pontos.length; i++) dists.push(dists[i - 1] + distMeters(pontos[i - 1], pontos[i]));
  const total = dists[dists.length - 1] || 1;
  return pontos.map((p, i) => ({ ...p, fracao: dists[i] / total }));
}

// sub: aproximação offline dos marcos (declarada acima)
function comSub(pontos) {
  let freadaIdx = null;
  for (let i = 1; i < pontos.length; i++) {
    const dv = (pontos[i].kmh - pontos[i - 1].kmh) / 3.6;           // m/s
    const dt = (pontos[i].t - pontos[i - 1].t) / 1000 || 1;
    if (dv / dt <= -0.5 * 9.81) { freadaIdx = i - 1; break; }       // desaceleração >= 0,5 g
  }
  let vminIdx = 0;
  for (let i = 1; i < pontos.length; i++) if (pontos[i].kmh < pontos[vminIdx].kmh) vminIdx = i;
  return pontos.map((p, i) => {
    let sub;
    if (freadaIdx == null) sub = i < vminIdx ? 'entrada' : (i === vminIdx ? 'apice' : (i <= vminIdx + 2 ? 'pace' : 'saida'));
    else if (i < freadaIdx) sub = 'entrada';
    else if (i < vminIdx) sub = 'freio';
    else if (i === vminIdx) sub = 'apice';
    else if (i <= vminIdx + 2) sub = 'pace';
    else sub = 'saida';
    return { ...p, sub };
  });
}

const bruxa = fx.passagens.filter(p => p.curva === 'CURVA DA BRUXA');
const ref = bruxa.reduce((a, b) => (a.tempo_trecho_s <= b.tempo_trecho_s ? a : b));   // 23/05 v4, 9,999 s
const atual = bruxa.find(p => p.dia === '24/05' && p.volta === 3);                    // voadora, 10,479 s

const prep = p => ({ segmentId: p.segment_id, pontos: comSub(comFracao(p.pontos)) });
const pAtual = prep(atual), pRef = prep(ref);

console.log(`REF   : ${ref.dia} v${ref.volta} — ${ref.tempo_trecho_s}s (${ref.pontos.length} pts)`);
console.log(`ATUAL : ${atual.dia} v${atual.volta} — ${atual.tempo_trecho_s}s (${atual.pontos.length} pts)`);
console.log(`gapMedido (relógio) = ${(atual.tempo_trecho_s - ref.tempo_trecho_s).toFixed(3)} s`);
console.log('subs ATUAL:', pAtual.pontos.map(p => p.sub).join(','));
console.log('kmh  ATUAL:', pAtual.pontos.map(p => p.kmh.toFixed(0)).join(','));
console.log('kmh  REF  :', pRef.pontos.map(p => p.kmh.toFixed(0)).join(','));

const d = calcularDelta({ atual: pAtual, referencia: pRef });
console.log('\n=== saída REAL do calcularDelta ===');
console.log(JSON.stringify(d, (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v), 2));

const gap = atual.tempo_trecho_s - ref.tempo_trecho_s;
const escala = Math.min(1, gap / Math.max(1e-6, d.deltaTotalS));
console.log(`\nreconciliação (J2 §3.3): deltaTotalIntegrado=${d.deltaTotalS.toFixed(3)} · gapMedido=${gap.toFixed(3)} · escala=${escala.toFixed(3)}`);
for (const sub of ['entrada', 'freio', 'apice', 'pace', 'saida']) {
  const g = Math.max(0, d.porSubTrecho[sub].deltaS) * escala;
  console.log(`ganhoSub[${sub}] = ${g.toFixed(3)} s (amostras=${d.porSubTrecho[sub].amostras})`);
}
