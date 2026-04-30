// ═══════════════════════════════════════════════════════════
// Track — circuito / autódromo
// ═══════════════════════════════════════════════════════════
// Guarda config visual (imagem, path SVG, viewBox), operacional
// (linha de chegada, trechos) e descritiva (labels de curvas).
// Uma track é referenciada por Session.

import { db } from '../core/db.js';
import { uid } from '../core/id.js';
import { logger } from '../core/logger.js';
import { syncQueue, SyncOp } from '../core/sync-queue.js';

const ENTITY = 'Track';

function defaults() {
  const now = Date.now();
  return { criadoEm: now, atualizadoEm: now };
}

function validate(data) {
  if (!data.nome || typeof data.nome !== 'string') throw new Error('Track.nome obrigatório');
  if (!data.apelido || typeof data.apelido !== 'string') throw new Error('Track.apelido obrigatório');
  return true;
}

export const Tracks = {
  async create({
    nome,                     // nome oficial completo
    apelido,                  // "Brasília", "Interlagos"
    pais = 'BR',
    cidade = null,
    extensaoMetros = null,
    numeroCurvas = null,
    sentido = null,           // 'horário' | 'anti-horário'
    // Assets visuais
    imagemFundo = null,       // path relativo: "assets/pistas/brasilia.png"
    viewBox = null,           // { w, h }
    svgPath = null,           // string do d= do <path>
    // Operacional
    linhaChegada = null,      // { x1, y1, x2, y2 } no viewBox
    trechos = null,           // [{ id, nome, pathStart, pathEnd }] em % do path
    curvasLabels = null,      // [{ x, y, nome, tipo }]
    weightsPorParcial = null, // { P1, P2, ...} pesos por parcial (opcional, default = tempo igual)
    geoAncoras = null,        // [{lat,lng,x,y}, {lat,lng,x,y}] pra projeção
    lapRefSeg = null,          // tempo (s) da volta de referência usada pra calcular parciais
    gpsRefUrl = null,          // URL relativa do JSON GPS de referência
  }) {
    const track = {
      id: uid('trk'),
      nome,
      apelido,
      pais,
      cidade,
      extensaoMetros,
      numeroCurvas,
      sentido,
      imagemFundo,
      viewBox,
      svgPath,
      linhaChegada,
      trechos: trechos || [],
      curvasLabels: curvasLabels || [],
      weightsPorParcial: weightsPorParcial || null,
      geoAncoras: geoAncoras || null,
      lapRefSeg,
      gpsRefUrl,
      configCompleta: false,
      ...defaults(),
    };
    validate(track);
    await db.tracks.add(track);
    await syncQueue.enqueue({ tipo: SyncOp.CREATE, entidade: ENTITY, entidadeId: track.id, payload: track });
    logger.info('[track] criado', { id: track.id, apelido });
    return track;
  },

  async get(id) {
    return db.tracks.get(id);
  },

  async getByApelido(apelido) {
    return db.tracks.where('apelido').equalsIgnoreCase(apelido).first();
  },

  async list() {
    return db.tracks.orderBy('criadoEm').toArray();
  },

  async update(id, patch) {
    const existing = await db.tracks.get(id);
    if (!existing) throw new Error(`Track ${id} não existe`);
    const merged = { ...existing, ...patch, atualizadoEm: Date.now() };
    merged.configCompleta = !!(merged.linhaChegada && merged.svgPath);
    validate(merged);
    await db.tracks.put(merged);
    await syncQueue.enqueue({ tipo: SyncOp.UPDATE, entidade: ENTITY, entidadeId: id, payload: merged });
    logger.info('[track] atualizado', { id, campos: Object.keys(patch) });
    return merged;
  },

  async delete(id) {
    await db.tracks.delete(id);
    await syncQueue.enqueue({ tipo: SyncOp.DELETE, entidade: ENTITY, entidadeId: id, payload: null });
    logger.warn('[track] deletado', { id });
  },
};
