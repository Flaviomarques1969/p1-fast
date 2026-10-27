// ============================================================================
// TRASEIRA SAIU PELO GIRO — item 9 da ordem do GPS aprovada pelo Flávio em 27/10/2026
// (painel p1fast-gps-funcoes-0850): "saída de traseira / saída de frente".
//
// Casa ÚNICA desta conta (docs/CONTRATO_DADOS.md §2). Módulo PURO: giro do carro (giroZ, °/s, cru
// do RaceBox), G lateral do carro (gLat, já com o zero do box) e km/h entram; eventos saem.
//
// Física: em curva sem escorregar, o carro gira na mesma taxa em que a trajetória curva:
// giro = G lateral ÷ velocidade. Quando a traseira escorrega, a carroceria gira MAIS rápido do
// que a curva explica (o ângulo de deriva cresce). Evento = giro medido acima de
// (1 + EXCESSO_FRAC) × o esperado E pelo menos EXCESSO_MIN_DPS a mais, no mesmo sentido, por
// DURACAO_MIN_MS seguidos, em curva de verdade (|gLat| ≥ GLAT_MIN, km/h ≥ KMH_MIN).
// O sinal do giro depende de como o aparelho está montado: é APRENDIDO nas curvas (giro × esperado)
// e nada é julgado antes de APRENDER_MIN leituras de curva.
//
// "Saída de FRENTE" (o carro gira MENOS do que o volante pede) NÃO se mede aqui: sem o ângulo do
// volante não há o que comparar — giro menor que o esperado é só curva mais aberta.
// NÃO PROVADO: offsets do giro no pacote vêm da documentação (RaceBoxUbxParser.cs) e os limites são
// de partida. Tudo sai "provável"; a 1ª gravação com giro + quadro cru decide.
// ============================================================================

export const KMH_MIN = 30;
export const GLAT_MIN = 0.2;
export const EXCESSO_FRAC = 0.3;
export const EXCESSO_MIN_DPS = 5;
export const DURACAO_MIN_MS = 200;
export const APRENDER_MIN = 50;        // leituras de curva (2 s a 25 Hz) antes de julgar
const APRENDER_GLAT = 0.3;             // curva firme para aprender o sinal
const G_MS2 = 9.80665;

/** Giro (°/s) que a curva explica: G lateral ÷ velocidade. */
export function giroEsperadoDps(gLat, kmh) {
  const v = kmh / 3.6;
  return v > 0 ? (gLat * G_MS2 / v) * 180 / Math.PI : 0;
}

/**
 * Detector em fluxo. `ler({ t, giroZ, gLat, kmh, ...extra })` a cada leitura; devolve os eventos
 * que FECHARAM nesta leitura. Evento: { t (início), duracaoMs, excessoDps (pico do excesso),
 * provavel: true, ...extra do início }. Leitura sem giroZ/gLat numéricos fecha o que estiver aberto
 * (conta só se já durou o mínimo) e não aprende — sem dado não se inventa continuação.
 */
export function criarDetectorTraseira() {
  let soma = 0, nAprendido = 0;
  let aberto = null;                   // { t, ultimoT, pico, extra }

  const sinal = () => (nAprendido >= APRENDER_MIN && soma !== 0 ? Math.sign(soma) : 0);

  function fechar() {
    const a = aberto; aberto = null;
    if (!a || a.ultimoT - a.t < DURACAO_MIN_MS) return [];
    return [{ ...a.extra, t: a.t, duracaoMs: a.ultimoT - a.t, excessoDps: Math.round(a.pico * 10) / 10, provavel: true }];
  }

  function ler({ t, giroZ, gLat, kmh, ...extra }) {
    if (typeof t !== 'number' || typeof giroZ !== 'number' || !Number.isFinite(giroZ)
      || typeof gLat !== 'number' || !Number.isFinite(gLat) || typeof kmh !== 'number') return fechar();
    const esperado = giroEsperadoDps(gLat, kmh);
    if (kmh >= KMH_MIN && Math.abs(gLat) >= APRENDER_GLAT) { soma += giroZ * esperado; nAprendido++; }
    const s = sinal();
    let excesso = 0;
    if (s !== 0 && kmh >= KMH_MIN && Math.abs(gLat) >= GLAT_MIN) {
      const medido = s * giroZ;                       // no sentido da curva
      if (medido * esperado > 0) {
        const m = Math.abs(medido), e = Math.abs(esperado);
        if (m > e * (1 + EXCESSO_FRAC) && m - e >= EXCESSO_MIN_DPS) excesso = m - e;
      }
    }
    if (excesso > 0) {
      if (!aberto) aberto = { t, ultimoT: t, pico: excesso, extra };
      aberto.ultimoT = t;
      if (excesso > aberto.pico) aberto.pico = excesso;
      return [];
    }
    return fechar();
  }

  return { ler, sinal, aprendido: () => nAprendido };
}

export default { criarDetectorTraseira, giroEsperadoDps };
