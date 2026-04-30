// ═══════════════════════════════════════════════════════════
// TireWear — Aprendizado de desgaste de pneu (B5)
// ═══════════════════════════════════════════════════════════
// Ao instalar pneu: registra composto + nível inicial (0..3) + data.
// Cada stint incrementa `voltasNoPneu` com o nº de voltas válidas.
// Após 3+ instalações do mesmo composto, estima vida útil restante em voltas.
//
// Persistência: `tireInstalls` não é uma store Dexie separada — guardamos
// como array em `meta.key='tire:installs:<composto>'` (simples, volume baixo).

import { db } from '../core/db.js';
import { StintEnvironment } from './stint-env.js';
import { Laps } from './lap.js';

const KEY = composto => `tire:installs:${(composto || 'desconhecido').toLowerCase()}`;

async function readInstalls(composto) {
  const row = await db.meta.get(KEY(composto));
  return row?.value || [];
}
async function writeInstalls(composto, arr) {
  await db.meta.put({ key: KEY(composto), value: arr });
}

export const TireWear = {
  /**
   * Registra instalação de pneu. eixo = 'D' | 'T' | 'DT' (os 4).
   * nivel: 0 (novo) .. 3 (usado).
   */
  async instalar({ composto, eixo, nivelInicial = 0, observacao = null }) {
    if (!composto) throw new Error('composto obrigatório');
    if (!['D', 'T', 'DT'].includes(eixo)) throw new Error('eixo inválido');
    const installs = await readInstalls(composto);
    const install = {
      id: `ti_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      eixo,
      nivelInicial,
      nivelAtual: nivelInicial,
      voltasNoPneu: 0,
      trocadoEm: null,
      nivelFinal: null,
      observacao,
      instaladoEm: Date.now(),
    };
    installs.push(install);
    await writeInstalls(composto, installs);
    return install;
  },

  async list(composto) {
    return readInstalls(composto);
  },

  /** Instalação ativa (não trocada) pra um composto+eixo. */
  async getAtiva(composto, eixo) {
    const installs = await readInstalls(composto);
    return installs.find(i => i.eixo === eixo && i.trocadoEm == null) || null;
  },

  /** Incrementa voltas no pneu ativo com base em voltas válidas do stint. */
  async registrarStint({ composto, eixo, sessionId }) {
    const ativa = await this.getAtiva(composto, eixo);
    if (!ativa) return null;
    const laps = await Laps.listValid(sessionId);
    const installs = await readInstalls(composto);
    const idx = installs.findIndex(i => i.id === ativa.id);
    if (idx === -1) return null;
    installs[idx] = { ...installs[idx], voltasNoPneu: installs[idx].voltasNoPneu + laps.length };
    await writeInstalls(composto, installs);
    return installs[idx];
  },

  async trocar({ composto, eixo, nivelFinal = 3, observacao = null }) {
    const installs = await readInstalls(composto);
    const idx = installs.findIndex(i => i.eixo === eixo && i.trocadoEm == null);
    if (idx === -1) return null;
    installs[idx] = {
      ...installs[idx],
      trocadoEm: Date.now(),
      nivelFinal,
      observacao: [installs[idx].observacao, observacao].filter(Boolean).join(' | ') || null,
    };
    await writeInstalls(composto, installs);
    return installs[idx];
  },

  /**
   * Estima vida útil (em voltas) pro composto com base em histórico.
   * Critério: média de `voltasNoPneu` das instalações trocadas com nivelFinal=3.
   * Se < 3 amostras, retorna null (sem dados).
   */
  async estimarVidaUtil(composto) {
    const installs = await readInstalls(composto);
    const concluidas = installs.filter(i => i.trocadoEm && i.nivelFinal === 3);
    if (concluidas.length < 3) return { amostras: concluidas.length, estimativaVoltas: null };
    const voltas = concluidas.map(i => i.voltasNoPneu);
    const avg = Math.round(voltas.reduce((a, b) => a + b, 0) / voltas.length);
    return { amostras: concluidas.length, estimativaVoltas: avg, minimo: Math.min(...voltas), maximo: Math.max(...voltas) };
  },

  /**
   * Para o header do Box: "pneu D: 28/~40 voltas" (se estimativa existir).
   */
  async chipLabelDianteiro(sessionId) {
    const env = await StintEnvironment.getBySession(sessionId);
    if (!env?.composto) return null;
    const ativa = await this.getAtiva(env.composto, 'D') || await this.getAtiva(env.composto, 'DT');
    if (!ativa) return null;
    const vida = await this.estimarVidaUtil(env.composto);
    if (vida.estimativaVoltas == null) return `pneu D: ${ativa.voltasNoPneu}v (sem estimativa)`;
    return `pneu D: ${ativa.voltasNoPneu}/~${vida.estimativaVoltas}v`;
  },
};
