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

const DEBOUNCE_MS = 5000;

function sideOfLine(p, a, b) {
  return (b.lng - a.lng) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lng - a.lng);
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
        && t - this._lastCrossT > DEBOUNCE_MS) {
      this._lastCrossT = t;
      this._voltas++;
      try { this._onChegada({ t, voltaN: this._voltas }); }
      catch (e) { console.warn('[chegada-detector] onChegada erro:', e.message); }
    }
    this._lastSide = side;
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
