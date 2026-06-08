// main-t3000.js — bootstrap do cockpit ao vivo lendo a Injepro T3000
// direto via WebUSB. Roda em p1t4000.vercel.app.
//
// Fluxo:
//   1. Usuário clica "Autorizar T3000".
//   2. Página manda ACK e espera "OK".
//   3. Loop a 10Hz: manda RI → recebe bloco → decodifica → alimenta bridge.
//   4. Renderer atualiza o painel canônico (shift light, alertas, etc).

import { CockpitState, ApexEstado } from './cockpit-state.js';
import { attachRendererToDocument } from './cockpit-renderer.js';
import { LiveDataBridge, DEFAULT_LIMITS } from './live-data-bridge.js';
import { parseT3000RIBlock, ACK_BYTES, RI_BYTES, isAckOk } from './t3000-usb-parser.js';
import { startCloudBridge, publishSample, onStatusChange, getStats } from './cloud-bridge.js';
import { loadDynoCurve, loadGearRatios, BUBI_CARRO_ID } from './dyno-loader.js';
import { TrechoDetector } from './trecho-detector.js';
import { AlertasCriticos } from './alertas-criticos.js';
import { calcularDelta } from './delta-calculator.js';
import { PadraoAcumulador } from './padrao-acumulador.js';
import { ChegadaDetector, loadMarcoChegada } from './chegada-detector.js';
import { BoxDetector, loadMarcosBox } from './box-detector.js';
// ── Shift light v2 (3 modos + cruzamento de força + aprendizado online) ──
// Decisão Flávio 2026-05-29. Plugado em 2026-05-29 conforme auditoria severa.
import { criarShiftLightOrquestrador } from './shift-light-orquestrador.js';
import { ModoStint } from './shift-light-modos.js';
// ── Mensagens pedagógicas (17 aprovadas em 27/05/2026) ──
import { criarEmpurradorDeMensagens } from './mensagens-pedagogicas.js';
// ── Watchdog do conversor T3000 (queda de sinal → alerta visual no painel) ──
import { criarT3000Watchdog } from './t3000-watchdog.js';
// segments-loader/melhores-loader importam Supabase via esm.sh — dynamic
// import dentro da IIFE evita quebra em smoke Node.

// ── Identificação do carro ativo ───────────────────────────────
// Bubi é o único carro hoje. Pra plugar outro carro no futuro, basta definir
// window.__P1_CARRO_ID__ no HTML ou gravar em localStorage. Default = Bubi.
function resolveCarroAtivo() {
  try {
    if (typeof window !== 'undefined' && typeof window.__P1_CARRO_ID__ === 'string' && window.__P1_CARRO_ID__) {
      return window.__P1_CARRO_ID__;
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('p1fast-carro-ativo');
      if (stored) return stored;
    }
  } catch {}
  return BUBI_CARRO_ID;
}
const CARRO_ATIVO = resolveCarroAtivo();

// ── Modo de stint inicial — lê localStorage gravado pela tela de configuração ──
// Padrão escolhido por Flávio em 2026-05-29 via card de decisão: AGRESSIVO.
// Justificativa: ganho de ~0,4 s por volta no limite mecânico (6.250-6.350 rpm).
// Auto-rebaixa pra NORMAL se água < temperatura mínima do envelope (proteção).
function resolveModoStintInicial() {
  try {
    if (typeof localStorage !== 'undefined') {
      const m = localStorage.getItem('p1fast-modo-stint-v1');
      if (m === ModoStint.DURABILIDADE || m === ModoStint.NORMAL || m === ModoStint.AGRESSIVO) {
        return m;
      }
    }
  } catch {}
  return ModoStint.AGRESSIVO;
}

// ── Calibração inicial Bubi (dinamômetro Lenza Powerchips 2026-05-18) ──
// Valores DEFAULT — sobrescritos pela curva da nuvem quando carregar.
const BUBI_LIMITS = {
  ...DEFAULT_LIMITS,
  redlineRpm: 6300,      // regra: NÃO passar de 6.350 (queda abrupta após)
  peakTorqueRpm: 5200,   // pico de torque conhecido do dinamômetro (default seguro)
  torqueLitOffsetRpm: 300, // acende a 300 rpm antes do pico
};

// ── Setup do painel ───────────────────────────────────────────
const cockpitState = new CockpitState();
attachRendererToDocument(cockpitState, document);

// Engines plugáveis (decisão Flávio 27/05/2026 — passo A). Detector é
// instanciado depois que track_segments carrega via Supabase.
let trechoDetector = null;
const alertasCriticos = new AlertasCriticos({
  onChange: () => {
    const msg = alertasCriticos.getMensagemPrincipal();
    if (!msg) { cockpitState.hideMessage(); return; }
    cockpitState.showMessage({ tipo: msg.tipo, texto: msg.texto });
  },
});
setInterval(() => alertasCriticos.tick(), 500);

// Empurrador das 17 mensagens pedagógicas (decisão Flávio 27/05/2026).
// Plugado nos eventos delta-calculado + apice-passagem disparados pelo bridge.
const empurrarMsgPedagogica = criarEmpurradorDeMensagens({ cockpitState });

// Orquestrador shift light v2 — instanciado quando a curva carrega.
let shiftOrquestrador = null;
let _modoStintAtual = resolveModoStintInicial();

// Estado compartilhado: último segmento da volta (preenchido após carga).
let padraoAcumulador = null;
let _ultimoSegmentId = null;
let chegadaDetector = null;
let boxDetector = null;
let _ctxConfig = { carroId: CARRO_ATIVO, trackId: null, layoutId: null, tipoPneu: null };

const bridge = new LiveDataBridge({
  cockpitState,
  limits: BUBI_LIMITS,
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
      log(`passagem salva: ${segmentId.slice(0,8)} ${tempoS.toFixed(2)}s`);
    } catch (e) { log('erro ao salvar passagem: ' + e.message); }
  },
  onTrechoEvent: (ev) => {
    if (!ev) return;
    if (ev.type === 'apice-cruzou') {
      const dist  = typeof ev.distFromIdealM === 'number' ? ev.distFromIdealM : null;
      const angle = typeof ev.angleFromIdealDeg === 'number' ? ev.angleFromIdealDeg : null;
      const estado = (dist != null && dist <= 1.5) ? ApexEstado.OK_MELHOR
                   : (dist != null) ? ApexEstado.OK_PIOR : ApexEstado.PENDENTE;
      cockpitState.setApexPonto('apice', { estado, distM: dist, angleDeg: angle });
      // Alimenta contexto do empurrador pra próxima mensagem pedagógica
      empurrarMsgPedagogica.setUltimoApice(ev);
    }
    // Quando entra no trecho, informa o orquestrador (Onda 8: flash IA + tipos).
    if (ev.type === 'entrada-cruzou' && shiftOrquestrador) {
      try { shiftOrquestrador.setTrechoAtual(ev.segmentId); } catch {}
    }
    // delta-calculado → empurra mensagem pedagógica das 17 aprovadas
    if (ev.type === 'delta-calculado') {
      try { empurrarMsgPedagogica(ev); } catch {}
    }
    if (!chegadaDetector && ev.type === 'saida-cruzou'
        && padraoAcumulador && ev.segmentId === _ultimoSegmentId) {
      padraoAcumulador.fecharVolta();
    }
  },
});

const _bridgeIngestT4000_t = bridge.ingestT4000.bind(bridge);
bridge.ingestT4000 = (sample) => {
  _bridgeIngestT4000_t(sample);
  if (padraoAcumulador) padraoAcumulador.ingestT4000(sample);
  // Alimenta o orquestrador shift light v2 — se carregado.
  // Tem fallback automático: se a curva não tiver carregado, o orquestrador
  // não recalcula (devolve null) e o bridge segue com BUBI_LIMITS estáticos.
  if (shiftOrquestrador && typeof sample?.rpm === 'number') {
    try {
      shiftOrquestrador.ingestSample({
        rpm: sample.rpm,
        kmh: sample.speedKmh ?? 0,
        ts:  sample.tMono ?? sample.t ?? Date.now(),
      });
      const rpmOtimo = shiftOrquestrador.getRpmOtimoTroca();
      if (Number.isFinite(rpmOtimo) && rpmOtimo > 0) {
        // Atualiza o ponto em que o LED dispara o FIRE. Offset de 300 rpm
        // antes pra acender progressivamente. peakTorqueRpm é nome legado
        // do bridge — semanticamente agora é "rpm ótimo de troca".
        bridge.setLimits({ peakTorqueRpm: rpmOtimo });
      }
    } catch (e) {
      // Não derrubar o cockpit. Logar e seguir com BUBI_LIMITS estáticos.
      console.warn('[orquestrador] ingestSample falhou:', e?.message);
    }
  }
};

const _bridgeIngestImu_t = bridge.ingestImuGps.bind(bridge);
bridge.ingestImuGps = (envelope) => {
  _bridgeIngestImu_t(envelope);
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
// inativo; T3000 USB continua entregando shift + alertas T4000.
(async () => {
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
      log(`track_segments carregados: ${segments.length}`);
      try {
        const marco = await loadMarcoChegada('0dc85cfb-6236-567e-814c-eddf610b301f');
        if (marco) {
          chegadaDetector = new ChegadaDetector({
            marco,
            onChegada: ({ voltaN }) => {
              if (padraoAcumulador) padraoAcumulador.fecharVolta();
              log(`volta ${voltaN} fechada pela linha de chegada`);
            },
          });
          log('marco de chegada carregado');
        } else log('sem marco de chegada → fallback no último trecho');
      } catch (e) { log('marco chegada falhou: ' + e.message); }
      try {
        const mb = await loadMarcosBox('0dc85cfb-6236-567e-814c-eddf610b301f');
        if (mb) {
          boxDetector = new BoxDetector({
            pitIn: mb.pitIn, pitOut: mb.pitOut,
            onEntradaBox: () => {
              cockpitState.setNoBox(true);
              cockpitState.setSilencioso(true);
              cockpitState.showMessage({ tipo: 'grave', texto: 'NO BOX' });
              log('entrou no box');
            },
            onSaidaBox: () => {
              cockpitState.setNoBox(false);
              cockpitState.setSilencioso(false);
              cockpitState.hideMessage();
              log('saiu do box');
            },
          });
          log('detector de box ativo');
        }
      } catch (e) { log('marcos box falharam: ' + e.message); }
      const tipoPneu = window.__P1_TIPO_PNEU__ ?? 'radial-185-14';
      const autodromoId = window.__P1_AUTODROMO_ID__ ?? 'e8335412-3312-54fe-b634-db2d02c7fa81';
      _ctxConfig = {
        carroId: CARRO_ATIVO, trackId: autodromoId,
        layoutId: '0dc85cfb-6236-567e-814c-eddf610b301f', tipoPneu,
      };
      if (tipoPneu) {
        const { loadMelhoresPassagens } = await import('./melhores-loader.js');
        const melhores = await loadMelhoresPassagens({
          carroId: CARRO_ATIVO,
          autodromoId,
          tipoPneu,
        });
        for (const [segId, ref] of melhores) bridge.setReferenciaSegmento(segId, ref);
        log(`melhores passagens: ${melhores.size}`);
        if (autodromoId) {
          const { loadPadrao, savePadrao } = await import('./padrao-persister.js');
          const inicial = await loadPadrao({ carroId: CARRO_ATIVO, trackId: autodromoId, tipoPneu });
          padraoAcumulador = new PadraoAcumulador({
            carroId: CARRO_ATIVO,
            trackId: autodromoId,
            tipoPneu,
            padraoInicial: inicial?.padrao ?? null,
            voltasIniciais: inicial?.voltas ?? [],
            desvioPct: inicial?.desvioPct ?? 0.20,
            onAlertasPreditivos: (ids) => {
              for (const id of ids) alertasCriticos.raiseManual(id);
            },
            onPersist: async (snap) => { await savePadrao(snap); },
          });
          log(`padrão acumulador pronto. Voltas iniciais: ${inicial?.voltas?.length ?? 0}`);
        }
      }
    } else {
      log('track_segments vazio — detector inativo até layout existir');
    }
  } catch (e) {
    log('segments-loader falhou: ' + e.message);
  }
})();

// ── UI mínima do conector ─────────────────────────────────────
const $ = id => document.getElementById(id);
function setStatus(text, cls) {
  const el = $('connStatus'); if (!el) return;
  el.textContent = text;
  el.className = 'conn-status ' + (cls||'');
}
function setCloudStatus(s) {
  const el = $('cloudStatus'); if (!el) return;
  const labels = { off:'nuvem: desligado', connecting:'nuvem: conectando…', online:'nuvem: ao vivo', error:'nuvem: erro' };
  const cls    = { off:'warn', connecting:'warn', online:'ok', error:'bad' };
  el.textContent = labels[s] || ('nuvem: ' + s);
  el.className = 'conn-status ' + (cls[s] || 'warn');
}
onStatusChange(setCloudStatus);
function log(msg) {
  console.log('[t3000]', msg);
  const el = $('connLog'); if (!el) return;
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  while (el.children.length > 20) el.removeChild(el.firstChild);
}

// ── Estado da leitura ─────────────────────────────────────────
const t3 = { device:null, iface:null, epIn:null, epOut:null, reading:false, lastSampleTs:0 };

// Watchdog do T3000 — instanciado no boot pra reagir ao primeiro silêncio.
const _t3000Watchdog = criarT3000Watchdog({
  getUltimaAmostraTs: () => t3.lastSampleTs,
  onMudancaSinal: (perdeu) => {
    if (perdeu) {
      setStatus('SEM SINAL — conversor T3000 silenciou', 'bad');
      log('⚠ T3000 sem amostras há >1,5 s — alerta SEM SINAL no painel');
    } else {
      setStatus('conectado — lendo a T3000', 'ok');
      log('✓ T3000 voltou a mandar amostras');
    }
    atualizarOverlaySemSinal(perdeu);
  },
});
function iniciarWatchdog() {
  // Inicialização tardia (depois do handshake) — getter já está pronto.
  _t3000Watchdog.iniciar();
}

async function connectAndRun() {
  if (!('usb' in navigator)) {
    setStatus('navegador não suporta WebUSB', 'bad');
    log('navegador não suporta WebUSB');
    return;
  }
  try {
    setStatus('escolhendo aparelho…', 'warn');
    const dev = await navigator.usb.requestDevice({ filters: [] });
    log(`autorizado: ${dev.manufacturerName||''} ${dev.productName||''} (${dev.vendorId.toString(16)}:${dev.productId.toString(16)})`);
    await dev.open();
    if (dev.configuration === null) await dev.selectConfiguration(1);
    // descobre interface + endpoints in/out
    let ifc=-1, epIn=null, epOut=null;
    for (const it of dev.configuration.interfaces) {
      for (const a of it.alternates) {
        for (const e of a.endpoints) {
          if (e.direction === 'in'  && epIn  === null) { ifc = it.interfaceNumber; epIn  = e.endpointNumber; }
          if (e.direction === 'out' && epOut === null) { epOut = e.endpointNumber; }
        }
      }
    }
    if (ifc < 0 || epIn === null || epOut === null) {
      setStatus('aparelho sem canal de leitura/escrita', 'bad');
      log(`interfaces: ${dev.configuration.interfaces.length}, epIn=${epIn}, epOut=${epOut}`);
      return;
    }
    await dev.claimInterface(ifc);
    t3.device = dev; t3.iface = ifc; t3.epIn = epIn; t3.epOut = epOut;
    log(`canal aberto: interface ${ifc}, leitura ep ${epIn}, escrita ep ${epOut}`);

    // saudação
    await dev.transferOut(epOut, ACK_BYTES);
    log('mandado ACK, esperando OK…');
    const ackResp = await dev.transferIn(epIn, 64);
    const ackBuf = new Uint8Array(ackResp.data.buffer);
    if (!isAckOk(ackBuf)) {
      setStatus('saudação rejeitada pela central', 'bad');
      log('resposta ACK não foi OK: ' + Array.from(ackBuf.slice(0,8)).map(b=>b.toString(16)).join(' '));
      return;
    }
    log('central respondeu OK — handshake confirmado');
    setStatus('conectado — lendo a T3000', 'ok');

    // Watchdog do conversor T3000: avisa o piloto se o cabo cair.
    // Inicia AGORA (após handshake) pra ignorar o intervalo de boot.
    iniciarWatchdog();

    // assina canal ao vivo na nuvem (sem bloquear painel se falhar)
    setCloudStatus('connecting');
    startCloudBridge().then(s => {
      log('canal ao vivo na nuvem: ' + s);
    }).catch(e => log('canal ao vivo falhou: ' + e.message));

    // carrega a curva do dinamômetro da nuvem (não-bloqueante)
    loadDynoCurve(CARRO_ATIVO).then(async curva => {
      if (curva) {
        bridge.setLimits({
          peakTorqueRpm: curva.peakTorqueRpm,
          redlineRpm: curva.redlineRpm ?? BUBI_LIMITS.redlineRpm,
        });
        log(`curva ${curva.apelido}: pico de torque ${curva.peakTorqueNm.toFixed(2)} Nm @ ${curva.peakTorqueRpm} rpm (${curva.pointsCount} pontos)`);

        // ── Liga o orquestrador shift light v2 ────────────────────────
        // Só faz sentido instanciar se temos os pontos brutos da curva.
        try {
          shiftOrquestrador = criarShiftLightOrquestrador({
            cockpitState,
            dynoCurve: curva.pontos || [],
            modoStintInicial: _modoStintAtual,
            onPontoCalculado: (info) => {
              // debug — pode logar se quiser ver os RPM ótimos calculados
              // log(`shift v2: marcha ${info.marcha} → ótimo ${info.rpmOtimo} rpm`);
            },
          });
          shiftOrquestrador.setIdentificacao({ carroId: CARRO_ATIVO });
          // Carrega perfis de reação do piloto (Onda 7) — não bloqueia.
          shiftOrquestrador.carregarPerfisDoBanco()
            .then(r => log(`perfis de reação: ${r.ok ? r.carregados + ' carregados' : 'sem perfil ainda (' + r.motivo + ')'}`))
            .catch(e => log('perfis: erro ' + e.message));
          log(`shift light v2 ligado (modo ${_modoStintAtual})`);
          atualizarBadgeSafeMode(false);
        } catch (e) {
          log('shift light v2 falhou ao ligar: ' + e.message);
          shiftOrquestrador = null;
          atualizarBadgeSafeMode(true, 'Shift light v2 falhou ao iniciar — usando limites estáticos do código');
        }
      } else {
        log(`curva da nuvem indisponível, usando default (pico em ${BUBI_LIMITS.peakTorqueRpm} rpm) — MODO SEMENTE`);
        atualizarIndicadorFonte('semente');
        atualizarBadgeSafeMode(true, 'Curva do dinamômetro indisponível — usando limites estáticos do código');
      }
    }).catch(e => {
      log('curva: erro ' + e.message);
      atualizarBadgeSafeMode(true, 'Erro ao baixar curva do dinamômetro: ' + e.message);
    });

    // loop principal: pede medidores a cada 100ms, decodifica, alimenta painel
    t3.reading = true;
    $('btnConnect').disabled = true;
    runReadLoop();
  } catch (e) {
    setStatus('falha: ' + e.message, 'bad');
    log('erro: ' + e.message);
  }
}

async function runReadLoop() {
  while (t3.reading) {
    try {
      await t3.device.transferOut(t3.epOut, RI_BYTES);
      // a central manda os bytes em vários pacotes de 64 → acumula
      const chunks = [];
      let total = 0;
      const T_TIMEOUT = 200; // ms
      const tStart = performance.now();
      while (performance.now() - tStart < T_TIMEOUT) {
        const r = await t3.device.transferIn(t3.epIn, 256);
        if (r.status === 'stall') { await t3.device.clearHalt('in', t3.epIn); break; }
        if (!r.data || r.data.byteLength === 0) break;
        chunks.push(new Uint8Array(r.data.buffer));
        total += r.data.byteLength;
        if (total >= 460) break;
      }
      if (total < 92) { /* bloco curto — pula */ continue; }
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
      const sample = parseT3000RIBlock(merged, { tMono: performance.now() });
      if (sample) {
        bridge.ingestT4000(sample); // bridge é agnóstico de fonte; aceita t3000
        publishSample(sample);      // espelha pra nuvem (não-bloqueante; throttle interno)
        t3.lastSampleTs = performance.now();
        // atualiza HUD curto
        updateHud(sample);
      }
    } catch (e) {
      log('leitura interrompida: ' + e.message);
      setStatus('leitura interrompida', 'bad');
      t3.reading = false;
      break;
    }
    // throttle pra ~10Hz total (intervalo + tempo de transferência)
    await new Promise(r => setTimeout(r, 50));
  }
}

function updateHud(sample) {
  const hud = $('hud');
  if (!hud) return;
  const fmt = (v, d=1) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(d) : '—';
  const cilOk = sample.fuelInjectionBalanced;
  const alarmes = sample.alarmes || {};
  const alarmesAtivos = Object.entries(alarmes).filter(([,v]) => v).map(([k]) => k);
  hud.innerHTML = `
    <span><b>RPM</b> ${sample.rpm}</span>
    <span><b>Bat</b> ${fmt(sample.batteryV)}V</span>
    <span><b>Água</b> ${sample.waterTempC !== null ? sample.waterTempC + '°C' : '—'}</span>
    <span><b>Ar</b> ${sample.airTempC !== null ? sample.airTempC + '°C' : '—'}</span>
    <span><b>λ</b> ${fmt(sample.lambda, 2)}</span>
    <span><b>MAP</b> ${fmt(sample.mapBar, 2)}b</span>
    <span><b>TPS</b> ${fmt(sample.tpsPct, 0)}%</span>
    <span><b>Acel</b> ${fmt(sample.pedalAceleradorPct, 0)}%</span>
    <span><b>Freio</b> ${fmt(sample.pressaoFreioBar, 1)}b</span>
    <span><b>Vel</b> ${fmt(sample.speedKmh, 0)}km/h</span>
    <span><b>Gx</b> ${fmt(sample.accelXg, 2)}g</span>
    <span><b>Cil</b> ${cilOk ? '✓' : `⚠Δ${sample.fuelInjectionSpread}`}</span>
    ${alarmesAtivos.length ? `<span style="color:#fca5a5"><b>⚠ ${alarmesAtivos.join(', ')}</b></span>` : ''}
  `;
}

// Atualiza o indicador da fonte de RPM ótimo no painel. Estados:
//   'dyno'      — usando curva real (verde, visual padrão)
//   'aprendido' — usando ponto aprendido pra trecho atual (verde+brilho)
//   'semente'   — sem curva no banco ou aprendizado <100% (amarelo)
function atualizarIndicadorFonte(estado) {
  const el = $('fonteShiftStatus');
  if (!el) return;
  const labels = { dyno: 'shift: dyno', aprendido: 'shift: aprendido', semente: 'shift: semente' };
  const cls    = { dyno: 'ok', aprendido: 'ok', semente: 'warn' };
  el.textContent = labels[estado] || ('shift: ' + estado);
  el.className = 'conn-status ' + (cls[estado] || 'warn');
}

// Badge "MODO SEGURO" — acende quando faltar curva do dinamômetro
// ou orquestrador shift light v2 (algum motivo: erro ao carregar, sem
// curva no banco). Indica ao piloto que limites de RPM estão usando os
// defaults estáticos do código, não a curva real do motor.
function atualizarBadgeSafeMode(ativo, motivo) {
  const el = $('badgeSafeMode');
  if (!el) return;
  el.dataset.active = ativo ? '1' : '0';
  if (ativo && motivo) el.title = motivo;
}

// Overlay "SEM SINAL" — acende quando o conversor T3000 perde amostras
// por mais do que a tolerância do watchdog (1,5 s). Recupera sozinho
// quando voltam a chegar amostras.
function atualizarOverlaySemSinal(ativo) {
  const el = $('noSignalOverlay');
  if (!el) return;
  el.dataset.active = ativo ? '1' : '0';
  // Shift light apaga durante a queda — segurança visual.
  const sl = $('shiftLight');
  if (sl) sl.dataset.state = ativo ? 'off' : (sl.dataset.state || 'off');
}

// Botões manuais — mecânico aciona BOX/ÚLTIMA VOLTA pelo painel.
function plugarBotoesManuais() {
  const btnBox = $('btnBox');
  if (btnBox) {
    btnBox.addEventListener('click', () => {
      const ativo = btnBox.dataset.ativo === '1';
      if (ativo) {
        alertasCriticos.clearManual('BOX');
        btnBox.dataset.ativo = '0';
        btnBox.style.background = '#2a3645';
        btnBox.style.color = '#fcd34d';
        btnBox.textContent = 'BOX';
        log('BOX desligado');
      } else {
        alertasCriticos.raiseManual('BOX');
        btnBox.dataset.ativo = '1';
        btnBox.style.background = '#3a2a0f';
        btnBox.style.color = '#fcd34d';
        btnBox.textContent = 'BOX (on)';
        log('BOX ligado');
      }
    });
  }
  const btnUv = $('btnUltimaVolta');
  if (btnUv) {
    btnUv.addEventListener('click', () => {
      const ativo = btnUv.dataset.ativo === '1';
      if (ativo) {
        alertasCriticos.clearManual('ULTIMA_VOLTA');
        btnUv.dataset.ativo = '0';
        btnUv.style.background = '#2a3645';
        btnUv.textContent = 'ÚLTIMA VOLTA';
        log('ÚLTIMA VOLTA desligado');
      } else {
        alertasCriticos.raiseManual('ULTIMA_VOLTA');
        btnUv.dataset.ativo = '1';
        btnUv.style.background = '#1f3a52';
        btnUv.textContent = 'ÚLTIMA VOLTA (on)';
        log('ÚLTIMA VOLTA ligado');
      }
    });
  }
}

// Atualiza indicador da fonte do shift light a cada 1s (barato).
setInterval(() => {
  if (!shiftOrquestrador) return;
  try {
    const fonte = shiftOrquestrador.getFonteRpmOtimo();
    if (fonte === 'aprendido' || fonte === 'semente') atualizarIndicadorFonte(fonte);
    else if (fonte === 'indisponivel') atualizarIndicadorFonte('semente');
    else atualizarIndicadorFonte('dyno');
  } catch {}
}, 1000);

// botão de início
window.addEventListener('DOMContentLoaded', () => {
  const btn = $('btnConnect');
  if (btn) btn.addEventListener('click', connectAndRun);
  setStatus('aguardando você clicar em Autorizar', 'warn');
  log('p1t4000 — cockpit ao vivo. Clica "Autorizar T3000 via WebUSB" pra começar.');
  plugarBotoesManuais();
  atualizarIndicadorFonte('semente'); // estado inicial até a curva carregar

  // Modo silencioso — toque longo (1s) alterna. Estado salvo entre sessões.
  // Alertas críticos (motor, óleo, pneu) NUNCA são silenciados.
  const btnSil = $('btnSilencioso');
  const LS_KEY = 'p1fast-silencioso-v1';
  function aplicar(silencioso) {
    cockpitState.setSilencioso(silencioso);
    if (btnSil) {
      btnSil.textContent = silencioso ? '🔕 mensagens OFF' : '🔔 mensagens ON';
      btnSil.style.background = silencioso ? '#3a2a0f' : '#2a3645';
    }
    try { localStorage.setItem(LS_KEY, silencioso ? '1' : '0'); } catch {}
  }
  // Carrega estado salvo
  try { aplicar(localStorage.getItem(LS_KEY) === '1'); } catch {}
  if (btnSil) {
    let pressT = 0, timer = null;
    const startPress = () => {
      pressT = Date.now();
      timer = setTimeout(() => { aplicar(!cockpitState.isSilencioso()); }, 800);
    };
    const cancelPress = () => { if (timer) clearTimeout(timer); timer = null; };
    btnSil.addEventListener('pointerdown', startPress);
    btnSil.addEventListener('pointerup',   cancelPress);
    btnSil.addEventListener('pointerleave', cancelPress);
  }
});

// Expose pra DevTools
window.__t3 = { t3, cockpitState, bridge };
