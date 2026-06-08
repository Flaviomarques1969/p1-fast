// mensagens-pedagogicas.js — traduz o resultado do delta-calculator (e o
// estado do ápice) em uma das 17 mensagens pedagógicas aprovadas por Flávio
// em 27/05/2026.
//
// Catálogo aprovado: _design-reference/versions/mensagens-painel-piloto-v1-aprovado-2026-05-27.json
//
// 17 mensagens distribuídas em 4 grupos:
//   - Controle Freio:       01 FREOU CEDO, 02 FREOU TARDE
//   - Controle Volante:     03 VIROU POUCO, 04 VIROU MUITO, 06 VIROU TARDE, 07 VIROU CEDO
//   - Controle Acelerador:  05 ACELEROU TARDE, 08 PISOU POUCO, 14 ALIVIA PÉ
//   - Resultado:            09 RECORDE, 10 MANTEVE LINHA, 11 MELHOR STINT, 12 BUSCAR LIMITE
//   - Sistema:              13 REGISTRANDO
//   - Alertas:              15 PNEU QUENTE, 16 PISTA SUJA  (vêm dos alertas-criticos)
//   - Box:                  17 BOX                          (vem dos alertas-criticos manuais)
//
// Esta peça cobre 01-13. 14-17 já são disparadas por outros módulos
// (alertas-criticos.js dispara 14/15/16/17 conforme regra/manual).

import { MsgTipo } from './cockpit-state.js';

// IDs canônicos (espelha o JSON aprovado)
export const PEDAGOGICA = Object.freeze({
  FREOU_CEDO:      { codigo: '01', texto: 'FREOU CEDO',     controle: 'Freio' },
  FREOU_TARDE:     { codigo: '02', texto: 'FREOU TARDE',    controle: 'Freio' },
  VIROU_POUCO:     { codigo: '03', texto: 'VIROU POUCO',    controle: 'Volante' },
  VIROU_MUITO:     { codigo: '04', texto: 'VIROU MUITO',    controle: 'Volante' },
  ACELEROU_TARDE:  { codigo: '05', texto: 'ACELEROU TARDE', controle: 'Acelerador' },
  VIROU_TARDE:     { codigo: '06', texto: 'VIROU TARDE',    controle: 'Volante' },
  VIROU_CEDO:      { codigo: '07', texto: 'VIROU CEDO',     controle: 'Volante' },
  PISOU_POUCO:     { codigo: '08', texto: 'PISOU POUCO',    controle: 'Acelerador' },
  RECORDE:         { codigo: '09', texto: 'RECORDE',        controle: 'Resultado' },
  MANTEVE_LINHA:   { codigo: '10', texto: 'MANTEVE LINHA',  controle: 'Resultado' },
  MELHOR_STINT:    { codigo: '11', texto: 'MELHOR STINT',   controle: 'Resultado' },
  BUSCAR_LIMITE:   { codigo: '12', texto: 'BUSCAR LIMITE',  controle: 'Sugestão' },
  REGISTRANDO:     { codigo: '13', texto: 'REGISTRANDO',    controle: 'Sistema' },
});

// Limiar pra considerar delta "essencialmente zero" (BUSCAR LIMITE).
const DELTA_ZERO_S = 0.05;
// Delta mínimo do sub-trecho pra acionar mensagem direcionada (1 cm/s × seg).
const SUB_TRECHO_MIN_S = 0.05;
// Quando o ganho na passagem inteira é menor que isso, vira MANTEVE LINHA.
const MANTEVE_LINHA_GANHO_MAX_S = 0.15;
// Quando o ganho é maior que isso e supera o recorde absoluto, vira RECORDE.
const RECORDE_GANHO_MIN_S = 0.10;

/**
 * Decide qual mensagem pedagógica mostrar com base no resultado do delta
 * + contexto do ápice + estado de referência.
 *
 * @param {Object} args
 * @param {Object|null} args.resultadoDelta  Saída do calcularDelta. Null = sem referência.
 * @param {Object} [args.contextoApice]      { angleDeg, distM } — bolinha de correção
 * @param {boolean} [args.primeiraPassagem]  true se ainda não havia referência salva
 * @param {number}  [args.recordeAbsolutoS]  Melhor tempo histórico do trecho (se existir)
 * @param {boolean} [args.bateuMelhorStint]  true se a passagem atual virou a melhor do stint
 * @returns {{codigo: string, texto: string, controle: string, tipo: string}|null}
 */
export function decidirMensagemPedagogica({
  resultadoDelta = null,
  contextoApice = null,
  primeiraPassagem = false,
  recordeAbsolutoS = null,
  bateuMelhorStint = false,
} = {}) {
  // Caso 1 — Sem referência ainda (primeira passagem do trecho)
  if (primeiraPassagem || !resultadoDelta) {
    return { ...PEDAGOGICA.REGISTRANDO, tipo: MsgTipo.COMUNICACAO };
  }

  const { piorSubTrecho, piorDeltaS, deltaTotalS } = resultadoDelta;

  // Caso 2 — Delta total negativo (ganhou tempo) — variação de resultado
  if (Number.isFinite(deltaTotalS) && deltaTotalS <= -DELTA_ZERO_S) {
    const ganho = -deltaTotalS;
    // RECORDE: ganho significativo + se sabemos o recorde absoluto, bate ele
    if (ganho >= RECORDE_GANHO_MIN_S) {
      if (recordeAbsolutoS == null) {
        return { ...PEDAGOGICA.RECORDE, tipo: MsgTipo.COMUNICACAO };
      }
      // A passagem atual é melhor que a referência (que JÁ É a melhor) por X.
      // Se referência veio do banco com tempoS, e a atual é tempoRef - ganho < recordeAbsoluto,
      // então é recorde absoluto.
      const tempoAtual = (resultadoDelta.tempoAtualS != null)
        ? resultadoDelta.tempoAtualS
        : null;
      if (tempoAtual != null && tempoAtual < recordeAbsolutoS) {
        return { ...PEDAGOGICA.RECORDE, tipo: MsgTipo.COMUNICACAO };
      }
      // Ganhou tempo mas não bateu absoluto → MELHOR STINT
      if (bateuMelhorStint) {
        return { ...PEDAGOGICA.MELHOR_STINT, tipo: MsgTipo.COMUNICACAO };
      }
      return { ...PEDAGOGICA.RECORDE, tipo: MsgTipo.COMUNICACAO };
    }
    // Ganho pequeno → MANTEVE LINHA
    if (ganho <= MANTEVE_LINHA_GANHO_MAX_S) {
      return { ...PEDAGOGICA.MANTEVE_LINHA, tipo: MsgTipo.COMUNICACAO };
    }
    // Ganho mediano sem flag de stint → MELHOR STINT por padrão
    return { ...PEDAGOGICA.MELHOR_STINT, tipo: MsgTipo.COMUNICACAO };
  }

  // Caso 3 — Delta praticamente zero → BUSCAR LIMITE
  if (Number.isFinite(deltaTotalS) && Math.abs(deltaTotalS) < DELTA_ZERO_S) {
    return { ...PEDAGOGICA.BUSCAR_LIMITE, tipo: MsgTipo.COMUNICACAO };
  }

  // Caso 4 — Perdeu tempo, foco no pior sub-trecho
  if (!piorSubTrecho || !Number.isFinite(piorDeltaS) || piorDeltaS < SUB_TRECHO_MIN_S) {
    return null; // perda imensurável — não atrapalha o piloto
  }

  if (piorSubTrecho === 'entrada') {
    return { ...PEDAGOGICA.PISOU_POUCO, tipo: MsgTipo.COMUNICACAO };
  }
  if (piorSubTrecho === 'freio') {
    return classificarMensagemFreio({ resultadoDelta });
  }
  if (piorSubTrecho === 'apice') {
    return classificarMensagemApice({ contextoApice });
  }
  if (piorSubTrecho === 'saida') {
    return { ...PEDAGOGICA.ACELEROU_TARDE, tipo: MsgTipo.COMUNICACAO };
  }
  return null;
}

/**
 * Diferencia FREOU CEDO de FREOU TARDE olhando o sub-trecho de entrada.
 * Heurística: se na entrada chegou mais rápido que a referência (delta entrada < 0)
 * e perdeu tempo na frenagem (delta freio > 0) → freou TARDE (atropelou).
 * Caso contrário → freou CEDO (tirou velocidade demais cedo).
 */
function classificarMensagemFreio({ resultadoDelta }) {
  const subs = resultadoDelta?.porSubTrecho ?? {};
  const entradaDelta = subs.entrada?.deltaS ?? 0;
  // Chegou mais rápido na linha de entrada + perdeu tempo no freio = freou TARDE
  if (entradaDelta < -0.02) {
    return { ...PEDAGOGICA.FREOU_TARDE, tipo: MsgTipo.COMUNICACAO };
  }
  return { ...PEDAGOGICA.FREOU_CEDO, tipo: MsgTipo.COMUNICACAO };
}

/**
 * Mapeia ângulo da bolinha do ápice em VIROU POUCO/MUITO/TARDE/CEDO.
 *
 * Convenção do produto (decisão Flávio 27/05/2026):
 *   - Bolinha aponta pra ONDE ESTAVA o ápice ideal em relação ao carro.
 *   - 0° (frente)    = ápice à frente do carro     → VIROU CEDO (antecipou)
 *   - 180° (atrás)   = ápice ficou pra trás        → VIROU TARDE (atrasou)
 *   - 90° (direita)  = ápice à direita             → VIROU POUCO (não fechou)
 *   - 270° (esquerda)= ápice à esquerda            → VIROU MUITO (cortou demais)
 *
 * Janelas de classificação ±45° em torno de cada quadrante.
 */
function classificarMensagemApice({ contextoApice }) {
  const angle = contextoApice?.angleDeg;
  if (typeof angle !== 'number' || !Number.isFinite(angle)) {
    return { ...PEDAGOGICA.VIROU_POUCO, tipo: MsgTipo.COMUNICACAO };
  }
  const a = ((angle % 360) + 360) % 360;
  if (a < 45 || a >= 315) return { ...PEDAGOGICA.VIROU_CEDO,  tipo: MsgTipo.COMUNICACAO };
  if (a >= 45  && a < 135) return { ...PEDAGOGICA.VIROU_POUCO, tipo: MsgTipo.COMUNICACAO };
  if (a >= 135 && a < 225) return { ...PEDAGOGICA.VIROU_TARDE, tipo: MsgTipo.COMUNICACAO };
  return { ...PEDAGOGICA.VIROU_MUITO, tipo: MsgTipo.COMUNICACAO };
}

/**
 * Listagem útil pra debug/UI.
 */
export function listarMensagens() {
  return Object.values(PEDAGOGICA);
}

/**
 * Plugger pronto: cria callback que recebe o evento `delta-calculado` (e
 * opcionalmente o ângulo do ápice da passagem) e empurra a mensagem no
 * CockpitState.
 *
 * Uso típico em main-t3000.js:
 *   const empurrarMsg = criarEmpurradorDeMensagens({ cockpitState });
 *   onTrechoEvent: (ev) => {
 *     if (ev.type === 'delta-calculado') empurrarMsg(ev);
 *     if (ev.type === 'apice-passagem') empurrarMsg.setUltimoApice(ev);
 *   }
 */
export function criarEmpurradorDeMensagens({ cockpitState, getRecordeAbsoluto = () => null } = {}) {
  if (!cockpitState) throw new Error('mensagens-pedagogicas: cockpitState obrigatório');
  let _ultimoApice = null;
  let _melhorStintPorSegmento = new Map(); // segmentId → menorTempoS visto neste stint

  function empurrar(evDelta) {
    if (!evDelta) return;
    // Caso especial: evento 'passagem-salva' significa que esta passagem virou
    // a melhor histórica do trecho (substituiu a referência no banco). Combina
    // com delta negativo (ganhou tempo) pra emitir RECORDE/MELHOR STINT.
    const segId = evDelta.segmentId;
    const recordeAbsoluto = getRecordeAbsoluto(segId);

    // Marca como melhor stint local se ainda não há registro ou é menor
    let bateuMelhorStint = false;
    if (Number.isFinite(evDelta.tempoAtualS)) {
      const prevMelhor = _melhorStintPorSegmento.get(segId);
      if (prevMelhor == null || evDelta.tempoAtualS < prevMelhor) {
        _melhorStintPorSegmento.set(segId, evDelta.tempoAtualS);
        if (prevMelhor != null) bateuMelhorStint = true;
      }
    }

    const msg = decidirMensagemPedagogica({
      resultadoDelta: evDelta,
      contextoApice: _ultimoApice,
      primeiraPassagem: false,
      recordeAbsolutoS: recordeAbsoluto,
      bateuMelhorStint,
    });
    if (msg) {
      try { cockpitState.showMessage({ tipo: msg.tipo, texto: msg.texto }); } catch {}
    }
  }

  // Permite que o caller atualize o último ápice antes do delta-calculado chegar.
  empurrar.setUltimoApice = (ev) => {
    if (!ev) return;
    _ultimoApice = {
      angleDeg: ev.angleFromIdealDeg ?? ev.angleDeg ?? null,
      distM:    ev.distFromIdealM    ?? ev.distM    ?? null,
    };
  };

  // Permite emitir REGISTRANDO logo na entrada do trecho quando não há referência.
  empurrar.emitirRegistrando = () => {
    const msg = decidirMensagemPedagogica({ primeiraPassagem: true });
    if (msg) {
      try { cockpitState.showMessage({ tipo: msg.tipo, texto: msg.texto }); } catch {}
    }
  };

  // Reseta o "melhor stint" (chamado ao iniciar novo stint).
  empurrar.resetarStint = () => { _melhorStintPorSegmento = new Map(); };

  return empurrar;
}
