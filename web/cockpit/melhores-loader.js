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
//   2. Retorna Map<segmentId, { segmentId, pontos[], apicePoint, apiceRaioM }>.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { acharApice } from './apice-calculator.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { normalizarTipoPneu } from './tipo-pneu-normalizer.js';

const SUPABASE_ANON = SUPABASE_ANON_KEY;

let _client = null;
function client() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

/**
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
      // Calcula o ápice físico ("ponto mais interno da curva") da melhor passagem.
      // Decisão Flávio 2026-05-27: ápice depende da configuração (carro+pneu),
      // por isso recalcula sempre que a melhor passagem muda. É a "bolinha" do painel.
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
    return new Map();
  }
}

/**
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
}
