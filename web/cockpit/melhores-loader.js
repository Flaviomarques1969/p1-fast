// melhores-loader.js — busca + salva "melhor passagem de sempre" por trecho.
// Cada combinação (carro, configuração, segmento, momento) tem 1 registro:
// a melhor velocidade já registrada. Comparação no painel decide se a passagem
// atual pinta verde (nova melhor) ou vermelho (pior que a referência).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

let _client = null;
function client() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

/**
 * Busca todas as melhores passagens de um carro (opcionalmente filtradas por configuração).
 * Retorna mapa { "segmento_id|momento": velocidade_kmh } pra consulta rápida.
 */
export async function loadMelhoresPassagens(carroId, configuracaoId = null) {
  try {
    const sb = client();
    let q = sb.from('melhores_passagens_trecho')
      .select('segmento_id, momento, velocidade_kmh, configuracao_id')
      .eq('carro_id', carroId);
    if (configuracaoId) {
      q = q.eq('configuracao_id', configuracaoId);
    } else {
      q = q.is('configuracao_id', null);
    }
    const { data, error } = await q;
    if (error) { console.warn('[melhores] erro:', error.message); return new Map(); }
    const mapa = new Map();
    for (const r of (data || [])) {
      const k = `${r.segmento_id}|${r.momento}`;
      mapa.set(k, Number(r.velocidade_kmh));
    }
    return mapa;
  } catch (e) {
    console.warn('[melhores] falha:', e.message);
    return new Map();
  }
}

/**
 * Tenta gravar nova passagem. Só substitui a melhor anterior se a nova for >= existente.
 * Retorna { foiMelhor, refAnterior, valorAtual }.
 */
export async function salvarPassagemSeMelhor({ carroId, configuracaoId = null, segmentoId, momento, velocidadeKmh, sessaoId = null }) {
  const sb = client();
  // 1. lê a melhor anterior pra esse trecho/momento
  let q = sb.from('melhores_passagens_trecho')
    .select('id, velocidade_kmh')
    .eq('carro_id', carroId)
    .eq('segmento_id', segmentoId)
    .eq('momento', momento)
    .limit(1);
  if (configuracaoId) q = q.eq('configuracao_id', configuracaoId);
  else q = q.is('configuracao_id', null);

  const { data, error } = await q;
  if (error) {
    console.warn('[melhores] erro leitura:', error.message);
    return { foiMelhor: false, refAnterior: null, valorAtual: velocidadeKmh };
  }
  const existente = (data && data[0]) ? Number(data[0].velocidade_kmh) : null;
  const foiMelhor = existente === null || velocidadeKmh > existente;

  if (foiMelhor) {
    const upsert = {
      carro_id: carroId,
      configuracao_id: configuracaoId,
      segmento_id: segmentoId,
      momento,
      velocidade_kmh: velocidadeKmh,
      sessao_id: sessaoId,
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await sb
      .from('melhores_passagens_trecho')
      .upsert(upsert, { onConflict: 'carro_id,configuracao_id,segmento_id,momento' });
    if (upErr) console.warn('[melhores] erro upsert:', upErr.message);
  }
  return { foiMelhor, refAnterior: existente, valorAtual: velocidadeKmh };
}
