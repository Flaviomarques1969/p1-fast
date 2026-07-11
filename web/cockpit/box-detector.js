// box-detector.js — detecta entrada e saída do box monitorando duas linhas
// no banco: pit-in (entra no box) e pit-out (sai do box).
//
// Decisão Flávio 2026-05-28: marcos box/pit-in/pit-out cadastrados após
// editor visual, layout principal de Brasília.
//
// Uso:
//   import { BoxDetector, loadMarcosBox } from './box-detector.js';
//   const marcos = await loadMarcosBox(layoutId);
//   const det = new BoxDetector({
//     pitIn:  marcos.pitIn,   // { a_gps, b_gps }
//     pitOut: marcos.pitOut,  // { a_gps, b_gps }
//     onEntradaBox: () => {...},
//     onSaidaBox:   () => {...},
//   });
//   det.ingestGps({ lat, lng, t });
//
// Algoritmo: mesma técnica do detector de chegada — sinal do produto vetorial
// muda entre amostras consecutivas em relação a cada linha. Estado interno
// rastreia se o carro está NO BOX ou NA PISTA, sem reagir a falsos cruzamentos.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { M_POR_GRAU_LAT, mPorGrauLng } from './geo.js';

const DEBOUNCE_MS = 5000;
// Cruzamento só vale se o CAMINHO entre 2 amostras corta a linha DE VERDADE
// (segmento a–b). Sem isso, o prolongamento infinito da pit-in corta a
// pista inteira e o carro fica PRESO "no box" rodando na pista (achado no replay, 10/06).
//
// FOLGA: aqui é ABSOLUTA (5 m por ponta), NÃO os 50% proporcionais dos detectores de
// chegada/trecho. Aquelas linhas atravessam a pista inteira; as linhas de pit terminam
// a ~12 m do traçado de corrida em Brasília (pit-in 25,9 m → 50% = 13 m de folga ENGOLIA
// o traçado: voltas lançadas reais cruzavam em u=1,45-1,55 a 108-152 km/h e o cockpit
// silenciava em plena reta). Entradas reais no box medem u=0,53-0,57 (provado com as
// voltas reais de 23-24/05 + marcos aprovados de 27/05).
const FOLGA_PONTA_M = 5;

function sideOfLine(p, a, b) {
  return (b.lng - a.lng) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lng - a.lng);
}

/** O caminho p0→p1 cruza a LINHA DE VERDADE a–b? (interseção de segmentos
 *  em projeção local; folga absoluta FOLGA_PONTA_M em cada ponta da linha). */
function caminhoCruzaLinha(p0, p1, a, b) {
  const kLat = M_POR_GRAU_LAT;
  const kLng = mPorGrauLng(a.lat);
  const X = q => (q.lng - a.lng) * kLng;
  const Y = q => (q.lat - a.lat) * kLat;
  const r = { x: X(p1) - X(p0), y: Y(p1) - Y(p0) };
  const d = { x: X(b), y: Y(b) };
  const den = r.x * d.y - r.y * d.x;
  if (Math.abs(den) < 1e-9) return false; // paralelos
  const qp = { x: -X(p0), y: -Y(p0) };
  const v = (qp.x * d.y - qp.y * d.x) / den;  // posição ao longo do caminho
  const u = (qp.x * r.y - qp.y * r.x) / den; // posição ao longo da linha
  const lenM = Math.hypot(d.x, d.y);
  if (lenM < 1e-9) return false; // linha degenerada
  const folgaU = FOLGA_PONTA_M / lenM;
  return v >= 0 && v <= 1 && u >= -folgaU && u <= 1 + folgaU;
}

export class BoxDetector {
  constructor({ pitIn, pitOut, onEntradaBox = () => {}, onSaidaBox = () => {} } = {}) {
    if (!pitIn || !pitIn.a_gps || !pitIn.b_gps) {
      throw new Error('BoxDetector: pitIn { a_gps, b_gps } obrigatório');
    }
    if (!pitOut || !pitOut.a_gps || !pitOut.b_gps) {
      throw new Error('BoxDetector: pitOut { a_gps, b_gps } obrigatório');
    }
    this._pitIn = pitIn;
    this._pitOut = pitOut;
    this._onEntradaBox = onEntradaBox;
    this._onSaidaBox = onSaidaBox;
    this._lastSideIn = null;
    this._lastSideOut = null;
    this._lastCrossT = -Infinity;
    this._noBox = false; // assumimos início NA PISTA
  }

  ingestGps(sample) {
    if (!sample || typeof sample.lat !== 'number' || typeof sample.lng !== 'number') return;
    const t = typeof sample.t === 'number' ? sample.t : Date.now();
    const sideIn  = sideOfLine(sample, this._pitIn.a_gps,  this._pitIn.b_gps);
    const sideOut = sideOfLine(sample, this._pitOut.a_gps, this._pitOut.b_gps);

    const debounceOk = t - this._lastCrossT > DEBOUNCE_MS;

    // Cruzamento da pit-in: só conta se estamos NA PISTA
    if (!this._noBox && this._lastSideIn != null
        && Math.sign(sideIn) !== Math.sign(this._lastSideIn)
        && this._lastPos
        && caminhoCruzaLinha(this._lastPos, sample, this._pitIn.a_gps, this._pitIn.b_gps)
        && debounceOk) {
      this._noBox = true;
      this._lastCrossT = t;
      try { this._onEntradaBox({ t }); } catch (e) {}
    }
    // Cruzamento da pit-out: só conta se estamos NO BOX
    else if (this._noBox && this._lastSideOut != null
        && Math.sign(sideOut) !== Math.sign(this._lastSideOut)
        && this._lastPos
        && caminhoCruzaLinha(this._lastPos, sample, this._pitOut.a_gps, this._pitOut.b_gps)
        && debounceOk) {
      this._noBox = false;
      this._lastCrossT = t;
      try { this._onSaidaBox({ t }); } catch (e) {}
    }

    this._lastSideIn  = sideIn;
    this._lastSideOut = sideOut;
    this._lastPos = { lat: sample.lat, lng: sample.lng };
  }

  isNoBox() { return this._noBox; }
  setNoBox(v) { this._noBox = !!v; }
}

/**
 * Carrega os marcos pit-in e pit-out de um layout.
 */
export async function loadMarcosBox(layoutId) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
  const URL  = SUPABASE_URL;
  const ANON = SUPABASE_ANON_KEY;
  const sb = createClient(URL, ANON);
  const { data, error } = await sb
    .from('marcos')
    .select('tipo, posicao')
    .eq('layout_id', layoutId)
    .in('tipo', ['pit-in', 'pit-out']);
  if (error || !data) {
    console.warn('[box-detector] marcos não encontrados:', error?.message);
    return null;
  }
  const pitIn  = data.find(r => r.tipo === 'pit-in')?.posicao;
  const pitOut = data.find(r => r.tipo === 'pit-out')?.posicao;
  if (!pitIn || !pitOut) return null;
  return { pitIn, pitOut };
}
