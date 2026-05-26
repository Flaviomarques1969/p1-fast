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

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

const CHANNEL_NAME    = 'cockpit-bubi-live';
const PUBLISH_HZ      = 5;
const PUBLISH_PERIOD  = 1000 / PUBLISH_HZ;

let _client = null;
let _channel = null;
let _status = 'off';
let _lastPublishTs = 0;
let _stats = { sent: 0, dropped: 0, errors: 0, lastError: null };
let _onStatusChange = () => {};

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

export async function startCloudBridge() {
  if (_channel) return _status;
  setStatus('connecting');
  try {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    _channel = _client.channel(CHANNEL_NAME, {
      config: { broadcast: { ack: false, self: false } },
    });
    await new Promise((resolve, reject) => {
      _channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') { setStatus('online'); resolve(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setStatus('error');
          _stats.lastError = err ? String(err) : status;
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
    _channel = null; _client = null;
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

export async function stopCloudBridge() {
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
