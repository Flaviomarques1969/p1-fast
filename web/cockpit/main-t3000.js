// main-t3000.js — bootstrap do cockpit ao vivo lendo a Injepro T3000
// direto via WebUSB. Roda em p1t4000.vercel.app.
//
// Fluxo:
//   1. Usuário clica "Autorizar T3000".
//   2. Página manda ACK e espera "OK".
//   3. Loop a 10Hz: manda RI → recebe bloco → decodifica → alimenta bridge.
//   4. Renderer atualiza o painel canônico (shift light, alertas, etc).

import { CockpitState } from './cockpit-state.js';
import { attachRendererToDocument } from './cockpit-renderer.js';
import { LiveDataBridge, DEFAULT_LIMITS } from './live-data-bridge.js';
import { parseT3000RIBlock, ACK_BYTES, RI_BYTES, isAckOk } from './t3000-usb-parser.js';
import { startCloudBridge, publishSample, onStatusChange, getStats } from './cloud-bridge.js';
import { loadDynoCurve, BUBI_CARRO_ID } from './dyno-loader.js';

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
const bridge = new LiveDataBridge({ cockpitState, limits: BUBI_LIMITS });

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

    // assina canal ao vivo na nuvem (sem bloquear painel se falhar)
    setCloudStatus('connecting');
    startCloudBridge().then(s => {
      log('canal ao vivo na nuvem: ' + s);
    }).catch(e => log('canal ao vivo falhou: ' + e.message));

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

// botão de início
window.addEventListener('DOMContentLoaded', () => {
  const btn = $('btnConnect');
  if (btn) btn.addEventListener('click', connectAndRun);
  setStatus('aguardando você clicar em Autorizar', 'warn');
  log('p1t4000 — cockpit ao vivo. Clica "Autorizar T3000 via WebUSB" pra começar.');
});

// Expose pra DevTools
window.__t3 = { t3, cockpitState, bridge };
