// ═══════════════════════════════════════════════════════════
// seed-stint — Stint exemplo para validar Advisor sem pista real
// ═══════════════════════════════════════════════════════════
// Gera 1 Session + 12 Laps sintéticas coerentes com Brasília.
// Tempos derivados da volta de referência (171.038s ajustada pra 118s
// em Celta 1.4 — o GPS ref é dessa mesma volta). Jitter controlado:
//   • volta base ~118s ± 1.2s
//   • 1 volta-lixo (invalidada) no meio
//   • temposPorParcial e temposPorTrecho distribuídos proporcionalmente
//   • melhor volta por trecho em voltas diferentes (força Advisor a
//     recomendar "volta teórica ideal")
//
// Idempotente por apelido do stint. Flag `limpar: true` remove antes.

import { db } from '../core/db.js';
import { Users } from './user.js';
import { Cars } from './car.js';
import { CarConfigurations } from './car-configuration.js';
import { Tracks } from './track.js';
import { TrackLayouts } from './track-layout.js';
import { TrackSegments } from './track-segment.js';
import { Sessions, SessionStatus, SessionTipo, ClimaCondicao } from './session.js';
import { Laps } from './lap.js';
import { StintEnvironment } from './stint-env.js';
import { logger } from '../core/logger.js';

const STINT_APELIDO = '[EXEMPLO] Brasília · Celta · 12v';
const BASE_LAP_MS = 118_000;
const JITTER_MS = 1_200;

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function distribute(tempoMs, pesos) {
  const soma = pesos.reduce((a, b) => a + b, 0);
  return pesos.map(p => Math.round(tempoMs * p / soma));
}

export async function seedStintExemplo({ limpar = false } = {}) {
  const user = await Users.getOrCreatePrimary();
  const track = await Tracks.getByApelido('Brasília');
  if (!track) throw new Error('Brasília não encontrada — rode seedAllTracks primeiro');

  const layout = await TrackLayouts.getPrincipal(track.id);
  if (!layout) throw new Error('Layout Principal de Brasília não existe');

  const allSegs = await TrackSegments.listByLayout(layout.id);
  const trechos = allSegs.filter(s => s.ehTrecho).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const parciais = layout.parciais || [];

  if (limpar) {
    const existentes = (await db.sessions.toArray()).filter(s => s.notas === STINT_APELIDO);
    for (const s of existentes) {
      await db.laps.where('sessionId').equals(s.id).delete();
      await db.stintEnvironment.where('sessionId').equals(s.id).delete();
      await db.sessions.delete(s.id);
    }
    logger.info('[seed-stint] limpeza', { removidas: existentes.length });
  } else {
    const jaExiste = (await db.sessions.toArray()).some(s => s.notas === STINT_APELIDO);
    if (jaExiste) {
      logger.info('[seed-stint] já existe, pulando (use limpar:true pra recriar)');
      return null;
    }
  }

  let cars = await db.cars.where('userId').equals(user.id).toArray();
  let car = cars.find(c => /celta/i.test(c.nome)) || cars[0];
  if (!car) {
    car = await Cars.create({
      userId: user.id,
      nome: 'Celta 1.4',
      marca: 'Chevrolet',
      modelo: 'Celta',
      ano: 2008,
    });
  }

  let cfg = (await CarConfigurations.listByCar(car.id))[0];
  if (!cfg) {
    cfg = await CarConfigurations.create({
      carId: car.id,
      nome: 'Setup exemplo · Celta 1.4',
      notas: 'config criada pelo seed-stint (dados sintéticos)',
    });
  }

  const dataInicio = Date.now() - 3600_000;
  const session = await Sessions.create({
    userId: user.id,
    carId: car.id,
    carConfigurationId: cfg.id,
    trackId: track.id,
    tipoSessao: SessionTipo.TREINO_LIVRE,
    clima: ClimaCondicao.SECO,
    temperaturaAr: 28,
    temperaturaPista: 42,
    planoStint: {
      meta: 'Atacar Curva do Placar e Mergulho da Bruxa (stint exemplo)',
      abordagem: 'progressiva',
      trechosFoco: trechos.slice(0, 2).map(t => t.id),
    },
    notas: STINT_APELIDO,
  });
  await db.sessions.put({
    ...(await db.sessions.get(session.id)),
    status: SessionStatus.FINALIZADA,
    dataInicio,
  });

  const r = rand(42);
  const nLaps = 12;
  const tStart = dataInicio;

  const parcialPesos = parciais.map((p, i) => (p.tEnd - p.tStart) * (i === 0 ? 1.05 : i === 2 ? 0.97 : 1));
  const trechoPesos = trechos.map((_, i) => 1 + (i % 3) * 0.15);

  for (let i = 0; i < nLaps; i++) {
    const invalida = i === 5;
    const fatorAtaque = invalida ? 1.06 : (1 + (r() - 0.5) * 0.018) * (i > 8 ? 0.994 : 1);
    const tempoMs = Math.round(BASE_LAP_MS * fatorAtaque + (r() - 0.5) * JITTER_MS);

    const parciaisMs = distribute(tempoMs, parcialPesos.map(p => p * (1 + (r() - 0.5) * 0.01)));
    const temposPorParcial = {};
    parciais.forEach((p, idx) => { temposPorParcial[p.id] = parciaisMs[idx]; });

    const temposPorTrecho = {};
    const trechosPorParcial = {};
    for (const t of trechos) {
      (trechosPorParcial[t.parcialId] ||= []).push(t);
    }
    parciais.forEach((p, idx) => {
      const trs = trechosPorParcial[p.id] || [];
      if (!trs.length) return;
      const tempoParc = parciaisMs[idx];
      const metade = Math.round(tempoParc * 0.55);
      const pesos = trs.map(t => trechoPesos[trechos.indexOf(t)] * (1 + (r() - 0.5) * 0.04));
      const divididos = distribute(metade, pesos);
      trs.forEach((t, k) => { temposPorTrecho[t.id] = divididos[k]; });
    });

    const inicio = tStart + i * 135_000;
    const lap = await Laps.create({
      sessionId: session.id,
      numero: i + 1,
      inicioAt: inicio,
      fimAt: inicio + tempoMs,
      tempoMs,
      temposPorParcial,
      temposPorTrecho,
    });

    if (invalida) {
      await Laps.invalidar(lap.id, { motivo: 'saiu-pista', observacao: 'seed exemplo' });
    }
  }

  await StintEnvironment.upsert(session.id, {
    tempPista: 42,
    tempAr: 28,
    pressaoD: 1.9,
    pressaoT: 1.8,
    // 4 pts por eixo: [esq_INT, esq_EXT, dir_INT, dir_EXT]
    pneuTempD: [82, 94, 80, 92],
    pneuTempT: [78, 84, 76, 82],
    desgasteNivelD: 1,
    desgasteNivelT: 1,
    composto: 'medio',
    objetivo: 'Atacar Curva do Placar',
    tanqueLitros: 45,
    combustivelInicialL: 38,
    consumoMedioLVolta: 1.6,
  });

  // Plano ativo com nVoltasAlvo (obrigatório agora)
  const { StintPlans, Abordagem, FocusModeOrigem } = await import('./stint-plan.js');
  await StintPlans.create({
    sessionId: session.id,
    meta: 'Atacar Curva do Placar e Mergulho da Bruxa (stint exemplo)',
    nVoltasAlvo: nLaps,
    abordagem: Abordagem.PROGRESSIVA,
    trechosFoco: trechos.slice(0, 2).map(t => t.id),
    focusModeOrigem: FocusModeOrigem.AUTO,
  });

  logger.info('[seed-stint] criado', { sessionId: session.id, nLaps });
  return { sessionId: session.id, car, cfg, track, layout, nLaps };
}
