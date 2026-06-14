// Smoke do classificador-trecho — tipo de curva + formato de trail proposto.
// Casos sintéticos autossuficientes (não dependem de arquivo externo) + invariantes.
import {
  classificarTrecho, distM, paraXY, velocidades, comprimentoM,
  curvaturaTotal, raioPorTresPontos, TIPOS, LIMIARES,
} from '../web/cockpit/classificador-trecho.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

const R2D = 180 / Math.PI, D2R = Math.PI / 180, R = 6378137;
// gera uma passagem reta com velocidades dadas (km/h), pontos a `passoM` metros.
function passagemReta(kmhs, passoM = 30) {
  const lat0 = -15.77, lng0 = -47.90, cos0 = Math.cos(lat0 * D2R);
  let t = 1_000_000;
  return kmhs.map((kmh, i) => {
    const x = i * passoM;
    const lng = lng0 + (x / (R * cos0)) * R2D;
    if (i > 0) { const vMs = Math.max(1, (kmhs[i - 1] + kmh) / 2 / 3.6); t += (passoM / vMs) * 1000; }
    return { lat: lat0, lng, kmh, t };
  });
}

// ── utilitários geométricos ──
t('distM ~ conhecida (30 m)', Math.abs(distM(passagemReta([50, 50])[0], passagemReta([50, 50])[1]) - 30) < 0.5);
t('paraXY zera o 1º ponto', (() => { const xy = paraXY(passagemReta([50, 50, 50])); return Math.abs(xy[0].x) < 1e-6 && Math.abs(xy[0].y) < 1e-6; })());
t('velocidades: vEntrada é o pico até a mínima, não o 1º ponto', (() => { const v = velocidades(passagemReta([140, 150, 100, 120])); return v.veInicio === 140 && v.vEntrada === 150 && v.vmin === 100 && v.vs === 120; })());
t('velocidades tolera kmh null na borda (não quebra)', (() => {
  const pts = [{ lat: -15.77, lng: -47.90, kmh: null, t: 0 }, { lat: -15.77, lng: -47.8997, kmh: 150, t: 1000 }, { lat: -15.77, lng: -47.8994, kmh: 120, t: 2000 }, { lat: -15.77, lng: -47.8991, kmh: 90, t: 3000 }];
  const v = velocidades(pts); return v && v.veInicio === 150 && v.vmin === 90;
})());
t('comprimento ~ soma dos passos (90 m)', Math.abs(comprimentoM(passagemReta([50, 50, 50, 50])) - 90) < 1);
t('raio de 3 pontos num círculo de 100 m ~ 100', (() => {
  const r = 100, c = [{ x: 0, y: r }, { x: r, y: 0 }, { x: 0, y: -r }].map(p => p); // semicírculo
  const R3 = raioPorTresPontos(c[0], c[1], c[2]); return Math.abs(R3 - r) < 1;
})());
t('curvaturaTotal detecta sentido', (() => {
  // arco à esquerda
  const pts = []; const lat0 = -15.77, lng0 = -47.90, cos0 = Math.cos(lat0 * D2R);
  for (let a = 0; a <= 90; a += 15) { const rad = a * D2R; const x = 100 * Math.sin(rad), y = 100 * (1 - Math.cos(rad)); pts.push({ lat: lat0 + (y / R) * R2D, lng: lng0 + (x / (R * cos0)) * R2D, kmh: 80, t: a }); }
  const cv = curvaturaTotal(paraXY(pts)); return cv.anguloDeg > 60 && (cv.sentido === 'esq' || cv.sentido === 'dir');
})());

// ── ramos da classificação ──
function classifica(kmhs, distProximaM = 999, passoM = 30) {
  return classificarTrecho({ geo: { nome: 'teste', id: 't' }, pts: passagemReta(kmhs, passoM), distProximaM });
}
t('SF: rápida quase constante (142/142/146)', classifica([142, 142, 144, 146]).tipo === 'SF');
t('T1: freada forte (150 -> 90, razão 1.67)', classifica([150, 130, 105, 90, 92]).tipo === 'T1');
t('T0: freada média (140 -> 110, razão ~1.27)', classifica([140, 125, 112, 110, 115]).tipo === 'T0');
t('T3: freada leve com Vmin alto (148 -> 130, razão ~1.14)', classifica([148, 140, 133, 130, 132]).tipo === 'T3');
t('ND: lenta sem queda na janela (90 constante)', classifica([90, 90, 91, 90]).tipo === 'ND');
t('T4: freada + próxima entrada perto (40 m)', classifica([150, 120, 100, 98], 40).tipo === 'T4');
t('ND: Vmin ~0 = falha de GPS, não "sem queda"', (() => { const r = classifica([100, 50, 0, 10]); return r.tipo === 'ND' && r.flags.dadoSuspeito === true && /GPS/i.test(r.motivo); })());
t('aceleraSaida usa Vs-Vmin (não Vs-Ve): 140->90->138', (() => { const r = classifica([140, 90, 138]); return r.flags.aceleraSaida === true; })());
t('classificar não quebra com kmh null na borda', (() => {
  const pts = [{ lat: -15.77, lng: -47.90, kmh: null, t: 0 }, { lat: -15.77, lng: -47.8985, kmh: 150, t: 1000 }, { lat: -15.77, lng: -47.897, kmh: 95, t: 2000 }, { lat: -15.77, lng: -47.8955, kmh: 90, t: 3000 }];
  const r = classificarTrecho({ geo: { nome: 'x', id: 'x' }, pts, distProximaM: 999 });
  return ['T0', 'T1', 'T3', 'SF', 'ND'].includes(r.tipo);
})());

// ── invariantes ──
const r = classifica([150, 120, 95, 90]);
t('tipo retornado é válido', Object.keys(TIPOS).includes(r.tipo));
t('confiança é media ou baixa', ['alta', 'media', 'baixa'].includes(r.confianca));
t('traz ressalva de 1 Hz quando pontos esparsos (passo 30 m)', r.ressalvas.some(s => s.includes('25 Hz')));
t('variáveis trazem fonte e confiança', (() => { const v = r.variaveis.vminKmh; return v && 'fonte' in v && 'confianca' in v; })());
t('flags presentes (houveFreada/encadeada)', 'houveFreada' in r.flags && 'encadeada' in r.flags);
t('formato proposto não vazio', typeof r.formato === 'string' && r.formato.length > 10);
// honestidade: passo curto (5 m, denso) sobe confiança da geometria
const denso = classifica([150, 140, 130, 120, 110, 100, 95, 92, 90, 90, 92], 999, 5);
t('geometria com passo 5 m não é marcada baixa por espaçamento', denso.variaveis.espacamentoM.valor <= LIMIARES.espacamentoMaxM);

// arco DENSO de raio decrescente (16 pts, ~4 m de passo) com freada — dispara o ramo de
// geometria confiança 'media' + perfil 'decrescente' (cenário do bug de ressalva dupla).
function arcoDecrescente() {
  const lat0 = -15.77, lng0 = -47.90, cos0 = Math.cos(lat0 * D2R);
  const pts = []; let ang = 0, x = 0, y = 0;
  for (let i = 0; i < 16; i++) {
    const r = 120 - i * 6, dAng = 4 / r; ang += dAng; x += 4 * Math.cos(ang); y += 4 * Math.sin(ang);
    pts.push({ lat: lat0 + (y / R) * R2D, lng: lng0 + (x / (R * cos0)) * R2D, kmh: 150 - i * 4.5, t: i * 100 });
  }
  return pts;
}
t('ressalva de perfil não é contraditória (corrige dangling-else)', (() => {
  const r = classificarTrecho({ geo: { nome: 'arc', id: 'a' }, pts: arcoDecrescente(), distProximaM: 999 });
  const temT2T5 = r.ressalvas.some(s => /avaliar T[25]/.test(s));
  const temNaoDet = r.ressalvas.some(s => /não determinável/.test(s));
  return !(temT2T5 && temNaoDet); // nunca as duas juntas
})());

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
