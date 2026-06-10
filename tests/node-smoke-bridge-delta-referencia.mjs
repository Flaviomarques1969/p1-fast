// Smoke: delta do trecho compara contra a referência VIGENTE ANTES da passagem.
//
// Defeito provado 10/06/2026 (sessão "continua a orientação"):
//   No saida-cruzou, quando a passagem era "nova melhor" (caso típico: as 56
//   referências do banco são sintéticas e lentas — ex.: trecho de 18 s que o
//   carro faz em 7,8 s), o bridge substituía a referência local ANTES de
//   calcular o delta. O delta saía da passagem CONTRA ELA MESMA → zero em
//   todos os sub-trechos → oportunidade-trecho não via componente perdendo →
//   getOrientacao null → tela de orientação nunca acendia (null 200/200 com
//   deltaCalculados=13 na sonda do replay).
//
// Regras verificadas aqui:
//   A) delta-calculado usa a referência anterior (delta positivo quando a
//      passagem é mais lenta que a referência em velocidade, mesmo sendo
//      "nova melhor" em tempo total).
//   B) Depois do cálculo, a referência local É substituída (carro real) —
//      a intenção original ("próxima passagem compara contra esta") fica.
//   C) Passagem de SIMULADOR nunca vira referência local nem dispara
//      onSalvarPassagem (par local da blindagem da nuvem __P1_ORIGEM_SIM__).
//   D) Toda passagem fechada emite 'passagem-fechada' com os pontos
//      canônicos (alimenta as marcas VOCÊ da tela de orientação, melhor ou não).

import { LiveDataBridge } from '../web/cockpit/live-data-bridge.js';
import { CockpitState } from '../web/cockpit/cockpit-state.js';
import { calcularDelta } from '../web/cockpit/delta-calculator.js';

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}
const tick = () => new Promise(r => setTimeout(r, 0));

const SEG = 'seg-teste-0001';

// Caminho reto pra norte: ~200 m, 21 pontos a cada ~10 m.
// lat 0.0001 ≈ 11,1 m. kmh constante.
function pontosLinha({ n = 21, kmh, t0 = 0 }) {
  const pts = [];
  const passoM = 10;
  const vMs = kmh / 3.6;
  for (let i = 0; i < n; i++) {
    pts.push({
      lat: -15.77 + i * (passoM / 111320),
      lng: -47.89,
      kmh,
      t: t0 + Math.round(i * (passoM / vMs) * 1000),
    });
  }
  return pts;
}

// Referência estilo banco: MESMO caminho, MAIS RÁPIDA em velocidade (100 km/h),
// mas com tempo_trecho_s MAIOR (gravação sintética mais comprida) → a passagem
// atual (90 km/h, ~8 s) é "nova melhor" em tempo. sub:null como no banco real.
function referenciaBanco() {
  const pts = pontosLinha({ n: 21, kmh: 100 });
  const total = pts[pts.length - 1].t - pts[0].t;
  return {
    segmentId: SEG,
    tempoS: 18.0, // sintética e lenta no tempo total, como as 56 do banco
    pontos: pts.map((p, i) => ({ ...p, fracao: i / (pts.length - 1), sub: null })),
    _totalMs: total,
  };
}

// Detector falso controlável: o bridge só precisa de getState() e do _onEvent
// que ele mesmo pluga no construtor.
function detectorFalso() {
  return {
    _phase: 'antes-entrada',
    _segId: null,
    getState() { return { phase: this._phase, currentSegmentId: this._segId }; },
    ingestGps() {},
  };
}

// Roda UMA passagem completa pelo bridge: entra no trecho, alimenta GPS nas
// 3 fases, cruza a saída. Devolve { eventos, salvas }.
function rodarPassagem(bridge, det, { kmh = 90 } = {}) {
  const pts = pontosLinha({ n: 21, kmh });
  det._segId = SEG;
  for (let i = 0; i < pts.length; i++) {
    det._phase = i < 7 ? 'entrada-freio' : i < 12 ? 'freio-apice' : 'apice-saida';
    bridge.ingestImuGps({ source: 'iphone-imu', payload: pts[i] });
  }
  det._phase = 'pos-saida';
  det._onEvent({ type: 'saida-cruzou', segmentId: SEG });
  det._segId = null;
}

function montar({ origemSimulador } = {}) {
  const eventos = [];
  const salvas = [];
  const det = detectorFalso();
  const bridge = new LiveDataBridge({
    cockpitState: new CockpitState(),
    trechoDetector: det,
    deltaCalculator: calcularDelta,
    onTrechoEvent: (ev) => eventos.push(ev),
    onSalvarPassagem: async (p) => { salvas.push(p); },
    ...(origemSimulador ? { origemSimulador } : {}),
  });
  bridge.setReferenciaSegmento(SEG, referenciaBanco());
  return { bridge, det, eventos, salvas };
}

// ── A) o delta sai contra a referência ANTERIOR ──────────────────────────

t('DELTA-REF-01 passagem mais lenta que a referência → deltaTotalS positivo (mesmo sendo "nova melhor" no tempo)', () => {
  const { bridge, det, eventos } = montar();
  rodarPassagem(bridge, det, { kmh: 90 });
  const d = eventos.find(e => e.type === 'delta-calculado');
  if (!d) throw new Error('delta-calculado não disparou');
  // esperado ≈ 200m/25m/s − 200m/27,78m/s = +0,80 s. Self-compare daria ~0.
  if (!(d.deltaTotalS > 0.3)) {
    throw new Error(`deltaTotalS=${d.deltaTotalS.toFixed(3)} — comparou com ela mesma? (esperado ≈ +0,8 s)`);
  }
});

t('DELTA-REF-02 sub-trechos recebem delta (entrada/freio/apice com amostras e deltaS > 0)', () => {
  const { bridge, det, eventos } = montar();
  rodarPassagem(bridge, det, { kmh: 90 });
  const d = eventos.find(e => e.type === 'delta-calculado');
  for (const sub of ['entrada', 'freio', 'apice']) {
    const s = d.porSubTrecho[sub];
    if (!s || s.amostras < 1) throw new Error(`sub ${sub} sem amostras`);
    if (!(s.deltaS > 0)) throw new Error(`sub ${sub} deltaS=${s.deltaS} (esperado > 0)`);
  }
});

// ── B) referência local substituída DEPOIS (carro real) ──────────────────

t('DELTA-REF-03 carro real: depois do cálculo a passagem vira a referência local', () => {
  const { bridge, det, salvas } = montar();
  rodarPassagem(bridge, det, { kmh: 90 });
  const ref = bridge._referenciasPorSegmento.get(SEG);
  if (!ref || ref.tempoS === 18.0) throw new Error('referência local não foi substituída');
  if (salvas.length !== 1) throw new Error(`onSalvarPassagem: ${salvas.length}x (esperado 1)`);
});

// ── C) simulador nunca vira referência nem salva ──────────────────────────

t('DELTA-REF-04 simulador: referência local intacta + onSalvarPassagem NÃO chamado + delta segue positivo na 2ª volta', () => {
  const { bridge, det, eventos, salvas } = montar({ origemSimulador: () => true });
  rodarPassagem(bridge, det, { kmh: 90 });
  rodarPassagem(bridge, det, { kmh: 90 });
  const ref = bridge._referenciasPorSegmento.get(SEG);
  if (!ref || ref.tempoS !== 18.0) throw new Error('referência local foi trocada por passagem de simulador');
  if (salvas.length !== 0) throw new Error(`onSalvarPassagem chamado ${salvas.length}x pra simulador`);
  const deltas = eventos.filter(e => e.type === 'delta-calculado');
  if (deltas.length !== 2) throw new Error(`esperava 2 deltas, veio ${deltas.length}`);
  if (!(deltas[1].deltaTotalS > 0.3)) {
    throw new Error(`2ª volta deltaTotalS=${deltas[1].deltaTotalS.toFixed(3)} — comparou sim×sim?`);
  }
});

// ── D) toda passagem fechada emite os pontos canônicos ────────────────────

t('DELTA-REF-05 passagem-fechada emitida com pontos canônicos (fracao + sub), melhor ou não', () => {
  const { bridge, det, eventos } = montar({ origemSimulador: () => true });
  rodarPassagem(bridge, det, { kmh: 90 });
  const pf = eventos.find(e => e.type === 'passagem-fechada');
  if (!pf) throw new Error('passagem-fechada não disparou');
  if (pf.segmentId !== SEG) throw new Error('segmentId errado');
  if (!Array.isArray(pf.pontos) || pf.pontos.length < 9) throw new Error('pontos ausentes');
  const p = pf.pontos[3];
  if (!Number.isFinite(p.fracao)) throw new Error('ponto sem fracao');
  if (!p.sub) throw new Error('ponto sem sub');
});

console.log(`\nbridge-delta-referencia: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
