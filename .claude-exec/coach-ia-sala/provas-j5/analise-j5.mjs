// analise-j5.mjs — Janela 5: análise independente do fixture real (Bubi 23-24/05)
// 1) Tempos/gaps por curva e volta (relógio = autoridade)
// 2) Eleição segundo a J2 (piso 0,10 / quantil baixo / out-lap fora)
// 3) QA extra 1: verificação INDEPENDENTE do achado da J3 (ápice-semente × passagens) em METROS
import { readFileSync } from 'node:fs';

const ROOT = '/Users/imac/Projetos/P1 Fast';
const fx = JSON.parse(readFileSync(`${ROOT}/web/command-box/fixtures/passagens-bubi-brasilia.v1.json`, 'utf8'));
const { APICES_SEMENTE_BRASILIA } = await import(`${ROOT}/web/cockpit/apices-semente-brasilia.js`);
const { geoParaDesenho } = await import(`${ROOT}/web/cockpit/pista-oficial-brasilia.js`);

// distMeters — MESMA fórmula do produto (delta-calculator.js, equiretangular)
function distMeters(a, b) {
  const DEG2RAD = Math.PI / 180, R = 6378137;
  const lat1 = a.lat * DEG2RAD, lat2 = b.lat * DEG2RAD;
  const x = (b.lng - a.lng) * DEG2RAD * Math.cos((lat1 + lat2) / 2);
  const y = lat2 - lat1;
  return Math.hypot(x, y) * R;
}

const ORDEM = fx._meta.ordemCurvas;
const porCurva = new Map(ORDEM.map(c => [c, []]));
for (const p of fx.passagens) porCurva.get(p.curva).push(p);

// ── 1. Tempos por curva/volta ────────────────────────────────────────────
console.log('=== 1. TEMPO_TRECHO_S por curva × volta (dia/volta) — relógio ===');
console.log('voltas na ordem: ' + [...new Set(fx.passagens.map(p => `${p.dia} v${p.volta}`))].join(' · '));
const stats = {};
for (const c of ORDEM) {
  const ps = porCurva.get(c).slice().sort((a, b) => (a.dia + a.volta).localeCompare(b.dia + b.volta) || a.volta - b.volta);
  const tempos = ps.map(p => p.tempo_trecho_s);
  const ref = Math.min(...tempos);
  const nPts = ps.map(p => p.pontos.length);
  stats[c] = { ps, ref, nPts };
  console.log(`${c.padEnd(22)} ref=${ref.toFixed(3)}s  pts/passagem=[${nPts.join(',')}]  tempos=[${tempos.map(t => t.toFixed(2)).join(', ')}]`);
}

// volta "total" por (dia,volta) = soma dos 8 trechos — para achar out-laps
console.log('\n=== 1b. Soma dos 8 trechos por volta (proxy do tempo de volta) ===');
const voltas = {};
for (const p of fx.passagens) {
  const k = `${p.dia} v${p.volta}`;
  voltas[k] = (voltas[k] || 0) + p.tempo_trecho_s;
}
const somas = Object.entries(voltas).sort();
for (const [k, s] of somas) console.log(`${k}: ${s.toFixed(1)} s`);
const medianaVolta = [...Object.values(voltas)].sort((a, b) => a - b)[Math.floor(somas.length / 2)];
const outLaps = somas.filter(([, s]) => s > medianaVolta * 1.05).map(([k]) => k);
console.log(`mediana=${medianaVolta.toFixed(1)}s → out-laps (>5% acima): ${outLaps.join(', ') || 'nenhuma'}`);

// ── 2. Gaps por curva nas voltas VOADORAS (regra J2: fora out-laps) ─────
console.log('\n=== 2. GAP vs melhor histórica, só voltas voadoras (regra J2 §4.5) ===');
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.max(0, Math.ceil(p * s.length) - 1)]; };
const candidatos = [];
for (const c of ORDEM) {
  const { ps, ref } = stats[c];
  const voadoras = ps.filter(p => !outLaps.includes(`${p.dia} v${p.volta}`));
  const gaps = voadoras.map(p => p.tempo_trecho_s - ref).filter(g => g > 0.0005); // a própria ref dá gap 0
  const gapsTodos = voadoras.map(p => p.tempo_trecho_s - ref);
  const hit = gapsTodos.filter(g => g >= 0.10).length;
  const media = gapsTodos.reduce((s, g) => s + g, 0) / gapsTodos.length;
  const p25 = q(gapsTodos, 0.25);
  const minPts = Math.min(...voadoras.map(p => p.pontos.length));
  candidatos.push({ curva: c, nVoadoras: voadoras.length, hit, media, p25, minPts });
  console.log(`${c.padEnd(22)} voadoras=${voadoras.length} hit(≥0,10s)=${hit} media=${media.toFixed(3)} p25=${p25.toFixed(3)} minPts=${minPts}`);
}

console.log('\n=== 2b. Eleição J2 (curva-nível, piso 0,10 no quantil baixo) ===');
const eleitos = candidatos.filter(c => c.p25 >= 0.10).sort((a, b) => b.p25 - a.p25);
for (const e of eleitos) console.log(`ELEGÍVEL: ${e.curva} p25=${e.p25.toFixed(3)}s hit=${e.hit}/${e.nVoadoras} minPts=${e.minPts}${e.minPts <= 6 ? ' → fallback subTrecho:null (curva curta)' : ''}`);

// ── 3. QA EXTRA 1: ápice-semente × passagens — MÉTODO INDEPENDENTE (metros) ──
console.log('\n=== 3. QA-1: distância MÍNIMA (m) do ápice-semente a QUALQUER ponto das passagens da curva ===');
console.log('(o cabeçalho do próprio semente promete: "ápice nunca está a mais de ~10 m da linha")');
for (const c of ORDEM) {
  const apex = APICES_SEMENTE_BRASILIA[c];
  if (!apex) { console.log(`${c}: SEM SEMENTE`); continue; }
  let minM = Infinity, minCurvaGlobal = null;
  for (const p of porCurva.get(c)) for (const pt of p.pontos) {
    const d = distMeters(apex, pt);
    if (d < minM) minM = d;
  }
  // contraprova de rótulo: qual curva do fixture tem o ponto MAIS PERTO desse semente?
  let bestOutra = { curva: null, d: Infinity };
  for (const c2 of ORDEM) for (const p of porCurva.get(c2)) for (const pt of p.pontos) {
    const d = distMeters(apex, pt);
    if (d < bestOutra.d) bestOutra = { curva: c2, d };
  }
  // e em px (compara com o número da J3)
  const aXY = geoParaDesenho(apex.lat, apex.lng);
  let minPx = Infinity;
  for (const p of porCurva.get(c)) for (const pt of p.pontos) {
    const xy = geoParaDesenho(pt.lat, pt.lng);
    minPx = Math.min(minPx, Math.hypot(xy.x - aXY.x, xy.y - aXY.y));
  }
  const flag = minM > 10 ? '  ← FORA da promessa de ~10 m' : '';
  console.log(`${c.padEnd(22)} minDist=${minM.toFixed(1)} m (${minPx.toFixed(0)} px)${flag}  | ponto mais perto do semente em TODO o fixture: ${bestOutra.curva} (${bestOutra.d.toFixed(1)} m)`);
}
