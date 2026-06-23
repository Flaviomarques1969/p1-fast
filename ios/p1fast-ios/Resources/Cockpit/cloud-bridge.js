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
import { leituraPlausivel } from './t3000-usb-parser.js';

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
// Vários consumidores podem ouvir a MESMA conexão (uma fonte só, todos consomem).
// Ex.: na Vista Piloto, o HUD e o "cérebro" ouvem juntos sem abrir 2 conexões.
let _onGpsPoint = [];
let _onSample = [];
let _onEvento = [];   // aviso de volta/trecho (consumido pelo cérebro)
let _onPosicao = [];  // posição já calculada pela NUVEM — a tela só exibe
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

// Entrega um payload a todos os ouvintes registrados, sem deixar um erro de um
// derrubar os outros nem a conexão.
function _fan(lista, payload) {
  for (const fn of lista) { try { fn(payload); } catch (e) { /* não derruba o canal */ } }
}

/** Registrar callback pra eventos GPS recebidos do canal (lat, lng, kmh, tWall). */
export function onGpsPoint(fn) {
  if (typeof fn === 'function') _onGpsPoint.push(fn);
}

/** Registrar callback pra AMOSTRAS recebidas do canal (modo sem fio: outro
 *  transmissor — ou o simulador — manda; este painel consome). */
export function onSample(fn) {
  if (typeof fn === 'function') _onSample.push(fn);
}

/** Registrar callback pra EVENTOS (ex.: volta/trecho) recebidos do canal. */
export function onEvento(fn) {
  if (typeof fn === 'function') _onEvento.push(fn);
}

/** Registrar callback pra POSIÇÃO já calculada na nuvem (a tela só exibe). */
export function onPosicao(fn) {
  if (typeof fn === 'function') _onPosicao.push(fn);
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
    // Listeners do canal — UMA fonte só, distribuída a TODOS os ouvintes registrados.
    // RaceBox via Central / iPhone (gps), transmissor/simulador (sample), aviso de
    // volta (evento) e posição já calculada na nuvem (posicao).
    _channel.on('broadcast', { event: 'gps' },     (msg) => { if (msg && msg.payload) _fan(_onGpsPoint, msg.payload); });
    _channel.on('broadcast', { event: 'sample' },  (msg) => { if (msg && msg.payload) _fan(_onSample,   msg.payload); });
    _channel.on('broadcast', { event: 'evento' },  (msg) => { if (msg && msg.payload) _fan(_onEvento,   msg.payload); });
    _channel.on('broadcast', { event: 'posicao' }, (msg) => { if (msg && msg.payload) _fan(_onPosicao,  msg.payload); });
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
  // Defesa em profundidade: qualquer produtor (cabo, modo sem fio, simulador)
  // que tente publicar amostra fora das faixas físicas é barrado aqui também.
  // O main já filtra o caminho do cabo; esta guarda cobre os demais produtores.
  if (!leituraPlausivel(sample).ok) {
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
