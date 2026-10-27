// ============================================================================
// STINT GRAVADO — carrega um stint JÁ GRAVADO como VOLTAS REAIS pra TV do box.
//
// Papel (Missão 4 / arquitetura definitiva 16/06 + CONTRATO_DADOS 23/06):
// quando NÃO há carro ao vivo, a TV do box não pode inventar volta (o velho
// FAKE_LAPS). Este módulo pega um stint GRAVADO (fixture de dado real) e o
// entrega ao "cérebro do painel" (cerebro-painel.js) como se fossem voltas
// reais chegando — a tela recebe um RESULTADO PRONTO (PainelPronto) de verdade.
//
// E quando NÃO há carro E NÃO há stint gravado, este módulo devolve o estado
// SEM_DADO explícito: a tela mostra "sem dado" em vez de número fictício.
//
// É host-agnóstico e PURO: só transforma (stint gravado -> PainelPronto). Não
// faz fetch, não assina canal, não toca o DOM. Quem busca o JSON e escreve na
// tela é o carregador do Command Box (fim do <body> da vista-piloto). Assim a
// mesma conta serve à nuvem (worker) e ao teste fora do ar.
//
// Fonte do stint gravado (fixture real): web/cockpit/fixtures/stint-brasilia-3-laps.v1.json
// (mesma que o cérebro do painel já usava — só que agora com estado "sem dado" honesto).
// ============================================================================

import { criarCerebroPainel } from './cerebro-painel.js';

/**
 * PainelPronto de estado "sem dado": nenhum número inventado.
 * A tela lê isto e mostra "sem dado" (não FAKE_LAPS, não demonstração escondida).
 */
export const PAINEL_SEM_DADO = Object.freeze({
  _versao: 1,
  _semDado: true,
  _origem: 'sem-dado',
  _geradoComVoltas: 0,
  stint: null,
  stintBar: null,
  ritmo: null,
  coach: null,
  meta: null,
  preditivo: null,
  _pendentes: ['stint', 'ritmo', 'meta', 'coach', 'preditivo'],
});

/**
 * Valida a forma mínima de um stint gravado.
 * Aceita: { track:{pbEverSec}, stintHistory:{ totalLaps, entries:[{lapNumber,timeSec}] } }.
 * @returns {boolean}
 */
export function stintGravadoValido(fx) {
  if (!fx || typeof fx !== 'object') return false;
  const sh = fx.stintHistory;
  if (!sh || !Array.isArray(sh.entries)) return false;
  // precisa de pelo menos UMA volta com tempo real (senão não há "dado")
  return sh.entries.some((e) => e && typeof e.timeSec === 'number' && isFinite(e.timeSec) && e.timeSec > 0);
}

/**
 * Constrói o PainelPronto a partir de um stint GRAVADO (dado real).
 *
 * @param {object} stintGravado  o fixture do stint (ver stintGravadoValido)
 * @param {object} [opts]
 * @param {object} [opts.plano]        plano do stint (voltas/duracaoS/paradas), como o app manda
 * @param {number} [opts.stintNumero]  nº do stint atual
 * @param {number} [opts.stintTotal]   total de stints planejados
 * @param {number} [opts.tempLimiteC]  limite crítico de temperatura (°C) do carro real
 * @returns {object}  PainelPronto REAL, ou PAINEL_SEM_DADO se o stint não for válido.
 */
export function painelDeStintGravado(stintGravado, opts = {}) {
  if (!stintGravadoValido(stintGravado)) return PAINEL_SEM_DADO;

  const fx = stintGravado;
  const plano = opts.plano || {
    // sem plano de voltas → barra ZERADA (só aquece + resfria) — Flávio 27/06.
    duracaoS: 28 * 60,
    paradas: [],
  };

  const cerebro = criarCerebroPainel({
    plano,
    pbEverSec: fx.track && typeof fx.track.pbEverSec === 'number' ? fx.track.pbEverSec : null,
    stintNumero: opts.stintNumero != null ? opts.stintNumero : null,
    stintTotal: opts.stintTotal != null ? opts.stintTotal : null,
    tempLimiteC: opts.tempLimiteC,
  });

  // Alimenta o cérebro com as voltas REAIS do stint gravado (tempo de verdade).
  let somaTempos = 0;
  for (const e of fx.stintHistory.entries) {
    if (e && typeof e.timeSec === 'number' && isFinite(e.timeSec) && e.timeSec > 0) {
      cerebro.onVolta({ n: e.lapNumber, tempoSec: e.timeSec });
      somaTempos += e.timeSec;
    }
  }
  // relógio do stint = soma dos tempos reais (sem inventar cronômetro ao vivo).
  cerebro.onSample({ cronometroTotalS: somaTempos });

  const pronto = cerebro.snapshot();
  pronto._origem = 'stint-gravado';
  pronto._semDado = false;
  return pronto;
}

/**
 * Decide a FONTE do painel (regra honesta da TV do box):
 *   1) carro AO VIVO fresco  -> deixa o painel da nuvem/cérebro-vivo mandar (retorna null aqui).
 *   2) sem carro + stint gravado -> PainelPronto REAL do stint gravado.
 *   3) sem carro + sem stint -> PAINEL_SEM_DADO ("sem dado", nunca inventa).
 *
 * @param {object} entrada
 * @param {boolean} entrada.carroAoVivo   há carro transmitindo agora?
 * @param {object|null} entrada.stintGravado  o fixture gravado (ou null)
 * @param {object} [entrada.opts]  repassado a painelDeStintGravado
 * @returns {object|null}  PainelPronto pra exibir, ou null se o ao-vivo assume.
 */
export function escolherFontePainel(entrada = {}) {
  if (entrada.carroAoVivo) return null;                 // ao vivo manda; não sobrescreve
  if (stintGravadoValido(entrada.stintGravado)) {
    return painelDeStintGravado(entrada.stintGravado, entrada.opts || {});
  }
  return PAINEL_SEM_DADO;                                // honesto: sem dado
}

export default { PAINEL_SEM_DADO, stintGravadoValido, painelDeStintGravado, escolherFontePainel };
