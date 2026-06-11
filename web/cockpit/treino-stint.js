// treino-stint.js — motor pedagógico do TREINO DE TÉCNICA no stint.
//
// Decisão Flávio 11/06/2026 (proposta "Stint Revestido" aprovada na íntegra):
//   - Válvula LIGADA: erro grave fora do foco fura o filtro 1 vez (e re-arma
//     só quando aquele componente melhora).
//   - Degrau digerível: a prescrição pede ~30% do caminho até a melhor
//     passagem, teto de 4 m por vez. As MARCAS na tela continuam sempre nas
//     posições reais (hábito e melhor) — o degrau muda só o número pedido.
//
// O que este motor decide (e o painel obedece):
//   - CALIBRAÇÃO: nada de prescrição antes de 2 passagens medidas no trecho.
//   - CONSISTÊNCIA: "aprendeu" = 3 das últimas 4 passagens na banda do foco.
//     Pico isolado não consolida. Consolidado = a IA cala naquele trecho
//     (silêncio é consolidação, não buraco); reabre se regredir 2 seguidas.
//   - GUARDA DO CÍRCULO DE TRAÇÃO: acerto no foco só conta se o trecho
//     INTEIRO não piorou — frear 4 m mais fundo matando a saída não é
//     aprendizado, é vício novo.
//   - ANTI-SATURAÇÃO: 2 falhas seguidas piorando → exigência recua (degrau
//     menor); 3 → a IA cala naquele trecho até o fim do stint.
//   - CONSOLIDAÇÃO PRÉ-BOX: nas 2 últimas voltas antes de parada planejada,
//     nenhuma meta nova — só rodar o que já assentou.
//
// A régua de comparação NUNCA muda: melhor passagem histórica do carro +
// configuração (regra central do produto). O motor dosa o CAMINHO até ela.

import { treinoPorFoco, MENSAGENS_SEMPRE } from './catalogo-treinos.js';
import { PEDAGOGICA } from './mensagens-pedagogicas.js';

// ── Constantes do contrato (aprovadas 11/06) ─────────────────
export const DEGRAU_FRACAO = 0.30;       // ~30% do caminho até a melhor
export const DEGRAU_TETO_M = 4;          // nunca pede mais que isso por vez
export const DEGRAU_PISO_M = 2;          // degrau menor que isso não vale a tela
export const DEGRAU_TETO_REDUZIDO_M = 2; // exigência recuada (anti-saturação)
export const VALVULA_FORA_FOCO_S = 0.5;  // erro "grave" fora do foco (segundos)
export const BANDA_FOCO_S = 0.03;        // foco "em dia" (mesmo limiar do motor de orientação)
export const CALIBRACAO_PASSAGENS = 2;   // mede o hábito antes de prescrever
export const CONSISTENCIA_N = 3;         // aprendeu = N das últimas M na banda
export const CONSISTENCIA_M = 4;
export const FALHAS_PARA_REDUZIR = 2;
export const FALHAS_PARA_CALAR = 3;
export const REABRE_APOS_REGRESSOES = 2; // consolidado reabre com 2 regressões seguidas
export const GUARDA_TOTAL_TOLERANCIA_S = 0.05; // tolerância de piora do trecho inteiro

/**
 * Lê o plano do stint gravado pelo Planejamento (localStorage
 * 'p1fast-plano-stint-v1' — precedente idêntico ao 'p1fast-modo-stint-v1'
 * consumido em main-t3000.js) e devolve o plano validado, ou null.
 *
 * Atalho de desenvolvimento/validação: ?treino=<foco> arma o treino sem
 * passar pelo Planejamento (não grava nada; só leitura de tela).
 */
export function resolvePlanoStint({ storage, search } = {}) {
  const q = search ?? (typeof location !== 'undefined' ? location.search : '');
  try {
    const foco = new URLSearchParams(q || '').get('treino');
    if (foco && treinoPorFoco(foco)) {
      return { proposito: 'treinar', foco, ghost: false, voltas: 10, paradas: [], origem: 'query' };
    }
  } catch {}
  try {
    const ls = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!ls) return null;
    const raw = ls.getItem('p1fast-plano-stint-v1');
    if (!raw) return null;
    const plano = JSON.parse(raw);
    if (!plano || typeof plano !== 'object') return null;
    if (plano.proposito === 'treinar' && (!plano.foco || !treinoPorFoco(plano.foco))) {
      return null; // treino sem foco válido = plano não-armável (painel roda padrão)
    }
    return { ...plano, origem: 'planejamento' };
  } catch {
    return null;
  }
}

export class TreinoStint {
  /**
   * @param {Object} opts
   * @param {string} opts.foco    id do treino no catálogo (ex.: 'frenagem')
   * @param {Object} [opts.plano] plano completo (paradas → consolidação pré-box)
   */
  constructor({ foco, plano = null } = {}) {
    const treino = treinoPorFoco(foco);
    if (!treino) throw new Error(`TreinoStint: foco desconhecido "${foco}"`);
    this._treino = treino;
    this._plano = plano;
    this._voltaAtual = null;
    this._porSeg = new Map();      // segmentId → estado pedagógico do trecho
    this._valvulaUsada = new Map(); // segmentId → sub fora do foco que já furou o filtro
    const codigosFoco = treino.mensagens.map(k => PEDAGOGICA[k]?.codigo).filter(Boolean);
    const codigosSempre = MENSAGENS_SEMPRE.map(k => PEDAGOGICA[k]?.codigo).filter(Boolean);
    this._codigosPermitidos = new Set([...codigosFoco, ...codigosSempre]);
  }

  get treino() { return this._treino; }
  seloTexto() { return this._treino.selo; }
  subsFoco() { return this._treino.subsFoco.slice(); }

  setVoltaAtual(n) { if (Number.isFinite(n)) this._voltaAtual = n; }

  /** Últimas 2 voltas antes de parada planejada = consolidação (sem meta nova). */
  consolidacaoPreBox() {
    if (this._voltaAtual == null) return false;
    const paradas = this._plano?.paradas;
    if (!Array.isArray(paradas)) return false;
    return paradas.some(p => Number.isFinite(p?.volta)
      && p.volta >= this._voltaAtual
      && p.volta - this._voltaAtual <= 1);
  }

  _seg(id) {
    if (!this._porSeg.has(id)) {
      this._porSeg.set(id, {
        passagens: 0,
        historico: [],        // últimas M passagens: { naBanda, focoDeltaS, totalS }
        falhasSeguidas: 0,
        regressoesAposConsolidar: 0,
        nivel: 'ativo',       // 'ativo' | 'reduzido' | 'calado'
        consolidado: false,
      });
    }
    return this._porSeg.get(id);
  }

  /** Pior delta entre os componentes do foco nesta passagem (s). */
  _focoDeltaS(resultadoDelta) {
    let pior = 0;
    const por = resultadoDelta?.porSubTrecho || {};
    for (const sub of this._treino.subsFoco) {
      const v = por[sub]?.deltaS;
      if (Number.isFinite(v) && v > pior) pior = v;
    }
    return pior;
  }

  /**
   * Alimenta o motor com o resultado de cada passagem (evento delta-calculado).
   * Atualiza calibração, consistência, falhas e consolidação do trecho.
   */
  registrarDelta(ev) {
    if (!ev || !ev.segmentId) return;
    const st = this._seg(ev.segmentId);
    const focoDelta = this._focoDeltaS(ev);
    const totalS = Number.isFinite(ev.deltaTotalS) ? ev.deltaTotalS : null;

    // guarda do círculo de tração: o trecho inteiro não pode ter piorado
    const anteriores = st.historico.filter(h => h.totalS != null);
    const mediaTotalAnterior = anteriores.length
      ? anteriores.reduce((s, h) => s + h.totalS, 0) / anteriores.length
      : null;
    const totalOk = (totalS == null || mediaTotalAnterior == null)
      ? true
      : totalS <= mediaTotalAnterior + GUARDA_TOTAL_TOLERANCIA_S;

    const naBandaFoco = focoDelta <= BANDA_FOCO_S;
    const naBanda = naBandaFoco && totalOk;

    // anti-saturação: falha = fora da banda E piorando vs a passagem anterior
    const ultima = st.historico[st.historico.length - 1];
    if (!naBandaFoco && ultima && focoDelta > ultima.focoDeltaS + 0.01) {
      st.falhasSeguidas += 1;
    } else if (naBandaFoco) {
      st.falhasSeguidas = 0;
      if (st.nivel !== 'calado') st.nivel = 'ativo';
    }
    if (st.nivel !== 'calado') {
      if (st.falhasSeguidas >= FALHAS_PARA_CALAR) st.nivel = 'calado';
      else if (st.falhasSeguidas >= FALHAS_PARA_REDUZIR) st.nivel = 'reduzido';
    }

    st.passagens += 1;
    st.historico.push({ naBanda, focoDeltaS: focoDelta, totalS });
    while (st.historico.length > CONSISTENCIA_M) st.historico.shift();

    // consistência: N das últimas M na banda → consolidado (a IA cala aqui)
    if (!st.consolidado && st.historico.length >= CONSISTENCIA_M) {
      const dentro = st.historico.filter(h => h.naBanda).length;
      if (dentro >= CONSISTENCIA_N) {
        st.consolidado = true;
        st.regressoesAposConsolidar = 0;
      }
    } else if (st.consolidado) {
      // reabre se regredir de verdade 2 passagens seguidas
      if (!naBandaFoco) {
        st.regressoesAposConsolidar += 1;
        if (st.regressoesAposConsolidar >= REABRE_APOS_REGRESSOES) {
          st.consolidado = false;
          st.regressoesAposConsolidar = 0;
          st.falhasSeguidas = 0;
          st.nivel = 'ativo';
        }
      } else {
        st.regressoesAposConsolidar = 0;
      }
    }

    // válvula re-arma quando o componente fora do foco melhora
    const furado = this._valvulaUsada.get(ev.segmentId);
    if (furado) {
      const v = ev.porSubTrecho?.[furado]?.deltaS;
      if (Number.isFinite(v) && v < VALVULA_FORA_FOCO_S) this._valvulaUsada.delete(ev.segmentId);
    }
  }

  /** Ponto de freada real (metros desde a entrada) — consumo do evento
   *  freada-iniciou, que era medido e morria órfão (achado da pesquisa 11/06). */
  registrarFreada(ev) {
    if (!ev || !ev.segmentId || !Number.isFinite(ev.distFromEntradaM)) return;
    const st = this._seg(ev.segmentId);
    if (!Array.isArray(st.freadasM)) st.freadasM = [];
    st.freadasM.push(ev.distFromEntradaM);
    while (st.freadasM.length > 10) st.freadasM.shift();
  }

  /** O painel deve mostrar a orientação do treino neste trecho agora? */
  deveOrientar(segmentId) {
    if (this.consolidacaoPreBox()) return false;
    const st = this._seg(segmentId);
    if (st.passagens < CALIBRACAO_PASSAGENS) return false; // calibrando o hábito
    if (st.consolidado) return false;                      // aprendeu — silêncio
    if (st.nivel === 'calado') return false;               // saturou — fica pro box
    return true;
  }

  /**
   * Degrau digerível na prescrição em metros (decisão 2 do Flávio, 11/06):
   * pede ~30% do caminho, teto 4 m (2 m com exigência recuada). Caminho curto
   * (≤ teto) vai inteiro. O sinal acompanha a direção real.
   */
  aplicarDegrau(difM, segmentId = null) {
    if (!Number.isFinite(difM) || difM === 0) return difM;
    const st = segmentId ? this._seg(segmentId) : null;
    const teto = st && st.nivel === 'reduzido' ? DEGRAU_TETO_REDUZIDO_M : DEGRAU_TETO_M;
    const abs = Math.abs(difM);
    if (abs <= teto) return difM;
    // prescrição em metros INTEIROS — a 140 km/h ninguém executa "3,6 m"
    const degrau = Math.round(Math.min(teto, Math.max(DEGRAU_PISO_M, abs * DEGRAU_FRACAO)));
    return Math.sign(difM) * degrau;
  }

  /**
   * Filtro do slot de mensagem (plugado em criarEmpurradorDeMensagens):
   * passa só mensagens do grupo do foco + Resultado/Sistema. Erro GRAVE fora
   * do foco (≥ VALVULA_FORA_FOCO_S) fura o filtro 1 vez por trecho (válvula
   * LIGADA — decisão 1 do Flávio, 11/06) e re-arma quando aquele componente
   * melhora. Erro comum fora do foco vai pro box, não pro para-brisa.
   */
  filtroMensagem(msg, evDelta = null) {
    if (!msg) return null;
    if (this._codigosPermitidos.has(msg.codigo)) return msg;
    if (evDelta && evDelta.segmentId
        && evDelta.piorSubTrecho
        && !this._treino.subsFoco.includes(evDelta.piorSubTrecho)
        && Number.isFinite(evDelta.piorDeltaS)
        && evDelta.piorDeltaS >= VALVULA_FORA_FOCO_S
        && !this._valvulaUsada.has(evDelta.segmentId)) {
      this._valvulaUsada.set(evDelta.segmentId, evDelta.piorSubTrecho);
      return msg; // a válvula fura UMA vez — o resto fica pro debrief
    }
    return null;
  }

  /** Estado pedagógico de um trecho (debug / pós-stint). */
  estado(segmentId) {
    const st = this._seg(segmentId);
    return {
      passagens: st.passagens,
      nivel: st.nivel,
      consolidado: st.consolidado,
      falhasSeguidas: st.falhasSeguidas,
      naBandaUltimas: st.historico.map(h => h.naBanda),
      freadasM: (st.freadasM || []).slice(),
    };
  }

  /** Resumo do treino (payload do pós-stint — aditivo, não muda contrato). */
  resumo() {
    const porSegmento = {};
    for (const [id] of this._porSeg) porSegmento[id] = this.estado(id);
    return { foco: this._treino.id, selo: this._treino.selo, porSegmento };
  }
}
