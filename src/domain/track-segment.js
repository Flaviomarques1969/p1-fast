// ═══════════════════════════════════════════════════════════
// TrackSegment — camada 2 da pista
// ═══════════════════════════════════════════════════════════
// Segmento físico da pista: curva (trecho) ou reta (só referência geográfica).
//
// Regra canônica (domínio 2026-04-23):
//   • ehTrecho = true  → curva (entra no motor de análise)
//   • ehTrecho = false → reta (apenas label visual, NÃO entra em comparações)
//
// Cada segment pertence a uma Parcial (parcialId: 'P1'|'P2'|...|'PN'),
// atribuída pelo t do seu ponto central na volta de referência.
//
// APEX (gate 2026-04-24, docs/raceops/APEX_ANALYSIS_RULES.md):
//   apexReference        — coordenada do apex ideal { x, y } no viewBox
//   apexStrategy         — antecipado | neutro | tardio | duplo
//   apexClassificationDefault — uma das 12 classificações canônicas (opcional)
//   nextStraightLength   — comprimento da reta seguinte em metros (orienta peso da saída)
//   cornerType           — lenta | media | rapida (orienta tipo de análise)
//
// 4 PONTOS CANÔNICOS DO TRECHO (Flavio 2026-04-25):
// O Flavio definiu que o trecho tem 4 pontos cadastráveis e movíveis no
// configurador de pista. Cada um é { x, y } no viewBox do mapa.
//
//   entryPoint    — Vmax PRÉ-FREIO. Define INÍCIO do trecho. É o ponto onde
//                   o piloto chega na maior velocidade ANTES de começar a frear.
//                   É a referência primária para "velocidade de entrada".
//   brakingPoint  — Ponto de frenagem. Onde o piloto começa a frear. A
//                   "entrada do trecho" tem essas DUAS visões — Vmax pré-freio
//                   (entryPoint) e ponto de freio (brakingPoint) — pra medir
//                   tanto a velocidade máxima quanto o ponto de início da
//                   frenagem.
//   apexReference — Apex ideal. Movível no configurador.
//   exitPoint     — Ponto de saída. Define FIM do trecho. Onde o piloto
//                   "deixa" a curva pra retomar a reta seguinte.
//
// Campos opcionais: análise opera em modo degradado se faltarem.
// Helper: TrackSegments.hasFullPointCadastro(seg) confirma os 4 cadastrados.
// Aliases legados: pontoFrenagem (== brakingPoint), inicioRetaPosterior
// (== exitPoint). Quando ambos presentes, brakingPoint/exitPoint vencem.

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'TrackSegment';

export const SegmentTipo = Object.freeze({
  CURVA: 'curva',
  RETA:  'reta',
});

export const ApexStrategy = Object.freeze({
  ANTECIPADO: 'antecipado',
  NEUTRO:     'neutro',
  TARDIO:     'tardio',
  DUPLO:      'duplo',
});

export const CornerType = Object.freeze({
  LENTA:  'lenta',
  MEDIA:  'media',
  RAPIDA: 'rapida',
});

export const ApexClassification = Object.freeze({
  CORRETO:               'apex-correto',
  ANTECIPADO:            'apex-antecipado',
  TARDIO:                'apex-tardio',
  PERDIDO_FORA:          'apex-perdido-fora',
  INTERNO_DEMAIS:        'apex-interno-demais',
  DUPLO:                 'apex-duplo',
  SACRIFICADO_INTENCIONAL: 'apex-sacrificado-intencional',
  PREJUDICANDO_SAIDA:    'apex-prejudicando-saida',
  BOM_ACELERACAO_TARDIA: 'apex-bom-aceleracao-tardia',
  ENTRADA_BOA_APEX_RUIM: 'entrada-boa-apex-ruim',
  APEX_BOM_SAIDA_RUIM:   'apex-bom-saida-ruim',
  ENTRADA_RUIM_APEX_COMP:'entrada-ruim-apex-comprometido',
});

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

function isPointOrNull(v) {
  if (v == null) return true;
  return typeof v === 'object' && Number.isFinite(v.x) && Number.isFinite(v.y);
}

function validate(data) {
  if (!data.layoutId) throw new Error('TrackSegment.layoutId obrigatório');
  if (!data.nome || !data.nome.trim()) throw new Error('TrackSegment.nome obrigatório');
  if (!Object.values(SegmentTipo).includes(data.tipo)) {
    throw new Error(`TrackSegment.tipo inválido: ${data.tipo}`);
  }
  if (!data.parcialId || !/^P\d+$/.test(data.parcialId)) {
    throw new Error(`TrackSegment.parcialId deve ser 'P<n>', veio: ${data.parcialId}`);
  }
  if (typeof data.ehTrecho !== 'boolean') {
    throw new Error('TrackSegment.ehTrecho obrigatório (true=curva, false=reta)');
  }
  if (data.apexStrategy != null && !Object.values(ApexStrategy).includes(data.apexStrategy)) {
    throw new Error(`TrackSegment.apexStrategy inválido: ${data.apexStrategy}`);
  }
  if (data.cornerType != null && !Object.values(CornerType).includes(data.cornerType)) {
    throw new Error(`TrackSegment.cornerType inválido: ${data.cornerType}`);
  }
  if (data.nextStraightLength != null && (typeof data.nextStraightLength !== 'number' || data.nextStraightLength < 0)) {
    throw new Error('TrackSegment.nextStraightLength deve ser número >= 0');
  }
  for (const key of ['entryPoint', 'brakingPoint', 'apexReference', 'exitPoint']) {
    if (!isPointOrNull(data[key])) {
      throw new Error(`TrackSegment.${key} deve ser { x:number, y:number } ou null`);
    }
  }
  return true;
}

export const TrackSegments = {
  async create({
    layoutId,
    parcialId,
    nome,
    tipo = SegmentTipo.CURVA,
    ehTrecho = null,        // se null, deriva de tipo (curva→true, reta→false)
    pathStart = null,
    pathEnd = null,
    tNaVolta = null,        // % do tempo da volta de referência onde o centro do segmento passa
    pontoFrenagem = null,         // LEGADO (alias de brakingPoint)
    inicioRetaPosterior = null,   // LEGADO (alias de exitPoint)
    x = null,
    y = null,
    ordem = 0,
    // Apex (docs/raceops/APEX_ANALYSIS_RULES.md). Opcionais.
    apexReference = null,        // { x, y } no viewBox do mapa, posição do apex ideal
    apexStrategy = null,         // ApexStrategy.*
    apexClassificationDefault = null, // hint do comportamento esperado
    cornerType = null,           // CornerType.*
    nextStraightLength = null,   // m
    // 4 pontos canônicos do trecho (Flavio 2026-04-25). Todos opcionais.
    entryPoint = null,           // { x, y } — Vmax pré-freio, define INÍCIO do trecho
    brakingPoint = null,         // { x, y } — onde começa a frear
    exitPoint = null,            // { x, y } — define FIM do trecho
  }) {
    const seg = {
      id: uid('seg'),
      layoutId,
      parcialId,
      nome: nome.trim(),
      tipo,
      ehTrecho: ehTrecho === null ? tipo === SegmentTipo.CURVA : !!ehTrecho,
      pathStart,
      pathEnd,
      tNaVolta,
      pontoFrenagem,
      inicioRetaPosterior,
      x,
      y,
      ordem,
      apexReference,
      apexStrategy,
      apexClassificationDefault,
      cornerType,
      nextStraightLength,
      // Canônico vence; legado preenche quando canônico ausente
      entryPoint,
      brakingPoint: brakingPoint || pontoFrenagem || null,
      exitPoint:    exitPoint    || inicioRetaPosterior || null,
      ...defaults(),
    };
    validate(seg);
    await db.trackSegments.add(seg);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: seg.id, payload: seg });
    logger.info('[track-segment] criado', { id: seg.id, nome, parcialId, ehTrecho: seg.ehTrecho });
    return seg;
  },

  /**
   * Helper: indica se o trecho está cadastrado o suficiente para análise plena de apex.
   * Sem isto, análise opera em modo degradado.
   */
  hasFullApexCadastro(seg) {
    return !!(seg && seg.ehTrecho && seg.apexReference && seg.apexStrategy && seg.cornerType);
  },

  /**
   * Helper: indica se o trecho tem os 4 pontos canônicos cadastrados
   * (entryPoint=Vmax pré-freio, brakingPoint, apexReference, exitPoint).
   * Quando true, o detector pode medir velocidade pré-freio, ponto de
   * freio, apex e saída pelo mesmo trecho. Sem isso → modo degradado.
   * Flavio 2026-04-25.
   */
  hasFullPointCadastro(seg) {
    return !!(
      seg && seg.ehTrecho &&
      seg.entryPoint && seg.brakingPoint &&
      seg.apexReference && seg.exitPoint
    );
  },

  /**
   * Atualiza um dos 4 pontos canônicos (ou o apexReference) movendo-o
   * pra { x, y } novo. Usado pelo configurador de pista quando o piloto
   * arrasta o marcador do ápice/freio/entrada/saída no mapa.
   * @param {string} id
   * @param {'entryPoint'|'brakingPoint'|'apexReference'|'exitPoint'} ponto
   * @param {{x:number,y:number}|null} coord  null = limpa
   */
  async setPonto(id, ponto, coord) {
    const validos = new Set(['entryPoint', 'brakingPoint', 'apexReference', 'exitPoint']);
    if (!validos.has(ponto)) throw new Error(`ponto inválido: ${ponto}`);
    if (coord != null && !(typeof coord === 'object' && Number.isFinite(coord.x) && Number.isFinite(coord.y))) {
      throw new Error('coord deve ser { x:number, y:number } ou null');
    }
    const s = await db.trackSegments.get(id);
    if (!s) throw new Error(`TrackSegment ${id} não existe`);
    const merged = { ...s, [ponto]: coord, atualizadoEm: Date.now() };
    validate(merged);
    await db.trackSegments.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[track-segment] ponto atualizado', { id, ponto, coord });
    return merged;
  },

  async get(id) {
    return db.trackSegments.get(id);
  },

  async listByLayout(layoutId) {
    const all = await db.trackSegments.where('layoutId').equals(layoutId).toArray();
    return all.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  },

  async listTrechosByLayout(layoutId) {
    const all = await this.listByLayout(layoutId);
    return all.filter(s => s.ehTrecho === true);
  },

  async listByParcial(layoutId, parcialId) {
    const all = await this.listByLayout(layoutId);
    return all.filter(s => s.parcialId === parcialId);
  },

  async listTrechosByParcial(layoutId, parcialId) {
    const all = await this.listByParcial(layoutId, parcialId);
    return all.filter(s => s.ehTrecho === true);
  },

  async renomear(id, novoNome) {
    if (!novoNome || !novoNome.trim()) throw new Error('novoNome obrigatório');
    const s = await db.trackSegments.get(id);
    if (!s) throw new Error(`TrackSegment ${id} não existe`);
    const merged = { ...s, nome: novoNome.trim(), atualizadoEm: Date.now() };
    await db.trackSegments.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[track-segment] renomeado', { id, de: s.nome, para: novoNome });
    return merged;
  },

  async moverPara(id, { x, y }) {
    const s = await db.trackSegments.get(id);
    if (!s) throw new Error(`TrackSegment ${id} não existe`);
    const merged = { ...s, x, y, atualizadoEm: Date.now() };
    await db.trackSegments.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    return merged;
  },

  async update(id, patch) {
    const existing = await db.trackSegments.get(id);
    if (!existing) throw new Error(`TrackSegment ${id} não existe`);
    const merged = { ...existing, ...patch, atualizadoEm: Date.now() };
    validate(merged);
    await db.trackSegments.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    return merged;
  },

  async delete(id) {
    await db.trackSegments.delete(id);
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: id, payload: null });
    logger.warn('[track-segment] deletado', { id });
  },

  async bulkCreate(segments) {
    const now = Date.now();
    const withIds = segments.map((s, idx) => ({
      ehTrecho: s.ehTrecho === undefined ? s.tipo === SegmentTipo.CURVA : !!s.ehTrecho,
      ...s,
      id: s.id || uid('seg'),
      ordem: s.ordem ?? idx,
      criadoEm: now,
      atualizadoEm: now,
    }));
    withIds.forEach(validate);
    await db.trackSegments.bulkAdd(withIds);
    for (const s of withIds) {
      await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: s.id, payload: s });
    }
    logger.info('[track-segment] bulk create', { count: withIds.length });
    return withIds;
  },
};
