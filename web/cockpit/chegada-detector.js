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
import { sideOfLine, caminhoCruzaLinha } from './geo.js';

const SUPABASE_ANON = SUPABASE_ANON_KEY;

const DEBOUNCE_MS = 5000;
// Cruzamento só vale se o CAMINHO entre 2 amostras corta a linha DE VERDADE
// (segmento a–b com folga). Sem isso, o prolongamento infinito da linha corta a
// pista inteira e fecha "volta" em qualquer canto (achado no replay real, 10/06).
// A geometria (sideOfLine / caminhoCruzaLinha) mora na casa única src/domain/geo.js —
// a mesma usada pelo cérebro (chegada-gps.js). Acabou a cópia espelho.

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
