// segments-loader.js — carrega o layout canônico de uma pista a partir do
// Supabase (tabelas track_layouts + track_segments) e entrega no formato
// que o TrechoDetector consome.
//
// Spec de produto: reference_p1fast_fonte_dados_ao_vivo.
// Decisão Flávio 27/05/2026 passo A: detector ao vivo precisa de coordenadas
// geográficas reais das linhas de entrada/saída e do ponto de ápice de cada
// segmento. Sem isso o detector fica parado.
//
// Formato esperado pelo TrechoDetector:
//   {
//     id, nome,
//     entradaLine: { a: {lat,lng}, b: {lat,lng} },
//     apicePoint:  { lat, lng },
//     saidaLine:   { a: {lat,lng}, b: {lat,lng} },
//   }
//
// Tabela `track_segments` (Supabase) deve ter pelo menos:
//   id, layout_id, ordem (int), nome (text), tipo (curva|reta),
//   entrada_lat_a, entrada_lng_a, entrada_lat_b, entrada_lng_b,
//   apice_lat, apice_lng,
//   saida_lat_a, saida_lng_a, saida_lat_b, saida_lng_b.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

// IDs canônicos registrados na memória (P1 Fast, 26/05/2026).
export const BRASILIA_AUTODROMO_ID = 'e8335412-3312-54fe-b634-db2d02c7fa81';
// Layout principal — UUID5 determinístico (mesmo gerado em 0027_seed).
export const BRASILIA_LAYOUT_PRINCIPAL_ID = '0dc85cfb-6236-567e-814c-eddf610b301f';

let _client = null;
function client() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

/**
 * Carrega os segmentos de um layout específico, ordenados pela sequência
 * da pista. Filtra apenas segmentos do tipo "curva" (retas não geram
 * eventos do detector — só curvas têm entrada/ápice/saída relevantes).
 * Se a tabela ainda não foi populada, retorna [] (chamador trata como
 * "detector inativo até o layout existir").
 */
export async function loadTrackSegments(layoutId = BRASILIA_LAYOUT_PRINCIPAL_ID) {
  try {
    const sb = client();
    // Schema real: track_segments.geometria jsonb (0001_initial). Migration
    // 0027_seed_brasilia_track_segments grava entrada_line_gps / saida_line_gps /
    // apice_gps dentro desse jsonb.
    const { data, error } = await sb
      .from('track_segments')
      .select('id, nome, ordem, eh_trecho, geometria')
      .eq('layout_id', layoutId)
      .eq('eh_trecho', true)
      .order('ordem', { ascending: true });

    if (error) {
      console.warn('[segments-loader] erro:', error.message);
      return [];
    }
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[segments-loader] sem segmentos pro layout', layoutId);
      return [];
    }

    return data
      .filter(row => {
        const g = row.geometria || {};
        return g.entrada_line_gps && g.saida_line_gps && g.apice_gps;
      })
      .map(row => {
        const g = row.geometria;
        return {
          id: row.id,
          nome: row.nome,
          entradaLine: {
            a: { lat: Number(g.entrada_line_gps.a.lat), lng: Number(g.entrada_line_gps.a.lng) },
            b: { lat: Number(g.entrada_line_gps.b.lat), lng: Number(g.entrada_line_gps.b.lng) },
          },
          apicePoint: { lat: Number(g.apice_gps.lat), lng: Number(g.apice_gps.lng) },
          saidaLine: {
            a: { lat: Number(g.saida_line_gps.a.lat), lng: Number(g.saida_line_gps.a.lng) },
            b: { lat: Number(g.saida_line_gps.b.lat), lng: Number(g.saida_line_gps.b.lng) },
          },
        };
      });
  } catch (e) {
    console.warn('[segments-loader] falha geral:', e.message);
    return [];
  }
}

/**
 * Helper de conveniência — carrega o layout principal de Brasília.
 * Pra outros autódromos, basta passar o autodromo_id.
 */
export async function loadBrasiliaPrincipal() {
  return loadTrackSegments(BRASILIA_LAYOUT_PRINCIPAL_ID);
}
