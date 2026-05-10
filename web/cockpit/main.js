// main.js — bootstrap do cockpit web (PROTÓTIPO / REFERÊNCIA EXECUTÁVEL).
//
// Spec: PLANO_FASE_1.md §6 MS-13 + ADR-023 amendment 3 (Flávio 2026-05-09)
//
// REGRA DURA: este arquivo NÃO É O PRODUTO FINAL. É o entry point do
// protótipo HTML que demonstra visualmente o mockup canônico funcionando
// com lógica de domínio plugada. Produto final do cockpit Windows é nativo
// (stack a decidir). Este protótipo serve como spec executável pra portar.
//
// Pluga: CockpitState ← LiveDataBridge ← (TransportSelector mock IMU/GPS +
// T4000 sample stream simulado). CockpitRenderer aplica estado no DOM.
//
// O `cockpit.js` extraído do mockup canônico (demo loop original) NÃO é
// incluído na variante `index-live.html` — pra evitar conflito com este
// bootstrap. O `index.html` original continua usando o `cockpit.js` demo.

import { CockpitState, TrechoStatus } from './cockpit-state.js';
import { attachRendererToDocument } from './cockpit-renderer.js';
import { LiveDataBridge } from './live-data-bridge.js';
import { TransportSelector, MockTransport } from './transport.js';

// ── Setup ─────────────────────────────────────────────────────

const cockpitState = new CockpitState();
const renderer = attachRendererToDocument(cockpitState, document);
const bridge = new LiveDataBridge({ cockpitState });

const primary = new MockTransport('cabo');
const fallback = new MockTransport('realtime');
const transport = new TransportSelector({
  primary,
  fallback,
  onMessage: (env) => bridge.ingestImuGps(env),
  onSwitch: (stage, info) => console.log('[transport]', stage, info),
});
transport.start();

// ── Demo: alimenta cockpit com dado simulado ──────────────────

const tNow = () => performance.now();
const HEARTBEAT_MS = 1000;
const T4000_TICK_MS = 50;     // 20 Hz (fake — produção é 20 Hz real do CAN)
const IMU_TICK_MS = 100;      // 10 Hz agregado (paridade com MS-2.8)
const SELECTOR_TICK_MS = 250; // tick interno do selector

// 1. Heartbeats no transporte primário (cabo) — mantém selector em ON_PRIMARY
setInterval(() => {
  primary.inject({ tMono: tNow(), source: 'heartbeat', payload: null });
}, HEARTBEAT_MS);

// 2. IMU/GPS sintético chegando pelo cabo
let imuT = 0;
setInterval(() => {
  imuT += IMU_TICK_MS / 1000;
  primary.inject({
    tMono: tNow(),
    source: 'iphone-imu',
    payload: {
      x: 480 + 200 * Math.cos(imuT * 0.5),
      y: 220 + 120 * Math.sin(imuT * 0.5),
      accLong: 0.3 * Math.sin(imuT * 1.5),
      accLat: 0.5 * Math.cos(imuT * 1.5),
      speedKmh: 90,
      heading: (imuT * 30) % 360,
      gapDurationMs: 0,
    },
  });
}, IMU_TICK_MS);

// 3. Selector tick (em produção pode ficar num requestAnimationFrame)
setInterval(() => transport.tick(), SELECTOR_TICK_MS);

// 4. T4000 sample stream simulando rampa de RPM 1000→7800→1000 (~10s ciclo)
let rpmStep = 0;
setInterval(() => {
  rpmStep = (rpmStep + 1) % 200;
  const norm = rpmStep < 100 ? rpmStep / 100 : (200 - rpmStep) / 100;
  const rpm = Math.round(1000 + norm * 6800);
  bridge.ingestT4000({
    rpm,
    speedKmh: Math.round(40 + norm * 120),
    oilPressBar: 4.0,
    oilTempC: 80,
    waterTempC: 80,
    fuelPressBar: 4.0,
    batteryV: 12.5,
    tpsPct: Math.round(norm * 100),
    mapBar: 1.0 + norm * 0.5,
    airTempC: 35,
    egtC: Math.round(400 + norm * 600),
    egtOutOfRange: false,
    lambda: 0.92 - norm * 0.10,
    fuelTempC: 50,
    marcha: Math.min(6, Math.max(1, Math.floor(norm * 6) + 1)),
    ecuErrorBits: 0,
    tMono: tNow(),
    checksumOk: true,
  });
}, T4000_TICK_MS);

// 5. Halo / delta / ação ciclando os 4 estados pra mostrar visual
const HALO_PRESETS = [
  {
    halo: TrechoStatus.NEUTRO,
    deltaClass: '',     deltaVal: '0.00',
    acaoText: 'BUSCAR LIMITE', acaoClass: '',
    entradaEstado: 'ok-pior',  entradaVal: 88,
    freioAtual: 18, freioRef: 16,
  },
  {
    halo: TrechoStatus.RECORDE_STINT,
    deltaClass: 'bom',  deltaVal: '0.27',
    acaoText: 'ÁPICE TARDE',  acaoClass: '',
    entradaEstado: 'ok-melhor', entradaVal: 95,
    freioAtual: 15, freioRef: 16,
  },
  {
    halo: TrechoStatus.MELHOR_HISTORICO,
    deltaClass: 'bom',  deltaVal: '0.41',
    acaoText: 'MANTER LINHA', acaoClass: '',
    entradaEstado: 'ok-melhor', entradaVal: 96,
    freioAtual: 16, freioRef: 16,
  },
  {
    halo: TrechoStatus.PIOR_STINT,
    deltaClass: 'erro', deltaVal: '0.42',
    acaoText: 'FREIE TARDE',  acaoClass: 'erro',
    entradaEstado: 'ok-pior', entradaVal: 88,
    freioAtual: 22, freioRef: 16,
  },
];
let haloIdx = 0;
function nextHalo() {
  cockpitState.applyHaloPreset(HALO_PRESETS[haloIdx]);
  haloIdx = (haloIdx + 1) % HALO_PRESETS.length;
}
nextHalo();
setInterval(nextHalo, 4000);

// ── Banner "PROTÓTIPO" no DevTools ──────────────────────────

console.log('%c P1 Fast COCKPIT — PROTÓTIPO ',
  'background:#9c4cff;color:#fff;font-weight:bold;padding:6px 12px;border-radius:4px;');
console.log('Implementação final: nativa Windows + iOS Swift (ADR-023 amendment 3).');
console.log('Este HTML é referência executável + spec dos smokes JS.');

// Expose pro DevTools (debug)
window.__p1 = { cockpitState, bridge, transport, primary, fallback };
