<<<<<<< HEAD
// melhores-loader.js — busca + salva "melhor passagem de sempre" por trecho.
// Cada combinação (carro, configuração, segmento, momento) tem 1 registro:
// a melhor velocidade já registrada. Comparação no painel decide se a passagem
// atual pinta verde (nova melhor) ou vermelho (pior que a referência).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
=======
// melhores-loader.js — carrega do Supabase a melhor passagem histórica de
// cada trecho (segmento) por combinação (carro + autódromo + configuração
// de pneu) e entrega ao DeltaCalculator como referência.
//
// Decisão Flávio 27/05/2026: referência persiste entre sessões. Próxima
// vez que rodar Brasília com semi-slick, o padrão já vem pronto.
// Doc canônico: project_p1fast_logica_central_comparacao_por_trecho.
//
// Tabela esperada `melhores_passagens_trecho`:
//   id (uuid),
//   carro_id (uuid),
//   track_id (uuid)          — nome real no banco; o parâmetro JS continua `autodromoId`,
//                              só a coluna SQL é `track_id`.
//   layout_id (uuid),
//   segment_id (uuid),
//   tipo_pneu (text — 'semi-slick'|'radial'|...),
//   tempo_trecho_s (numeric — tempo total do trecho, p/ ranking),
//   pontos_json (jsonb — array { lat, lng, kmh, t, fracao, sub }),
//   gravado_em (timestamptz).
//
// Estratégia de seleção:
//   1. Pra cada segment_id, busca a passagem com menor tempo_trecho_s na
//      combinação (carro_id, autodromo_id, tipo_pneu).
//   2. Retorna Map<segmentId, { segmentId, pontos[] }>.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { acharApice } from './apice-calculator.js';
>>>>>>> wip/20260526-132312

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

let _client = null;
function client() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

/**
<<<<<<< HEAD
 * Busca todas as melhores passagens de um carro filtradas por tipo de pneu.
 * Tipos válidos: 'semi-slick' ou 'radial'. NULL = sem filtro (debug).
 * Retorna mapa { "segmento_id|momento": velocidade_kmh } pra consulta rápida.
 */
export async function loadMelhoresPassagens(carroId, tipoPneu = null) {
  try {
    const sb = client();
    let q = sb.from('melhores_passagens_trecho')
      .select('segmento_id, momento, velocidade_kmh, lat, lng, tipo_pneu')
      .eq('carro_id', carroId);
    if (tipoPneu) {
      q = q.eq('tipo_pneu', tipoPneu);
    } else {
      q = q.is('tipo_pneu', null);
    }
    const { data, error } = await q;
    if (error) { console.warn('[melhores] erro:', error.message); return new Map(); }
    const mapa = new Map();
    for (const r of (data || [])) {
      const k = `${r.segmento_id}|${r.momento}`;
      mapa.set(k, {
        velocidadeKmh: Number(r.velocidade_kmh),
        lat: r.lat !== undefined ? r.lat : null,
        lng: r.lng !== undefined ? r.lng : null,
      });
    }
    return mapa;
  } catch (e) {
    console.warn('[melhores] falha:', e.message);
=======
 * Carrega a melhor passagem histórica de cada segmento pra a combinação
 * (carro_id + autodromo_id + tipo_pneu). Retorna Map<segmentId, passagemRef>.
 *
 * Se ainda não há nenhum histórico, retorna Map vazio — o painel mostra
 * "—" nos widgets de Entrada/Freio/Saída até a primeira passagem ser
 * gravada nessa combinação (regra: referência persistente).
 */
export async function loadMelhoresPassagens({ carroId, autodromoId, tipoPneu }) {
  if (!carroId || !autodromoId || !tipoPneu) {
    console.warn('[melhores-loader] params obrigatórios: carroId, autodromoId, tipoPneu');
    return new Map();
  }
  try {
    const sb = client();
    // Busca todas as passagens dessa combinação ordenadas pelo tempo (menor
    // = melhor). Depois agrupa por segment_id e pega a primeira (a melhor).
    const { data, error } = await sb
      .from('melhores_passagens_trecho')
      .select('segment_id, tempo_trecho_s, pontos_json, gravado_em')
      .eq('carro_id', carroId)
      .eq('track_id', autodromoId)
      .eq('tipo_pneu', tipoPneu)
      .order('tempo_trecho_s', { ascending: true });

    if (error) {
      console.warn('[melhores-loader] erro:', error.message);
      return new Map();
    }
    const melhoresPorSegmento = new Map();
    for (const row of (data || [])) {
      if (melhoresPorSegmento.has(row.segment_id)) continue; // já temos a melhor desse segmento
      if (!Array.isArray(row.pontos_json) || row.pontos_json.length < 2) continue;
      // Calcula o ápice físico ("lugar mais dentro da curva") da melhor passagem.
      // Decisão Flávio 2026-05-27: ápice depende da configuração (carro+pneu),
      // por isso recalcula sempre que a melhor passagem muda.
      const apiceCalc = acharApice(row.pontos_json) || null;
      melhoresPorSegmento.set(row.segment_id, {
        segmentId: row.segment_id,
        tempoS: Number(row.tempo_trecho_s),
        gravadoEm: row.gravado_em,
        pontos: row.pontos_json,
        apicePoint: apiceCalc?.ponto ?? null,
        apiceRaioM: apiceCalc?.raioM ?? null,
      });
    }
    return melhoresPorSegmento;
  } catch (e) {
    console.warn('[melhores-loader] falha geral:', e.message);
>>>>>>> wip/20260526-132312
    return new Map();
  }
}

/**
<<<<<<< HEAD
 * Tenta gravar nova passagem. Só substitui a melhor anterior se a nova for >= existente.
 * Retorna { foiMelhor, refAnterior, valorAtual }.
 */
/**
 * Define se a passagem nova é melhor por momento:
 *   entrada/saida: velocidade MAIOR é melhor.
 *   freio: comparação por distância ao apex (mais perto = mais tarde = melhor) — feita no cliente.
 *   apice: comparação por distância em valor absoluto (mais perto de zero = melhor traçado) — feita no cliente.
 *
 * Esta função só compara velocidade (compat com entrada/saida). Pra freio/apice
 * a função chamadora passa o critério já pré-avaliado via callback custom abaixo.
 */
function nv(prev, novo, momento) {
  if (prev === null || prev === undefined) return true;
  return novo > prev; // entrada/saida: maior é melhor
}

export async function salvarPassagemSeMelhor({ carroId, tipoPneu = null, segmentoId, momento, velocidadeKmh, lat = null, lng = null, sessaoId = null }) {
  const sb = client();
  let q = sb.from('melhores_passagens_trecho')
    .select('id, velocidade_kmh, lat, lng')
    .eq('carro_id', carroId)
    .eq('segmento_id', segmentoId)
    .eq('momento', momento)
    .limit(1);
  if (tipoPneu) q = q.eq('tipo_pneu', tipoPneu);
  else q = q.is('tipo_pneu', null);

  const { data, error } = await q;
  if (error) {
    console.warn('[melhores] erro leitura:', error.message);
    return { foiMelhor: false, refAnterior: null, valorAtual: velocidadeKmh };
  }
  const existente = (data && data[0]) ? Number(data[0].velocidade_kmh) : null;
  const refLat = data && data[0] ? data[0].lat : null;
  const refLng = data && data[0] ? data[0].lng : null;
  const foiMelhor = nv(existente, velocidadeKmh, momento);

  if (foiMelhor) {
    if (data && data[0]) {
      const { error: upErr } = await sb
        .from('melhores_passagens_trecho')
        .update({
          velocidade_kmh: velocidadeKmh,
          lat, lng,
          sessao_id: sessaoId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data[0].id);
      if (upErr) console.warn('[melhores] erro update:', upErr.message);
    } else {
      const { error: insErr } = await sb
        .from('melhores_passagens_trecho')
        .insert({
          carro_id: carroId,
          tipo_pneu: tipoPneu,
          segmento_id: segmentoId,
          momento,
          velocidade_kmh: velocidadeKmh,
          lat, lng,
          sessao_id: sessaoId,
        });
      if (insErr) console.warn('[melhores] erro insert:', insErr.message);
    }
  }
  return { foiMelhor, refAnterior: existente, refLat, refLng, valorAtual: velocidadeKmh };
}

/**
 * Distância em metros entre 2 pontos GPS (fórmula de Haversine).
 */
export function distanciaMetros(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v === null || v === undefined || !Number.isFinite(v))) return null;
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
=======
 * Grava uma nova passagem histórica (chamado pelo painel ao final de cada
 * trecho). Só vira referência se for melhor que a atual.
 */
export async function gravarPassagem({ carroId, autodromoId, layoutId, segmentId, tipoPneu, tempoS, pontos }) {
  try {
    const sb = client();
    const { error } = await sb
      .from('melhores_passagens_trecho')
      .insert({
        carro_id: carroId,
        track_id: autodromoId,
        layout_id: layoutId,
        segment_id: segmentId,
        tipo_pneu: tipoPneu,
        tempo_trecho_s: tempoS,
        pontos_json: pontos,
        gravado_em: new Date().toISOString(),
      });
    if (error) {
      console.warn('[melhores-loader] erro ao gravar:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[melhores-loader] falha geral:', e.message);
    return false;
  }
>>>>>>> wip/20260526-132312
}
