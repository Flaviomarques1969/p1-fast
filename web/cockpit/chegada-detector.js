// chegada-detector.js — detecta cruzamento da linha de chegada (volta fechada).
//
// Substitui a heurística antiga "saída do último trecho = volta fechada"
// pelo sinal real: o marco de chegada cadastrado na tabela `marcos` do banco.
//
// Decisão Flávio 2026-05-28.
//
// Uso:
//   import { ChegadaDetector } from './chegada-detector.js';
//   const det = new ChegadaDetector({ marco, onChegada: () => {...} });
//   det.ingestGps({ lat, lng, t });
//
// Marco esperado:
//   { a_gps: { lat, lng }, b_gps: { lat, lng } }
//
// Algoritmo:
//   - Mesma técnica do TrechoDetector: sinal do produto vetorial muda
//     entre 2 amostras consecutivas em relação à linha → cruzou.
//   - Debounce: ignora cruzamentos consecutivos a menos de 5 segundos
//     (evita falso disparo se carro fica em pé sobre a linha).

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const SUPABASE_ANON = SUPABASE_ANON_KEY;

const DEBOUNCE_MS = 5000;
// Cruzamento só vale se o CAMINHO entre 2 amostras corta a linha DE VERDADE
// (segmento a–b com folga). Sem isso, o prolongamento infinito da linha corta a
// pista inteira e fecha "volta" em qualquer canto (achado no replay real, 10/06).

function sideOfLine(p, a, b) {
  return (b.lng - a.lng) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lng - a.lng);
}

/** O caminho p0→p1 cruza a LINHA DE VERDADE a–b? (interseção de segmentos
 *  em projeção local; folga de 50% em cada ponta da linha pela largura real). */
function caminhoCruzaLinha(p0, p1, a, b) {
  const kLat = 110540;
  const kLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
  const X = q => (q.lng - a.lng) * kLng;
  const Y = q => (q.lat - a.lat) * kLat;
  const r = { x: X(p1) - X(p0), y: Y(p1) - Y(p0) };
  const d = { x: X(b), y: Y(b) };
  const den = r.x * d.y - r.y * d.x;
  if (Math.abs(den) < 1e-9) return false; // paralelos
  const qp = { x: -X(p0), y: -Y(p0) };
  const v = (qp.x * d.y - qp.y * d.x) / den;  // posição ao longo do caminho
  const u = (qp.x * r.y - qp.y * r.x) / den; // posição ao longo da linha
  return v >= 0 && v <= 1 && u >= -0.5 && u <= 1.5;
}

export class ChegadaDetector {
  /**
   * @param {Object} opts
   * @param {{a_gps:{lat,lng}, b_gps:{lat,lng}}} opts.marco
   * @param {() => void} opts.onChegada  Chamado ao detectar cruzamento.
   */
  constructor({ marco, onChegada = () => {} } = {}) {
    if (!marco || !marco.a_gps || !marco.b_gps) {
      throw new Error('ChegadaDetector: marco { a_gps, b_gps } obrigatório');
    }
    this._a = marco.a_gps;
    this._b = marco.b_gps;
    this._onChegada = onChegada;
    this._lastSide = null;
    this._lastCrossT = -Infinity;
    this._voltas = 0;
  }

  ingestGps(sample) {
    if (!sample || typeof sample.lat !== 'number' || typeof sample.lng !== 'number') return;
    const t = typeof sample.t === 'number' ? sample.t : Date.now();
    const side = sideOfLine(sample, this._a, this._b);
    if (this._lastSide != null
        && Math.sign(side) !== Math.sign(this._lastSide)
        && this._lastPos
        && caminhoCruzaLinha(this._lastPos, sample, this._a, this._b)
        && t - this._lastCrossT > DEBOUNCE_MS) {
      this._lastCrossT = t;
      this._voltas++;
      try { this._onChegada({ t, voltaN: this._voltas }); }
      catch (e) { console.warn('[chegada-detector] onChegada erro:', e.message); }
    }
    this._lastSide = side;
    this._lastPos = { lat: sample.lat, lng: sample.lng };
  }

  getVoltas() { return this._voltas; }
}

/**
 * Carrega o marco de chegada de um layout no Supabase.
 */
export async function loadMarcoChegada(layoutId) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
  const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await sb
    .from('marcos')
    .select('id, posicao, label')
    .eq('layout_id', layoutId)
    .eq('tipo', 'chegada')
    .maybeSingle();
  if (error || !data || !data.posicao) {
    console.warn('[chegada-detector] marco não encontrado:', error?.message);
    return null;
  }
  return data.posicao;
}
