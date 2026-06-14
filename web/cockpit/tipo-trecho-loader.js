// tipo-trecho-loader.js — carrega a classificação dos trechos da pista.
//
// Onda 8 (Flávio 2026-05-29): "classificar os 8 trechos de Brasília como
// reta longa / reta curta / curva". Tabela `track_segments` ganhou coluna
// `tipo` na migration 0036.
//
// Decisão de produto: as 8 entradas hoje cadastradas SÃO as 8 curvas.
// As retas entre elas serão inferidas pelo orquestrador (transição entre
// uma curva e outra = está em reta).

const SUPABASE_URL = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

const HEADERS = {
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

/**
 * Carrega { trechoId → tipo } pra um layout.
 * @param {string} layoutId
 * @returns {Promise<Object>} dict
 */
export async function carregarTiposPorTrecho(layoutId) {
  if (!layoutId) return {};
  const url = `${SUPABASE_URL}/rest/v1/track_segments?layout_id=eq.${layoutId}&select=id,tipo,ordem`;
  let resp;
  try { resp = await fetch(url, { headers: HEADERS }); }
  catch { return {}; }
  if (!resp.ok) return {};
  const rows = await resp.json();
  const out = {};
  for (const r of rows) {
    if (r.id) out[r.id] = r.tipo || 'curva';
  }
  return out;
}

/**
 * Devolve true se o tipo conta como "reta" pra o flash da IA.
 */
export function ehReta(tipo) {
  return tipo === 'reta_longa' || tipo === 'reta_curta';
}

/**
 * Carrega { trechoId → tipo_curva } (T0–T5/SF/ND) pra um layout — o tipo FINO
 * da curva, padrão Flávio 13/06/2026 (migration 0043_track_segments_tipo_curva).
 *
 * TOLERANTE A FALHA DE PROPÓSITO: se a coluna `tipo_curva` ainda não existe no
 * banco lido (ex.: produção antes de "MIGRAR PARA PRODUÇÃO"), o REST devolve erro
 * e a função retorna {} — a tela degrada pro tipo grosso/sem proposta, NUNCA
 * quebra a leitura ao vivo. Por isso fica separada do segments-loader (que carrega
 * a geometria e não pode falhar por uma coluna nova).
 *
 * @param {string} layoutId
 * @returns {Promise<Object>} dict trechoId → 'T0'|...|'SF'|'ND' (só dos trechos com valor)
 */
export async function carregarTipoCurvaPorTrecho(layoutId) {
  if (!layoutId) return {};
  const url = `${SUPABASE_URL}/rest/v1/track_segments?layout_id=eq.${layoutId}&select=id,tipo_curva,ordem`;
  let resp;
  try { resp = await fetch(url, { headers: HEADERS }); }
  catch { return {}; }
  if (!resp.ok) return {}; // coluna ausente (banco não migrado) ou rede: degrada em silêncio
  let rows;
  try { rows = await resp.json(); } catch { return {}; }
  if (!Array.isArray(rows)) return {};
  const out = {};
  for (const r of rows) {
    if (r.id && r.tipo_curva) out[r.id] = r.tipo_curva;
  }
  return out;
}
