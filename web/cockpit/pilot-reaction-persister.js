// pilot-reaction-persister.js — carrega e salva os perfis de tempo de troca
// do piloto no banco de produção (tabela `perfis_reacao_piloto`).
//
// Onda 7+ (Flávio 2026-05-29): "ataque a persistência agora".
//
// Estratégia:
//   - loadPerfis(carroId): carrega todos os perfis do carro do banco,
//     devolve no formato do `pilot-reaction.js` ({ key → { reaction_time_ms,
//     sample_count, last_updated } }).
//   - savePerfis(perfisDict, ctx): upsert em lote (batched).
//   - chave hierárquica: piloto+carro+marcha+trecho com NULL = "qualquer".

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const HEADERS = {
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type':  'application/json',
};

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Constrói a chave hierárquica do pilot-reaction.js a partir dos campos do banco.
 * Replica `tupleKey(piloto, carro, gear, trecho)` que usa 'x' pra null.
 */
function makeKey(p, c, g, t) {
  return [
    p ?? 'x',
    c ?? 'x',
    Number.isFinite(g) ? g : 'x',
    t ?? 'x',
  ].join(':');
}

/**
 * Carrega todos os perfis de um carro.
 * @returns {Promise<Object>} dict no formato { key → perfilObj }
 */
export async function loadPerfis(carroId) {
  if (!isUuid(carroId)) return {};
  const url = `${SUPABASE_URL}/rest/v1/perfis_reacao_piloto?carro_id=eq.${carroId}&select=piloto_id,carro_id,marcha,trecho_id,reaction_time_ms,sample_count,last_updated`;
  let resp;
  try {
    resp = await fetch(url, { headers: HEADERS });
  } catch (e) {
    console.warn('[pilot-reaction-persister] fetch falhou', e);
    return {};
  }
  if (!resp.ok) {
    console.warn(`[pilot-reaction-persister] load HTTP ${resp.status}`);
    return {};
  }
  const rows = await resp.json();
  const out = {};
  for (const r of rows) {
    const key = makeKey(r.piloto_id, r.carro_id, r.marcha, r.trecho_id);
    out[key] = {
      key,
      reaction_time_ms: Number(r.reaction_time_ms),
      sample_count:     r.sample_count,
      last_updated:     r.last_updated ? new Date(r.last_updated).getTime() : Date.now(),
    };
  }
  return out;
}

/**
 * Salva um perfil específico (upsert idempotente via índice único).
 * Não bloqueia — se falhar, registra no console e segue.
 */
export async function savePerfil({ pilotoId, carroId, marcha, trechoId, reactionTimeMs, sampleCount }) {
  if (!isUuid(carroId)) return false;
  const payload = {
    piloto_id:        pilotoId ?? null,
    carro_id:         carroId,
    marcha:           Number.isFinite(marcha) ? marcha : null,
    trecho_id:        trechoId ?? null,
    reaction_time_ms: reactionTimeMs,
    sample_count:     sampleCount,
    last_updated:     new Date().toISOString(),
  };
  // Estratégia upsert: se conflitar com índice único, atualiza.
  // Usa `Prefer: resolution=merge-duplicates` + on_conflict (PostgREST 11+).
  // Como o índice único é por expressão, simulamos via tentativa POST e
  // fallback PATCH se vier 409.
  let resp;
  try {
    resp = await fetch(`${SUPABASE_URL}/rest/v1/perfis_reacao_piloto`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[pilot-reaction-persister] save fetch falhou', e);
    return false;
  }
  if (resp.ok) return true;
  // Fallback: tenta PATCH filtrado (caso o upsert não tenha funcionado por
  // limitação do índice por expressão)
  const filtros = [
    `carro_id=eq.${carroId}`,
    pilotoId ? `piloto_id=eq.${pilotoId}` : `piloto_id=is.null`,
    Number.isFinite(marcha) ? `marcha=eq.${marcha}` : `marcha=is.null`,
    trechoId ? `trecho_id=eq.${trechoId}` : `trecho_id=is.null`,
  ].join('&');
  try {
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/perfis_reacao_piloto?${filtros}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        reaction_time_ms: payload.reaction_time_ms,
        sample_count:     payload.sample_count,
        last_updated:     payload.last_updated,
      }),
    });
    return r2.ok;
  } catch (e) {
    console.warn('[pilot-reaction-persister] patch falhou', e);
    return false;
  }
}

/**
 * Salva todos os perfis de uma vez (chamado periódicamente pelo orquestrador).
 * Usa Promise.all pra paralelizar, mas tolera falhas.
 */
export async function savePerfis(perfisDict, ctx = {}) {
  const entradas = Object.values(perfisDict);
  const results = await Promise.allSettled(entradas.map(perfil => {
    // chave 'p:c:g:t' → desfaz
    const [p, c, g, t] = String(perfil.key || '').split(':');
    return savePerfil({
      pilotoId:       p && p !== 'x' ? p : ctx.pilotoId ?? null,
      carroId:        c && c !== 'x' ? c : ctx.carroId,
      marcha:         g && g !== 'x' ? Number(g) : null,
      trechoId:       t && t !== 'x' ? t : null,
      reactionTimeMs: perfil.reaction_time_ms,
      sampleCount:    perfil.sample_count,
    });
  }));
  const okCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  return { total: entradas.length, ok: okCount };
}
