// ═══════════════════════════════════════════════════════════════════════════
// effective-setup — merge config-base + overrides do stint
// ═══════════════════════════════════════════════════════════════════════════
// Stint guarda APENAS as diferenças (overrides) em relação à config-base do
// carro. Esta função aplica essas diferenças em cima de um clone profundo
// da config, gerando o "setup efetivo" pra exibir nas telas operacionais
// (cockpit-mobile, box).
//
// Mapeamento (override → caminho na config):
//
//   pressaoPneus {DE,DD,TE,TD}      → config.pressaoPneus.{de,dd,te,td}
//   compostoPneu str                → config.pneus.composto
//   cambagem {DE,DD,TE,TD}          → config.alinhamento.camber.{DE,DD,TE,TD}
//   caster {DE,DD}                  → config.alinhamento.caster.{DE,DD}
//   convergencia {DE,DD,TE,TD}      → config.alinhamento.toe.{DE,DD,TE,TD}
//   molas {D,T}                     → config.suspensao.{molaD,molaT}
//   amortCompressao {D,T}           → config.suspensao.{amortCompD,amortCompT}
//   amortExtensao {D,T}             → config.suspensao.{amortExtD,amortExtT}
//   altura {D,T}                    → config.suspensao.{alturaD,alturaT}
//   barra {D,T}                     → config.suspensao.{barraD,barraT}
//   bias num                        → config.freios.bias
//   combustivel str                 → config.combustivel
//   mapaMotor str                   → config.motor
//   diferencial str                 → config.diferencial
//
// Override "vazio" (null/'') é ignorado — preserva o valor da base.

const BADGES = Object.freeze({
  pressaoPneus: 'PRESSÃO', compostoPneu: 'COMPOSTO',
  cambagem: 'CAMBER', caster: 'CASTER', convergencia: 'TOE',
  molas: 'MOLAS', amortCompressao: 'AMORT.C', amortExtensao: 'AMORT.E',
  altura: 'ALTURA', barra: 'BARRA',
  bias: 'BIAS', combustivel: 'COMBUST.', mapaMotor: 'MAPA', diferencial: 'DIF.',
});

function _hasVal(v) { return v != null && v !== ''; }

function _ensureObj(parent, key) {
  if (parent[key] == null || typeof parent[key] !== 'object') parent[key] = {};
  return parent[key];
}

/**
 * Aplica overrides em cima de uma config-base e retorna o setup efetivo.
 * Não muta inputs. Retorna null se a config-base não for fornecida.
 *
 * @param {object|null} configBase
 * @param {object|null} overrides
 * @returns {object|null}
 */
export function getEffectiveSetup(configBase, overrides) {
  if (!configBase) return null;
  // Deep clone simples — config-base é tudo serializável (sem Date/Map/Set).
  const eff = JSON.parse(JSON.stringify(configBase));
  if (!overrides || typeof overrides !== 'object') return eff;

  const apply = {
    pressaoPneus(v) {
      const target = _ensureObj(eff, 'pressaoPneus');
      const map = { DE: 'de', DD: 'dd', TE: 'te', TD: 'td' };
      Object.keys(map).forEach(k => { if (_hasVal(v?.[k])) target[map[k]] = v[k]; });
    },
    compostoPneu(v) {
      const target = _ensureObj(eff, 'pneus');
      if (_hasVal(v)) target.composto = v;
    },
    cambagem(v) {
      const al = _ensureObj(eff, 'alinhamento');
      const target = _ensureObj(al, 'camber');
      ['DE','DD','TE','TD'].forEach(k => { if (_hasVal(v?.[k])) target[k] = v[k]; });
    },
    caster(v) {
      const al = _ensureObj(eff, 'alinhamento');
      const target = _ensureObj(al, 'caster');
      ['DE','DD'].forEach(k => { if (_hasVal(v?.[k])) target[k] = v[k]; });
    },
    convergencia(v) {
      const al = _ensureObj(eff, 'alinhamento');
      const target = _ensureObj(al, 'toe');
      ['DE','DD','TE','TD'].forEach(k => { if (_hasVal(v?.[k])) target[k] = v[k]; });
    },
    molas(v) {
      const target = _ensureObj(eff, 'suspensao');
      if (_hasVal(v?.D)) target.molaD = v.D;
      if (_hasVal(v?.T)) target.molaT = v.T;
    },
    amortCompressao(v) {
      const target = _ensureObj(eff, 'suspensao');
      if (_hasVal(v?.D)) target.amortCompD = v.D;
      if (_hasVal(v?.T)) target.amortCompT = v.T;
    },
    amortExtensao(v) {
      const target = _ensureObj(eff, 'suspensao');
      if (_hasVal(v?.D)) target.amortExtD = v.D;
      if (_hasVal(v?.T)) target.amortExtT = v.T;
    },
    altura(v) {
      const target = _ensureObj(eff, 'suspensao');
      if (_hasVal(v?.D)) target.alturaD = v.D;
      if (_hasVal(v?.T)) target.alturaT = v.T;
    },
    barra(v) {
      const target = _ensureObj(eff, 'suspensao');
      if (_hasVal(v?.D)) target.barraD = v.D;
      if (_hasVal(v?.T)) target.barraT = v.T;
    },
    bias(v) {
      const target = _ensureObj(eff, 'freios');
      if (_hasVal(v)) target.bias = v;
    },
    combustivel(v) { if (_hasVal(v)) eff.combustivel = v; },
    mapaMotor(v)   { if (_hasVal(v)) eff.motor = v; },
    diferencial(v) { if (_hasVal(v)) eff.diferencial = v; },
  };

  Object.keys(overrides).forEach(tipo => {
    if (apply[tipo]) apply[tipo](overrides[tipo]);
  });

  return eff;
}

/**
 * Resumo dos overrides ativos (quantos + lista de badges).
 * Útil pra UI mostrar chip "OVERRIDES (3) · PRESSÃO · BIAS · COMBUST.".
 *
 * Considera "ativo" = override existe E pelo menos uma das suas keys
 * tem valor não-vazio. Mesmo critério da normalização no salvar do app.
 *
 * @param {object|null} overrides
 * @returns {{ count: number, badges: string[], tipos: string[] }}
 */
export function summarizeOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object') return { count: 0, badges: [], tipos: [] };
  const tipos = Object.keys(overrides).filter(t => {
    const v = overrides[t];
    if (v == null) return false;
    if (typeof v === 'object' && !Array.isArray(v)) {
      return Object.values(v).some(x => x != null && x !== '');
    }
    return v !== '';
  });
  return {
    count: tipos.length,
    badges: tipos.map(t => BADGES[t] || t.toUpperCase()),
    tipos,
  };
}

/**
 * Lista plana "campo → base → override" pra UI de comparação.
 * Cada entrada: { tipo, badge, baseDescr, overrideDescr }.
 *
 * @param {object|null} configBase
 * @param {object|null} overrides
 * @returns {Array<{tipo:string, badge:string, base:string, override:string}>}
 */
export function diffOverrides(configBase, overrides) {
  const summary = summarizeOverrides(overrides);
  if (!summary.count) return [];
  const eff = getEffectiveSetup(configBase, overrides);
  return summary.tipos.map(tipo => ({
    tipo,
    badge: BADGES[tipo] || tipo.toUpperCase(),
    base: _describe(tipo, configBase),
    override: _describe(tipo, eff),
  }));
}

// Retorna null quando a config-base não tem o campo (em vez de "—") — o
// chamador filtra "novo campo no override" vs "diff base→override" sem
// poluir UI com dashes.
function _describe(tipo, src) {
  if (!src) return null;
  switch (tipo) {
    case 'pressaoPneus': {
      const p = src.pressaoPneus || {};
      if (p.de == null && p.dd == null && p.te == null && p.td == null) return null;
      return `${p.de ?? '—'}/${p.dd ?? '—'} · ${p.te ?? '—'}/${p.td ?? '—'} PSI`;
    }
    case 'compostoPneu': return src.pneus?.composto || null;
    case 'cambagem': {
      const c = src.alinhamento?.camber || {};
      if (c.DE == null && c.DD == null && c.TE == null && c.TD == null) return null;
      return `${c.DE ?? '—'}/${c.DD ?? '—'} · ${c.TE ?? '—'}/${c.TD ?? '—'} °`;
    }
    case 'caster': {
      const c = src.alinhamento?.caster || {};
      if (c.DE == null && c.DD == null) return null;
      return `${c.DE ?? '—'}/${c.DD ?? '—'} °`;
    }
    case 'convergencia': {
      const t = src.alinhamento?.toe || {};
      if (t.DE == null && t.DD == null && t.TE == null && t.TD == null) return null;
      return `${t.DE ?? '—'}/${t.DD ?? '—'} · ${t.TE ?? '—'}/${t.TD ?? '—'} mm`;
    }
    case 'molas':
      if (src.suspensao?.molaD == null && src.suspensao?.molaT == null) return null;
      return `${src.suspensao?.molaD ?? '—'}/${src.suspensao?.molaT ?? '—'} kg/mm`;
    case 'amortCompressao':
      if (src.suspensao?.amortCompD == null && src.suspensao?.amortCompT == null) return null;
      return `${src.suspensao?.amortCompD ?? '—'}/${src.suspensao?.amortCompT ?? '—'} cliques`;
    case 'amortExtensao':
      if (src.suspensao?.amortExtD == null && src.suspensao?.amortExtT == null) return null;
      return `${src.suspensao?.amortExtD ?? '—'}/${src.suspensao?.amortExtT ?? '—'} cliques`;
    case 'altura':
      if (src.suspensao?.alturaD == null && src.suspensao?.alturaT == null) return null;
      return `${src.suspensao?.alturaD ?? '—'}/${src.suspensao?.alturaT ?? '—'} mm`;
    case 'barra':
      if (!src.suspensao?.barraD && !src.suspensao?.barraT) return null;
      return `${src.suspensao?.barraD || '—'} · ${src.suspensao?.barraT || '—'}`;
    case 'bias':            return src.freios?.bias != null ? `${src.freios.bias}% F` : null;
    case 'combustivel':     return src.combustivel || null;
    case 'mapaMotor':       return src.motor || null;
    case 'diferencial':     return src.diferencial || null;
    default:                return null;
  }
}

export const OVERRIDE_BADGES = BADGES;
