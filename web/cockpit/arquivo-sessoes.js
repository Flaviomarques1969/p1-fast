// ============================================================================
// PORTA ÚNICA DE LEITURA DO ARQUIVO DURÁVEL (sessao_dumps) — item 6 do GPS (27/10/2026)
//
// O notebook sobe a gravação COMPLETA de cada sessão para a tabela sessao_dumps
// (p1fast-upload; docs/CONTRATO_DADOS.md §6): parte 0 = metadados, 1..N = blocos com as
// linhas cruas do .jsonl. Este módulo só LÊ (GET puro com a chave pública anon) e devolve as
// linhas na ordem; a conta mora no cérebro (cerebro-pagina-volta.js). Não é 2º feed ao vivo:
// o ao vivo continua só pela ponte cloud-bridge.js.
// ============================================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

/** Partes por pedido (cada parte ~500 linhas; 20 partes ≈ 2,4 MB). */
export const PARTES_POR_PEDIDO = 20;

function cabecalhos(chave) {
  return { apikey: chave, Authorization: 'Bearer ' + chave, Accept: 'application/json' };
}

async function pedir(base, chave, caminho, f) {
  const r = await f(base + '/rest/v1/' + caminho, { headers: cabecalhos(chave) });
  if (!r.ok) throw new Error('arquivo da nuvem respondeu ' + r.status);
  return r.json();
}

/**
 * Sessões guardadas, mais nova primeiro: {sessaoId, criadoEm, partes, nGps, inicioT, fimT}.
 * @param {{limite?:number, url?:string, chave?:string, fetch?:Function}} [o]
 */
export async function listarSessoes(o = {}) {
  const base = o.url || SUPABASE_URL, chave = o.chave || SUPABASE_ANON_KEY, f = o.fetch || fetch;
  const limite = o.limite || 60;
  const linhas = await pedir(base, chave,
    'sessao_dumps?parte=eq.0&select=sessao_id,criado_em,total,sessao_meta&order=criado_em.desc&limit=' + limite, f);
  return linhas.map(l => {
    const m = l.sessao_meta || {};
    return { sessaoId: l.sessao_id, criadoEm: l.criado_em, partes: l.total,
      nGps: typeof m.n_gps === 'number' ? m.n_gps : null,
      inicioT: typeof m.started_at === 'number' ? m.started_at : null,
      fimT: typeof m.t_fim_wall === 'number' ? m.t_fim_wall : null };
  });
}

/**
 * Linhas cruas de uma sessão, na ordem das partes. Falta parte = erro (página não mostra
 * sessão pela metade como se fosse inteira).
 * @param {string} sessaoId
 * @param {{url?:string, chave?:string, fetch?:Function, aoProgresso?:(feitas:number,total:number)=>void}} [o]
 */
export async function baixarSessao(sessaoId, o = {}) {
  const base = o.url || SUPABASE_URL, chave = o.chave || SUPABASE_ANON_KEY, f = o.fetch || fetch;
  const id = encodeURIComponent(sessaoId);
  const meta = await pedir(base, chave, 'sessao_dumps?sessao_id=eq.' + id + '&parte=eq.0&select=total', f);
  if (!meta.length) throw new Error('sessão não encontrada no arquivo');
  const total = meta[0].total;              // parte 0 + N blocos
  const linhas = [];
  let recebidas = 0;
  for (let de = 1; de < total; de += PARTES_POR_PEDIDO) {
    const ate = Math.min(total - 1, de + PARTES_POR_PEDIDO - 1);
    const bloco = await pedir(base, chave, 'sessao_dumps?sessao_id=eq.' + id +
      '&parte=gte.' + de + '&parte=lte.' + ate + '&select=parte,amostras&order=parte', f);
    for (const b of bloco) { recebidas++; for (const a of b.amostras || []) linhas.push(a); }
    if (o.aoProgresso) o.aoProgresso(ate, total - 1);
  }
  if (recebidas !== total - 1) throw new Error('sessão incompleta no arquivo: ' + recebidas + ' de ' + (total - 1) + ' blocos');
  return linhas;
}

export default { listarSessoes, baixarSessao };
