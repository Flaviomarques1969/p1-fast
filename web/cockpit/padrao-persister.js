// padrao-persister.js — leitura e escrita do padrão histórico no Supabase.
//
// Tabela: padroes_telemetria_por_volta (migration 0025).
// Chave única: (carro_id, track_id, tipo_pneu).
//
// Memórias canônicas:
//   - project_p1fast_deteccao_por_padrao_historico
//   - reference_p1fast_fonte_dados_ao_vivo
//
// Estratégia:
//   - loadPadrao: SELECT da combinação. Retorna { padrao, voltas } ou null.
//   - savePadrao: upsert do snapshot do acumulador. Falha → log + segue.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { calcularMediaVoltas } from './padrao-acumulador.js';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

let _client = null;
function client() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

/**
 * Carrega o padrão histórico de uma combinação (carro+autódromo+pneu).
 * Retorna { padrao, voltas } ou null se não existir / falhar.
 */
export async function loadPadrao({ carroId, trackId, tipoPneu }) {
  if (!carroId || !trackId || !tipoPneu) return null;
  try {
    const sb = client();
    const { data, error } = await sb
      .from('padroes_telemetria_por_volta')
      .select('voltas_json, motor_max_media_c, pneu_temp_max_media_c, pneu_press_min_media_bar, cambio_max_media_c, desvio_pct, voltas_acumuladas')
      .eq('carro_id', carroId)
      .eq('track_id', trackId)
      .eq('tipo_pneu', tipoPneu)
      .maybeSingle();
    if (error) {
      console.warn('[padrao-persister] load erro:', error.message);
      return null;
    }
    if (!data) return null;
    return {
      voltas: Array.isArray(data.voltas_json) ? data.voltas_json : [],
      padrao: {
        motor:  { media: data.motor_max_media_c, n: data.voltas_acumuladas ?? 0 },
        pneu:   { tempMedia: data.pneu_temp_max_media_c, pressMedia: data.pneu_press_min_media_bar, n: data.voltas_acumuladas ?? 0 },
        cambio: { media: data.cambio_max_media_c, n: data.voltas_acumuladas ?? 0 },
      },
      desvioPct: Number(data.desvio_pct ?? 0.20),
    };
  } catch (e) {
    console.warn('[padrao-persister] load falha geral:', e.message);
    return null;
  }
}

/**
 * Grava (upsert) o snapshot do acumulador. Snapshot vem de
 * PadraoAcumulador.snapshot().
 */
export async function savePadrao(snapshot) {
  if (!snapshot || !snapshot.carroId || !snapshot.trackId || !snapshot.tipoPneu) return false;
  try {
    const sb = client();
    const row = {
      carro_id:                snapshot.carroId,
      track_id:                snapshot.trackId,
      tipo_pneu:               snapshot.tipoPneu,
      voltas_acumuladas:       snapshot.voltasAcumuladas ?? 0,
      voltas_json:             snapshot.voltas ?? [],
      desvio_pct:              snapshot.desvioPct ?? 0.20,
      motor_max_media_c:        snapshot.padrao?.motor?.media ?? null,
      pneu_temp_max_media_c:    snapshot.padrao?.pneu?.tempMedia ?? null,
      pneu_press_min_media_bar: snapshot.padrao?.pneu?.pressMedia ?? null,
      cambio_max_media_c:       snapshot.padrao?.cambio?.media ?? null,
      atualizado_em:           new Date().toISOString(),
    };
    const { error } = await sb
      .from('padroes_telemetria_por_volta')
      .upsert(row, { onConflict: 'carro_id,track_id,tipo_pneu' });
    if (error) {
      console.warn('[padrao-persister] save erro:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[padrao-persister] save falha geral:', e.message);
    return false;
  }
}
