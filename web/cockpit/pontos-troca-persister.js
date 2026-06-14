// pontos-troca-persister.js — carrega e salva os pontos de troca aprendidos
// por trecho × marcha × modo na tabela `pontos_troca_aprendidos`.
//
// Onda 9 (Flávio 2026-05-29). Padrão igual ao pilot-reaction-persister.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { normalizarTipoPneu } from './tipo-pneu-normalizer.js';

const HEADERS = {
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type':  'application/json',
};

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Carrega os pontos aprendidos pra uma combinação completa.
 * Retorna lista de pontos.
 */
export async function loadPontos({ carroId, trackId, tipoPneu, modoStint }) {
  if (!isUuid(carroId) || !isUuid(trackId)) return [];
  if (tipoPneu) tipoPneu = normalizarTipoPneu(tipoPneu);
  const filtros = [
    `carro_id=eq.${carroId}`,
    `track_id=eq.${trackId}`,
    tipoPneu  ? `tipo_pneu=eq.${encodeURIComponent(tipoPneu)}`  : '',
    modoStint ? `modo_stint=eq.${encodeURIComponent(modoStint)}` : '',
    `select=trecho_id,marcha_origem,rpm_alvo,voltas_observadas,amostras_estaveis,confianca_pct,origem,melhor_tempo_trecho_ms,atualizado_em`,
  ].filter(Boolean).join('&');
  let resp;
  try { resp = await fetch(`${SUPABASE_URL}/rest/v1/pontos_troca_aprendidos?${filtros}`, { headers: HEADERS }); }
  catch { return []; }
  if (!resp.ok) return [];
  return await resp.json();
}

/**
 * Salva (upsert) um ponto específico.
 */
export async function savePonto({
  carroId, trackId, tipoPneu, vidaPneuFaixa, configCambio, modoStint,
  trechoId, marchaOrigem,
  rpmAlvo, rpmAlvoBaixo, rpmAlvoAlto,
  amostrasEstaveis, voltasObservadas, confiancaPct,
  origem,
  melhorTempoTrechoMs,
}) {
  if (!isUuid(carroId) || !isUuid(trackId) || !isUuid(trechoId)) return false;
  if (tipoPneu) tipoPneu = normalizarTipoPneu(tipoPneu);
  const payload = {
    carro_id:           carroId,
    track_id:           trackId,
    tipo_pneu:          tipoPneu  || 'desconhecido',
    vida_pneu_faixa:    vidaPneuFaixa || '0-30',
    config_cambio:      configCambio  || 'padrao',
    modo_stint:         modoStint     || 'normal',
    trecho_id:          trechoId,
    marcha_origem:      marchaOrigem,
    rpm_alvo:           Math.round(rpmAlvo),
    rpm_alvo_baixo:     Number.isFinite(rpmAlvoBaixo) ? Math.round(rpmAlvoBaixo) : null,
    rpm_alvo_alto:      Number.isFinite(rpmAlvoAlto)  ? Math.round(rpmAlvoAlto)  : null,
    voltas_observadas:  voltasObservadas || 0,
    amostras_estaveis:  amostrasEstaveis || 0,
    confianca_pct:      Math.max(0, Math.min(100, Math.round(confiancaPct || 0))),
    origem:             origem || 'aprendido',
    melhor_tempo_trecho_ms: Number.isFinite(melhorTempoTrechoMs) ? Math.round(melhorTempoTrechoMs) : null,
    atualizado_em:      new Date().toISOString(),
  };
  // POST simples. Se conflitar (unique violation), faz PATCH como update.
  // Outros erros (FK violation, etc) propagam como false com aviso real.
  let resp;
  try {
    resp = await fetch(`${SUPABASE_URL}/rest/v1/pontos_troca_aprendidos`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload),
    });
  } catch { return false; }
  if (resp.ok) return true;
  // Lê o erro do banco antes de decidir caminho
  let errBody = null;
  try { errBody = await resp.json(); } catch {}
  const code = errBody && errBody.code;
  if (code !== '23505') {
    // FK violation / check violation / etc → erro real
    console.warn('[pontos-troca-persister] POST falhou:', errBody);
    return false;
  }
  // 23505 = unique_violation → faz PATCH no mesmo registro
  const filtros = [
    `carro_id=eq.${carroId}`,
    `track_id=eq.${trackId}`,
    `tipo_pneu=eq.${encodeURIComponent(payload.tipo_pneu)}`,
    `vida_pneu_faixa=eq.${encodeURIComponent(payload.vida_pneu_faixa)}`,
    `config_cambio=eq.${encodeURIComponent(payload.config_cambio)}`,
    `modo_stint=eq.${encodeURIComponent(payload.modo_stint)}`,
    `trecho_id=eq.${trechoId}`,
    `marcha_origem=eq.${marchaOrigem}`,
  ].join('&');
  try {
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/pontos_troca_aprendidos?${filtros}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        rpm_alvo:          payload.rpm_alvo,
        amostras_estaveis: payload.amostras_estaveis,
        confianca_pct:     payload.confianca_pct,
        voltas_observadas: payload.voltas_observadas,
        atualizado_em:     payload.atualizado_em,
      }),
    });
    return r2.ok;
  } catch { return false; }
}

export async function savePontos(pontos, ctx) {
  const results = await Promise.allSettled(pontos.map(p => savePonto({ ...ctx, ...p })));
  const okCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  return { total: pontos.length, ok: okCount };
}
