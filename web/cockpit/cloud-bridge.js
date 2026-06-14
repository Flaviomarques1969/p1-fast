// cloud-bridge.js — ponte do painel T3000 → canal ao vivo da nuvem (Supabase Realtime broadcast).
//
// O painel chama publishSample(sample) a cada amostra decodificada.
// Ela é enviada, sem persistência, num canal nomeado. Quem se conecta ao mesmo
// canal (eu, no Mac) vê em tempo real.
//
// Princípios:
//   - Nunca quebra o painel: se a nuvem cair, painel continua local.
//   - Throttle: T3000 manda 10 Hz; nuvem fica em 5 Hz pra não inundar.
//   - Estado visível: getStatus() retorna 'off' | 'connecting' | 'online' | 'error'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const SUPABASE_ANON = SUPABASE_ANON_KEY;

const CHANNEL_NAME    = 'cockpit-bubi-live';
const PUBLISH_HZ      = 5;
const PUBLISH_PERIOD  = 1000 / PUBLISH_HZ;

let _client = null;
let _channel = null;
let _status = 'off';
let _lastPublishTs = 0;
let _stats = { sent: 0, dropped: 0, errors: 0, lastError: null };
let _onStatusChange = () => {};
let _onGpsPoint = null;
let _onSample = null;
let _retryMs = 2000;
let _retryTimer = null;
let _quero = false; // intenção: a ponte deve ficar no ar (religa sozinha se cair)

function _scheduleRetry() {
  if (!_quero || _retryTimer) return;
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    _channel = null;
    startCloudBridge().catch(() => {});
  }, _retryMs);
  _retryMs = Math.min(_retryMs * 2, 15000);
}

export function getStatus() { return _status; }
export function getStats()  { return { ..._stats }; }

function setStatus(s) {
  if (s === _status) return;
  _status = s;
  try { _onStatusChange(s); } catch {}
}

export function onStatusChange(fn) {
  _onStatusChange = typeof fn === 'function' ? fn : (() => {});
}

/** Registrar callback pra eventos GPS recebidos do canal (lat, lng, kmh, tWall). */
export function onGpsPoint(fn) {
  _onGpsPoint = typeof fn === 'function' ? fn : null;
}

/** Registrar callback pra AMOSTRAS recebidas do canal (modo sem fio: outro
 *  transmissor — ou o simulador — manda; este painel consome). */
export function onSample(fn) {
  _onSample = typeof fn === 'function' ? fn : null;
}

export async function startCloudBridge() {
  if (_channel) return _status;
  _quero = true;
  setStatus('connecting');
  try {
    if (!_client) {
      _client = createClient(SUPABASE_URL, SUPABASE_ANON, {
        realtime: { params: { eventsPerSecond: 10 } },
      });
    }
    _channel = _client.channel(CHANNEL_NAME, {
      config: { broadcast: { ack: false, self: false } },
    });
    // Listener pra pontos GPS publicados no canal (RaceBox via Central / iPhone)
    _channel.on('broadcast', { event: 'gps' }, (msg) => {
      if (_onGpsPoint && msg && msg.payload) {
        try { _onGpsPoint(msg.payload); } catch (e) { /* não derruba canal */ }
      }
    });
    // Listener pra amostras (modo sem fio — consumir o que outro transmissor publica)
    _channel.on('broadcast', { event: 'sample' }, (msg) => {
      if (_onSample && msg && msg.payload) {
        try { _onSample(msg.payload); } catch (e) { /* não derruba canal */ }
      }
    });
    await new Promise((resolve, reject) => {
      _channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') { _retryMs = 2000; setStatus('online'); resolve(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setStatus('error');
          _stats.lastError = err ? String(err) : status;
          // Religa sozinha: vale tanto pra falha na 1ª assinatura quanto pra
          // queda depois de horas no ar (Starlink oscilando na pista).
          try { _channel && _channel.unsubscribe(); } catch {}
          _channel = null;
          _scheduleRetry();
          reject(new Error(_stats.lastError));
        }
      });
      setTimeout(() => reject(new Error('timeout assinando canal')), 8000);
    });
    return _status;
  } catch (e) {
    setStatus('error');
    _stats.lastError = String(e && e.message || e);
    _stats.errors += 1;
    _channel = null;
    _scheduleRetry();
    return _status;
  }
}

export function publishSample(sample) {
  if (!_channel || _status !== 'online') {
    _stats.dropped += 1;
    return false;
  }
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - _lastPublishTs < PUBLISH_PERIOD) {
    _stats.dropped += 1;
    return false;
  }
  _lastPublishTs = now;
  try {
    _channel.send({ type: 'broadcast', event: 'sample', payload: stripSample(sample) });
    _stats.sent += 1;
    return true;
  } catch (e) {
    _stats.errors += 1;
    _stats.lastError = String(e && e.message || e);
    return false;
  }
}

/** Publica evento de volta/trecho/delta no canal (baixa frequência, sem throttle).
 *  Consumido pela Central de Pista, que repassa pra tela ASSISTIR do app. */
export function publishEvento(payload) {
  if (!_channel || _status !== 'online') return false;
  try {
    _channel.send({ type: 'broadcast', event: 'evento', payload: { ...payload, tWall: Date.now() } });
    return true;
  } catch (e) {
    _stats.errors += 1;
    _stats.lastError = String(e && e.message || e);
    return false;
  }
}

export async function stopCloudBridge() {
  _quero = false;
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
  try { if (_channel) await _channel.unsubscribe(); } catch {}
  _channel = null; _client = null;
  setStatus('off');
}

// Reduz a amostra ao essencial pra trafegar leve (sem arrays de sensores externos
// que ninguém consome no monitor).
function stripSample(s) {
  if (!s || typeof s !== 'object') return s;
  return {
    source: s.source,
    parserVersion: s.parserVersion,
    tMono: s.tMono,
    tWall: Date.now(),
    bytesLen: s.bytesLen,
    // motor
    rpm: s.rpm,
    batteryV: s.batteryV,
    mapBar: s.mapBar,
    tpsPct: s.tpsPct,
    tpsTargetPct: s.tpsTargetPct,
    airTempC: s.airTempC,
    waterTempC: s.waterTempC,
    lambda: s.lambda,
    mapaAtual: s.mapaAtual,
    consumoBorboleta: s.consumoBorboleta,
    // pilotagem
    pedalAceleradorPct: s.pedalAceleradorPct,
    pedalFreioPct: s.pedalFreioPct,
    pressaoFreioBar: s.pressaoFreioBar,
    speedKmh: s.speedKmh,
    accelXg: s.accelXg,
    accelYg: s.accelYg,
    accelZg: s.accelZg,
    // cilindros
    fuelInjectionBalanced: s.fuelInjectionBalanced,
    fuelInjectionSpread: s.fuelInjectionSpread,
    fuelTimeA: s.fuelTimeA,
    // alarmes + status
    alarmes: s.alarmes,
    statusSinais: s.statusSinais,
    cronometroParcialS: s.cronometroParcialS,
    cronometroTotalS:   s.cronometroTotalS,
  };
}
