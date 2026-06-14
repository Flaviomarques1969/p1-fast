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

import { CockpitState, TrechoStatus, ApexEstado } from './cockpit-state.js';
import { attachRendererToDocument } from './cockpit-renderer.js';
import { LiveDataBridge } from './live-data-bridge.js';
import { TransportSelector, MockTransport } from './transport.js';
import { TrechoDetector } from './trecho-detector.js';
import { AlertasCriticos } from './alertas-criticos.js';
import { calcularDelta } from './delta-calculator.js';
import { PadraoAcumulador } from './padrao-acumulador.js';
import { ChegadaDetector, loadMarcoChegada } from './chegada-detector.js';
import { BoxDetector, loadMarcosBox } from './box-detector.js';
import { criarShiftLightOrquestrador } from './shift-light-orquestrador.js';
import { ModoStint } from './shift-light-modos.js';
// segments-loader e melhores-loader importam Supabase via esm.sh (URL HTTP).
// Carregamento dinâmico evita que o Node ESM loader quebre no smoke test
// — eles só são usados em runtime no browser.

// ── Setup ─────────────────────────────────────────────────────

const cockpitState = new CockpitState();
const renderer = attachRendererToDocument(cockpitState, document);

// Engines plugáveis (decisão Flávio 27/05/2026 — passo A). Detector é
// instanciado assíncrono depois que track_segments carrega.
let trechoDetector = null;
const alertasCriticos = new AlertasCriticos({
  onChange: () => {
    const msg = alertasCriticos.getMensagemPrincipal();
    if (!msg) { cockpitState.hideMessage(); return; }
    cockpitState.showMessage({ tipo: msg.tipo, texto: msg.texto });
  },
});
setInterval(() => alertasCriticos.tick(), 500);

// Estado compartilhado: último segmento da volta (preenchido após carga).
let padraoAcumulador = null;
let _ultimoSegmentId = null;
let chegadaDetector = null;
let boxDetector = null;
let _ctxConfig = { carroId: null, trackId: null, layoutId: null, tipoPneu: null };

const bridge = new LiveDataBridge({
  cockpitState,
  alertasCriticos,
  deltaCalculator: calcularDelta,
  onSalvarPassagem: async ({ segmentId, tempoS, pontos }) => {
    if (!_ctxConfig.carroId || !_ctxConfig.trackId || !_ctxConfig.tipoPneu) return;
    try {
      const { gravarPassagem } = await import('./melhores-loader.js');
      await gravarPassagem({
        carroId:     _ctxConfig.carroId,
        autodromoId: _ctxConfig.trackId,
        layoutId:    _ctxConfig.layoutId,
        segmentId,
        tipoPneu:    _ctxConfig.tipoPneu,
        tempoS,
        pontos,
      });
      console.log('[bridge] passagem salva:', segmentId, tempoS.toFixed(3), 's');
    } catch (e) { console.warn('[bridge] erro ao salvar passagem:', e.message); }
  },
  onTrechoEvent: (ev) => {
    if (!ev) return;
    if (ev.type === 'apice-cruzou') {
      const dist  = typeof ev.distFromIdealM === 'number' ? ev.distFromIdealM : null;
      const angle = typeof ev.angleFromIdealDeg === 'number' ? ev.angleFromIdealDeg : null;
      const estado = (dist != null && dist <= 1.5) ? ApexEstado.OK_MELHOR
                   : (dist != null) ? ApexEstado.OK_PIOR : ApexEstado.PENDENTE;
      cockpitState.setApexPonto('apice', { estado, distM: dist, angleDeg: angle });
    }
    // Heurística de backup: se o detector de chegada não estiver disponível
    // (marco não cadastrado), fecha a volta no saída do último trecho. Caso
    // normal de hoje em Brasília → chegadaDetector é o sinal principal.
    if (!chegadaDetector && ev.type === 'saida-cruzou'
        && padraoAcumulador && ev.segmentId === _ultimoSegmentId) {
      padraoAcumulador.fecharVolta();
    }
  },
});

// Encaminha cada amostra T4000 para o acumulador (sem mexer no bridge core).
const _bridgeIngestT4000 = bridge.ingestT4000.bind(bridge);
bridge.ingestT4000 = (sample) => {
  _bridgeIngestT4000(sample);
  if (padraoAcumulador) padraoAcumulador.ingestT4000(sample);
};


const _bridgeIngestImu = bridge.ingestImuGps.bind(bridge);
bridge.ingestImuGps = (envelope) => {
  _bridgeIngestImu(envelope);
  if (!envelope?.payload?.lat) return;
  const gps = {
    lat: envelope.payload.lat,
    lng: envelope.payload.lng,
    t:   envelope.payload.tMono ?? envelope.payload.t ?? Date.now(),
  };
  if (chegadaDetector) chegadaDetector.ingestGps(gps);
  if (boxDetector) boxDetector.ingestGps(gps);
};

// Carga assíncrona dos segmentos (Supabase). Sem segmentos = detector
// inativo; bridge continua entregando shift + alertas T4000.
(async () => {
  // Em Node (smoke tests) `window` é um objeto vazio sem `addEventListener`
  // — usa isso como heurística pra pular o carregamento do Supabase.
  const isBrowser = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
  if (!isBrowser) return;
  try {
    const { loadBrasiliaPrincipal } = await import('./segments-loader.js');
    const segments = await loadBrasiliaPrincipal();
    if (Array.isArray(segments) && segments.length > 0) {
      trechoDetector = new TrechoDetector({ segments });
      bridge._trechoDetector = trechoDetector;
      trechoDetector._onEvent = (ev) => bridge._handleTrechoEvent(ev);
      _ultimoSegmentId = segments[segments.length - 1].id;
      console.log('[boot] track_segments carregados:', segments.length);
      // Carrega o marco de chegada (sinal real de fechamento de volta).
      try {
        const marcoChegada = await loadMarcoChegada('0dc85cfb-6236-567e-814c-eddf610b301f');
        if (marcoChegada) {
          chegadaDetector = new ChegadaDetector({
            marco: marcoChegada,
            onChegada: ({ voltaN }) => {
              if (padraoAcumulador) padraoAcumulador.fecharVolta();
              console.log('[boot] volta', voltaN, 'fechada pela linha de chegada');
            },
          });
          console.log('[boot] marco de chegada carregado');
        } else {
          console.warn('[boot] sem marco de chegada → fallback no último trecho');
        }
      } catch (e) { console.warn('[boot] marco chegada falhou:', e.message); }
      try {
        const marcosBox = await loadMarcosBox('0dc85cfb-6236-567e-814c-eddf610b301f');
        if (marcosBox) {
          boxDetector = new BoxDetector({
            pitIn:  marcosBox.pitIn,
            pitOut: marcosBox.pitOut,
            onEntradaBox: () => {
              cockpitState.setNoBox(true);
              cockpitState.setSilencioso(true);
              cockpitState.showMessage({ tipo: 'grave', texto: 'NO BOX' });
              console.log('[boot] entrou no box');
            },
            onSaidaBox: () => {
              cockpitState.setNoBox(false);
              cockpitState.setSilencioso(false);
              cockpitState.hideMessage();
              console.log('[boot] saiu do box');
            },
          });
          console.log('[boot] detector de box ativo');
        }
      } catch (e) { console.warn('[boot] marcos box falharam:', e.message); }
      const carroId     = window.__P1_CARRO_ID__     ?? null;
      const autodromoId = window.__P1_AUTODROMO_ID__ ?? null;
      const tipoPneu    = window.__P1_TIPO_PNEU__    ?? null;
      if (carroId && autodromoId && tipoPneu) {
        _ctxConfig = {
          carroId, trackId: autodromoId,
          layoutId: '0dc85cfb-6236-567e-814c-eddf610b301f',
          tipoPneu,
        };
        const { loadMelhoresPassagens } = await import('./melhores-loader.js');
        const melhores = await loadMelhoresPassagens({ carroId, autodromoId, tipoPneu });
        for (const [segId, ref] of melhores) bridge.setReferenciaSegmento(segId, ref);
        console.log('[boot] melhores passagens:', melhores.size);
        // Carrega o padrão histórico já gravado pra essa combinação.
        const { loadPadrao, savePadrao } = await import('./padrao-persister.js');
        const inicial = await loadPadrao({ carroId, trackId: autodromoId, tipoPneu });
        padraoAcumulador = new PadraoAcumulador({
          carroId, trackId: autodromoId, tipoPneu,
          padraoInicial: inicial?.padrao ?? null,
          voltasIniciais: inicial?.voltas ?? [],
          desvioPct: inicial?.desvioPct ?? 0.20,
          onAlertasPreditivos: (ids) => {
            for (const id of ids) alertasCriticos.raiseManual(id);
          },
          onPersist: async (snap) => { await savePadrao(snap); },
        });
        console.log('[boot] padrão acumulador pronto. Voltas iniciais:', (inicial?.voltas?.length ?? 0));
      }
    } else {
      console.warn('[boot] track_segments vazio — detector inativo');
    }
  } catch (e) {
    console.warn('[boot] segments-loader falhou:', e.message);
  }
})();

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

// 4. Orquestrador do shift light inteligente (Onda 6 — integração final).
// Recebe amostras do T4000 simulado, identifica marcha, calcula RPM ótimo
// por marcha e atualiza a barra de aprendizado real (sem demo loop).
// Decisão Flávio 2026-05-29.
const CURVA_BUBI_DEMO = [
  // Curva sintética próxima do dinamômetro Lenza Bubi (resumida).
  // Em produção, vai vir do banco (tabela dyno_curve pelo dyno-loader).
  { rpm: 2500, potencia_cv: 1,   torque_nm: 2 },
  { rpm: 3000, potencia_cv: 68,  torque_nm: 159 },
  { rpm: 3500, potencia_cv: 79,  torque_nm: 158 },
  { rpm: 4000, potencia_cv: 87,  torque_nm: 160 },
  { rpm: 4500, potencia_cv: 101, torque_nm: 158 },
  { rpm: 5000, potencia_cv: 113, torque_nm: 161 },
  { rpm: 5200, potencia_cv: 120, torque_nm: 162 }, // pico torque
  { rpm: 5500, potencia_cv: 122, torque_nm: 156 },
  { rpm: 6050, potencia_cv: 124, torque_nm: 145 }, // pico potência
  { rpm: 6300, potencia_cv: 117, torque_nm: 130 },
  { rpm: 6400, potencia_cv: 72,  torque_nm: 79 },
];

const shiftLight = criarShiftLightOrquestrador({
  cockpitState,
  dynoCurve:        CURVA_BUBI_DEMO,
  modoStintInicial: ModoStint.NORMAL,
});

// 5. T4000 sample stream simulando rampa de RPM 1000→7800→1000 (~10s ciclo)
let rpmStep = 0;
setInterval(() => {
  rpmStep = (rpmStep + 1) % 200;
  const norm = rpmStep < 100 ? rpmStep / 100 : (200 - rpmStep) / 100;
  const rpm = Math.round(1000 + norm * 6800);
  const kmh = Math.round(40 + norm * 120);

  // Alimenta o orquestrador (alimenta detector de marcha + acumulador).
  shiftLight.ingestSample({ rpm, kmh, ts: tNow() });

  bridge.ingestT4000({
    rpm,
    speedKmh: kmh,
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

// ── Demo realista da barra de aprendizado ──
// O orquestrador alimenta o pct REAL (vindo do detector + acumulador).
// Aqui no protótipo HTML usamos um ciclo VISUAL rápido (0→100→0) só
// pra você ver as 4 cores e a animação. Em produção, esse demo loop
// some e o pct vem 100% do orquestrador real.
// Decisão Flávio 2026-05-29: priorizar visualização premium da barra.

let trechoDemoIdx = 0;
const TRECHOS_DEMO = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];
setInterval(() => {
  trechoDemoIdx = (trechoDemoIdx + 1) % TRECHOS_DEMO.length;
  shiftLight.setTrechoAtual(TRECHOS_DEMO[trechoDemoIdx]);
}, 700);

setInterval(() => {
  shiftLight.registrarVoltaLimpa();
}, 6000);

// Demo loop VISUAL: 0% → 100% → 0% em ~16s ciclo. Sobrescreve o pct
// real só pra demonstração. Em produção remover este bloco.
let aprDemoPct = 0;
let aprDemoDir = 1;
setInterval(() => {
  aprDemoPct += aprDemoDir * 1.5;
  if (aprDemoPct >= 100) { aprDemoPct = 100; aprDemoDir = -1; }
  if (aprDemoPct <= 0)   { aprDemoPct = 0;   aprDemoDir =  1; }
  cockpitState.setAprendizado(aprDemoPct);
}, 120);

// Após o flash de calibração (1100ms da animação CSS), limpa o data-attr
// pra animação poder disparar novamente no próximo 99→100.
cockpitState.onChange((state, prev, keys) => {
  if (keys.includes('flashIa') && state.flashIa) {
    setTimeout(() => cockpitState.setFlashIa(false), 1150);
  }
});

// ── Banner "PROTÓTIPO" no DevTools ──────────────────────────

console.log('%c P1 Fast COCKPIT — PROTÓTIPO ',
  'background:#9c4cff;color:#fff;font-weight:bold;padding:6px 12px;border-radius:4px;');
console.log('Implementação final: nativa Windows + iOS Swift (ADR-023 amendment 3).');
console.log('Este HTML é referência executável + spec dos smokes JS.');

// Expose pro DevTools (debug)
window.__p1 = { cockpitState, bridge, transport, primary, fallback };
