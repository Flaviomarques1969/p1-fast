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
//   Onda 5         -> alerta preditivo (+°C / curva / ETA)          [pendente]
// O que ainda não foi construído sai como null e o painel mantém "aguardando
// ligação" só naquele bloco — honesto, sem fingir dado.
// ============================================================================

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
 */
export function criarCerebroPainel(opts = {}) {
  const plano = opts.plano || {};
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
  };

  // ---- estado vivo do stint -------------------------------------------------
  const voltas = [];          // { n, tempoSec } de voltas FECHADAS neste stint
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
  }

  /** Recebe uma amostra crua de telemetria (evento 'sample'). */
  function onSample(s) {
    if (!s) return;
    ultimaAmostra = s;
    if (typeof s.cronometroTotalS === 'number') decorridoS = s.cronometroTotalS;
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

  /** Devolve o RESULTADO PRONTO do painel (o que a nuvem manda pra TV exibir). */
  function snapshot() {
    const stint = calcStint();
    const ritmo = calcRitmo();
    const pendentes = [];
    // ondas ainda não construídas — declaradas como pendentes (painel fica honesto)
    const coach = null;     if (coach == null) pendentes.push('coach');
    const meta = null;      if (meta == null) pendentes.push('meta');
    const preditivo = null; if (preditivo == null) pendentes.push('preditivo');
    return {
      _versao: 1,
      _geradoComVoltas: voltas.length,
      stint,
      ritmo,
      coach,
      meta,
      preditivo,
      _pendentes: pendentes,
    };
  }

  return { onVolta, onSample, snapshot,
    // acesso só-leitura pra testes
    _estado: () => ({ voltas: voltas.slice(), decorridoS, ultimaAmostra }) };
}

export default { criarCerebroPainel, fmtTempo, fmtRelogio };
