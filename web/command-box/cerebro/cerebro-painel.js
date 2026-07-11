// ============================================================================
// CÉREBRO DO PAINEL (Command Box) — peça de cálculo da NUVEM.
//
// Papel (arquitetura definitiva 16/06): o carro transmite o dado ao vivo; ESTE
// cérebro (que roda na nuvem, não na TV) escuta o stream, calcula, e devolve um
// RESULTADO PRONTO (PainelPronto). A TV do box só exibe o resultado pronto.
//
// É host-agnóstico de propósito: funciona num worker da nuvem OU num teste fora
// do ar (alimentado por volta gravada). Não assina canal, não publica — quem faz
// isso é o transporte que envolve este cérebro. Aqui é SÓ a conta.
//
// Estado de construção (ondas):
//   Onda 1 (ESTA)  -> stint (voltas) + ritmo (PB vs stint)         [REAL]
//   Onda 3         -> coach (frase/lição/pontuação)                 [pendente]
//   Onda 4         -> meta do piloto (tempo-alvo + voltas seguidas) [pendente]
//   Onda 5 (ESTA)  -> alerta preditivo de temperatura (+°C / ETA)     [REAL]
// O que ainda não foi construído sai como null e o painel mantém "aguardando
// ligação" só naquele bloco — honesto, sem fingir dado.
// ============================================================================

import { avaliarPreditivo } from './cerebro-preditivo.js';

/** Formata segundos -> "M:SS.dd" (ex.: 91.95 -> "1:31.95"). */
export function fmtTempo(sec) {
  if (sec == null || !isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

/** Formata uma duração de relógio em segundos -> "MM:SS" (ex.: 558 -> "09:18"). */
export function fmtRelogio(sec) {
  if (sec == null || !isFinite(sec) || sec < 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Cria o cérebro do painel.
 * @param {object} opts
 * @param {object} opts.plano        plano do stint (do app: { voltas, duracaoS, tempoAlvoSec? })
 * @param {number} opts.pbEverSec    melhor volta histórica do carro+config (referência do ritmo)
 * @param {number} opts.stintNumero  número do stint atual (ex.: 3)
 * @param {number} opts.stintTotal   total de stints planejados (ex.: 5)
 * @param {object} opts.coachStint   acumulador de stint do Coach de IA (cerebro-coach-stint.js).
 *                                    OPCIONAL: sem ele, o campo `coach` continua `null` e em
 *                                    `_pendentes` — comportamento IDÊNTICO ao de hoje (não quebra
 *                                    nenhum chamador). Com ele, o campo passa a exibir o pacote v1.
 */
export function criarCerebroPainel(opts = {}) {
  const plano = opts.plano || {};
  // Coach de IA (Onda 3) — conta em SEGUNDOS, casa própria (cerebro-coach-stint.js). Peça
  // separada: alimentada pelos deltas de trecho via onDeltaCoach; a v0 km/h (cerebro-coach.js)
  // fica intocada. Sem acumulador injetado → coach permanece null honesto (pendente).
  const coachStint = opts.coachStint || null;
  const cfg = {
    pbEverSec: opts.pbEverSec != null ? opts.pbEverSec : null,
    stintNumero: opts.stintNumero != null ? opts.stintNumero : null,
    stintTotal: opts.stintTotal != null ? opts.stintTotal : null,
    voltaTotal: plano.voltas != null ? plano.voltas : null,
    duracaoS: plano.duracaoS != null ? plano.duracaoS : null,
    // tempo-alvo do plano: quando o plano ainda não define (Onda 4), a régua do
    // ritmo cai na melhor volta histórica (PB) — comparação real e honesta.
    alvoRitmoSec: plano.tempoAlvoSec != null ? plano.tempoAlvoSec
                 : (opts.pbEverSec != null ? opts.pbEverSec : null),
    // meta do piloto (Onda 4): tempo-alvo por volta + nº de voltas seguidas.
    // Default (decisão Flávio 19/06, ajustável no plano): sub 1:32 (92.0s) em 8 voltas.
    alvoMetaSec: plano.tempoAlvoSec != null ? plano.tempoAlvoSec : 92.0,
    metaN: plano.metaVoltasSeguidas != null ? plano.metaVoltasSeguidas : 8,
    // Onda 5: limite crítico de temperatura (°C) pra projetar o alerta preditivo.
    // Default = Bubi (Celta 1.4): crítico 80°C (decisão Flávio 27/05/2026, mesma
    // régua de ALERTA_LIMITES_DEFAULT.waterMaxC). A nuvem passa o do carro real.
    tempLimiteC: opts.tempLimiteC != null ? opts.tempLimiteC : 80,
  };

  // ---- estado vivo do stint -------------------------------------------------
  const voltas = [];          // { n, tempoSec } de voltas FECHADAS neste stint
  const voltasTemp = [];      // { volta, maxTempC } por volta — base do alerta preditivo (Onda 5)
  let maxTempVoltaAtual = null; // maior waterTempC visto na volta em curso
  let ultimaAmostra = null;   // último sample cru recebido
  let decorridoS = null;      // relógio do stint (cronometroTotalS), se vier no sample

  /** Recebe o fechamento de uma volta (evento 'volta' do canal: { n, tempoMs }). */
  function onVolta(ev) {
    if (!ev) return;
    const n = ev.n != null ? ev.n : (voltas.length + 1);
    const tempoSec = ev.tempoMs != null ? ev.tempoMs / 1000
                   : (ev.tempoSec != null ? ev.tempoSec : null);
    if (tempoSec == null || !isFinite(tempoSec) || tempoSec <= 0) return;
    voltas.push({ n, tempoSec });
    // fecha o pico de temperatura desta volta (se houve dado real) e zera pra próxima.
    // Sem temperatura, NÃO inventa ponto — a série só tem voltas com dado real.
    if (typeof maxTempVoltaAtual === 'number') voltasTemp.push({ volta: n, maxTempC: maxTempVoltaAtual });
    maxTempVoltaAtual = null;
  }

  /** Recebe uma amostra crua de telemetria (evento 'sample'). */
  function onSample(s) {
    if (!s) return;
    ultimaAmostra = s;
    if (typeof s.cronometroTotalS === 'number') decorridoS = s.cronometroTotalS;
    // Onda 5: acumula o pico de temperatura (água do motor) da volta em curso.
    if (typeof s.waterTempC === 'number') {
      maxTempVoltaAtual = maxTempVoltaAtual == null ? s.waterTempC : Math.max(maxTempVoltaAtual, s.waterTempC);
    }
  }

  // ---- ONDA 1: bloco STINT (voltas) ----------------------------------------
  function calcStint() {
    const voltaAtual = voltas.length;              // voltas já fechadas
    const voltaTotal = cfg.voltaTotal;
    const voltaPct = (voltaTotal && voltaTotal > 0)
      ? Math.max(0, Math.min(100, Math.round((voltaAtual / voltaTotal) * 100)))
      : null;

    // decorrido: relógio do carro se houver; senão soma dos tempos de volta.
    const somaVoltas = voltas.reduce((a, v) => a + v.tempoSec, 0);
    const decorrido = decorridoS != null ? decorridoS : (voltas.length ? somaVoltas : null);
    const restante = (cfg.duracaoS != null && decorrido != null)
      ? Math.max(0, cfg.duracaoS - decorrido) : null;

    if (voltaAtual === 0 && voltaTotal == null) return null;
    return {
      numero: cfg.stintNumero,
      total: cfg.stintTotal,
      voltaAtual,
      voltaTotal,
      voltaPct,
      decorridoStr: fmtRelogio(decorrido),
      restanteStr: fmtRelogio(restante),
    };
  }

  // ---- ONDA 1: bloco RITMO VS PLANO ----------------------------------------
  function calcRitmo() {
    if (!voltas.length || cfg.alvoRitmoSec == null) return null;
    // melhor volta do stint (ignora a 1ª, que é volta de saída/aquecimento, se houver >1)
    const consideradas = voltas.length > 1 ? voltas.slice(1) : voltas;
    const stintBest = Math.min(...consideradas.map(v => v.tempoSec));
    // delta por volta: stint vs alvo. negativo = mais rápido = "à frente".
    const delta = stintBest - cfg.alvoRitmoSec;
    const lado = delta < -0.05 ? 'a-frente' : (delta > 0.05 ? 'atras' : 'no-ritmo');
    const tagTxt = lado === 'a-frente' ? `à frente · ${delta.toFixed(2)} / volta`
                 : lado === 'atras' ? `atrás · +${delta.toFixed(2)} / volta`
                 : 'no ritmo do plano';
    // barra centro-zero: 50% = no ritmo; cada 0,5s desloca ~14% (teto em 8-92%).
    const fillPct = Math.max(8, Math.min(92, 50 - (delta / 0.5) * 14));
    return {
      tag: tagTxt,
      lado,
      deltaPorVoltaSec: Number(delta.toFixed(3)),
      pbStr: fmtTempo(cfg.pbEverSec),
      stintStr: fmtTempo(stintBest),
      fillPct: Math.round(fillPct),
    };
  }

  // ---- ONDA 4: bloco META DO PILOTO ----------------------------------------
  // Meta = fazer N voltas (seguidas) abaixo de um tempo-alvo. atingidas = quantas
  // das voltas do stint ficaram <= alvo. tag pela última volta (no caminho/atrás).
  function fmtAlvo(sec) {
    if (sec == null) return '—';
    const m = Math.floor(sec / 60), s = Math.round(sec - m * 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function calcMeta() {
    if (!voltas.length || cfg.alvoMetaSec == null || cfg.metaN == null) return null;
    const consideradas = voltas.length > 1 ? voltas.slice(1) : voltas; // ignora out-lap
    const atingidas = consideradas.filter(v => v.tempoSec <= cfg.alvoMetaSec).length;
    const ultima = voltas[voltas.length - 1];
    const noCaminho = ultima.tempoSec <= cfg.alvoMetaSec;
    const tag = atingidas >= cfg.metaN ? 'batida' : (noCaminho ? 'no caminho' : 'atrás');
    return {
      tag,
      tempoAlvoStr: fmtAlvo(cfg.alvoMetaSec),     // "1:32"
      voltasSeguidas: cfg.metaN,
      atingidas,
      total: cfg.metaN,
      fillPct: Math.max(0, Math.min(100, Math.round((atingidas / cfg.metaN) * 100))),
    };
  }

  // ---- ONDA 1b: BARRA DO STINT (reflete o PLANEJAMENTO do stint) ------------
  // Regra do Flávio (27/06): a barra mostra a QUANTIDADE de voltas que ele
  // definiu no planejamento — a 1ª é sempre AQUECE, a última é sempre RESFRIA,
  // e onde ele marcou parada no box entra "box" naquela volta. O cérebro entrega
  // o total + as paradas + as voltas já fechadas (tempo real); a tela só DESENHA.
  // Sem plano de voltas, devolve null (a barra fica em demonstração — honesto).
  function calcStintBar() {
    // Paradas no box do plano (configuracao-stint: paradas:[{ volta, motivo }]) → números de volta.
    const paradas = (plano.paradas || [])
      .map(p => (typeof p === 'number' ? p : (p && p.volta)))
      .filter(v => v != null);
    return {
      // total do plano (1ª=aquece, última=resfria). Sem nada informado → 0 = barra ZERADA
      // (a tela mostra só os dois blocos aquece + resfria — Flávio 27/06). Não fabrica volta.
      voltas: cfg.voltaTotal != null ? cfg.voltaTotal : 0,
      paradas,                                               // voltas com parada no box → "box"
      lapHistory: voltas.map(v => ({ n: v.n, timeSec: v.tempoSec })),  // voltas fechadas (tempo real)
      current: voltas.length + 1,                            // volta em curso (após as fechadas)
      pbEver: cfg.pbEverSec,                                 // melhor volta histórica (referência de cor)
    };
  }

  /** Devolve o RESULTADO PRONTO do painel (o que a nuvem manda pra TV exibir). */
  function snapshot() {
    const stint = calcStint();
    const stintBar = calcStintBar();
    const ritmo = calcRitmo();
    const meta = calcMeta();
    const pendentes = [];
    // ondas ainda não construídas — declaradas como pendentes (painel fica honesto)
    // Onda 3 (coach): se há acumulador de stint, o campo passa a carregar o pacote v1
    // (null | 'silencio' | 'oportunidade'). null honesto preservado: sem acumulador OU sem
    // oportunidade confiável ainda → coach null e 'coach' segue em _pendentes (como hoje).
    const coach = coachStint ? coachStint.pacote() : null;
    if (coach == null) pendentes.push('coach');
    if (meta == null) pendentes.push('meta');
    // Onda 5 (REAL): alerta preditivo de temperatura. avaliarPreditivo devolve null
    // quando não há risco / faltam voltas / falta dado — honesto, sem inventar. A onda
    // está construída, então 'preditivo' NÃO entra mais em pendentes.
    const preditivo = avaliarPreditivo(voltasTemp, { limiteC: cfg.tempLimiteC });
    return {
      _versao: 1,
      _geradoComVoltas: voltas.length,
      stint,
      stintBar,
      ritmo,
      coach,
      meta,
      preditivo,
      _pendentes: pendentes,
    };
  }

  /** Encaminha o delta de um trecho ao acumulador do coach (se houver). Aditivo:
   *  sem acumulador, é no-op — não altera o fluxo atual do cérebro. */
  function onDeltaCoach(evDelta) { if (coachStint && typeof coachStint.onDelta === 'function') coachStint.onDelta(evDelta); }

  return { onVolta, onSample, onDeltaCoach, snapshot,
    // acesso só-leitura pra testes
    _estado: () => ({ voltas: voltas.slice(), decorridoS, ultimaAmostra }) };
}

export default { criarCerebroPainel, fmtTempo, fmtRelogio };
