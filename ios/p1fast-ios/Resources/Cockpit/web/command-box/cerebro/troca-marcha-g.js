// ============================================================================
// TROCA DE MARCHA PELO G — item 8 da ordem do GPS aprovada pelo Flávio em 27/10/2026
// (painel p1fast-gps-funcoes-0850).
//
// Casa ÚNICA desta conta (docs/CONTRATO_DADOS.md §2). Módulo PURO: G longitudinal do carro
// (gLong, já com o zero do box, calculado no notebook) + km/h + carimbo entram; trocas saem.
//
// Critério = o da análise de 27/10 (.claude-exec/analise-gps-20261027/capacidade2.py), portado
// leitura a leitura: G curto (média de 3 leituras centrada) durante aceleração (média das 8
// leituras anteriores > 0,08 G, > 12 km/h) cai abaixo de 35% do anterior e volta acima de 60%
// dentro de 20 leituras, com o "buraco" entre 0,12 e 0,8 s. Achou → pula 10 leituras.
// NÃO PROVADO NA PISTA: na rua deu 2 prováveis. Por isso tudo sai marcado "provável" e a tela
// diz isso; a régua do sábado (gravação com giro do T4000) decide se o critério fica.
// LIMITE CONHECIDO (catraca, 27/10): com leitura mais lenta (10 Hz) a média das 8 anteriores demora a
// cair, e a CAUDA de um buraco longo (1,2 s) ainda passa como troca de ~0,7 s. A 25 Hz não acontece.
// ============================================================================

export const G_ANTES_MIN = 0.08;
export const KMH_MIN = 12;
export const QUEDA_FRAC = 0.35;
export const VOLTA_FRAC = 0.6;
export const BURACO_MIN_S = 0.12;
export const BURACO_MAX_S = 0.8;
const JANELA_ANTES = 8;      // leituras antes do ponto
const PROCURA_VOLTA = 20;    // leituras para o G voltar
const PULO_DEPOIS = 10;      // leituras puladas depois de uma troca
const ATRASO = PROCURA_VOLTA + 5;   // o critério olha até 25 leituras à frente (igual ao "n − 25" da análise)

/**
 * Detector em fluxo. `ler({ t, gLong, kmh, ...extra })` a cada leitura (25 Hz); devolve as trocas
 * confirmadas nesta chamada (com ~1 s de atraso, o tempo que o critério precisa olhar à frente).
 * Cada troca: { t, kmh, gAntes, buracoS, provavel: true, ...extra do ponto da queda }.
 * Leitura sem gLong numérico zera o histórico (sem G não se inventa troca).
 */
export function criarDetectorTrocaMarcha() {
  let base = 0;            // índice absoluto da 1ª leitura guardada
  let pts = [];            // { t, g, kmh, extra }
  let proximo = 10;        // próximo índice absoluto a examinar (a análise começa em 10)

  const gCurto = (i) => {  // média de 3 centrada (med(gx, i, 1)), nas bordas só o que existe
    let s = 0, n = 0;
    for (let k = i - 1; k <= i + 1; k++) { const p = pts[k - base]; if (p) { s += p.g; n++; } }
    return s / n;
  };

  function examinar() {
    const saidas = [];
    const fim = base + pts.length;
    while (proximo < fim - ATRASO) {
      const i = proximo;
      let antes = 0;
      for (let k = i - JANELA_ANTES; k < i; k++) antes += gCurto(k);
      antes /= JANELA_ANTES;
      const p = pts[i - base];
      if (antes > G_ANTES_MIN && p.kmh > KMH_MIN && gCurto(i) < antes * QUEDA_FRAC) {
        let k = null;
        for (let j = i + 1; j < Math.min(fim, i + PROCURA_VOLTA); j++) if (gCurto(j) > antes * VOLTA_FRAC) { k = j; break; }
        if (k != null) {
          const buracoS = (pts[k - base].t - p.t) / 1000;
          if (buracoS >= BURACO_MIN_S && buracoS <= BURACO_MAX_S) {
            saidas.push({ ...p.extra, t: p.t, kmh: Math.round(p.kmh * 10) / 10, gAntes: Math.round(antes * 1000) / 1000,
              buracoS: Math.round(buracoS * 1000) / 1000, provavel: true });
            proximo = k + PULO_DEPOIS;
            continue;
          }
        }
      }
      proximo = i + 1;
    }
    // guarda só o que o critério ainda pode olhar para trás (janela + média curta)
    const corte = Math.min(proximo - JANELA_ANTES - 2, fim);
    if (corte > base) { pts = pts.slice(corte - base); base = corte; }
    return saidas;
  }

  function ler({ t, gLong, kmh, ...extra }) {
    if (typeof gLong !== 'number' || !Number.isFinite(gLong) || typeof t !== 'number') {
      base = base + pts.length; pts = []; proximo = base + 10;
      return [];
    }
    pts.push({ t, g: gLong, kmh: typeof kmh === 'number' ? kmh : 0, extra });
    return examinar();
  }

  return { ler };
}

export default { criarDetectorTrocaMarcha };
