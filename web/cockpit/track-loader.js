// track-loader.js — carrega os segmentos (curvas + retas) de uma pista da nuvem.
// Usado pelo painel pra exibir o nome da curva atual e (futuramente) cruzar GPS
// com o mapa pra detectar quando o piloto passou por cada apex.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const SUPABASE_ANON = SUPABASE_ANON_KEY;

export const BRASILIA_TRACK_ID = 'e8335412-3312-54fe-b634-db2d02c7fa81';

let _client = null;
function client() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

/**
 * Carrega os segmentos da pista (curvas + retas) da nuvem.
 * Retorna lista ordenada com nome, tipo, parcial, geometria, ou null se erro.
 */
export async function loadTrackSegments(trackId) {
  try {
    const sb = client();
    const { data: layouts, error: e1 } = await sb
      .from('track_layouts')
      .select('id, nome')
      .eq('track_id', trackId);
    if (e1 || !layouts || layouts.length === 0) {
      console.warn('[track] sem layouts pra track', trackId);
      return null;
    }
    const layoutId = layouts[0].id;
    const { data: segments, error: e2 } = await sb
      .from('track_segments')
      .select('id, ordem, nome, eh_trecho, parcial_id, geometria')
      .eq('layout_id', layoutId)
      .order('ordem', { ascending: true });
    if (e2 || !segments) {
      console.warn('[track] erro segments:', e2?.message);
      return null;
    }
    return segments.map(s => ({
      id: s.id,
      ordem: s.ordem,
      nome: s.nome,
      ehTrecho: s.eh_trecho,
      parcial: s.parcial_id,
      ...s.geometria,
    }));
  } catch (e) {
    console.warn('[track] falha geral:', e.message);
    return null;
  }
}

/** Lista só curvas (eh_trecho=true), na ordem do circuito. */
export function onlyCurves(segments) {
  return (segments || []).filter(s => s.ehTrecho);
}

/** Apelido curto pra mostrar no painel (cabe em 1 linha pequena). */
export function shortLabel(nome) {
  return (nome || '')
    .replace(/^CURVA /i, '')
    .replace(/^MERGULHO DA /i, '')
    .replace(/^RETA /i, '')
    .trim();
}
